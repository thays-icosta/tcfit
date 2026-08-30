import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CreatePeriodizationScreen({ studentId, studentName, personalId, onClose }) {
  const [totalWeeks, setTotalWeeks] = useState('12');
  const [phases, setPhases] = useState([]);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseWeeks, setNewPhaseWeeks] = useState('');
  const [existingPlanId, setExistingPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlan = async () => {
    const { data: planRows } = await supabase
      .from('periodization_plans')
      .select('id, total_weeks')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (planRows && planRows.length > 0) {
      const plan = planRows[0];
      setExistingPlanId(plan.id);
      setTotalWeeks(String(plan.total_weeks));

      const { data: phaseRows } = await supabase
        .from('periodization_phases')
        .select('id, name, duration_weeks, order_index')
        .eq('plan_id', plan.id)
        .order('order_index', { ascending: true });
      setPhases((phaseRows || []).map((p) => ({ tempId: p.id, name: p.name, weeks: String(p.duration_weeks) })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPlan();
  }, [studentId]);

  const handleAddPhase = () => {
    if (!newPhaseName.trim() || !newPhaseWeeks.trim()) {
      showAlert('Ops', 'Preenche o nome e a duração da fase.');
      return;
    }
    setPhases((prev) => [...prev, { tempId: uuidv4(), name: newPhaseName.trim(), weeks: newPhaseWeeks.trim() }]);
    setNewPhaseName('');
    setNewPhaseWeeks('');
  };

  const handleRemovePhase = (tempId) => {
    setPhases((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const handleMovePhase = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= phases.length) return;
    const newPhases = [...phases];
    [newPhases[index], newPhases[newIndex]] = [newPhases[newIndex], newPhases[index]];
    setPhases(newPhases);
  };

  const distributedWeeks = phases.reduce((sum, p) => sum + (Number(p.weeks) || 0), 0);
  const totalWeeksNum = Number(totalWeeks) || 0;
  const isFullyDistributed = distributedWeeks === totalWeeksNum && totalWeeksNum > 0;

  const handleSave = async () => {
    if (!totalWeeksNum || totalWeeksNum <= 0) {
      showAlert('Ops', 'Define a duração total do plano em semanas.');
      return;
    }
    if (phases.length === 0) {
      showAlert('Ops', 'Adiciona pelo menos uma fase.');
      return;
    }
    setSaving(true);

    let planId = existingPlanId;
    if (planId) {
      await supabase.from('periodization_plans').update({ total_weeks: totalWeeksNum }).eq('id', planId);
      await supabase.from('periodization_phases').delete().eq('plan_id', planId);
    } else {
      const { data: newPlan, error } = await supabase
        .from('periodization_plans')
        .insert({ student_id: studentId, personal_id: personalId, total_weeks: totalWeeksNum })
        .select()
        .single();
      if (error) {
        setSaving(false);
        showAlert('Erro', error.message);
        return;
      }
      planId = newPlan.id;
      setExistingPlanId(planId);
    }

    const phaseRows = phases.map((p, i) => ({
      plan_id: planId,
      name: p.name,
      duration_weeks: Number(p.weeks),
      order_index: i,
    }));
    const { error: insertError } = await supabase.from('periodization_phases').insert(phaseRows);

    setSaving(false);
    if (insertError) {
      showAlert('Erro', insertError.message);
    } else {
      showAlert('Salvo!', 'O plano de periodização foi salvo.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Plano de Periodização</Text>
      </View>

      {studentName && <Text style={styles.studentLabel}>{studentName}</Text>}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Duração total do plano (semanas)</Text>
          <TextInput
            style={styles.totalWeeksInput}
            keyboardType="number-pad"
            placeholder="12"
            placeholderTextColor="#525252"
            value={totalWeeks}
            onChangeText={setTotalWeeks}
          />
        </View>

        <View style={[styles.indicatorCard, isFullyDistributed ? styles.indicatorCardOk : styles.indicatorCardWarning]}>
          <Ionicons
            name={isFullyDistributed ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={18}
            color={isFullyDistributed ? '#22c55e' : '#eab308'}
          />
          <Text style={[styles.indicatorText, { color: isFullyDistributed ? '#22c55e' : '#eab308' }]}>
            {distributedWeeks} de {totalWeeksNum || 0} semanas distribuídas
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Fases</Text>
        {phases.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma fase adicionada ainda.</Text>
        ) : (
          phases.map((phase, i) => (
            <View key={phase.tempId} style={styles.phaseCard}>
              <View style={styles.phaseOrderBadge}>
                <Text style={styles.phaseOrderText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseName}>{phase.name}</Text>
                <Text style={styles.phaseWeeks}>{phase.weeks} semana{Number(phase.weeks) !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.phaseActions}>
                <TouchableOpacity onPress={() => handleMovePhase(i, -1)} disabled={i === 0}>
                  <Text style={[styles.moveArrow, i === 0 && styles.moveArrowDisabled]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleMovePhase(i, 1)} disabled={i === phases.length - 1}>
                  <Text style={[styles.moveArrow, i === phases.length - 1 && styles.moveArrowDisabled]}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemovePhase(phase.tempId)}>
                  <Text style={styles.removeX}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.addPhaseCard}>
          <View style={styles.addPhaseRow}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Nome (ex: Hipertrofia)"
              placeholderTextColor="#525252"
              value={newPhaseName}
              onChangeText={setNewPhaseName}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Sem."
              placeholderTextColor="#525252"
              keyboardType="number-pad"
              value={newPhaseWeeks}
              onChangeText={setNewPhaseWeeks}
            />
          </View>
          <TouchableOpacity style={styles.addPhaseButton} onPress={handleAddPhase}>
            <Text style={styles.addPhaseButtonText}>+ Adicionar Fase</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Plano</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  studentLabel: { color: '#737373', fontSize: 12, marginBottom: 14 },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8 },
  totalWeeksInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  indicatorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
  indicatorCardOk: { backgroundColor: 'rgba(34,197,94,0.1)' },
  indicatorCardWarning: { backgroundColor: 'rgba(234,179,8,0.1)' },
  indicatorText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: '#525252', fontSize: 12, marginBottom: 12 },
  phaseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 8 },
  phaseOrderBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  phaseOrderText: { color: '#f97316', fontSize: 12, fontWeight: '800' },
  phaseName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  phaseWeeks: { color: '#737373', fontSize: 11, marginTop: 2 },
  phaseActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moveArrow: { color: '#a3a3a3', fontSize: 12 },
  moveArrowDisabled: { color: '#292524' },
  removeX: { color: '#ef4444', fontSize: 14 },
  addPhaseCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16, marginTop: 8 },
  addPhaseRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  addPhaseButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addPhaseButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
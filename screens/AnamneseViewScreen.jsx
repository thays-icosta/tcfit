import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { PROGRAM_GOALS, TRAINING_LOCATIONS, PAIN_ZONES, SEX_OPTIONS } from './accessLevel';

export default function AnamneseViewScreen({ studentId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [response, setResponse] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [editingGoals, setEditingGoals] = useState(false);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const load = async () => {
    const [{ data: responseRow }, { data: answerRows }] = await Promise.all([
      supabase.from('anamnese_responses').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('anamnese_answers').select('answer_text, anamnese_questions (question_text)').eq('student_id', studentId),
    ]);
    setResponse(responseRow || null);
    setAnswers((answerRows || []).filter((a) => a.answer_text));
    if (responseRow) {
      setKcal(responseRow.calc_goal_kcal != null ? String(responseRow.calc_goal_kcal) : '');
      setProtein(responseRow.calc_goal_protein_g != null ? String(responseRow.calc_goal_protein_g) : '');
      setCarbs(responseRow.calc_goal_carbs_g != null ? String(responseRow.calc_goal_carbs_g) : '');
      setFat(responseRow.calc_goal_fat_g != null ? String(responseRow.calc_goal_fat_g) : '');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [studentId]);

  const handleSaveGoals = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('anamnese_responses')
      .update({
        calc_goal_kcal: kcal ? Number(kcal) : null,
        calc_goal_protein_g: protein ? Number(protein) : null,
        calc_goal_carbs_g: carbs ? Number(carbs) : null,
        calc_goal_fat_g: fat ? Number(fat) : null,
        calc_adjusted_by_personal: true,
      })
      .eq('student_id', studentId);
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setEditingGoals(false);
      load();
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
        <Text style={styles.title}>Anamnese</Text>
      </View>

      {!response || !response.completed_at ? (
        <Text style={styles.emptyText}>O aluno ainda não preencheu a anamnese.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Objetivo Principal</Text>
            <Text style={styles.fieldValue}>{PROGRAM_GOALS.find((g) => g.value === response.main_goal)?.label || '—'}</Text>

            <Text style={styles.fieldLabel}>Local de Treino</Text>
            <Text style={styles.fieldValue}>{TRAINING_LOCATIONS.find((l) => l.value === response.training_location)?.label || '—'}</Text>

            <Text style={styles.fieldLabel}>Lesões / Problemas de Saúde</Text>
            <Text style={styles.fieldValue}>{response.health_issues || 'Nenhuma relatada'}</Text>

            <Text style={styles.fieldLabel}>Zonas de Dor</Text>
            {response.pain_zones && response.pain_zones.length > 0 ? (
              <View style={styles.zoneRow}>
                {response.pain_zones.map((z) => (
                  <View key={z} style={styles.zoneBadge}>
                    <Text style={styles.zoneBadgeText}>{PAIN_ZONES.find((p) => p.value === z)?.label || z}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>Nenhuma</Text>
            )}

            {(response.sex || response.weight_kg || response.height_cm || response.age) && (
              <>
                <Text style={styles.fieldLabel}>Biometria</Text>
                <Text style={styles.fieldValue}>
                  {SEX_OPTIONS.find((s) => s.value === response.sex)?.label || '—'}
                  {response.weight_kg ? ` · ${response.weight_kg}kg` : ''}
                  {response.height_cm ? ` · ${response.height_cm}cm` : ''}
                  {response.age ? ` · ${response.age} anos` : ''}
                </Text>
              </>
            )}
          </View>

          {response.calc_goal_kcal != null && (
            <View style={styles.card}>
              <View style={styles.goalsHeader}>
                <Text style={styles.fieldLabel}>Meta Calórica Estimada {response.calc_adjusted_by_personal && '(ajustada por você)'}</Text>
                {!editingGoals && (
                  <TouchableOpacity onPress={() => setEditingGoals(true)}>
                    <Text style={styles.editLink}>Ajustar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editingGoals ? (
                <>
                  <View style={styles.goalsFieldRow}>
                    <View style={styles.goalsFieldSmall}>
                      <Text style={styles.calcFieldLabel}>Kcal</Text>
                      <TextInput style={styles.input} keyboardType="number-pad" value={kcal} onChangeText={setKcal} />
                    </View>
                    <View style={styles.goalsFieldSmall}>
                      <Text style={styles.calcFieldLabel}>Proteína (g)</Text>
                      <TextInput style={styles.input} keyboardType="number-pad" value={protein} onChangeText={setProtein} />
                    </View>
                  </View>
                  <View style={styles.goalsFieldRow}>
                    <View style={styles.goalsFieldSmall}>
                      <Text style={styles.calcFieldLabel}>Carbo (g)</Text>
                      <TextInput style={styles.input} keyboardType="number-pad" value={carbs} onChangeText={setCarbs} />
                    </View>
                    <View style={styles.goalsFieldSmall}>
                      <Text style={styles.calcFieldLabel}>Gordura (g)</Text>
                      <TextInput style={styles.input} keyboardType="number-pad" value={fat} onChangeText={setFat} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.saveGoalsButton} onPress={handleSaveGoals} disabled={saving}>
                    {saving ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.saveGoalsButtonText}>Salvar Ajuste</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.calcResultKcal}>{response.calc_goal_kcal} kcal/dia</Text>
                  <View style={styles.calcMacroRow}>
                    <View style={styles.calcMacroItem}>
                      <Text style={styles.calcMacroValue}>{response.calc_goal_protein_g}g</Text>
                      <Text style={styles.calcMacroLabel}>Proteína</Text>
                    </View>
                    <View style={styles.calcMacroItem}>
                      <Text style={styles.calcMacroValue}>{response.calc_goal_carbs_g}g</Text>
                      <Text style={styles.calcMacroLabel}>Carbo</Text>
                    </View>
                    <View style={styles.calcMacroItem}>
                      <Text style={styles.calcMacroValue}>{response.calc_goal_fat_g}g</Text>
                      <Text style={styles.calcMacroLabel}>Gordura</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {answers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Perguntas Extras</Text>
              {answers.map((a, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.fieldLabel}>{a.anamnese_questions?.question_text}</Text>
                  <Text style={styles.fieldValue}>{a.answer_text}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30, paddingHorizontal: 16 },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 12 },
  fieldLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  fieldValue: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  zoneBadge: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  zoneBadgeText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  goalsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  calcResultKcal: { color: '#f97316', fontSize: 24, fontWeight: '800', marginTop: 6 },
  calcMacroRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
  calcMacroItem: { alignItems: 'center' },
  calcMacroValue: { color: '#f5f5f5', fontSize: 15, fontWeight: '700' },
  calcMacroLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginTop: 2 },
  goalsFieldRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  goalsFieldSmall: { flex: 1 },
  calcFieldLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  saveGoalsButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  saveGoalsButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});

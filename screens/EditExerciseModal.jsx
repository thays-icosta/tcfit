import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { loadExerciseLoadHistory, suggestNextLoad, estimate1RM } from './progressionUtils';
import { HeaderBack } from './Header';

const METHODS = ['tradicional', 'rest-pause', 'bi-set', 'drop-set', 'piramide'];
const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

export default function EditExerciseModal({ item, onSave, onClose }) {
  const [sets, setSets] = useState(item.sets != null ? String(item.sets) : '3');
  const [reps, setReps] = useState(item.reps || '');
  const [loadKg, setLoadKg] = useState(item.load_kg != null ? String(item.load_kg) : '');
  const [cadence, setCadence] = useState(item.cadence || '');
  const [restSeconds, setRestSeconds] = useState(item.rest_time_seconds != null ? String(item.rest_time_seconds) : '');
  const [method, setMethod] = useState(item.execution_method || 'tradicional');
  const [notes, setNotes] = useState(item.notes || '');
  const [loadHistory, setLoadHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  useEffect(() => {
    if (!item.id) { setLoadingHistory(false); return; }
    let active = true;
    (async () => {
      const history = await loadExerciseLoadHistory(supabase, item.id);
      if (active) {
        setLoadHistory(history);
        setLoadingHistory(false);
      }
    })();
    return () => { active = false; };
  }, [item.id]);

  const suggestion = suggestNextLoad(loadHistory, reps);
  const formatKg = (kg) => (Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','));
  const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const handleApplySuggestion = () => {
    if (!suggestion) return;
    setLoadKg(formatKg(suggestion.suggestedLoad));
    setSuggestionDismissed(true);
  };

  const handleSave = () => {
    onSave({
      sets: sets ? Number(sets) : 3,
      reps: reps || '',
      load_kg: loadKg ? Number(loadKg) : null,
      cadence: cadence || null,
      rest_time_seconds: restSeconds ? Number(restSeconds) : null,
      execution_method: method,
      notes: notes.trim() || null,
    });
  };

  return (
    <View style={styles.container}>
      <HeaderBack backLabel="← Cancelar" title="Editar Exercício" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={styles.selectedHeader}>
          {item.exercises?.thumbnail_url ? (
            <Image source={{ uri: item.exercises.thumbnail_url }} style={styles.selectedThumb} />
          ) : (
            <View style={styles.selectedThumbPlaceholder}>
              <Text style={styles.selectedThumbText}>{item.exercises?.name?.charAt(0) || '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>{item.exercises?.name}</Text>
            <Text style={styles.selectedMeta}>{item.exercises?.muscle_group}</Text>
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldSmall}>
            <Text style={styles.formLabel}>Séries</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={sets} onChangeText={setSets} />
          </View>
          <View style={styles.fieldSmall}>
            <Text style={styles.formLabel}>Reps</Text>
            <TextInput style={styles.input} placeholder="10-12" placeholderTextColor="#525252" value={reps} onChangeText={setReps} />
          </View>
          <View style={styles.fieldSmall}>
            <Text style={styles.formLabel}>Carga (kg)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="opcional" placeholderTextColor="#525252" value={loadKg} onChangeText={setLoadKg} />
          </View>
        </View>

        {loadingHistory && <ActivityIndicator color="#FF6B00" style={{ marginTop: 12 }} />}

        {!loadingHistory && suggestion && !suggestionDismissed && (
          <View style={styles.progressionCard}>
            <View style={styles.progressionHeaderRow}>
              <Ionicons name="trending-up-outline" size={16} color="#FF6B00" />
              <Text style={styles.progressionTitle}>Progressão sugerida</Text>
            </View>
            <Text style={styles.progressionLast}>
              Última sessão: {formatKg(suggestion.lastLoad)}kg{suggestion.lastReps != null ? ` × ${suggestion.lastReps}` : ''}
            </Text>
            <Text style={[styles.progressionStatus, suggestion.hitTarget ? styles.progressionStatusHit : styles.progressionStatusHold]}>
              {suggestion.hitTarget ? 'Meta de reps atingida' : 'Ficou abaixo da meta de reps'}
            </Text>
            <Text style={styles.progressionSuggestedLabel}>
              Sugestão: <Text style={styles.progressionSuggestedValue}>{formatKg(suggestion.suggestedLoad)}kg</Text>
            </Text>
            <View style={styles.progressionButtonRow}>
              <TouchableOpacity style={styles.progressionApplyButton} onPress={handleApplySuggestion}>
                <Text style={styles.progressionApplyButtonText}>Aplicar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.progressionEditButton} onPress={() => setSuggestionDismissed(true)}>
                <Text style={styles.progressionEditButtonText}>Editar manualmente</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!loadingHistory && loadHistory.length > 0 && (
          <View style={styles.historyBlock}>
            <Text style={styles.formLabel}>Histórico de carga</Text>
            {loadHistory.map((h) => {
              const oneRm = estimate1RM(h.load, h.repsNum);
              return (
                <View key={h.sessionId} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{formatDate(h.date)}</Text>
                  <Text style={styles.historyValue}>
                    {formatKg(h.load)}kg{h.reps ? ` × ${h.reps}` : ''}{oneRm != null ? ` · 1RM ~${formatKg(oneRm)}kg` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.fieldRow}>
          <View style={styles.fieldSmall}>
            <Text style={styles.formLabel}>Cadência</Text>
            <TextInput style={styles.input} placeholder="2010" placeholderTextColor="#525252" value={cadence} onChangeText={setCadence} />
          </View>
          <View style={styles.fieldSmall}>
            <Text style={styles.formLabel}>Descanso (seg)</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={restSeconds} onChangeText={setRestSeconds} />
          </View>
        </View>

        <Text style={styles.formLabel}>Observação (opcional)</Text>
        <TextInput style={styles.input} placeholder="ex: Ajustar o banco no número 3" placeholderTextColor="#525252" value={notes} onChangeText={setNotes} />

        <Text style={styles.formLabel}>Método</Text>
        <View style={styles.methodRow}>
          {METHODS.map((m) => (
            <TouchableOpacity key={m} style={[styles.methodChip, method === m && styles.methodChipActive]} onPress={() => setMethod(m)}>
              <Text style={[styles.methodChipText, method === m && styles.methodChipTextActive]}>{METHOD_LABELS[m]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.confirmButton} onPress={handleSave}>
        <Text style={styles.confirmButtonText}>Salvar Alterações</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  selectedThumb: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
  selectedThumbPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#1C1C22', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedThumbText: { color: '#FF6B00', fontSize: 20, fontWeight: '800' },
  selectedName: { color: '#F5F5F7', fontSize: 16, fontWeight: '700' },
  selectedMeta: { color: '#737373', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  fieldRow: { flexDirection: 'row', gap: 8 },
  fieldSmall: { flex: 1 },
  formLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 13 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  methodChip: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  methodChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  methodChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  methodChipTextActive: { color: '#0F0F12' },
  confirmButton: { backgroundColor: '#FF6B00', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '700' },
  progressionCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 12, padding: 14, marginTop: 14 },
  progressionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  progressionTitle: { color: '#FF6B00', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressionLast: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  progressionStatus: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  progressionStatusHit: { color: '#22c55e' },
  progressionStatusHold: { color: '#f59e0b' },
  progressionSuggestedLabel: { color: '#a3a3a3', fontSize: 13, marginTop: 10 },
  progressionSuggestedValue: { color: '#F5F5F7', fontSize: 16, fontWeight: '800' },
  progressionButtonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  progressionApplyButton: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  progressionApplyButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '800' },
  progressionEditButton: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  progressionEditButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700' },
  historyBlock: { marginTop: 14 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1C1C22' },
  historyDate: { color: '#737373', fontSize: 12 },
  historyValue: { color: '#F5F5F7', fontSize: 12, fontWeight: '600' },
});

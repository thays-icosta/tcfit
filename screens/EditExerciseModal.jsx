import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Image } from 'react-native';
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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  selectedThumb: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
  selectedThumbPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedThumbText: { color: '#f97316', fontSize: 20, fontWeight: '800' },
  selectedName: { color: '#f5f5f5', fontSize: 16, fontWeight: '700' },
  selectedMeta: { color: '#737373', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  fieldRow: { flexDirection: 'row', gap: 8 },
  fieldSmall: { flex: 1 },
  formLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  methodChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  methodChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  methodChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  methodChipTextActive: { color: '#0a0a0a' },
  confirmButton: { backgroundColor: '#f97316', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});

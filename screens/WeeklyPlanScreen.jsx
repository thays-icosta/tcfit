import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import WorkoutBuilderScreen from './WorkoutBuilderScreen';
import { HeaderBack } from './Header';

// Same convention as WorkoutBuilderScreen's picker: value matches JS
// Date.getDay() (0 = Sunday), ordered Mon→Sun here only for display.
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

// Reads/writes workouts.weekday directly — the same column the ficha
// builder's own "Dia da Semana" picker writes to, so assigning a day here
// or there always shows up in both places. No new table.
export default function WeeklyPlanScreen({ studentId, studentName, personalId, onClose }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [assigningDay, setAssigningDay] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const loadWorkouts = async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, weekday')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at', { ascending: true });
    setWorkouts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadWorkouts(); }, [studentId]);

  const handleAssign = async (workoutId, weekday) => {
    setSavingId(workoutId);
    await supabase.from('workouts').update({ weekday }).eq('id', workoutId);
    setSavingId(null);
    setAssigningDay(null);
    loadWorkouts();
  };

  const handleUnassign = async (workoutId) => {
    setSavingId(workoutId);
    await supabase.from('workouts').update({ weekday: null }).eq('id', workoutId);
    setSavingId(null);
    loadWorkouts();
  };

  if (showBuilder) {
    return (
      <WorkoutBuilderScreen
        studentId={studentId}
        studentName={studentName}
        personalId={personalId}
        onClose={() => { setShowBuilder(false); loadWorkouts(); }}
      />
    );
  }

  const unassigned = workouts.filter((w) => w.weekday == null);

  return (
    <View style={styles.container}>
      <HeaderBack title="Planejamento Semanal" onBack={onClose} style={{ paddingHorizontal: 16 }} />
      <Text style={styles.subtitle}>{studentName}</Text>

      {loading ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {WEEKDAY_OPTIONS.map((day) => {
            const workout = workouts.find((w) => w.weekday === day.value);
            return (
              <View key={day.value} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {workout ? (
                  <View style={styles.dayFichaCard}>
                    <Ionicons name="barbell-outline" size={16} color="#FF6B00" />
                    <Text style={styles.dayFichaName} numberOfLines={1}>{workout.name}</Text>
                    <TouchableOpacity onPress={() => handleUnassign(workout.id)} hitSlop={10} disabled={savingId === workout.id}>
                      {savingId === workout.id ? (
                        <ActivityIndicator color="#525252" size="small" />
                      ) : (
                        <Ionicons name="close-circle-outline" size={18} color="#525252" />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.dayEmptyCard} onPress={() => setAssigningDay(day.value)}>
                    <Text style={styles.dayEmptyText}>+ Atribuir ficha</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={styles.editFichasButton} onPress={() => setShowBuilder(true)}>
            <Ionicons name="create-outline" size={16} color="#0F0F12" />
            <Text style={styles.editFichasButtonText}>Editar / Criar Fichas</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={assigningDay != null} transparent animationType="fade" onRequestClose={() => setAssigningDay(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Atribuir ficha · {WEEKDAY_OPTIONS.find((d) => d.value === assigningDay)?.label}
            </Text>
            {unassigned.length === 0 ? (
              <Text style={styles.emptyText}>
                Todas as fichas já têm um dia, ou ainda não existe nenhuma. Toque em &quot;Editar / Criar Fichas&quot; pra criar uma nova.
              </Text>
            ) : (
              unassigned.map((w) => (
                <TouchableOpacity key={w.id} style={styles.fichaOption} onPress={() => handleAssign(w.id, assigningDay)}>
                  <Text style={styles.fichaOptionText}>{w.name}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setAssigningDay(null)}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  subtitle: { color: '#a3a3a3', fontSize: 12, paddingHorizontal: 16, marginBottom: 14 },
  dayRow: { marginBottom: 10 },
  dayLabel: { color: '#525252', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  dayFichaCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  dayFichaName: { flex: 1, color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  dayEmptyCard: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dayEmptyText: { color: '#525252', fontSize: 12, fontWeight: '600' },
  editFichasButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  editFichasButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  emptyText: { color: '#737373', fontSize: 12, textAlign: 'center', marginVertical: 10, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#1C1C22', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '800', marginBottom: 14 },
  fichaOption: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  fichaOptionText: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  modalCancelButton: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
});

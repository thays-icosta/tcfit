import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';

function getRpeTag(pse) {
  if (!pse) return null;
  if (pse <= 2) return { label: 'Leve', color: '#22c55e' };
  if (pse === 3) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Intenso', color: '#ef4444' };
}

export default function StudentWorkoutHistoryScreen({ studentId, studentName, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('id, started_at, finished_at, pse, total_tonnage_kg, student_notes, workouts (name)')
        .eq('student_id', studentId)
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false });
      setSessions(data || []);
      setLoading(false);
    })();
  }, [studentId]);

  return (
    <View style={styles.container}>
      <HeaderBack title={studentName} onBack={onClose} />

      <Text style={styles.title}>Histórico de Treinos</Text>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
      ) : sessions.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum treino finalizado ainda.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {sessions.map((s) => {
            const durationMin = s.finished_at
              ? Math.round((new Date(s.finished_at) - new Date(s.started_at)) / 60000)
              : null;
            const rpeTag = getRpeTag(s.pse);
            return (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.workoutName}>{s.workouts?.name}</Text>
                  {rpeTag && (
                    <View style={[styles.rpeTag, { borderColor: rpeTag.color }]}>
                      <Text style={[styles.rpeTagText, { color: rpeTag.color }]}>{rpeTag.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.date}>{formatDate(s.finished_at)}</Text>
                <View style={styles.statsRow}>
                  {durationMin != null && (
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{durationMin}</Text>
                      <Text style={styles.statLabel}>minutos</Text>
                    </View>
                  )}
                  {s.total_tonnage_kg != null && (
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{Math.round(s.total_tonnage_kg)}</Text>
                      <Text style={styles.statLabel}>kg levantados</Text>
                    </View>
                  )}
                </View>
                {s.student_notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Observação do aluno</Text>
                    <Text style={styles.notesText}>{s.student_notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  title: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  rpeTag: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  rpeTagText: { fontSize: 10, fontWeight: '700' },
  date: { color: '#525252', fontSize: 10, marginTop: 2, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: '#f97316', fontSize: 15, fontWeight: '800' },
  statLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 2 },
  notesBox: { backgroundColor: '#0a0a0a', borderRadius: 8, padding: 10, marginTop: 10 },
  notesLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 },
  notesText: { color: '#a3a3a3', fontSize: 12, lineHeight: 17 },
});
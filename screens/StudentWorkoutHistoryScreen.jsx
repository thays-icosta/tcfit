import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';
import { showAlert, describeFunctionError } from './alertUtils';

function getRpeTag(pse) {
  if (!pse) return null;
  if (pse <= 2) return { label: 'Leve', color: '#22c55e' };
  if (pse === 3) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Intenso', color: '#ef4444' };
}

export default function StudentWorkoutHistoryScreen({ studentId, studentName, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // a session id, or 'all'

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const loadSessions = async () => {
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, started_at, finished_at, pse, total_tonnage_kg, student_notes, workouts (name)')
      .eq('student_id', studentId)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false });
    setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, [studentId]);

  // Deleting runs in the manage-student-history Edge Function (no table in the
  // history chain has a client DELETE policy); it checks the student is yours.
  const runDelete = async (body, busyKey) => {
    setBusy(busyKey);
    const { data, error } = await supabase.functions.invoke('manage-student-history', { body });
    if (error || data?.error) {
      showAlert('Não deu pra apagar', await describeFunctionError(error, data, 'Tenta de novo em instantes.'));
    } else {
      await loadSessions();
    }
    setBusy(null);
  };

  const confirmDeleteSession = (session) => {
    showAlert(
      'Apagar este treino?',
      `${session.workouts?.name || 'Treino'} de ${formatDate(session.finished_at)}. As cargas e repetições registradas nele são removidas e a progressão do aluno deixa de contar com ele. Não dá pra desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar treino', style: 'destructive', onPress: () => runDelete({ action: 'delete_session', session_id: session.id }, session.id) },
      ]
    );
  };

  const confirmClearAll = () => {
    showAlert(
      'Limpar todo o histórico?',
      `Isso apaga os ${sessions.length} treino${sessions.length !== 1 ? 's' : ''} já feitos por ${studentName} (e qualquer treino em andamento), com todas as cargas e repetições registradas. A progressão e o volume realizado voltam do zero. Não dá pra desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar tudo', style: 'destructive', onPress: () => runDelete({ action: 'clear_all', student_id: studentId }, 'all') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <HeaderBack title={studentName} onBack={onClose} />

      <View style={styles.titleRow}>
        <Text style={styles.title}>Histórico de Treinos</Text>
        {sessions.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={confirmClearAll} disabled={busy != null}>
            {busy === 'all' ? <ActivityIndicator color="#ef4444" size="small" /> : (
              <>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={styles.clearButtonText}>Limpar histórico</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 30 }} />
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
                  <TouchableOpacity onPress={() => confirmDeleteSession(s)} disabled={busy != null} hitSlop={10} style={styles.deleteButton} accessibilityLabel="Apagar este treino">
                    {busy === s.id ? <ActivityIndicator color="#ef4444" size="small" /> : <Ionicons name="trash-outline" size={17} color="#ef4444" />}
                  </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 50, paddingHorizontal: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  clearButtonText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  deleteButton: { marginLeft: 10, padding: 2 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  card: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 },
  rpeTag: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  rpeTagText: { fontSize: 10, fontWeight: '700' },
  date: { color: '#525252', fontSize: 10, marginTop: 2, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#08090B' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  statLabel: { color: '#A7AAB0', fontSize: 9, marginTop: 2 },
  notesBox: { backgroundColor: '#08090B', borderRadius: 8, padding: 10, marginTop: 10 },
  notesLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 },
  notesText: { color: '#A7AAB0', fontSize: 12, lineHeight: 17 },
});
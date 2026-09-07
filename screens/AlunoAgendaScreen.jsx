import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STATUS_LABELS = { agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado' };
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildUpcomingDays(count = 14) {
  const days = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function AlunoAgendaScreen({ studentId, onClose }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState(null);
  const [remindersReady, setRemindersReady] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);

  const days = buildUpcomingDays();

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const scheduleReminders = async (upcomingOnly) => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const apptNotifications = scheduled.filter((n) => n.identifier.startsWith('appt-'));
      for (const n of apptNotifications) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }

      for (const a of upcomingOnly) {
        const scheduledDate = new Date(a.scheduled_at);
        const reminderTime = new Date(scheduledDate.getTime() - 60 * 60 * 1000);
        if (reminderTime > new Date()) {
          await Notifications.scheduleNotificationAsync({
            identifier: `appt-${a.id}`,
            content: {
              title: 'Sessão em 1 hora! 🏋️',
              body: `Sua sessão está marcada para ${scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminderTime,
            },
          });
        }
      }
      setRemindersReady(true);
    } catch (e) {
      // Se falhar, a tela continua funcionando normalmente
    }
  };

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status, notes, student_confirmed_at')
      .eq('student_id', studentId)
      .order('scheduled_at', { ascending: true });
    setAppointments(data || []);
    setLoading(false);
    return data || [];
  };

  useEffect(() => {
    (async () => {
      const data = await loadAppointments();
      const upcomingOnly = data.filter((a) => a.status === 'agendado' && new Date(a.scheduled_at) >= new Date());
      if (upcomingOnly.length > 0) {
        scheduleReminders(upcomingOnly);
      }
    })();
  }, [studentId]);

  const handleConfirmAttendance = async (appointmentId) => {
    setConfirmingId(appointmentId);
    const { error } = await supabase.rpc('confirm_appointment_attendance', { appointment_id: appointmentId });
    setConfirmingId(null);
    if (error) {
      showAlert('Erro', 'Não foi possível confirmar sua presença agora. Tenta de novo em instantes.');
      return;
    }
    loadAppointments();
  };

  const now = new Date();
  const daysWithAppointments = new Set(appointments.map((a) => new Date(a.scheduled_at).toDateString()));

  const isAttended = (a) => a.status === 'concluido' || !!a.student_confirmed_at;
  const pastAppointments = appointments.filter((a) => new Date(a.scheduled_at) <= now && a.status !== 'cancelado');
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAppointments = pastAppointments.filter((a) => new Date(a.scheduled_at) >= startOfWeek);
  const monthAppointments = pastAppointments.filter((a) => new Date(a.scheduled_at) >= startOfMonth);

  let displayList;
  let listTitle;
  if (dayFilter) {
    displayList = appointments
      .filter((a) => new Date(a.scheduled_at).toDateString() === dayFilter.toDateString())
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    listTitle = `${DAY_LABELS[dayFilter.getDay()]} ${dayFilter.getDate()}`;
  } else {
    displayList = appointments
      .filter((a) => a.status === 'agendado' && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    listTitle = 'Próximas sessões';
  }

  return (
    <View style={styles.container}>
      <HeaderBack title="Minha Agenda" onBack={onClose} />

      {pastAppointments.length > 0 && (
        <View style={styles.frequencyRow}>
          <View style={styles.frequencyCard}>
            <Text style={styles.frequencyValue}>{weekAppointments.filter(isAttended).length}/{weekAppointments.length}</Text>
            <Text style={styles.frequencyLabel}>Essa semana</Text>
          </View>
          <View style={styles.frequencyCard}>
            <Text style={styles.frequencyValue}>{monthAppointments.filter(isAttended).length}/{monthAppointments.length}</Text>
            <Text style={styles.frequencyLabel}>Esse mês</Text>
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
        <TouchableOpacity
          style={[styles.dayChip, dayFilter === null && styles.dayChipActive]}
          onPress={() => setDayFilter(null)}
        >
          <Text style={[styles.dayChipText, dayFilter === null && styles.dayChipTextActive]}>Todos</Text>
        </TouchableOpacity>
        {days.map((d, i) => {
          const isActive = dayFilter && d.toDateString() === dayFilter.toDateString();
          const hasAppointments = daysWithAppointments.has(d.toDateString());
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, isActive && styles.dayChipActive]}
              onPress={() => setDayFilter(d)}
            >
              <Text style={[styles.dayChipWeekday, isActive && styles.dayChipTextActive]}>{DAY_LABELS[d.getDay()]}</Text>
              <Text style={[styles.dayChipNumber, isActive && styles.dayChipTextActive]}>{d.getDate()}</Text>
              <View style={[styles.dayChipDot, !hasAppointments && styles.dayChipDotHidden, isActive && styles.dayChipDotActive]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {remindersReady && !dayFilter && (
            <Text style={styles.reminderHint}>🔔 Você vai receber um lembrete 1 hora antes de cada sessão.</Text>
          )}

          <Text style={styles.sectionTitle}>{listTitle}</Text>

          {displayList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {dayFilter ? 'Nenhuma sessão agendada para este dia.' : 'Nenhuma sessão agendada ainda.'}
              </Text>
            </View>
          ) : (
            displayList.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.dateTimeText}>{formatDateTime(a.scheduled_at)}</Text>
                  <View style={[styles.statusPill, a.status === 'concluido' && styles.statusPillDone, a.status === 'cancelado' && styles.statusPillCancel]}>
                    <Text style={[styles.statusPillText, a.status === 'concluido' && styles.statusPillTextDone, a.status === 'cancelado' && styles.statusPillTextCancel]}>
                      {STATUS_LABELS[a.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.durationText}>{a.duration_minutes} minutos</Text>
                {a.notes ? <Text style={styles.notesText}>📝 {a.notes}</Text> : null}
                {a.student_confirmed_at ? (
                  <Text style={styles.confirmedText}>✓ Presença confirmada</Text>
                ) : a.status === 'agendado' && new Date(a.scheduled_at) <= now ? (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => handleConfirmAttendance(a.id)}
                    disabled={confirmingId === a.id}
                  >
                    {confirmingId === a.id ? (
                      <ActivityIndicator color="#0a0a0a" size="small" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirmar Presença</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  frequencyRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  frequencyCard: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  frequencyValue: { color: '#f97316', fontSize: 18, fontWeight: '800' },
  frequencyLabel: { color: '#737373', fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  confirmedText: { color: '#22c55e', fontSize: 11, fontWeight: '700', marginTop: 8 },
  confirmButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  confirmButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  dayScroll: { maxHeight: 62, marginBottom: 14 },
  dayChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, alignItems: 'center', minWidth: 48, justifyContent: 'center' },
  dayChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  dayChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  dayChipWeekday: { color: '#737373', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  dayChipNumber: { color: '#f5f5f5', fontSize: 15, fontWeight: '800', marginTop: 2 },
  dayChipTextActive: { color: '#0a0a0a' },
  dayChipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#f97316', marginTop: 4 },
  dayChipDotHidden: { opacity: 0 },
  dayChipDotActive: { backgroundColor: '#0a0a0a' },
  reminderHint: { color: '#525252', fontSize: 10, textAlign: 'center', marginBottom: 14 },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  emptyBox: { alignItems: 'center', marginTop: 20, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 24 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateTimeText: { color: '#f97316', fontSize: 15, fontWeight: '700' },
  durationText: { color: '#737373', fontSize: 11, marginTop: 4 },
  notesText: { color: '#a3a3a3', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  statusPill: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
  statusPillCancel: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#ef4444' },
  statusPillText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  statusPillTextDone: { color: '#22c55e' },
  statusPillTextCancel: { color: '#ef4444' },
});
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Modal, Platform, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from './supabaseClient';

const STATUS_LABELS = { agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado' };
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const QUICK_FOCUS_OPTIONS = ['Superiores', 'Inferiores', 'Perna Completa', 'Peito e Tríceps', 'Costas e Bíceps', 'Ombro', 'Full Body', 'Avaliação Física'];

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

export default function PersonalAgendaScreen({ personalId, onClose }) {
  const [appointments, setAppointments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [sessionFocus, setSessionFocus] = useState('');
  const [studentFichas, setStudentFichas] = useState([]);
  const [loadingFichas, setLoadingFichas] = useState(false);
  const [saving, setSaving] = useState(false);

  const days = buildUpcomingDays();

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status, notes, session_focus, student_id, users!appointments_student_id_fkey (name, avatar_url)')
      .eq('personal_id', personalId)
      .order('scheduled_at', { ascending: true });
    setAppointments(data || []);
  };

  const loadStudents = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('personal_id', personalId)
      .eq('role', 'aluno');
    setStudents(data || []);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadAppointments(), loadStudents()]);
      setLoading(false);
    })();
  }, [personalId]);

  const loadStudentFichas = async (studentIdToLoad) => {
    setLoadingFichas(true);
    const { data } = await supabase
      .from('workouts')
      .select('id, name')
      .eq('student_id', studentIdToLoad)
      .eq('active', true);
    setStudentFichas(data || []);
    setLoadingFichas(false);
  };

  const handleSelectStudentInModal = (student) => {
    setSelectedStudent(student);
    loadStudentFichas(student.id);
  };

  const handleOpenAddModal = (presetDate) => {
    setEditingAppointmentId(null);
    setSelectedStudent(null);
    setSelectedDate(presetDate || new Date());
    setDuration('60');
    setNotes('');
    setSessionFocus('');
    setStudentFichas([]);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (appointment) => {
    setEditingAppointmentId(appointment.id);
    const student = students.find((s) => s.id === appointment.student_id);
    const found = student || { id: appointment.student_id, name: appointment.users?.name };
    setSelectedStudent(found);
    loadStudentFichas(found.id);
    setSelectedDate(new Date(appointment.scheduled_at));
    setDuration(String(appointment.duration_minutes || 60));
    setNotes(appointment.notes || '');
    setSessionFocus(appointment.session_focus || '');
    setShowAddModal(true);
  };

  const handleConfirmAppointment = async () => {
    if (!selectedStudent) {
      Alert.alert('Ops', 'Escolhe o aluno primeiro.');
      return;
    }
    setSaving(true);

    const payload = {
      student_id: selectedStudent.id,
      scheduled_at: selectedDate.toISOString(),
      duration_minutes: duration ? Number(duration) : 60,
      notes: notes.trim() || null,
      session_focus: sessionFocus.trim() || null,
    };

    if (editingAppointmentId) {
      const { error } = await supabase.from('appointments').update(payload).eq('id', editingAppointmentId);
      setSaving(false);
      if (error) {
        Alert.alert('Erro', error.message);
      } else {
        setShowAddModal(false);
        loadAppointments();
      }
    } else {
      const { error } = await supabase.from('appointments').insert({
        personal_id: personalId,
        ...payload,
      });
      setSaving(false);
      if (error) {
        Alert.alert('Erro', error.message);
      } else {
        setShowAddModal(false);
        loadAppointments();
      }
    }
  };

  const handleUpdateStatus = async (appointmentId, status) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', appointmentId);
    if (error) Alert.alert('Erro', error.message);
    else loadAppointments();
  };

  const handleDelete = (appointmentId) => {
    Alert.alert('Excluir agendamento', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('appointments').delete().eq('id', appointmentId);
          loadAppointments();
        },
      },
    ]);
  };

  const now = new Date();
  const daysWithAppointments = new Set(appointments.map((a) => new Date(a.scheduled_at).toDateString()));

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
    listTitle = 'Próximos agendamentos';
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Agenda</Text>
      </View>

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

      <TouchableOpacity style={styles.addButton} onPress={() => handleOpenAddModal()}>
        <Text style={styles.addButtonText}>+ Agendar Sessão</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView>
          <Text style={styles.sectionTitle}>{listTitle}</Text>

          {displayList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {dayFilter ? 'Nenhuma sessão agendada para este dia.' : 'Nenhum agendamento futuro.'}
              </Text>
              <TouchableOpacity style={styles.emptyAddButton} onPress={() => handleOpenAddModal(dayFilter || new Date())}>
                <Text style={styles.emptyAddButtonText}>+ Agendar Sessão</Text>
              </TouchableOpacity>
            </View>
          ) : (
            displayList.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.avatarCircle}>
                      {a.users?.avatar_url ? (
                        <Image source={{ uri: a.users.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarLetter}>{a.users?.name?.charAt(0).toUpperCase() || '?'}</Text>
                      )}
                    </View>
                    <Text style={styles.studentName}>{a.users?.name}</Text>
                  </View>
                  <View style={[styles.statusPill, a.status === 'concluido' && styles.statusPillDone, a.status === 'cancelado' && styles.statusPillCancel]}>
                    <Text style={[styles.statusPillText, a.status === 'concluido' && styles.statusPillTextDone, a.status === 'cancelado' && styles.statusPillTextCancel]}>
                      {STATUS_LABELS[a.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dateTimeText}>{formatDateTime(a.scheduled_at)} · {a.duration_minutes}min</Text>
                {a.session_focus ? <Text style={styles.focusText}>🏋️ {a.session_focus}</Text> : null}
                {a.notes ? <Text style={styles.notesText}>📝 {a.notes}</Text> : null}
                {a.status === 'agendado' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.doneButton} onPress={() => handleUpdateStatus(a.id, 'concluido')}>
                      <Text style={styles.doneButtonText}>✓ Concluído</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editButton} onPress={() => handleOpenEditModal(a)}>
                      <Text style={styles.editButtonText}>✏️ Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => handleUpdateStatus(a.id, 'cancelado')}>
                      <Text style={styles.cancelButtonText}>✕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(a.id)}>
                      <Text style={styles.deleteText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Text style={styles.modalTitle}>{editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}</Text>

              <Text style={styles.modalLabel}>Aluno</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {students.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.studentChip, selectedStudent?.id === s.id && styles.studentChipActive]}
                    onPress={() => handleSelectStudentInModal(s)}
                  >
                    <Text style={[styles.studentChipText, selectedStudent?.id === s.id && styles.studentChipTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Data e horário</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateTimeButtonText}>{selectedDate.toLocaleDateString('pt-BR')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.dateTimeButtonText}>{selectedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      const newDate = new Date(selectedDate);
                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setSelectedDate(newDate);
                    }
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (date) {
                      const newDate = new Date(selectedDate);
                      newDate.setHours(date.getHours(), date.getMinutes());
                      setSelectedDate(newDate);
                    }
                  }}
                />
              )}

              <Text style={styles.modalLabel}>Duração (minutos)</Text>
              <TextInput style={styles.modalInput} keyboardType="number-pad" value={duration} onChangeText={setDuration} />

              <Text style={styles.modalLabel}>Foco da sessão (opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ex: Perna Completa, Superiores..."
                placeholderTextColor="#525252"
                value={sessionFocus}
                onChangeText={setSessionFocus}
              />

              {selectedStudent && (
                <View style={styles.focusChipsWrap}>
                  {loadingFichas ? (
                    <ActivityIndicator color="#f97316" size="small" style={{ marginTop: 8 }} />
                  ) : (
                    <>
                      {studentFichas.length > 0 && (
                        <>
                          <Text style={styles.focusChipsLabel}>Fichas do aluno:</Text>
                          <View style={styles.focusChipsRow}>
                            {studentFichas.map((f) => (
                              <TouchableOpacity key={f.id} style={styles.focusChip} onPress={() => setSessionFocus(f.name)}>
                                <Text style={styles.focusChipText}>{f.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                      <Text style={styles.focusChipsLabel}>Sugestões rápidas:</Text>
                      <View style={styles.focusChipsRow}>
                        {QUICK_FOCUS_OPTIONS.map((opt) => (
                          <TouchableOpacity key={opt} style={styles.focusChip} onPress={() => setSessionFocus(opt)}>
                            <Text style={styles.focusChipText}>{opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}

              <Text style={styles.modalLabel}>Observação (opcional)</Text>
              <TextInput style={styles.modalInput} placeholder="ex: Trazer avaliação" placeholderTextColor="#525252" value={notes} onChangeText={setNotes} />

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmAppointment} disabled={saving}>
                  {saving ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.modalConfirmButtonText}>{editingAppointmentId ? 'Salvar' : 'Agendar'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
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
  addButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  addButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  emptyBox: { alignItems: 'center', marginTop: 20, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 24 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  emptyAddButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  emptyAddButtonText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center', marginRight: 8, overflow: 'hidden' },
  avatarImage: { width: 32, height: 32 },
  avatarLetter: { color: '#f97316', fontSize: 13, fontWeight: '800' },
  studentName: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  statusPill: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillDone: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: '#22c55e' },
  statusPillCancel: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#ef4444' },
  statusPillText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  statusPillTextDone: { color: '#22c55e' },
  statusPillTextCancel: { color: '#ef4444' },
  dateTimeText: { color: '#a3a3a3', fontSize: 12, marginTop: 6 },
  focusText: { color: '#f97316', fontSize: 12, fontWeight: '700', marginTop: 6 },
  notesText: { color: '#a3a3a3', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  doneButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  doneButtonText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  editButton: { backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  editButtonText: { color: '#3b82f6', fontSize: 10, fontWeight: '700' },
  cancelButton: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  deleteButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '88%' },
  modalTitle: { color: '#f5f5f5', fontSize: 17, fontWeight: '800', marginBottom: 16 },
  modalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
  studentChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  studentChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  studentChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  studentChipTextActive: { color: '#0a0a0a' },
  dateTimeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateTimeButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dateTimeButtonText: { color: '#f5f5f5', fontSize: 14, fontWeight: '600' },
  modalInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  focusChipsWrap: { marginTop: 4 },
  focusChipsLabel: { color: '#525252', fontSize: 9, textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  focusChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  focusChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  focusChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});
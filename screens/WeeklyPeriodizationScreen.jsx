import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { supabase } from './supabaseClient';
import CreatePeriodizationScreen from './CreatePeriodizationScreen';
import { getPhaseForWeekIndex, loadPeriodizationPlan } from './periodizationUtils';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';

const PHASE_COLORS = ['#f97316', '#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#ec4899', '#14b8a6'];
const PX_PER_WEEK = 40;
const DEFAULT_WEEK_COUNT = 8;

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getRpeLabel(avg) {
  if (avg == null) return null;
  if (avg <= 2) return { label: 'Leve', color: '#22c55e' };
  if (avg <= 3) return { label: 'Moderado', color: '#eab308' };
  return { label: 'Intenso', color: '#ef4444' };
}

export default function WeeklyPeriodizationScreen({ studentId, studentName, personalId, isPersonal, onClose }) {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(studentId);
  const [selectedStudentName, setSelectedStudentName] = useState(studentName);
  const [plan, setPlan] = useState(null);
  const [phases, setPhases] = useState([]);
  const [weekData, setWeekData] = useState([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const formatDateShort = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const loadStudentList = async () => {
    if (!isPersonal || !personalId) return;
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('personal_id', personalId)
      .eq('role', 'aluno');
    setStudents(data || []);
  };

  const loadData = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    setSelectedWeekIndex(null);

    const { plan: planData, phases: phasesData } = await loadPeriodizationPlan(supabase, selectedStudentId);
    setPlan(planData);
    setPhases(phasesData);

    let weeksList;
    let planStartMonday = null;
    if (planData) {
      planStartMonday = getMonday(planData.start_date);
      weeksList = [];
      for (let i = 0; i < planData.total_weeks; i++) {
        const d = new Date(planStartMonday);
        d.setDate(planStartMonday.getDate() + i * 7);
        weeksList.push(d);
      }
    } else {
      const thisMonday = getMonday(new Date());
      weeksList = [];
      for (let i = DEFAULT_WEEK_COUNT - 1; i >= 0; i--) {
        const d = new Date(thisMonday);
        d.setDate(thisMonday.getDate() - i * 7);
        weeksList.push(d);
      }
    }

    const earliestStart = weeksList[0].toISOString();
    const latestEnd = new Date(weeksList[weeksList.length - 1].getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, finished_at, total_tonnage_kg, pse')
      .eq('student_id', selectedStudentId)
      .not('finished_at', 'is', null)
      .gte('finished_at', earliestStart)
      .lt('finished_at', latestEnd)
      .order('finished_at', { ascending: true });

    const sessionList = sessions || [];
    const sessionIds = sessionList.map((s) => s.id);

    let sets = [];
    if (sessionIds.length > 0) {
      const { data: setRows } = await supabase
        .from('workout_session_sets')
        .select('session_id, load_used_kg, workout_exercises (load_kg)')
        .in('session_id', sessionIds);
      sets = setRows || [];
    }

    const { data: notesRows } = await supabase
      .from('training_weeks')
      .select('week_start_date, notes')
      .eq('student_id', selectedStudentId)
      .gte('week_start_date', weeksList[0].toISOString().slice(0, 10));

    const notesMap = {};
    (notesRows || []).forEach((n) => { if (n.notes) notesMap[n.week_start_date] = n.notes; });

    const sessionWeekIndex = {};
    sessionList.forEach((s) => {
      const finishedDate = new Date(s.finished_at);
      for (let i = weeksList.length - 1; i >= 0; i--) {
        if (finishedDate >= weeksList[i]) {
          sessionWeekIndex[s.id] = i;
          break;
        }
      }
    });

    const result = weeksList.map((weekStart, i) => {
      const weekSessions = sessionList.filter((s) => sessionWeekIndex[s.id] === i);
      const volume = weekSessions.reduce((sum, s) => sum + (s.total_tonnage_kg || 0), 0);

      const weekSets = sets.filter((st) => sessionWeekIndex[st.session_id] === i);
      const validRatios = weekSets
        .filter((st) => st.load_used_kg != null && st.workout_exercises?.load_kg > 0)
        .map((st) => (st.load_used_kg / st.workout_exercises.load_kg) * 100);
      const avgIntensity = validRatios.length > 0
        ? Math.round(validRatios.reduce((a, b) => a + b, 0) / validRatios.length)
        : null;

      const pseValues = weekSessions.filter((s) => s.pse != null).map((s) => s.pse);
      const avgPse = pseValues.length > 0 ? pseValues.reduce((a, b) => a + b, 0) / pseValues.length : null;

      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const phaseResult = getPhaseForWeekIndex(phasesData, i + 1);

      return {
        weekStart,
        weekStartStr,
        weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        sessionsCount: weekSessions.length,
        daysTrained: new Set(weekSessions.map((s) => s.finished_at.slice(0, 10))).size,
        volume: Math.round(volume),
        intensity: avgIntensity,
        avgPse,
        phaseResult,
        note: notesMap[weekStartStr] || null,
      };
    });

    setWeekData(result);
    setLoading(false);
  };

  useEffect(() => {
    loadStudentList();
  }, [personalId]);

  useEffect(() => {
    loadData();
  }, [selectedStudentId]);

  const handleSelectStudent = (s) => {
    setSelectedStudentId(s.id);
    setSelectedStudentName(s.name);
  };

  const handleSelectWeek = (index) => {
    setSelectedWeekIndex(selectedWeekIndex === index ? null : index);
    setEditingNote(false);
  };

  const handleOpenNoteEditor = () => {
    const w = weekData[selectedWeekIndex];
    setNoteInput(w?.note || '');
    setEditingNote(true);
  };

  const handleSaveNote = async () => {
    const w = weekData[selectedWeekIndex];
    setSavingNote(true);
    const { error } = await supabase
      .from('training_weeks')
      .upsert(
        { student_id: selectedStudentId, personal_id: personalId, week_start_date: w.weekStartStr, notes: noteInput.trim() || null },
        { onConflict: 'student_id,week_start_date' }
      );
    setSavingNote(false);
    setEditingNote(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      loadData();
    }
  };

  const maxVolume = Math.max(...weekData.map((w) => w.volume), 1);

  if (showCreatePlan) {
    return (
      <CreatePeriodizationScreen
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        personalId={personalId}
        onClose={() => {
          setShowCreatePlan(false);
          loadData();
        }}
      />
    );
  }

  const selectedWeek = selectedWeekIndex != null ? weekData[selectedWeekIndex] : null;
  const selectedRpe = selectedWeek ? getRpeLabel(selectedWeek.avgPse) : null;

  return (
    <View style={styles.container}>
      <HeaderBack title="Periodização de Treino" onBack={onClose} />

      {isPersonal && students.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.studentSelectorScroll}>
          {students.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.studentChip, selectedStudentId === s.id && styles.studentChipActive]}
              onPress={() => handleSelectStudent(s)}
            >
              <Text style={[styles.studentChipText, selectedStudentId === s.id && styles.studentChipTextActive]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!isPersonal && selectedStudentName && <Text style={styles.studentLabel}>{selectedStudentName}</Text>}

      {isPersonal && (
        <TouchableOpacity style={styles.configureButton} onPress={() => setShowCreatePlan(true)}>
          <Text style={styles.configureButtonText}>{plan ? 'Editar Plano de Fases' : 'Configurar Fases do Plano'}</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Ciclo de treino {plan ? `(${plan.total_weeks} semanas)` : '(últimas 8 semanas)'}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {phases.length > 0 && (
                  <View style={styles.phaseRow}>
                    {phases.map((phase, i) => {
                      const color = PHASE_COLORS[i % PHASE_COLORS.length];
                      return (
                        <View key={phase.id} style={[styles.phaseBlock, { width: phase.duration_weeks * PX_PER_WEEK, backgroundColor: color }]}>
                          <Text style={styles.phaseBlockText} numberOfLines={1}>{phase.name}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.barsRow}>
                  {weekData.map((w, i) => {
                    const color = w.phaseResult ? PHASE_COLORS[phases.findIndex((p) => p.id === w.phaseResult.phase.id) % PHASE_COLORS.length] : '#525252';
                    const heightPct = w.volume > 0 ? 15 + (w.volume / maxVolume) * 75 : 4;
                    const isSelected = selectedWeekIndex === i;
                    return (
                      <TouchableOpacity key={i} style={[styles.barColumn, { width: PX_PER_WEEK }]} onPress={() => handleSelectWeek(i)}>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: color }, isSelected && styles.barFillSelected]} />
                        </View>
                        <Text style={[styles.barLabel, isSelected && styles.barLabelSelected]}>S{i + 1}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>

          {selectedWeek && (
            <View style={styles.weekDetailCard}>
              <View style={styles.weekDetailHeader}>
                <Text style={styles.weekDetailTitle}>Semana {selectedWeekIndex + 1}</Text>
                <Text style={styles.weekDetailDates}>{formatDateShort(selectedWeek.weekStart)} - {formatDateShort(selectedWeek.weekEnd)}</Text>
              </View>

              {selectedWeek.phaseResult ? (
                <View style={[styles.phaseChip, { borderColor: PHASE_COLORS[phases.findIndex((p) => p.id === selectedWeek.phaseResult.phase.id) % PHASE_COLORS.length] }]}>
                  <Text style={[styles.phaseChipText, { color: PHASE_COLORS[phases.findIndex((p) => p.id === selectedWeek.phaseResult.phase.id) % PHASE_COLORS.length] }]}>
                    {selectedWeek.phaseResult.phase.name} · Sem. {selectedWeek.phaseResult.weekInPhase}/{selectedWeek.phaseResult.phase.duration_weeks}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noPhaseText}>{plan ? 'Fora do período do plano' : 'Nenhum plano configurado'}</Text>
              )}

              <View style={styles.weekStatsRow}>
                <View style={styles.weekStat}>
                  <Text style={styles.weekStatValue}>{selectedWeek.daysTrained}</Text>
                  <Text style={styles.weekStatLabel}>dias treinados</Text>
                </View>
                <View style={styles.weekStat}>
                  <Text style={styles.weekStatValue}>{selectedWeek.volume.toLocaleString('pt-BR')}kg</Text>
                  <Text style={styles.weekStatLabel}>volume</Text>
                </View>
                <View style={styles.weekStat}>
                  <Text style={[styles.weekStatValue, selectedRpe && { color: selectedRpe.color }]}>
                    {selectedRpe ? selectedRpe.label : '—'}
                  </Text>
                  <Text style={styles.weekStatLabel}>RPE médio</Text>
                </View>
              </View>

              {editingNote ? (
                <View style={styles.noteEditBox}>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="ex: Semana de choque"
                    placeholderTextColor="#525252"
                    value={noteInput}
                    onChangeText={setNoteInput}
                  />
                  <View style={styles.noteButtonRow}>
                    <TouchableOpacity onPress={() => setEditingNote(false)}>
                      <Text style={styles.noteCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveNote} disabled={savingNote}>
                      {savingNote ? <ActivityIndicator color="#f97316" size="small" /> : <Text style={styles.noteSaveText}>Salvar</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={handleOpenNoteEditor} disabled={!isPersonal}>
                  <Text style={styles.noteLinkText}>
                    {selectedWeek.note ? `📝 ${selectedWeek.note}` : (isPersonal ? '+ Observação pontual' : '')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!selectedWeek && (
            <Text style={styles.hintText}>Toque numa barra do gráfico pra ver o detalhe daquela semana.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  studentSelectorScroll: { maxHeight: 40, marginBottom: 14 },
  studentChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  studentChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  studentChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  studentChipTextActive: { color: '#0a0a0a' },
  studentLabel: { color: '#737373', fontSize: 12, marginBottom: 14 },
  configureButton: { borderWidth: 1, borderColor: '#a855f7', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginBottom: 16 },
  configureButtonText: { color: '#a855f7', fontSize: 12, fontWeight: '700' },
  chartCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16 },
  chartTitle: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  phaseRow: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  phaseBlock: { height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  phaseBlockText: { color: '#0a0a0a', fontSize: 9, fontWeight: '800' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 120, marginTop: 4 },
  barColumn: { alignItems: 'center' },
  barTrack: { width: 16, height: 96, backgroundColor: '#0a0a0a', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 4 },
  barFillSelected: { opacity: 1 },
  barLabel: { color: '#525252', fontSize: 9, marginTop: 4 },
  barLabelSelected: { color: '#f5f5f5', fontWeight: '800' },
  hintText: { color: '#525252', fontSize: 12, textAlign: 'center', marginTop: 10 },
  weekDetailCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 20 },
  weekDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  weekDetailTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  weekDetailDates: { color: '#525252', fontSize: 10 },
  phaseChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  phaseChipText: { fontSize: 11, fontWeight: '700' },
  noPhaseText: { color: '#525252', fontSize: 11, marginBottom: 12 },
  weekStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  weekStat: { flex: 1, backgroundColor: '#0a0a0a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  weekStatValue: { color: '#f5f5f5', fontSize: 13, fontWeight: '800' },
  weekStatLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 3 },
  noteLinkText: { color: '#3b82f6', fontSize: 11, fontWeight: '600' },
  noteEditBox: { marginTop: 4 },
  noteInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 12, marginBottom: 8 },
  noteButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  noteCancelText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  noteSaveText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
});
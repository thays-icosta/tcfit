import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert, describeFunctionError } from './alertUtils';
import { loadExerciseLoadHistory, suggestNextLoad, estimate1RM } from './progressionUtils';
import { HeaderBack } from './Header';

function parseReps(repsStr) {
  if (!repsStr) return 10;
  const numbers = repsStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 10;
  const nums = numbers.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// Same 1-5 scale already used for RPE across the app (WorkoutPlayerScreen's
// post-treino question, the weekly RPE average on the periodization screen)
// — kept identical here so the personal's presencial log and the aluno's own
// self-logged sessions average together meaningfully.
const PSE_OPTIONS = [
  { value: 1, label: 'Leve', color: '#22c55e' },
  { value: 2, label: 'Moderado', color: '#84cc16' },
  { value: 3, label: 'Intenso', color: '#eab308' },
  { value: 4, label: 'Muito Intenso', color: '#FF6B00' },
  { value: 5, label: 'Extremo', color: '#ef4444' },
];

const RIR_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4+' },
];

export default function PresencialSessionScreen({ student, personalId, onClose }) {
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [fichas, setFichas] = useState([]);
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [starting, setStarting] = useState(false);
  const [setLoads, setSetLoads] = useState({});
  const [setReps, setSetReps] = useState({});
  const [setRirs, setSetRirs] = useState({});
  const [completedSets, setCompletedSets] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [showFinishStep, setShowFinishStep] = useState(false);
  const [selectedPse, setSelectedPse] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [finishSummary, setFinishSummary] = useState(null);
  const [previousLoads, setPreviousLoads] = useState({});
  const [pastSetsRaw, setPastSetsRaw] = useState([]);
  const [exerciseHistory, setExerciseHistory] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workouts')
        .select('id, name')
        .eq('student_id', student.id)
        .eq('active', true);
      setFichas(data || []);
      setLoadingFichas(false);
    })();
  }, [student.id]);

  const handleSelectFicha = async (ficha) => {
    setLoadingExercises(true);
    setWorkout(ficha);
    setCurrentExerciseIndex(0);
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, order_index, sets, reps, load_kg, exercise_id, exercises (name, muscle_group, thumbnail_url)')
      .eq('workout_id', ficha.id)
      .order('order_index', { ascending: true });
    const exList = data || [];
    setExercises(exList);
    setLoadingExercises(false);

    if (exList.length > 0) {
      const exerciseIds = exList.map((e) => e.id);
      const { data: pastSets } = await supabase
        .from('workout_session_sets')
        .select('workout_exercise_id, session_id, set_number, load_used_kg, reps_done, completed_at')
        .in('workout_exercise_id', exerciseIds)
        .order('completed_at', { ascending: false });
      setPastSetsRaw(pastSets || []);

      const prevMap = {};
      (pastSets || []).forEach((row) => {
        const key = `${row.workout_exercise_id}-${row.set_number}`;
        if (!(key in prevMap)) prevMap[key] = row.load_used_kg;
      });
      setPreviousLoads(prevMap);

      const historyEntries = await Promise.all(
        exList.map(async (ex) => [ex.id, await loadExerciseLoadHistory(supabase, ex.id)])
      );
      setExerciseHistory(Object.fromEntries(historyEntries));
    }

    setStarting(true);
    const { data: startData, error } = await supabase.functions.invoke('log-presencial-session', {
      body: { action: 'start', studentId: student.id, workoutId: ficha.id },
    });
    setStarting(false);
    if (error || !startData?.sessionId) {
      showAlert('Erro ao iniciar aula', await describeFunctionError(error, startData, 'Não foi possível iniciar a aula presencial.'));
      setWorkout(null);
      return;
    }
    setSessionId(startData.sessionId);
    setSessionStartedAt(new Date());
  };

  // All sets from the most recent finished session for this exercise, in
  // set-number order — what the aluno actually did last time, not just a
  // single representative set.
  const getLastSessionSets = (exerciseId) => {
    const rows = pastSetsRaw.filter((r) => r.workout_exercise_id === exerciseId);
    if (rows.length === 0) return [];
    const lastSessionId = rows[0].session_id;
    return rows.filter((r) => r.session_id === lastSessionId).sort((a, b) => a.set_number - b.set_number);
  };

  // Defaults an empty field to what the aluno actually lifted last time on
  // this exact set number, falling back to the ficha's prescribed load.
  const getDefaultLoad = (exercise, setNumber) => {
    const prev = previousLoads[`${exercise.id}-${setNumber}`];
    if (prev != null) return String(prev);
    return exercise.load_kg != null ? String(exercise.load_kg) : '';
  };

  const handleApplySuggestion = (exercise) => {
    const suggestion = suggestNextLoad(exerciseHistory[exercise.id], exercise.reps);
    if (!suggestion) return;
    const setCount = exercise.sets || 3;
    setSetLoads((prev) => {
      const next = { ...prev };
      for (let i = 1; i <= setCount; i++) {
        const key = `${exercise.id}-${i}`;
        if (!completedSets[key]) next[key] = String(suggestion.suggestedLoad);
      }
      return next;
    });
  };

  const handleCompleteSet = async (exercise, setNumber) => {
    Keyboard.dismiss();
    const key = `${exercise.id}-${setNumber}`;
    const loadValue = setLoads[key] !== undefined ? setLoads[key] : getDefaultLoad(exercise, setNumber);
    const repsValue = setReps[key] !== undefined ? setReps[key] : (exercise.reps || '');
    const rirValue = setRirs[key];

    setSavingKey(key);
    const { data, error } = await supabase.functions.invoke('log-presencial-session', {
      body: {
        action: 'log_set',
        studentId: student.id,
        sessionId,
        workoutExerciseId: exercise.id,
        setNumber,
        loadKg: loadValue || null,
        reps: repsValue || null,
        rir: rirValue != null ? rirValue : null,
      },
    });
    setSavingKey(null);
    if (error || !data?.ok) {
      showAlert('Erro ao salvar série', await describeFunctionError(error, data, 'Não foi possível salvar essa série.'));
      return;
    }
    setSetLoads((prev) => ({ ...prev, [key]: loadValue }));
    setSetReps((prev) => ({ ...prev, [key]: repsValue }));
    setCompletedSets((prev) => ({ ...prev, [key]: true }));
  };

  const handleFinish = async () => {
    let tonnage = 0;
    let totalSets = 0;
    let exercisesWithSets = 0;
    exercises.forEach((ex) => {
      const setCount = ex.sets || 3;
      let exerciseHasSet = false;
      for (let i = 1; i <= setCount; i++) {
        const key = `${ex.id}-${i}`;
        if (!completedSets[key]) continue;
        const load = Number(setLoads[key] || ex.load_kg || 0);
        const reps = parseReps(setReps[key] || ex.reps);
        tonnage += load * reps;
        totalSets += 1;
        exerciseHasSet = true;
      }
      if (exerciseHasSet) exercisesWithSets += 1;
    });

    const durationMin = sessionStartedAt ? Math.max(1, Math.round((new Date() - sessionStartedAt) / 60000)) : null;

    setFinishing(true);
    const { data, error } = await supabase.functions.invoke('log-presencial-session', {
      body: { action: 'finish', studentId: student.id, sessionId, workoutId: workout?.id, totalTonnageKg: tonnage, pse: selectedPse },
    });
    setFinishing(false);
    if (error || !data?.ok) {
      showAlert('Erro ao concluir aula', await describeFunctionError(error, data, 'Não foi possível concluir a aula.'));
      return;
    }

    const trimmedNotes = sessionNotes.trim();
    if (trimmedNotes) {
      // Written with the personal's own session (not the service-role edge
      // function) — RLS on this table only allows personal_id = auth.uid(),
      // and the aluno has no select policy on it at all.
      await supabase.from('session_personal_notes').upsert(
        { session_id: sessionId, student_id: student.id, personal_id: personalId, notes: trimmedNotes, updated_at: new Date().toISOString() },
        { onConflict: 'session_id' }
      );
    }

    setShowFinishStep(false);
    setFinishSummary({ durationMin, exercisesCount: exercisesWithSets, setsCount: totalSets, tonnage: Math.round(tonnage), notes: trimmedNotes || null });
  };

  if (loadingFichas) {
    return (
      <View style={styles.container}>
        <HeaderBack title="Modo Aula Presencial" onBack={onClose} />
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.container}>
        <HeaderBack title="Modo Aula Presencial" onBack={onClose} />
        <Text style={styles.subtitle}>Escolha a ficha de {student.name} pra essa aula:</Text>
        {fichas.length === 0 ? (
          <Text style={styles.emptyText}>Esse aluno ainda não tem nenhuma ficha ativa.</Text>
        ) : (
          <ScrollView>
            {fichas.map((f) => (
              <TouchableOpacity key={f.id} style={styles.fichaCard} onPress={() => handleSelectFicha(f)} disabled={starting}>
                <Ionicons name="barbell-outline" size={20} color="#FF6B00" />
                <Text style={styles.fichaCardText}>{f.name}</Text>
                {starting ? <ActivityIndicator color="#FF6B00" size="small" /> : <Ionicons name="chevron-forward-outline" size={18} color="#525252" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  if (loadingExercises) {
    return (
      <View style={styles.container}>
        <HeaderBack title={workout.name} onBack={onClose} />
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={styles.container}>
        <HeaderBack title={workout.name} onBack={onClose} />
        <Text style={styles.emptyText}>Essa ficha ainda não tem nenhum exercício. Adicione exercícios a ela antes de iniciar o atendimento.</Text>
      </View>
    );
  }

  if (finishSummary) {
    return (
      <View style={styles.container}>
        <Text style={styles.focusExerciseName}>Sessão Concluída ✓</Text>
        <Text style={styles.focusExerciseMeta}>{student.name} · {workout.name}</Text>
        <View style={styles.card}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{finishSummary.durationMin != null ? `${finishSummary.durationMin} min` : '—'}</Text>
              <Text style={styles.summaryLabel}>Duração</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{finishSummary.exercisesCount}</Text>
              <Text style={styles.summaryLabel}>Exercícios</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{finishSummary.setsCount}</Text>
              <Text style={styles.summaryLabel}>Séries</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{finishSummary.tonnage.toLocaleString('pt-BR')}kg</Text>
              <Text style={styles.summaryLabel}>Volume</Text>
            </View>
            {selectedPse != null && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: PSE_OPTIONS.find((p) => p.value === selectedPse)?.color }]}>
                  {PSE_OPTIONS.find((p) => p.value === selectedPse)?.label}
                </Text>
                <Text style={styles.summaryLabel}>RPE da sessão</Text>
              </View>
            )}
          </View>
          {finishSummary.notes && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>OBSERVAÇÕES (PRIVADO)</Text>
              <Text style={styles.notesSummaryText}>{finishSummary.notes}</Text>
            </>
          )}
        </View>
        <TouchableOpacity style={[styles.finishButton, styles.finishButtonStandalone]} onPress={onClose}>
          <Text style={styles.finishButtonText}>Concluir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showFinishStep) {
    return (
      <View style={styles.container}>
        <HeaderBack title="Como foi a sessão?" onBack={() => setShowFinishStep(false)} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{student.name} · {workout.name}</Text>
          <View style={styles.pseRow}>
            {PSE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.psePill, { borderColor: opt.color }, selectedPse === opt.value && { backgroundColor: `${opt.color}22` }]}
                onPress={() => setSelectedPse(opt.value)}
              >
                <Text style={[styles.psePillText, { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>OBSERVAÇÕES DA SESSÃO (PRIVADO — SÓ VOCÊ VÊ)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="ex: Relatou desconforto no ombro. Boa execução no agachamento."
            placeholderTextColor="#525252"
            multiline
            value={sessionNotes}
            onChangeText={setSessionNotes}
          />
        </ScrollView>
        <TouchableOpacity style={[styles.finishButton, styles.finishButtonStandalone]} onPress={handleFinish} disabled={finishing || selectedPse == null}>
          {finishing ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.finishButtonText}>Salvar Sessão</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  const ex = exercises[currentExerciseIndex];
  const setCount = ex.sets || 3;
  const lastSessionSets = getLastSessionSets(ex.id);
  const suggestion = suggestNextLoad(exerciseHistory[ex.id], ex.reps);
  const nextPendingSetNumber = (() => {
    for (let i = 1; i <= setCount; i++) {
      if (!completedSets[`${ex.id}-${i}`]) return i;
    }
    return null;
  })();
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

  return (
    <View style={styles.container}>
      <HeaderBack title={workout.name} onBack={onClose} />
      <Text style={styles.subtitle}>{student.name} · Exercício {currentExerciseIndex + 1} de {exercises.length}</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        <Text style={styles.focusExerciseName}>{ex.exercises?.name}</Text>
        <Text style={styles.focusExerciseMeta}>Meta: {ex.reps || '-'} reps · {setCount} séries</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ÚLTIMA SESSÃO</Text>
          {lastSessionSets.length === 0 ? (
            <Text style={styles.emptyInlineText}>Sem histórico ainda.</Text>
          ) : (
            <>
              {lastSessionSets.map((s) => (
                <Text key={s.set_number} style={styles.lastSessionLine}>
                  {s.load_used_kg != null ? `${s.load_used_kg}kg` : '-'} × {s.reps_done || '-'}
                </Text>
              ))}
              {(() => {
                const best1RM = Math.max(
                  ...lastSessionSets.map((s) => estimate1RM(s.load_used_kg, parseReps(s.reps_done)) || 0)
                );
                return best1RM > 0 ? <Text style={styles.oneRmLine}>1RM estimado: ~{best1RM}kg</Text> : null;
              })()}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>HOJE</Text>
          {Array.from({ length: setCount }).map((_, i) => {
            const setNumber = i + 1;
            const key = `${ex.id}-${setNumber}`;
            const done = completedSets[key];
            if (done) {
              return (
                <View key={key} style={styles.todayDoneRow}>
                  <Text style={styles.todayDoneText}>
                    Série {setNumber} · {setLoads[key]}kg · {setReps[key]} reps{setRirs[key] != null ? ` · RIR ${setRirs[key]}` : ''}
                  </Text>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                </View>
              );
            }
            if (setNumber !== nextPendingSetNumber) return null;
            const defaultLoad = getDefaultLoad(ex, setNumber);
            return (
              <View key={key} style={styles.entryBlock}>
                <Text style={styles.entryRowLabel}>Série {setNumber}</Text>
                <View style={styles.entryInputsRow}>
                  <View style={styles.entryInputCol}>
                    <TextInput
                      style={styles.entryInput}
                      keyboardType="number-pad"
                      placeholder={defaultLoad ? `${defaultLoad} kg` : 'kg'}
                      placeholderTextColor="#525252"
                      value={setLoads[key] !== undefined ? setLoads[key] : defaultLoad}
                      onChangeText={(t) => setSetLoads((prev) => ({ ...prev, [key]: t }))}
                    />
                    <Text style={styles.entryUnit}>kg</Text>
                  </View>
                  <View style={styles.entryInputCol}>
                    <TextInput
                      style={styles.entryInput}
                      placeholder={ex.reps ? `${ex.reps} reps` : 'reps'}
                      placeholderTextColor="#525252"
                      value={setReps[key] !== undefined ? setReps[key] : (ex.reps || '')}
                      onChangeText={(t) => setSetReps((prev) => ({ ...prev, [key]: t }))}
                    />
                    <Text style={styles.entryUnit}>reps</Text>
                  </View>
                </View>
                <Text style={styles.rirLabel}>RIR (reps em reserva)</Text>
                <View style={styles.rirRow}>
                  {RIR_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.rirChip, setRirs[key] === opt.value && styles.rirChipActive]}
                      onPress={() => setSetRirs((prev) => ({ ...prev, [key]: opt.value }))}
                    >
                      <Text style={[styles.rirChipText, setRirs[key] === opt.value && styles.rirChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.entryConfirmButton}
                  onPress={() => handleCompleteSet(ex, setNumber)}
                  disabled={savingKey === key}
                >
                  {savingKey === key ? (
                    <ActivityIndicator color="#0F0F12" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#0F0F12" />
                      <Text style={styles.entryConfirmButtonText}>Registrar Série</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {suggestion && (
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionHeaderRow}>
              <Ionicons name={suggestion.hitTarget ? 'checkmark-circle' : 'alert-circle'} size={16} color={suggestion.hitTarget ? '#22c55e' : '#f59e0b'} />
              <Text style={[styles.suggestionStatus, { color: suggestion.hitTarget ? '#22c55e' : '#f59e0b' }]}>
                {suggestion.hitTarget ? 'Meta atingida' : 'Abaixo da meta'}
              </Text>
            </View>
            <Text style={styles.suggestionValue}>Sugestão: {suggestion.suggestedLoad}kg</Text>
            <View style={styles.suggestionButtonRow}>
              <TouchableOpacity style={styles.suggestionApplyButton} onPress={() => handleApplySuggestion(ex)}>
                <Text style={styles.suggestionApplyButtonText}>Aplicar</Text>
              </TouchableOpacity>
              {/* "Editar" is just a visual pair to "Aplicar" — the Kg field above is already free-editable, so there's nothing extra to wire up. */}
              <View style={styles.suggestionEditButton}>
                <Text style={styles.suggestionEditButtonText}>Editar acima ↑</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navButton, currentExerciseIndex === 0 && styles.navButtonDisabled]}
          onPress={() => setCurrentExerciseIndex((i) => Math.max(0, i - 1))}
          disabled={currentExerciseIndex === 0}
        >
          <Text style={styles.navButtonText}>← Anterior</Text>
        </TouchableOpacity>
        {isLastExercise ? (
          <TouchableOpacity style={styles.finishButton} onPress={() => setShowFinishStep(true)}>
            <Text style={styles.finishButtonText}>Concluir Aula</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={() => setCurrentExerciseIndex((i) => Math.min(exercises.length - 1, i + 1))}>
            <Text style={styles.nextButtonText}>Próximo exercício →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50, paddingHorizontal: 16 },
  subtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 14 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  emptyInlineText: { color: '#525252', fontSize: 12 },
  fichaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 10 },
  fichaCardText: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', flex: 1 },
  focusExerciseName: { color: '#F5F5F7', fontSize: 24, fontWeight: '800', textTransform: 'uppercase' },
  focusExerciseMeta: { color: '#a3a3a3', fontSize: 13, marginTop: 4, marginBottom: 16 },
  rirRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  rirLabel: { color: '#525252', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 10 },
  rirChip: { flex: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  rirChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  rirChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  rirChipTextActive: { color: '#0F0F12' },
  pseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  psePill: { flexGrow: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 14, alignItems: 'center', minWidth: '30%' },
  psePillText: { fontSize: 13, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { width: '30%', alignItems: 'center', backgroundColor: '#0F0F12', borderRadius: 8, paddingVertical: 12 },
  summaryValue: { color: '#F5F5F7', fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 4, textAlign: 'center' },
  notesInput: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, color: '#F5F5F7', fontSize: 14, minHeight: 100, textAlignVertical: 'top' },
  notesSummaryText: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginTop: 6 },
  card: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionLabel: { color: '#525252', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  lastSessionLine: { color: '#a3a3a3', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  oneRmLine: { color: '#FF6B00', fontSize: 12, fontWeight: '700', marginTop: 4 },
  todayDoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0F0F12' },
  todayDoneText: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  entryBlock: { marginTop: 4 },
  entryRowLabel: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  entryInputsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  entryInputCol: { flex: 1, alignItems: 'center' },
  entryInput: { width: '100%', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 6, color: '#F5F5F7', fontSize: 16, textAlign: 'center' },
  entryUnit: { color: '#525252', fontSize: 11, marginTop: 4 },
  entryConfirmButton: { flexDirection: 'row', gap: 6, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  entryConfirmButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  suggestionCard: { borderWidth: 1, borderColor: '#FF6B00', borderRadius: 12, padding: 14, marginBottom: 12 },
  suggestionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  suggestionStatus: { fontSize: 12, fontWeight: '800' },
  suggestionValue: { color: '#F5F5F7', fontSize: 18, fontWeight: '800' },
  suggestionButtonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  suggestionApplyButton: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  suggestionApplyButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '800' },
  suggestionEditButton: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  suggestionEditButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700' },
  navRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16 },
  navButton: { flex: 1, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700' },
  nextButton: { flex: 2, backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  finishButton: { flex: 2, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  finishButtonStandalone: { flex: 0, marginTop: 24 },
  finishButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
});

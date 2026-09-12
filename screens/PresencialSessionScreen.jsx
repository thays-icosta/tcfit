import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert, describeFunctionError } from './alertUtils';
import { loadExerciseLoadHistory, suggestNextLoad } from './progressionUtils';
import { HeaderBack } from './Header';

function parseReps(repsStr) {
  if (!repsStr) return 10;
  const numbers = repsStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 10;
  const nums = numbers.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function PresencialSessionScreen({ student, personalId, onClose }) {
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [fichas, setFichas] = useState([]);
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [setLoads, setSetLoads] = useState({});
  const [setReps, setSetReps] = useState({});
  const [completedSets, setCompletedSets] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [finishing, setFinishing] = useState(false);
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
    exercises.forEach((ex) => {
      const setCount = ex.sets || 3;
      for (let i = 1; i <= setCount; i++) {
        const key = `${ex.id}-${i}`;
        if (!completedSets[key]) continue;
        const load = Number(setLoads[key] || ex.load_kg || 0);
        const reps = parseReps(setReps[key] || ex.reps);
        tonnage += load * reps;
      }
    });

    setFinishing(true);
    const { data, error } = await supabase.functions.invoke('log-presencial-session', {
      body: { action: 'finish', studentId: student.id, sessionId, workoutId: workout?.id, totalTonnageKg: tonnage },
    });
    setFinishing(false);
    if (error || !data?.ok) {
      showAlert('Erro ao concluir aula', await describeFunctionError(error, data, 'Não foi possível concluir a aula.'));
      return;
    }
    showAlert('Aula registrada!', `Sessão presencial de ${student.name} salva com sucesso.`, [{ text: 'OK', onPress: onClose }]);
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
            lastSessionSets.map((s) => (
              <Text key={s.set_number} style={styles.lastSessionLine}>
                {s.load_used_kg != null ? `${s.load_used_kg}kg` : '-'} × {s.reps_done || '-'}
              </Text>
            ))
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
                    Série {setNumber} · {setLoads[key]}kg · {setReps[key]} reps
                  </Text>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                </View>
              );
            }
            if (setNumber !== nextPendingSetNumber) return null;
            const defaultLoad = getDefaultLoad(ex, setNumber);
            return (
              <View key={key} style={styles.entryRow}>
                <Text style={styles.entryRowLabel}>Série {setNumber}</Text>
                <TextInput
                  style={styles.entryInput}
                  keyboardType="number-pad"
                  placeholder={defaultLoad || 'kg'}
                  placeholderTextColor="#525252"
                  value={setLoads[key] !== undefined ? setLoads[key] : defaultLoad}
                  onChangeText={(t) => setSetLoads((prev) => ({ ...prev, [key]: t }))}
                />
                <Text style={styles.entryUnit}>kg</Text>
                <TextInput
                  style={styles.entryInput}
                  placeholder={ex.reps || 'reps'}
                  placeholderTextColor="#525252"
                  value={setReps[key] !== undefined ? setReps[key] : (ex.reps || '')}
                  onChangeText={(t) => setSetReps((prev) => ({ ...prev, [key]: t }))}
                />
                <Text style={styles.entryUnit}>reps</Text>
                <TouchableOpacity
                  style={styles.entryCheckButton}
                  onPress={() => handleCompleteSet(ex, setNumber)}
                  disabled={savingKey === key}
                >
                  {savingKey === key ? <ActivityIndicator color="#0F0F12" size="small" /> : <Ionicons name="checkmark" size={18} color="#0F0F12" />}
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
          <TouchableOpacity style={styles.finishButton} onPress={handleFinish} disabled={finishing}>
            {finishing ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.finishButtonText}>Concluir Aula</Text>}
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
  card: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionLabel: { color: '#525252', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  lastSessionLine: { color: '#a3a3a3', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  todayDoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0F0F12' },
  todayDoneText: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  entryRowLabel: { color: '#F5F5F7', fontSize: 13, fontWeight: '700', width: 60 },
  entryInput: { flex: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 6, color: '#F5F5F7', fontSize: 15, textAlign: 'center' },
  entryUnit: { color: '#525252', fontSize: 11 },
  entryCheckButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
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
  finishButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
});

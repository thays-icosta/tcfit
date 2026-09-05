import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Vibration, Image, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Platform, InputAccessoryView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './supabaseClient';
import { loadPeriodizationPlan, getCurrentPhase } from './periodizationUtils';
import { showAlert } from './alertUtils';
import { getYoutubeVideoId } from './youtubeUtils';
import AlunoTabBar from './AlunoTabBar';
import { HeaderBack } from './Header';

function isGifUrl(url) {
  return !!url && url.toLowerCase().split('?')[0].endsWith('.gif');
}

function parseReps(repsStr) {
  if (!repsStr) return 10;
  const numbers = repsStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 10;
  const nums = numbers.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const CACHE_KEY_PREFIX = 'workout_cache_';
const QUEUE_SESSIONS_KEY = 'offline_queue_sessions';
const QUEUE_SETS_KEY = 'offline_queue_sets';
const QUEUE_FINISH_KEY = 'offline_queue_finish';
const QUEUE_COMPLETIONS_KEY = 'offline_queue_completions';

const AVERAGE_STRENGTH_MET = 6.0;
const DEFAULT_WEIGHT_KG = 70;
const KEYBOARD_TOOLBAR_ID = 'workoutKeyboardToolbar';

const PSE_OPTIONS = [
  { value: 1, label: 'Leve', color: '#22c55e' },
  { value: 2, label: 'Moderado', color: '#84cc16' },
  { value: 3, label: 'Intenso', color: '#eab308' },
  { value: 4, label: 'Muito Intenso', color: '#f97316' },
  { value: 5, label: 'Extremo', color: '#ef4444' },
];

const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

async function getQueue(key) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}
async function setQueue(key, arr) {
  await AsyncStorage.setItem(key, JSON.stringify(arr));
}

export default function WorkoutPlayerScreen({ workout, studentId, onExit, onNavigateTab }) {
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [studentWeight, setStudentWeight] = useState(null);
  const [previousLoads, setPreviousLoads] = useState({});
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [currentPhaseInfo, setCurrentPhaseInfo] = useState(null);

  const [setLoads, setSetLoads] = useState({});
  const [setReps, setSetReps] = useState({});
  const [completedSets, setCompletedSets] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const [restSecondsLeft, setRestSecondsLeft] = useState(null);
  const [videoModalFor, setVideoModalFor] = useState(null);

  const [substituteOpenFor, setSubstituteOpenFor] = useState(null);
  const [alternativesCache, setAlternativesCache] = useState({});
  const [loadingAlternatives, setLoadingAlternatives] = useState(null);
  const [substitutions, setSubstitutions] = useState({});

  const [showCelebration, setShowCelebration] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedPse, setSelectedPse] = useState(null);
  const [studentNotes, setStudentNotes] = useState('');
  const [savingPse, setSavingPse] = useState(false);

  const cacheKey = `${CACHE_KEY_PREFIX}${workout.id}`;

  const updatePendingCount = async () => {
    const [qs, qsets, qf] = await Promise.all([
      getQueue(QUEUE_SESSIONS_KEY),
      getQueue(QUEUE_SETS_KEY),
      getQueue(QUEUE_FINISH_KEY),
    ]);
    setPendingSyncCount(qs.length + qsets.length + qf.length);
  };

  const flushQueue = async () => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    let sessionsQueue = await getQueue(QUEUE_SESSIONS_KEY);
    const remainingSessions = [];
    for (const item of sessionsQueue) {
      const { error } = await supabase.from('workout_sessions').insert(item);
      if (error && !error.message.includes('duplicate')) remainingSessions.push(item);
    }
    await setQueue(QUEUE_SESSIONS_KEY, remainingSessions);

    let setsQueue = await getQueue(QUEUE_SETS_KEY);
    const remainingSets = [];
    for (const item of setsQueue) {
      const { error } = await supabase.from('workout_session_sets').insert(item);
      if (error && !error.message.includes('duplicate')) remainingSets.push(item);
    }
    await setQueue(QUEUE_SETS_KEY, remainingSets);

    let finishQueue = await getQueue(QUEUE_FINISH_KEY);
    const remainingFinish = [];
    for (const item of finishQueue) {
      const { id, ...updates } = item;
      const { error } = await supabase.from('workout_sessions').update(updates).eq('id', id);
      if (error) remainingFinish.push(item);
    }
    await setQueue(QUEUE_FINISH_KEY, remainingFinish);

    let completionsQueue = await getQueue(QUEUE_COMPLETIONS_KEY);
    const remainingCompletions = [];
    for (const item of completionsQueue) {
      const { error } = await supabase.from('workout_completions').insert(item);
      if (error) remainingCompletions.push(item);
    }
    await setQueue(QUEUE_COMPLETIONS_KEY, remainingCompletions);

    await updatePendingCount();
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      if (!offline) flushQueue();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const netState = await NetInfo.fetch();
      const online = netState.isConnected;
      setIsOffline(!online);

      let exData = null;
      let userRow = null;
      let pastSetsData = null;

      if (online) {
        const { data } = await supabase
          .from('workout_exercises')
          .select('id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes, exercise_id, exercises (name, muscle_group, thumbnail_url, video_url, instructions)')
          .eq('workout_id', workout.id)
          .order('order_index', { ascending: true });
        exData = data;

        const { data: userData } = await supabase
          .from('users')
          .select('weight_kg')
          .eq('id', studentId)
          .single();
        userRow = userData;

        if (exData && exData.length > 0) {
          const exerciseIds = exData.map((e) => e.id);
          const { data: pastSets } = await supabase
            .from('workout_session_sets')
            .select('workout_exercise_id, set_number, load_used_kg, completed_at')
            .in('workout_exercise_id', exerciseIds)
            .order('completed_at', { ascending: false });
          pastSetsData = pastSets;
        }

        await AsyncStorage.setItem(cacheKey, JSON.stringify({ exercises: exData, weight: userRow?.weight_kg, pastSets: pastSetsData }));
      } else {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          exData = parsed.exercises;
          userRow = { weight_kg: parsed.weight };
          pastSetsData = parsed.pastSets;
        } else {
          showAlert('Sem conexão', 'Essa ficha ainda não foi aberta com internet, então não temos os dados salvos localmente. Conecta à internet uma vez pra baixar a ficha.');
          onExit();
          return;
        }
      }

      const ex = exData || [];
      setExercises(ex);
      setStudentWeight(userRow?.weight_kg || null);

      const map = {};
      (pastSetsData || []).forEach((row) => {
        const key = `${row.workout_exercise_id}-${row.set_number}`;
        if (!map[key]) map[key] = row.load_used_kg;
      });
      setPreviousLoads(map);

      const newSessionId = uuidv4();
      const newStartedAt = new Date().toISOString();
      setSessionId(newSessionId);
      setStartedAt(newStartedAt);

      const sessionPayload = { id: newSessionId, workout_id: workout.id, student_id: studentId, started_at: newStartedAt };

      if (online) {
        const { error } = await supabase.from('workout_sessions').insert(sessionPayload);
        if (error) {
          const queue = await getQueue(QUEUE_SESSIONS_KEY);
          queue.push(sessionPayload);
          await setQueue(QUEUE_SESSIONS_KEY, queue);
        }
      } else {
        const queue = await getQueue(QUEUE_SESSIONS_KEY);
        queue.push(sessionPayload);
        await setQueue(QUEUE_SESSIONS_KEY, queue);
      }

      await updatePendingCount();

      if (online) {
        const { plan, phases } = await loadPeriodizationPlan(supabase, studentId);
        setCurrentPhaseInfo(getCurrentPhase(plan, phases));
      }

      setLoading(false);
    })();
  }, [workout.id]);

  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft <= 0) {
      Vibration.vibrate(600);
      setRestSecondsLeft(null);
      return;
    }
    const timeout = setTimeout(() => setRestSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timeout);
  }, [restSecondsLeft]);

  const startRestTimer = (seconds) => setRestSecondsLeft(seconds);
  const skipRest = () => setRestSecondsLeft(null);

  const handleToggleSubstitute = async (exercise) => {
    const next = substituteOpenFor === exercise.id ? null : exercise.id;
    setSubstituteOpenFor(next);
    if (next && !alternativesCache[exercise.id] && !isOffline) {
      setLoadingAlternatives(exercise.id);
      const { data } = await supabase
        .from('exercises')
        .select('id, name')
        .eq('muscle_group', exercise.exercises?.muscle_group)
        .neq('id', exercise.exercise_id)
        .order('name')
        .limit(6);
      setAlternativesCache((prev) => ({ ...prev, [exercise.id]: data || [] }));
      setLoadingAlternatives(null);
    }
  };

  const handleSelectSubstitute = (workoutExerciseId, alternative) => {
    setSubstitutions((prev) => ({ ...prev, [workoutExerciseId]: alternative }));
    setSubstituteOpenFor(null);
  };

  const handleCancelSubstitute = (workoutExerciseId) => {
    setSubstitutions((prev) => {
      const next = { ...prev };
      delete next[workoutExerciseId];
      return next;
    });
  };

  const handleCompleteSet = async (exercise, setNumber) => {
    Keyboard.dismiss();
    const key = `${exercise.id}-${setNumber}`;
    const loadValue = setLoads[key] !== undefined ? setLoads[key] : (exercise.load_kg != null ? String(exercise.load_kg) : '');
    const repsValue = setReps[key] !== undefined ? setReps[key] : (exercise.reps || '');
    const loadNum = loadValue ? Number(loadValue) : null;
    const substitute = substitutions[exercise.id];

    const setPayload = {
      id: uuidv4(),
      session_id: sessionId,
      workout_exercise_id: exercise.id,
      set_number: setNumber,
      load_used_kg: loadNum,
      reps_done: repsValue || null,
      substituted_exercise_id: substitute ? substitute.id : null,
    };

    setSavingKey(key);

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      const { error } = await supabase.from('workout_session_sets').insert(setPayload);
      if (error) {
        const queue = await getQueue(QUEUE_SETS_KEY);
        queue.push(setPayload);
        await setQueue(QUEUE_SETS_KEY, queue);
      }
    } else {
      const queue = await getQueue(QUEUE_SETS_KEY);
      queue.push(setPayload);
      await setQueue(QUEUE_SETS_KEY, queue);
    }

    await updatePendingCount();
    setSavingKey(null);
    setCompletedSets((prev) => ({ ...prev, [key]: true }));
    setSetLoads((prev) => ({ ...prev, [key]: loadValue }));
    setSetReps((prev) => ({ ...prev, [key]: repsValue }));
    startRestTimer(exercise.rest_time_seconds || 60);
  };

  const handleExit = () => {
    showAlert(
      'Sair sem finalizar?',
      'O treino não vai ficar marcado como concluído.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: onExit },
      ]
    );
  };

  const handleFinish = async () => {
    Keyboard.dismiss();
    const now = new Date();
    const elapsedMin = Math.max(1, Math.round((now - new Date(startedAt)) / 60000));

    let tonnage = 0;
    let totalSetsCompleted = 0;
    exercises.forEach((ex) => {
      const repsNum = parseReps(ex.reps);
      const setCount = ex.sets || 3;
      for (let i = 1; i <= setCount; i++) {
        const key = `${ex.id}-${i}`;
        if (completedSets[key]) {
          totalSetsCompleted += 1;
          const load = Number(setLoads[key] || ex.load_kg || 0);
          tonnage += load * repsNum;
        }
      }
    });

    const weightUsed = studentWeight || DEFAULT_WEIGHT_KG;
    const hours = elapsedMin / 60;
    const estimatedCalories = Math.round(AVERAGE_STRENGTH_MET * weightUsed * hours);

    const finishPayload = { id: sessionId, finished_at: now.toISOString(), active: false, total_tonnage_kg: tonnage };
    const completionPayload = { workout_id: workout.id, student_id: studentId };

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      const { error: e1 } = await supabase.from('workout_sessions').update({
        finished_at: finishPayload.finished_at,
        active: false,
        total_tonnage_kg: tonnage,
      }).eq('id', sessionId);
      if (e1) {
        const q = await getQueue(QUEUE_FINISH_KEY);
        q.push(finishPayload);
        await setQueue(QUEUE_FINISH_KEY, q);
      }

      const { error: e2 } = await supabase.from('workout_completions').insert(completionPayload);
      if (e2) {
        const q = await getQueue(QUEUE_COMPLETIONS_KEY);
        q.push(completionPayload);
        await setQueue(QUEUE_COMPLETIONS_KEY, q);
      }
    } else {
      const q1 = await getQueue(QUEUE_FINISH_KEY);
      q1.push(finishPayload);
      await setQueue(QUEUE_FINISH_KEY, q1);

      const q2 = await getQueue(QUEUE_COMPLETIONS_KEY);
      q2.push(completionPayload);
      await setQueue(QUEUE_COMPLETIONS_KEY, q2);
    }

    await updatePendingCount();

    setSummary({
      elapsedMin,
      tonnage: Math.round(tonnage),
      totalSetsCompleted,
      estimatedCalories,
      weightUsed,
      usedDefaultWeight: !studentWeight,
    });
    setShowCelebration(true);
  };

  const handleSavePse = async () => {
    if (selectedPse == null) {
      showAlert('Ops', 'Escolhe como foi o treino primeiro.');
      return;
    }
    Keyboard.dismiss();
    setSavingPse(true);
    const updates = { pse: selectedPse, student_notes: studentNotes.trim() || null };
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      await supabase.from('workout_sessions').update(updates).eq('id', sessionId);
    } else {
      const q = await getQueue(QUEUE_FINISH_KEY);
      q.push({ id: sessionId, ...updates });
      await setQueue(QUEUE_FINISH_KEY, q);
    }
    setSavingPse(false);
    onExit();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (showCelebration && summary) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={[styles.celebrationContainer, { paddingTop: insets.top + 40 }]}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.trophyCircle}>
            <Ionicons name="trophy-outline" size={40} color="#f97316" />
          </View>
          <Text style={styles.celebrationTitle}>Treino concluído</Text>
          <Text style={styles.celebrationSubtitle}>{workout.name}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary.elapsedMin}</Text>
              <Text style={styles.statLabel}>minutos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary.tonnage}</Text>
              <Text style={styles.statLabel}>kg levantados</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{summary.totalSetsCompleted}</Text>
              <Text style={styles.statLabel}>séries feitas</Text>
            </View>
          </View>

          <Text style={styles.caloriesText}>~{summary.estimatedCalories} kcal estimadas</Text>
          <Text style={styles.caloriesNote}>
            {summary.usedDefaultWeight
              ? `Baseado em peso padrão de ${summary.weightUsed}kg. Atualize seu peso no seu perfil pra ficar mais preciso.`
              : `Baseado no seu peso registrado: ${summary.weightUsed}kg.`}
          </Text>

          {pendingSyncCount > 0 && (
            <Text style={styles.syncNote}>{pendingSyncCount} registro(s) aguardando conexão pra sincronizar</Text>
          )}

          <Text style={styles.pseQuestion}>Como foi o treino hoje?</Text>
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

          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Observações sobre o treino</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Escreva como se sentiu, dores, aumentos de carga ou observações para o seu personal..."
              placeholderTextColor="#525252"
              multiline
              value={studentNotes}
              onChangeText={setStudentNotes}
              inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
            />
          </View>

          <TouchableOpacity style={[styles.finishButtonWide, { marginBottom: 24 }]} onPress={handleSavePse} disabled={savingPse}>
            {savingPse ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.finishButtonText}>Concluir</Text>}
          </TouchableOpacity>
        </ScrollView>

        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={KEYBOARD_TOOLBAR_ID}>
            <View style={styles.keyboardToolbar}>
              <TouchableOpacity onPress={Keyboard.dismiss}>
                <Text style={styles.keyboardToolbarText}>Concluído</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}
      </KeyboardAvoidingView>
      {onNavigateTab && <AlunoTabBar activeTab="treinos" onChange={onNavigateTab} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <HeaderBack backLabel="← Sair" title={workout.name} onBack={handleExit} style={{ paddingHorizontal: 16 }} />

          {currentPhaseInfo && (
            <View style={styles.phaseTopBadge}>
              <Text style={styles.phaseTopBadgeText}>
                Fase: {currentPhaseInfo.phase.name} • Semana {currentPhaseInfo.weekInPhase}/{currentPhaseInfo.phase.duration_weeks}
              </Text>
            </View>
          )}

          {isOffline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#ef4444" />
              <Text style={styles.offlineBannerText}>Modo offline — seus registros serão sincronizados quando a internet voltar</Text>
            </View>
          )}
          {!isOffline && pendingSyncCount > 0 && (
            <View style={styles.syncBanner}>
              <Ionicons name="sync-outline" size={14} color="#3b82f6" />
              <Text style={styles.syncBannerText}>Sincronizando {pendingSyncCount} registro(s)...</Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: restSecondsLeft !== null ? 90 : 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {exercises.map((ex) => {
              const substitute = substitutions[ex.id];
              const displayName = substitute ? substitute.name : ex.exercises?.name;
              const isSubOpen = substituteOpenFor === ex.id;
              const alternatives = alternativesCache[ex.id] || [];
              const setCount = ex.sets || 3;

              return (
                <View key={ex.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeader}>
                    {ex.exercises?.thumbnail_url ? (
                      <Image source={{ uri: ex.exercises.thumbnail_url }} style={styles.thumb} />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <Text style={styles.thumbPlaceholderText}>{displayName?.charAt(0) || '?'}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.exerciseNameRow}>
                        <Text style={styles.exerciseName}>{displayName}</Text>
                        {(ex.exercises?.video_url || ex.exercises?.instructions) && (
                          <TouchableOpacity
                            style={styles.videoIconButton}
                            onPress={() => setVideoModalFor(ex)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="play-circle" size={20} color="#f97316" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.exerciseSubtitle}>
                        {METHOD_LABELS[ex.execution_method] || ex.execution_method}
                        {ex.rest_time_seconds != null ? ` · ${ex.rest_time_seconds}s descanso` : ''}
                      </Text>
                      {substitute && (
                        <View style={styles.subTagRow}>
                          <Text style={styles.subTag}>Substituído (era {ex.exercises?.name})</Text>
                          <TouchableOpacity onPress={() => handleCancelSubstitute(ex.id)}>
                            <Text style={styles.subCancelText}>Desfazer</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    {!isOffline && (
                      <TouchableOpacity onPress={() => handleToggleSubstitute(ex)}>
                        <Ionicons name="swap-horizontal-outline" size={20} color="#a3a3a3" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {isSubOpen && (
                    <View style={styles.subDropdown}>
                      {loadingAlternatives === ex.id ? (
                        <ActivityIndicator color="#f97316" size="small" style={{ marginVertical: 8 }} />
                      ) : alternatives.length === 0 ? (
                        <Text style={styles.subEmpty}>Nenhuma alternativa cadastrada pra esse grupo muscular.</Text>
                      ) : (
                        alternatives.map((alt) => (
                          <TouchableOpacity key={alt.id} style={styles.subOption} onPress={() => handleSelectSubstitute(ex.id, alt)}>
                            <Text style={styles.subOptionText}>{alt.name}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}

                  {ex.notes ? <Text style={styles.exerciseNotes}>{ex.notes}</Text> : null}

                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colSet]}>Série</Text>
                    <Text style={[styles.tableHeaderText, styles.colPrev]}>Anterior</Text>
                    <Text style={[styles.tableHeaderText, styles.colKg]}>Kg</Text>
                    <Text style={[styles.tableHeaderText, styles.colReps]}>Reps</Text>
                    <Text style={[styles.tableHeaderText, styles.colCheck]}> </Text>
                  </View>

                  {Array.from({ length: setCount }).map((_, i) => {
                    const setNumber = i + 1;
                    const key = `${ex.id}-${setNumber}`;
                    const done = completedSets[key];
                    const prevLoad = previousLoads[key];
                    return (
                      <View key={key} style={styles.tableRow}>
                        <Text style={[styles.setNumberText, styles.colSet]}>{setNumber}</Text>
                        <Text style={[styles.prevText, styles.colPrev]} numberOfLines={1}>
                          {prevLoad != null ? `${prevLoad}kg×${ex.reps}` : '—'}
                        </Text>
                        <TextInput
                          style={[styles.cellInput, styles.colKg, done && styles.cellInputDone]}
                          keyboardType="number-pad"
                          editable={!done}
                          placeholder={ex.load_kg != null ? String(ex.load_kg) : '-'}
                          placeholderTextColor="#525252"
                          value={setLoads[key] !== undefined ? setLoads[key] : (ex.load_kg != null ? String(ex.load_kg) : '')}
                          onChangeText={(t) => setSetLoads((prev) => ({ ...prev, [key]: t }))}
                          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                        />
                        <TextInput
                          style={[styles.cellInput, styles.colReps, done && styles.cellInputDone]}
                          editable={!done}
                          placeholder={ex.reps || '-'}
                          placeholderTextColor="#525252"
                          value={setReps[key] !== undefined ? setReps[key] : (ex.reps || '')}
                          onChangeText={(t) => setSetReps((prev) => ({ ...prev, [key]: t }))}
                          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                        />
                        <View style={styles.colCheck}>
                          <TouchableOpacity
                            style={[styles.checkCircle, done && styles.checkCircleDone]}
                            onPress={() => !done && handleCompleteSet(ex, setNumber)}
                            disabled={done || savingKey === key}
                          >
                            {savingKey === key ? (
                              <ActivityIndicator color="#0a0a0a" size="small" />
                            ) : (
                              <Text style={styles.checkText}>{done ? '✓' : ''}</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          {restSecondsLeft !== null && (
            <View style={styles.restFloating}>
              <View>
                <Text style={styles.restLabel}>Descanso</Text>
                <Text style={styles.restCountdown}>{restSecondsLeft}s</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.restAddButton} onPress={() => setRestSecondsLeft((s) => (s || 0) + 30)}>
                  <Text style={styles.restAdd}>+30s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.restSkipButton} onPress={skipRest}>
                  <Text style={styles.restSkip}>Pular</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
            <Text style={styles.finishButtonText}>Finalizar Treino</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_TOOLBAR_ID}>
          <View style={styles.keyboardToolbar}>
            <TouchableOpacity onPress={Keyboard.dismiss}>
              <Text style={styles.keyboardToolbarText}>Concluído</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      <Modal visible={!!videoModalFor} animationType="slide" transparent onRequestClose={() => setVideoModalFor(null)}>
        <View style={styles.videoModalOverlay}>
          <View style={styles.videoModalCard}>
            <View style={styles.videoModalHeader}>
              <Text style={styles.videoModalTitle} numberOfLines={1}>
                {videoModalFor ? (substitutions[videoModalFor.id]?.name || videoModalFor.exercises?.name) : ''}
              </Text>
              <TouchableOpacity onPress={() => setVideoModalFor(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.videoModalBody}>
              {videoModalFor?.exercises?.video_url ? (
                isGifUrl(videoModalFor.exercises.video_url) ? (
                  <Image source={{ uri: videoModalFor.exercises.video_url }} style={styles.videoModalMedia} resizeMode="contain" />
                ) : getYoutubeVideoId(videoModalFor.exercises.video_url) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeVideoId(videoModalFor.exercises.video_url)}?autoplay=1&playsinline=1`}
                    style={{ width: '100%', height: 220, border: 0, backgroundColor: '#0a0a0a', borderRadius: 10 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={videoModalFor.exercises.video_url}
                    style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: '#0a0a0a' }}
                    controls
                    autoPlay
                    loop
                  />
                )
              ) : null}
              {videoModalFor?.exercises?.instructions ? (
                <Text style={styles.videoModalInstructions}>{videoModalFor.exercises.instructions}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  phaseTopBadge: { alignSelf: 'center', backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: '#a855f7', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 10 },
  phaseTopBadgeText: { color: '#a855f7', fontSize: 11, fontWeight: '700' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.12)', marginHorizontal: 16, borderRadius: 8, padding: 10, marginBottom: 10 },
  offlineBannerText: { color: '#ef4444', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(59,130,246,0.12)', marginHorizontal: 16, borderRadius: 8, padding: 10, marginBottom: 10 },
  syncBannerText: { color: '#3b82f6', fontSize: 11, fontWeight: '600' },
  exerciseCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 44, height: 44, borderRadius: 10, marginRight: 10 },
  thumbPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  thumbPlaceholderText: { color: '#f97316', fontSize: 16, fontWeight: '800' },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { color: '#f5f5f5', fontSize: 15, fontWeight: '700' },
  videoIconButton: { padding: 2 },
  exerciseSubtitle: { color: '#f97316', fontSize: 10, marginTop: 2 },
  subTagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  subTag: { color: '#22c55e', fontSize: 9 },
  subCancelText: { color: '#ef4444', fontSize: 9, textDecorationLine: 'underline' },
  subDropdown: { backgroundColor: '#0a0a0a', borderRadius: 8, marginTop: 8, padding: 6 },
  subEmpty: { color: '#525252', fontSize: 11, padding: 6 },
  subOption: { paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#171717' },
  subOptionText: { color: '#f5f5f5', fontSize: 12 },
  exerciseNotes: { color: '#737373', fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  tableHeader: { flexDirection: 'row', marginTop: 14, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#0a0a0a', paddingBottom: 6 },
  tableHeaderText: { color: '#525252', fontSize: 9, textTransform: 'uppercase', fontWeight: '700', textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colSet: { width: 28 },
  colPrev: { width: 56, overflow: 'hidden' },
  colKg: { flex: 1, minWidth: 0, marginHorizontal: 3 },
  colReps: { flex: 1, minWidth: 0, marginHorizontal: 3 },
  colCheck: { width: 36, alignItems: 'center' },
  setNumberText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  prevText: { color: '#525252', fontSize: 9, textAlign: 'center' },
  cellInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 2, minWidth: 0, color: '#f5f5f5', fontSize: 13, textAlign: 'center' },
  cellInputDone: { opacity: 0.5 },
  checkCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#292524', alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
  restFloating: { position: 'absolute', bottom: 70, left: 16, right: 16, backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restLabel: { color: '#f97316', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  restCountdown: { color: '#f5f5f5', fontSize: 22, fontWeight: '800' },
  restAddButton: { backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#f97316' },
  restAdd: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  restSkipButton: { backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  restSkip: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  finishButton: { backgroundColor: '#f97316', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  finishButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  keyboardToolbar: { backgroundColor: '#171717', borderTopWidth: 1, borderTopColor: '#292524', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'flex-end' },
  keyboardToolbarText: { color: '#f97316', fontSize: 14, fontWeight: '700' },
  videoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  videoModalCard: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 },
  videoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#292524' },
  videoModalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 12 },
  videoModalBody: { paddingHorizontal: 18, paddingTop: 14 },
  videoModalMedia: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#0a0a0a' },
  videoModalInstructions: { color: '#d4d4d4', fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 4 },
  celebrationContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60, paddingHorizontal: 24 },
  trophyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#171717', borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  celebrationTitle: { color: '#f5f5f5', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  celebrationSubtitle: { color: '#a3a3a3', fontSize: 13, marginTop: 4, marginBottom: 24, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  statBox: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  statValue: { color: '#f97316', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#a3a3a3', fontSize: 10, marginTop: 2 },
  caloriesText: { color: '#f5f5f5', fontSize: 14, marginTop: 20, textAlign: 'center' },
  caloriesNote: { color: '#525252', fontSize: 10, marginTop: 4, textAlign: 'center', paddingHorizontal: 8, lineHeight: 14 },
  syncNote: { color: '#3b82f6', fontSize: 11, marginTop: 12, textAlign: 'center' },
  pseQuestion: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', marginTop: 28, marginBottom: 14, textAlign: 'center' },
  pseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' },
  psePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  psePillText: { fontSize: 12, fontWeight: '700' },
  notesBox: { width: '100%', marginTop: 24 },
  notesLabel: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  notesInput: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, color: '#f5f5f5', fontSize: 13, minHeight: 90, textAlignVertical: 'top' },
  finishButtonWide: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 24 },
  finishButtonText: { color: '#0a0a0a', fontSize: 16, fontWeight: '700' },
});
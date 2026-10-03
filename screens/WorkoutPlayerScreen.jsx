import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Vibration, Image, Keyboard, KeyboardAvoidingView, Pressable, Platform, InputAccessoryView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dismissKeyboardUnlessTyping } from './keyboardUtils';
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

function isStaticImageUrl(url) {
  return !!url && /\.(jpe?g|png|webp)$/i.test(url.toLowerCase().split('?')[0]);
}

function parseReps(repsStr) {
  if (!repsStr) return 10;
  const numbers = repsStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 10;
  const nums = numbers.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const isNumericReps = (v) => v != null && /^\d+$/.test(String(v).trim());

// decimal-pad shows a comma on pt-BR keyboards ("62,5"); Number() only knows the dot.
function parseLoad(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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
  { value: 4, label: 'Muito Intenso', color: '#FFFFFF' },
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
  // What the student did the last time, per `${workout_exercise_id}-${set_number}`
  // ({ load, reps }), plus `${workout_exercise_id}-last` (its last set) as the
  // reference for a set number that didn't exist last time.
  const [previousSets, setPreviousSets] = useState({});
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
            .select('workout_exercise_id, session_id, set_number, load_used_kg, reps_done, completed_at')
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

      // Rows come newest first; "last time" is the most recent session that
      // logged each exercise, so sets from different days never get mixed.
      const map = {};
      const latestSessionOf = {};
      (pastSetsData || []).forEach((row) => {
        const exId = row.workout_exercise_id;
        if (!(exId in latestSessionOf)) latestSessionOf[exId] = row.session_id;
        if (row.session_id !== latestSessionOf[exId]) return;
        const key = `${exId}-${row.set_number}`;
        if (!map[key]) map[key] = { load: row.load_used_kg, reps: row.reps_done };
        const lastKey = `${exId}-last`;
        if (!map[lastKey] || row.set_number > map[lastKey].setNumber) {
          map[lastKey] = { load: row.load_used_kg, reps: row.reps_done, setNumber: row.set_number };
        }
      });
      setPreviousSets(map);

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

  const referenceFor = (exercise, setNumber) => {
    const ref = previousSets[`${exercise.id}-${setNumber}`] || previousSets[`${exercise.id}-last`] || null;
    return ref && (ref.load != null || ref.reps) ? ref : null;
  };

  // The load shown in a set's Kg field when the student hasn't typed one:
  // what they just logged on the previous set of this exercise (so it doesn't
  // have to be retyped every set), else what they used last time, else the
  // prescribed load.
  const getLoadValue = (exercise, setNumber) => {
    const own = setLoads[`${exercise.id}-${setNumber}`];
    if (own !== undefined) return own;
    for (let i = setNumber - 1; i >= 1; i--) {
      const k = `${exercise.id}-${i}`;
      if (completedSets[k] && setLoads[k] !== undefined && setLoads[k] !== '') return setLoads[k];
    }
    const ref = referenceFor(exercise, setNumber);
    if (ref && ref.load != null) return String(ref.load);
    return exercise.load_kg != null ? String(exercise.load_kg) : '';
  };

  const handleUseReference = (exercise, setNumber) => {
    const ref = referenceFor(exercise, setNumber);
    if (!ref) return;
    const key = `${exercise.id}-${setNumber}`;
    if (ref.load != null) setSetLoads((prev) => ({ ...prev, [key]: String(ref.load) }));
    if (isNumericReps(ref.reps)) setSetReps((prev) => ({ ...prev, [key]: String(ref.reps).trim() }));
  };

  const handleCompleteSet = async (exercise, setNumber) => {
    Keyboard.dismiss();
    const key = `${exercise.id}-${setNumber}`;
    const loadValue = getLoadValue(exercise, setNumber);
    // Reps left empty are recorded as the prescription (e.g. "8-10"), same as
    // before — existing data keeps its meaning.
    const typedReps = setReps[key] !== undefined ? String(setReps[key]).trim() : '';
    const repsValue = typedReps !== '' ? typedReps : (exercise.reps || '');
    const loadNum = parseLoad(loadValue);
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

  const totalSetCount = exercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
  const doneSetCount = Object.keys(completedSets).filter((k) => completedSets[k]).length;
  // The first set not done yet, in ficha order — highlighted as "PRÓXIMA".
  let nextKey = null;
  for (const ex of exercises) {
    for (let i = 1; i <= (ex.sets || 3) && !nextKey; i++) {
      if (!completedSets[`${ex.id}-${i}`]) nextKey = `${ex.id}-${i}`;
    }
    if (nextKey) break;
  }

  const handleFinishPress = () => {
    const missing = totalSetCount - doneSetCount;
    if (missing > 0) {
      showAlert(
        'Finalizar treino?',
        `Faltam ${missing} série${missing !== 1 ? 's' : ''}. Se finalizar agora, elas não serão registradas.`,
        [
          { text: 'Continuar treinando', style: 'cancel' },
          { text: 'Finalizar mesmo assim', onPress: handleFinish },
        ]
      );
      return;
    }
    handleFinish();
  };

  const handleFinish = async () => {
    Keyboard.dismiss();
    const now = new Date();
    const elapsedMin = Math.max(1, Math.round((now - new Date(startedAt)) / 60000));

    // Tonnage uses the reps the student actually did when they entered a
    // number; a set finished with the prescription ("8-10") falls back to the
    // prescription's average, as before.
    let tonnage = 0;
    let totalSetsCompleted = 0;
    exercises.forEach((ex) => {
      const prescribedReps = parseReps(ex.reps);
      const setCount = ex.sets || 3;
      for (let i = 1; i <= setCount; i++) {
        const key = `${ex.id}-${i}`;
        if (completedSets[key]) {
          totalSetsCompleted += 1;
          const load = parseLoad(setLoads[key]) || 0;
          const repsNum = isNumericReps(setReps[key]) ? Number(setReps[key]) : prescribedReps;
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
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (showCelebration && summary) {
    return (
      <View style={{ flex: 1, backgroundColor: '#08090B' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={[styles.celebrationContainer, { paddingTop: insets.top + 40 }]}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.trophyCircle}>
            <Ionicons name="trophy-outline" size={40} color="#FFFFFF" />
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
            {savingPse ? <ActivityIndicator color="#08090B" /> : <Text style={styles.finishButtonTextWide}>Concluir</Text>}
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
      {/* Plain Pressable, not TouchableWithoutFeedback — TouchableWithoutFeedback's
          legacy responder claims the touch before it reaches nested children on
          some RN versions/platforms, which is exactly why tapping the Kg/Reps
          TextInputs below wasn't focusing them. Pressable negotiates properly and
          lets the TextInputs claim their own taps first. */}
      <Pressable onPress={dismissKeyboardUnlessTyping} style={{ flex: 1 }}>
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
              <Ionicons name="sync-outline" size={14} color="#D1D5DB" />
              <Text style={styles.syncBannerText}>Sincronizando {pendingSyncCount} registro(s)...</Text>
            </View>
          )}

          <View style={styles.progressWrap}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Progresso do treino</Text>
              <Text style={styles.progressCount}>{doneSetCount}/{totalSetCount} séries</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${totalSetCount > 0 ? Math.round((doneSetCount / totalSetCount) * 100) : 0}%` }]} />
            </View>
          </View>

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
              let exDone = 0;
              for (let i = 1; i <= setCount; i++) if (completedSets[`${ex.id}-${i}`]) exDone += 1;
              const exAllDone = exDone === setCount;

              return (
                <View key={ex.id} style={[styles.exerciseCard, exAllDone && styles.exerciseCardDone]}>
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
                            <Ionicons name="play-circle" size={20} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.exerciseSubtitle}>
                        {METHOD_LABELS[ex.execution_method] || ex.execution_method}
                        {ex.rest_time_seconds != null ? ` · ${ex.rest_time_seconds}s descanso` : ''}
                        {ex.reps ? ` · meta ${ex.reps} reps` : ''}
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
                    <View style={[styles.exCountChip, exAllDone && styles.exCountChipDone]}>
                      <Text style={[styles.exCountText, exAllDone && styles.exCountTextDone]}>{exAllDone ? '✓ ' : ''}{exDone}/{setCount}</Text>
                    </View>
                    {!isOffline && (
                      <TouchableOpacity onPress={() => handleToggleSubstitute(ex)} style={{ marginLeft: 10 }}>
                        <Ionicons name="swap-horizontal-outline" size={20} color="#A7AAB0" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {isSubOpen && (
                    <View style={styles.subDropdown}>
                      {loadingAlternatives === ex.id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" style={{ marginVertical: 8 }} />
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
                    <Text style={[styles.tableHeaderText, styles.colKg]}>Carga (kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.colReps]}>Reps feitas</Text>
                    <Text style={[styles.tableHeaderText, styles.colCheck]}> </Text>
                  </View>

                  {Array.from({ length: setCount }).map((_, i) => {
                    const setNumber = i + 1;
                    const key = `${ex.id}-${setNumber}`;
                    const done = completedSets[key];
                    const isNext = key === nextKey;
                    const ref = !done ? referenceFor(ex, setNumber) : null;
                    const loadValue = getLoadValue(ex, setNumber);
                    const repsValue = setReps[key] !== undefined ? setReps[key] : '';
                    return (
                      <View key={key} style={[styles.setRow, done && styles.setRowDone, isNext && styles.setRowNext]}>
                        <View style={styles.setMain}>
                          <View style={[styles.setBadge, done && styles.setBadgeDone]}>
                            <Text style={[styles.setNumberText, done && styles.setNumberTextDone]}>{setNumber}</Text>
                          </View>
                          <TextInput
                            style={[styles.cellInput, styles.colKg, done && styles.cellInputDone]}
                            keyboardType="decimal-pad"
                            editable={!done}
                            selectTextOnFocus
                            placeholder="-"
                            placeholderTextColor="#525252"
                            value={loadValue}
                            onChangeText={(t) => setSetLoads((prev) => ({ ...prev, [key]: t.replace(/[^0-9.,]/g, '') }))}
                            inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                            accessibilityLabel={`Carga da série ${setNumber}`}
                          />
                          <TextInput
                            style={[styles.cellInput, styles.colReps, done && styles.cellInputDone]}
                            keyboardType="numeric"
                            editable={!done}
                            selectTextOnFocus
                            placeholder={ex.reps || '-'}
                            placeholderTextColor="#525252"
                            value={repsValue}
                            onChangeText={(t) => setSetReps((prev) => ({ ...prev, [key]: t.replace(/[^0-9]/g, '') }))}
                            inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                            accessibilityLabel={`Repetições da série ${setNumber}`}
                          />
                          <TouchableOpacity
                            style={[styles.checkCircle, done && styles.checkCircleDone]}
                            onPress={() => !done && handleCompleteSet(ex, setNumber)}
                            disabled={done || savingKey === key}
                            accessibilityLabel={done ? `Série ${setNumber} concluída` : `Concluir série ${setNumber}`}
                          >
                            {savingKey === key ? (
                              <ActivityIndicator color="#08090B" size="small" />
                            ) : (
                              <Text style={styles.checkText}>{done ? '✓' : ''}</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        {!done && (isNext || ref) && (
                          <View style={styles.setSubRow}>
                            {isNext ? <Text style={styles.nextTag}>PRÓXIMA</Text> : <View />}
                            {ref && (
                              <TouchableOpacity
                                onPress={() => handleUseReference(ex, setNumber)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Usar valores da última vez"
                              >
                                <Text style={styles.refText}>
                                  Última vez: {[ref.load != null ? `${String(ref.load).replace('.', ',')} kg` : null, ref.reps ? `${ref.reps} reps` : null].filter(Boolean).join(' × ')}  ·  usar
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
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

          <TouchableOpacity style={styles.finishButton} onPress={handleFinishPress}>
            <Text style={styles.finishButtonText}>Finalizar Treino</Text>
          </TouchableOpacity>
        </View>
      </Pressable>

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
                <Ionicons name="close" size={24} color="#A7AAB0" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.videoModalBody}>
              {videoModalFor?.exercises?.video_url ? (
                isGifUrl(videoModalFor.exercises.video_url) || isStaticImageUrl(videoModalFor.exercises.video_url) ? (
                  <Image source={{ uri: videoModalFor.exercises.video_url }} style={styles.videoModalMedia} resizeMode="contain" />
                ) : getYoutubeVideoId(videoModalFor.exercises.video_url) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeVideoId(videoModalFor.exercises.video_url)}?autoplay=1&playsinline=1`}
                    style={{ width: '100%', height: 220, border: 0, backgroundColor: '#08090B', borderRadius: 10 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={videoModalFor.exercises.video_url}
                    style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: '#08090B' }}
                    controls
                    autoPlay
                    loop
                  />
                )
              ) : !videoModalFor?.exercises?.instructions ? (
                <View style={styles.noMediaBox}>
                  <Ionicons name="film-outline" size={28} color="#525252" />
                  <Text style={styles.noMediaText}>Demonstração em breve</Text>
                </View>
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
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#08090B', alignItems: 'center', justifyContent: 'center' },
  phaseTopBadge: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 10 },
  phaseTopBadgeText: { color: '#D1D5DB', fontSize: 11, fontWeight: '700' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.12)', marginHorizontal: 16, borderRadius: 8, padding: 10, marginBottom: 10 },
  offlineBannerText: { color: '#ef4444', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16, borderRadius: 8, padding: 10, marginBottom: 10 },
  syncBannerText: { color: '#D1D5DB', fontSize: 11, fontWeight: '600' },
  exerciseCard: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 44, height: 44, borderRadius: 10, marginRight: 10 },
  thumbPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#08090B', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  thumbPlaceholderText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  videoIconButton: { padding: 2 },
  exerciseSubtitle: { color: '#FFFFFF', fontSize: 10, marginTop: 2 },
  subTagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  subTag: { color: '#22c55e', fontSize: 9 },
  subCancelText: { color: '#ef4444', fontSize: 9, textDecorationLine: 'underline' },
  subDropdown: { backgroundColor: '#08090B', borderRadius: 8, marginTop: 8, padding: 6 },
  subEmpty: { color: '#525252', fontSize: 11, padding: 6 },
  subOption: { paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#121419' },
  subOptionText: { color: '#FFFFFF', fontSize: 12 },
  exerciseNotes: { color: '#737373', fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  progressWrap: { marginHorizontal: 16, marginBottom: 10 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#A7AAB0', fontSize: 11, fontWeight: '600' },
  progressCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#292D34', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  exerciseCardDone: { borderColor: '#22c55e' },
  exCountChip: { borderWidth: 1, borderColor: '#292D34', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  exCountChipDone: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)' },
  exCountText: { color: '#A7AAB0', fontSize: 11, fontWeight: '800' },
  exCountTextDone: { color: '#22c55e' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 6, paddingHorizontal: 8 },
  tableHeaderText: { color: '#737373', fontSize: 10, textTransform: 'uppercase', fontWeight: '700', textAlign: 'center' },
  setRow: { borderWidth: 1, borderColor: 'transparent', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  setRowDone: { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.45)' },
  setRowNext: { borderColor: '#FFFFFF', backgroundColor: '#181B21' },
  setMain: { flexDirection: 'row', alignItems: 'center' },
  setSubRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingLeft: 38 },
  nextTag: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  refText: { color: '#A7AAB0', fontSize: 12, fontWeight: '600' },
  colSet: { width: 30 },
  colKg: { flex: 1, minWidth: 0, marginHorizontal: 4 },
  colReps: { flex: 1, minWidth: 0, marginHorizontal: 4 },
  colCheck: { width: 44, alignItems: 'center' },
  setBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#08090B', alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  setBadgeDone: { backgroundColor: 'rgba(34,197,94,0.2)' },
  setNumberText: { color: '#A7AAB0', fontSize: 14, fontWeight: '800' },
  setNumberTextDone: { color: '#22c55e' },
  cellInput: { backgroundColor: '#08090B', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 10, height: 48, paddingHorizontal: 4, minWidth: 0, color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  cellInputDone: { backgroundColor: 'transparent', borderColor: 'transparent', color: '#FFFFFF' },
  checkCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#5A6070', alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkText: { color: '#08090B', fontSize: 20, fontWeight: '800' },
  restFloating: { position: 'absolute', bottom: 70, left: 16, right: 16, backgroundColor: '#121419', borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  restCountdown: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  restAddButton: { backgroundColor: '#08090B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#FFFFFF' },
  restAdd: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  restSkipButton: { backgroundColor: '#08090B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  restSkip: { color: '#A7AAB0', fontSize: 12, fontWeight: '600' },
  finishButton: { backgroundColor: '#FFFFFF', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  finishButtonText: { color: '#08090B', fontSize: 15, fontWeight: '700' },
  keyboardToolbar: { backgroundColor: '#121419', borderTopWidth: 1, borderTopColor: '#292D34', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'flex-end' },
  keyboardToolbarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  videoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  videoModalCard: { backgroundColor: '#121419', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 24 },
  videoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#292D34' },
  videoModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 12 },
  videoModalBody: { paddingHorizontal: 18, paddingTop: 14 },
  videoModalMedia: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#08090B' },
  noMediaBox: { width: '100%', height: 140, borderRadius: 10, backgroundColor: '#08090B', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noMediaText: { color: '#525252', fontSize: 12, fontWeight: '600' },
  videoModalInstructions: { color: '#d4d4d4', fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 4 },
  celebrationContainer: { flex: 1, backgroundColor: '#08090B', paddingTop: 60, paddingHorizontal: 24 },
  trophyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#121419', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  celebrationTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  celebrationSubtitle: { color: '#A7AAB0', fontSize: 13, marginTop: 4, marginBottom: 24, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  statBox: { flex: 1, backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#A7AAB0', fontSize: 10, marginTop: 2 },
  caloriesText: { color: '#FFFFFF', fontSize: 14, marginTop: 20, textAlign: 'center' },
  caloriesNote: { color: '#525252', fontSize: 10, marginTop: 4, textAlign: 'center', paddingHorizontal: 8, lineHeight: 14 },
  syncNote: { color: '#D1D5DB', fontSize: 11, marginTop: 12, textAlign: 'center' },
  pseQuestion: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 28, marginBottom: 14, textAlign: 'center' },
  pseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' },
  psePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  psePillText: { fontSize: 12, fontWeight: '700' },
  notesBox: { width: '100%', marginTop: 24 },
  notesLabel: { color: '#A7AAB0', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  notesInput: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 13, minHeight: 90, textAlignVertical: 'top' },
  finishButtonWide: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 24 },
  finishButtonTextWide: { color: '#08090B', fontSize: 16, fontWeight: '700' },
});
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './supabaseClient';
import AddExerciseModal from './AddExerciseModal';
import EditExerciseModal from './EditExerciseModal';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { loadPeriodizationPlan, getCurrentPhase } from './periodizationUtils';
import { copySessionToStudentWorkout } from './workoutAssignment';
import { showAlert, describeFunctionError } from './alertUtils';
import {
  loadWeekHistory,
  loadWorkoutSummaries,
  createNewWeekVersion,
  duplicateWorkout,
  estimateExerciseVolumeKg,
} from './workoutVersioning';
import { useSpeechToText } from './useSpeechToText';
import PromptModal from './PromptModal';
import { HeaderBack } from './Header';

const FICHA_NAME_SUGGESTIONS = [
  'Treino A - Quadríceps',
  'Treino B - Posterior/Glúteos',
  'Treino C - Peito/Tríceps',
  'Treino D - Costas/Bíceps',
  'Treino Full Body',
];

// value matches JS Date.getDay() (0 = Sunday), so "today's ficha" can later
// be found with a plain === check — ordered Mon→Sun here only for display.
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];
const WEEKDAY_SHORT = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

export default function WorkoutBuilderScreen({ studentId, studentName, personalId, onClose, initialWorkoutId }) {
  const [workouts, setWorkouts] = useState([]);
  const [activeWorkoutId, setActiveWorkoutId] = useState(initialWorkoutId || null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [watchingVideo, setWatchingVideo] = useState(null);
  const [showReplicateModal, setShowReplicateModal] = useState(false);
  const [replicateSets, setReplicateSets] = useState('4');
  const [replicateReps, setReplicateReps] = useState('10-12');
  const [replicateRest, setReplicateRest] = useState('60');
  const [replicating, setReplicating] = useState(false);

  const [showSendModal, setShowSendModal] = useState(false);
  const [otherStudents, setOtherStudents] = useState([]);
  const [loadingOtherStudents, setLoadingOtherStudents] = useState(false);
  const [sendingCopy, setSendingCopy] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState([]);

  const [periodizationPlan, setPeriodizationPlan] = useState(null);
  const [periodizationPhases, setPeriodizationPhases] = useState([]);
  const [showPhasePicker, setShowPhasePicker] = useState(false);
  const [showWeekdayPicker, setShowWeekdayPicker] = useState(false);

  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState(null);

  const [newFichaName, setNewFichaName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreateFichaModal, setShowCreateFichaModal] = useState(false);
  const [renamingWorkout, setRenamingWorkout] = useState(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);

  // "Semana Atual" landing — shown whenever no specific ficha is selected
  // (activeWorkoutId null), so opening Treino never dumps the personal
  // straight into one ficha's full exercise editor. Reuses the exact same
  // version-history system Planejamento da Semana/Programa de Treino use —
  // see workoutVersioning.js — instead of a second one.
  const [weekSummaries, setWeekSummaries] = useState({});
  const [weekHistory, setWeekHistory] = useState([]);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [showOtherWeekPicker, setShowOtherWeekPicker] = useState(false);

  // "Trocar exercício" — reuses AddExerciseModal's browse UI, but on
  // confirm it replaces replacingItem's exercise in place instead of
  // inserting a new row.
  const [replacingItem, setReplacingItem] = useState(null);

  const loadWorkouts = async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, phase_id, weekday')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at', { ascending: true });
    setWorkouts(data || []);
    // Unlike before, an empty/invalid selection no longer falls back to
    // the first ficha — it falls back to null, which shows the "Semana
    // Atual" overview instead of silently dumping into Treino A. Picking a
    // ficha (from the overview, a tab, or an initialWorkoutId prop) is
    // always an explicit choice.
    if (data && data.length > 0) {
      setActiveWorkoutId((prev) => (prev && data.some((w) => w.id === prev)) ? prev : null);
    } else {
      setActiveWorkoutId(null);
    }
    const ids = (data || []).map((w) => w.id);
    setWeekSummaries(await loadWorkoutSummaries(supabase, ids));
  };

  const loadWeekHistoryList = async () => {
    setWeekHistory(await loadWeekHistory(supabase, studentId));
  };

  // "+ Nova Semana" — the same createNewWeekVersion versioning system
  // Planejamento da Semana/Programa de Treino use: it archives every
  // current ficha (active:false, archived_at, weekday cleared) and creates
  // fresh ones tagged with previous_version_id/version_group_id, so history
  // and progression lookups keep working across the new week.
  const handleNewWeek = () => {
    if (workouts.length === 0) {
      setShowCreateFichaModal(true);
      return;
    }
    showAlert(
      'Como deseja criar a nova semana?',
      null,
      [
        { text: 'Copiar semana anterior', onPress: () => runNewWeek('copy-current') },
        { text: 'Usar outra semana como base', onPress: () => setShowOtherWeekPicker(true) },
        { text: 'Começar do zero', onPress: () => runNewWeek('scratch') },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const runNewWeek = async (mode, sourceWorkouts = []) => {
    setCreatingWeek(true);
    try {
      const result = await createNewWeekVersion(supabase, { studentId, personalId, mode, sourceWorkouts });
      await loadWorkouts();
      await loadWeekHistoryList();
      if (result.unmatchedNames?.length > 0) {
        showAlert(
          'Semana criada, mas com atenção',
          `"${result.unmatchedNames.join('", "')}" não tinha uma ficha com o mesmo nome na semana escolhida como base, então foi criada em branco. Adicione os exercícios manualmente.`
        );
      }
    } catch (e) {
      console.error('Erro ao criar nova semana:', e);
      showAlert('Ops', 'Não foi possível criar a nova semana agora. Tenta de novo em instantes.');
    }
    setCreatingWeek(false);
  };

  const handlePickOtherWeek = async (group) => {
    setShowOtherWeekPicker(false);
    await runNewWeek('other-week', group.workouts);
  };

  const loadItems = async (workoutId) => {
    if (!workoutId) { setItems([]); return; }
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes, exercises (id, name, muscle_group, thumbnail_url, video_url)')
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true });
    setItems(data || []);
  };

  const loadPeriodization = async () => {
    const { plan, phases } = await loadPeriodizationPlan(supabase, studentId);
    setPeriodizationPlan(plan);
    setPeriodizationPhases(phases);
  };

  useEffect(() => {
    (async () => {
      await loadWorkouts();
      await loadPeriodization();
      await loadWeekHistoryList();
      setLoading(false);
    })();
  }, [studentId]);

  useEffect(() => {
    if (activeWorkoutId) loadItems(activeWorkoutId);
    else setItems([]);
  }, [activeWorkoutId]);

  const handleCreateFicha = async () => {
    if (!newFichaName.trim()) {
      showAlert('Ops', 'Dá um nome pra ficha (ex: "1 MMII ÊNFASE").');
      return;
    }
    const currentPhase = getCurrentPhase(periodizationPlan, periodizationPhases);
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        student_id: studentId,
        personal_id: personalId,
        name: newFichaName.trim(),
        active: true,
        phase_id: currentPhase ? currentPhase.phase.id : null,
      })
      .select()
      .single();
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    setNewFichaName('');
    setShowCreateFichaModal(false);
    await loadWorkouts();
    setActiveWorkoutId(data.id);
  };

  const handleRenameFicha = (workout) => {
    setRenamingWorkout(workout);
  };

  const handleConfirmRename = async (newName) => {
    const workout = renamingWorkout;
    setRenamingWorkout(null);
    const { error } = await supabase.from('workouts').update({ name: newName }).eq('id', workout.id);
    if (error) showAlert('Erro', error.message);
    else loadWorkouts();
  };

  const handleDeleteFicha = (workout) => {
    showAlert(
      'Arquivar ficha',
      `Arquivar "${workout.name}"? Ela sai da lista de fichas ativas, mas o histórico de treinos do aluno com ela continua preservado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('workouts')
              .update({ active: false, archived_at: new Date().toISOString(), weekday: null })
              .eq('id', workout.id);
            if (error) {
              showAlert('Erro', error.message);
            } else {
              if (activeWorkoutId === workout.id) setActiveWorkoutId(null);
              await loadWorkouts();
            }
          },
        },
      ]
    );
  };

  const handleDuplicateFicha = async (workout) => {
    if (saving) return;
    setSaving(true);
    try {
      const newWorkout = await duplicateWorkout(supabase, workout, { studentId, personalId });
      await loadWorkouts();
      setActiveWorkoutId(newWorkout.id);
      showAlert('Feito!', `Ficha duplicada como "${newWorkout.name}".`);
    } catch (e) {
      showAlert('Erro', e?.message || 'Não foi possível duplicar a ficha.');
    }
    setSaving(false);
  };

  const handleLongPressFicha = (workout) => {
    showAlert(
      workout.name,
      'O que você quer fazer com essa ficha?',
      [
        { text: 'Renomear', onPress: () => handleRenameFicha(workout) },
        { text: 'Duplicar', onPress: () => handleDuplicateFicha(workout) },
        { text: 'Arquivar', style: 'destructive', onPress: () => handleDeleteFicha(workout) },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleSelectPhaseForFicha = async (phaseId) => {
    if (!activeWorkoutId) return;
    const { error } = await supabase.from('workouts').update({ phase_id: phaseId }).eq('id', activeWorkoutId);
    setShowPhasePicker(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      loadWorkouts();
    }
  };

  const handleSelectWeekdayForFicha = async (weekday) => {
    if (!activeWorkoutId) return;
    const { error } = await supabase.from('workouts').update({ weekday }).eq('id', activeWorkoutId);
    setShowWeekdayPicker(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      loadWorkouts();
    }
  };

  const handleOpenSendModal = async () => {
    if (!activeWorkoutId) {
      showAlert('Ops', 'Seleciona uma ficha primeiro.');
      return;
    }
    if (items.length === 0) {
      showAlert('Ops', 'Essa ficha ainda não tem exercícios.');
      return;
    }
    setSelectedTargets([]);
    setShowSendModal(true);
    setLoadingOtherStudents(true);
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('personal_id', personalId)
      .eq('role', 'aluno')
      .neq('id', studentId)
      .order('name');
    setOtherStudents(data || []);
    setLoadingOtherStudents(false);
  };

  const handleToggleTarget = (student) => {
    setSelectedTargets((prev) =>
      prev.some((s) => s.id === student.id)
        ? prev.filter((s) => s.id !== student.id)
        : [...prev, student]
    );
  };

  const handleConfirmSend = async () => {
    if (selectedTargets.length === 0) {
      showAlert('Ops', 'Escolhe pelo menos um aluno.');
      return;
    }
    setSendingCopy(true);

    const currentWorkout = workouts.find((w) => w.id === activeWorkoutId);
    const { data: originalItems } = await supabase
      .from('workout_exercises')
      .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
      .eq('workout_id', activeWorkoutId);

    let successCount = 0;
    for (const target of selectedTargets) {
      const { data: newWorkout, error } = await supabase
        .from('workouts')
        .insert({ student_id: target.id, personal_id: personalId, name: currentWorkout?.name || 'Ficha', active: true })
        .select()
        .single();

      if (!error && newWorkout && originalItems && originalItems.length > 0) {
        const copies = originalItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
        await supabase.from('workout_exercises').insert(copies);
        successCount += 1;
      }
    }

    setSendingCopy(false);
    setShowSendModal(false);
    showAlert('Enviado!', `Ficha copiada para ${successCount} aluno${successCount !== 1 ? 's' : ''}.`);
  };

  const handleOpenTemplatePicker = async () => {
    setShowTemplatePicker(true);
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, description')
      .eq('personal_id', personalId)
      .eq('archived', false)
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    setLoadingTemplates(false);
  };

  const handleApplyTemplate = async (template) => {
    setApplyingTemplateId(template.id);
    const currentPhase = getCurrentPhase(periodizationPlan, periodizationPhases);

    // A template can have several sessions (Treino A, B, C...) — each one
    // becomes its own workout for the student, instead of merging every
    // session's exercises into a single flat ficha.
    const { data: sessions } = await supabase
      .from('template_sessions')
      .select('id, name, order_index')
      .eq('template_id', template.id)
      .order('order_index', { ascending: true });

    if (!sessions || sessions.length === 0) {
      setApplyingTemplateId(null);
      showAlert('Erro', 'Esse template não tem nenhuma sessão configurada.');
      return;
    }

    let firstWorkoutId = null;
    let totalExercises = 0;

    for (const session of sessions) {
      try {
        const { workout, exerciseCount } = await copySessionToStudentWorkout(supabase, {
          sessionId: session.id,
          sessionName: session.name,
          studentId,
          personalId,
          phaseId: currentPhase ? currentPhase.phase.id : null,
        });
        if (!firstWorkoutId) firstWorkoutId = workout.id;
        totalExercises += exerciseCount;
      } catch {
        continue;
      }
    }

    setApplyingTemplateId(null);
    setShowTemplatePicker(false);
    await loadWorkouts();
    if (firstWorkoutId) setActiveWorkoutId(firstWorkoutId);
    showAlert('Aplicado!', `"${template.name}" criado com ${sessions.length} sessão(ões) e ${totalExercises} exercício(s) no total.`);
  };

  const handleOpenAiModal = () => {
    setAiInstruction('');
    setShowAiModal(true);
  };

  const { recording: aiRecording, toggle: handleToggleAiRecording } = useSpeechToText({
    active: showAiModal,
    getBaseText: () => aiInstruction,
    onTranscriptChange: setAiInstruction,
  });

  const handleGenerateWorkoutWithAi = async () => {
    if (!aiInstruction.trim()) {
      showAlert('Ops', 'Descreve o treino que você quer gerar (ex: "treino de quadríceps, 5 exercícios, 4 séries de 10 a 12").');
      return;
    }
    setAiProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-workout', {
        body: { instruction: aiInstruction.trim() },
      });

      if (error || data?.error) {
        showAlert('Não deu pra gerar o treino', await describeFunctionError(error, data, 'Tenta de novo em alguns instantes.'));
        setAiProcessing(false);
        return;
      }

      if (!data.exercises || data.exercises.length === 0) {
        showAlert('Nenhum exercício reconhecido', 'A IA não conseguiu combinar o pedido com exercícios da sua biblioteca. Tenta descrever de outro jeito.');
        setAiProcessing(false);
        return;
      }

      const currentPhase = getCurrentPhase(periodizationPlan, periodizationPhases);
      const { data: newWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          student_id: studentId,
          personal_id: personalId,
          name: data.workout_name || 'Treino Gerado por IA',
          active: true,
          phase_id: currentPhase ? currentPhase.phase.id : null,
        })
        .select()
        .single();

      if (workoutError || !newWorkout) {
        showAlert('Erro', workoutError?.message || 'Não foi possível criar a ficha.');
        setAiProcessing(false);
        return;
      }

      const rows = data.exercises.map((ex, index) => ({
        workout_id: newWorkout.id,
        exercise_id: ex.exercise_id,
        order_index: index,
        sets: ex.sets,
        reps: ex.reps,
        rest_time_seconds: ex.rest_time_seconds,
      }));
      await supabase.from('workout_exercises').insert(rows);

      setAiProcessing(false);
      setShowAiModal(false);
      await loadWorkouts();
      setActiveWorkoutId(newWorkout.id);
      // requested_count can be higher than rows.length when the AI named an
      // exercise slightly differently than the library despite instructions
      // to copy it exactly — tell the personal instead of leaving a
      // silently-shorter ficha for them to notice later.
      const skipped = (data.requested_count || rows.length) - rows.length;
      showAlert(
        'Treino gerado!',
        `"${newWorkout.name}" criado com ${rows.length} exercício(s). Revisa e ajusta o que quiser antes de salvar.` +
          (skipped > 0 ? `\n\n${skipped} exercício(s) sugerido(s) pela IA não foram encontrados na sua biblioteca e ficaram de fora.` : '')
      );
    } catch (e) {
      // The ficha being edited (if any) is untouched by anything above —
      // an AI failure never costs work already in progress, only the
      // ability to generate this one new ficha right now.
      console.error('Erro ao gerar treino com IA:', e);
      setAiProcessing(false);
      showAlert('Não deu pra gerar o treino', 'Algo deu errado do nosso lado ao falar com a IA. Você pode montar esse treino manualmente enquanto isso — tenta a IA de novo daqui a pouco.');
    }
  };

  const handleConfirmAddExercise = async (exercise, config) => {
    if (!activeWorkoutId) {
      showAlert('Ops', 'Cria ou seleciona uma ficha primeiro.');
      return;
    }

    const { data: maxRow } = await supabase
      .from('workout_exercises')
      .select('order_index')
      .eq('workout_id', activeWorkoutId)
      .order('order_index', { ascending: false })
      .limit(1);
    const nextOrder = maxRow && maxRow.length > 0 ? maxRow[0].order_index + 1 : 0;

    const { error } = await supabase.from('workout_exercises').insert({
      workout_id: activeWorkoutId,
      exercise_id: exercise.id,
      order_index: nextOrder,
      ...config,
    });
    if (error) {
      showAlert('Erro ao adicionar', error.message);
    } else {
      setShowAddModal(false);
      loadItems(activeWorkoutId);
    }
  };

  // Shared by "Excluir" and "Trocar exercício": both would otherwise
  // corrupt or destroy the student's logged history if applied to a row
  // that already has workout_session_sets against it — deleting wipes it
  // via the FK cascade, and swapping in place would silently reattribute
  // it to the new exercise's progression lookup. "+ Nova Semana" is the
  // safe path once a row has real history.
  const hasLoggedHistory = async (itemId) => {
    const { count } = await supabase
      .from('workout_session_sets')
      .select('id', { count: 'exact', head: true })
      .eq('workout_exercise_id', itemId);
    return !!count && count > 0;
  };

  const handleRemoveItem = async (itemId) => {
    if (await hasLoggedHistory(itemId)) {
      showAlert(
        'Não é possível remover',
        'Esse exercício já tem histórico de execução registrado pelo aluno. Removê-lo apagaria esse histórico permanentemente. Se a prescrição mudou, crie uma nova semana em vez de editar esta.'
      );
      return;
    }

    showAlert('Remover exercício', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((it) => it.id !== itemId));
          const { error } = await supabase.from('workout_exercises').delete().eq('id', itemId);
          if (error) {
            showAlert('Erro ao remover', error.message);
            loadItems(activeWorkoutId);
          }
        },
      },
    ]);
  };

  const handleDuplicateItem = async (item) => {
    const { data: maxRow } = await supabase
      .from('workout_exercises')
      .select('order_index')
      .eq('workout_id', activeWorkoutId)
      .order('order_index', { ascending: false })
      .limit(1);
    const nextOrder = maxRow && maxRow.length > 0 ? maxRow[0].order_index + 1 : 0;
    const { error } = await supabase.from('workout_exercises').insert({
      workout_id: activeWorkoutId,
      exercise_id: item.exercise_id || item.exercises?.id,
      order_index: nextOrder,
      sets: item.sets,
      reps: item.reps,
      load_kg: item.load_kg,
      cadence: item.cadence,
      rest_time_seconds: item.rest_time_seconds,
      execution_method: item.execution_method,
      notes: item.notes,
    });
    if (error) showAlert('Erro ao duplicar', error.message);
    else loadItems(activeWorkoutId);
  };

  const handleOpenSwap = async (item) => {
    if (await hasLoggedHistory(item.id)) {
      showAlert(
        'Não é possível trocar',
        'Esse exercício já tem histórico de execução registrado pelo aluno. Trocá-lo misturaria o histórico com o exercício novo. Se a prescrição mudou, crie uma nova semana em vez de editar esta.'
      );
      return;
    }
    setReplacingItem(item);
  };

  const handleConfirmSwap = async (exercise, config) => {
    const { error } = await supabase.from('workout_exercises').update({ exercise_id: exercise.id, ...config }).eq('id', replacingItem.id);
    setReplacingItem(null);
    if (error) showAlert('Erro ao trocar', error.message);
    else loadItems(activeWorkoutId);
  };

  const handleOpenItemActions = (item) => {
    showAlert(item.exercises?.name || 'Exercício', 'O que você quer fazer?', [
      { text: 'Trocar exercício', onPress: () => handleOpenSwap(item) },
      { text: 'Duplicar exercício', onPress: () => handleDuplicateItem(item) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleRemoveItem(item.id) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // Drag-to-reorder (DraggableFlatList's onDragEnd): the dropped array is
  // already in its final order, so order_index just becomes each item's new
  // position.
  const handleReorderComplete = async ({ data }) => {
    setItems(data);
    await Promise.all(data.map((item, idx) => supabase.from('workout_exercises').update({ order_index: idx }).eq('id', item.id)));
  };

  const handleSaveEditItem = async (config) => {
    const { error } = await supabase.from('workout_exercises').update(config).eq('id', editingItem.id);
    setEditingItem(null);
    if (error) {
      showAlert('Erro ao salvar', error.message);
    } else {
      loadItems(activeWorkoutId);
    }
  };

  const handleOpenReplicate = () => {
    if (items.length === 0) {
      showAlert('Ops', 'Ainda não tem exercício nessa ficha pra aplicar valores.');
      return;
    }
    setShowReplicateModal(true);
  };

  const handleConfirmReplicate = async () => {
    setReplicating(true);
    const updates = {};
    if (replicateSets.trim()) updates.sets = Number(replicateSets);
    if (replicateReps.trim()) updates.reps = replicateReps.trim();
    if (replicateRest.trim()) updates.rest_time_seconds = Number(replicateRest);

    const { error } = await supabase
      .from('workout_exercises')
      .update(updates)
      .eq('workout_id', activeWorkoutId);

    setReplicating(false);
    setShowReplicateModal(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      loadItems(activeWorkoutId);
    }
  };

  const muscleGroupCounts = {};
  items.forEach((item) => {
    const group = item.exercises?.muscle_group || 'outro';
    muscleGroupCounts[group] = (muscleGroupCounts[group] || 0) + 1;
  });
  const muscleGroupEntries = Object.entries(muscleGroupCounts);
  // Dominant group in the ficha so far — used to prioritize "mesmo grupo
  // muscular" suggestions when adding a new exercise (swapping one uses
  // that specific exercise's own group instead, see handleOpenSwap).
  const dominantMuscleGroup = muscleGroupEntries.length > 0
    ? muscleGroupEntries.sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const totalSets = items.reduce((sum, item) => sum + (item.sets || 3), 0);
  const totalVolumeKg = Math.round(items.reduce((sum, item) => sum + estimateExerciseVolumeKg(item), 0));

  const activeWorkout = workouts.find((w) => w.id === activeWorkoutId);

  let phaseProgress = null;
  if (activeWorkout && activeWorkout.phase_id && periodizationPlan) {
    const idx = periodizationPhases.findIndex((p) => p.id === activeWorkout.phase_id);
    if (idx !== -1) {
      let cumulative = 0;
      for (let j = 0; j < idx; j++) cumulative += periodizationPhases[j].duration_weeks;
      const phase = periodizationPhases[idx];
      const startWeek = cumulative + 1;
      const endWeek = cumulative + phase.duration_weeks;
      const current = getCurrentPhase(periodizationPlan, periodizationPhases);
      const isCurrent = current && current.phase.id === phase.id;
      phaseProgress = {
        phaseName: phase.name,
        isCurrent,
        weekInPhase: isCurrent ? current.weekInPhase : null,
        totalWeeksInPhase: phase.duration_weeks,
        startWeek,
        endWeek,
      };
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B00" />
      </View>
    );
  }

  if (showAddModal) {
    return (
      <AddExerciseModal
        personalId={personalId}
        studentId={studentId}
        suggestedMuscleGroup={dominantMuscleGroup}
        onConfirm={handleConfirmAddExercise}
        onClose={() => setShowAddModal(false)}
      />
    );
  }

  if (replacingItem) {
    return (
      <AddExerciseModal
        personalId={personalId}
        studentId={studentId}
        suggestedMuscleGroup={replacingItem.exercises?.muscle_group}
        replaceItem={replacingItem}
        onConfirm={handleConfirmSwap}
        onClose={() => setReplacingItem(null)}
      />
    );
  }

  if (watchingVideo) {
    return (
      <ExerciseVideoScreen
        videoUrl={watchingVideo.url}
        exerciseName={watchingVideo.name}
        onClose={() => setWatchingVideo(null)}
      />
    );
  }

  if (editingItem) {
    return (
      <EditExerciseModal
        item={editingItem}
        studentId={studentId}
        onSave={handleSaveEditItem}
        onClose={() => setEditingItem(null)}
      />
    );
  }

  // Compact single-line metrics ("4 séries · 8–10 reps · 90s"), extended
  // inline with load/cadência/método only when actually set, instead of the
  // old pill grid — same data, much less visual weight per card.
  const formatCompactMetrics = (item) => {
    const parts = [`${item.sets || 3} séries`, `${item.reps || '-'} reps`];
    if (item.rest_time_seconds != null) parts.push(`${item.rest_time_seconds}s`);
    if (item.load_kg != null) parts.push(`${item.load_kg}kg`);
    if (item.cadence) parts.push(`cad. ${item.cadence}`);
    if (item.execution_method && item.execution_method !== 'tradicional') {
      parts.push(METHOD_LABELS[item.execution_method] || item.execution_method);
    }
    return parts.join(' · ');
  };

  // Ultra-compact: a numbered row (name + one metrics line), no inline
  // thumbnail/video — media only opens on demand via "Ver execução", so the
  // list of a 6-8 exercise ficha fits on screen without scrolling past
  // images, per the "rapidez > visual" priority.
  const renderExerciseItem = ({ item, getIndex, drag, isActive }) => {
    const index = getIndex();
    const hasVideo = !!item.exercises?.video_url;

    return (
      <View style={[styles.exerciseCard, isActive && styles.exerciseCardDragging]}>
        <Text style={styles.exerciseIndex}>{String(index + 1).padStart(2, '0')}</Text>

        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{item.exercises?.name}</Text>
          <Text style={styles.exerciseMetrics}>{formatCompactMetrics(item)}</Text>
          {item.notes ? <Text style={styles.exerciseNotes}>📝 {item.notes}</Text> : null}
          {hasVideo && (
            <TouchableOpacity onPress={() => setWatchingVideo({ url: item.exercises.video_url, name: item.exercises.name })}>
              <Text style={styles.watchLink}>▶ Ver execução</Text>
            </TouchableOpacity>
          )}

          <View style={styles.exerciseActionsRow}>
            <TouchableOpacity hitSlop={10} onLongPress={drag} disabled={isActive} style={styles.dragHandleButton}>
              <Ionicons name="reorder-three-outline" size={20} color="#a3a3a3" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.exerciseActionButton} onPress={() => setEditingItem(item)}>
              <Ionicons name="pencil-outline" size={14} color="#3b82f6" />
              <Text style={styles.exerciseActionButtonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exerciseActionButton} onPress={() => handleOpenItemActions(item)}>
              <Ionicons name="ellipsis-horizontal" size={14} color="#a3a3a3" />
              <Text style={styles.exerciseActionButtonText}>Mais</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // "Semana Atual" landing — the primary entry point now (items 1/9/16 of
  // the redesign): pick a ficha here instead of always dropping into
  // Treino A. Nova Ficha/Template/IA sit below as secondary, auxiliary
  // actions, never the main flow.
  const weekOverviewHeader = (
    <>
      <Text style={styles.sectionTitle}>SEMANA ATUAL</Text>

      {workouts.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma ficha ainda pra {studentName}.</Text>
      ) : (
        workouts.map((w) => {
          const s = weekSummaries[w.id] || { exerciseCount: 0, setCount: 0, muscleGroups: [] };
          return (
            <TouchableOpacity
              key={w.id}
              style={styles.weekOverviewCard}
              onPress={() => setActiveWorkoutId(w.id)}
              onLongPress={() => handleLongPressFicha(w)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.weekOverviewCardName}>{w.name}</Text>
                <Text style={styles.weekOverviewCardMeta}>
                  {w.weekday != null ? `${WEEKDAY_OPTIONS.find((d) => d.value === w.weekday)?.label} · ` : ''}
                  {s.exerciseCount} exercício{s.exerciseCount !== 1 ? 's' : ''} · {s.setCount} série{s.setCount !== 1 ? 's' : ''}
                </Text>
                {s.muscleGroups.length > 0 && <Text style={styles.weekOverviewCardMuscles}>{s.muscleGroups.join(' + ')}</Text>}
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity
        style={styles.newWeekButton}
        onPress={workouts.length === 0 ? () => setShowCreateFichaModal(true) : handleNewWeek}
        disabled={creatingWeek}
      >
        {creatingWeek ? (
          <ActivityIndicator color="#0F0F12" size="small" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={18} color="#0F0F12" />
            <Text style={styles.newWeekButtonText}>{workouts.length === 0 ? '+ Criar Primeira Ficha' : '+ NOVA SEMANA'}</Text>
          </>
        )}
      </TouchableOpacity>
      {workouts.length > 0 && (
        <Text style={styles.hintText}>Segure uma ficha pra renomear, duplicar ou arquivar</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsRow} contentContainerStyle={styles.actionsRowContent}>
        <TouchableOpacity style={styles.actionChip} onPress={() => setShowCreateFichaModal(true)}>
          <Text style={styles.actionChipText}>+ Nova Ficha</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={handleOpenTemplatePicker}>
          <Text style={styles.actionChipText}>⚡ Importar Template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={handleOpenAiModal}>
          <Text style={styles.actionChipText}>✨ Gerar Treino com IA</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );

  // Inside a specific ficha's editor — unchanged apart from the compact
  // resumo replacing the old separate weekday/muscle-summary rows, and
  // "+ Nova Ficha"/Template/IA moving to the overview above.
  const activeWorkoutMuscles = muscleGroupEntries.slice().sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
  const editorHeader = (
    <>
      <TouchableOpacity style={styles.backToOverviewButton} onPress={() => setActiveWorkoutId(null)}>
        <Ionicons name="chevron-back" size={16} color="#a3a3a3" />
        <Text style={styles.backToOverviewButtonText}>Semana Atual</Text>
      </TouchableOpacity>

      <View style={styles.fichaRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {workouts.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.fichaTab, activeWorkoutId === w.id && styles.fichaTabActive]}
              onPress={() => setActiveWorkoutId(w.id)}
              onLongPress={() => handleLongPressFicha(w)}
            >
              <Text style={[styles.fichaTabText, activeWorkoutId === w.id && styles.fichaTabTextActive]}>{w.name}</Text>
              {w.weekday != null && (
                <Text style={[styles.fichaTabWeekday, activeWorkoutId === w.id && styles.fichaTabWeekdayActive]}>{WEEKDAY_SHORT[w.weekday]}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.compactSummaryCard}>
        <Text style={styles.compactSummaryTitle}>
          {activeWorkout?.name}{activeWorkoutMuscles.length > 0 ? ` — ${activeWorkoutMuscles.join(' + ')}` : ''}
        </Text>
        <Text style={styles.compactSummaryMeta}>
          {items.length} exercício{items.length !== 1 ? 's' : ''} · {totalSets} série{totalSets !== 1 ? 's' : ''} totais
          {totalVolumeKg > 0 ? ` · ${totalVolumeKg.toLocaleString('pt-BR')}kg de volume` : ''}
        </Text>
        <TouchableOpacity style={styles.weekdaySelectorRow} onPress={() => setShowWeekdayPicker(true)}>
          {activeWorkout?.weekday != null ? (
            <View style={styles.weekdayBadge}>
              <Ionicons name="calendar-outline" size={13} color="#3b82f6" />
              <Text style={styles.weekdayBadgeText}>{WEEKDAY_OPTIONS.find((d) => d.value === activeWorkout.weekday)?.label}</Text>
            </View>
          ) : (
            <Text style={styles.phaseSelectorPlaceholder}>+ Definir dia da semana</Text>
          )}
        </TouchableOpacity>
      </View>

      {periodizationPhases.length > 0 && (
        <TouchableOpacity style={styles.phaseSelectorRow} onPress={() => setShowPhasePicker(true)}>
          {phaseProgress ? (
            <View style={[styles.phaseBadge, phaseProgress.isCurrent && styles.phaseBadgeCurrent]}>
              <Text style={styles.phaseBadgeText}>
                {phaseProgress.phaseName}{phaseProgress.isCurrent ? ` • Sem. ${phaseProgress.weekInPhase}/${phaseProgress.totalWeeksInPhase}` : ` (sem. ${phaseProgress.startWeek}-${phaseProgress.endWeek})`}
              </Text>
            </View>
          ) : (
            <Text style={styles.phaseSelectorPlaceholder}>+ Vincular fase da periodização</Text>
          )}
        </TouchableOpacity>
      )}

      {muscleGroupEntries.length > 0 && (
        <View style={styles.summaryCard}>
          <TouchableOpacity style={styles.summaryHeader} onPress={() => setSummaryExpanded(!summaryExpanded)}>
            <Text style={styles.summaryTitle}>Resumo por grupo muscular</Text>
            <Ionicons name={summaryExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color="#737373" />
          </TouchableOpacity>
          {summaryExpanded && (
            <View style={styles.summaryRow}>
              {muscleGroupEntries.map(([group, count]) => (
                <View key={group} style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeCount}>{count}</Text>
                  <Text style={styles.summaryBadgeLabel}>{group}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsRow} contentContainerStyle={styles.actionsRowContent}>
        {items.length > 0 && (
          <TouchableOpacity style={styles.actionChip} onPress={handleOpenReplicate}>
            <Text style={styles.actionChipText}>📋 Editar Todos (séries/reps/descanso)</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionChip} onPress={() => activeWorkout && handleDuplicateFicha(activeWorkout)} disabled={saving}>
          <Text style={styles.actionChipText}>📑 Duplicar este treino</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={handleOpenSendModal}>
          <Text style={styles.actionChipText}>📤 Enviar p/ outro aluno</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.addExerciseButton} onPress={() => setShowAddModal(true)}>
        <Text style={styles.addExerciseButtonText}>+ Adicionar Exercício</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Exercícios da ficha ({items.length})</Text>
      {items.length === 0 && (
        <Text style={styles.emptyText}>Nenhum exercício ainda nessa ficha.</Text>
      )}
    </>
  );

  const listHeader = activeWorkoutId ? editorHeader : weekOverviewHeader;

  const listFooter = (
    <TouchableOpacity style={styles.saveButton} onPress={onClose}>
      <Text style={styles.saveButtonText}>Salvar Ficha</Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.container}>
      <HeaderBack title={studentName} onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <DraggableFlatList
        data={activeWorkoutId ? items : []}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseItem}
        onDragEnd={handleReorderComplete}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
      />

      <Modal visible={showAiModal} transparent animationType="slide" onRequestClose={() => setShowAiModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✨ Gerar Treino com IA</Text>
            <Text style={styles.modalSubtitle}>
              Descreve o treino que você quer (objetivo, grupo muscular, quantidade de exercícios, séries/reps). A IA só usa exercícios que já estão na sua biblioteca.
            </Text>

            <TextInput
              style={[styles.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
              placeholder='ex: "Treino de quadríceps com 5 exercícios, 4 séries de 10 a 12 repetições, 60 segundos de descanso"'
              placeholderTextColor="#525252"
              value={aiInstruction}
              onChangeText={setAiInstruction}
              multiline
              editable={!aiProcessing}
            />

            <TouchableOpacity
              style={[styles.aiMicButton, aiRecording && styles.aiMicButtonActive]}
              onPress={handleToggleAiRecording}
              disabled={aiProcessing}
            >
              <Ionicons name={aiRecording ? 'mic' : 'mic-outline'} size={18} color={aiRecording ? '#ef4444' : '#a3a3a3'} />
              <Text style={[styles.aiMicButtonText, aiRecording && styles.aiMicButtonTextActive]}>
                {aiRecording ? 'Gravando... toque pra parar' : 'Falar em vez de digitar'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAiModal(false)} disabled={aiProcessing}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleGenerateWorkoutWithAi} disabled={aiProcessing}>
                {aiProcessing ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.modalConfirmButtonText}>Processar e Preencher</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PromptModal
        visible={!!renamingWorkout}
        title="Renomear ficha"
        subtitle="Digite o novo nome:"
        initialValue={renamingWorkout?.name}
        onCancel={() => setRenamingWorkout(null)}
        onSubmit={handleConfirmRename}
      />

      <Modal visible={showCreateFichaModal} transparent animationType="fade" onRequestClose={() => setShowCreateFichaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova Ficha</Text>
            <Text style={styles.modalSubtitle}>Dá um nome pra essa ficha de treino.</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="ex: Treino A - Quadríceps"
              placeholderTextColor="#525252"
              value={newFichaName}
              onChangeText={setNewFichaName}
              autoFocus
            />

            <Text style={styles.suggestionsLabel}>Sugestões</Text>
            <View style={styles.suggestionsRow}>
              {FICHA_NAME_SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => setNewFichaName(s)}>
                  <Text style={styles.suggestionChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => { setShowCreateFichaModal(false); setNewFichaName(''); }}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleCreateFicha}>
                <Text style={styles.modalConfirmButtonText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showReplicateModal} transparent animationType="fade" onRequestClose={() => setShowReplicateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Aplicar a todos os exercícios</Text>
            <Text style={styles.modalSubtitle}>Isso vai sobrescrever séries, reps e descanso de todos os exercícios já adicionados nessa ficha.</Text>

            <Text style={styles.modalLabel}>Séries</Text>
            <TextInput style={styles.modalInput} keyboardType="number-pad" value={replicateSets} onChangeText={setReplicateSets} />

            <Text style={styles.modalLabel}>Reps</Text>
            <TextInput style={styles.modalInput} value={replicateReps} onChangeText={setReplicateReps} />

            <Text style={styles.modalLabel}>Descanso (segundos)</Text>
            <TextInput style={styles.modalInput} keyboardType="number-pad" value={replicateRest} onChangeText={setReplicateRest} />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowReplicateModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmReplicate} disabled={replicating}>
                {replicating ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.modalConfirmButtonText}>Aplicar a todos</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSendModal} transparent animationType="slide" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sendModalSheet}>
            <Text style={styles.modalTitle}>Enviar ficha</Text>
            <Text style={styles.modalSubtitle}>Escolhe pra quais alunos você quer copiar essa ficha. O aluno atual não aparece na lista.</Text>

            {loadingOtherStudents ? (
              <ActivityIndicator color="#FF6B00" style={{ marginVertical: 20 }} />
            ) : otherStudents.length === 0 ? (
              <Text style={styles.emptyText}>Você não tem outros alunos ainda.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 260, marginBottom: 16 }}>
                {otherStudents.map((s) => {
                  const isSelected = selectedTargets.some((t) => t.id === s.id);
                  return (
                    <TouchableOpacity key={s.id} style={[styles.targetRow, isSelected && styles.targetRowSelected]} onPress={() => handleToggleTarget(s)}>
                      <Text style={styles.targetRowText}>{s.name}</Text>
                      <Text style={styles.targetRowCheck}>{isSelected ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowSendModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmSend} disabled={sendingCopy}>
                {sendingCopy ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.modalConfirmButtonText}>Enviar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPhasePicker} transparent animationType="fade" onRequestClose={() => setShowPhasePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fase da Periodização</Text>
            {periodizationPhases.map((phase) => (
              <TouchableOpacity key={phase.id} style={styles.phaseOption} onPress={() => handleSelectPhaseForFicha(phase.id)}>
                <Text style={styles.phaseOptionText}>{phase.name} ({phase.duration_weeks} sem.)</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.phaseOptionNone} onPress={() => handleSelectPhaseForFicha(null)}>
              <Text style={styles.phaseOptionNoneText}>Nenhuma fase</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowPhasePicker(false)}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showWeekdayPicker} transparent animationType="fade" onRequestClose={() => setShowWeekdayPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dia da Semana</Text>
            {WEEKDAY_OPTIONS.map((d) => (
              <TouchableOpacity key={d.value} style={styles.phaseOption} onPress={() => handleSelectWeekdayForFicha(d.value)}>
                <Text style={styles.phaseOptionText}>{d.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.phaseOptionNone} onPress={() => handleSelectWeekdayForFicha(null)}>
              <Text style={styles.phaseOptionNoneText}>Sem dia fixo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowWeekdayPicker(false)}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTemplatePicker} transparent animationType="slide" onRequestClose={() => setShowTemplatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sendModalSheet}>
            <Text style={styles.modalTitle}>Aplicar Template Pronto</Text>
            <Text style={styles.modalSubtitle}>Cria uma ficha nova pra {studentName} já com todos os exercícios do template escolhido.</Text>

            {loadingTemplates ? (
              <ActivityIndicator color="#FF6B00" style={{ marginVertical: 20 }} />
            ) : templates.length === 0 ? (
              <Text style={styles.emptyText}>Você ainda não criou nenhum template. Vá em Perfil → Templates de Treino.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
                {templates.map((t) => (
                  <TouchableOpacity key={t.id} style={styles.templateOption} onPress={() => handleApplyTemplate(t)} disabled={applyingTemplateId === t.id}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateOptionName}>{t.name}</Text>
                      {t.description ? <Text style={styles.templateOptionDesc} numberOfLines={2}>{t.description}</Text> : null}
                    </View>
                    {applyingTemplateId === t.id ? <ActivityIndicator color="#FF6B00" size="small" /> : <Text style={styles.templateOptionArrow}>›</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowTemplatePicker(false)}>
              <Text style={styles.modalCancelButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showOtherWeekPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.modalTitle}>Copiar qual semana?</Text>
              <TouchableOpacity onPress={() => setShowOtherWeekPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
            {weekHistory.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma semana no histórico ainda.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {weekHistory.map((group) => (
                  <TouchableOpacity key={group.key} style={styles.fichaOption} onPress={() => handlePickOtherWeek(group)}>
                    <Text style={styles.fichaOptionText} numberOfLines={1}>{group.workouts.map((w) => w.name).join(' · ')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  fichaRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  fichaTab: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  fichaTabActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  fichaTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  fichaTabTextActive: { color: '#0F0F12' },
  fichaTabWeekday: { color: '#3b82f6', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  fichaTabWeekdayActive: { color: '#0F0F12' },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 6 },
  aiMicButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, marginTop: 12 },
  aiMicButtonActive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  aiMicButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  aiMicButtonTextActive: { color: '#ef4444' },
  actionsRow: { marginBottom: 8 },
  actionsRowContent: { paddingHorizontal: 16, gap: 8 },
  actionChip: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  actionChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  suggestionsLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  phaseSelectorRow: { marginHorizontal: 16, marginBottom: 8 },
  phaseBadge: { alignSelf: 'flex-start', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#a855f7', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  phaseBadgeCurrent: { backgroundColor: 'rgba(168,85,247,0.15)' },
  phaseBadgeText: { color: '#a855f7', fontSize: 11, fontWeight: '700' },
  phaseSelectorPlaceholder: { color: '#525252', fontSize: 11, textDecorationLine: 'underline' },
  weekdaySelectorRow: { marginTop: 10 },
  weekdayBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  weekdayBadgeText: { color: '#3b82f6', fontSize: 11, fontWeight: '700' },
  summaryCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, marginHorizontal: 16, marginBottom: 6 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { color: '#737373', fontSize: 9, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  summaryBadge: { backgroundColor: '#0F0F12', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 50 },
  summaryBadgeCount: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
  summaryBadgeLabel: { color: '#a3a3a3', fontSize: 8, textTransform: 'capitalize', marginTop: 1 },
  addExerciseButton: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 8 },
  addExerciseButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', marginHorizontal: 16, marginBottom: 8 },
  exerciseCard: { flexDirection: 'row', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, padding: 12 },
  exerciseCardDragging: { borderColor: '#FF6B00', opacity: 0.9 },
  exerciseIndex: { color: '#525252', fontSize: 13, fontWeight: '800', width: 24, marginTop: 1 },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  exerciseMetrics: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', marginTop: 3 },
  exerciseNotes: { color: '#737373', fontSize: 10, marginTop: 6, fontStyle: 'italic' },
  watchLink: { color: '#FF6B00', fontSize: 11, fontWeight: '700', marginTop: 6 },
  exerciseActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dragHandleButton: { padding: 6, marginLeft: -6 },
  exerciseActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  exerciseActionButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },

  weekOverviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  weekOverviewCardName: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  weekOverviewCardMeta: { color: '#a3a3a3', fontSize: 11, marginTop: 3 },
  weekOverviewCardMuscles: { color: '#FF6B00', fontSize: 11, fontWeight: '600', marginTop: 3, textTransform: 'capitalize' },
  newWeekButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 15, marginHorizontal: 16, marginTop: 6 },
  newWeekButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  backToOverviewButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 16, marginBottom: 6 },
  backToOverviewButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  compactSummaryCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginHorizontal: 16, marginTop: 6, marginBottom: 8 },
  compactSummaryTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  compactSummaryMeta: { color: '#a3a3a3', fontSize: 12, marginTop: 4 },

  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '75%' },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  fichaOption: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  fichaOptionText: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },

  saveButton: { backgroundColor: '#FF6B00', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#1C1C22', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 11, marginBottom: 16, lineHeight: 16 },
  modalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 13 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  sendModalSheet: { backgroundColor: '#1C1C22', borderRadius: 16, padding: 20, marginHorizontal: 0 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  targetRowSelected: { borderColor: '#3b82f6' },
  targetRowText: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  targetRowCheck: { color: '#3b82f6', fontSize: 15, fontWeight: '800' },
  phaseOption: { borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  phaseOptionText: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  phaseOptionNone: { paddingVertical: 10, alignItems: 'center', marginBottom: 4 },
  phaseOptionNoneText: { color: '#525252', fontSize: 12, fontWeight: '600' },
  templateOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, padding: 14, marginBottom: 8 },
  templateOptionName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  templateOptionDesc: { color: '#737373', fontSize: 11, marginTop: 3 },
  templateOptionArrow: { color: '#a855f7', fontSize: 20, fontWeight: '700' },
});
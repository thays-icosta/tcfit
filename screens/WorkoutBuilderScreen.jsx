import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import AddExerciseModal from './AddExerciseModal';
import EditExerciseModal from './EditExerciseModal';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { loadPeriodizationPlan, getCurrentPhase } from './periodizationUtils';
import { showAlert } from './alertUtils';
import PromptModal from './PromptModal';
import { HeaderBack } from './Header';

const FICHA_NAME_SUGGESTIONS = [
  'Treino A - Quadríceps',
  'Treino B - Posterior/Glúteos',
  'Treino C - Peito/Tríceps',
  'Treino D - Costas/Bíceps',
  'Treino Full Body',
];

const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

export default function WorkoutBuilderScreen({ studentId, studentName, personalId, onClose }) {
  const [workouts, setWorkouts] = useState([]);
  const [activeWorkoutId, setActiveWorkoutId] = useState(null);
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

  const loadWorkouts = async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, phase_id')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at', { ascending: true });
    setWorkouts(data || []);
    if (data && data.length > 0) {
      setActiveWorkoutId((prev) => (prev && data.some((w) => w.id === prev)) ? prev : data[0].id);
    } else {
      setActiveWorkoutId(null);
    }
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
      'Excluir ficha',
      `Tem certeza que quer excluir "${workout.name}"? Todos os exercícios dela também serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('workouts').update({ active: false }).eq('id', workout.id);
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
    setSaving(true);
    const { data: newWorkout, error } = await supabase
      .from('workouts')
      .insert({ student_id: studentId, personal_id: personalId, name: `${workout.name} (cópia)`, active: true, phase_id: workout.phase_id || null })
      .select()
      .single();

    if (error) {
      showAlert('Erro', error.message);
      setSaving(false);
      return;
    }

    const { data: originalItems } = await supabase
      .from('workout_exercises')
      .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
      .eq('workout_id', workout.id);

    if (originalItems && originalItems.length > 0) {
      const copies = originalItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
      await supabase.from('workout_exercises').insert(copies);
    }

    setSaving(false);
    await loadWorkouts();
    setActiveWorkoutId(newWorkout.id);
    showAlert('Feito!', `Ficha duplicada como "${newWorkout.name}".`);
  };

  const handleLongPressFicha = (workout) => {
    showAlert(
      workout.name,
      'O que você quer fazer com essa ficha?',
      [
        { text: 'Renomear', onPress: () => handleRenameFicha(workout) },
        { text: 'Duplicar', onPress: () => handleDuplicateFicha(workout) },
        { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteFicha(workout) },
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
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    setLoadingTemplates(false);
  };

  const handleApplyTemplate = async (template) => {
    setApplyingTemplateId(template.id);
    const currentPhase = getCurrentPhase(periodizationPlan, periodizationPhases);

    const { data: newWorkout, error } = await supabase
      .from('workouts')
      .insert({
        student_id: studentId,
        personal_id: personalId,
        name: template.name,
        active: true,
        phase_id: currentPhase ? currentPhase.phase.id : null,
      })
      .select()
      .single();

    if (error || !newWorkout) {
      setApplyingTemplateId(null);
      showAlert('Erro', error?.message || 'Não foi possível aplicar o template.');
      return;
    }

    const { data: templateItems } = await supabase
      .from('workout_template_exercises')
      .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
      .eq('template_id', template.id);

    if (templateItems && templateItems.length > 0) {
      const copies = templateItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
      await supabase.from('workout_exercises').insert(copies);
    }

    setApplyingTemplateId(null);
    setShowTemplatePicker(false);
    await loadWorkouts();
    setActiveWorkoutId(newWorkout.id);
    showAlert('Aplicado!', `Ficha "${template.name}" criada com ${templateItems?.length || 0} exercício(s) a partir do template.`);
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

  const handleRemoveItem = (itemId) => {
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

  const handleMove = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const a = items[index];
    const b = items[newIndex];
    await supabase.from('workout_exercises').update({ order_index: b.order_index }).eq('id', a.id);
    await supabase.from('workout_exercises').update({ order_index: a.order_index }).eq('id', b.id);
    loadItems(activeWorkoutId);
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
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (showAddModal) {
    return (
      <AddExerciseModal
        personalId={personalId}
        onConfirm={handleConfirmAddExercise}
        onClose={() => setShowAddModal(false)}
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
        onSave={handleSaveEditItem}
        onClose={() => setEditingItem(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title={studentName} onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
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
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {workouts.length > 0 && (
        <Text style={styles.hintText}>Segure uma aba pra renomear, duplicar ou excluir</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsRow} contentContainerStyle={styles.actionsRowContent}>
        <TouchableOpacity style={styles.actionChip} onPress={() => setShowCreateFichaModal(true)}>
          <Text style={styles.actionChipText}>+ Nova Ficha</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={handleOpenTemplatePicker}>
          <Text style={styles.actionChipText}>⚡ Importar Template</Text>
        </TouchableOpacity>
        {activeWorkoutId && items.length > 0 && (
          <TouchableOpacity style={styles.actionChip} onPress={handleOpenReplicate}>
            <Text style={styles.actionChipText}>📋 Copiar para Todos</Text>
          </TouchableOpacity>
        )}
        {activeWorkoutId && (
          <TouchableOpacity style={styles.actionChip} onPress={handleOpenSendModal}>
            <Text style={styles.actionChipText}>📤 Enviar p/ outro aluno</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {!activeWorkoutId ? (
        <Text style={styles.emptyText}>Cria uma ficha acima pra começar.</Text>
      ) : (
        <>
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

          <TouchableOpacity style={styles.addExerciseButton} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addExerciseButtonText}>+ Adicionar Exercício</Text>
          </TouchableOpacity>

          <>
            <Text style={styles.sectionTitle}>Exercícios da ficha ({items.length})</Text>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum exercício ainda nessa ficha.</Text>
            ) : (
              items.map((item, index) => {
                const hasVideo = !!item.exercises?.video_url;
                const metrics = [
                  { label: 'Séries', value: item.sets || 3 },
                  { label: 'Reps', value: item.reps || '-' },
                ];
                if (item.load_kg != null) metrics.push({ label: 'Carga', value: `${item.load_kg}kg` });
                if (item.cadence) metrics.push({ label: 'Cadência', value: item.cadence });
                else metrics.push({ label: 'Método', value: METHOD_LABELS[item.execution_method] || item.execution_method });
                if (item.rest_time_seconds != null) metrics.push({ label: 'Descanso', value: `${item.rest_time_seconds}s` });

                return (
                  <View key={item.id} style={styles.exerciseCard}>
                    <TouchableOpacity
                      onPress={() => hasVideo && setWatchingVideo({ url: item.exercises.video_url, name: item.exercises.name })}
                      disabled={!hasVideo}
                      style={styles.exerciseThumbWrap}
                    >
                      {item.exercises?.thumbnail_url ? (
                        <Image source={{ uri: item.exercises.thumbnail_url }} style={styles.exerciseThumbImage} />
                      ) : (
                        <View style={styles.exerciseThumbPlaceholder}>
                          <Text style={styles.exerciseThumbMuscle}>{item.exercises?.muscle_group?.toUpperCase() || '?'}</Text>
                        </View>
                      )}
                      {hasVideo && (
                        <View style={styles.playOverlay}>
                          <Text style={styles.playOverlayText}>▶</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.exerciseInfo}>
                      <View style={styles.exerciseHeaderRow}>
                        <Text style={styles.exerciseName}>{item.exercises?.name}</Text>
                        <View style={styles.exerciseHeaderActions}>
                          <TouchableOpacity hitSlop={10} onPress={() => handleMove(index, -1)} disabled={index === 0}>
                            <Text style={[styles.moveArrow, index === 0 && styles.moveArrowDisabled]}>▲</Text>
                          </TouchableOpacity>
                          <TouchableOpacity hitSlop={10} onPress={() => handleMove(index, 1)} disabled={index === items.length - 1}>
                            <Text style={[styles.moveArrow, index === items.length - 1 && styles.moveArrowDisabled]}>▼</Text>
                          </TouchableOpacity>
                          <TouchableOpacity hitSlop={10} onPress={() => setEditingItem(item)}>
                            <Ionicons name="pencil-outline" size={16} color="#3b82f6" />
                          </TouchableOpacity>
                          <TouchableOpacity hitSlop={10} onPress={() => handleRemoveItem(item.id)}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.metricsGrid}>
                        {metrics.map((m) => (
                          <View key={m.label} style={styles.metricPill}>
                            <Text style={styles.metricValue}>{m.value}</Text>
                            <Text style={styles.metricLabel}>{m.label}</Text>
                          </View>
                        ))}
                      </View>

                      {item.notes ? <Text style={styles.exerciseNotes}>📝 {item.notes}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </>
        </>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={onClose}>
        <Text style={styles.saveButtonText}>Salvar Ficha</Text>
      </TouchableOpacity>
      </ScrollView>

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
                {replicating ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.modalConfirmButtonText}>Aplicar a todos</Text>}
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
              <ActivityIndicator color="#f97316" style={{ marginVertical: 20 }} />
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
                {sendingCopy ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.modalConfirmButtonText}>Enviar</Text>}
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

      <Modal visible={showTemplatePicker} transparent animationType="slide" onRequestClose={() => setShowTemplatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sendModalSheet}>
            <Text style={styles.modalTitle}>Aplicar Template Pronto</Text>
            <Text style={styles.modalSubtitle}>Cria uma ficha nova pra {studentName} já com todos os exercícios do template escolhido.</Text>

            {loadingTemplates ? (
              <ActivityIndicator color="#f97316" style={{ marginVertical: 20 }} />
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
                    {applyingTemplateId === t.id ? <ActivityIndicator color="#f97316" size="small" /> : <Text style={styles.templateOptionArrow}>›</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  fichaRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  fichaTab: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  fichaTabActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  fichaTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  fichaTabTextActive: { color: '#0a0a0a' },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 6 },
  actionsRow: { marginBottom: 8 },
  actionsRowContent: { paddingHorizontal: 16, gap: 8 },
  actionChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  actionChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  suggestionsLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  phaseSelectorRow: { marginHorizontal: 16, marginBottom: 8 },
  phaseBadge: { alignSelf: 'flex-start', backgroundColor: '#171717', borderWidth: 1, borderColor: '#a855f7', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  phaseBadgeCurrent: { backgroundColor: 'rgba(168,85,247,0.15)' },
  phaseBadgeText: { color: '#a855f7', fontSize: 11, fontWeight: '700' },
  phaseSelectorPlaceholder: { color: '#525252', fontSize: 11, textDecorationLine: 'underline' },
  summaryCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, marginHorizontal: 16, marginBottom: 6 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { color: '#737373', fontSize: 9, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  summaryBadge: { backgroundColor: '#0a0a0a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 50 },
  summaryBadgeCount: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  summaryBadgeLabel: { color: '#a3a3a3', fontSize: 8, textTransform: 'capitalize', marginTop: 1 },
  addExerciseButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 8 },
  addExerciseButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginHorizontal: 16, marginBottom: 8 },
  exerciseCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginHorizontal: 16, marginBottom: 10, overflow: 'hidden' },
  exerciseThumbWrap: { width: '100%', height: 100, position: 'relative' },
  exerciseThumbImage: { width: '100%', height: 100 },
  exerciseThumbPlaceholder: { width: '100%', height: 100, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  exerciseThumbMuscle: { color: '#f97316', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  playOverlayText: { color: '#f5f5f5', fontSize: 32 },
  exerciseInfo: { padding: 12 },
  exerciseHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  exerciseName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', flex: 1 },
  exerciseHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exerciseNotes: { color: '#737373', fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  moveArrow: { color: '#525252', fontSize: 12 },
  moveArrowDisabled: { color: '#292524' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricPill: { backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 56 },
  metricValue: { color: '#f97316', fontSize: 15, fontWeight: '800' },
  metricLabel: { color: '#525252', fontSize: 8, textTransform: 'uppercase', marginTop: 1 },
  saveButton: { backgroundColor: '#f97316', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#171717', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 11, marginBottom: 16, lineHeight: 16 },
  modalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  sendModalSheet: { backgroundColor: '#171717', borderRadius: 16, padding: 20, marginHorizontal: 0 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  targetRowSelected: { borderColor: '#3b82f6' },
  targetRowText: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  targetRowCheck: { color: '#3b82f6', fontSize: 15, fontWeight: '800' },
  phaseOption: { borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  phaseOptionText: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  phaseOptionNone: { paddingVertical: 10, alignItems: 'center', marginBottom: 4 },
  phaseOptionNoneText: { color: '#525252', fontSize: 12, fontWeight: '600' },
  templateOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 14, marginBottom: 8 },
  templateOptionName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  templateOptionDesc: { color: '#737373', fontSize: 11, marginTop: 3 },
  templateOptionArrow: { color: '#a855f7', fontSize: 20, fontWeight: '700' },
});
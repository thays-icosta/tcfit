import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ScrollView, ActivityIndicator, Image } from 'react-native';
import { supabase } from './supabaseClient';
import CustomExerciseFormScreen from './CustomExerciseFormScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { METHODS, METHOD_LABELS, DEFAULT_EXERCISE_CONFIG } from './exerciseMethods';

const MUSCLE_CHIPS = [
  { value: 'todos', label: 'Todos' },
  { value: 'peito', label: 'Peito' },
  { value: 'costas', label: 'Costas' },
  { value: 'ombro', label: 'Ombros' },
  { value: 'biceps', label: 'Bíceps' },
  { value: 'triceps', label: 'Tríceps' },
  { value: 'abdomen', label: 'Abdômen' },
  { value: 'quadriceps', label: 'Quadríceps' },
  { value: 'isquiotibiais', label: 'Posterior' },
  { value: 'gluteo', label: 'Glúteo' },
  { value: 'aerobico', label: 'Aeróbico' },
];

function isGifUrl(url) {
  return !!url && url.toLowerCase().split('?')[0].endsWith('.gif');
}

// quickAdd: picking an exercise confirms it right away (with the default
// config, or — when swapping — the config of the row being replaced) and
// returns to the ficha, instead of opening the per-exercise configure step.
// Used by the ficha builder, where the numbers are then set for the whole
// ficha at once; without it (e.g. the Modelos builder) nothing changes.
export default function AddExerciseModal({ personalId, studentId, editingItem, replaceItem, suggestedMuscleGroup, quickAdd, onConfirm, onClose }) {
  const [mode, setMode] = useState(editingItem ? 'configure' : 'browse');
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muscleFilter, setMuscleFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(editingItem?.exercises || null);
  const [previewExercise, setPreviewExercise] = useState(null);
  const [gifPreviewExercise, setGifPreviewExercise] = useState(null);
  const [recentExerciseIds, setRecentExerciseIds] = useState([]);

  const [sets, setSets] = useState(editingItem?.sets != null ? String(editingItem.sets) : '3');
  const [reps, setReps] = useState(editingItem?.reps || '10');
  const [loadKg, setLoadKg] = useState(editingItem?.load_kg != null ? String(editingItem.load_kg) : '');
  const [cadence, setCadence] = useState(editingItem?.cadence || '');
  const [restSeconds, setRestSeconds] = useState(editingItem?.rest_time_seconds != null ? String(editingItem.rest_time_seconds) : '60');
  const [method, setMethod] = useState(editingItem?.execution_method || 'tradicional');
  const [notes, setNotes] = useState(editingItem?.notes || '');

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('id, name, muscle_group, equipment, thumbnail_url, personal_id, video_url').order('name');
    setAllExercises(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadExercises();
  }, []);

  // "Recentes": exercises this specific student has had prescribed before,
  // most recent first — a personal building/updating a ficha tends to reach
  // for the same handful of exercises across sessions. No favorites table
  // exists yet in the schema, so that tier isn't shown (would need explicit
  // approval to add one, per project rules).
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const { data } = await supabase
        .from('workout_exercises')
        .select('exercise_id, created_at, workouts!inner(student_id)')
        .eq('workouts.student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(40);
      const seen = new Set();
      const ids = [];
      (data || []).forEach((row) => {
        if (row.exercise_id && !seen.has(row.exercise_id)) {
          seen.add(row.exercise_id);
          ids.push(row.exercise_id);
        }
      });
      setRecentExerciseIds(ids.slice(0, 8));
    })();
  }, [studentId]);

  const filtered = allExercises.filter((e) => {
    if (muscleFilter !== 'todos' && e.muscle_group !== muscleFilter) return false;
    if (search.trim() && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isCuratedBrowse = !search.trim() && muscleFilter === 'todos';
  const recentExercises = isCuratedBrowse
    ? recentExerciseIds.map((id) => allExercises.find((e) => e.id === id)).filter(Boolean)
    : [];
  const sameMuscleExercises = isCuratedBrowse && suggestedMuscleGroup
    ? allExercises.filter((e) => e.muscle_group === suggestedMuscleGroup && !recentExerciseIds.includes(e.id)).slice(0, 8)
    : [];

  const handleSelectExercise = (exercise) => {
    if (quickAdd) {
      onConfirm(exercise, replaceItem ? {
        sets: replaceItem.sets != null ? replaceItem.sets : DEFAULT_EXERCISE_CONFIG.sets,
        reps: replaceItem.reps || DEFAULT_EXERCISE_CONFIG.reps,
        load_kg: replaceItem.load_kg != null ? replaceItem.load_kg : null,
        cadence: replaceItem.cadence || null,
        rest_time_seconds: replaceItem.rest_time_seconds != null ? replaceItem.rest_time_seconds : DEFAULT_EXERCISE_CONFIG.rest_time_seconds,
        execution_method: replaceItem.execution_method || DEFAULT_EXERCISE_CONFIG.execution_method,
        notes: replaceItem.notes || null,
      } : { ...DEFAULT_EXERCISE_CONFIG });
      return;
    }
    setSelectedExercise(exercise);
    // Swapping an exercise carries over the row it's replacing's own
    // sets/reps/descanso/método automatically, per the spec — everything
    // else (picking a fresh exercise to add) still starts from sane
    // defaults.
    if (replaceItem) {
      setSets(replaceItem.sets != null ? String(replaceItem.sets) : '3');
      setReps(replaceItem.reps || '10');
      setLoadKg(replaceItem.load_kg != null ? String(replaceItem.load_kg) : '');
      setCadence(replaceItem.cadence || '');
      setRestSeconds(replaceItem.rest_time_seconds != null ? String(replaceItem.rest_time_seconds) : '60');
      setMethod(replaceItem.execution_method || 'tradicional');
      setNotes(replaceItem.notes || '');
    } else {
      setSets('3');
      setReps('10');
      setLoadKg('');
      setCadence('');
      setRestSeconds('60');
      setMethod('tradicional');
      setNotes('');
    }
    setMode('configure');
  };

  const handlePreview = (exercise) => {
    if (!exercise.video_url) return;
    if (isGifUrl(exercise.video_url)) {
      setGifPreviewExercise(exercise);
    } else {
      setPreviewExercise(exercise);
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedExercise, {
      sets: sets ? Number(sets) : 3,
      reps: reps || '',
      load_kg: loadKg ? Number(loadKg) : null,
      cadence: cadence || null,
      rest_time_seconds: restSeconds ? Number(restSeconds) : null,
      execution_method: method,
      notes: notes.trim() || null,
    });
  };

  if (mode === 'create') {
    return (
      <CustomExerciseFormScreen
        personalId={personalId}
        onClose={() => setMode('browse')}
        onCreated={loadExercises}
      />
    );
  }

  if (previewExercise) {
    return (
      <ExerciseVideoScreen
        videoUrl={previewExercise.video_url}
        exerciseName={previewExercise.name}
        onClose={() => setPreviewExercise(null)}
      />
    );
  }

  if (gifPreviewExercise) {
    return (
      <View style={styles.gifContainer}>
        <View style={styles.gifTopBar}>
          <TouchableOpacity onPress={() => setGifPreviewExercise(null)}>
            <Text style={styles.closeText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.gifTitle}>{gifPreviewExercise.name}</Text>
        </View>
        <View style={styles.gifImageWrap}>
          <Image source={{ uri: gifPreviewExercise.video_url }} style={styles.gifImage} resizeMode="contain" />
        </View>
      </View>
    );
  }

  if (mode === 'configure' && selectedExercise) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          {editingItem ? (
            <>
              <Text style={styles.title}>Editar Exercício</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : replaceItem ? (
            <>
              <Text style={styles.title}>Trocar Exercício</Text>
              <TouchableOpacity onPress={() => setMode('browse')}>
                <Text style={styles.closeText}>← Escolher outro</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setMode('browse')}>
              <Text style={styles.closeText}>← Trocar exercício</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={styles.selectedHeader}>
            <TouchableOpacity onPress={() => handlePreview(selectedExercise)} disabled={!selectedExercise.video_url}>
              {selectedExercise.thumbnail_url ? (
                <Image source={{ uri: selectedExercise.thumbnail_url }} style={styles.selectedThumb} />
              ) : (
                <View style={styles.selectedThumbPlaceholder}>
                  <Text style={styles.selectedThumbText}>{selectedExercise.name.charAt(0)}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName}>{selectedExercise.name}</Text>
              <Text style={styles.selectedMeta}>{selectedExercise.muscle_group}</Text>
              {selectedExercise.video_url && (
                <TouchableOpacity onPress={() => handlePreview(selectedExercise)}>
                  <Text style={styles.execucaoLink}>▶ Ver execução</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldSmall}>
              <Text style={styles.formLabel}>Séries</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={sets} onChangeText={setSets} />
            </View>
            <View style={styles.fieldSmall}>
              <Text style={styles.formLabel}>Reps</Text>
              <TextInput style={styles.input} placeholder="10-12" placeholderTextColor="#525252" value={reps} onChangeText={setReps} />
            </View>
            <View style={styles.fieldSmall}>
              <Text style={styles.formLabel}>Carga (kg)</Text>
              <TextInput style={styles.input} keyboardType="number-pad" placeholder="opcional" placeholderTextColor="#525252" value={loadKg} onChangeText={setLoadKg} />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldSmall}>
              <Text style={styles.formLabel}>Cadência</Text>
              <TextInput style={styles.input} placeholder="2010" placeholderTextColor="#525252" value={cadence} onChangeText={setCadence} />
            </View>
            <View style={styles.fieldSmall}>
              <Text style={styles.formLabel}>Descanso (seg)</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={restSeconds} onChangeText={setRestSeconds} />
            </View>
          </View>

          <Text style={styles.formLabel}>Observação (opcional)</Text>
          <TextInput style={styles.input} placeholder="ex: Ajustar o banco no número 3" placeholderTextColor="#525252" value={notes} onChangeText={setNotes} />

          <Text style={styles.formLabel}>Método</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <TouchableOpacity key={m} style={[styles.methodChip, method === m && styles.methodChipActive]} onPress={() => setMethod(m)}>
                <Text style={[styles.methodChipText, method === m && styles.methodChipTextActive]}>{METHOD_LABELS[m]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>{editingItem ? 'Salvar alterações' : replaceItem ? 'Confirmar troca' : 'Adicionar à ficha'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderCuratedCard = (item) => (
    <TouchableOpacity key={item.id} style={styles.curatedCard} onPress={() => handleSelectExercise(item)}>
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.curatedThumb} />
      ) : (
        <View style={styles.curatedThumbPlaceholder}>
          <Text style={styles.thumbPlaceholderText}>{item.name.charAt(0)}</Text>
        </View>
      )}
      <Text style={styles.curatedCardName} numberOfLines={2}>{item.name}</Text>
    </TouchableOpacity>
  );

  const curatedHeader = isCuratedBrowse && (recentExercises.length > 0 || sameMuscleExercises.length > 0) ? (
    <View style={{ marginBottom: 8 }}>
      {recentExercises.length > 0 && (
        <>
          <Text style={styles.curatedSectionTitle}>Recentes dessa aluna</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.curatedRow}>
            {recentExercises.map(renderCuratedCard)}
          </ScrollView>
        </>
      )}
      {sameMuscleExercises.length > 0 && (
        <>
          <Text style={styles.curatedSectionTitle}>Mesmo grupo muscular</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.curatedRow}>
            {sameMuscleExercises.map(renderCuratedCard)}
          </ScrollView>
        </>
      )}
      <Text style={styles.curatedSectionTitle}>Biblioteca completa</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{replaceItem ? 'Trocar Exercício' : 'Adicionar Exercício'}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <TouchableOpacity style={styles.createButton} onPress={() => setMode('create')}>
          <Text style={styles.createButtonText}>+ Criar exercício personalizado</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar exercício..."
          placeholderTextColor="#525252"
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.chipScrollWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MUSCLE_CHIPS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.chip, muscleFilter === item.value && styles.chipActive]}
                onPress={() => setMuscleFilter(item.value)}
              >
                <Text style={[styles.chipText, muscleFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, paddingHorizontal: 16, marginTop: 8 }}
          ListHeaderComponent={curatedHeader}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum exercício encontrado com esses filtros.</Text>}
          renderItem={({ item }) => {
            const isCustom = item.personal_id === personalId;
            const hasVideo = !!item.video_url;
            return (
              <View style={styles.exerciseRow}>
                <TouchableOpacity onPress={() => handleSelectExercise(item)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.thumbWrap}>
                    {item.thumbnail_url ? (
                      <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <Text style={styles.thumbPlaceholderText}>{item.name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.exerciseNameRow}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      {isCustom && <Text style={styles.customTag}>Meu</Text>}
                    </View>
                    <Text style={styles.exerciseMeta}>{item.muscle_group}{item.equipment ? ` · ${item.equipment}` : ''}</Text>
                  </View>
                </TouchableOpacity>
                {hasVideo && (
                  <TouchableOpacity style={styles.previewButton} onPress={() => handlePreview(item)}>
                    <Text style={styles.previewButtonText}>▶</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleSelectExercise(item)}>
                  <Text style={styles.addIcon}>+</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 50 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  createButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 10 },
  createButtonText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  searchInput: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#FFFFFF', fontSize: 13, marginBottom: 8 },
  chipScrollWrap: { height: 28 },
  chip: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, marginRight: 5, height: 24, justifyContent: 'center' },
  chipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  chipText: { color: '#A7AAB0', fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: '#08090B' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  curatedSectionTitle: { color: '#737373', fontSize: 10, textTransform: 'uppercase', fontWeight: '700', marginTop: 10, marginBottom: 8 },
  curatedRow: { gap: 10, paddingBottom: 4 },
  curatedCard: { width: 84 },
  curatedThumb: { width: 84, height: 84, borderRadius: 10 },
  curatedThumbPlaceholder: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#121419', alignItems: 'center', justifyContent: 'center' },
  curatedCardName: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', marginTop: 4 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumbWrap: { marginRight: 10 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#08090B', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  customTag: { color: '#22c55e', fontSize: 9, fontWeight: '700', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  exerciseMeta: { color: '#737373', fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
  previewButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  previewButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  execucaoLink: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginTop: 4 },
  addIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', paddingHorizontal: 4 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  selectedThumb: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
  selectedThumbPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#121419', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedThumbText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  selectedName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  selectedMeta: { color: '#737373', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  fieldRow: { flexDirection: 'row', gap: 8 },
  fieldSmall: { flex: 1 },
  formLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#FFFFFF', fontSize: 13 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  methodChip: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  methodChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  methodChipText: { color: '#A7AAB0', fontSize: 11, fontWeight: '600' },
  methodChipTextActive: { color: '#08090B' },
  confirmButton: { backgroundColor: '#FFFFFF', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmButtonText: { color: '#08090B', fontSize: 15, fontWeight: '700' },
  gifContainer: { flex: 1, backgroundColor: '#08090B', paddingTop: 50 },
  gifTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  gifTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  gifImageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  gifImage: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#121419' },
});
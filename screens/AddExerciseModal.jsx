import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ScrollView, ActivityIndicator, Image } from 'react-native';
import { supabase } from './supabaseClient';
import CustomExerciseFormScreen from './CustomExerciseFormScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';

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

const METHODS = ['tradicional', 'rest-pause', 'bi-set', 'drop-set', 'piramide'];
const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

function isGifUrl(url) {
  return !!url && url.toLowerCase().split('?')[0].endsWith('.gif');
}

export default function AddExerciseModal({ personalId, editingItem, onConfirm, onClose }) {
  const [mode, setMode] = useState(editingItem ? 'configure' : 'browse');
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muscleFilter, setMuscleFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(editingItem?.exercises || null);
  const [previewExercise, setPreviewExercise] = useState(null);
  const [gifPreviewExercise, setGifPreviewExercise] = useState(null);

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

  const filtered = allExercises.filter((e) => {
    if (muscleFilter !== 'todos' && e.muscle_group !== muscleFilter) return false;
    if (search.trim() && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSelectExercise = (exercise) => {
    setSelectedExercise(exercise);
    setSets('3');
    setReps('10');
    setLoadKg('');
    setCadence('');
    setRestSeconds('60');
    setMethod('tradicional');
    setNotes('');
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
          <Text style={styles.confirmButtonText}>{editingItem ? 'Salvar alterações' : 'Adicionar à ficha'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Adicionar Exercício</Text>
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
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, paddingHorizontal: 16, marginTop: 8 }}
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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  title: { color: '#f5f5f5', fontSize: 17, fontWeight: '700' },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  createButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 10 },
  createButtonText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  searchInput: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, marginBottom: 8 },
  chipScrollWrap: { height: 28 },
  chip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, marginRight: 5, height: 24, justifyContent: 'center' },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a3a3a3', fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 10, marginBottom: 8 },
  thumbWrap: { marginRight: 10 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { color: '#f97316', fontSize: 18, fontWeight: '800' },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  customTag: { color: '#22c55e', fontSize: 9, fontWeight: '700', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  exerciseMeta: { color: '#737373', fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
  previewButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  previewButtonText: { color: '#f97316', fontSize: 11, fontWeight: '800' },
  execucaoLink: { color: '#f97316', fontSize: 10, fontWeight: '700', marginTop: 4 },
  addIcon: { color: '#f97316', fontSize: 22, fontWeight: '800', paddingHorizontal: 4 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  selectedThumb: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
  selectedThumbPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedThumbText: { color: '#f97316', fontSize: 20, fontWeight: '800' },
  selectedName: { color: '#f5f5f5', fontSize: 16, fontWeight: '700' },
  selectedMeta: { color: '#737373', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  fieldRow: { flexDirection: 'row', gap: 8 },
  fieldSmall: { flex: 1 },
  formLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  methodChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  methodChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  methodChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  methodChipTextActive: { color: '#0a0a0a' },
  confirmButton: { backgroundColor: '#f97316', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  gifContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  gifTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  gifTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  gifImageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  gifImage: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#171717' },
});
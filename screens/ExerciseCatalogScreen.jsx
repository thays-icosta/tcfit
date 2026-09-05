import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ScrollView, ActivityIndicator, Image } from 'react-native';
import { supabase } from './supabaseClient';
import CustomExerciseFormScreen from './CustomExerciseFormScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { showAlert } from './alertUtils';

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

const EQUIPMENT_CHIPS = [
  { value: 'todos', label: 'Todos' },
  { value: 'halter', label: 'Halter' },
  { value: 'barra', label: 'Barra' },
  { value: 'maquina', label: 'Máquina' },
  { value: 'peso_corporal', label: 'Peso corporal' },
];

const ORIGIN_CHIPS = [
  { value: 'todos', label: 'Todos' },
  { value: 'biblioteca', label: 'Biblioteca do App' },
  { value: 'meus', label: 'Meus Exercícios' },
];

function isGifUrl(url) {
  return !!url && url.toLowerCase().split('?')[0].endsWith('.gif');
}

export default function ExerciseCatalogScreen({ personalId }) {
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muscleFilter, setMuscleFilter] = useState('todos');
  const [equipmentFilter, setEquipmentFilter] = useState('todos');
  const [originFilter, setOriginFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [previewExercise, setPreviewExercise] = useState(null);
  const [gifPreviewExercise, setGifPreviewExercise] = useState(null);

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('id, name, muscle_group, equipment, personal_id, thumbnail_url, video_url, instructions').order('name');
    setAllExercises(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const filtered = allExercises.filter((ex) => {
    if (muscleFilter !== 'todos' && ex.muscle_group !== muscleFilter) return false;
    if (equipmentFilter !== 'todos' && ex.equipment !== equipmentFilter) return false;
    if (originFilter === 'biblioteca' && ex.personal_id !== null) return false;
    if (originFilter === 'meus' && ex.personal_id !== personalId) return false;
    if (search.trim() && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handlePreview = (exercise) => {
    if (!exercise.video_url) return;
    if (isGifUrl(exercise.video_url)) {
      setGifPreviewExercise(exercise);
    } else {
      setPreviewExercise(exercise);
    }
  };

  const handleEditPress = async (item) => {
    if (item.personal_id === personalId) {
      setEditingExercise(item);
      return;
    }

    // Not owned by this personal (Biblioteca do App or another personal's) —
    // make a personal copy first so editing it never affects other personals.
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        personal_id: personalId,
        name: item.name,
        muscle_group: item.muscle_group,
        equipment: item.equipment,
        instructions: item.instructions,
        thumbnail_url: item.thumbnail_url,
        video_url: item.video_url,
      })
      .select()
      .single();
    if (error) {
      showAlert('Erro ao copiar exercício', error.message);
      return;
    }
    await loadExercises();
    setEditingExercise(data);
  };

  if (showCreateForm || editingExercise) {
    return (
      <CustomExerciseFormScreen
        personalId={personalId}
        exercise={editingExercise}
        onClose={() => { setShowCreateForm(false); setEditingExercise(null); }}
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

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateForm(true)}>
        <Text style={styles.createButtonText}>+ Criar exercício personalizado</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar exercício..."
        placeholderTextColor="#525252"
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.filterLabel}>Origem</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {ORIGIN_CHIPS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, originFilter === item.value && styles.chipActive]}
            onPress={() => setOriginFilter(item.value)}
          >
            <Text style={[styles.chipText, originFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Grupo muscular</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {MUSCLE_CHIPS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, muscleFilter === item.value && styles.chipActive]}
            onPress={() => setMuscleFilter(item.value)}
          >
            <Text style={[styles.chipText, muscleFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Equipamento</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {EQUIPMENT_CHIPS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, equipmentFilter === item.value && styles.chipActive]}
            onPress={() => setEquipmentFilter(item.value)}
          >
            <Text style={[styles.chipText, equipmentFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, marginTop: 10 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum exercício encontrado com esses filtros.</Text>}
          renderItem={({ item }) => {
            const isCustom = item.personal_id === personalId;
            const hasVideo = !!item.video_url;
            return (
              <View style={styles.exerciseCard}>
                <TouchableOpacity onPress={() => handlePreview(item)} disabled={!hasVideo} style={styles.thumbWrap}>
                  {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Text style={styles.thumbPlaceholderText}>{item.name.charAt(0)}</Text>
                    </View>
                  )}
                  {hasVideo && (
                    <View style={styles.playBadge}>
                      <Text style={styles.playBadgeText}>▶</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.exerciseNameRow}>
                    <Text style={styles.exerciseName} numberOfLines={1}>{item.name}</Text>
                    {isCustom && <Text style={styles.customTag}>Meu</Text>}
                  </View>
                  <Text style={styles.exerciseMeta}>{item.muscle_group} • {item.equipment || '—'}</Text>
                  {hasVideo && (
                    <TouchableOpacity onPress={() => handlePreview(item)}>
                      <Text style={styles.execucaoLink}>▶ Ver execução</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.editButton} onPress={() => handleEditPress(item)} hitSlop={8}>
                  <Text style={styles.editButtonText}>{isCustom ? 'Editar' : 'Copiar e Editar'}</Text>
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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 16, paddingTop: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  createButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  createButtonText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  searchInput: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, marginBottom: 10 },
  filterLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 },
  chipScroll: { maxHeight: 28, marginBottom: 6 },
  chip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, marginRight: 5, height: 24, justifyContent: 'center' },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a3a3a3', fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 10, marginBottom: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { color: '#f97316', fontSize: 20, fontWeight: '800' },
  playBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#171717' },
  playBadgeText: { color: '#0a0a0a', fontSize: 8, fontWeight: '800' },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  customTag: { color: '#22c55e', fontSize: 9, fontWeight: '700', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  exerciseMeta: { color: '#737373', fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
  execucaoLink: { color: '#f97316', fontSize: 10, fontWeight: '700', marginTop: 4 },
  editButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  editButtonText: { color: '#a3a3a3', fontSize: 10, fontWeight: '700' },
  gifContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  gifTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  gifTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  gifImageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  gifImage: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#171717' },
});
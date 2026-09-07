import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ActivityIndicator, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import CustomExerciseFormScreen from './CustomExerciseFormScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { showAlert } from './alertUtils';
import { translateExerciseNamePtToEn } from './exerciseTermsPt';

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

// Ionicons has no true anatomy set, so this only distinguishes the groups
// that actually have a meaningfully different icon — everything else falls
// back to the generic barbell.
const MUSCLE_ICONS = {
  aerobico: 'heart-outline',
  quadriceps: 'walk-outline',
  isquiotibiais: 'walk-outline',
};

function isGifUrl(url) {
  return !!url && url.toLowerCase().split('?')[0].endsWith('.gif');
}

export default function ExerciseCatalogScreen({ personalId, onFullScreenChange }) {
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muscleFilter, setMuscleFilter] = useState('todos');
  const [equipmentFilter, setEquipmentFilter] = useState('todos');
  const [originFilter, setOriginFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [previewExercise, setPreviewExercise] = useState(null);
  const [gifPreviewExercise, setGifPreviewExercise] = useState(null);
  const [bulkLinking, setBulkLinking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, linked: 0 });
  const copyInFlightRef = useRef(false);

  // These sub-views replace this whole screen's return, so the parent
  // (TemplateBuilderScreen) needs to know to hide its own header/tab
  // row too — otherwise its "← Voltar Treinos" bar stacks above this
  // component's own full-screen header.
  useEffect(() => {
    onFullScreenChange?.(showCreateForm || !!editingExercise || !!previewExercise || !!gifPreviewExercise);
  }, [showCreateForm, editingExercise, previewExercise, gifPreviewExercise, onFullScreenChange]);

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('id, name, muscle_group, equipment, personal_id, thumbnail_url, video_url, instructions').order('name');
    setAllExercises(data || []);
    setLoading(false);
    return data || [];
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const handleBulkLinkVideos = async () => {
    const missing = allExercises.filter((ex) => ex.personal_id === null && !ex.video_url);
    if (missing.length === 0) {
      showAlert('Tudo em dia', 'Todos os exercícios da Biblioteca do App já têm vídeo vinculado.');
      return;
    }
    showAlert(
      'Vincular vídeos automaticamente?',
      `Vou buscar e vincular vídeos pra ${missing.length} exercício${missing.length !== 1 ? 's' : ''} da Biblioteca do App que ainda não têm um. Isso pode levar alguns minutos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vincular',
          onPress: async () => {
            setBulkLinking(true);
            setBulkProgress({ done: 0, total: missing.length, linked: 0 });
            let linkedCount = 0;
            for (let i = 0; i < missing.length; i++) {
              const ex = missing[i];
              try {
                const { data, error } = await supabase.functions.invoke('link-library-exercise-video', {
                  body: { exerciseId: ex.id, query: translateExerciseNamePtToEn(ex.name) },
                });
                if (!error && data?.linked) linkedCount += 1;
              } catch (e) {
                console.error('Erro ao vincular vídeo em lote:', e);
              }
              setBulkProgress({ done: i + 1, total: missing.length, linked: linkedCount });
              await new Promise((resolve) => setTimeout(resolve, 350));
            }
            setBulkLinking(false);
            await loadExercises();
            showAlert('Concluído!', `${linkedCount} de ${missing.length} exercício${missing.length !== 1 ? 's' : ''} ganharam vídeo automaticamente. Os demais não tiveram correspondência no banco.`);
          },
        },
      ]
    );
  };

  const myExerciseNames = new Set(
    allExercises.filter((ex) => ex.personal_id === personalId).map((ex) => ex.name.trim().toLowerCase())
  );

  const filtered = allExercises.filter((ex) => {
    if (muscleFilter !== 'todos' && ex.muscle_group !== muscleFilter) return false;
    if (equipmentFilter !== 'todos' && ex.equipment !== equipmentFilter) return false;
    if (originFilter === 'biblioteca' && ex.personal_id !== null) return false;
    if (originFilter === 'meus' && ex.personal_id !== personalId) return false;
    // On "Todos", a shared exercise you've already made your own copy of is
    // redundant to show alongside that copy — only the copy is actually
    // usable/editable by you, so hide the superseded original there.
    if (originFilter === 'todos' && ex.personal_id === null && myExerciseNames.has(ex.name.trim().toLowerCase())) return false;
    if (search.trim() && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeFilterCount = [muscleFilter, equipmentFilter].filter((f) => f !== 'todos').length;

  const handleClearFilters = () => {
    setMuscleFilter('todos');
    setEquipmentFilter('todos');
  };

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

    // Already have a personal copy of this one (made earlier, maybe in a
    // previous visit) — open that instead of making yet another duplicate.
    const existingCopy = allExercises.find(
      (ex) => ex.personal_id === personalId && ex.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );
    if (existingCopy) {
      setEditingExercise(existingCopy);
      return;
    }

    if (copyInFlightRef.current) return;
    copyInFlightRef.current = true;

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

    copyInFlightRef.current = false;

    if (error) {
      // Unique-violation race (e.g. a double-tap that slipped past the ref
      // guard): someone already created the copy a moment ago — open it.
      if (error.code === '23505') {
        const refreshed = await loadExercises();
        const nowExisting = refreshed.find(
          (ex) => ex.personal_id === personalId && ex.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        if (nowExisting) setEditingExercise(nowExisting);
        return;
      }
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
      <View style={styles.topActionsRow}>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateForm(true)}>
          <Text style={styles.createButtonText}>+ Criar exercício personalizado</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.syncIconButton} onPress={handleBulkLinkVideos} disabled={bulkLinking}>
          {bulkLinking ? (
            <ActivityIndicator color="#3b82f6" size="small" />
          ) : (
            <Ionicons name="sync-outline" size={18} color="#3b82f6" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.originToggleRow}>
        {ORIGIN_CHIPS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.originToggleChip, originFilter === item.value && styles.originToggleChipActive]}
            onPress={() => setOriginFilter(item.value)}
          >
            <Text style={[styles.originToggleText, originFilter === item.value && styles.originToggleTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { flex: 1, marginBottom: 0 }]}
          placeholder="Buscar exercício..."
          placeholderTextColor="#525252"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterSheet(true)}>
          <Text style={styles.filterButtonText}>Filtrar</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showFilterSheet} transparent animationType="slide" onRequestClose={() => setShowFilterSheet(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filtrar Exercícios</Text>

            <Text style={styles.filterLabel}>Grupo muscular</Text>
            <View style={styles.chipWrapRow}>
              {MUSCLE_CHIPS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.chip, muscleFilter === item.value && styles.chipActive]}
                  onPress={() => setMuscleFilter(item.value)}
                >
                  <Text style={[styles.chipText, muscleFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Equipamento</Text>
            <View style={styles.chipWrapRow}>
              {EQUIPMENT_CHIPS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.chip, equipmentFilter === item.value && styles.chipActive]}
                  onPress={() => setEquipmentFilter(item.value)}
                >
                  <Text style={[styles.chipText, equipmentFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterSheetButtonRow}>
              <TouchableOpacity style={styles.filterClearButton} onPress={handleClearFilters}>
                <Text style={styles.filterClearButtonText}>Limpar filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyButton} onPress={() => setShowFilterSheet(false)}>
                <Text style={styles.filterApplyButtonText}>Ver resultados ({filtered.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              <TouchableOpacity style={styles.exerciseCard} onPress={() => handleEditPress(item)} activeOpacity={0.7}>
                <TouchableOpacity onPress={() => handlePreview(item)} disabled={!hasVideo} style={styles.thumbWrap}>
                  {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Ionicons name={MUSCLE_ICONS[item.muscle_group] || 'barbell-outline'} size={24} color="#525252" />
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
                <Text style={styles.editHintText}>{isCustom ? 'Editar' : 'Copiar e Editar'}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {bulkLinking && (
        <View style={styles.syncToast}>
          <ActivityIndicator color="#3b82f6" size="small" />
          <Text style={styles.syncToastText}>
            Vinculando vídeos {bulkProgress.done}/{bulkProgress.total} ({bulkProgress.linked} encontrados)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 16, paddingTop: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  topActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  createButton: { flex: 1, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  createButtonText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  syncIconButton: { width: 40, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  syncToast: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', gap: 8, backgroundColor: '#171717', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  syncToastText: { color: '#3b82f6', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  searchInput: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, marginBottom: 10 },
  originToggleRow: { flexDirection: 'row', gap: 8, backgroundColor: '#0a0a0a', borderRadius: 10, padding: 4, marginBottom: 10 },
  originToggleChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  originToggleChipActive: { backgroundColor: '#f97316' },
  originToggleText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  originToggleTextActive: { color: '#0a0a0a' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  filterButtonText: { color: '#f5f5f5', fontSize: 12, fontWeight: '700' },
  filterBadge: { backgroundColor: '#f97316', borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: '#0a0a0a', fontSize: 10, fontWeight: '800' },
  filterLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 14 },
  chipWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, marginRight: 5, height: 24, justifyContent: 'center' },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a3a3a3', fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  filterSheetButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  filterClearButton: { flex: 1, borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  filterClearButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  filterApplyButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  filterApplyButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 10, marginBottom: 8 },
  editHintText: { color: '#525252', fontSize: 9, fontWeight: '600', textAlign: 'center', marginLeft: 8, maxWidth: 50 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  playBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#171717' },
  playBadgeText: { color: '#0a0a0a', fontSize: 8, fontWeight: '800' },
  exerciseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  customTag: { color: '#22c55e', fontSize: 9, fontWeight: '700', borderWidth: 1, borderColor: '#22c55e', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  exerciseMeta: { color: '#737373', fontSize: 11, marginTop: 3, textTransform: 'capitalize' },
  execucaoLink: { color: '#f97316', fontSize: 10, fontWeight: '700', marginTop: 4 },
  gifContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  gifTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  gifTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  gifImageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  gifImage: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#171717' },
});
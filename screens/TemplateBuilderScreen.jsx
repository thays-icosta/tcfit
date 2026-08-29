import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Image, Switch } from 'react-native';
import { supabase } from './supabaseClient';
import AddExerciseModal from './AddExerciseModal';
import ExerciseVideoScreen from './ExerciseVideoScreen';

const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

export default function TemplateBuilderScreen({ personalId, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [watchingVideo, setWatchingVideo] = useState(null);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, description, is_public, price')
      .eq('personal_id', personalId)
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    if (data && data.length > 0) {
      setActiveTemplateId((prev) => (prev && data.some((t) => t.id === prev)) ? prev : data[0].id);
    } else {
      setActiveTemplateId(null);
    }
  };

  const loadItems = async (templateId) => {
    if (!templateId) { setItems([]); return; }
    const { data } = await supabase
      .from('workout_template_exercises')
      .select('id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes, exercises (id, name, muscle_group, thumbnail_url, video_url)')
      .eq('template_id', templateId)
      .order('order_index', { ascending: true });
    setItems(data || []);
  };

  useEffect(() => {
    (async () => {
      await loadTemplates();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (activeTemplateId) {
      loadItems(activeTemplateId);
      const t = templates.find((t) => t.id === activeTemplateId);
      setEditDescription(t?.description || '');
      setEditIsPublic(t?.is_public || false);
      setEditPrice(t?.price != null ? String(t.price) : '');
    } else {
      setItems([]);
    }
  }, [activeTemplateId, templates]);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      Alert.alert('Ops', 'Dá um nome pro template (ex: "Hipertrofia Full Body").');
      return;
    }
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ personal_id: personalId, name: newTemplateName.trim() })
      .select()
      .single();
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setNewTemplateName('');
    await loadTemplates();
    setActiveTemplateId(data.id);
  };

  const handleDeleteTemplate = (template) => {
    Alert.alert('Excluir template', `Tem certeza que quer excluir "${template.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_templates').delete().eq('id', template.id);
          if (activeTemplateId === template.id) setActiveTemplateId(null);
          loadTemplates();
        },
      },
    ]);
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    const { error } = await supabase
      .from('workout_templates')
      .update({
        description: editDescription.trim() || null,
        is_public: editIsPublic,
        price: editPrice ? Number(editPrice) : null,
      })
      .eq('id', activeTemplateId);
    setSavingMeta(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      loadTemplates();
      Alert.alert('Salvo!', editIsPublic ? 'Esse template já aparece na vitrine de vendas.' : 'Informações atualizadas.');
    }
  };

  const handleConfirmAddExercise = async (exercise, config) => {
    if (!activeTemplateId) {
      Alert.alert('Ops', 'Cria ou seleciona um template primeiro.');
      return;
    }
    const { data: maxRow } = await supabase
      .from('workout_template_exercises')
      .select('order_index')
      .eq('template_id', activeTemplateId)
      .order('order_index', { ascending: false })
      .limit(1);
    const nextOrder = maxRow && maxRow.length > 0 ? maxRow[0].order_index + 1 : 0;

    const { error } = await supabase.from('workout_template_exercises').insert({
      template_id: activeTemplateId,
      exercise_id: exercise.id,
      order_index: nextOrder,
      ...config,
    });
    if (error) {
      Alert.alert('Erro ao adicionar', error.message);
    } else {
      setShowAddModal(false);
      loadItems(activeTemplateId);
    }
  };

  const handleRemoveItem = (itemId) => {
    Alert.alert('Remover exercício', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_template_exercises').delete().eq('id', itemId);
          loadItems(activeTemplateId);
        },
      },
    ]);
  };

  const handleMove = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const a = items[index];
    const b = items[newIndex];
    await supabase.from('workout_template_exercises').update({ order_index: b.order_index }).eq('id', a.id);
    await supabase.from('workout_template_exercises').update({ order_index: a.order_index }).eq('id', b.id);
    loadItems(activeTemplateId);
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Templates de Treino</Text>
      </View>

      <View style={styles.templateRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {templates.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.templateTab, activeTemplateId === t.id && styles.templateTabActive]}
              onPress={() => setActiveTemplateId(t.id)}
              onLongPress={() => handleDeleteTemplate(t)}
            >
              <Text style={[styles.templateTabText, activeTemplateId === t.id && styles.templateTabTextActive]}>{t.name}</Text>
              {t.is_public && <Text style={styles.publicDot}>●</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {templates.length > 0 && <Text style={styles.hintText}>Segure uma aba pra excluir · ● indica template à venda</Text>}
      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          placeholder="Nome do novo template"
          placeholderTextColor="#737373"
          value={newTemplateName}
          onChangeText={setNewTemplateName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleCreateTemplate}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {!activeTemplateId ? (
        <Text style={styles.emptyText}>Cria um template acima pra começar.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Descrição</Text>
            <TextInput
              style={styles.metaInput}
              placeholder="ex: Treino full body de 3x na semana pra iniciantes"
              placeholderTextColor="#525252"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
            />

            <View style={styles.publicRow}>
              <Text style={styles.publicLabel}>Vender esse template na vitrine</Text>
              <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: '#292524', true: '#f97316' }} thumbColor="#f5f5f5" />
            </View>

            {editIsPublic && (
              <>
                <Text style={styles.metaLabel}>Preço (R$)</Text>
                <TextInput
                  style={styles.metaInput}
                  keyboardType="decimal-pad"
                  placeholder="ex: 97"
                  placeholderTextColor="#525252"
                  value={editPrice}
                  onChangeText={setEditPrice}
                />
              </>
            )}

            <TouchableOpacity style={styles.saveMetaButton} onPress={handleSaveMeta} disabled={savingMeta}>
              {savingMeta ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.saveMetaButtonText}>Salvar informações</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addExerciseButton} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addExerciseButtonText}>+ Adicionar Exercício</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Exercícios do template ({items.length})</Text>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum exercício ainda.</Text>
          ) : (
            items.map((item, index) => {
              const hasVideo = !!item.exercises?.video_url;
              const summaryLine = `${item.sets || 3}x ${item.reps || '-'} · ${METHOD_LABELS[item.execution_method] || item.execution_method}${item.rest_time_seconds != null ? ` · Descanso: ${item.rest_time_seconds}s` : ''}`;
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
                  </TouchableOpacity>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{item.exercises?.name}</Text>
                    <Text style={styles.exerciseSummary}>{summaryLine}</Text>
                  </View>
                  <View style={styles.exerciseActionsRow}>
                    <TouchableOpacity onPress={() => handleMove(index, -1)} disabled={index === 0}>
                      <Text style={[styles.moveArrow, index === 0 && styles.moveArrowDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMove(index, 1)} disabled={index === items.length - 1}>
                      <Text style={[styles.moveArrow, index === items.length - 1 && styles.moveArrowDisabled]}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                      <Text style={styles.removeX}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  templateRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  templateTab: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  templateTabActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  templateTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  templateTabTextActive: { color: '#0a0a0a' },
  publicDot: { color: '#22c55e', fontSize: 8 },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 8 },
  newRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  newInput: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#f5f5f5', fontSize: 12 },
  addButton: { backgroundColor: '#f97316', width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#0a0a0a', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  metaCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  metaLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  metaInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13, minHeight: 50, textAlignVertical: 'top' },
  publicRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  publicLabel: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveMetaButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 16 },
  saveMetaButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  addExerciseButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  addExerciseButtonText: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginHorizontal: 16, marginBottom: 8 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 10 },
  exerciseThumbWrap: { marginRight: 10 },
  exerciseThumbImage: { width: 52, height: 52, borderRadius: 10 },
  exerciseThumbPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  exerciseThumbMuscle: { color: '#f97316', fontSize: 11, fontWeight: '800' },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  exerciseSummary: { color: '#f97316', fontSize: 10, marginTop: 3 },
  exerciseActionsRow: { flexDirection: 'row', gap: 12 },
  moveArrow: { color: '#f97316', fontSize: 12 },
  moveArrowDisabled: { color: '#292524' },
  removeX: { color: '#ef4444', fontSize: 14 },
});
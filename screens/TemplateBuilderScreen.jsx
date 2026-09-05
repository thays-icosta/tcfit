import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Switch, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import AddExerciseModal from './AddExerciseModal';
import ExerciseCatalogScreen from './ExerciseCatalogScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { showAlert } from './alertUtils';
import { HOME_CATEGORIES, WORKOUT_TAGS } from './accessLevel';
import { HeaderBack } from './Header';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

export default function TemplateBuilderScreen({ personalId, onClose }) {
  const [activeMainTab, setActiveMainTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [watchingVideo, setWatchingVideo] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editCoverImageUrl, setEditCoverImageUrl] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [editWorkoutTags, setEditWorkoutTags] = useState([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [savingSectionToggle, setSavingSectionToggle] = useState(false);

  const loadSectionToggle = async () => {
    const { data } = await supabase.from('users').select('show_treinos_prontos_section').eq('id', personalId).single();
    setSectionEnabled(data?.show_treinos_prontos_section !== false);
  };

  const handleToggleSection = async (value) => {
    setSectionEnabled(value);
    setSavingSectionToggle(true);
    await supabase.from('users').update({ show_treinos_prontos_section: value }).eq('id', personalId);
    setSavingSectionToggle(false);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name, description, is_public, price, cover_image_url, category, environment, level, goal')
      .eq('personal_id', personalId)
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    if (data && data.length > 0) {
      setActiveTemplateId((prev) => (prev && data.some((t) => t.id === prev)) ? prev : data[0].id);
    } else {
      setActiveTemplateId(null);
    }
  };

  const loadSessions = async (templateId) => {
    if (!templateId) { setSessions([]); setActiveSessionId(null); return; }
    const { data } = await supabase
      .from('template_sessions')
      .select('id, name, order_index')
      .eq('template_id', templateId)
      .order('order_index', { ascending: true });
    setSessions(data || []);
    setActiveSessionId((prev) => (data && data.some((s) => s.id === prev)) ? prev : data?.[0]?.id || null);
  };

  const loadItems = async (sessionId) => {
    if (!sessionId) { setItems([]); return; }
    const { data } = await supabase
      .from('workout_template_exercises')
      .select('id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes, exercises (id, name, muscle_group, thumbnail_url, video_url)')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true });
    setItems(data || []);
  };

  useEffect(() => {
    (async () => {
      await loadTemplates();
      setLoading(false);
    })();
    loadSectionToggle();
  }, []);

  useEffect(() => {
    if (activeTemplateId) {
      loadSessions(activeTemplateId);
      const t = templates.find((t) => t.id === activeTemplateId);
      setEditDescription(t?.description || '');
      setEditIsPublic(t?.is_public || false);
      setEditPrice(t?.price != null ? String(t.price) : '');
      setEditCoverImageUrl(t?.cover_image_url || null);
      setEditCategory(t?.category || null);
      setEditWorkoutTags(t?.workout_tags || []);
    } else {
      setSessions([]);
      setActiveSessionId(null);
    }
  }, [activeTemplateId, templates]);

  useEffect(() => {
    loadItems(activeSessionId);
  }, [activeSessionId]);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      showAlert('Ops', 'Dá um nome pro template (ex: "Hipertrofia Full Body").');
      return;
    }
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ personal_id: personalId, name: newTemplateName.trim() })
      .select()
      .single();
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    await supabase.from('template_sessions').insert({ template_id: data.id, personal_id: personalId, name: 'Treino A', order_index: 0 });
    setNewTemplateName('');
    await loadTemplates();
    setActiveTemplateId(data.id);
  };

  const handleDeleteTemplate = (template) => {
    showAlert('Excluir template', `Tem certeza que quer excluir "${template.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('products').update({ active: false }).eq('source_template_id', template.id);
          await supabase.from('workout_templates').delete().eq('id', template.id);
          if (activeTemplateId === template.id) setActiveTemplateId(null);
          loadTemplates();
        },
      },
    ]);
  };

  const handleAddSession = async () => {
    if (!activeTemplateId) return;
    const nextLetter = String.fromCharCode(65 + sessions.length);
    const { data, error } = await supabase
      .from('template_sessions')
      .insert({ template_id: activeTemplateId, personal_id: personalId, name: `Treino ${nextLetter}`, order_index: sessions.length })
      .select()
      .single();
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    await loadSessions(activeTemplateId);
    setActiveSessionId(data.id);
  };

  const handleDeleteSession = (session) => {
    if (sessions.length <= 1) {
      showAlert('Ops', 'Precisa ter pelo menos um treino (sessão) no template.');
      return;
    }
    showAlert('Excluir sessão', `Tem certeza que quer excluir "${session.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('template_sessions').delete().eq('id', session.id);
          if (activeSessionId === session.id) setActiveSessionId(null);
          loadSessions(activeTemplateId);
        },
      },
    ]);
  };

  const handlePickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', 'Autorize o acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setUploadingCover(true);
    try {
      const fileName = `${uuidv4()}.jpg`;
      const { error } = await supabase.storage.from('product-covers').upload(fileName, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-covers').getPublicUrl(fileName);
      setEditCoverImageUrl(data.publicUrl);
    } catch {
      showAlert('Não deu pra enviar a capa', 'Sem problema, você pode salvar sem foto e adicionar depois.');
    }
    setUploadingCover(false);
  };

  const syncProductFromTemplate = async (template) => {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('source_template_id', template.id)
      .maybeSingle();

    const payload = {
      personal_id: personalId,
      name: template.name,
      description: template.description,
      type: 'treino_template',
      product_key: 'treino_template',
      price: template.price,
      cover_image_url: template.cover_image_url,
      category: template.category,
      active: template.is_public,
      source_template_id: template.id,
    };

    if (existing) {
      await supabase.from('products').update(payload).eq('id', existing.id);
    } else if (template.is_public) {
      await supabase.from('products').insert(payload);
    }
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    const meta = {
      description: editDescription.trim() || null,
      is_public: editIsPublic,
      price: editPrice ? Number(editPrice) : null,
      cover_image_url: editCoverImageUrl,
      category: editCategory,
      workout_tags: editWorkoutTags,
    };
    const { error } = await supabase.from('workout_templates').update(meta).eq('id', activeTemplateId);
    if (!error) {
      const current = templates.find((t) => t.id === activeTemplateId);
      await syncProductFromTemplate({ id: activeTemplateId, name: current?.name || '', ...meta });
    }
    setSavingMeta(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      loadTemplates();
      showAlert('Salvo!', editIsPublic ? 'Esse template já aparece na vitrine de vendas.' : 'Informações atualizadas.');
    }
  };

  const handleConfirmAddExercise = async (exercise, config) => {
    if (!activeSessionId) {
      showAlert('Ops', 'Cria ou seleciona uma sessão (Treino A, B, C...) primeiro.');
      return;
    }
    const { data: maxRow } = await supabase
      .from('workout_template_exercises')
      .select('order_index')
      .eq('session_id', activeSessionId)
      .order('order_index', { ascending: false })
      .limit(1);
    const nextOrder = maxRow && maxRow.length > 0 ? maxRow[0].order_index + 1 : 0;

    const { error } = await supabase.from('workout_template_exercises').insert({
      template_id: activeTemplateId,
      session_id: activeSessionId,
      exercise_id: exercise.id,
      order_index: nextOrder,
      ...config,
    });
    if (error) {
      showAlert('Erro ao adicionar', error.message);
    } else {
      setShowAddModal(false);
      loadItems(activeSessionId);
    }
  };

  const handleConfirmEditItem = async (exercise, config) => {
    const { error } = await supabase
      .from('workout_template_exercises')
      .update({ exercise_id: exercise.id, ...config })
      .eq('id', editingItem.id);
    if (error) {
      showAlert('Erro ao salvar', error.message);
    } else {
      setEditingItem(null);
      loadItems(activeSessionId);
    }
  };

  const handleRemoveItem = (itemId) => {
    showAlert('Remover exercício', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_template_exercises').delete().eq('id', itemId);
          loadItems(activeSessionId);
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
    loadItems(activeSessionId);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (showAddModal || editingItem) {
    return (
      <AddExerciseModal
        personalId={personalId}
        editingItem={editingItem}
        onConfirm={editingItem ? handleConfirmEditItem : handleConfirmAddExercise}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
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
      <HeaderBack
        title="Treinos"
        onBack={onClose}
        style={{ paddingHorizontal: 16 }}
        rightSlot={
          activeMainTab === 'templates' && activeTemplateId ? (
            <TouchableOpacity onPress={() => setShowSettingsSheet(true)} hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color="#f97316" />
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.mainTabRow}>
        <TouchableOpacity
          style={[styles.mainTabButton, activeMainTab === 'exercicios' && styles.mainTabButtonActive]}
          onPress={() => setActiveMainTab('exercicios')}
        >
          <Text style={[styles.mainTabText, activeMainTab === 'exercicios' && styles.mainTabTextActive]}>Exercícios Cadastrados</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainTabButton, activeMainTab === 'templates' && styles.mainTabButtonActive]}
          onPress={() => setActiveMainTab('templates')}
        >
          <Text style={[styles.mainTabText, activeMainTab === 'templates' && styles.mainTabTextActive]}>Templates / Programas</Text>
        </TouchableOpacity>
      </View>

      {activeMainTab === 'exercicios' && (
        <View style={{ flex: 1 }}>
          <ExerciseCatalogScreen personalId={personalId} />
        </View>
      )}

      {activeMainTab === 'templates' && (
      <>
      <TouchableOpacity style={styles.editingBar} onPress={() => setShowTemplatePicker(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.editingBarLabel}>Editando</Text>
          <Text style={styles.editingBarTitle} numberOfLines={1}>
            {templates.find((t) => t.id === activeTemplateId)?.name || 'Nenhum template selecionado'}
          </Text>
        </View>
        <Ionicons name="swap-horizontal-outline" size={16} color="#f97316" />
        <Text style={styles.editingBarSwitchText}>Trocar</Text>
      </TouchableOpacity>

      <Modal visible={showTemplatePicker} transparent animationType="slide" onRequestClose={() => setShowTemplatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Meus Templates</Text>

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

            <ScrollView style={{ maxHeight: 320 }}>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateListRow, activeTemplateId === t.id && styles.templateListRowActive]}
                  onPress={() => {
                    setActiveTemplateId(t.id);
                    setShowTemplatePicker(false);
                  }}
                >
                  <Text style={styles.templateListRowText} numberOfLines={1}>{t.name}</Text>
                  {t.is_public && <Text style={styles.publicDot}>●</Text>}
                  <TouchableOpacity hitSlop={8} onPress={() => handleDeleteTemplate(t)}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              {templates.length === 0 && <Text style={styles.emptyText}>Nenhum template ainda.</Text>}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowTemplatePicker(false)}>
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSettingsSheet} transparent animationType="slide" onRequestClose={() => setShowSettingsSheet(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '88%' }]}>
            <Text style={styles.modalTitle}>Configurações e Publicação</Text>
            <ScrollView>
              <View style={styles.sectionToggleBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionToggleLabel}>Exibir seção “Treinos Prontos” na vitrine {savingSectionToggle && '(salvando...)'}</Text>
                  <Text style={styles.helperText}>Desligue pra esconder a seção inteira da página pública sem apagar os templates.</Text>
                </View>
                <Switch value={sectionEnabled} onValueChange={handleToggleSection} trackColor={{ false: '#292524', true: '#22c55e' }} thumbColor="#f5f5f5" />
              </View>

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
                  <Text style={styles.metaLabel}>Foto de Capa (Poster)</Text>
                  <TouchableOpacity style={styles.coverPicker} onPress={handlePickCoverImage} disabled={uploadingCover}>
                    {uploadingCover ? (
                      <ActivityIndicator color="#f97316" />
                    ) : editCoverImageUrl ? (
                      <Image source={{ uri: editCoverImageUrl }} style={styles.coverPreview} resizeMode="cover" />
                    ) : (
                      <Text style={styles.coverPickerText}>📷 Adicionar foto de capa</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.metaLabel}>Preço (R$)</Text>
                  <TextInput
                    style={styles.metaInput}
                    keyboardType="decimal-pad"
                    placeholder="ex: 97"
                    placeholderTextColor="#525252"
                    value={editPrice}
                    onChangeText={setEditPrice}
                  />

                  <Text style={styles.metaLabel}>Categoria de Exibição na Vitrine</Text>
                  <View style={styles.categoryRow}>
                    {HOME_CATEGORIES.map((c) => (
                      <TouchableOpacity
                        key={c.value}
                        style={[styles.categoryChip, editCategory === c.value && styles.categoryChipActive]}
                        onPress={() => setEditCategory(editCategory === c.value ? null : c.value)}
                      >
                        <Text style={[styles.categoryChipText, editCategory === c.value && styles.categoryChipTextActive]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.metaLabel}>Tags (seção &quot;Metodologia e Programas de Treino&quot;)</Text>
                  <Text style={styles.helperText}>Usadas nos filtros em pílula da landing page. Pode marcar mais de uma.</Text>
                  <View style={styles.categoryRow}>
                    {WORKOUT_TAGS.map((opt) => {
                      const active = editWorkoutTags.includes(opt.value);
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.categoryChip, active && styles.categoryChipActive]}
                          onPress={() => setEditWorkoutTags((prev) => (prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]))}
                        >
                          <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.saveMetaButton} onPress={handleSaveMeta} disabled={savingMeta}>
                {savingMeta ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.saveMetaButtonText}>Salvar informações</Text>}
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSettingsSheet(false)}>
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {!activeTemplateId ? (
        <Text style={styles.emptyText}>Cria um template pra começar.</Text>
      ) : (
        <>
          <View style={styles.sessionChipsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionChipsContent}>
              {sessions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sessionChip, activeSessionId === s.id && styles.sessionChipActive]}
                  onPress={() => setActiveSessionId(s.id)}
                  onLongPress={() => handleDeleteSession(s)}
                >
                  <Text style={[styles.sessionChipText, activeSessionId === s.id && styles.sessionChipTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.sessionChipAdd} onPress={handleAddSession}>
                <Ionicons name="add" size={14} color="#f97316" />
                <Text style={styles.sessionChipAddText}>Nova Sessão</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          <Text style={styles.hintText}>Segure uma sessão pra excluir · agrupe Treino A, B, C sob o mesmo produto</Text>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.sectionTitle}>Exercícios de {sessions.find((s) => s.id === activeSessionId)?.name || 'Treino'} ({items.length})</Text>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum exercício ainda.</Text>
            ) : (
              items.map((item, index) => {
                const hasVideo = !!item.exercises?.video_url;
                return (
                  <View key={item.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseCardTop}>
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
                        <View style={styles.exercisePillsRow}>
                          <View style={styles.exercisePill}>
                            <Text style={styles.exercisePillText}>{item.sets || 3} séries</Text>
                          </View>
                          <View style={styles.exercisePill}>
                            <Text style={styles.exercisePillText}>{item.reps || '-'} reps</Text>
                          </View>
                          <View style={styles.exercisePill}>
                            <Text style={styles.exercisePillText}>{METHOD_LABELS[item.execution_method] || item.execution_method}</Text>
                          </View>
                          {item.rest_time_seconds != null && (
                            <View style={styles.exercisePill}>
                              <Text style={styles.exercisePillText}>{item.rest_time_seconds}s descanso</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.reorderHandle}>
                        <TouchableOpacity onPress={() => handleMove(index, -1)} disabled={index === 0} hitSlop={4}>
                          <Ionicons name="chevron-up" size={14} color={index === 0 ? '#292524' : '#a3a3a3'} />
                        </TouchableOpacity>
                        <Ionicons name="reorder-three-outline" size={16} color="#525252" />
                        <TouchableOpacity onPress={() => handleMove(index, 1)} disabled={index === items.length - 1} hitSlop={4}>
                          <Ionicons name="chevron-down" size={14} color={index === items.length - 1 ? '#292524' : '#a3a3a3'} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.exerciseQuickActions}>
                      <TouchableOpacity style={styles.quickActionButton} onPress={() => setEditingItem(item)}>
                        <Ionicons name="pencil-outline" size={14} color="#a3a3a3" />
                        <Text style={styles.quickActionText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.quickActionButton} onPress={() => handleRemoveItem(item.id)}>
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        <Text style={[styles.quickActionText, styles.quickActionTextDanger]}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity style={styles.addExerciseButton} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle" size={18} color="#0a0a0a" />
            <Text style={styles.addExerciseButtonText}>Adicionar Exercício</Text>
          </TouchableOpacity>
        </>
      )}
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  mainTabRow: { flexDirection: 'row', backgroundColor: '#171717', borderRadius: 10, padding: 3, marginHorizontal: 16, marginBottom: 16, gap: 4 },
  mainTabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  mainTabButtonActive: { backgroundColor: '#f97316' },
  mainTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  mainTabTextActive: { color: '#0a0a0a' },
  sectionToggleBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  sectionToggleLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  editingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 16, marginBottom: 16 },
  editingBarLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginBottom: 2 },
  editingBarTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  editingBarSwitchText: { color: '#f97316', fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '80%' },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 14 },
  templateListRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  templateListRowActive: { borderColor: '#f97316' },
  templateListRowText: { flex: 1, color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  modalCloseButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  publicDot: { color: '#22c55e', fontSize: 8 },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 8 },
  newRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  newInput: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#f5f5f5', fontSize: 12 },
  addButton: { backgroundColor: '#f97316', width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#0a0a0a', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  metaLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  helperText: { color: '#525252', fontSize: 11, marginBottom: 8 },
  metaInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13, minHeight: 50, textAlignVertical: 'top' },
  publicRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  publicLabel: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveMetaButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 16 },
  saveMetaButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  coverPicker: { width: '100%', aspectRatio: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverPreview: { width: '100%', height: '100%' },
  coverPickerText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  categoryChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  categoryChipTextActive: { color: '#0a0a0a' },
  sessionChipsRow: { marginBottom: 4 },
  sessionChipsContent: { paddingHorizontal: 16, gap: 8 },
  sessionChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginRight: 8 },
  sessionChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  sessionChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  sessionChipTextActive: { color: '#0a0a0a' },
  sessionChipAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316', borderStyle: 'dashed', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  sessionChipAddText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  addExerciseButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 16, shadowColor: '#f97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  addExerciseButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginHorizontal: 16, marginBottom: 8, marginTop: 12 },
  exerciseCard: { backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 16, marginHorizontal: 16, marginBottom: 10, padding: 12 },
  exerciseCardTop: { flexDirection: 'row', alignItems: 'center' },
  exerciseThumbWrap: { marginRight: 10 },
  exerciseThumbImage: { width: 52, height: 52, borderRadius: 10 },
  exerciseThumbPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  exerciseThumbMuscle: { color: '#f97316', fontSize: 11, fontWeight: '800' },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  exercisePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  exercisePill: { backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  exercisePillText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  reorderHandle: { alignItems: 'center', gap: 2, marginLeft: 8, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#2a2a2a' },
  exerciseQuickActions: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  quickActionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quickActionText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  quickActionTextDanger: { color: '#ef4444' },
});
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Switch, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import AddExerciseModal from './AddExerciseModal';
import ExerciseCatalogScreen from './ExerciseCatalogScreen';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { showAlert, describeFunctionError } from './alertUtils';
import { useSpeechToText } from './useSpeechToText';
import { HOME_CATEGORIES, WORKOUT_TAGS, PROGRAM_LEVELS, TRAINING_LOCATIONS, MUSCLE_FOCUS_OPTIONS, TARGET_AUDIENCE_OPTIONS, RUNNING_LEVELS } from './accessLevel';
import { coverFocalImageStyle } from './vitrineStyles';
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
  const [exerciseSubScreenActive, setExerciseSubScreenActive] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionCounts, setSessionCounts] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templateSessionCounts, setTemplateSessionCounts] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [watchingVideo, setWatchingVideo] = useState(null);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showAiTemplateModal, setShowAiTemplateModal] = useState(false);
  const [aiTemplateInstruction, setAiTemplateInstruction] = useState('');
  const [aiTemplateProcessing, setAiTemplateProcessing] = useState(false);
  const { recording: aiTemplateRecording, toggle: handleToggleAiTemplateRecording } = useSpeechToText({
    active: showAiTemplateModal,
    getBaseText: () => aiTemplateInstruction,
    onTranscriptChange: setAiTemplateInstruction,
  });

  const [newTemplateName, setNewTemplateName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editCoverImageUrl, setEditCoverImageUrl] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [editWorkoutTags, setEditWorkoutTags] = useState([]);
  const [editLevel, setEditLevel] = useState(null);
  const [editEnvironment, setEditEnvironment] = useState(null);
  const [editFocusMuscleGroup, setEditFocusMuscleGroup] = useState(null);
  const [editTargetAudience, setEditTargetAudience] = useState('unissex');
  const [editRunningLevel, setEditRunningLevel] = useState(null);
  const [editCoverFocalPosition, setEditCoverFocalPosition] = useState('topo');
  const [savingMeta, setSavingMeta] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateLevelFilter, setTemplateLevelFilter] = useState('todos');
  const [templateEnvironmentFilter, setTemplateEnvironmentFilter] = useState('todos');
  const [templateAudienceFilter, setTemplateAudienceFilter] = useState('todos');
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
      .select('id, name, description, is_public, price, cover_image_url, category, environment, level, goal, focus_muscle_group, target_audience, running_level, cover_focal_position')
      .eq('personal_id', personalId)
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    // Level 0 of the picker is the program-card grid, so only keep a
    // template "open" (Level 1) across a reload if it's still valid —
    // never auto-open the first one.
    setActiveTemplateId((prev) => (data && data.some((t) => t.id === prev)) ? prev : null);

    if (data && data.length > 0) {
      const { data: sessionRows } = await supabase
        .from('template_sessions')
        .select('template_id')
        .in('template_id', data.map((t) => t.id));
      const counts = {};
      (sessionRows || []).forEach((row) => { counts[row.template_id] = (counts[row.template_id] || 0) + 1; });
      setTemplateSessionCounts(counts);
    } else {
      setTemplateSessionCounts({});
    }
  };

  const loadSessionCounts = async (sessionIds) => {
    if (!sessionIds || sessionIds.length === 0) { setSessionCounts({}); return; }
    const { data } = await supabase
      .from('workout_template_exercises')
      .select('session_id')
      .in('session_id', sessionIds);
    const counts = {};
    (data || []).forEach((row) => { counts[row.session_id] = (counts[row.session_id] || 0) + 1; });
    setSessionCounts(counts);
  };

  const loadSessions = async (templateId) => {
    if (!templateId) { setSessions([]); setActiveSessionId(null); setSessionCounts({}); return; }
    const { data } = await supabase
      .from('template_sessions')
      .select('id, name, order_index')
      .eq('template_id', templateId)
      .order('order_index', { ascending: true });
    setSessions(data || []);
    // Accordion cards start collapsed by default when switching templates.
    setActiveSessionId((prev) => (data && data.some((s) => s.id === prev)) ? prev : null);
    loadSessionCounts((data || []).map((s) => s.id));
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
      setEditLevel(t?.level || null);
      setEditEnvironment(t?.environment || null);
      setEditFocusMuscleGroup(t?.focus_muscle_group || null);
      setEditTargetAudience(t?.target_audience || 'unissex');
      setEditRunningLevel(t?.running_level || null);
      setEditCoverFocalPosition(t?.cover_focal_position || 'topo');
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
      return false;
    }
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ personal_id: personalId, name: newTemplateName.trim() })
      .select()
      .single();
    if (error) {
      showAlert('Erro', error.message);
      return false;
    }
    await supabase.from('template_sessions').insert({ template_id: data.id, personal_id: personalId, name: 'Treino A', order_index: 0 });
    setNewTemplateName('');
    await loadTemplates();
    setActiveTemplateId(data.id);
    return true;
  };

  const handleGenerateTemplateWithAi = async () => {
    if (!aiTemplateInstruction.trim()) {
      showAlert('Ops', 'Descreve o template que você quer gerar (ex: "treino ABC de hipertrofia, 3x na semana").');
      return;
    }
    setAiTemplateProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-workout-template', {
        body: { instruction: aiTemplateInstruction.trim() },
      });

      if (error || data?.error) {
        showAlert('Não deu pra gerar o template', await describeFunctionError(error, data, 'Tenta de novo em alguns instantes.'));
        setAiTemplateProcessing(false);
        return;
      }

      if (!data.sessions || data.sessions.length === 0) {
        showAlert('Nenhuma sessão gerada', 'A IA não conseguiu combinar o pedido com exercícios da sua biblioteca. Tenta descrever de outro jeito.');
        setAiTemplateProcessing(false);
        return;
      }

      const { data: newTemplate, error: templateError } = await supabase
        .from('workout_templates')
        .insert({ personal_id: personalId, name: data.template_name || 'Template Gerado por IA' })
        .select()
        .single();

      if (templateError || !newTemplate) {
        showAlert('Erro', templateError?.message || 'Não foi possível criar o template.');
        setAiTemplateProcessing(false);
        return;
      }

      for (let i = 0; i < data.sessions.length; i++) {
        const session = data.sessions[i];
        const { data: newSession, error: sessionError } = await supabase
          .from('template_sessions')
          .insert({ template_id: newTemplate.id, personal_id: personalId, name: session.name || `Treino ${String.fromCharCode(65 + i)}`, order_index: i })
          .select()
          .single();
        if (sessionError || !newSession) continue;

        const rows = (session.exercises || []).map((ex, index) => ({
          template_id: newTemplate.id,
          session_id: newSession.id,
          exercise_id: ex.exercise_id,
          order_index: index,
          sets: ex.sets,
          reps: ex.reps,
          rest_time_seconds: ex.rest_time_seconds,
          execution_method: 'tradicional',
        }));
        if (rows.length > 0) {
          await supabase.from('workout_template_exercises').insert(rows);
        }
      }

      setAiTemplateProcessing(false);
      setShowAiTemplateModal(false);
      setAiTemplateInstruction('');
      await loadTemplates();
      setActiveTemplateId(newTemplate.id);
      showAlert('Template gerado!', `"${newTemplate.name}" criado com ${data.sessions.length} sessão(ões). Revisa e ajusta o que quiser antes de disponibilizar.`);
    } catch (e) {
      console.error('Erro ao gerar template com IA:', e);
      setAiTemplateProcessing(false);
      showAlert('Erro', e?.message || 'Não foi possível gerar o template agora.');
    }
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
    setTemplateSessionCounts((prev) => ({ ...prev, [activeTemplateId]: (prev[activeTemplateId] || 0) + 1 }));
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
          setTemplateSessionCounts((prev) => ({ ...prev, [activeTemplateId]: Math.max(0, (prev[activeTemplateId] || 1) - 1) }));
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
      level: template.level,
      target_audience: template.target_audience,
      running_level: template.running_level,
      cover_focal_position: template.cover_focal_position,
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
    if (editIsPublic && !editCoverImageUrl) {
      showAlert('Foto de capa obrigatória', 'Adicione uma foto de capa antes de publicar esse template na vitrine dos alunos.');
      return;
    }
    setSavingMeta(true);
    const meta = {
      description: editDescription.trim() || null,
      is_public: editIsPublic,
      price: editPrice ? Number(editPrice) : null,
      cover_image_url: editCoverImageUrl,
      category: editCategory,
      workout_tags: editWorkoutTags,
      level: editLevel,
      environment: editEnvironment,
      focus_muscle_group: editFocusMuscleGroup,
      target_audience: editTargetAudience,
      running_level: editCategory === 'modulo_corrida' ? editRunningLevel : null,
      cover_focal_position: editCoverFocalPosition,
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
      setSessionCounts((prev) => ({ ...prev, [activeSessionId]: (prev[activeSessionId] || 0) + 1 }));
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
          setSessionCounts((prev) => ({ ...prev, [activeSessionId]: Math.max(0, (prev[activeSessionId] || 1) - 1) }));
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

  const filteredTemplates = templates.filter((t) => {
    if (templateLevelFilter !== 'todos' && t.level !== templateLevelFilter) return false;
    if (templateEnvironmentFilter !== 'todos' && t.environment !== templateEnvironmentFilter) return false;
    if (templateAudienceFilter !== 'todos' && t.target_audience !== templateAudienceFilter && t.target_audience !== 'unissex') return false;
    if (templateSearch.trim() && !t.name.toLowerCase().includes(templateSearch.trim().toLowerCase())) return false;
    return true;
  });
  const templateGroups = HOME_CATEGORIES
    .map((c) => ({ ...c, items: filteredTemplates.filter((t) => t.category === c.value) }))
    .filter((g) => g.items.length > 0);
  const ungroupedTemplates = filteredTemplates.filter((t) => !HOME_CATEGORIES.some((c) => c.value === t.category));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B00" />
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
      {!exerciseSubScreenActive && (
        <>
          <HeaderBack
            title="Treinos"
            onBack={onClose}
            style={{ paddingHorizontal: 16 }}
            rightSlot={
              activeMainTab === 'templates' ? (
                <View style={styles.headerActionsRow}>
                  {activeTemplateId ? (
                    <TouchableOpacity onPress={() => setShowSettingsSheet(true)} hitSlop={8}>
                      <Ionicons name="settings-outline" size={22} color="#FF6B00" />
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => setShowAiTemplateModal(true)} hitSlop={8}>
                        <Ionicons name="sparkles-outline" size={22} color="#FF6B00" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowCreateTemplateModal(true)} hitSlop={8}>
                        <Ionicons name="add-circle-outline" size={22} color="#FF6B00" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
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
        </>
      )}

      {activeMainTab === 'exercicios' && (
        <View style={{ flex: 1 }}>
          <ExerciseCatalogScreen personalId={personalId} onFullScreenChange={setExerciseSubScreenActive} />
        </View>
      )}

      {activeMainTab === 'templates' && (
      <>
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
                <Switch value={sectionEnabled} onValueChange={handleToggleSection} trackColor={{ false: '#2B2B36', true: '#22c55e' }} thumbColor="#F5F5F7" />
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

              <Text style={styles.metaLabel}>Nível</Text>
              <View style={styles.categoryRow}>
                {PROGRAM_LEVELS.map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.categoryChip, editLevel === l.value && styles.categoryChipActive]}
                    onPress={() => setEditLevel(editLevel === l.value ? null : l.value)}
                  >
                    <Text style={[styles.categoryChipText, editLevel === l.value && styles.categoryChipTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.metaLabel}>Local</Text>
              <View style={styles.categoryRow}>
                {TRAINING_LOCATIONS.map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.categoryChip, editEnvironment === l.value && styles.categoryChipActive]}
                    onPress={() => setEditEnvironment(editEnvironment === l.value ? null : l.value)}
                  >
                    <Text style={[styles.categoryChipText, editEnvironment === l.value && styles.categoryChipTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.metaLabel}>Foco Específico (opcional)</Text>
              <Text style={styles.helperText}>Usado para sugerir esse template automaticamente pra alunos com esse foco na anamnese.</Text>
              <View style={styles.categoryRow}>
                {MUSCLE_FOCUS_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.categoryChip, editFocusMuscleGroup === m.value && styles.categoryChipActive]}
                    onPress={() => setEditFocusMuscleGroup(editFocusMuscleGroup === m.value ? null : m.value)}
                  >
                    <Text style={[styles.categoryChipText, editFocusMuscleGroup === m.value && styles.categoryChipTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.metaLabel}>Público</Text>
              <View style={styles.categoryRow}>
                {TARGET_AUDIENCE_OPTIONS.map((a) => (
                  <TouchableOpacity
                    key={a.value}
                    style={[styles.categoryChip, editTargetAudience === a.value && styles.categoryChipActive]}
                    onPress={() => setEditTargetAudience(a.value)}
                  >
                    <Text style={[styles.categoryChipText, editTargetAudience === a.value && styles.categoryChipTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.publicRow}>
                <Text style={styles.publicLabel}>Vender esse template na vitrine</Text>
                <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: '#2B2B36', true: '#FF6B00' }} thumbColor="#F5F5F7" />
              </View>

              {editIsPublic && (
                <>
                  <Text style={styles.metaLabel}>Foto de Capa (Poster) *</Text>
                  <Text style={styles.helperText}>Obrigatória: sem capa, o programa não pode ser publicado na vitrine do aluno.</Text>
                  <TouchableOpacity
                    style={[styles.coverPicker, !editCoverImageUrl && styles.coverPickerRequired]}
                    onPress={handlePickCoverImage}
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? (
                      <ActivityIndicator color="#FF6B00" />
                    ) : editCoverImageUrl ? (
                      <Image source={{ uri: editCoverImageUrl }} style={coverFocalImageStyle(editCoverFocalPosition)} resizeMode="cover" />
                    ) : (
                      <Text style={styles.coverPickerText}>📷 Adicionar foto de capa</Text>
                    )}
                  </TouchableOpacity>

                  {editCoverImageUrl && (
                    <>
                      <Text style={styles.metaLabel}>Enquadramento da Capa</Text>
                      <Text style={styles.helperText}>Se a foto cortar a parte errada na vitrine do aluno, ajusta aqui.</Text>
                      <View style={styles.categoryRow}>
                        {[{ value: 'topo', label: 'Topo' }, { value: 'centro', label: 'Centro' }, { value: 'base', label: 'Base' }].map((f) => (
                          <TouchableOpacity
                            key={f.value}
                            style={[styles.categoryChip, editCoverFocalPosition === f.value && styles.categoryChipActive]}
                            onPress={() => setEditCoverFocalPosition(f.value)}
                          >
                            <Text style={[styles.categoryChipText, editCoverFocalPosition === f.value && styles.categoryChipTextActive]}>{f.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

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

                  {editCategory === 'modulo_corrida' && (
                    <>
                      <Text style={styles.metaLabel}>Nível da Corrida</Text>
                      <Text style={styles.helperText}>Define em qual etapa do roteiro do Módulo Corrida esse programa aparece pro aluno.</Text>
                      <View style={styles.categoryRow}>
                        {RUNNING_LEVELS.map((l) => (
                          <TouchableOpacity
                            key={l.value}
                            style={[styles.categoryChip, editRunningLevel === l.value && styles.categoryChipActive]}
                            onPress={() => setEditRunningLevel(editRunningLevel === l.value ? null : l.value)}
                          >
                            <Text style={[styles.categoryChipText, editRunningLevel === l.value && styles.categoryChipTextActive]}>{l.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

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
                {savingMeta ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.saveMetaButtonText}>Salvar informações</Text>}
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSettingsSheet(false)}>
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateTemplateModal} transparent animationType="slide" onRequestClose={() => setShowCreateTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Criar Novo Template</Text>
            <Text style={styles.modalSubtitle}>Dá um nome pro template. Ele já nasce com a primeira sessão (Treino A) pra você montar.</Text>
            <View style={styles.newRow}>
              <TextInput
                style={styles.newInput}
                placeholder="ex: Hipertrofia Full Body"
                placeholderTextColor="#737373"
                value={newTemplateName}
                onChangeText={setNewTemplateName}
              />
            </View>
            <TouchableOpacity
              style={styles.saveMetaButton}
              onPress={async () => {
                const ok = await handleCreateTemplate();
                if (ok) setShowCreateTemplateModal(false);
              }}
            >
              <Text style={styles.saveMetaButtonText}>Criar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowCreateTemplateModal(false)}>
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAiTemplateModal} transparent animationType="slide" onRequestClose={() => setShowAiTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>✨ Gerar Template com IA</Text>
            <Text style={styles.modalSubtitle}>Descreva o template (ex: &quot;treino ABC de hipertrofia, 3x na semana&quot;). A IA monta as sessões usando exercícios da sua biblioteca.</Text>
            <View style={styles.aiInputRow}>
              <TextInput
                style={[styles.metaInput, { flex: 1 }]}
                placeholder="Descreva o template..."
                placeholderTextColor="#525252"
                value={aiTemplateInstruction}
                onChangeText={setAiTemplateInstruction}
                multiline
              />
              <TouchableOpacity
                style={[styles.aiMicButton, aiTemplateRecording && styles.aiMicButtonActive]}
                onPress={handleToggleAiTemplateRecording}
              >
                <Ionicons name={aiTemplateRecording ? 'stop' : 'mic-outline'} size={18} color={aiTemplateRecording ? '#0F0F12' : '#FF6B00'} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveMetaButton} onPress={handleGenerateTemplateWithAi} disabled={aiTemplateProcessing}>
              {aiTemplateProcessing ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.saveMetaButtonText}>Gerar Template</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowAiTemplateModal(false);
                setAiTemplateInstruction('');
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {!activeTemplateId ? (
        templates.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Ionicons name="albums-outline" size={36} color="#525252" />
            <Text style={styles.emptyStateTitle}>Nenhum template ainda</Text>
            <Text style={styles.emptyStateSubtitle}>Crie o primeiro modelo de treino da sua biblioteca pra reaproveitar com seus alunos.</Text>

            <TouchableOpacity style={styles.emptyStatePrimaryButton} onPress={() => setShowCreateTemplateModal(true)}>
              <Ionicons name="add" size={18} color="#0F0F12" />
              <Text style={styles.emptyStatePrimaryButtonText}>Criar Template Manualmente</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.emptyStateAiButton} onPress={() => setShowAiTemplateModal(true)}>
              <Ionicons name="sparkles" size={18} color="#FF6B00" />
              <Text style={styles.emptyStateAiButtonText}>Gerar Template com IA</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <TextInput
                style={[styles.newInput, { marginBottom: 8 }]}
                placeholder="Buscar programa..."
                placeholderTextColor="#737373"
                value={templateSearch}
                onChangeText={setTemplateSearch}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 44, flexGrow: 0, marginBottom: 6, paddingLeft: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {[{ value: 'todos', label: 'Todos os níveis' }, ...PROGRAM_LEVELS].map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.pickerFilterChip, templateLevelFilter === l.value && styles.pickerFilterChipActive]}
                    onPress={() => setTemplateLevelFilter(l.value)}
                  >
                    <Text style={[styles.pickerFilterChipText, templateLevelFilter === l.value && styles.pickerFilterChipTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.pickerFilterDivider} />
                {[{ value: 'todos', label: 'Todos os locais' }, ...TRAINING_LOCATIONS].map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.pickerFilterChip, templateEnvironmentFilter === l.value && styles.pickerFilterChipActive]}
                    onPress={() => setTemplateEnvironmentFilter(l.value)}
                  >
                    <Text style={[styles.pickerFilterChipText, templateEnvironmentFilter === l.value && styles.pickerFilterChipTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.pickerFilterDivider} />
                {[{ value: 'todos', label: 'Todos os públicos' }, ...TARGET_AUDIENCE_OPTIONS.filter((a) => a.value !== 'unissex')].map((a) => (
                  <TouchableOpacity
                    key={a.value}
                    style={[styles.pickerFilterChip, templateAudienceFilter === a.value && styles.pickerFilterChipActive]}
                    onPress={() => setTemplateAudienceFilter(a.value)}
                  >
                    <Text style={[styles.pickerFilterChipText, templateAudienceFilter === a.value && styles.pickerFilterChipTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {templateGroups.map((group) => (
                <View key={group.value} style={{ marginBottom: 16 }}>
                  <Text style={styles.templateGroupLabel}>{group.label}</Text>
                  {group.items.map((t) => (
                    <TouchableOpacity key={t.id} style={styles.programCard} onPress={() => setActiveTemplateId(t.id)} onLongPress={() => handleDeleteTemplate(t)}>
                      {t.cover_image_url ? (
                        <Image source={{ uri: t.cover_image_url }} style={styles.programCardCover} />
                      ) : (
                        <View style={styles.programCardCoverPlaceholder}>
                          <Ionicons name="albums-outline" size={20} color="#525252" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.programCardTitle} numberOfLines={1}>{t.name}</Text>
                        <Text style={styles.programCardSubtitle}>
                          {templateSessionCounts[t.id] || 0} ficha{(templateSessionCounts[t.id] || 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {t.is_public && <Text style={styles.publicDot}>●</Text>}
                      <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {ungroupedTemplates.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  {templateGroups.length > 0 && <Text style={styles.templateGroupLabel}>Sem categoria</Text>}
                  {ungroupedTemplates.map((t) => (
                    <TouchableOpacity key={t.id} style={styles.programCard} onPress={() => setActiveTemplateId(t.id)} onLongPress={() => handleDeleteTemplate(t)}>
                      {t.cover_image_url ? (
                        <Image source={{ uri: t.cover_image_url }} style={styles.programCardCover} />
                      ) : (
                        <View style={styles.programCardCoverPlaceholder}>
                          <Ionicons name="albums-outline" size={20} color="#525252" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.programCardTitle} numberOfLines={1}>{t.name}</Text>
                        <Text style={styles.programCardSubtitle}>
                          {templateSessionCounts[t.id] || 0} ficha{(templateSessionCounts[t.id] || 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {t.is_public && <Text style={styles.publicDot}>●</Text>}
                      <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {filteredTemplates.length === 0 && (
                <Text style={styles.emptyText}>Nenhum programa encontrado com esses filtros.</Text>
              )}
            </ScrollView>
          </View>
        )
      ) : (
        <>
          <TouchableOpacity style={styles.backToProgramsRow} onPress={() => setActiveTemplateId(null)}>
            <Ionicons name="arrow-back" size={16} color="#FF6B00" />
            <Text style={styles.backToProgramsText} numberOfLines={1}>
              {templates.find((t) => t.id === activeTemplateId)?.name || 'Voltar aos Programas'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>Toque numa ficha pra expandir · segure pra excluir</Text>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {sessions.map((session) => {
              const isExpanded = activeSessionId === session.id;
              return (
                <View key={session.id} style={styles.sessionAccordionCard}>
                  <TouchableOpacity
                    style={styles.sessionAccordionHeader}
                    onPress={() => setActiveSessionId(isExpanded ? null : session.id)}
                    onLongPress={() => handleDeleteSession(session)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionAccordionTitle}>{session.name}</Text>
                      <Text style={styles.sessionAccordionSubtitle}>
                        {sessionCounts[session.id] || 0} exercício{(sessionCounts[session.id] || 0) !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#a3a3a3" />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.sessionAccordionBody}>
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
                                    <Ionicons name="chevron-up" size={14} color={index === 0 ? '#2B2B36' : '#a3a3a3'} />
                                  </TouchableOpacity>
                                  <Ionicons name="reorder-three-outline" size={16} color="#525252" />
                                  <TouchableOpacity onPress={() => handleMove(index, 1)} disabled={index === items.length - 1} hitSlop={4}>
                                    <Ionicons name="chevron-down" size={14} color={index === items.length - 1 ? '#2B2B36' : '#a3a3a3'} />
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

                      <TouchableOpacity style={styles.addExerciseButtonInline} onPress={() => setShowAddModal(true)}>
                        <Ionicons name="add-circle" size={16} color="#0F0F12" />
                        <Text style={styles.addExerciseButtonText}>Adicionar Exercício</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.addSessionButton} onPress={handleAddSession}>
              <Ionicons name="add" size={16} color="#FF6B00" />
              <Text style={styles.addSessionButtonText}>Nova Sessão</Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  mainTabRow: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 10, padding: 3, marginHorizontal: 16, marginBottom: 16, gap: 4 },
  mainTabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  mainTabButtonActive: { backgroundColor: '#FF6B00' },
  mainTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  mainTabTextActive: { color: '#0F0F12' },
  sectionToggleBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  sectionToggleLabel: { color: '#F5F5F7', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  backToProgramsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  backToProgramsText: { color: '#FF6B00', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  programCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 10, marginBottom: 8 },
  programCardCover: { width: 44, height: 44, borderRadius: 10 },
  programCardCoverPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  programCardTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  programCardSubtitle: { color: '#737373', fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '80%' },
  modalTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginBottom: 14 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 16, marginTop: -8 },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 16 },
  aiMicButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.12)', borderWidth: 1, borderColor: '#FF6B00', alignItems: 'center', justifyContent: 'center' },
  aiMicButtonActive: { backgroundColor: '#FF6B00' },
  templateGroupLabel: { color: '#737373', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  pickerFilterChip: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 18, paddingHorizontal: 12, height: 36, alignItems: 'center', justifyContent: 'center' },
  pickerFilterChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  pickerFilterChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  pickerFilterChipTextActive: { color: '#0F0F12' },
  pickerFilterDivider: { width: 1, height: 20, backgroundColor: '#2B2B36', marginHorizontal: 2 },
  modalCloseButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  publicDot: { color: '#22c55e', fontSize: 8 },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 8 },
  newRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  newInput: { flex: 1, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#F5F5F7', fontSize: 12 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  emptyStateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyStateTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyStateSubtitle: { color: '#737373', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  emptyStatePrimaryButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', width: '100%' },
  emptyStatePrimaryButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  emptyStateAiButton: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 10 },
  emptyStateAiButtonText: { color: '#FF6B00', fontSize: 14, fontWeight: '800' },
  metaLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  helperText: { color: '#525252', fontSize: 11, marginBottom: 8 },
  metaInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 13, minHeight: 50, textAlignVertical: 'top' },
  publicRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  publicLabel: { color: '#F5F5F7', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveMetaButton: { backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 16 },
  saveMetaButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  coverPicker: { width: '100%', aspectRatio: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverPickerRequired: { borderColor: '#FF6B00', borderStyle: 'dashed' },
  coverPreview: { width: '100%', height: '100%' },
  coverPickerText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  categoryChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  categoryChipTextActive: { color: '#0F0F12' },
  sessionAccordionCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, marginHorizontal: 16, marginBottom: 10, overflow: 'hidden' },
  sessionAccordionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  sessionAccordionTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  sessionAccordionSubtitle: { color: '#737373', fontSize: 11, marginTop: 2 },
  sessionAccordionBody: { paddingHorizontal: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#0F0F12' },
  addExerciseButtonInline: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addExerciseButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '800' },
  addSessionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: '#FF6B00', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14, marginHorizontal: 16, marginTop: 4 },
  addSessionButtonText: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
  exerciseCard: { backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 16, marginTop: 10, padding: 12 },
  exerciseCardTop: { flexDirection: 'row', alignItems: 'center' },
  exerciseThumbWrap: { marginRight: 10 },
  exerciseThumbImage: { width: 52, height: 52, borderRadius: 10 },
  exerciseThumbPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  exerciseThumbMuscle: { color: '#FF6B00', fontSize: 11, fontWeight: '800' },
  exerciseInfo: { flex: 1 },
  exerciseName: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  exercisePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  exercisePill: { backgroundColor: 'rgba(255,107,0,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  exercisePillText: { color: '#FF6B00', fontSize: 10, fontWeight: '700' },
  reorderHandle: { alignItems: 'center', gap: 2, marginLeft: 8, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#2a2a2a' },
  exerciseQuickActions: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  quickActionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quickActionText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  quickActionTextDanger: { color: '#ef4444' },
});
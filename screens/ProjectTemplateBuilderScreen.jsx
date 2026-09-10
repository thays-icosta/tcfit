import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import PromptModal from './PromptModal';
import CollapsibleSection from './CollapsibleSection';
import { HeaderBack } from './Header';
import { BLOCK_TYPES, createEmptyBlock, blockLabel } from './projectContentBlocks';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const ACTIVITY_TYPES = [
  { value: 'treino', label: 'Treino', icon: 'barbell-outline' },
  { value: 'programa', label: 'Programa', icon: 'layers-outline' },
  { value: 'exercicio', label: 'Exercício', icon: 'body-outline' },
  { value: 'video', label: 'Vídeo', icon: 'play-circle-outline' },
  { value: 'conteudo', label: 'Conteúdo', icon: 'book-outline' },
  { value: 'checklist', label: 'Checklist', icon: 'checkbox-outline' },
  { value: 'recovery', label: 'Recuperação', icon: 'bed-outline' },
];

const REF_KIND_BY_TYPE = {
  treino: 'session',
  programa: 'session',
  exercicio: 'exercise',
  video: 'exercise',
  conteudo: 'content',
  checklist: 'content',
  recovery: 'none',
};

// Personal-side authoring screen for the "Projetos" feature (reusable
// multi-day programs, e.g. "Quadríceps Grandes e Fortes — 90 Dias"). Mirrors
// DietTemplateBuilderScreen's list→detail→modal shape. Activities never
// duplicate exercise/treino data — they only store a reference (ref_session_id
// + ref_template_id / ref_exercise_id / content_id).
export default function ProjectTemplateBuilderScreen({ personalId, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState(null);

  const [phases, setPhases] = useState([]);
  const [contents, setContents] = useState([]);
  const [collapsedPhases, setCollapsedPhases] = useState(false);
  const [collapsedContents, setCollapsedContents] = useState(true);

  const [activePhaseId, setActivePhaseId] = useState(null);
  const [activities, setActivities] = useState([]);

  const [editingContentId, setEditingContentId] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [showBlockTypePicker, setShowBlockTypePicker] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', totalDays: '' });
  const [renamingTemplate, setRenamingTemplate] = useState(null);
  const [uploadingEbook, setUploadingEbook] = useState(false);
  const [savingTemplateMeta, setSavingTemplateMeta] = useState(false);
  const [totalDaysDraft, setTotalDaysDraft] = useState('');

  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState(null);
  const [phaseForm, setPhaseForm] = useState({ name: '', durationDays: '', cycleLengthDays: '' });

  const [renamingContent, setRenamingContent] = useState(null);
  const [showCreateContentModal, setShowCreateContentModal] = useState(false);

  const [showActivityModal, setShowActivityModal] = useState(null); // 'cycle' | 'fixed' | null
  const [activityForm, setActivityForm] = useState(null);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [refPickerTemplates, setRefPickerTemplates] = useState([]);
  const [refPickerSessions, setRefPickerSessions] = useState(null); // null = showing templates, array = showing sessions
  const [refPickerExercises, setRefPickerExercises] = useState([]);
  const [refPickerSearch, setRefPickerSearch] = useState('');

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);
  const activePhase = phases.find((p) => p.id === activePhaseId);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('project_templates')
      .select('*')
      .eq('personal_id', personalId)
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    setLoading(false);
  };

  const loadPhases = async (templateId) => {
    if (!templateId) { setPhases([]); return; }
    const { data } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_template_id', templateId)
      .order('order_index', { ascending: true });
    setPhases(data || []);
  };

  const loadContents = async (templateId) => {
    if (!templateId) { setContents([]); return; }
    const { data } = await supabase
      .from('project_contents')
      .select('*')
      .eq('project_template_id', templateId)
      .order('order_index', { ascending: true });
    setContents(data || []);
  };

  const loadActivities = async (phaseId) => {
    if (!phaseId) { setActivities([]); return; }
    const { data } = await supabase
      .from('project_activities')
      .select('*')
      .eq('phase_id', phaseId)
      .order('order_index', { ascending: true });
    setActivities(data || []);
  };

  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => {
    loadPhases(activeTemplateId);
    loadContents(activeTemplateId);
    setActivePhaseId(null);
    setTotalDaysDraft(activeTemplate ? String(activeTemplate.total_days) : '');
  }, [activeTemplateId]);
  useEffect(() => { loadActivities(activePhaseId); }, [activePhaseId]);

  // ---- Template CRUD ----

  const handleCreateTemplate = async () => {
    const totalDays = Number(templateForm.totalDays);
    if (!templateForm.name.trim() || !totalDays || totalDays <= 0) {
      showAlert('Ops', 'Dá um nome e a duração total em dias (ex: 90).');
      return;
    }
    const { data, error } = await supabase
      .from('project_templates')
      .insert({ personal_id: personalId, name: templateForm.name.trim(), total_days: totalDays })
      .select()
      .single();
    if (error) { showAlert('Erro', error.message); return; }
    setTemplateForm({ name: '', totalDays: '' });
    setShowTemplateModal(false);
    await loadTemplates();
    setActiveTemplateId(data.id);
  };

  const handleRenameTemplate = async (newName) => {
    const template = renamingTemplate;
    setRenamingTemplate(null);
    const { error } = await supabase.from('project_templates').update({ name: newName }).eq('id', template.id);
    if (error) showAlert('Erro', error.message);
    else loadTemplates();
  };

  const handleToggleArchiveTemplate = async (template) => {
    await supabase.from('project_templates').update({ archived: !template.archived }).eq('id', template.id);
    loadTemplates();
  };

  const handleDeleteTemplate = (template) => {
    showAlert('Excluir projeto', `Tem certeza que quer excluir "${template.name}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('project_templates').delete().eq('id', template.id);
          if (activeTemplateId === template.id) setActiveTemplateId(null);
          loadTemplates();
        },
      },
    ]);
  };

  const handleLongPressTemplate = (template) => {
    showAlert(template.name, 'O que você quer fazer com esse projeto?', [
      { text: 'Renomear', onPress: () => setRenamingTemplate(template) },
      { text: template.archived ? 'Reativar' : 'Arquivar', onPress: () => handleToggleArchiveTemplate(template) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteTemplate(template) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleSaveTemplateMeta = async () => {
    const totalDays = Number(totalDaysDraft);
    if (!totalDays || totalDays <= 0) { showAlert('Ops', 'Duração inválida.'); return; }
    setSavingTemplateMeta(true);
    const { error } = await supabase.from('project_templates').update({ total_days: totalDays }).eq('id', activeTemplateId);
    setSavingTemplateMeta(false);
    if (error) showAlert('Erro', error.message);
    else loadTemplates();
  };

  const handlePickEbookPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingEbook(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const safeName = (asset.name || 'ebook.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${uuidv4()}-${safeName}`;
      const { error } = await supabase.storage.from('product-files').upload(fileName, blob, { contentType: 'application/pdf' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-files').getPublicUrl(fileName);
      await supabase.from('project_templates').update({ ebook_pdf_url: data.publicUrl }).eq('id', activeTemplateId);
      await loadTemplates();
    } catch {
      showAlert('Não deu pra enviar o PDF', 'Tenta de novo ou confirme sua conexão.');
    }
    setUploadingEbook(false);
  };

  // ---- Phase CRUD ----

  const openCreatePhase = () => {
    setEditingPhase(null);
    setPhaseForm({ name: '', durationDays: '', cycleLengthDays: '7' });
    setShowPhaseModal(true);
  };

  const openEditPhase = (phase) => {
    setEditingPhase(phase);
    setPhaseForm({ name: phase.name, durationDays: String(phase.duration_days), cycleLengthDays: String(phase.cycle_length_days) });
    setShowPhaseModal(true);
  };

  const handleSavePhase = async () => {
    const durationDays = Number(phaseForm.durationDays);
    const cycleLengthDays = Number(phaseForm.cycleLengthDays);
    if (!phaseForm.name.trim() || !durationDays || durationDays <= 0 || !cycleLengthDays || cycleLengthDays <= 0) {
      showAlert('Ops', 'Preencha nome, duração em dias e tamanho do ciclo (ambos maiores que zero).');
      return;
    }
    if (editingPhase) {
      const { error } = await supabase
        .from('project_phases')
        .update({ name: phaseForm.name.trim(), duration_days: durationDays, cycle_length_days: cycleLengthDays })
        .eq('id', editingPhase.id);
      if (error) { showAlert('Erro', error.message); return; }
    } else {
      const { error } = await supabase.from('project_phases').insert({
        project_template_id: activeTemplateId,
        personal_id: personalId,
        name: phaseForm.name.trim(),
        order_index: phases.length,
        duration_days: durationDays,
        cycle_length_days: cycleLengthDays,
      });
      if (error) { showAlert('Erro', error.message); return; }
    }
    setShowPhaseModal(false);
    loadPhases(activeTemplateId);
  };

  const handleDeletePhase = (phase) => {
    showAlert('Excluir fase', `Excluir "${phase.name}" e todas as atividades dela?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('project_phases').delete().eq('id', phase.id);
          if (activePhaseId === phase.id) setActivePhaseId(null);
          loadPhases(activeTemplateId);
        },
      },
    ]);
  };

  const handleLongPressPhase = (phase) => {
    showAlert(phase.name, 'O que você quer fazer com essa fase?', [
      { text: 'Editar', onPress: () => openEditPhase(phase) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDeletePhase(phase) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ---- Content (educational module) CRUD ----

  const handleCreateContent = async (title) => {
    setShowCreateContentModal(false);
    const { data, error } = await supabase
      .from('project_contents')
      .insert({ project_template_id: activeTemplateId, personal_id: personalId, title, order_index: contents.length })
      .select()
      .single();
    if (error) { showAlert('Erro', error.message); return; }
    await loadContents(activeTemplateId);
    setEditingContentId(data.id);
    setBlocks([]);
  };

  const handleRenameContent = async (newTitle) => {
    const content = renamingContent;
    setRenamingContent(null);
    const { error } = await supabase.from('project_contents').update({ title: newTitle }).eq('id', content.id);
    if (error) showAlert('Erro', error.message);
    else loadContents(activeTemplateId);
  };

  const handleDeleteContent = (content) => {
    showAlert('Excluir conteúdo', `Excluir "${content.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('project_contents').delete().eq('id', content.id);
          if (editingContentId === content.id) setEditingContentId(null);
          loadContents(activeTemplateId);
        },
      },
    ]);
  };

  const handleLongPressContent = (content) => {
    showAlert(content.title, 'O que você quer fazer com esse conteúdo?', [
      { text: 'Renomear', onPress: () => setRenamingContent(content) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteContent(content) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const openContentEditor = (content) => {
    setEditingContentId(content.id);
    setBlocks(content.blocks || []);
  };

  const handleAddBlock = (type) => {
    setShowBlockTypePicker(false);
    setBlocks((prev) => [...prev, createEmptyBlock(type)]);
  };

  const handleUpdateBlock = (index, patch) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const handleUpdateBlockItem = (index, itemIndex, value) => {
    setBlocks((prev) => prev.map((b, i) => {
      if (i !== index) return b;
      const items = [...b.items];
      items[itemIndex] = value;
      return { ...b, items };
    }));
  };

  const handleAddBlockItem = (index) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, items: [...b.items, ''] } : b)));
  };

  const handleRemoveBlockItem = (index, itemIndex) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, items: b.items.filter((_, j) => j !== itemIndex) } : b)));
  };

  const handleRemoveBlock = (index) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBlocks = async () => {
    setSavingBlocks(true);
    const { error } = await supabase
      .from('project_contents')
      .update({ blocks, updated_at: new Date().toISOString() })
      .eq('id', editingContentId);
    setSavingBlocks(false);
    if (error) { showAlert('Erro', error.message); return; }
    await loadContents(activeTemplateId);
    showAlert('Salvo!', 'Conteúdo atualizado.');
  };

  // ---- Activity CRUD ----

  const openCreateActivity = (mode) => {
    setActivityForm({ mode, title: '', activity_type: 'treino', day: '', ref_session_id: null, ref_template_id: null, ref_exercise_id: null, content_id: null, ref_name: '' });
    setShowActivityModal(mode);
  };

  const openRefPicker = async () => {
    const kind = REF_KIND_BY_TYPE[activityForm.activity_type];
    if (kind === 'session') {
      setRefPickerSessions(null);
      const { data } = await supabase
        .from('workout_templates')
        .select('id, name')
        .eq('personal_id', personalId)
        .eq('archived', false)
        .order('name');
      setRefPickerTemplates(data || []);
    } else if (kind === 'exercise') {
      const { data } = await supabase.from('exercises').select('id, name, muscle_group').order('name');
      setRefPickerExercises(data || []);
      setRefPickerSearch('');
    }
    setShowRefPicker(true);
  };

  const pickRefTemplate = async (template) => {
    const { data } = await supabase
      .from('template_sessions')
      .select('id, name, order_index')
      .eq('template_id', template.id)
      .order('order_index');
    setRefPickerSessions((data || []).map((s) => ({ ...s, template_id: template.id })));
  };

  const pickRefSession = (session) => {
    setActivityForm((prev) => ({ ...prev, ref_session_id: session.id, ref_template_id: session.template_id, ref_name: session.name }));
    setShowRefPicker(false);
  };

  const pickRefExercise = (exercise) => {
    setActivityForm((prev) => ({ ...prev, ref_exercise_id: exercise.id, ref_name: exercise.name }));
    setShowRefPicker(false);
  };

  const pickRefContent = (content) => {
    setActivityForm((prev) => ({ ...prev, content_id: content.id, ref_name: content.title }));
    setShowRefPicker(false);
  };

  const handleSaveActivity = async () => {
    const day = Number(activityForm.day);
    const needsRef = REF_KIND_BY_TYPE[activityForm.activity_type] !== 'none';
    if (!activityForm.title.trim() || !day || day <= 0 || (needsRef && !activityForm.ref_name)) {
      showAlert('Ops', 'Preencha título, dia' + (needsRef ? ' e escolha uma referência.' : '.'));
      return;
    }
    const payload = {
      project_template_id: activeTemplateId,
      phase_id: activePhaseId,
      personal_id: personalId,
      activity_type: activityForm.activity_type,
      title: activityForm.title.trim(),
      order_index: activities.length,
      cycle_day: activityForm.mode === 'cycle' ? day : null,
      absolute_day: activityForm.mode === 'fixed' ? day : null,
      ref_session_id: activityForm.ref_session_id,
      ref_template_id: activityForm.ref_template_id,
      ref_exercise_id: activityForm.ref_exercise_id,
      content_id: activityForm.content_id,
    };
    const { error } = await supabase.from('project_activities').insert(payload);
    if (error) { showAlert('Erro', error.message); return; }
    setShowActivityModal(null);
    setActivityForm(null);
    loadActivities(activePhaseId);
  };

  const handleDeleteActivity = (activity) => {
    showAlert('Excluir atividade', `Excluir "${activity.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('project_activities').delete().eq('id', activity.id);
          loadActivities(activePhaseId);
        },
      },
    ]);
  };

  const cycleActivities = activities.filter((a) => a.cycle_day != null);
  const fixedActivities = activities.filter((a) => a.absolute_day != null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B00" />
      </View>
    );
  }

  // ---- Block editor view ----
  if (editingContentId) {
    const content = contents.find((c) => c.id === editingContentId);
    return (
      <View style={styles.container}>
        <HeaderBack
          title={content?.title || 'Conteúdo'}
          onBack={() => setEditingContentId(null)}
          style={{ paddingHorizontal: 16 }}
          rightSlot={
            <TouchableOpacity onPress={handleSaveBlocks} disabled={savingBlocks} hitSlop={8}>
              {savingBlocks ? <ActivityIndicator color="#FF6B00" size="small" /> : <Text style={styles.saveLink}>Salvar</Text>}
            </TouchableOpacity>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.hintText}>Monte o módulo em blocos curtos — nada de texto corrido.</Text>
          {blocks.map((block, index) => (
            <View key={index} style={styles.blockCard}>
              <View style={styles.blockHeaderRow}>
                <Text style={styles.blockTypeLabel}>{blockLabel(block.type)}</Text>
                <TouchableOpacity onPress={() => handleRemoveBlock(index)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'highlight' || block.type === 'tip') && (
                <TextInput
                  style={[styles.blockInput, block.type === 'paragraph' && { minHeight: 60 }]}
                  multiline={block.type === 'paragraph'}
                  value={block.text}
                  onChangeText={(text) => handleUpdateBlock(index, { text })}
                  placeholder="Texto..."
                  placeholderTextColor="#525252"
                />
              )}
              {block.type === 'card' && (
                <>
                  <TextInput style={styles.blockInput} value={block.title} onChangeText={(title) => handleUpdateBlock(index, { title })} placeholder="Título do card" placeholderTextColor="#525252" />
                  <TextInput style={[styles.blockInput, { marginTop: 6, minHeight: 50 }]} multiline value={block.text} onChangeText={(text) => handleUpdateBlock(index, { text })} placeholder="Texto do card" placeholderTextColor="#525252" />
                </>
              )}
              {(block.type === 'topic_list' || block.type === 'checklist') && (
                <View>
                  {block.items.map((item, itemIndex) => (
                    <View key={itemIndex} style={styles.blockItemRow}>
                      <TextInput
                        style={[styles.blockInput, { flex: 1 }]}
                        value={item}
                        onChangeText={(value) => handleUpdateBlockItem(index, itemIndex, value)}
                        placeholder={block.type === 'checklist' ? 'Item do checklist' : 'Tópico'}
                        placeholderTextColor="#525252"
                      />
                      <TouchableOpacity onPress={() => handleRemoveBlockItem(index, itemIndex)} hitSlop={8}>
                        <Ionicons name="close-circle-outline" size={18} color="#737373" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addItemButton} onPress={() => handleAddBlockItem(index)}>
                    <Text style={styles.addItemButtonText}>+ item</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addBlockButton} onPress={() => setShowBlockTypePicker(true)}>
            <Ionicons name="add" size={18} color="#FF6B00" />
            <Text style={styles.addBlockButtonText}>Adicionar Bloco</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={showBlockTypePicker} transparent animationType="slide" onRequestClose={() => setShowBlockTypePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Tipo de bloco</Text>
              {BLOCK_TYPES.map((t) => (
                <TouchableOpacity key={t.value} style={styles.pickerRow} onPress={() => handleAddBlock(t.value)}>
                  <Text style={styles.pickerRowText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowBlockTypePicker(false)}>
                <Text style={styles.modalCloseButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- Phase detail view (activities) ----
  if (activePhaseId) {
    return (
      <View style={styles.container}>
        <HeaderBack title={activePhase?.name || 'Fase'} onBack={() => setActivePhaseId(null)} style={{ paddingHorizontal: 16 }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.hintText}>Ciclo de {activePhase?.cycle_length_days} dia(s) · {activePhase?.duration_days} dia(s) de duração</Text>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Ciclo repetido</Text>
              <TouchableOpacity onPress={() => openCreateActivity('cycle')} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={20} color="#FF6B00" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>Repete a cada {activePhase?.cycle_length_days} dia(s) da fase (ex: dia 1 do ciclo = Treino A).</Text>
            {cycleActivities.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma atividade de ciclo ainda.</Text>
            ) : (
              cycleActivities.map((a) => (
                <TouchableOpacity key={a.id} style={styles.activityRow} onLongPress={() => handleDeleteActivity(a)}>
                  <Text style={styles.activityDay}>Dia {a.cycle_day}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{a.title}</Text>
                    <Text style={styles.activityType}>{ACTIVITY_TYPES.find((t) => t.value === a.activity_type)?.label}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Dias fixos</Text>
              <TouchableOpacity onPress={() => openCreateActivity('fixed')} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={20} color="#FF6B00" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>Fixado num dia específico da fase, não repete (ex: módulo educacional no dia 8).</Text>
            {fixedActivities.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum dia fixo ainda.</Text>
            ) : (
              fixedActivities.map((a) => (
                <TouchableOpacity key={a.id} style={styles.activityRow} onLongPress={() => handleDeleteActivity(a)}>
                  <Text style={styles.activityDay}>Dia {a.absolute_day}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{a.title}</Text>
                    <Text style={styles.activityType}>{ACTIVITY_TYPES.find((t) => t.value === a.activity_type)?.label}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
          <Text style={styles.hintText}>Segure uma atividade pra excluir</Text>
        </ScrollView>

        <Modal visible={!!showActivityModal} transparent animationType="slide" onRequestClose={() => setShowActivityModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
              <ScrollView>
                <Text style={styles.modalTitle}>Nova Atividade</Text>
                <TextInput
                  style={styles.newInput}
                  placeholder="Título (ex: Treino de Quadríceps A)"
                  placeholderTextColor="#737373"
                  value={activityForm?.title}
                  onChangeText={(title) => setActivityForm((prev) => ({ ...prev, title }))}
                />
                <TextInput
                  style={[styles.newInput, { marginTop: 8 }]}
                  keyboardType="number-pad"
                  placeholder={showActivityModal === 'cycle' ? `Dia do ciclo (1 a ${activePhase?.cycle_length_days})` : `Dia fixo da fase (1 a ${activePhase?.duration_days})`}
                  placeholderTextColor="#737373"
                  value={activityForm?.day}
                  onChangeText={(day) => setActivityForm((prev) => ({ ...prev, day }))}
                />
                <Text style={[styles.sectionSubtitle, { marginTop: 12, marginBottom: 6 }]}>Tipo de atividade</Text>
                <View style={styles.typeRow}>
                  {ACTIVITY_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.typePill, activityForm?.activity_type === t.value && styles.typePillActive]}
                      onPress={() => setActivityForm((prev) => ({ ...prev, activity_type: t.value, ref_session_id: null, ref_template_id: null, ref_exercise_id: null, content_id: null, ref_name: '' }))}
                    >
                      <Text style={[styles.typePillText, activityForm?.activity_type === t.value && styles.typePillTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {REF_KIND_BY_TYPE[activityForm?.activity_type] === 'none' ? (
                  <Text style={styles.sectionSubtitle}>Sem referência — dia de descanso ativo, sem ação obrigatória.</Text>
                ) : (
                <TouchableOpacity style={styles.refButton} onPress={openRefPicker}>
                  <Ionicons name="link-outline" size={16} color="#FF6B00" />
                  <Text style={styles.refButtonText}>{activityForm?.ref_name || 'Escolher referência'}</Text>
                </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveMetaButton} onPress={handleSaveActivity}>
                  <Text style={styles.saveMetaButtonText}>Salvar Atividade</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowActivityModal(null)}>
                  <Text style={styles.modalCloseButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showRefPicker} transparent animationType="slide" onRequestClose={() => setShowRefPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
              {REF_KIND_BY_TYPE[activityForm?.activity_type] === 'session' ? (
                <>
                  <Text style={styles.modalTitle}>{refPickerSessions ? 'Escolha a ficha' : 'Escolha o template'}</Text>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {refPickerSessions
                      ? refPickerSessions.map((s) => (
                          <TouchableOpacity key={s.id} style={styles.pickerRow} onPress={() => pickRefSession(s)}>
                            <Text style={styles.pickerRowText}>{s.name}</Text>
                          </TouchableOpacity>
                        ))
                      : refPickerTemplates.map((t) => (
                          <TouchableOpacity key={t.id} style={styles.pickerRow} onPress={() => pickRefTemplate(t)}>
                            <Text style={styles.pickerRowText}>{t.name}</Text>
                          </TouchableOpacity>
                        ))}
                  </ScrollView>
                  {refPickerSessions && (
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setRefPickerSessions(null)}>
                      <Text style={styles.modalCloseButtonText}>← Voltar pros templates</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : REF_KIND_BY_TYPE[activityForm?.activity_type] === 'exercise' ? (
                <>
                  <Text style={styles.modalTitle}>Escolha o exercício</Text>
                  <TextInput style={styles.newInput} placeholder="Buscar exercício..." placeholderTextColor="#737373" value={refPickerSearch} onChangeText={setRefPickerSearch} />
                  <ScrollView style={{ maxHeight: 300, marginTop: 8 }}>
                    {refPickerExercises
                      .filter((e) => e.name.toLowerCase().includes(refPickerSearch.toLowerCase()))
                      .map((e) => (
                        <TouchableOpacity key={e.id} style={styles.pickerRow} onPress={() => pickRefExercise(e)}>
                          <Text style={styles.pickerRowText}>{e.name}</Text>
                          <Text style={styles.pickerRowSubtext}>{e.muscle_group}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Escolha o conteúdo</Text>
                  {contents.length === 0 ? (
                    <Text style={styles.emptyText}>Crie um módulo em &quot;Conteúdos&quot; primeiro.</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 300 }}>
                      {contents.map((c) => (
                        <TouchableOpacity key={c.id} style={styles.pickerRow} onPress={() => pickRefContent(c)}>
                          <Text style={styles.pickerRowText}>{c.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowRefPicker(false)}>
                <Text style={styles.modalCloseButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- Template list / detail view ----
  return (
    <View style={styles.container}>
      <HeaderBack
        title="Projetos"
        onBack={onClose}
        style={{ paddingHorizontal: 16 }}
        rightSlot={
          <TouchableOpacity onPress={() => setShowTemplateModal(true)} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={22} color="#FF6B00" />
          </TouchableOpacity>
        }
      />

      {templates.length === 0 ? (
        <View style={styles.emptyStateBox}>
          <Ionicons name="rocket-outline" size={36} color="#525252" />
          <Text style={styles.emptyStateTitle}>Nenhum projeto ainda</Text>
          <Text style={styles.emptyStateSubtitle}>Crie um programa reutilizável de várias fases e dias (ex: &quot;Quadríceps Grandes e Fortes — 90 Dias&quot;).</Text>
          <TouchableOpacity style={styles.emptyStatePrimaryButton} onPress={() => setShowTemplateModal(true)}>
            <Ionicons name="add" size={18} color="#0F0F12" />
            <Text style={styles.emptyStatePrimaryButtonText}>Criar Projeto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 44, flexGrow: 0, marginBottom: 6, paddingLeft: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateTab, activeTemplateId === t.id && styles.templateTabActive, t.archived && styles.templateTabArchived]}
                  onPress={() => setActiveTemplateId(t.id)}
                  onLongPress={() => handleLongPressTemplate(t)}
                >
                  <Text style={[styles.templateTabText, activeTemplateId === t.id && styles.templateTabTextActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.hintText}>Segure um projeto pra renomear, arquivar ou excluir</Text>

          {!activeTemplateId ? (
            <Text style={styles.emptyText}>Escolha um projeto acima.</Text>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
              <View style={styles.bigCard}>
                <Text style={styles.bigCardTitle}>Duração Total</Text>
                <View style={styles.metaInputsRow}>
                  <TextInput style={[styles.metaInput, { flex: 1, textAlign: 'left' }]} keyboardType="number-pad" placeholder="90" placeholderTextColor="#525252" value={totalDaysDraft} onChangeText={setTotalDaysDraft} />
                  <Text style={styles.metaFieldLabel}>dias</Text>
                  <TouchableOpacity style={styles.metaSaveButton} onPress={handleSaveTemplateMeta} disabled={savingTemplateMeta}>
                    {savingTemplateMeta ? <ActivityIndicator color="#FF6B00" size="small" /> : <Text style={styles.metaSaveButtonText}>Salvar</Text>}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.ebookButton} onPress={handlePickEbookPdf} disabled={uploadingEbook}>
                  <Ionicons name="document-attach-outline" size={16} color="#FF6B00" />
                  <Text style={styles.ebookButtonText}>
                    {uploadingEbook ? 'Enviando...' : activeTemplate?.ebook_pdf_url ? 'E-book enviado — trocar PDF' : 'Anexar e-book complementar (PDF)'}
                  </Text>
                </TouchableOpacity>
              </View>

              <CollapsibleSection
                title={`Fases (${phases.length})`}
                collapsed={collapsedPhases}
                onToggle={() => setCollapsedPhases((v) => !v)}
                headerRight={<TouchableOpacity onPress={openCreatePhase} hitSlop={8}><Ionicons name="add-circle-outline" size={20} color="#FF6B00" /></TouchableOpacity>}
                style={{ marginBottom: 16 }}
              >
                {phases.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma fase ainda.</Text>
                ) : (
                  phases.map((p) => (
                    <TouchableOpacity key={p.id} style={styles.listRow} onPress={() => setActivePhaseId(p.id)} onLongPress={() => handleLongPressPhase(p)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listRowTitle}>{p.name}</Text>
                        <Text style={styles.listRowSubtitle}>{p.duration_days} dia(s) · ciclo de {p.cycle_length_days} dia(s)</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title={`Conteúdos (${contents.length})`}
                collapsed={collapsedContents}
                onToggle={() => setCollapsedContents((v) => !v)}
                headerRight={<TouchableOpacity onPress={() => setShowCreateContentModal(true)} hitSlop={8}><Ionicons name="add-circle-outline" size={20} color="#FF6B00" /></TouchableOpacity>}
              >
                {contents.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum módulo educacional ainda.</Text>
                ) : (
                  contents.map((c) => (
                    <TouchableOpacity key={c.id} style={styles.listRow} onPress={() => openContentEditor(c)} onLongPress={() => handleLongPressContent(c)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listRowTitle}>{c.title}</Text>
                        <Text style={styles.listRowSubtitle}>{(c.blocks || []).length} bloco(s)</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))
                )}
              </CollapsibleSection>
            </ScrollView>
          )}
        </View>
      )}

      <Modal visible={showTemplateModal} transparent animationType="slide" onRequestClose={() => setShowTemplateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Criar Projeto</Text>
            <Text style={styles.modalSubtitle}>Dá um nome e a duração total. Fases e atividades você adiciona depois.</Text>
            <TextInput style={styles.newInput} placeholder="ex: Quadríceps Grandes e Fortes" placeholderTextColor="#737373" value={templateForm.name} onChangeText={(name) => setTemplateForm((prev) => ({ ...prev, name }))} />
            <TextInput style={[styles.newInput, { marginTop: 8 }]} keyboardType="number-pad" placeholder="Duração total em dias (ex: 90)" placeholderTextColor="#737373" value={templateForm.totalDays} onChangeText={(totalDays) => setTemplateForm((prev) => ({ ...prev, totalDays }))} />
            <TouchableOpacity style={styles.saveMetaButton} onPress={handleCreateTemplate}>
              <Text style={styles.saveMetaButtonText}>Criar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowTemplateModal(false)}>
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPhaseModal} transparent animationType="slide" onRequestClose={() => setShowPhaseModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingPhase ? 'Editar Fase' : 'Nova Fase'}</Text>
            <TextInput style={styles.newInput} placeholder="ex: Fase 1 — Base" placeholderTextColor="#737373" value={phaseForm.name} onChangeText={(name) => setPhaseForm((prev) => ({ ...prev, name }))} />
            <TextInput style={[styles.newInput, { marginTop: 8 }]} keyboardType="number-pad" placeholder="Duração da fase em dias (ex: 30)" placeholderTextColor="#737373" value={phaseForm.durationDays} onChangeText={(durationDays) => setPhaseForm((prev) => ({ ...prev, durationDays }))} />
            <TextInput style={[styles.newInput, { marginTop: 8 }]} keyboardType="number-pad" placeholder="Tamanho do ciclo em dias (ex: 7)" placeholderTextColor="#737373" value={phaseForm.cycleLengthDays} onChangeText={(cycleLengthDays) => setPhaseForm((prev) => ({ ...prev, cycleLengthDays }))} />
            <TouchableOpacity style={styles.saveMetaButton} onPress={handleSavePhase}>
              <Text style={styles.saveMetaButtonText}>{editingPhase ? 'Salvar' : 'Criar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowPhaseModal(false)}>
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PromptModal
        visible={!!renamingTemplate}
        title="Renomear projeto"
        subtitle="Digite o novo nome:"
        initialValue={renamingTemplate?.name}
        onCancel={() => setRenamingTemplate(null)}
        onSubmit={handleRenameTemplate}
      />

      <PromptModal
        visible={!!renamingContent}
        title="Renomear conteúdo"
        subtitle="Digite o novo título:"
        initialValue={renamingContent?.title}
        onCancel={() => setRenamingContent(null)}
        onSubmit={handleRenameContent}
      />

      <PromptModal
        visible={showCreateContentModal}
        title="Novo Conteúdo"
        subtitle='Dá um título (ex: "Como o quadríceps cresce"). Você monta os blocos depois.'
        initialValue=""
        onCancel={() => setShowCreateContentModal(false)}
        onSubmit={handleCreateContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  emptyStateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyStateTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyStateSubtitle: { color: '#737373', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 10 },
  emptyStatePrimaryButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  emptyStatePrimaryButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  templateTab: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 18, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
  templateTabActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  templateTabArchived: { opacity: 0.5 },
  templateTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  templateTabTextActive: { color: '#0F0F12' },
  bigCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 16 },
  bigCardTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaInputsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  metaFieldLabel: { color: '#525252', fontSize: 11 },
  metaInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 13 },
  metaSaveButton: { paddingHorizontal: 10, paddingVertical: 9 },
  metaSaveButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },
  ebookButton: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2B2B36' },
  ebookButtonText: { color: '#FF6B00', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 12, marginTop: 8 },
  listRowTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  listRowSubtitle: { color: '#737373', fontSize: 11, marginTop: 2 },
  chevron: { color: '#525252', fontSize: 20, fontWeight: '300' },
  sectionCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '800' },
  sectionSubtitle: { color: '#737373', fontSize: 11, marginTop: 4, marginBottom: 8, lineHeight: 15 },
  activityRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#0F0F12', borderRadius: 10, padding: 10, marginTop: 6 },
  activityDay: { color: '#FF6B00', fontSize: 11, fontWeight: '800', width: 52 },
  activityTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  activityType: { color: '#737373', fontSize: 10, marginTop: 2 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typePill: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  typePillActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  typePillText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  typePillTextActive: { color: '#0F0F12' },
  refButton: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, padding: 12, marginTop: 12 },
  refButtonText: { color: '#F5F5F7', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  newInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#F5F5F7', fontSize: 13 },
  saveMetaButton: { backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveMetaButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 16, lineHeight: 17 },
  modalCloseButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  pickerRow: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  pickerRowText: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  pickerRowSubtext: { color: '#737373', fontSize: 10, marginTop: 2 },
  saveLink: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
  blockCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 12, marginBottom: 10 },
  blockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  blockTypeLabel: { color: '#FF6B00', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  blockInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 13 },
  blockItemRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  addItemButton: { alignSelf: 'flex-start', marginTop: 2 },
  addItemButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },
  addBlockButton: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2B2B36', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addBlockButtonText: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
});

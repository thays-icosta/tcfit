import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { ANAMNESE_QUESTION_TYPES } from './accessLevel';
import { HeaderBack } from './Header';

export default function AnamneseConfigScreen({ personalId, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('texto_curto');
  const [required, setRequired] = useState(true);
  const [optionsList, setOptionsList] = useState([]);
  const [newOption, setNewOption] = useState('');

  const loadQuestions = async () => {
    const { data } = await supabase.from('anamnese_questions').select('*').eq('personal_id', personalId).order('order_index');
    setQuestions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setQuestionText('');
    setQuestionType('texto_curto');
    setRequired(true);
    setOptionsList([]);
    setNewOption('');
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (q) => {
    setEditingId(q.id);
    setQuestionText(q.question_text || '');
    setQuestionType(q.question_type || 'texto_curto');
    setRequired(q.required !== false);
    setOptionsList(q.options || []);
    setShowForm(true);
  };

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    setOptionsList((prev) => [...prev, newOption.trim()]);
    setNewOption('');
  };

  const handleRemoveOption = (index) => {
    setOptionsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!questionText.trim()) {
      showAlert('Ops', 'Escreve a pergunta.');
      return;
    }
    if (questionType === 'multipla_escolha' && optionsList.length < 2) {
      showAlert('Ops', 'Adiciona pelo menos duas opções pra múltipla escolha.');
      return;
    }
    setSaving(true);
    const payload = {
      personal_id: personalId,
      question_text: questionText.trim(),
      question_type: questionType,
      options: questionType === 'multipla_escolha' ? optionsList : null,
      required,
      order_index: editingId ? undefined : questions.length,
    };
    if (editingId) delete payload.order_index;

    let error;
    if (editingId) {
      ({ error } = await supabase.from('anamnese_questions').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('anamnese_questions').insert(payload));
    }
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setShowForm(false);
      resetForm();
      loadQuestions();
    }
  };

  const handleToggleActive = async (q) => {
    await supabase.from('anamnese_questions').update({ active: !q.active }).eq('id', q.id);
    loadQuestions();
  };

  const handleDelete = (q) => {
    showAlert('Excluir pergunta', 'Tem certeza? As respostas já dadas por alunos também serão apagadas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('anamnese_questions').delete().eq('id', q.id);
          loadQuestions();
        },
      },
    ]);
  };

  if (showForm) {
    return (
      <View style={styles.container}>
        <HeaderBack title={editingId ? 'Editar Pergunta' : 'Nova Pergunta'} onBack={() => setShowForm(false)} style={{ paddingHorizontal: 16 }} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.label}>Pergunta</Text>
          <TextInput style={styles.input} placeholder="ex: Você já fez cirurgia?" placeholderTextColor="#525252" value={questionText} onChangeText={setQuestionText} />

          <Text style={styles.label}>Tipo de Resposta</Text>
          <View style={styles.chipRow}>
            {ANAMNESE_QUESTION_TYPES.map((t) => (
              <TouchableOpacity key={t.value} style={[styles.chip, questionType === t.value && styles.chipActive]} onPress={() => setQuestionType(t.value)}>
                <Text style={[styles.chipText, questionType === t.value && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {questionType === 'multipla_escolha' && (
            <>
              <Text style={styles.label}>Opções</Text>
              {optionsList.map((opt, i) => (
                <View key={i} style={styles.optionRow}>
                  <Text style={styles.optionText}>{opt}</Text>
                  <TouchableOpacity onPress={() => handleRemoveOption(i)}>
                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.newOptionRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nova opção"
                  placeholderTextColor="#525252"
                  value={newOption}
                  onChangeText={setNewOption}
                  onSubmitEditing={handleAddOption}
                />
                <TouchableOpacity style={styles.addOptionButton} onPress={handleAddOption}>
                  <Text style={styles.addOptionButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Pergunta obrigatória</Text>
            <Switch value={required} onValueChange={setRequired} trackColor={{ false: '#292524', true: '#f97316' }} thumbColor="#f5f5f5" />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Pergunta</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title="Configurar Anamnese" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <Text style={styles.hint}>Objetivo, Local de Treino, Lesões e Zonas de Dor já vêm prontos pra todo mundo. Aqui você adiciona perguntas extras.</Text>

      <TouchableOpacity style={styles.newButton} onPress={handleOpenNew}>
        <Text style={styles.newButtonText}>+ Nova Pergunta</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {questions.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma pergunta extra cadastrada ainda.</Text>
          ) : (
            questions.map((q) => (
              <View key={q.id} style={[styles.questionCard, !q.active && styles.questionCardInactive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.questionText}>{q.question_text}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaBadge}>{ANAMNESE_QUESTION_TYPES.find((t) => t.value === q.question_type)?.label}</Text>
                    {q.required && <Text style={styles.metaBadge}>Obrigatória</Text>}
                    {!q.active && <Text style={[styles.metaBadge, styles.metaBadgeInactive]}>Oculta</Text>}
                  </View>
                </View>
                <View style={styles.questionActions}>
                  <TouchableOpacity hitSlop={8} onPress={() => handleToggleActive(q)}>
                    <Ionicons name={q.active ? 'eye-outline' : 'eye-off-outline'} size={18} color="#a3a3a3" />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={8} onPress={() => handleOpenEdit(q)}>
                    <Ionicons name="create-outline" size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={8} onPress={() => handleDelete(q)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  hint: { color: '#737373', fontSize: 11, paddingHorizontal: 16, marginBottom: 14, lineHeight: 16 },
  newButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  newButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  questionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  questionCardInactive: { opacity: 0.5 },
  questionText: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaBadge: { color: '#a3a3a3', fontSize: 9, fontWeight: '700', backgroundColor: '#0a0a0a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  metaBadgeInactive: { color: '#ef4444' },
  questionActions: { flexDirection: 'row', gap: 12 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  optionText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  newOptionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addOptionButton: { backgroundColor: '#f97316', width: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addOptionButtonText: { color: '#0a0a0a', fontSize: 18, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  switchLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { supabase } from './supabaseClient';

export default function ConsultationPlansManagerScreen({ personalId, onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [durationLabel, setDurationLabel] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [bullets, setBullets] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('Olá! Gostaria de contratar o plano {plano}.');
  const [active, setActive] = useState(true);

  const loadPlans = async () => {
    const { data } = await supabase
      .from('consultation_plans')
      .select('*')
      .eq('personal_id', personalId)
      .order('order_index', { ascending: true });
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDurationLabel('');
    setPrice('');
    setDescription('');
    setBullets('');
    setWhatsappMessage('Olá! Gostaria de contratar o plano {plano}.');
    setActive(true);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingId(plan.id);
    setName(plan.name || '');
    setDurationLabel(plan.duration_label || '');
    setPrice(plan.price != null ? String(plan.price) : '');
    setDescription(plan.description || '');
    setBullets(plan.bullets || '');
    setWhatsappMessage(plan.whatsapp_message || 'Olá! Gostaria de contratar o plano {plano}.');
    setActive(plan.active !== false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Ops', 'Digita o nome do plano (ex: "Mensal", "Trimestral").');
      return;
    }
    setSaving(true);
    const payload = {
      personal_id: personalId,
      name: name.trim(),
      duration_label: durationLabel.trim() || null,
      price: price ? Number(price) : null,
      description: description.trim() || null,
      bullets: bullets.trim() || null,
      whatsapp_message: whatsappMessage.trim() || null,
      active,
      order_index: editingId ? undefined : plans.length,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('consultation_plans').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('consultation_plans').insert(payload));
    }
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setShowForm(false);
      resetForm();
      loadPlans();
    }
  };

  const handleDelete = (planId) => {
    Alert.alert('Excluir plano', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('consultation_plans').delete().eq('id', planId);
          loadPlans();
        },
      },
    ]);
  };

  if (showForm) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.closeText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Editar Plano' : 'Novo Plano'}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.label}>Nome do plano</Text>
          <TextInput style={styles.input} placeholder="ex: Mensal, Trimestral, Semestral, Anual" placeholderTextColor="#525252" value={name} onChangeText={setName} />

          <Text style={styles.label}>Duração (texto livre)</Text>
          <TextInput style={styles.input} placeholder="ex: 3 meses" placeholderTextColor="#525252" value={durationLabel} onChangeText={setDurationLabel} />

          <Text style={styles.label}>Preço (R$)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="ex: 450" placeholderTextColor="#525252" value={price} onChangeText={setPrice} />

          <Text style={styles.label}>Descrição curta</Text>
          <TextInput style={styles.textArea} multiline placeholder="ex: Ideal pra quem quer testar o acompanhamento" placeholderTextColor="#525252" value={description} onChangeText={setDescription} />

          <Text style={styles.label}>Benefícios (um por linha)</Text>
          <TextInput
            style={styles.textArea}
            multiline
            placeholder={'ex:\nAcompanhamento semanal\nAjustes de treino e dieta ilimitados'}
            placeholderTextColor="#525252"
            value={bullets}
            onChangeText={setBullets}
          />

          <Text style={styles.label}>Mensagem do WhatsApp</Text>
          <TextInput style={styles.textArea} multiline value={whatsappMessage} onChangeText={setWhatsappMessage} />
          <Text style={styles.hint}>Use {'{plano}'} onde quiser que apareça o nome do plano.</Text>

          <View style={styles.activeRow}>
            <Text style={styles.activeLabel}>Plano ativo (aparece na vitrine)</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ false: '#292524', true: '#f97316' }} thumbColor="#f5f5f5" />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Plano</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Venda de Consultoria</Text>
      </View>

      <TouchableOpacity style={styles.newButton} onPress={handleOpenNew}>
        <Text style={styles.newButtonText}>+ Adicionar Novo Plano</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {plans.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum plano cadastrado ainda.</Text>
          ) : (
            plans.map((p) => (
              <View key={p.id} style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{p.name}{!p.active ? ' (inativo)' : ''}</Text>
                  <Text style={styles.planMeta}>
                    {p.duration_label ? `${p.duration_label} · ` : ''}{p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : 'Consulte'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleOpenEdit(p)}>
                  <Text style={styles.editLink}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(p.id)}>
                  <Text style={styles.deleteLink}>🗑️</Text>
                </TouchableOpacity>
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
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  newButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  newButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  planRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 10 },
  planName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  planMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  editLink: { color: '#3b82f6', fontSize: 11, fontWeight: '700', marginRight: 12 },
  deleteLink: { fontSize: 14 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  textArea: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  hint: { color: '#525252', fontSize: 9, marginTop: 4, lineHeight: 13 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  activeLabel: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
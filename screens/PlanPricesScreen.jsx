import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PlanPricesScreen({ onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlans = async () => {
    const { data } = await supabase.from('plan_prices').select('*').order('plan_key');
    setPlans(
      (data || []).map((p) => ({
        ...p,
        priceInput: p.price != null ? String(p.price) : '',
        bulletsInput: p.bullets || '',
        messageInput: p.whatsapp_message || 'Olá! Gostaria de contratar o plano {plano}.',
        nameInput: p.plan_name || '',
        durationInput: p.duration_label || '',
        isFeatured: p.is_featured || false,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleChange = (planKey, field, value) => {
    setPlans((prev) => prev.map((p) => (p.plan_key === planKey ? { ...p, [field]: value } : p)));
  };

  const handleAddPlan = () => {
    const newKey = `custom_${uuidv4()}`;
    setPlans((prev) => [
      ...prev,
      {
        plan_key: newKey,
        isNew: true,
        nameInput: '',
        durationInput: '',
        priceInput: '',
        bulletsInput: '',
        messageInput: 'Olá! Gostaria de contratar o plano {plano}.',
        isFeatured: false,
      },
    ]);
  };

  const handleDeletePlan = (planKey, isNew) => {
    if (isNew) {
      setPlans((prev) => prev.filter((p) => p.plan_key !== planKey));
      return;
    }
    showAlert('Excluir plano', 'Tem certeza? Ele vai sumir da vitrine.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('plan_prices').delete().eq('plan_key', planKey);
          loadPlans();
        },
      },
    ]);
  };

  const handleSave = async () => {
    for (const plan of plans) {
      if (!plan.nameInput.trim()) continue;
      const payload = {
        plan_key: plan.plan_key,
        plan_name: plan.nameInput.trim(),
        duration_label: plan.durationInput.trim() || null,
        price: plan.priceInput ? Number(plan.priceInput) : null,
        bullets: plan.bulletsInput.trim() || null,
        whatsapp_message: plan.messageInput.trim() || null,
        is_featured: plan.isFeatured,
      };
      if (plan.isNew) {
        await supabase.from('plan_prices').insert(payload);
      } else {
        await supabase.from('plan_prices').update(payload).eq('plan_key', plan.plan_key);
      }
    }
    setSaving(false);
    showAlert('Salvo!', 'Os planos de consultoria foram atualizados na vitrine.', [{ text: 'OK', onPress: loadPlans }]);
  };

  const handleSaveWithLoading = async () => {
    setSaving(true);
    await handleSave();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Venda de Consultoria</Text>
      </View>

      <Text style={styles.hint}>Cadastre quantos planos quiser (Mensal, Trimestral, Semestral...). Tudo aqui aparece na vitrine antes do login.</Text>

      {plans.map((plan) => (
        <View key={plan.plan_key} style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <TextInput
              style={styles.nameInput}
              placeholder="Nome do plano (ex: Trimestral)"
              placeholderTextColor="#525252"
              value={plan.nameInput}
              onChangeText={(t) => handleChange(plan.plan_key, 'nameInput', t)}
            />
            <TouchableOpacity onPress={() => handleDeletePlan(plan.plan_key, plan.isNew)}>
              <Text style={styles.deleteLink}>🗑️</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Duração</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: 3 meses"
            placeholderTextColor="#525252"
            value={plan.durationInput}
            onChangeText={(t) => handleChange(plan.plan_key, 'durationInput', t)}
          />

          <Text style={styles.fieldLabel}>Preço (R$)</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              style={styles.priceInput}
              keyboardType="decimal-pad"
              placeholder="ex: 150"
              placeholderTextColor="#525252"
              value={plan.priceInput}
              onChangeText={(t) => handleChange(plan.plan_key, 'priceInput', t)}
            />
          </View>
          <Text style={styles.smallHint}>Deixe em branco pra mostrar "Consulte".</Text>

          <Text style={styles.fieldLabel}>Benefícios (um por linha)</Text>
          <TextInput
            style={styles.bulletsInput}
            multiline
            placeholder={'ex:\nFichas de treino personalizadas\nAcompanhamento semanal'}
            placeholderTextColor="#525252"
            value={plan.bulletsInput}
            onChangeText={(t) => handleChange(plan.plan_key, 'bulletsInput', t)}
          />

          <Text style={styles.fieldLabel}>Mensagem do WhatsApp</Text>
          <TextInput
            style={styles.messageInput}
            multiline
            placeholder="Olá! Gostaria de contratar o plano {plano}."
            placeholderTextColor="#525252"
            value={plan.messageInput}
            onChangeText={(t) => handleChange(plan.plan_key, 'messageInput', t)}
          />
          <Text style={styles.smallHint}>Use {'{plano}'} onde quiser que apareça o nome do plano.</Text>

          <View style={styles.featuredRow}>
            <Text style={styles.featuredLabel}>Destacar como "MAIS RECOMENDADO"</Text>
            <Switch
              value={plan.isFeatured}
              onValueChange={(v) => handleChange(plan.plan_key, 'isFeatured', v)}
              trackColor={{ false: '#292524', true: '#a855f7' }}
              thumbColor="#f5f5f5"
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addPlanButton} onPress={handleAddPlan}>
        <Text style={styles.addPlanButtonText}>+ Adicionar Novo Plano</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveWithLoading} disabled={saving}>
        {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Tudo</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  hint: { color: '#737373', fontSize: 11, marginBottom: 20, lineHeight: 16 },
  planCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16 },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { flex: 1, color: '#f5f5f5', fontSize: 15, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: '#292524', paddingBottom: 6 },
  deleteLink: { fontSize: 16 },
  fieldLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: '#f5f5f5', fontSize: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currencyPrefix: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  priceInput: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: '#f5f5f5', fontSize: 14 },
  bulletsInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  messageInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 50, textAlignVertical: 'top' },
  smallHint: { color: '#525252', fontSize: 9, marginTop: 4, lineHeight: 13 },
  featuredRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  featuredLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  addPlanButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  addPlanButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700' },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
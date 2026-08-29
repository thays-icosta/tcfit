import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';

const WHATSAPP_NUMBER = '5537998231382';
const ICONS = ['barbell-outline', 'restaurant-outline', 'sparkles-outline', 'flash-outline', 'trophy-outline'];
const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

export default function PlansScreen({ onBack, onLogin }) {
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [addonProducts, setAddonProducts] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: plansData } = await supabase.from('plan_prices').select('*').order('plan_key');
      setPlans(plansData || []);

      const { data: templatesData } = await supabase
        .from('workout_templates')
        .select('id, name, description, price')
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      setTemplates(templatesData || []);

      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, description, price')
        .eq('active', true)
        .eq('show_as_addon', true);
      setAddonProducts(productsData || []);

      const cleanTargetPhone = WHATSAPP_NUMBER.replace(/\D/g, '');
      const { data: allPersonals } = await supabase
        .from('personal_public_info')
        .select('pix_key, payment_link, phone');

      let matchedPersonal = null;
      if (allPersonals && allPersonals.length > 0) {
        matchedPersonal =
          allPersonals.find((p) => p.phone && p.phone.replace(/\D/g, '').length >= 8 && p.phone.replace(/\D/g, '').slice(-8) === cleanTargetPhone.slice(-8))
          || allPersonals.find((p) => p.pix_key)
          || allPersonals[0];
      }
      if (matchedPersonal) {
        setPaymentInfo({ pixKey: matchedPersonal.pix_key, paymentLink: matchedPersonal.payment_link });
      }

      setLoading(false);
    })();
  }, []);

  const handleOpenCheckout = (target) => {
    setSelectedAddons([]);
    setPixCopied(false);
    setCheckoutTarget(target);
  };

  const handleToggleAddon = (product) => {
    setSelectedAddons((prev) =>
      prev.some((p) => p.id === product.id) ? prev.filter((p) => p.id !== product.id) : [...prev, product]
    );
  };

  const handleCopyPix = async () => {
    if (!paymentInfo?.pixKey) return;
    await Clipboard.setStringAsync(paymentInfo.pixKey);
    setPixCopied(true);
    Alert.alert('Copiado!', 'Chave Pix copiada com sucesso!');
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleConfirmCheckout = async () => {
    const target = checkoutTarget;
    setCheckoutTarget(null);
    let message;
    if (target.kind === 'plan') {
      const template = target.data.whatsapp_message || 'Olá! Gostaria de contratar o plano {plano}.';
      message = template.replace('{plano}', target.data.plan_name || '');
    } else {
      message = `Olá! Vi o treino pronto "${target.data.name}" no app e gostaria de contratar.`;
    }
    if (selectedAddons.length > 0) {
      message += ` Também tenho interesse em: ${selectedAddons.map((a) => a.name).join(', ')}.`;
    }
    if (paymentInfo?.pixKey) {
      message += ' Já copiei a chave Pix para realizar o pagamento.';
    }
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const renderPlanCard = (plan, i) => {
    const hasPrice = plan.price != null;
    const color = COLORS[i % COLORS.length];
    const icon = ICONS[i % ICONS.length];
    const bullets = (plan.bullets || '').split('\n').map((b) => b.trim()).filter(Boolean);

    return (
      <View key={plan.plan_key} style={[styles.planCard, plan.is_featured && styles.planCardHighlight]}>
        {plan.is_featured && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MAIS RECOMENDADO</Text>
          </View>
        )}
        <View style={[styles.planIconCircle, { borderColor: color }]}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        <Text style={styles.planName}>{plan.plan_name}</Text>
        {plan.duration_label ? <Text style={styles.planDuration}>{plan.duration_label}</Text> : null}

        {bullets.length > 0 && (
          <View style={styles.bulletsBox}>
            {bullets.map((bullet, j) => (
              <View key={j} style={styles.bulletRow}>
                <Ionicons name="checkmark-outline" size={14} color={color} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.planPrice, { color }]}>
          {hasPrice ? `R$ ${Number(plan.price).toFixed(2).replace('.', ',')}` : 'Consulte'}
        </Text>
        <TouchableOpacity style={[styles.wantButton, { backgroundColor: color }]} onPress={() => handleOpenCheckout({ kind: 'plan', data: plan })}>
          <Text style={styles.wantButtonText}>Quero meu Protocolo</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Protocolos & Consultoria</Text>
        <Text style={styles.subtitle}>Escolha o plano ideal pra sua rotina</Text>

        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
        ) : (
          <>
            {plans.filter((p) => p.plan_name).map((plan, i) => renderPlanCard(plan, i))}

            {templates.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Treinos Prontos</Text>
                <Text style={styles.sectionSubtitle}>Fichas montadas por especialista, prontas pra começar hoje</Text>
                {templates.map((t) => (
                  <View key={t.id} style={styles.templateCard}>
                    <View style={styles.templateIconCircle}>
                      <Ionicons name="flash-outline" size={22} color="#f97316" />
                    </View>
                    <Text style={styles.templateName}>{t.name}</Text>
                    {t.description ? <Text style={styles.templateDescription}>{t.description}</Text> : null}
                    <Text style={styles.templatePrice}>
                      {t.price != null ? `R$ ${Number(t.price).toFixed(2).replace('.', ',')}` : 'Consulte'}
                    </Text>
                    <TouchableOpacity style={styles.templateWantButton} onPress={() => handleOpenCheckout({ kind: 'template', data: t })}>
                      <Text style={styles.templateWantButtonText}>Quero esse treino</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <TouchableOpacity style={styles.loginLink} onPress={onLogin}>
          <Text style={styles.loginLinkText}>Já tenho conta — Entrar</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!checkoutTarget} transparent animationType="slide" onRequestClose={() => setCheckoutTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.checkoutSheet}>
            <Text style={styles.modalTitle}>
              {checkoutTarget?.kind === 'plan' ? checkoutTarget.data.plan_name : checkoutTarget?.data.name}
            </Text>

            {addonProducts.length > 0 ? (
              <>
                <Text style={styles.modalSubtitle}>Quer adicionar algo a mais? (opcional)</Text>
                <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
                  {addonProducts.map((product) => {
                    const isSelected = selectedAddons.some((p) => p.id === product.id);
                    return (
                      <TouchableOpacity key={product.id} style={[styles.addonRow, isSelected && styles.addonRowSelected]} onPress={() => handleToggleAddon(product)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addonName}>{product.name}</Text>
                          {product.price != null && <Text style={styles.addonPrice}>+ R$ {Number(product.price).toFixed(2)}</Text>}
                        </View>
                        <Text style={styles.addonCheck}>{isSelected ? '✓' : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <Text style={styles.modalSubtitle}>Confirme pra falar direto com o profissional no WhatsApp.</Text>
            )}

            {paymentInfo?.pixKey && (
              <TouchableOpacity style={styles.copyPixButton} onPress={handleCopyPix}>
                <Ionicons name={pixCopied ? 'checkmark-outline' : 'copy-outline'} size={16} color="#3b82f6" />
                <Text style={styles.copyPixButtonText}>{pixCopied ? 'Chave Pix copiada!' : 'Copiar Chave Pix'}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setCheckoutTarget(null)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmCheckout}>
                <Ionicons name="logo-whatsapp" size={16} color="#0a0a0a" />
                <Text style={styles.modalConfirmButtonText}>Enviar no WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 20 },
  topBar: { marginBottom: 8 },
  backText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  subtitle: { color: '#a3a3a3', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  planCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 16 },
  planCardHighlight: { borderColor: '#a855f7', borderWidth: 1.5 },
  badge: { position: 'absolute', top: -10, backgroundColor: '#a855f7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#0a0a0a', fontSize: 9, fontWeight: '800' },
  planIconCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 12, marginTop: 8 },
  planName: { color: '#f5f5f5', fontSize: 17, fontWeight: '800' },
  planDuration: { color: '#737373', fontSize: 11, marginTop: 2, marginBottom: 12 },
  bulletsBox: { alignSelf: 'stretch', marginBottom: 16, marginTop: 14 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bulletText: { color: '#a3a3a3', fontSize: 12, flexShrink: 1 },
  planPrice: { fontSize: 26, fontWeight: '800', marginBottom: 14 },
  wantButton: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, marginTop: 4, width: '100%', alignItems: 'center' },
  wantButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 4 },
  sectionSubtitle: { color: '#737373', fontSize: 12, marginBottom: 16 },
  templateCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 14 },
  templateIconCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  templateName: { color: '#f5f5f5', fontSize: 15, fontWeight: '800' },
  templateDescription: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  templatePrice: { color: '#f97316', fontSize: 20, fontWeight: '800', marginTop: 12 },
  templateWantButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 14, width: '100%', alignItems: 'center' },
  templateWantButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '800' },
  loginLink: { alignItems: 'center', marginTop: 10 },
  loginLinkText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  checkoutSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 14 },
  addonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 8 },
  addonRowSelected: { borderColor: '#22c55e' },
  addonName: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  addonPrice: { color: '#22c55e', fontSize: 11, marginTop: 2 },
  addonCheck: { color: '#22c55e', fontSize: 16, fontWeight: '800', marginLeft: 10 },
  copyPixButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingVertical: 12, marginBottom: 8 },
  copyPixButtonText: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Modal, Animated, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

const WHATSAPP_NUMBER = '5537998231382';
const ICONS = ['barbell-outline', 'restaurant-outline', 'sparkles-outline', 'flash-outline', 'trophy-outline'];
const ACCENT = '#FF6B00';
const TRANSITION = Platform.OS === 'web' ? { transitionProperty: 'all', transitionDuration: '200ms', transitionTimingFunction: 'ease' } : {};

function HoverButton({ style, hoverStyle, onPress, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable style={[style, hovered && hoverStyle]} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
      {children}
    </Pressable>
  );
}

const TRUST_CHECKLIST = [
  'Conteúdos 100% atualizados a cada 5 semanas',
  'Acesso ilimitado a todas as modalidades (Casa e Academia)',
  'Guias alimentares e e-books de receitas inclusos',
  'Canal de dúvidas direto com a equipe TcFit',
  'Flexibilidade total: cancele a qualquer momento sem letras miúdas',
  'Garantia incondicional de 7 dias (risco zero)',
];

export default function PlansScreen({ onBack, onLogin, onSignup }) {
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [addonProducts, setAddonProducts] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [matchedPersonal, setMatchedPersonal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [pixCopied, setPixCopied] = useState(false);
  const [audience, setAudience] = useState('ela');
  const modalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (checkoutTarget) {
      modalAnim.setValue(0);
      Animated.timing(modalAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }
  }, [checkoutTarget]);

  useEffect(() => {
    (async () => {
      const { data: plansData } = await supabase.from('plan_prices').select('*').eq('is_public', true).order('plan_key');
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
        .select('id, name, pix_key, payment_link, phone');

      let found = null;
      if (allPersonals && allPersonals.length > 0) {
        found =
          allPersonals.find((p) => p.phone && p.phone.replace(/\D/g, '').length >= 8 && p.phone.replace(/\D/g, '').slice(-8) === cleanTargetPhone.slice(-8))
          || allPersonals.find((p) => p.pix_key)
          || allPersonals[0];
      }
      if (found) {
        setPaymentInfo({ pixKey: found.pix_key, paymentLink: found.payment_link });
        setMatchedPersonal({ id: found.id, name: found.name });
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
    showAlert('Copiado!', 'Chave Pix copiada com sucesso!');
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleConfirmCheckout = async () => {
    const target = checkoutTarget;
    setCheckoutTarget(null);
    let message;
    if (target.kind === 'plan') {
      const template = target.data.whatsapp_message || 'Olá! Gostaria de contratar o plano {plano}.';
      message = template.replace('{plano}', target.data.plan_name || '');
    } else if (target.kind === 'product') {
      message = `Olá! Vi o produto "${target.data.name}" no app e gostaria de contratar.`;
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
      showAlert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const handleSignup = () => {
    setCheckoutTarget(null);
    if (onSignup) onSignup(matchedPersonal?.id);
  };

  const renderPlanCard = (plan, i) => {
    const hasPrice = plan.price != null;
    const hasMonthlyEquivalent = plan.monthly_equivalent_price != null;
    const icon = ICONS[i % ICONS.length];
    const bullets = (plan.bullets || '').split('\n').map((b) => b.trim()).filter(Boolean);
    const ctaText = plan.audience === 'ela'
      ? 'QUERO INICIAR MEU PLANO TCFIT ELA'
      : plan.audience === 'ele'
        ? 'QUERO INICIAR MEU PLANO TCFIT ELE'
        : 'Quero meu Protocolo';

    return (
      <View key={plan.plan_key} style={[styles.planCard, plan.is_featured && styles.planCardHighlight]}>
        {plan.is_featured && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MAIS RECOMENDADO</Text>
          </View>
        )}
        <View style={styles.planIconCircle}>
          <Ionicons name={icon} size={26} color={ACCENT} />
        </View>
        <Text style={styles.planName}>{plan.plan_name}</Text>
        {plan.duration_label ? <Text style={styles.planDuration}>{plan.duration_label}</Text> : null}

        {bullets.length > 0 && (
          <View style={styles.bulletsBox}>
            {bullets.map((bullet, j) => (
              <View key={j} style={styles.bulletRow}>
                <Ionicons name="checkmark-outline" size={14} color={ACCENT} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        )}

        {hasMonthlyEquivalent ? (
          <>
            <View style={styles.priceHighlightRow}>
              <Text style={styles.planPriceBig}>R$ {Number(plan.monthly_equivalent_price).toFixed(2).replace('.', ',')}</Text>
              <Text style={styles.planPriceBigSuffix}>/mês</Text>
            </View>
            {hasPrice && (
              <Text style={styles.planPriceTotal}>
                cobrado R$ {Number(plan.price).toFixed(2).replace('.', ',')}{plan.duration_label ? ` ${plan.duration_label}` : ''}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.planPrice}>
            {hasPrice ? `R$ ${Number(plan.price).toFixed(2).replace('.', ',')}` : 'Consulte'}
          </Text>
        )}

        <HoverButton
          style={styles.wantButton}
          hoverStyle={{ opacity: 0.88, transform: [{ scale: 1.015 }] }}
          onPress={() => handleOpenCheckout({ kind: 'plan', data: plan })}
        >
          <Text style={styles.wantButtonText}>{ctaText}</Text>
        </HoverButton>
      </View>
    );
  };

  const namedPlans = plans.filter((p) => p.plan_name);
  const hasAudienceTags = namedPlans.some((p) => p.audience);
  const visiblePlans = hasAudienceTags ? namedPlans.filter((p) => !p.audience || p.audience === audience) : namedPlans;
  const hasTierTags = visiblePlans.some((p) => p.tier);
  const appPlans = hasTierTags ? visiblePlans.filter((p) => p.tier === 'app') : visiblePlans;
  const consultoriaPlans = hasTierTags ? visiblePlans.filter((p) => p.tier === 'consultoria') : [];
  const untaggedPlans = hasTierTags ? visiblePlans.filter((p) => !p.tier) : [];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#090A0F', '#121624']} style={StyleSheet.absoluteFill} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Escolha o seu Plano</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {hasAudienceTags && (
          <View style={styles.audienceToggleRow}>
            <TouchableOpacity
              style={[styles.audienceToggleChip, audience === 'ela' && styles.audienceToggleChipActive]}
              onPress={() => setAudience('ela')}
            >
              <Text style={[styles.audienceToggleText, audience === 'ela' && styles.audienceToggleTextActive]}>Para Elas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.audienceToggleChip, audience === 'ele' && styles.audienceToggleChipActive]}
              onPress={() => setAudience('ele')}
            >
              <Text style={[styles.audienceToggleText, audience === 'ele' && styles.audienceToggleTextActive]}>Para Eles</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
        ) : namedPlans.length === 0 && templates.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="time-outline" size={32} color="#525252" />
            <Text style={styles.emptyText}>Em breve novos planos disponíveis! Entre em contato pra saber mais.</Text>
          </View>
        ) : (
          <>
            {hasTierTags && consultoriaPlans.length > 0 && appPlans.length > 0 && (
              <Text style={styles.sectionTitle}>TcFit App/Treinos</Text>
            )}
            {appPlans.map((plan, i) => renderPlanCard(plan, i))}

            {consultoriaPlans.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Consultoria Individualizada</Text>
                <Text style={styles.sectionSubtitle}>Acompanhamento 100% personalizado, direto com a equipe</Text>
                {consultoriaPlans.map((plan, i) => renderPlanCard(plan, i))}
              </>
            )}

            {untaggedPlans.map((plan, i) => renderPlanCard(plan, i))}

            {visiblePlans.length > 0 && (
              <View style={styles.trustBox}>
                {TRUST_CHECKLIST.map((item, i) => (
                  <View key={i} style={styles.trustRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                    <Text style={styles.trustText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

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
                    <HoverButton
                      style={styles.templateWantButton}
                      hoverStyle={{ opacity: 0.88, transform: [{ scale: 1.015 }] }}
                      onPress={() => handleOpenCheckout({ kind: 'template', data: t })}
                    >
                      <Text style={styles.templateWantButtonText}>Quero esse treino</Text>
                    </HoverButton>
                  </View>
                ))}
              </>
            )}

            {addonProducts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Produtos Avulsos</Text>
                <Text style={styles.sectionSubtitle}>E-books, guias e materiais extras</Text>
                {addonProducts.map((product) => (
                  <View key={product.id} style={styles.templateCard}>
                    <View style={styles.templateIconCircle}>
                      <Ionicons name="book-outline" size={22} color="#f97316" />
                    </View>
                    <Text style={styles.templateName}>{product.name}</Text>
                    {product.description ? <Text style={styles.templateDescription}>{product.description}</Text> : null}
                    <Text style={styles.templatePrice}>
                      {product.price != null ? `R$ ${Number(product.price).toFixed(2).replace('.', ',')}` : 'Consulte'}
                    </Text>
                    <HoverButton
                      style={styles.templateWantButton}
                      hoverStyle={{ opacity: 0.88, transform: [{ scale: 1.015 }] }}
                      onPress={() => handleOpenCheckout({ kind: 'product', data: product })}
                    >
                      <Text style={styles.templateWantButtonText}>Quero esse produto</Text>
                    </HoverButton>
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

      <Modal visible={!!checkoutTarget} transparent animationType="none" onRequestClose={() => setCheckoutTarget(null)}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.checkoutSheet,
              {
                opacity: modalAnim,
                transform: [{ translateY: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            <Text style={styles.modalTitle}>
              {checkoutTarget?.kind === 'plan' ? checkoutTarget.data.plan_name : checkoutTarget?.data.name}
            </Text>

            {addonProducts.filter((p) => !(checkoutTarget?.kind === 'product' && p.id === checkoutTarget.data.id)).length > 0 ? (
              <>
                <Text style={styles.modalSubtitle}>Quer adicionar algo a mais? (opcional)</Text>
                <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
                  {addonProducts.filter((p) => !(checkoutTarget?.kind === 'product' && p.id === checkoutTarget.data.id)).map((product) => {
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

            {onSignup && (
              <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
                <Ionicons name="person-add-outline" size={16} color="#f97316" />
                <Text style={styles.signupButtonText}>Já decidiu? Criar Conta Agora</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const glassCard = {
  backgroundColor: 'rgba(23,23,28,0.55)',
  borderWidth: 1,
  borderColor: 'rgba(249,115,22,0.16)',
  ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090A0F', paddingTop: 50, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  audienceToggleRow: { flexDirection: 'row', gap: 8, alignSelf: 'center', backgroundColor: '#171717', borderRadius: 12, padding: 4, marginBottom: 20 },
  audienceToggleChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9 },
  audienceToggleChipActive: { backgroundColor: '#f97316' },
  audienceToggleText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  audienceToggleTextActive: { color: '#0a0a0a' },
  priceHighlightRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  planPriceBig: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  planPriceBigSuffix: { color: '#737373', fontSize: 13, fontWeight: '700' },
  planPriceTotal: { color: '#737373', fontSize: 11, marginTop: 2, marginBottom: 4 },
  trustBox: { ...glassCard, borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  trustText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginLeft: 16 },
  emptyBox: { alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 40 },
  emptyText: { color: '#a3a3a3', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  planCard: { backgroundColor: '#12141C', borderWidth: 1, borderColor: '#27272A', borderRadius: 22, padding: 20, alignItems: 'center', marginBottom: 16 },
  planCardHighlight: { borderColor: '#FF6B00', borderWidth: 1.5 },
  badge: { position: 'absolute', top: -10, backgroundColor: '#FF6B00', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#000000', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  planIconCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', marginBottom: 12, marginTop: 8 },
  planName: { color: '#f5f5f5', fontSize: 17, fontWeight: '800' },
  planDuration: { color: '#737373', fontSize: 11, marginTop: 2, marginBottom: 12 },
  bulletsBox: { alignSelf: 'stretch', marginBottom: 16, marginTop: 14 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bulletText: { color: '#D4D4D8', fontSize: 12, flexShrink: 1 },
  planPrice: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 14 },
  wantButton: { backgroundColor: '#FF6B00', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, marginTop: 4, width: '100%', alignItems: 'center', ...TRANSITION },
  wantButtonText: { color: '#000000', fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 4 },
  sectionSubtitle: { color: '#737373', fontSize: 12, marginBottom: 16 },
  templateCard: { ...glassCard, borderRadius: 20, padding: 18, alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 },
  templateIconCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  templateName: { color: '#f5f5f5', fontSize: 15, fontWeight: '800' },
  templateDescription: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  templatePrice: { color: '#f97316', fontSize: 20, fontWeight: '800', marginTop: 12 },
  templateWantButton: { backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, marginTop: 14, width: '100%', alignItems: 'center', ...TRANSITION },
  templateWantButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '800' },
  loginLink: { alignItems: 'center', marginTop: 10 },
  loginLinkText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5,6,10,0.75)', justifyContent: 'flex-end' },
  checkoutSheet: {
    backgroundColor: 'rgba(23,23,28,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
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
  modalCancelButton: { flex: 1, backgroundColor: 'rgba(10,10,10,0.6)', borderWidth: 1, borderColor: '#292524', borderRadius: 14, paddingVertical: 12, alignItems: 'center', ...TRANSITION },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', ...TRANSITION },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  signupButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 10 },
  signupButtonText: { color: '#f97316', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';
import CollapsibleSection from './CollapsibleSection';
import { COVER_TOP_IMAGE, coverFocalImageStyle, GLASS_CARD } from './vitrineStyles';

const WHATSAPP_NUMBER = '5537998231382';
const ACCENT = '#FF6B00';

// Training programs (Hub de Programas / Módulo Corrida) are browsed and
// started here in Loja; nutrition guides/e-books still live in the Home
// hub's Biblioteca de Nutrição, so those aren't duplicated here.
export default function AlunoProductsScreen({
  studentId,
  personalId,
  onClose,
  hubGroups = [],
  hasAnyHubProgram = false,
  runningLevelCards = [],
  hasAnyRunningProgram = false,
  showHubAudienceToggle = false,
  hubAudienceFilter,
  setHubAudienceFilter,
  hubCollapsedSections = {},
  toggleHubSection,
  onOpenCategoryGroup,
  onOpenProduct,
}) {
  const [loading, setLoading] = useState(true);
  const [studentAccessLevel, setStudentAccessLevel] = useState('plataforma_base');
  const [personalName, setPersonalName] = useState(null);
  const [personalPhone, setPersonalPhone] = useState(null);
  const [partnerBrands, setPartnerBrands] = useState([]);
  const [showPartnersSection, setShowPartnersSection] = useState(false);
  const [copiedCouponId, setCopiedCouponId] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: myRow }, { data: personalRow }] = await Promise.all([
        supabase.from('users').select('access_level').eq('id', studentId).single(),
        personalId
          ? supabase.from('users').select('name, phone, show_partners_section').eq('id', personalId).single()
          : Promise.resolve({ data: null }),
      ]);

      setStudentAccessLevel(myRow?.access_level || 'plataforma_base');
      setPersonalName(personalRow?.name || null);
      setPersonalPhone(personalRow?.phone || null);
      setShowPartnersSection(personalRow?.show_partners_section !== false);

      if (personalId) {
        const { data: brandRows } = await supabase
          .from('partner_brands')
          .select('id, name, logo_url, coupon_code, affiliate_link')
          .eq('personal_id', personalId)
          .eq('active', true)
          .order('created_at', { ascending: false });
        setPartnerBrands(brandRows || []);
      }

      setLoading(false);
    })();
  }, [studentId, personalId]);

  const handleUpsellConsultoria = () => {
    const phone = (personalPhone || WHATSAPP_NUMBER).replace(/\D/g, '') || WHATSAPP_NUMBER;
    const message = `Olá${personalName ? `, ${personalName}` : ''}! Vi no app e quero saber mais sobre a consultoria individual com acompanhamento exclusivo.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const handleCopyCoupon = async (brand) => {
    if (brand.coupon_code) {
      await Clipboard.setStringAsync(brand.coupon_code);
      setCopiedCouponId(brand.id);
      setTimeout(() => setCopiedCouponId((prev) => (prev === brand.id ? null : prev)), 2500);
    }
    if (brand.affiliate_link) {
      Linking.openURL(brand.affiliate_link).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBack title="Loja" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      {loading ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {hasAnyHubProgram && (
            <CollapsibleSection
              title="HUB DE PROGRAMAS"
              collapsed={!!hubCollapsedSections.hub}
              onToggle={() => toggleHubSection?.('hub')}
            >
              {showHubAudienceToggle && (
                <View style={styles.audienceFilterRow}>
                  {[{ value: 'todos', label: 'Todos' }, { value: 'feminino', label: 'Feminino' }, { value: 'masculino', label: 'Masculino' }].map((a) => (
                    <TouchableOpacity
                      key={a.value}
                      style={[styles.audienceFilterChip, hubAudienceFilter === a.value && styles.audienceFilterChipActive]}
                      onPress={() => setHubAudienceFilter?.(a.value)}
                    >
                      <Text style={[styles.audienceFilterChipText, hubAudienceFilter === a.value && styles.audienceFilterChipTextActive]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {hubGroups.length === 0 && !hasAnyRunningProgram ? (
                <Text style={[styles.emptyText, { marginBottom: 16, marginTop: 10 }]}>Nenhum programa para esse público ainda.</Text>
              ) : hubGroups.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 10, marginBottom: 24 }}>
                {hubGroups.map((group) => (
                  <TouchableOpacity key={group.key} style={styles.nutritionCard} onPress={() => onOpenCategoryGroup?.(group)}>
                    <View style={styles.nutritionCoverWrap}>
                      {group.cover ? (
                        <Image source={{ uri: group.cover }} style={styles.nutritionCoverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.nutritionCoverPlaceholder}>
                          <Ionicons name={group.icon} size={22} color={ACCENT} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.nutritionCardName} numberOfLines={2}>{group.title}</Text>
                    {group.badges.length > 0 && (
                      <View style={styles.hubBadgeRow}>
                        {group.badges.map((b) => (
                          <View key={b} style={styles.hubBadgeChip}>
                            <Text style={styles.hubBadgeChipText}>{b}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              )}
            </CollapsibleSection>
          )}

          {hasAnyRunningProgram && (
            <CollapsibleSection
              title="MÓDULO CORRIDA"
              collapsed={!!hubCollapsedSections.corrida}
              onToggle={() => toggleHubSection?.('corrida')}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 10, marginBottom: 24 }}>
                {runningLevelCards.map((lvl) => {
                  const locked = !lvl.product;
                  return (
                    <TouchableOpacity
                      key={lvl.value}
                      style={styles.nutritionCard}
                      disabled={locked}
                      onPress={() => onOpenProduct?.(lvl.product)}
                    >
                      <View style={styles.nutritionCoverWrap}>
                        {lvl.product?.cover_image_url ? (
                          <Image source={{ uri: lvl.product.cover_image_url }} style={coverFocalImageStyle(lvl.product.cover_focal_position)} resizeMode="cover" />
                        ) : (
                          <View style={styles.nutritionCoverPlaceholder}>
                            <Ionicons name={lvl.icon} size={22} color={locked ? '#525252' : ACCENT} />
                          </View>
                        )}
                        {locked && (
                          <View style={styles.categoryLockOverlay}>
                            <Ionicons name="lock-closed" size={14} color="#F5F5F7" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.nutritionCardName, locked && { color: '#737373' }]} numberOfLines={2}>{lvl.label}</Text>
                      {locked && <Text style={styles.runningLevelLockedText}>Em breve</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </CollapsibleSection>
          )}

          {studentAccessLevel !== 'consultoria_vip' && (
            <View style={styles.upsellCard}>
              <Text style={styles.upsellTitle}>Quer um acompanhamento 100% individual?</Text>
              <Text style={styles.upsellText}>
                {personalName ? `${personalName} pode montar` : 'Seu personal pode montar'} sua ficha de treino do zero, sob medida pras suas necessidades específicas.
              </Text>
              <TouchableOpacity style={styles.upsellButton} onPress={handleUpsellConsultoria}>
                <Ionicons name="logo-whatsapp" size={16} color="#0F0F12" />
                <Text style={styles.upsellButtonText}>Quero Consultoria Individual</Text>
              </TouchableOpacity>
            </View>
          )}

          {showPartnersSection && partnerBrands.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Marcas Parceiras</Text>
              {partnerBrands.map((b) => (
                <View key={b.id} style={styles.partnerBanner}>
                  <View style={styles.partnerBannerLogoWrap}>
                    {b.logo_url ? (
                      <Image source={{ uri: b.logo_url }} style={styles.partnerBannerLogoImage} resizeMode="contain" />
                    ) : (
                      <Ionicons name="pricetag-outline" size={22} color="#FF6B00" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partnerBannerName} numberOfLines={1}>{b.name}</Text>
                    {(b.coupon_code || b.affiliate_link) && (
                      <View style={styles.partnerBannerTagBadge}>
                        <Text style={styles.partnerBannerTagBadgeText}>
                          {b.coupon_code ? 'CUPOM DISPONÍVEL' : 'DESCONTO EXCLUSIVO'}
                        </Text>
                      </View>
                    )}
                    {b.coupon_code ? (
                      <TouchableOpacity style={styles.partnerBannerCouponButton} onPress={() => handleCopyCoupon(b)}>
                        <Ionicons name={copiedCouponId === b.id ? 'checkmark-outline' : 'copy-outline'} size={12} color="#FF6B00" />
                        <Text style={styles.partnerBannerCouponText}>
                          {copiedCouponId === b.id ? 'Copiado!' : b.coupon_code}
                        </Text>
                      </TouchableOpacity>
                    ) : b.affiliate_link ? (
                      <TouchableOpacity style={styles.partnerBannerCouponButton} onPress={() => handleCopyCoupon(b)}>
                        <Text style={styles.partnerBannerCouponText}>Ver oferta</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptyText}>Nenhuma marca parceira disponível ainda.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  upsellCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 14, padding: 16, marginBottom: 20 },
  upsellTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  upsellText: { color: '#a3a3a3', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  upsellButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  upsellButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '800' },
  sectionTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  audienceFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  audienceFilterChip: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  audienceFilterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  audienceFilterChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  audienceFilterChipTextActive: { color: '#0F0F12' },
  nutritionCard: { width: 176 },
  nutritionCoverWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 6, position: 'relative', ...GLASS_CARD },
  nutritionCoverImage: { ...COVER_TOP_IMAGE },
  nutritionCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  nutritionCardName: { color: '#F5F5F7', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  runningLevelLockedText: { color: '#525252', fontSize: 10, fontWeight: '600', marginTop: 2 },
  hubBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hubBadgeChip: { backgroundColor: '#27272A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  hubBadgeChipText: { color: '#D4D4D8', fontSize: 10, fontWeight: '600' },
  categoryLockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  partnerBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, padding: 12, marginBottom: 10 },
  partnerBannerLogoWrap: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  partnerBannerLogoImage: { width: '100%', height: '100%' },
  partnerBannerName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  partnerBannerTagBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3, marginBottom: 6 },
  partnerBannerTagBadgeText: { color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  partnerBannerCouponButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,107,0,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  partnerBannerCouponText: { color: '#FF6B00', fontSize: 11, fontWeight: '800' },
});

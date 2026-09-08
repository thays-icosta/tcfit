import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';

const WHATSAPP_NUMBER = '5537998231382';

// Loja is reserved for the VIP consultancy upsell and partner/affiliate
// discounts — training programs live in Treinos (browse + start immediately)
// and nutrition guides/e-books live in the Home hub's Biblioteca de Nutrição,
// so neither is duplicated here.
export default function AlunoProductsScreen({ studentId, personalId, onClose }) {
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
  partnerBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, padding: 12, marginBottom: 10 },
  partnerBannerLogoWrap: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  partnerBannerLogoImage: { width: '100%', height: '100%' },
  partnerBannerName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  partnerBannerTagBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3, marginBottom: 6 },
  partnerBannerTagBadgeText: { color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  partnerBannerCouponButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,107,0,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  partnerBannerCouponText: { color: '#FF6B00', fontSize: 11, fontWeight: '800' },
});

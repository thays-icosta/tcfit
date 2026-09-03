import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform, Linking, Pressable } from 'react-native';
import { supabase } from './supabaseClient';

// Note: CSS `filter` and `mix-blend-mode` can't be combined here — RN-Web renders
// the logo via a nested background-image div and applies `filter` inline on that
// inner div while `mixBlendMode` lands on its wrapper, and that split silently
// breaks the blend. Opacity alone (a plain, unsplit property) works reliably.
const DIM_STYLE = Platform.OS === 'web'
  ? { opacity: 0.85, mixBlendMode: 'multiply', transitionProperty: 'opacity', transitionDuration: '200ms' }
  : { opacity: 0.85 };
const FULL_STYLE = Platform.OS === 'web' ? { opacity: 1, mixBlendMode: 'multiply' } : { opacity: 1 };

function PartnerLogo({ partner }) {
  const [hovered, setHovered] = useState(false);

  const handlePress = () => {
    if (partner.affiliate_link) {
      Linking.openURL(partner.affiliate_link).catch(() => {});
    }
  };

  return (
    <Pressable
      style={styles.logoWrap}
      onPress={handlePress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Image
        source={{ uri: partner.logo_url }}
        style={[styles.logoImage, hovered ? FULL_STYLE : DIM_STYLE]}
        resizeMode="contain"
      />
    </Pressable>
  );
}

export default function PartnersSection() {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('partner_brands')
        .select('id, name, logo_url, affiliate_link')
        .eq('active', true)
        .not('logo_url', 'is', null)
        .order('created_at', { ascending: false });
      setPartners(data || []);
    })();
  }, []);

  if (partners.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>MARCAS PARCEIRAS</Text>
      <Text style={styles.sectionSupport}>
        Empresas e marcas que fortalecem nosso ecossistema de saúde e performance.
      </Text>
      <View style={styles.logoRow}>
        {partners.map((p) => (
          <PartnerLogo key={p.id} partner={p} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 36 },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 18 * 0.08,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionSupport: {
    color: '#A1A1AA',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  logoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 32 },
  logoWrap: { height: 56, minWidth: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101218', borderRadius: 8 },
  logoImage: { width: 120, height: 56 },
});

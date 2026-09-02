import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform, Linking, Pressable } from 'react-native';
import { supabase } from './supabaseClient';

const GRAYSCALE_FILTER = Platform.OS === 'web'
  ? { filter: 'grayscale(1) opacity(0.8)', transitionProperty: 'filter', transitionDuration: '200ms' }
  : {};
const COLOR_FILTER = Platform.OS === 'web' ? { filter: 'grayscale(0) opacity(1)' } : {};

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
        style={[styles.logoImage, hovered ? COLOR_FILTER : GRAYSCALE_FILTER]}
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
  logoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 24 },
  logoWrap: { height: 40, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 90, height: 40 },
});

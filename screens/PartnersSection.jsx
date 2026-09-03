import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Linking, Pressable, Platform } from 'react-native';
import { supabase } from './supabaseClient';

function PartnerLogo({ partner }) {
  const url = partner.affiliate_link || null;

  const handlePress = () => {
    if (Platform.OS !== 'web' && url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <Pressable
      style={styles.logoWrap}
      onPress={handlePress}
      href={Platform.OS === 'web' && url ? url : undefined}
      hrefAttrs={Platform.OS === 'web' ? { target: '_blank', rel: 'noopener noreferrer' } : undefined}
    >
      <Image source={{ uri: partner.logo_url }} style={styles.logoImage} resizeMode="contain" />
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
  logoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 },
  logoWrap: {
    width: 140,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  logoImage: { width: '100%', height: '100%' },
});

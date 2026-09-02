import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import InstallBanner from './InstallBanner';
import { supabase } from './supabaseClient';

const TRUST_STRIP = [
  { icon: 'barbell-outline', text: 'Treinos personalizados e atualizados' },
  { icon: 'chatbubbles-outline', text: 'Acompanhamento real, direto com seu personal' },
  { icon: 'restaurant-outline', text: 'Dieta e macros sob medida pra você' },
];

const CATEGORIES = [
  { icon: 'barbell-outline', label: 'Treinos', subtitle: 'Fichas em vídeo', color: '#f97316' },
  { icon: 'restaurant-outline', label: 'Dieta e Macros', subtitle: 'Plano nutricional', color: '#5EC8D8' },
  { icon: 'trending-up-outline', label: 'Evolução Física', subtitle: 'Relatórios completos', color: '#a855f7' },
  { icon: 'star-outline', label: 'Consultoria VIP', subtitle: 'Suporte direto', color: '#ec4899', glow: true },
];

const TRANSITION = Platform.OS === 'web' ? { transitionProperty: 'all', transitionDuration: '200ms', transitionTimingFunction: 'ease' } : {};

function CategoryCard({ cat }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      style={[
        styles.categoryCard,
        cat.glow && styles.categoryCardGlow,
        hovered && { borderColor: cat.color, shadowColor: cat.color, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 5, transform: [{ scale: 1.02 }] },
      ]}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <View style={[styles.categoryIconCircle, { borderColor: cat.color }]}>
        <Ionicons name={cat.icon} size={22} color={cat.color} />
      </View>
      <Text style={styles.categoryLabel}>{cat.label}</Text>
      <Text style={styles.categorySubtitle}>{cat.subtitle}</Text>
    </Pressable>
  );
}

function PrimaryButton({ onPress, icon, text }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      style={[styles.exploreButton, hovered && styles.exploreButtonHovered]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Ionicons name={icon} size={20} color="#0a0a0a" />
      <Text style={styles.exploreButtonText}>{text}</Text>
    </Pressable>
  );
}

function GhostButton({ onPress, text }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      style={[styles.loginButton, hovered && styles.loginButtonHovered]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Text style={styles.loginButtonText}>{text}</Text>
    </Pressable>
  );
}

export default function WelcomeScreen({ onExplore, onLogin }) {
  const [ebooks, setEbooks] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, cover_image_url')
        .eq('active', true)
        .eq('show_as_addon', true)
        .order('created_at', { ascending: false })
        .limit(4);
      setEbooks(data || []);
    })();
  }, []);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#090A0F', '#121624']} style={StyleSheet.absoluteFill} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={['rgba(9,10,15,0.6)', 'rgba(18,22,36,0.85)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.centerBlock}>
            <Image
              source={require('../assets/images/brand-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>TcFit</Text>
            <Text style={styles.slogan}>Sua plataforma exclusiva de treino e saúde</Text>
          </View>
        </View>

        <View style={styles.trustStrip}>
          {TRUST_STRIP.map((item, i) => (
            <View key={i} style={styles.trustRow}>
              <View style={styles.trustIconCircle}>
                <Ionicons name={item.icon} size={16} color="#f97316" />
              </View>
              <Text style={styles.trustText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton onPress={onExplore} icon="storefront-outline" text="Conhecer Nossos Planos" />
        <GhostButton onPress={onLogin} text="Já tenho conta (Entrar)" />

        <InstallBanner />

        <Text style={styles.sectionTitle}>O que você encontra no app</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.label} cat={cat} />
          ))}
        </View>

        {ebooks.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>E-books e Conteúdos Exclusivos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ebookRow}>
              {ebooks.map((p) => (
                <TouchableOpacity key={p.id} style={styles.ebookCard} onPress={onExplore}>
                  {p.cover_image_url ? (
                    <Image source={{ uri: p.cover_image_url }} style={styles.ebookCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.ebookCover, styles.ebookCoverPlaceholder]}>
                      <Ionicons name="book-outline" size={26} color="#525252" />
                    </View>
                  )}
                  <Text style={styles.ebookName} numberOfLines={2}>{p.name}</Text>
                  <View style={styles.ebookTag}>
                    <Text style={styles.ebookTagText}>
                      {p.price != null ? `R$ ${Number(p.price).toFixed(2).replace('.', ',')}` : 'Avulso'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
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
  root: { flex: 1, backgroundColor: '#090A0F' },
  container: {
    paddingBottom: 60,
    ...(Platform.OS === 'web' ? { maxWidth: 440, width: '100%', marginHorizontal: 'auto' } : {}),
  },
  heroWrap: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 32, overflow: 'hidden' },
  centerBlock: { alignItems: 'center' },
  logo: { width: 120, height: 120, marginBottom: 12 },
  appName: { color: '#f5f5f5', fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  slogan: { color: '#a3a3a3', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  trustStrip: { ...glassCard, borderRadius: 20, padding: 16, marginBottom: 20, marginHorizontal: 32, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  trustText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  exploreButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f97316',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    marginHorizontal: 32,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    ...TRANSITION,
  },
  exploreButtonHovered: { backgroundColor: '#fb923c', shadowOpacity: 0.55, shadowRadius: 18, transform: [{ scale: 1.01 }] },
  exploreButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
  loginButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#525252', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 8, marginHorizontal: 32, ...TRANSITION },
  loginButtonHovered: { borderColor: '#a3a3a3', backgroundColor: 'rgba(255,255,255,0.04)' },
  loginButtonText: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginTop: 28, marginBottom: 14, marginHorizontal: 32 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginHorizontal: 32 },
  categoryCard: { width: '47%', ...glassCard, borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 10, ...TRANSITION },
  categoryCardGlow: { shadowColor: '#ec4899', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 4, borderColor: 'rgba(236,72,153,0.25)' },
  categoryIconCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  categorySubtitle: { color: '#737373', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 3 },
  ebookRow: { gap: 12, paddingRight: 12, marginHorizontal: 32 },
  ebookCard: { width: 110 },
  ebookCover: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  ebookCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  ebookName: { color: '#d4d4d4', fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  ebookTag: { alignSelf: 'center', backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  ebookTagText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
});

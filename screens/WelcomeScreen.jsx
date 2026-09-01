import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InstallBanner from './InstallBanner';
import { supabase } from './supabaseClient';

const TRUST_STRIP = [
  { icon: 'barbell-outline', text: 'Treinos personalizados e atualizados' },
  { icon: 'chatbubbles-outline', text: 'Acompanhamento real, direto com seu personal' },
  { icon: 'restaurant-outline', text: 'Dieta e macros sob medida pra você' },
];

const CATEGORIES = [
  { icon: 'barbell-outline', label: 'Treinos', color: '#f97316' },
  { icon: 'restaurant-outline', label: 'Dieta e Macros', color: '#5EC8D8' },
  { icon: 'trending-up-outline', label: 'Evolução Física', color: '#a855f7' },
  { icon: 'star-outline', label: 'Consultoria VIP', color: '#ec4899' },
];

export default function WelcomeScreen({ onExplore, onLogin }) {
  const [ebooks, setEbooks] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, cover_image_url')
        .eq('active', true)
        .eq('show_as_addon', true)
        .order('created_at', { ascending: false })
        .limit(4);
      setEbooks(data || []);
    })();
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.centerBlock}>
          <Image
            source={require('../assets/images/brand-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>TcFit</Text>
          <Text style={styles.slogan}>Sua plataforma exclusiva de treino e saúde</Text>
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

        <InstallBanner />

        <TouchableOpacity style={styles.exploreButton} onPress={onExplore}>
          <Ionicons name="storefront-outline" size={18} color="#0a0a0a" />
          <Text style={styles.exploreButtonText}>Conhecer Nossos Planos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Já tenho conta (Entrar)</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>O que você encontra no app</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.categoryCard}>
              <View style={[styles.categoryIconCircle, { borderColor: cat.color }]}>
                <Ionicons name={cat.icon} size={22} color={cat.color} />
              </View>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </View>
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
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  container: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    paddingBottom: 60,
    ...(Platform.OS === 'web' ? { maxWidth: 440, width: '100%', marginHorizontal: 'auto' } : {}),
  },
  centerBlock: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 120, height: 120, marginBottom: 12 },
  appName: { color: '#f5f5f5', fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  slogan: { color: '#a3a3a3', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  trustStrip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 16, marginBottom: 20, gap: 12 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  trustText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  exploreButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  exploreButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  loginButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  loginButtonText: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginTop: 28, marginBottom: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  categoryCard: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  categoryIconCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  ebookRow: { gap: 12, paddingRight: 12 },
  ebookCard: { width: 110 },
  ebookCover: { width: 110, height: 110, borderRadius: 12, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524' },
  ebookCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  ebookName: { color: '#d4d4d4', fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Platform, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import InstallBanner from './InstallBanner';
import PlansSection from './PlansSection';
import MaterialsSection from './MaterialsSection';
import WorkoutsSection from './WorkoutsSection';
import WorkoutProgramsSection from './WorkoutProgramsSection';
import PartnersSection from './PartnersSection';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, GRID_GAP } from './vitrineStyles';

const TRUST_STRIP = [
  { icon: 'barbell-outline', text: 'Treinos personalizados e atualizados' },
  { icon: 'chatbubbles-outline', text: 'Acompanhamento real, direto com seu personal' },
  { icon: 'restaurant-outline', text: 'Dieta e macros sob medida pra você' },
];

const GENDER_ONBOARDING_MAP = { female: 'feminino', feminino: 'feminino', male: 'masculino', masculino: 'masculino' };

const GENDER_HIGHLIGHTS = {
  feminino: {
    title: 'FEITO PRA VOCÊ',
    color: '#D1D5DB',
    iconBg: 'rgba(255,255,255,0.08)',
    items: [
      { icon: 'body-outline', text: 'Glúteos & Pernas' },
      { icon: 'flash-outline', text: 'Treinos Express' },
      { icon: 'nutrition-outline', text: 'Nutrição & Estética' },
    ],
  },
  masculino: {
    title: 'FEITO PRA VOCÊ',
    color: '#D1D5DB',
    iconBg: 'rgba(255,255,255,0.08)',
    items: [
      { icon: 'barbell-outline', text: 'Hipertrofia & Cargas (PPL/ABCDE)' },
      { icon: 'trophy-outline', text: 'Módulo de Recorde Pessoal (PR)' },
      { icon: 'calculator-outline', text: 'Calculadora de Bulking/Cutting' },
    ],
  },
};

const CATEGORIES = [
  { icon: 'barbell-outline', label: 'Treinos', subtitle: 'Fichas em vídeo', color: ACCENT },
  { icon: 'restaurant-outline', label: 'Dieta e Macros', subtitle: 'Plano nutricional', color: ACCENT },
  { icon: 'trending-up-outline', label: 'Evolução Física', subtitle: 'Relatórios completos', color: ACCENT },
  { icon: 'star-outline', label: 'Consultoria VIP', subtitle: 'Suporte direto', color: ACCENT },
];

function CategoryCard({ cat }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      style={[
        styles.categoryCard,
        hovered && { borderColor: cat.color, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 5, transform: [{ scale: 1.02 }] },
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
      <Ionicons name={icon} size={20} color="#08090B" />
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

export default function WelcomeScreen({ onLogin, onSignup, scrollToPlansOnMount, gender }) {
  const scrollRef = useRef(null);
  const planosY = useRef(0);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const genderProfile = GENDER_ONBOARDING_MAP[gender] || null;
  const highlight = genderProfile ? GENDER_HIGHLIGHTS[genderProfile] : null;

  const scrollToPlanos = () => {
    scrollRef.current?.scrollTo({ y: Math.max(planosY.current - 20, 0), animated: true });
  };

  useEffect(() => {
    if (scrollToPlansOnMount) {
      const t = setTimeout(scrollToPlanos, 300);
      return () => clearTimeout(t);
    }
  }, [scrollToPlansOnMount]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#08090B', '#101216']} style={StyleSheet.absoluteFill} />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={['rgba(8,9,11,0.6)', 'rgba(16,18,22,0.85)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.centerBlock}>
            <Image
              source={require('../assets/images/brand-wordmark.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="TcFit"
            />
            <Text style={styles.slogan}>Sua plataforma exclusiva de treino e saúde</Text>
            <Text style={[styles.heroSupportText, { fontSize: isDesktop ? 15 : 14, lineHeight: (isDesktop ? 15 : 14) * 1.5 }]}>
              Acompanhamento completo e metodologia validada para transformar o seu corpo de forma simples.
            </Text>
          </View>
        </View>

        <View style={styles.trustStrip}>
          {TRUST_STRIP.map((item, i) => (
            <View key={i} style={styles.trustRow}>
              <View style={[styles.trustIconCircle, styles.trustIconCircleBrand]}>
                <Ionicons name={item.icon} size={16} color={ACCENT} />
              </View>
              <Text style={styles.trustText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {highlight && (
          <View style={[styles.highlightStrip, { borderColor: highlight.color }]}>
            <Text style={[styles.highlightTitle, { color: highlight.color }]}>{highlight.title}</Text>
            {highlight.items.map((item, i) => (
              <View key={i} style={styles.trustRow}>
                <View style={[styles.trustIconCircle, { backgroundColor: highlight.iconBg }]}>
                  <Ionicons name={item.icon} size={16} color={highlight.color} />
                </View>
                <Text style={styles.trustText}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}

        <PrimaryButton onPress={scrollToPlanos} icon="storefront-outline" text="Conhecer Nossos Planos" />
        <GhostButton onPress={onLogin} text="Já tenho conta (Entrar)" />

        <Text style={sectionTitleStyle(isDesktop)}>RECURSOS EXCLUSIVOS</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.label} cat={cat} />
          ))}
        </View>

        <WorkoutsSection onSelectWorkout={scrollToPlanos} isDesktop={isDesktop} gender={genderProfile} />

        <WorkoutProgramsSection isDesktop={isDesktop} gender={genderProfile} />

        <MaterialsSection isDesktop={isDesktop} />

        <Text style={sectionTitleStyle(isDesktop)}>ESCOLHA O SEU PLANO</Text>
        <PlansSection
          onLayout={(e) => { planosY.current = e.nativeEvent.layout.y; }}
          onLogin={onLogin}
          onSignup={onSignup}
        />

        <PartnersSection />

        <InstallBanner />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090B' },
  container: {
    paddingBottom: 60,
    ...(Platform.OS === 'web'
      ? { maxWidth: 480, width: '100%', marginHorizontal: 'auto', paddingHorizontal: 16 }
      : { paddingHorizontal: 16 }),
  },
  heroWrap: { paddingTop: 64, paddingBottom: 28, overflow: 'hidden' },
  centerBlock: { alignItems: 'center' },
  // brand-wordmark.png is 663x201 (3.3:1) — width/height keep that ratio exactly.
  logo: { width: 200, height: 61, marginBottom: 22 },
  slogan: {
    color: '#F4F4F5',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: 215, // breaks as "Sua plataforma exclusiva / de treino e saúde" instead of orphaning "saúde"
  },
  heroSupportText: {
    color: '#A1A1AA',
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 360,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 26,
  },
  trustStrip: { ...FLAT_CARD, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 20, gap: 14 },
  highlightStrip: { ...FLAT_CARD, borderWidth: 1, marginBottom: 20, gap: 12 },
  highlightTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 2 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  trustIconCircleBrand: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  trustText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  exploreButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
    ...TRANSITION,
  },
  exploreButtonHovered: { backgroundColor: '#E4E4E7', shadowOpacity: 0.6, shadowRadius: 20, transform: [{ scale: 1.01 }] },
  exploreButtonText: { color: '#08090B', fontSize: 15, fontWeight: '800' },
  loginButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3F3F46', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 8, ...TRANSITION },
  loginButtonHovered: { borderColor: '#71717a', backgroundColor: 'rgba(255,255,255,0.04)' },
  loginButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  categoryCard: { width: '47%', ...FLAT_CARD, alignItems: 'center', ...TRANSITION },
  categoryIconCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryLabel: { ...CARD_TITLE, textAlign: 'center' },
  categorySubtitle: { color: '#A1A1AA', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 3 },
});

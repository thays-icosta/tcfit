import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Platform, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import InstallBanner from './InstallBanner';
import PlansSection from './PlansSection';
import MaterialsSection from './MaterialsSection';
import WorkoutsSection from './WorkoutsSection';
import PartnersSection from './PartnersSection';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, GRID_GAP } from './vitrineStyles';

const TRUST_STRIP = [
  { icon: 'barbell-outline', text: 'Treinos personalizados e atualizados' },
  { icon: 'chatbubbles-outline', text: 'Acompanhamento real, direto com seu personal' },
  { icon: 'restaurant-outline', text: 'Dieta e macros sob medida pra você' },
];

const CATEGORIES = [
  { icon: 'barbell-outline', label: 'Treinos', subtitle: 'Fichas em vídeo', color: ACCENT },
  { icon: 'restaurant-outline', label: 'Dieta e Macros', subtitle: 'Plano nutricional', color: '#5EC8D8' },
  { icon: 'trending-up-outline', label: 'Evolução Física', subtitle: 'Relatórios completos', color: '#a855f7' },
  { icon: 'star-outline', label: 'Consultoria VIP', subtitle: 'Suporte direto', color: '#ec4899', glow: true },
];

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
      <Ionicons name={icon} size={20} color="#1a1000" />
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

export default function WelcomeScreen({ onLogin, onSignup, scrollToPlansOnMount }) {
  const scrollRef = useRef(null);
  const planosY = useRef(0);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

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
      <LinearGradient colors={['#090A0F', '#121624']} style={StyleSheet.absoluteFill} />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.container}>
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
            <Text style={styles.appName}>
              <Text style={styles.appNameTc}>Tc</Text>
              <Text style={styles.appNameFit}>Fit</Text>
            </Text>
            <Text style={styles.slogan}>Sua plataforma exclusiva de treino e saúde</Text>
            <Text style={[styles.heroSupportText, { fontSize: isDesktop ? 15 : 14, lineHeight: (isDesktop ? 15 : 14) * 1.5 }]}>
              Acompanhamento completo e metodologia validada para transformar o seu corpo de forma simples.
            </Text>
          </View>
        </View>

        <View style={styles.trustStrip}>
          {TRUST_STRIP.map((item, i) => (
            <View key={i} style={styles.trustRow}>
              <View style={styles.trustIconCircle}>
                <Ionicons name={item.icon} size={16} color={ACCENT} />
              </View>
              <Text style={styles.trustText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton onPress={scrollToPlanos} icon="storefront-outline" text="Conhecer Nossos Planos" />
        <GhostButton onPress={onLogin} text="Já tenho conta (Entrar)" />

        <Text style={sectionTitleStyle(isDesktop)}>RECURSOS EXCLUSIVOS</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.label} cat={cat} />
          ))}
        </View>

        <WorkoutsSection onSelectWorkout={scrollToPlanos} isDesktop={isDesktop} />

        <MaterialsSection onSelectMaterial={scrollToPlanos} isDesktop={isDesktop} />

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
  root: { flex: 1, backgroundColor: '#090A0F' },
  container: {
    paddingBottom: 60,
    ...(Platform.OS === 'web'
      ? { maxWidth: 480, width: '100%', marginHorizontal: 'auto', paddingHorizontal: 16 }
      : { paddingHorizontal: 16 }),
  },
  heroWrap: { paddingTop: 60, paddingBottom: 24, overflow: 'hidden' },
  centerBlock: { alignItems: 'center' },
  logo: { width: 120, height: 120, marginBottom: 12 },
  appName: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    letterSpacing: 32 * 0.08,
    ...(Platform.OS === 'web' ? { WebkitFontSmoothing: 'antialiased', fontSmoothing: 'antialiased' } : {}),
  },
  appNameTc: { color: '#FFFFFF' },
  appNameFit: {
    color: ACCENT,
    textShadowColor: 'rgba(224,90,23,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  slogan: {
    color: '#A1A1AA',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontWeight: '400',
    letterSpacing: 0.4,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  heroSupportText: {
    color: '#A1A1AA',
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 360,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  trustStrip: { ...FLAT_CARD, marginBottom: 20, gap: 12 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustIconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(224,90,23,0.12)', alignItems: 'center', justifyContent: 'center' },
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
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
    ...TRANSITION,
  },
  exploreButtonHovered: { backgroundColor: '#ED7940', shadowOpacity: 0.6, shadowRadius: 20, transform: [{ scale: 1.01 }] },
  exploreButtonText: { color: '#1a1000', fontSize: 15, fontWeight: '800' },
  loginButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3F3F46', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 8, ...TRANSITION },
  loginButtonHovered: { borderColor: '#71717a', backgroundColor: 'rgba(255,255,255,0.04)' },
  loginButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  categoryCard: { width: '47%', ...FLAT_CARD, alignItems: 'center', ...TRANSITION },
  categoryCardGlow: { shadowColor: '#ec4899', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 4, borderColor: 'rgba(236,72,153,0.25)' },
  categoryIconCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryLabel: { ...CARD_TITLE, textAlign: 'center' },
  categorySubtitle: { color: '#A1A1AA', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 3 },
});

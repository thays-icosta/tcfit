import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const SLIDES = [
  { icon: 'barbell-outline', title: 'Monte fichas de treino', text: 'Crie fichas completas com catálogo de exercícios, vídeos e cronômetro de descanso.' },
  { icon: 'restaurant-outline', title: 'Acompanhe a dieta', text: 'Prescreva refeições, defina metas de macro e veja o diário alimentar do seu aluno em tempo real.' },
  { icon: 'stats-chart-outline', title: 'Painel completo', text: 'Avaliações físicas, agenda de sessões, mensagens e um painel geral de todos os seus alunos.' },
];

export default function OnboardingScreen({ onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentIndex + 1), animated: true });
    } else {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Ionicons name={slide.icon} size={56} color="#f97316" />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.text}>{slide.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, currentIndex === i && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={onFinish}>
          <Text style={styles.skipText}>Pular</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{currentIndex === SLIDES.length - 1 ? 'Começar' : 'Próximo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#171717', borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  title: { color: '#f5f5f5', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  text: { color: '#a3a3a3', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#292524' },
  dotActive: { backgroundColor: '#f97316', width: 20 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 50 },
  skipText: { color: '#737373', fontSize: 14, fontWeight: '600' },
  nextButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  nextButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
});
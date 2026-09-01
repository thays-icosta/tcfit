import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SLIDES = [
  { icon: 'barbell-outline', title: 'Seus Treinos na Palma da Mão', text: 'Acesse suas fichas personalizadas, vídeos de execução e cronômetro.' },
  { icon: 'restaurant-outline', title: 'Acompanhe sua Dieta', text: 'Consulte seu plano alimentar, metas de macros e diário em tempo real.' },
  { icon: 'stats-chart-outline', title: 'Evolução & Consultoria', text: 'Acompanhe suas avaliações físicas e converse diretamente com seu Personal.' },
];

export default function OnboardingScreen({ onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const windowWidth = useWindowDimensions().width;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const handleLayout = (event) => {
    const measured = event.nativeEvent.layout.width;
    if (measured > 0) setMeasuredWidth(measured);
  };

  const syncIndexFromOffset = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex((prev) => (prev === index ? prev : index));
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollRef.current?.scrollTo({ x: width * nextIndex, animated: true });
    } else {
      onFinish();
    }
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        snapToAlignment="center"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={syncIndexFromOffset}
        onMomentumScrollEnd={syncIndexFromOffset}
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

      <View style={[styles.bottomRow, { paddingBottom: 50 + insets.bottom }]}>
        <TouchableOpacity style={styles.skipButton} hitSlop={12} onPress={onFinish}>
          <Text style={styles.skipText}>Pular</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} hitSlop={12} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{currentIndex === SLIDES.length - 1 ? 'Começar' : 'Próximo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: Platform.OS === 'web'
    ? { flex: 1, backgroundColor: '#0a0a0a', maxWidth: 440, width: '100%', marginHorizontal: 'auto' }
    : { flex: 1, backgroundColor: '#0a0a0a' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#171717', borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  title: { color: '#f5f5f5', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  text: { color: '#a3a3a3', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#292524' },
  dotActive: { backgroundColor: '#f97316', width: 20 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32 },
  skipButton: { paddingVertical: 10, paddingHorizontal: 6 },
  skipText: { color: '#737373', fontSize: 14, fontWeight: '600' },
  nextButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  nextButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#E05A17';

function MetricCard({ icon, label, valueText, percent, subtitle, onPress }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.cardTopRow}>
        <Ionicons name={icon} size={14} color={ACCENT} />
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Text style={styles.cardValue} numberOfLines={1}>{valueText}</Text>
      {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, percent || 0))}%` }]} />
      </View>
    </Wrapper>
  );
}

// Daily metrics snapshot shown both on the aluno's own Home and on the
// personal's student-detail screen — same four cards, same data shape,
// so the personal sees exactly what the student sees for that day. Each
// card is independently tappable when the caller wires up its onPress*.
export default function MetricsMiniCards({
  caloriesConsumed,
  caloriesGoal,
  onPressCalories,
  waterMl,
  waterGoalMl = 2000,
  onPressWater,
  mealsCompleted,
  mealsTotal,
  onPressHabits,
  weeklyPercent,
  lastWorkoutLabel,
  onPressFrequency,
}) {
  const caloriesPercent = caloriesGoal ? (caloriesConsumed / caloriesGoal) * 100 : 0;
  const waterPercent = (waterMl / waterGoalMl) * 100;
  const mealsPercent = mealsTotal ? (mealsCompleted / mealsTotal) * 100 : 0;

  return (
    <View style={styles.grid}>
      <MetricCard
        icon="flame-outline"
        label="Calorias"
        valueText={caloriesGoal ? `${Math.round(caloriesConsumed)} / ${caloriesGoal} kcal` : `${Math.round(caloriesConsumed)} kcal`}
        percent={caloriesPercent}
        onPress={onPressCalories}
      />
      <MetricCard
        icon="water-outline"
        label="Água"
        valueText={`${(waterMl / 1000).toFixed(1)} / ${(waterGoalMl / 1000).toFixed(1)}L`}
        percent={waterPercent}
        onPress={onPressWater}
      />
      <MetricCard
        icon="checkmark-circle-outline"
        label="Hábitos"
        valueText={`${mealsCompleted} / ${mealsTotal}`}
        percent={mealsPercent}
        onPress={onPressHabits}
      />
      <MetricCard
        icon="heart-outline"
        label="Frequência"
        valueText={`${Math.round(weeklyPercent || 0)}%`}
        percent={weeklyPercent}
        subtitle={lastWorkoutLabel ? `Último: ${lastWorkoutLabel}` : null}
        onPress={onPressFrequency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardLabel: { color: '#a3a3a3', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardValue: { color: '#f5f5f5', fontSize: 14, fontWeight: '800' },
  cardSubtitle: { color: '#737373', fontSize: 9, fontWeight: '600', marginTop: 3, marginBottom: 2 },
  track: { height: 4, backgroundColor: '#0a0a0a', borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: ACCENT },
});

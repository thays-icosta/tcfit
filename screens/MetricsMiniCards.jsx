import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#E05A17';

function MetricCard({ icon, label, valueText, percent }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Ionicons name={icon} size={14} color={ACCENT} />
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Text style={styles.cardValue} numberOfLines={1}>{valueText}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, percent || 0))}%` }]} />
      </View>
    </View>
  );
}

// Daily metrics snapshot shown both on the aluno's own Home and on the
// personal's student-detail screen — same four cards, same data shape,
// so the personal sees exactly what the student sees for that day.
export default function MetricsMiniCards({ caloriesConsumed, caloriesGoal, waterMl, waterGoalMl = 2000, mealsCompleted, mealsTotal, weeklyPercent }) {
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
      />
      <MetricCard
        icon="water-outline"
        label="Água"
        valueText={`${(waterMl / 1000).toFixed(1)} / ${(waterGoalMl / 1000).toFixed(1)}L`}
        percent={waterPercent}
      />
      <MetricCard
        icon="checkmark-circle-outline"
        label="Hábitos"
        valueText={`${mealsCompleted} / ${mealsTotal}`}
        percent={mealsPercent}
      />
      <MetricCard
        icon="heart-outline"
        label="Frequência"
        valueText={`${Math.round(weeklyPercent || 0)}%`}
        percent={weeklyPercent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardLabel: { color: '#a3a3a3', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardValue: { color: '#f5f5f5', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  track: { height: 4, backgroundColor: '#0a0a0a', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: ACCENT },
});

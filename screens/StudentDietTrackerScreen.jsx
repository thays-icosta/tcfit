import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';

const MEAL_TYPES = [
  { key: 'cafe_da_manha', label: 'Café da Manhã' },
  { key: 'almoco', label: 'Almoço' },
  { key: 'lanche_tarde', label: 'Lanche da Tarde' },
  { key: 'jantar', label: 'Jantar' },
  { key: 'ceia', label: 'Ceia' },
];

function GoalBar({ label, consumed, goal, unit, color }) {
  if (!goal) return null;
  const pct = Math.min(100, Math.round((consumed / goal) * 100));
  return (
    <View style={styles.goalBarBlock}>
      <View style={styles.goalBarLabelRow}>
        <Text style={styles.goalBarLabel}>{label}</Text>
        <Text style={styles.goalBarValue}>{Math.round(consumed)}{unit} / {goal}{unit}</Text>
      </View>
      <View style={styles.goalBarTrack}>
        <View style={[styles.goalBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function StudentDietTrackerScreen({ studentId, onAddFood, refreshKey }) {
  const [goals, setGoals] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadData = async () => {
    const { data: dietRows } = await supabase
      .from('diets')
      .select('goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g')
      .eq('student_id', studentId)
      .eq('active', true)
      .not('goal_kcal', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    setGoals(dietRows && dietRows.length > 0 ? dietRows[0] : null);

    const { data: entryRows } = await supabase
      .from('food_diary_entries')
      .select('id, food_name, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, meal_type')
      .eq('student_id', studentId)
      .eq('entry_date', todayStr)
      .order('created_at', { ascending: true });
    setEntries(entryRows || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [studentId, refreshKey]);

  const handleRemoveEntry = async (entryId) => {
    await supabase.from('food_diary_entries').delete().eq('id', entryId);
    loadData();
  };

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.calories_kcal || 0),
      protein: acc.protein + (e.protein_g || 0),
      carbs: acc.carbs + (e.carbs_g || 0),
      fat: acc.fat + (e.fat_g || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  if (loading) {
    return <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />;
  }

  return (
    <View style={{ width: '100%' }}>
      {goals ? (
        <View style={styles.goalsCard}>
          <Text style={styles.goalsCardTitle}>Hoje</Text>
          <GoalBar label="Calorias" consumed={totals.kcal} goal={goals.goal_kcal} unit="kcal" color="#f97316" />
          <GoalBar label="Proteína" consumed={totals.protein} goal={goals.goal_protein_g} unit="g" color="#22c55e" />
          <GoalBar label="Carboidrato" consumed={totals.carbs} goal={goals.goal_carbs_g} unit="g" color="#3b82f6" />
          <GoalBar label="Gordura" consumed={totals.fat} goal={goals.goal_fat_g} unit="g" color="#a855f7" />
        </View>
      ) : (
        <View style={styles.noGoalsBox}>
          <Text style={styles.noGoalsText}>Seu personal ainda não definiu metas diárias.</Text>
        </View>
      )}

      {MEAL_TYPES.map((mealType) => {
        const mealEntries = entries.filter((e) => e.meal_type === mealType.key);
        const mealKcal = mealEntries.reduce((sum, e) => sum + (e.calories_kcal || 0), 0);
        return (
          <View key={mealType.key} style={styles.mealSection}>
            <View style={styles.mealSectionHeader}>
              <Text style={styles.mealSectionTitle}>{mealType.label}</Text>
              {mealKcal > 0 && <Text style={styles.mealSectionKcal}>{Math.round(mealKcal)}kcal</Text>}
            </View>

            {mealEntries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>
                    {entry.food_name}{entry.quantity_g ? ` — ${entry.quantity_g}g` : ''}
                  </Text>
                  {entry.calories_kcal != null && (
                    <Text style={styles.entryMacros}>
                      {Math.round(entry.calories_kcal)}kcal · P:{entry.protein_g}g · C:{entry.carbs_g}g · G:{entry.fat_g}g
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleRemoveEntry(entry.id)}>
                  <Text style={styles.entryRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addFoodButton} onPress={() => onAddFood(mealType.key)}>
              <Text style={styles.addFoodButtonText}>+ Adicionar Alimento</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  goalsCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16, width: '100%' },
  goalsCardTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  goalBarBlock: { marginBottom: 10 },
  goalBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  goalBarLabel: { color: '#a3a3a3', fontSize: 11 },
  goalBarValue: { color: '#f5f5f5', fontSize: 11, fontWeight: '600' },
  goalBarTrack: { height: 8, backgroundColor: '#0a0a0a', borderRadius: 4, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 4 },
  noGoalsBox: { backgroundColor: '#171717', borderRadius: 10, padding: 12, marginBottom: 16, width: '100%' },
  noGoalsText: { color: '#525252', fontSize: 11, textAlign: 'center' },
  mealSection: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 10, width: '100%' },
  mealSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mealSectionTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  mealSectionKcal: { color: '#f97316', fontSize: 11, fontWeight: '600' },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 8, padding: 8, marginBottom: 6 },
  entryName: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  entryMacros: { color: '#525252', fontSize: 10, marginTop: 1 },
  entryRemove: { color: '#ef4444', fontSize: 12, marginLeft: 8 },
  addFoodButton: { borderWidth: 1, borderColor: '#22c55e', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  addFoodButtonText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
});
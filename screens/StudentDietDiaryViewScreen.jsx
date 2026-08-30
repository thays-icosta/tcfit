import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';

const MEAL_LABELS = {
  cafe_da_manha: 'Café da Manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

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

export default function StudentDietDiaryViewScreen({ studentId, studentName, onClose }) {
  const [goals, setGoals] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
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
    })();
  }, [studentId]);

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.calories_kcal || 0),
      protein: acc.protein + (e.protein_g || 0),
      carbs: acc.carbs + (e.carbs_g || 0),
      fat: acc.fat + (e.fat_g || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const entriesByMeal = entries.reduce((acc, e) => {
    acc[e.meal_type] = acc[e.meal_type] || [];
    acc[e.meal_type].push(e);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.studentLabel}>{studentName}</Text>
      </View>

      <Text style={styles.title}>Diário Alimentar de Hoje</Text>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {goals ? (
            <View style={styles.goalsCard}>
              <GoalBar label="Calorias" consumed={totals.kcal} goal={goals.goal_kcal} unit="kcal" color="#f97316" />
              <GoalBar label="Proteína" consumed={totals.protein} goal={goals.goal_protein_g} unit="g" color="#22c55e" />
              <GoalBar label="Carboidrato" consumed={totals.carbs} goal={goals.goal_carbs_g} unit="g" color="#3b82f6" />
              <GoalBar label="Gordura" consumed={totals.fat} goal={goals.goal_fat_g} unit="g" color="#a855f7" />
            </View>
          ) : (
            <Text style={styles.noGoalsText}>Nenhuma meta diária definida ainda.</Text>
          )}

          {entries.length === 0 ? (
            <Text style={styles.emptyText}>O aluno ainda não registrou nada hoje.</Text>
          ) : (
            Object.entries(entriesByMeal).map(([mealType, foods]) => (
              <View key={mealType} style={styles.mealCard}>
                <Text style={styles.mealTitle}>{MEAL_LABELS[mealType] || mealType}</Text>
                {foods.map((f) => (
                  <View key={f.id} style={{ marginTop: 4 }}>
                    <Text style={styles.foodText}>
                      • {f.food_name}{f.quantity_g ? ` — ${f.quantity_g}g` : ''}
                    </Text>
                    {f.calories_kcal != null && (
                      <Text style={styles.foodMacros}>
                        {Math.round(f.calories_kcal)}kcal · P:{f.protein_g}g · C:{f.carbs_g}g · G:{f.fat_g}g
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  studentLabel: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  title: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 20 },
  noGoalsText: { color: '#525252', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  goalsCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16 },
  goalBarBlock: { marginBottom: 10 },
  goalBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  goalBarLabel: { color: '#a3a3a3', fontSize: 11 },
  goalBarValue: { color: '#f5f5f5', fontSize: 11, fontWeight: '600' },
  goalBarTrack: { height: 8, backgroundColor: '#0a0a0a', borderRadius: 4, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 4 },
  mealCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 8 },
  mealTitle: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  foodText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  foodMacros: { color: '#737373', fontSize: 10, marginTop: 1 },
});
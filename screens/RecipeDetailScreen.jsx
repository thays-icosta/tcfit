import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

const MEAL_OPTIONS = [
  { value: 'cafe', label: 'Café da manhã' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'lanche', label: 'Lanche' },
  { value: 'jantar', label: 'Jantar' },
  { value: 'ceia', label: 'Ceia' },
];

export default function RecipeDetailScreen({ recipe, studentId, onClose }) {
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [adding, setAdding] = useState(null);

  const handleAddToDiary = async (mealType) => {
    setAdding(mealType);
    const { error } = await supabase.from('food_diary_entries').insert({
      student_id: studentId,
      food_name: recipe.title,
      calories_kcal: recipe.calories_kcal,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      meal_type: mealType,
      entry_date: new Date().toISOString().slice(0, 10),
    });
    setAdding(null);
    setShowMealPicker(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      showAlert('Adicionado!', `${recipe.title} foi para o seu diário de hoje.`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>🍽️</Text>
          </View>
        )}

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.prep_time_minutes != null && (
            <Text style={styles.prepTime}>⏱ {recipe.prep_time_minutes} min de preparo</Text>
          )}

          <View style={styles.macroCard}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{Math.round(recipe.calories_kcal || 0)}</Text>
              <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.protein_g || 0}g</Text>
              <Text style={styles.macroLabel}>proteína</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.carbs_g || 0}g</Text>
              <Text style={styles.macroLabel}>carbo</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{recipe.fat_g || 0}g</Text>
              <Text style={styles.macroLabel}>gordura</Text>
            </View>
          </View>

          {studentId && (
            !showMealPicker ? (
              <TouchableOpacity style={styles.addButton} onPress={() => setShowMealPicker(true)}>
                <Text style={styles.addButtonText}>+ Adicionar ao Diário Alimentar</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.mealPickerBox}>
                <Text style={styles.mealPickerLabel}>Em qual refeição?</Text>
                <View style={styles.mealPickerRow}>
                  {MEAL_OPTIONS.map((m) => (
                    <TouchableOpacity key={m.value} style={styles.mealChip} onPress={() => handleAddToDiary(m.value)} disabled={adding === m.value}>
                      {adding === m.value ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.mealChipText}>{m.label}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setShowMealPicker(false)}>
                  <Text style={styles.mealPickerCancel}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            )
          )}

          <Text style={styles.sectionTitle}>Ingredientes</Text>
          <Text style={styles.bodyText}>{recipe.ingredients}</Text>

          <Text style={styles.sectionTitle}>Modo de preparo</Text>
          <Text style={styles.bodyText}>{recipe.instructions}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { paddingHorizontal: 16, marginBottom: 10 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  photo: { width: '100%', height: 220 },
  photoPlaceholder: { width: '100%', height: 180, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 40 },
  title: { color: '#f5f5f5', fontSize: 20, fontWeight: '800', marginTop: 16 },
  prepTime: { color: '#737373', fontSize: 12, marginTop: 4 },
  macroCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginTop: 16, gap: 12 },
  macroItem: { width: '44%', flexGrow: 1, alignItems: 'center' },
  macroValue: { color: '#22c55e', fontSize: 15, fontWeight: '800' },
  macroLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 3 },
  addButton: { backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  addButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  mealPickerBox: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginTop: 16 },
  mealPickerLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 10 },
  mealPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  mealChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  mealChipText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  mealPickerCancel: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  bodyText: { color: '#a3a3a3', fontSize: 13, lineHeight: 20 },
});
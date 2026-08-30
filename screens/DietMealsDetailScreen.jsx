import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Platform, InputAccessoryView } from 'react-native';
import { supabase } from './supabaseClient';
import FoodCatalogScreen from './FoodCatalogScreen';
import { showAlert } from './alertUtils';

const KEYBOARD_TOOLBAR_ID = 'dietDetailKeyboardToolbar';

export default function DietMealsDetailScreen({ dietId, dietName, studentId, onClose }) {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddMealForm, setShowAddMealForm] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealTime, setNewMealTime] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  const [manualAddFor, setManualAddFor] = useState(null);
  const [foodInputs, setFoodInputs] = useState({});
  const [savingFoodFor, setSavingFoodFor] = useState(null);
  const [catalogForMealId, setCatalogForMealId] = useState(null);

  const [expandedSubstitutesFor, setExpandedSubstitutesFor] = useState(null);
  const [substituteInputs, setSubstituteInputs] = useState({});
  const [savingSubstituteFor, setSavingSubstituteFor] = useState(null);
  const [catalogForSubstituteFoodId, setCatalogForSubstituteFoodId] = useState(null);

  const loadMeals = async () => {
    const { data } = await supabase
      .from('diet_meals')
      .select('id, name, meal_time, order_index, diet_meal_foods (id, food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index, diet_meal_food_substitutes (id, food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index))')
      .eq('diet_id', dietId)
      .order('order_index', { ascending: true });
    setMeals(data || []);
  };

  useEffect(() => {
    (async () => {
      await loadMeals();
      setLoading(false);
    })();
  }, [dietId]);

  const handleAddMeal = async () => {
    if (!newMealName.trim()) {
      showAlert('Ops', 'Dá um nome pra refeição (ex: "Café da manhã").');
      return;
    }
    Keyboard.dismiss();
    setSavingMeal(true);
    const { error } = await supabase.from('diet_meals').insert({
      diet_id: dietId,
      name: newMealName.trim(),
      meal_time: newMealTime.trim() || null,
      order_index: meals.length,
    });
    setSavingMeal(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setNewMealName('');
      setNewMealTime('');
      setShowAddMealForm(false);
      loadMeals();
    }
  };

  const handleRemoveMeal = (mealId) => {
    showAlert('Remover refeição', 'Tem certeza? Os alimentos dela também serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('diet_meals').delete().eq('id', mealId);
          loadMeals();
        },
      },
    ]);
  };

  const handleAddFoodManual = async (mealId) => {
    const value = foodInputs[mealId];
    if (!value || !value.trim()) {
      showAlert('Ops', 'Digita o nome do alimento primeiro.');
      return;
    }
    Keyboard.dismiss();
    setSavingFoodFor(mealId);
    const meal = meals.find((m) => m.id === mealId);
    const { error } = await supabase.from('diet_meal_foods').insert({
      meal_id: mealId,
      food_name: value.trim(),
      order_index: (meal?.diet_meal_foods || []).length,
    });
    setSavingFoodFor(null);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setFoodInputs((prev) => ({ ...prev, [mealId]: '' }));
      setManualAddFor(null);
      loadMeals();
    }
  };

  const handleAddFoodFromCatalog = async (foodData) => {
    const mealId = catalogForMealId;
    const meal = meals.find((m) => m.id === mealId);
    await supabase.from('diet_meal_foods').insert({
      meal_id: mealId,
      food_id: foodData.food_id,
      food_name: foodData.food_name,
      quantity_g: foodData.quantity_g,
      calories_kcal: foodData.calories_kcal,
      protein_g: foodData.protein_g,
      carbs_g: foodData.carbs_g,
      fat_g: foodData.fat_g,
      order_index: (meal?.diet_meal_foods || []).length,
    });
    loadMeals();
  };

  const handleRemoveFood = async (foodId) => {
    await supabase.from('diet_meal_foods').delete().eq('id', foodId);
    loadMeals();
  };

  const findFoodById = (foodId) => {
    for (const meal of meals) {
      const found = (meal.diet_meal_foods || []).find((f) => f.id === foodId);
      if (found) return found;
    }
    return null;
  };

  const handleAddSubstituteManual = async (dietMealFoodId) => {
    const value = substituteInputs[dietMealFoodId];
    if (!value || !value.trim()) {
      showAlert('Ops', 'Digita o nome do substituto primeiro.');
      return;
    }
    Keyboard.dismiss();
    setSavingSubstituteFor(dietMealFoodId);
    const food = findFoodById(dietMealFoodId);
    const { error } = await supabase.from('diet_meal_food_substitutes').insert({
      diet_meal_food_id: dietMealFoodId,
      food_name: value.trim(),
      order_index: (food?.diet_meal_food_substitutes || []).length,
    });
    setSavingSubstituteFor(null);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setSubstituteInputs((prev) => ({ ...prev, [dietMealFoodId]: '' }));
      loadMeals();
    }
  };

  const handleAddSubstituteFromCatalog = async (foodData) => {
    const dietMealFoodId = catalogForSubstituteFoodId;
    const food = findFoodById(dietMealFoodId);
    await supabase.from('diet_meal_food_substitutes').insert({
      diet_meal_food_id: dietMealFoodId,
      food_name: foodData.food_name,
      quantity_g: foodData.quantity_g,
      calories_kcal: foodData.calories_kcal,
      protein_g: foodData.protein_g,
      carbs_g: foodData.carbs_g,
      fat_g: foodData.fat_g,
      order_index: (food?.diet_meal_food_substitutes || []).length,
    });
    setCatalogForSubstituteFoodId(null);
    loadMeals();
  };

  const handleRemoveSubstitute = async (substituteId) => {
    await supabase.from('diet_meal_food_substitutes').delete().eq('id', substituteId);
    loadMeals();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (catalogForMealId) {
    return (
      <FoodCatalogScreen
        onAddFood={handleAddFoodFromCatalog}
        onClose={() => setCatalogForMealId(null)}
        recentForStudentId={studentId}
      />
    );
  }

  if (catalogForSubstituteFoodId) {
    return (
      <FoodCatalogScreen
        onAddFood={handleAddSubstituteFromCatalog}
        onClose={() => setCatalogForSubstituteFoodId(null)}
        recentForStudentId={studentId}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{dietName}</Text>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {!showAddMealForm ? (
              <TouchableOpacity style={styles.addMealButton} onPress={() => setShowAddMealForm(true)}>
                <Text style={styles.addMealButtonText}>+ Adicionar Refeição</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addMealFormCard}>
                <View style={styles.mealFormRow}>
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="Nome (ex: Almoço)"
                    placeholderTextColor="#737373"
                    value={newMealName}
                    onChangeText={setNewMealName}
                    inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="12:00"
                    placeholderTextColor="#737373"
                    value={newMealTime}
                    onChangeText={setNewMealTime}
                    inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                  />
                </View>
                <View style={styles.addMealFormButtonRow}>
                  <TouchableOpacity style={styles.addMealCancelButton} onPress={() => setShowAddMealForm(false)}>
                    <Text style={styles.addMealCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addMealConfirmButton} onPress={handleAddMeal} disabled={savingMeal}>
                    {savingMeal ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.addMealConfirmButtonText}>Adicionar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {meals.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma refeição cadastrada ainda.</Text>
            ) : (
              meals.map((meal) => {
                const mealTotals = (meal.diet_meal_foods || []).reduce(
                  (acc, f) => ({ kcal: acc.kcal + (f.calories_kcal || 0) }),
                  { kcal: 0 }
                );
                return (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealName}>{meal.name}{meal.meal_time ? ` · ${meal.meal_time}` : ''}</Text>
                      <View style={styles.mealHeaderRight}>
                        <Text style={styles.mealKcal}>{Math.round(mealTotals.kcal)} kcal</Text>
                        <TouchableOpacity onPress={() => handleRemoveMeal(meal.id)}>
                          <Text style={styles.removeX}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {(meal.diet_meal_foods || []).sort((a, b) => a.order_index - b.order_index).map((food) => {
                      const substitutes = (food.diet_meal_food_substitutes || []).sort((a, b) => a.order_index - b.order_index);
                      const isSubExpanded = expandedSubstitutesFor === food.id;
                      const tagText = [
                        food.quantity_g ? `${food.quantity_g}g` : null,
                        food.calories_kcal != null ? `${Math.round(food.calories_kcal)}kcal` : null,
                      ].filter(Boolean).join(' · ');
                      return (
                        <View key={food.id} style={styles.foodLineWrap}>
                          <View style={styles.foodLine}>
                            <Text style={styles.foodLineName} numberOfLines={1}>{food.food_name}</Text>
                            {tagText ? <Text style={styles.foodLineTag}>{tagText}</Text> : null}
                            <TouchableOpacity onPress={() => handleRemoveFood(food.id)}>
                              <Text style={styles.foodRemove}>✕</Text>
                            </TouchableOpacity>
                          </View>

                          {substitutes.map((sub) => (
                            <View key={sub.id} style={styles.substituteLine}>
                              <Text style={styles.substituteConnector}>OU</Text>
                              <Text style={styles.substituteText} numberOfLines={1}>
                                {sub.food_name}{sub.quantity_g ? ` — ${sub.quantity_g}g` : ''}
                              </Text>
                              <TouchableOpacity onPress={() => handleRemoveSubstitute(sub.id)}>
                                <Text style={styles.foodRemove}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}

                          <TouchableOpacity
                            onPress={() => setExpandedSubstitutesFor(isSubExpanded ? null : food.id)}
                          >
                            <Text style={styles.subLinkText}>
                              {isSubExpanded ? 'Fechar' : '+ Adicionar substituição'}
                            </Text>
                          </TouchableOpacity>

                          {isSubExpanded && (
                            <View style={styles.substituteForm}>
                              <TouchableOpacity
                                style={styles.substituteCatalogButton}
                                onPress={() => setCatalogForSubstituteFoodId(food.id)}
                              >
                                <Text style={styles.substituteCatalogButtonText}>Adicionar do Catálogo</Text>
                              </TouchableOpacity>
                              <View style={styles.substituteInputRow}>
                                <TextInput
                                  style={styles.substituteInput}
                                  placeholder="Ou digite manualmente"
                                  placeholderTextColor="#525252"
                                  value={substituteInputs[food.id] || ''}
                                  onChangeText={(t) => setSubstituteInputs((prev) => ({ ...prev, [food.id]: t }))}
                                  inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                                />
                                <TouchableOpacity
                                  style={styles.substituteAddButton}
                                  onPress={() => handleAddSubstituteManual(food.id)}
                                  disabled={savingSubstituteFor === food.id}
                                >
                                  {savingSubstituteFor === food.id ? (
                                    <ActivityIndicator color="#0a0a0a" size="small" />
                                  ) : (
                                    <Text style={styles.substituteAddButtonText}>+</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    <TouchableOpacity style={styles.addFoodButton} onPress={() => setCatalogForMealId(meal.id)}>
                      <Text style={styles.addFoodButtonText}>+ Adicionar Alimento</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setManualAddFor(manualAddFor === meal.id ? null : meal.id)}>
                      <Text style={styles.manualLink}>{manualAddFor === meal.id ? 'Cancelar' : 'ou adicionar manualmente'}</Text>
                    </TouchableOpacity>

                    {manualAddFor === meal.id && (
                      <View style={styles.foodInputRow}>
                        <TextInput
                          style={styles.foodInput}
                          placeholder="ex: tempero a gosto"
                          placeholderTextColor="#525252"
                          value={foodInputs[meal.id] || ''}
                          onChangeText={(t) => setFoodInputs((prev) => ({ ...prev, [meal.id]: t }))}
                          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_TOOLBAR_ID : undefined}
                        />
                        <TouchableOpacity
                          style={styles.foodAddButton}
                          onPress={() => handleAddFoodManual(meal.id)}
                          disabled={savingFoodFor === meal.id}
                        >
                          {savingFoodFor === meal.id ? (
                            <ActivityIndicator color="#0a0a0a" size="small" />
                          ) : (
                            <Text style={styles.foodAddButtonText}>+</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_TOOLBAR_ID}>
          <View style={styles.keyboardToolbar}>
            <TouchableOpacity onPress={Keyboard.dismiss}>
              <Text style={styles.keyboardToolbarText}>Concluído</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 20 },
  addMealButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginBottom: 14 },
  addMealButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  addMealFormCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 14 },
  mealFormRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  addMealFormButtonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addMealCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addMealCancelButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  addMealConfirmButton: { flex: 1, backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addMealConfirmButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  mealCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 10 },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mealName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealKcal: { color: '#737373', fontSize: 11 },
  removeX: { color: '#ef4444', fontSize: 14 },
  foodLineWrap: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  foodLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foodLineName: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  foodLineTag: { color: '#525252', fontSize: 10, marginLeft: 'auto' },
  foodRemove: { color: '#ef4444', fontSize: 11, marginLeft: 8 },
  substituteLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, marginTop: 4 },
  substituteConnector: { color: '#525252', fontSize: 9, fontWeight: '700' },
  substituteText: { color: '#737373', fontSize: 11, fontStyle: 'italic', flex: 1 },
  subLinkText: { color: '#3b82f6', fontSize: 10, fontWeight: '600', marginTop: 4, marginLeft: 10 },
  substituteForm: { marginTop: 8, marginLeft: 10 },
  substituteCatalogButton: { backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginBottom: 6 },
  substituteCatalogButtonText: { color: '#3b82f6', fontSize: 11, fontWeight: '700' },
  substituteInputRow: { flexDirection: 'row', gap: 6 },
  substituteInput: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: '#f5f5f5', fontSize: 11 },
  substituteAddButton: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', width: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  substituteAddButtonText: { color: '#a3a3a3', fontSize: 16, fontWeight: '700' },
  addFoodButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  addFoodButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  manualLink: { color: '#525252', fontSize: 10, textAlign: 'center', marginTop: 8, textDecorationLine: 'underline' },
  foodInputRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  foodInput: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 12 },
  foodAddButton: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', width: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  foodAddButtonText: { color: '#a3a3a3', fontSize: 18, fontWeight: '700' },
  keyboardToolbar: { backgroundColor: '#171717', borderTopWidth: 1, borderTopColor: '#292524', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'flex-end' },
  keyboardToolbarText: { color: '#f97316', fontSize: 14, fontWeight: '700' },
});
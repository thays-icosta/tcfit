import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Platform, InputAccessoryView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import FoodCatalogScreen from './FoodCatalogScreen';
import { showAlert, describeFunctionError } from './alertUtils';
import { useSpeechToText } from './useSpeechToText';

const KEYBOARD_TOOLBAR_ID = 'dietDetailKeyboardToolbar';

export default function DietMealsDetailScreen({ dietId, dietName, studentId, personalId, onClose }) {
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

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const { recording: aiRecording, toggle: handleToggleAiRecording } = useSpeechToText({
    active: showAiModal,
    getBaseText: () => aiInstruction,
    onTranscriptChange: setAiInstruction,
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importStudents, setImportStudents] = useState([]);
  const [importStudentSearch, setImportStudentSearch] = useState('');
  const [importSelectedStudent, setImportSelectedStudent] = useState(null);
  const [importStudentDiets, setImportStudentDiets] = useState([]);
  const [importing, setImporting] = useState(false);

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

  const handleOpenAiModal = () => {
    setAiInstruction('');
    setShowAiModal(true);
  };

  const handleGenerateDietWithAi = async () => {
    if (!aiInstruction.trim()) {
      showAlert('Ops', 'Descreve o plano alimentar que você quer gerar (ex: "dieta de 2000kcal pra emagrecimento, 4 refeições, sem lactose").');
      return;
    }
    setAiProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-diet', {
        body: { instruction: aiInstruction.trim() },
      });

      if (error || data?.error) {
        showAlert('Não deu pra gerar a dieta', await describeFunctionError(error, data, 'Tenta de novo em alguns instantes.'));
        setAiProcessing(false);
        return;
      }

      if (!data.meals || data.meals.length === 0) {
        showAlert('Nenhuma refeição gerada', 'A IA não retornou refeições. Tenta descrever de outro jeito.');
        setAiProcessing(false);
        return;
      }

      for (let mealIndex = 0; mealIndex < data.meals.length; mealIndex++) {
        const meal = data.meals[mealIndex];
        const { data: newMeal, error: mealError } = await supabase
          .from('diet_meals')
          .insert({
            diet_id: dietId,
            name: meal.name || 'Refeição',
            meal_time: meal.meal_time || null,
            order_index: meals.length + mealIndex,
          })
          .select()
          .single();
        if (mealError || !newMeal) continue;

        const foodRows = (meal.foods || []).map((food, foodIndex) => ({
          meal_id: newMeal.id,
          food_name: food.food_name || 'Alimento',
          quantity_g: food.quantity_g ?? null,
          calories_kcal: food.calories_kcal ?? null,
          protein_g: food.protein_g ?? null,
          carbs_g: food.carbs_g ?? null,
          fat_g: food.fat_g ?? null,
          order_index: foodIndex,
        }));
        if (foodRows.length > 0) {
          await supabase.from('diet_meal_foods').insert(foodRows);
        }
      }

      if (data.goal_kcal || data.goal_protein_g || data.goal_carbs_g || data.goal_fat_g) {
        await supabase
          .from('diets')
          .update({
            goal_kcal: data.goal_kcal ?? null,
            goal_protein_g: data.goal_protein_g ?? null,
            goal_carbs_g: data.goal_carbs_g ?? null,
            goal_fat_g: data.goal_fat_g ?? null,
          })
          .eq('id', dietId);
      }

      setAiProcessing(false);
      setShowAiModal(false);
      await loadMeals();
      showAlert('Dieta gerada!', `${data.meals.length} refeição(ões) criada(s). Revisa e ajusta o que quiser antes de salvar.`);
    } catch (e) {
      console.error('Erro ao gerar dieta com IA:', e);
      setAiProcessing(false);
      showAlert('Erro', e?.message || 'Não foi possível gerar a dieta agora.');
    }
  };

  const handleOpenImportModal = async () => {
    setImportSelectedStudent(null);
    setImportStudentDiets([]);
    setImportStudentSearch('');
    setShowImportModal(true);
    const { data } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('personal_id', personalId)
      .eq('role', 'aluno')
      .neq('id', studentId)
      .order('name');
    setImportStudents(data || []);
  };

  const handlePickImportStudent = async (student) => {
    setImportSelectedStudent(student);
    setImportStudentDiets([]);
    const { data } = await supabase
      .from('diets')
      .select('id, name, active')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    setImportStudentDiets(data || []);
  };

  const handleImportDiet = async (sourceDiet) => {
    setImporting(true);
    const { data: sourceMeals, error: loadError } = await supabase
      .from('diet_meals')
      .select('name, meal_time, order_index, diet_meal_foods (food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, food_id, order_index, diet_meal_food_substitutes (food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index))')
      .eq('diet_id', sourceDiet.id)
      .order('order_index', { ascending: true });

    if (loadError) {
      setImporting(false);
      showAlert('Erro', loadError.message);
      return;
    }

    if (!sourceMeals || sourceMeals.length === 0) {
      setImporting(false);
      showAlert('Dieta vazia', 'Essa dieta ainda não tem refeições pra importar.');
      return;
    }

    const baseOrder = meals.length;
    for (let i = 0; i < sourceMeals.length; i++) {
      const sourceMeal = sourceMeals[i];
      const { data: newMeal, error: mealError } = await supabase
        .from('diet_meals')
        .insert({ diet_id: dietId, name: sourceMeal.name, meal_time: sourceMeal.meal_time, order_index: baseOrder + i })
        .select()
        .single();
      if (mealError || !newMeal) continue;

      const foods = (sourceMeal.diet_meal_foods || []).sort((a, b) => a.order_index - b.order_index);
      for (let j = 0; j < foods.length; j++) {
        const food = foods[j];
        const { data: newFood, error: foodError } = await supabase
          .from('diet_meal_foods')
          .insert({
            meal_id: newMeal.id,
            food_name: food.food_name,
            quantity: food.quantity,
            quantity_g: food.quantity_g,
            calories_kcal: food.calories_kcal,
            protein_g: food.protein_g,
            carbs_g: food.carbs_g,
            fat_g: food.fat_g,
            food_id: food.food_id,
            order_index: j,
          })
          .select()
          .single();
        if (foodError || !newFood) continue;

        const substitutes = (food.diet_meal_food_substitutes || []).sort((a, b) => a.order_index - b.order_index);
        if (substitutes.length > 0) {
          await supabase.from('diet_meal_food_substitutes').insert(
            substitutes.map((sub, k) => ({
              diet_meal_food_id: newFood.id,
              food_name: sub.food_name,
              quantity: sub.quantity,
              quantity_g: sub.quantity_g,
              calories_kcal: sub.calories_kcal,
              protein_g: sub.protein_g,
              carbs_g: sub.carbs_g,
              fat_g: sub.fat_g,
              order_index: k,
            }))
          );
        }
      }
    }

    setImporting(false);
    setShowImportModal(false);
    setImportSelectedStudent(null);
    setImportStudentDiets([]);
    await loadMeals();
    showAlert('Dieta importada!', `${sourceMeals.length} refeição(ões) copiada(s) de ${importSelectedStudent?.name}. Revisa e ajusta o que quiser antes de salvar.`);
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

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.aiButtonRow}>
              <TouchableOpacity style={[styles.aiButton, { flex: 1 }]} onPress={handleOpenAiModal}>
                <Ionicons name="sparkles" size={16} color="#0a0a0a" />
                <Text style={styles.aiButtonText}>Gerar Dieta com IA</Text>
              </TouchableOpacity>
              {personalId && (
                <TouchableOpacity style={styles.importButton} onPress={handleOpenImportModal}>
                  <Ionicons name="download-outline" size={16} color="#f97316" />
                  <Text style={styles.importButtonText}>Importar de outro Aluno</Text>
                </TouchableOpacity>
              )}
            </View>

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

      <Modal visible={showAiModal} transparent animationType="slide" onRequestClose={() => setShowAiModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✨ Gerar Dieta com IA</Text>
            <Text style={styles.modalSubtitle}>
              Descreve o plano alimentar que você quer (objetivo, calorias/macros, restrições, quantidade de refeições).
            </Text>

            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              placeholder='ex: "Dieta de 2000kcal pra emagrecimento, 4 refeições, sem lactose"'
              placeholderTextColor="#525252"
              value={aiInstruction}
              onChangeText={setAiInstruction}
              multiline
              editable={!aiProcessing}
            />

            <TouchableOpacity
              style={[styles.aiMicButton, aiRecording && styles.aiMicButtonActive]}
              onPress={handleToggleAiRecording}
              disabled={aiProcessing}
            >
              <Ionicons name={aiRecording ? 'mic' : 'mic-outline'} size={18} color={aiRecording ? '#ef4444' : '#a3a3a3'} />
              <Text style={[styles.aiMicButtonText, aiRecording && styles.aiMicButtonTextActive]}>
                {aiRecording ? 'Gravando... toque pra parar' : 'Falar em vez de digitar'}
              </Text>
            </TouchableOpacity>

            <View style={styles.addMealFormButtonRow}>
              <TouchableOpacity style={styles.addMealCancelButton} onPress={() => setShowAiModal(false)} disabled={aiProcessing}>
                <Text style={styles.addMealCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addMealConfirmButton} onPress={handleGenerateDietWithAi} disabled={aiProcessing}>
                {aiProcessing ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.addMealConfirmButtonText}>Processar e Preencher</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {!importSelectedStudent ? (
              <>
                <Text style={styles.modalTitle}>Importar Dieta de outro Aluno</Text>
                <Text style={styles.modalSubtitle}>Escolha o aluno de onde você quer copiar um plano alimentar.</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Buscar aluno por nome..."
                  placeholderTextColor="#525252"
                  value={importStudentSearch}
                  onChangeText={setImportStudentSearch}
                />

                <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
                  {importStudents
                    .filter((s) => s.name?.toLowerCase().includes(importStudentSearch.trim().toLowerCase()))
                    .map((s) => (
                      <TouchableOpacity key={s.id} style={styles.importStudentRow} onPress={() => handlePickImportStudent(s)}>
                        <Text style={styles.importStudentName}>{s.name}</Text>
                        <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
                      </TouchableOpacity>
                    ))}
                  {importStudents.length === 0 && (
                    <Text style={styles.emptyText}>Você ainda não tem outros alunos cadastrados.</Text>
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.addMealCancelButton} onPress={() => setShowImportModal(false)}>
                  <Text style={styles.addMealCancelButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setImportSelectedStudent(null)} style={{ marginBottom: 8 }}>
                  <Text style={styles.closeText}>← Escolher outro aluno</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Planos de {importSelectedStudent.name}</Text>
                <Text style={styles.modalSubtitle}>Escolha qual plano copiar. As refeições, alimentos e substituições serão adicionados aqui, sem alterar o plano original.</Text>

                <ScrollView style={{ maxHeight: 320 }}>
                  {importStudentDiets.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.importStudentRow}
                      onPress={() => handleImportDiet(d)}
                      disabled={importing}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.importStudentName}>{d.name}</Text>
                        {d.active && <Text style={styles.importDietActiveTag}>Ativo</Text>}
                      </View>
                      {importing ? <ActivityIndicator color="#f97316" size="small" /> : <Ionicons name="download-outline" size={18} color="#f97316" />}
                    </TouchableOpacity>
                  ))}
                  {importStudentDiets.length === 0 && (
                    <Text style={styles.emptyText}>Esse aluno ainda não tem planos alimentares.</Text>
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.addMealCancelButton} onPress={() => setShowImportModal(false)} disabled={importing}>
                  <Text style={styles.addMealCancelButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  aiButtonRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  aiButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E05A17', borderRadius: 12, paddingVertical: 13 },
  aiButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  importButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 12 },
  importButtonText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  importStudentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  importStudentName: { color: '#f5f5f5', fontSize: 14, fontWeight: '600' },
  importDietActiveTag: { color: '#22c55e', fontSize: 10, fontWeight: '700', marginTop: 2 },
  aiMicButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, marginTop: 12 },
  aiMicButtonActive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  aiMicButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  aiMicButtonTextActive: { color: '#ef4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#171717', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 11, marginBottom: 16, lineHeight: 16 },
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
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView, Image, Alert, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import WorkoutPlayerScreen from './WorkoutPlayerScreen';
import AlunoProfileScreen from './AlunoProfileScreen';
import FoodCatalogScreen from './FoodCatalogScreen';
import AlunoAgendaScreen from './AlunoAgendaScreen';
import ChatScreen from './ChatScreen';
import RecipesScreen from './RecipesScreen';
import { showAlert } from './alertUtils';

const MEAL_OPTIONS = [
  { value: 'cafe', label: 'Café da manhã' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'lanche', label: 'Lanche' },
  { value: 'jantar', label: 'Jantar' },
  { value: 'ceia', label: 'Ceia' },
];

function mapMealNameToType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('café') || n.includes('cafe') || n.includes('manhã') || n.includes('manha')) return 'cafe';
  if (n.includes('almo')) return 'almoco';
  if (n.includes('lanche')) return 'lanche';
  if (n.includes('jant')) return 'jantar';
  if (n.includes('ceia')) return 'ceia';
  return 'lanche';
}

function mealLabel(code) {
  return MEAL_OPTIONS.find((m) => m.value === code)?.label || code;
}

export default function AlunoHomeScreen({ user, onLogout }) {
  const [personalId, setPersonalId] = useState(null);
  const [personalName, setPersonalName] = useState(null);
  const [personalAvatarUrl, setPersonalAvatarUrl] = useState(null);
  const [personalPhone, setPersonalPhone] = useState(null);
  const [personalPixKey, setPersonalPixKey] = useState(null);
  const [personalPaymentLink, setPersonalPaymentLink] = useState(null);
  const [ownAvatarUrl, setOwnAvatarUrl] = useState(null);
  const [studentType, setStudentType] = useState('consultoria');
  const [mode, setMode] = useState(null);
  const [chatPrefill, setChatPrefill] = useState('');
  const [dietSubTab, setDietSubTab] = useState('prescrita');
  const [workouts, setWorkouts] = useState([]);
  const [diets, setDiets] = useState([]);
  const [activeDietId, setActiveDietId] = useState(null);
  const [completedToday, setCompletedToday] = useState({});
  const [weekDaysCount, setWeekDaysCount] = useState(0);
  const [muscleSummaryByWorkout, setMuscleSummaryByWorkout] = useState({});
  const [mealsForActiveDiet, setMealsForActiveDiet] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState(null);
  const [hojeExpanded, setHojeExpanded] = useState(true);
  const [consumedTotals, setConsumedTotals] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [todaysEntries, setTodaysEntries] = useState([]);
  const [waterMl, setWaterMl] = useState(0);
  const [dailyNote, setDailyNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [nextDuePayment, setNextDuePayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playingWorkout, setPlayingWorkout] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [addingFoodForMeal, setAddingFoodForMeal] = useState(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);
  const [registeringKey, setRegisteringKey] = useState(null);
  const [pixCopied, setPixCopied] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const loadMuscleSummary = async (workoutList) => {
    const summaries = {};
    for (const w of workoutList) {
      const { data } = await supabase
        .from('workout_exercises')
        .select('exercises (muscle_group)')
        .eq('workout_id', w.id);
      const counts = {};
      (data || []).forEach((row) => {
        const group = row.exercises?.muscle_group || 'outro';
        counts[group] = (counts[group] || 0) + 1;
      });
      summaries[w.id] = Object.entries(counts);
    }
    setMuscleSummaryByWorkout(summaries);
  };

  const loadData = async () => {
    const { data: myRow } = await supabase
      .from('users')
      .select('personal_id, avatar_url, student_type')
      .eq('id', user.id)
      .single();

    setOwnAvatarUrl(myRow?.avatar_url || null);
    setPersonalId(myRow?.personal_id || null);
    setStudentType(myRow?.student_type || 'consultoria');

    if (myRow?.personal_id) {
      const { data: personalRow } = await supabase
        .from('users')
        .select('name, avatar_url, phone, pix_key, payment_link')
        .eq('id', myRow.personal_id)
        .single();
      setPersonalName(personalRow?.name || null);
      setPersonalAvatarUrl(personalRow?.avatar_url || null);
      setPersonalPhone(personalRow?.phone || null);
      setPersonalPixKey(personalRow?.pix_key || null);
      setPersonalPaymentLink(personalRow?.payment_link || null);
    }

    const { data: workoutRows } = await supabase
      .from('workouts')
      .select('id, name, notes, active, created_at, phase_id')
      .eq('student_id', user.id)
      .eq('active', true);
    setWorkouts(workoutRows || []);
    if (workoutRows && workoutRows.length > 0) {
      loadMuscleSummary(workoutRows);
    }

    const { data: dietRows } = await supabase
      .from('diets')
      .select('id, name, notes, active, created_at, goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g')
      .eq('student_id', user.id)
      .eq('active', true);
    setDiets(dietRows || []);
    if (dietRows && dietRows.length > 0) {
      setActiveDietId((prev) => (prev && dietRows.some((d) => d.id === prev)) ? prev : dietRows[0].id);
    }

    const { data: completions } = await supabase
      .from('workout_completions')
      .select('workout_id, completed_at')
      .eq('student_id', user.id)
      .gte('completed_at', `${todayStr}T00:00:00`);

    const map = {};
    (completions || []).forEach((c) => { map[c.workout_id] = true; });
    setCompletedToday(map);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: weekCompletions } = await supabase
      .from('workout_completions')
      .select('completed_at')
      .eq('student_id', user.id)
      .gte('completed_at', sevenDaysAgo.toISOString());
    const uniqueDays = new Set((weekCompletions || []).map((c) => c.completed_at.slice(0, 10)));
    setWeekDaysCount(uniqueDays.size);

    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('amount, due_date, description')
      .eq('student_id', user.id)
      .eq('paid', false)
      .order('due_date', { ascending: true })
      .limit(1);
    setNextDuePayment(pendingPayments && pendingPayments.length > 0 ? pendingPayments[0] : null);

    setLoading(false);
  };

  const loadMealsForDiet = async (dietId) => {
    if (!dietId) { setMealsForActiveDiet([]); return; }
    setLoadingMeals(true);
    const { data } = await supabase
      .from('diet_meals')
      .select('id, name, meal_time, order_index, diet_meal_foods (id, food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index, diet_meal_food_substitutes (id, food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index))')
      .eq('diet_id', dietId)
      .order('order_index', { ascending: true });
    setMealsForActiveDiet(data || []);
    setLoadingMeals(false);
  };

  const loadDiaryTotals = async () => {
    const { data } = await supabase
      .from('food_diary_entries')
      .select('id, food_name, meal_type, calories_kcal, protein_g, carbs_g, fat_g, quantity_g')
      .eq('student_id', user.id)
      .eq('entry_date', todayStr)
      .order('id', { ascending: true });
    setTodaysEntries(data || []);
    const totals = (data || []).reduce(
      (acc, e) => ({
        kcal: acc.kcal + (e.calories_kcal || 0),
        protein: acc.protein + (e.protein_g || 0),
        carbs: acc.carbs + (e.carbs_g || 0),
        fat: acc.fat + (e.fat_g || 0),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    setConsumedTotals(totals);
  };

  const loadWaterAndNote = async () => {
    const { data: waterRows } = await supabase
      .from('water_entries')
      .select('amount_ml')
      .eq('student_id', user.id)
      .eq('entry_date', todayStr);
    setWaterMl((waterRows || []).reduce((sum, w) => sum + w.amount_ml, 0));

    const { data: noteRow } = await supabase
      .from('diet_daily_notes')
      .select('notes')
      .eq('student_id', user.id)
      .eq('entry_date', todayStr)
      .maybeSingle();
    setDailyNote(noteRow?.notes || '');
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  useEffect(() => {
    if (activeDietId) loadMealsForDiet(activeDietId);
  }, [activeDietId]);

  useEffect(() => {
    loadDiaryTotals();
    loadWaterAndNote();
  }, [diaryRefreshKey, user.id]);

  const handleAddFoodToDiary = async (foodData) => {
    await supabase.from('food_diary_entries').insert({
      student_id: user.id,
      food_id: foodData.food_id,
      food_name: foodData.food_name,
      quantity_g: foodData.quantity_g,
      calories_kcal: foodData.calories_kcal,
      protein_g: foodData.protein_g,
      carbs_g: foodData.carbs_g,
      fat_g: foodData.fat_g,
      meal_type: addingFoodForMeal,
      entry_date: todayStr,
    });
    setAddingFoodForMeal(null);
    setDiaryRefreshKey((k) => k + 1);
  };

  const handleDeleteEntry = (entryId) => {
    showAlert('Remover registro', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('food_diary_entries').delete().eq('id', entryId);
          setDiaryRefreshKey((k) => k + 1);
        },
      },
    ]);
  };

  const handleRegisterOption = async (mealName, option, registerKey) => {
    setRegisteringKey(registerKey);
    const { error } = await supabase.from('food_diary_entries').insert({
      student_id: user.id,
      food_name: option.food_name,
      quantity_g: option.quantity_g,
      calories_kcal: option.calories_kcal,
      protein_g: option.protein_g,
      carbs_g: option.carbs_g,
      fat_g: option.fat_g,
      meal_type: mapMealNameToType(mealName),
      entry_date: todayStr,
    });
    setRegisteringKey(null);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setDiaryRefreshKey((k) => k + 1);
      showAlert('Registrado!', `${option.food_name} adicionado ao seu diário de hoje.`);
    }
  };

  const handleAddWater = async (ml) => {
    await supabase.from('water_entries').insert({ student_id: user.id, entry_date: todayStr, amount_ml: ml });
    setDiaryRefreshKey((k) => k + 1);
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    await supabase
      .from('diet_daily_notes')
      .upsert({ student_id: user.id, entry_date: todayStr, notes: dailyNote.trim() || null }, { onConflict: 'student_id,entry_date' });
    setSavingNote(false);
    setEditingNote(false);
  };

  const handleCopyPix = async () => {
    if (!personalPixKey) return;
    await Clipboard.setStringAsync(personalPixKey);
    setPixCopied(true);
    showAlert('Copiado!', 'Chave Pix copiada com sucesso!');
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleOpenChatFor = (message) => {
    setChatPrefill(message || '');
    setMode('chat');
  };

  const handleRealizarPagamento = async () => {
    if (!nextDuePayment) return;
    const hasAutoPayment = personalPixKey || personalPaymentLink;
    const amountLabel = `R$ ${Number(nextDuePayment.amount).toFixed(2)}`;

    if (!hasAutoPayment) {
      handleOpenChatFor(`Olá! Gostaria de renovar minha mensalidade de ${amountLabel}.`);
      return;
    }
    if (!personalPhone) {
      handleOpenChatFor(`Olá! Gostaria de renovar minha mensalidade de ${amountLabel}. Já copiei a chave Pix para realizar o pagamento.`);
      return;
    }

    const cleanPhone = personalPhone.replace(/\D/g, '');
    let message = `Olá${personalName ? `, ${personalName}` : ''}! Acabei de realizar o pagamento da minha mensalidade${nextDuePayment.description ? ` (${nextDuePayment.description})` : ''} de ${amountLabel}, vencimento ${formatDate(nextDuePayment.due_date)}. Segue o comprovante!`;
    if (personalPixKey) {
      message += ' Já copiei a chave Pix para realizar o pagamento.';
    }

    try {
      await Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`);
    } catch (e) {
      showAlert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const isOverdue = nextDuePayment && todayStr >= nextDuePayment.due_date;

  if (playingWorkout) {
    return (
      <WorkoutPlayerScreen
        workout={playingWorkout}
        studentId={user.id}
        onExit={() => {
          setPlayingWorkout(null);
          loadData();
        }}
      />
    );
  }

  if (showProfile) {
    return (
      <AlunoProfileScreen
        user={user}
        onLogout={onLogout}
        onClose={() => {
          setShowProfile(false);
          loadData();
        }}
      />
    );
  }

  if (showRecipes) {
    return (
      <RecipesScreen
        studentId={user.id}
        hasFullAccess={studentType === 'consultoria'}
        onClose={() => setShowRecipes(false)}
      />
    );
  }

  if (mode === 'agenda') {
    return <AlunoAgendaScreen studentId={user.id} onClose={() => setMode(null)} />;
  }

  if (mode === 'chat' && personalId) {
    return (
      <ChatScreen
        personalId={personalId}
        studentId={user.id}
        currentUserId={user.id}
        otherName={personalName}
        otherAvatarUrl={personalAvatarUrl}
        initialMessage={chatPrefill}
        onClose={() => {
          setMode(null);
          setChatPrefill('');
        }}
      />
    );
  }

  if (addingFoodForMeal) {
    return (
      <FoodCatalogScreen
        onAddFood={handleAddFoodToDiary}
        onClose={() => setAddingFoodForMeal(null)}
        recentForStudentId={user.id}
      />
    );
  }

  if (mode === 'treinos') {
    return (
      <View style={styles.subContainer}>
        <View style={styles.subTopBar}>
          <TouchableOpacity onPress={() => setMode(null)}>
            <Text style={styles.subCloseText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.subTitle}>Treinos</Text>
        </View>
        {workouts.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum treino ainda.</Text>
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => {
              const done = completedToday[item.id];
              const summary = muscleSummaryByWorkout[item.id] || [];
              return (
                <View style={styles.workoutCard}>
                  <View style={styles.workoutTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutName}>{item.name}</Text>
                      <Text style={styles.workoutDate}>Criado em {formatDate(item.created_at)}</Text>
                    </View>
                    <View style={[styles.statusDot, done ? styles.statusDotDone : styles.statusDotPending]} />
                  </View>

                  {summary.length > 0 && (
                    <View style={styles.summaryRow}>
                      {summary.map(([group, count]) => (
                        <View key={group} style={styles.summaryBadge}>
                          <Text style={styles.summaryBadgeText}>{count}x {group}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity style={styles.startButton} onPress={() => setPlayingWorkout(item)}>
                    <Text style={styles.startButtonText}>Iniciar Treino</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>
    );
  }

  if (mode === 'dieta') {
    return (
      <View style={styles.subContainer}>
        <View style={styles.subTopBar}>
          <TouchableOpacity onPress={() => setMode(null)}>
            <Text style={styles.subCloseText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.subTitle}>Dieta</Text>
        </View>

        <View style={styles.dietSubTabRow}>
          <TouchableOpacity
            style={[styles.dietSubTabButton, dietSubTab === 'prescrita' && styles.dietSubTabButtonActive]}
            onPress={() => setDietSubTab('prescrita')}
          >
            <Text style={[styles.dietSubTabText, dietSubTab === 'prescrita' && styles.dietSubTabTextActive]}>Dieta Prescrita</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dietSubTabButton, dietSubTab === 'diario' && styles.dietSubTabButtonActive]}
            onPress={() => setDietSubTab('diario')}
          >
            <Text style={[styles.dietSubTabText, dietSubTab === 'diario' && styles.dietSubTabTextActive]}>Diário Alimentar</Text>
          </TouchableOpacity>
        </View>

        {dietSubTab === 'prescrita' ? (
          <>
            {diets.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dietTabScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {diets.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.dietTabChip, activeDietId === d.id && styles.dietTabChipActive]}
                    onPress={() => setActiveDietId(d.id)}
                  >
                    <Text style={[styles.dietTabChipText, activeDietId === d.id && styles.dietTabChipTextActive]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
              {loadingMeals ? (
                <ActivityIndicator color="#f97316" style={{ marginTop: 10 }} />
              ) : mealsForActiveDiet.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma refeição prescrita ainda.</Text>
              ) : (
                mealsForActiveDiet.map((meal) => {
                  const isExpanded = expandedMealId === meal.id;
                  const mealTotals = (meal.diet_meal_foods || []).reduce((sum, f) => sum + (f.calories_kcal || 0), 0);
                  return (
                    <View key={meal.id} style={styles.mealAccordionCard}>
                      <TouchableOpacity
                        style={styles.mealAccordionHeader}
                        onPress={() => setExpandedMealId(isExpanded ? null : meal.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mealAccordionName}>{meal.name}</Text>
                          <Text style={styles.mealAccordionMeta}>
                            {meal.meal_time ? `${meal.meal_time} · ` : ''}{Math.round(mealTotals)} kcal
                          </Text>
                        </View>
                        <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#737373" />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.mealAccordionBody}>
                          {(meal.diet_meal_foods || []).sort((a, b) => a.order_index - b.order_index).map((food) => {
                            const substitutes = (food.diet_meal_food_substitutes || []).sort((a, b) => a.order_index - b.order_index);
                            const mainKey = `${food.id}-main`;
                            return (
                              <View key={food.id} style={styles.foodItemBox}>
                                <View style={styles.foodOptionRow}>
                                  <Text style={styles.foodText}>
                                    {food.food_name}{food.quantity_g ? ` — ${food.quantity_g}g` : food.quantity ? ` — ${food.quantity}` : ''}
                                  </Text>
                                  <TouchableOpacity
                                    style={styles.registerButton}
                                    onPress={() => handleRegisterOption(meal.name, food, mainKey)}
                                    disabled={registeringKey === mainKey}
                                  >
                                    {registeringKey === mainKey ? (
                                      <ActivityIndicator color="#22c55e" size="small" />
                                    ) : (
                                      <View style={styles.consumedBadge}>
                                        <Ionicons name="checkmark-outline" size={12} color="#22c55e" />
                                        <Text style={styles.consumedBadgeText}>Consumi</Text>
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                </View>

                                {substitutes.length > 0 && (
                                  <View style={styles.substitutesBox}>
                                    {substitutes.map((sub) => {
                                      const subKey = `${sub.id}-sub`;
                                      return (
                                        <View key={sub.id}>
                                          <Text style={styles.orConnector}>OU</Text>
                                          <View style={styles.foodOptionRow}>
                                            <Text style={styles.substituteText}>
                                              {sub.food_name}{sub.quantity_g ? ` — ${sub.quantity_g}g` : sub.quantity ? ` — ${sub.quantity}` : ''}
                                            </Text>
                                            <TouchableOpacity
                                              style={styles.registerButton}
                                              onPress={() => handleRegisterOption(meal.name, sub, subKey)}
                                              disabled={registeringKey === subKey}
                                            >
                                              {registeringKey === subKey ? (
                                                <ActivityIndicator color="#22c55e" size="small" />
                                              ) : (
                                                <View style={styles.consumedBadge}>
                                                  <Ionicons name="checkmark-outline" size={12} color="#22c55e" />
                                                  <Text style={styles.consumedBadgeText}>Consumi</Text>
                                                </View>
                                              )}
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      );
                                    })}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
            <View style={styles.hojeCard}>
              <TouchableOpacity style={styles.hojeHeader} onPress={() => setHojeExpanded(!hojeExpanded)}>
                <Text style={styles.hojeTitle}>Hoje</Text>
                <View style={styles.hojeHeaderRight}>
                  <Text style={styles.hojeSummary}>
                    {Math.round(consumedTotals.kcal)}{diets[0]?.goal_kcal ? ` / ${diets[0].goal_kcal}` : ''} kcal
                  </Text>
                  <Ionicons name={hojeExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#737373" />
                </View>
              </TouchableOpacity>

              {hojeExpanded && (
                <View style={styles.hojeBody}>
                  {[
                    { label: 'Calorias', value: consumedTotals.kcal, goal: diets[0]?.goal_kcal, unit: 'kcal', color: '#f97316' },
                    { label: 'Proteína', value: consumedTotals.protein, goal: diets[0]?.goal_protein_g, unit: 'g', color: '#3b82f6' },
                    { label: 'Carboidrato', value: consumedTotals.carbs, goal: diets[0]?.goal_carbs_g, unit: 'g', color: '#eab308' },
                    { label: 'Gordura', value: consumedTotals.fat, goal: diets[0]?.goal_fat_g, unit: 'g', color: '#ef4444' },
                  ].map((macro) => (
                    <View key={macro.label} style={styles.macroRow}>
                      <View style={styles.macroLabelRow}>
                        <Text style={styles.macroLabel}>{macro.label}</Text>
                        <Text style={styles.macroValue}>
                          {Math.round(macro.value)}{macro.goal ? ` / ${macro.goal}` : ''}{macro.unit}
                        </Text>
                      </View>
                      {macro.goal ? (
                        <View style={styles.macroBarTrack}>
                          <View style={[styles.macroBarFill, { width: `${Math.min(100, (macro.value / macro.goal) * 100)}%`, backgroundColor: macro.color }]} />
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.waterCard}>
              <View style={styles.waterHeaderRow}>
                <Text style={styles.waterTitle}>Água</Text>
                <Text style={styles.waterValue}>{(waterMl / 1000).toFixed(1)}L / 2.0L</Text>
              </View>
              <View style={styles.macroBarTrack}>
                <View style={[styles.macroBarFill, { width: `${Math.min(100, (waterMl / 2000) * 100)}%`, backgroundColor: '#3b82f6' }]} />
              </View>
              <View style={styles.waterButtonsRow}>
                <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(250)}>
                  <Text style={styles.waterButtonText}>+250ml</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.waterButton} onPress={() => handleAddWater(500)}>
                  <Text style={styles.waterButtonText}>+500ml</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteCardTitle}>Observação sobre sua dieta hoje</Text>
              {editingNote ? (
                <>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="ex: senti muita fome à tarde"
                    placeholderTextColor="#525252"
                    value={dailyNote}
                    onChangeText={setDailyNote}
                    multiline
                  />
                  <TouchableOpacity style={styles.noteSaveButton} onPress={handleSaveNote} disabled={savingNote}>
                    {savingNote ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.noteSaveButtonText}>Salvar</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => setEditingNote(true)}>
                  <Text style={styles.noteText}>{dailyNote || 'Toque pra escrever uma observação...'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!showMealPicker ? (
              <TouchableOpacity style={styles.addExtraButton} onPress={() => setShowMealPicker(true)}>
                <Text style={styles.addExtraButtonText}>+ Registrar Alimento Extra</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.mealPickerBox}>
                <Text style={styles.mealPickerLabel}>Em qual refeição?</Text>
                <View style={styles.mealPickerRow}>
                  {MEAL_OPTIONS.map((m) => (
                    <TouchableOpacity
                      key={m.value}
                      style={styles.mealPickerChip}
                      onPress={() => {
                        setShowMealPicker(false);
                        setAddingFoodForMeal(m.value);
                      }}
                    >
                      <Text style={styles.mealPickerChipText}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setShowMealPicker(false)}>
                  <Text style={styles.mealPickerCancel}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionTitle}>Registros de hoje</Text>
            {todaysEntries.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum alimento registrado ainda hoje.</Text>
            ) : (
              todaysEntries.map((entry) => (
                <View key={entry.id} style={styles.entryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryFoodName}>{entry.food_name}</Text>
                    <Text style={styles.entryMeta}>{mealLabel(entry.meal_type)}{entry.quantity_g ? ` · ${entry.quantity_g}g` : ''} · {Math.round(entry.calories_kcal || 0)}kcal</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEntry(entry.id)}>
                    <Text style={styles.entryDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => setShowProfile(true)} style={styles.topRowLeft}>
          <View style={styles.ownAvatarCircle}>
            {ownAvatarUrl ? (
              <Image key={ownAvatarUrl} source={{ uri: ownAvatarUrl }} style={styles.ownAvatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.ownAvatarLetter}>{user?.name?.charAt(0).toUpperCase() || '?'}</Text>
            )}
          </View>
          <View>
            <Text style={styles.badge}>ALUNO</Text>
            <Text style={styles.greeting}>Olá, {user?.name}!</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => handleOpenChatFor('')}>
          <Ionicons name="calendar-outline" size={20} color="#a3a3a3" onPress={() => setMode('agenda')} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <>
          {nextDuePayment ? (
            <View style={[styles.financeBanner, isOverdue && styles.financeBannerOverdue]}>
              <View style={styles.financeBannerRow}>
                <Ionicons name={isOverdue ? 'alert-circle-outline' : 'cash-outline'} size={16} color={isOverdue ? '#ef4444' : '#eab308'} />
                <Text style={[styles.financeBannerText, isOverdue && styles.financeBannerTextOverdue]}>
                  {isOverdue ? 'Mensalidade vencida: ' : 'Próxima mensalidade: '}
                  R$ {Number(nextDuePayment.amount).toFixed(2)} · vence {formatDate(nextDuePayment.due_date)}
                </Text>
              </View>
              <View style={styles.payButtonsRow}>
                {personalPixKey && (
                  <TouchableOpacity style={styles.copyPixButton} onPress={handleCopyPix}>
                    <Ionicons name={pixCopied ? 'checkmark-outline' : 'copy-outline'} size={14} color="#3b82f6" />
                    <Text style={styles.copyPixButtonText}>{pixCopied ? 'Copiado!' : 'Copiar Pix'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.payButton, isOverdue && styles.payButtonOverdue]} onPress={handleRealizarPagamento}>
                  <Ionicons name="logo-whatsapp" size={14} color="#0a0a0a" />
                  <Text style={styles.payButtonText}>Realizar Pagamento</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.financeBanner, styles.financeBannerOk]}>
              <View style={styles.financeBannerRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
                <Text style={[styles.financeBannerText, { color: '#22c55e' }]}>Financeiro em dia</Text>
              </View>
            </View>
          )}

          <View style={styles.gridWrap}>
            <View style={styles.gridRow}>
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => personalId && handleOpenChatFor('')}
                disabled={!personalId}
              >
                {personalAvatarUrl ? (
                  <Image source={{ uri: personalAvatarUrl }} style={styles.gridPersonalAvatar} />
                ) : (
                  <View style={styles.gridPersonalAvatarPlaceholder}>
                    <Text style={styles.gridPersonalAvatarLetter}>{personalName?.charAt(0).toUpperCase() || '?'}</Text>
                  </View>
                )}
                <Text style={styles.gridCardTitle}>{personalName || 'Sem personal'}</Text>
                <Text style={styles.gridCardSubtitle}>Seu personal</Text>
              </TouchableOpacity>

              <View style={styles.gridCard}>
                <Ionicons name="checkmark-done-outline" size={26} color="#22c55e" />
                <Text style={styles.gridBigNumber}>{weekDaysCount}/7</Text>
                <Text style={styles.gridCardSubtitle}>dias treinados essa semana</Text>
              </View>
            </View>

            <View style={styles.gridRow}>
              <TouchableOpacity style={styles.gridCard} onPress={() => setMode('treinos')}>
                <Ionicons name="barbell-outline" size={26} color="#f97316" />
                <Text style={styles.gridCardTitle}>Treinos</Text>
                <Text style={styles.gridCardSubtitle}>{workouts.length} ficha{workouts.length !== 1 ? 's' : ''}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridCard} onPress={() => setMode('dieta')}>
                <Ionicons name="restaurant-outline" size={26} color="#3b82f6" />
                <Text style={styles.gridCardTitle}>Dieta</Text>
                <Text style={styles.gridCardSubtitle}>{diets.length} plano{diets.length !== 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.recipesBanner} onPress={() => setShowRecipes(true)}>
            <Text style={styles.recipesBannerText}>🍽️ Guia de Receitas Fitness</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 },
  topRowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center' },
  ownAvatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 },
  ownAvatarImage: { width: 44, height: 44 },
  ownAvatarLetter: { color: '#f97316', fontSize: 16, fontWeight: '800' },
  badge: { color: '#f97316', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  greeting: { color: '#f5f5f5', fontSize: 20, fontWeight: '700' },
  financeBanner: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#eab308', borderRadius: 12, padding: 12, marginBottom: 16 },
  financeBannerOverdue: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  financeBannerOk: { borderColor: '#22c55e' },
  financeBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  financeBannerText: { color: '#eab308', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  financeBannerTextOverdue: { color: '#ef4444' },
  payButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  copyPixButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingVertical: 10 },
  copyPixButtonText: { color: '#3b82f6', fontSize: 11, fontWeight: '800' },
  payButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 10 },
  payButtonOverdue: { backgroundColor: '#ef4444' },
  payButtonText: { color: '#0a0a0a', fontSize: 11, fontWeight: '800' },
  gridWrap: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridCard: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', minHeight: 130 },
  gridPersonalAvatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 8 },
  gridPersonalAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gridPersonalAvatarLetter: { color: '#f97316', fontSize: 16, fontWeight: '800' },
  gridBigNumber: { color: '#f5f5f5', fontSize: 24, fontWeight: '800', marginTop: 6 },
  gridCardTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  gridCardSubtitle: { color: '#737373', fontSize: 10, marginTop: 4, textAlign: 'center' },
  recipesBanner: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  recipesBannerText: { color: '#f97316', fontSize: 13, fontWeight: '700' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12 },
  button: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#f97316', fontSize: 15, fontWeight: '700' },
  subContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  subTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  subCloseText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  subTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  workoutCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 16, marginBottom: 12 },
  workoutTopRow: { flexDirection: 'row', alignItems: 'center' },
  workoutName: { color: '#f5f5f5', fontSize: 16, fontWeight: '700' },
  workoutDate: { color: '#525252', fontSize: 10, marginTop: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  statusDotDone: { backgroundColor: '#22c55e' },
  statusDotPending: { backgroundColor: '#525252' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  summaryBadge: { backgroundColor: '#0a0a0a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  summaryBadgeText: { color: '#a3a3a3', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  startButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  startButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  dietSubTabRow: { flexDirection: 'row', backgroundColor: '#171717', borderRadius: 10, padding: 3, marginHorizontal: 16, marginBottom: 14 },
  dietSubTabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  dietSubTabButtonActive: { backgroundColor: '#22c55e' },
  dietSubTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  dietSubTabTextActive: { color: '#0a0a0a' },
  dietTabScroll: { maxHeight: 46, marginBottom: 8 },
  dietTabChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  dietTabChipActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  dietTabChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  dietTabChipTextActive: { color: '#0a0a0a' },
  mealAccordionCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  mealAccordionHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  mealAccordionName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  mealAccordionMeta: { color: '#737373', fontSize: 11, marginTop: 2 },
  mealAccordionBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  foodItemBox: { marginTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#0a0a0a' },
  foodOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodText: { color: '#a3a3a3', fontSize: 12, flexShrink: 1 },
  registerButton: { padding: 2 },
  consumedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  consumedBadgeText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  orConnector: { color: '#525252', fontSize: 9, fontWeight: '700', marginVertical: 4, marginLeft: 8 },
  substitutesBox: { marginLeft: 8, marginTop: 2 },
  substituteText: { color: '#737373', fontSize: 11, flexShrink: 1 },
  hojeCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  hojeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  hojeTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  hojeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hojeSummary: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  hojeBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  macroRow: { marginTop: 12 },
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  macroLabel: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  macroValue: { color: '#f5f5f5', fontSize: 11, fontWeight: '700' },
  macroBarTrack: { height: 6, backgroundColor: '#0a0a0a', borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 3 },
  waterCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 14 },
  waterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  waterTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  waterValue: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  waterButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  waterButton: { flex: 1, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  waterButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  noteCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 14 },
  noteCardTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  noteText: { color: '#737373', fontSize: 12, fontStyle: 'italic' },
  noteInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 12, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
  noteSaveButton: { backgroundColor: '#f97316', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  noteSaveButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  addExtraButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  addExtraButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  mealPickerBox: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16 },
  mealPickerLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 10 },
  mealPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  mealPickerChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  mealPickerChipText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  mealPickerCancel: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 12, marginBottom: 8 },
  entryFoodName: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  entryMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  entryDelete: { color: '#ef4444', fontSize: 14, marginLeft: 8 },
});
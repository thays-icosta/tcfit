import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView, Image, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import WorkoutPlayerScreen from './WorkoutPlayerScreen';
import WorkoutPreviewScreen from './WorkoutPreviewScreen';
import MetricsMiniCards from './MetricsMiniCards';
import WeightEvolutionChart from './WeightEvolutionChart';
import WaterLogModal from './WaterLogModal';
import WeightLogModal from './WeightLogModal';
import VolumeSummaryScreen from './VolumeSummaryScreen';
import AlunoProfileScreen from './AlunoProfileScreen';
import FoodCatalogScreen from './FoodCatalogScreen';
import AlunoAgendaScreen from './AlunoAgendaScreen';
import ChatScreen from './ChatScreen';
import RecipesScreen from './RecipesScreen';
import AlunoProductsScreen from './AlunoProductsScreen';
import AlunoTabBar from './AlunoTabBar';
import ProgramDetailScreen from './ProgramDetailScreen';
import MeusProjetosSection from './MeusProjetosSection';
import ProjectDashboardScreen from './ProjectDashboardScreen';
import AnamneseFormScreen from './AnamneseFormScreen';
import UpgradeLockModal from './UpgradeLockModal';
import AlunoEvolutionScreen from './AlunoEvolutionScreen';
import FoodSubstituteScreen from './FoodSubstituteScreen';
import { showAlert } from './alertUtils';
import { hasAccessByLevel, PROGRAM_LEVELS, PROGRAM_GOALS, RUNNING_LEVELS } from './accessLevel';
import { HeaderWelcome, HeaderBack } from './Header';
import { toTitleCase } from './textUtils';
import { COVER_TOP_IMAGE, coverFocalImageStyle, GLASS_CARD } from './vitrineStyles';
import ProductDetailModal from './ProductDetailModal';
import CollapsibleSection, { animateNextLayout } from './CollapsibleSection';
import { getJsonPref, setJsonPref } from './localPrefs';

const ACCENT = '#FF6B00';

const PROGRAM_HUB_GROUPS = [
  { key: 'academia', title: 'TREINOS NA ACADEMIA', categories: ['planilha_academia', 'treino_3d', 'treino_extra'], icon: 'barbell-outline' },
  { key: 'corrida_cardio', title: 'CORRIDA & CARDIO', categories: ['modulo_corrida'], icon: 'walk-outline' },
  { key: 'em_casa', title: 'TREINOS EM CASA', categories: ['planilha_casa'], icon: 'home-outline' },
];

const NUTRITION_LIBRARY_CATEGORIES = ['dieta_ebook'];

function buildHubGroups(products, audienceFilter) {
  return PROGRAM_HUB_GROUPS.map((group) => {
    const items = products.filter((p) => {
      if (!group.categories.includes(p.category)) return false;
      if (!audienceFilter || audienceFilter === 'todos') return true;
      return !p.target_audience || p.target_audience === 'unissex' || p.target_audience === audienceFilter;
    });
    if (items.length === 0) return null;
    const cover = items.find((p) => p.cover_image_url)?.cover_image_url || null;
    const badgeSet = new Set();
    items.forEach((p) => {
      const lvl = PROGRAM_LEVELS.find((l) => l.value === p.level)?.label;
      const goal = PROGRAM_GOALS.find((g) => g.value === p.goal)?.label;
      if (lvl) badgeSet.add(lvl);
      if (goal) badgeSet.add(goal);
    });
    return { ...group, items, cover, badges: Array.from(badgeSet) };
  }).filter(Boolean);
}

// The Módulo Corrida section is a fixed 4-step roadmap (not a generic
// category list) — each RUNNING_LEVELS slot shows the matching published
// product, or a locked placeholder if the personal hasn't created it yet.
function buildRunningLevelCards(products, audienceFilter) {
  const corridaProducts = products.filter((p) => {
    if (p.category !== 'modulo_corrida') return false;
    if (!audienceFilter || audienceFilter === 'todos') return true;
    return !p.target_audience || p.target_audience === 'unissex' || p.target_audience === audienceFilter;
  });
  return RUNNING_LEVELS.map((lvl) => ({
    ...lvl,
    product: corridaProducts.find((p) => p.running_level === lvl.value) || null,
  }));
}

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

// Fixed, non-overlapping hour windows used to guess which meal the aluno is
// "in" right now, so its accordion can auto-expand while the others (already
// logged, or not due yet) stay collapsed.
function currentMealWindowKey() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 10) return 'cafe';
  if (hour >= 10 && hour < 14) return 'almoco';
  if (hour >= 14 && hour < 17) return 'lanche';
  if (hour >= 17 && hour < 21) return 'jantar';
  return 'ceia';
}

export default function AlunoHomeScreen({ user, onLogout, openChatOnMount, onConsumeInitialChat }) {
  const [personalId, setPersonalId] = useState(null);
  const [myAccessLevel, setMyAccessLevel] = useState('plataforma_base');
  const [myGender, setMyGender] = useState(null);
  const [hubAudienceFilter, setHubAudienceFilter] = useState('todos');
  const [hubCollapsedSections, setHubCollapsedSections] = useState({});
  const [resumoDoDiaCollapsed, setResumoDoDiaCollapsed] = useState(false);
  const [waterCardCollapsed, setWaterCardCollapsed] = useState(false);
  const [diarioMealOverrides, setDiarioMealOverrides] = useState({});
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
  const [waterGoalMl, setWaterGoalMl] = useState(2000);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [todaysWeightKg, setTodaysWeightKg] = useState(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [lastWorkoutName, setLastWorkoutName] = useState(null);
  const [lastCompletedWorkoutId, setLastCompletedWorkoutId] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [sessionOfInterestExercisesDone, setSessionOfInterestExercisesDone] = useState(0);
  const [showVolumeSummary, setShowVolumeSummary] = useState(false);
  const [dailyNote, setDailyNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [nextDuePayment, setNextDuePayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playingWorkout, setPlayingWorkout] = useState(null);
  const [previewWorkout, setPreviewWorkout] = useState(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showNutritionLibrary, setShowNutritionLibrary] = useState(false);
  const [addingFoodForMeal, setAddingFoodForMeal] = useState(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);
  const [registeringKey, setRegisteringKey] = useState(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [categorizedProducts, setCategorizedProducts] = useState([]);
  const [unlockedProductIds, setUnlockedProductIds] = useState(new Set());
  const [openProgram, setOpenProgram] = useState(null);
  const [openStudentProjectId, setOpenStudentProjectId] = useState(null);
  const [openCategoryGroup, setOpenCategoryGroup] = useState(null);
  const [collections, setCollections] = useState([]);
  const [openCollection, setOpenCollection] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAnamnesePrompt, setShowAnamnesePrompt] = useState(false);
  const [showEvolution, setShowEvolution] = useState(false);
  const [showEvolutionLock, setShowEvolutionLock] = useState(false);

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
      .select('personal_id, avatar_url, student_type, access_level, anamnese_completed_at, water_goal_ml, gender')
      .eq('id', user.id)
      .single();

    setOwnAvatarUrl(myRow?.avatar_url || null);
    setPersonalId(myRow?.personal_id || null);
    setStudentType(myRow?.student_type || 'consultoria');
    setShowAnamnesePrompt(!!myRow?.personal_id && !myRow?.anamnese_completed_at);
    setWaterGoalMl(myRow?.water_goal_ml || 2000);
    setMyGender(myRow?.gender || null);

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

      const [{ data: productRows }, { data: grantRows }, { data: collectionRows }] = await Promise.all([
        supabase.from('products').select('*').eq('personal_id', myRow.personal_id).eq('active', true),
        supabase.from('product_grants').select('product_id').eq('student_id', user.id),
        supabase.from('product_collections').select('*').eq('personal_id', myRow.personal_id).order('order_index'),
      ]);
      setCollections(collectionRows || []);
      const level = myRow?.access_level || 'plataforma_base';
      setMyAccessLevel(level);
      const grantedIds = new Set((grantRows || []).map((g) => g.product_id));
      const unlocked = new Set();
      (productRows || []).forEach((p) => {
        if (grantedIds.has(p.id) || hasAccessByLevel(level, p.required_access_level)) unlocked.add(p.id);
      });
      setUnlockedProductIds(unlocked);
      setCategorizedProducts(productRows || []);
    }

    const { data: workoutRows } = await supabase
      .from('workouts')
      .select('id, name, notes, active, created_at, phase_id')
      .eq('student_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true });
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

    const { data: todaySessionRows } = await supabase
      .from('workout_sessions')
      .select('id, workout_id, started_at, finished_at, pse')
      .eq('student_id', user.id)
      .gte('started_at', `${todayStr}T00:00:00`)
      .order('started_at', { ascending: false });
    setTodaySessions(todaySessionRows || []);

    const activeSessionRow = (todaySessionRows || []).find((s) => !s.finished_at) || null;
    const latestFinishedSessionRow = (todaySessionRows || []).find((s) => s.finished_at) || null;
    const sessionOfInterest = activeSessionRow || latestFinishedSessionRow || null;
    if (sessionOfInterest) {
      const { data: sessionSets } = await supabase
        .from('workout_session_sets')
        .select('workout_exercise_id')
        .eq('session_id', sessionOfInterest.id);
      setSessionOfInterestExercisesDone(new Set((sessionSets || []).map((s) => s.workout_exercise_id)).size);
    } else {
      setSessionOfInterestExercisesDone(0);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: weekCompletions } = await supabase
      .from('workout_completions')
      .select('completed_at')
      .eq('student_id', user.id)
      .gte('completed_at', sevenDaysAgo.toISOString());
    const uniqueDays = new Set((weekCompletions || []).map((c) => c.completed_at.slice(0, 10)));
    setWeekDaysCount(uniqueDays.size);

    const { data: lastSessionRows } = await supabase
      .from('workout_sessions')
      .select('workout_id, workouts (name)')
      .eq('student_id', user.id)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1);
    setLastWorkoutName(lastSessionRows?.[0]?.workouts?.name || null);
    setLastCompletedWorkoutId(lastSessionRows?.[0]?.workout_id || null);

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

    const { data: weightRow } = await supabase
      .from('weight_entries')
      .select('weight_kg')
      .eq('student_id', user.id)
      .eq('entry_date', todayStr)
      .maybeSingle();
    setTodaysWeightKg(weightRow?.weight_kg ?? null);
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  useEffect(() => {
    if (myGender) setHubAudienceFilter(myGender);
  }, [myGender]);

  useEffect(() => {
    getJsonPref('hub_collapsed_sections_v1', {}).then(setHubCollapsedSections);
  }, []);

  // Tapping a 'projeto' product either resumes the student's existing run
  // (student_projects, unique per student+project_template) or creates it on
  // first tap, then opens the dashboard directly — mirrors ProgramDetailScreen's
  // "add once, then just open" behavior for treino_template products.
  const handleOpenProjectProduct = async (product) => {
    if (!unlockedProductIds.has(product.id)) {
      setSelectedProduct(product);
      return;
    }
    const { data: existing } = await supabase
      .from('student_projects')
      .select('id')
      .eq('student_id', user.id)
      .eq('project_template_id', product.project_template_id)
      .maybeSingle();
    let studentProjectId = existing?.id;
    if (!studentProjectId) {
      const { data: created } = await supabase
        .from('student_projects')
        .insert({ project_template_id: product.project_template_id, product_id: product.id, student_id: user.id, personal_id: personalId })
        .select()
        .single();
      studentProjectId = created?.id;
    }
    if (studentProjectId) setOpenStudentProjectId(studentProjectId);
  };

  const openProductOrProgram = (p) => {
    if (p.type === 'treino_template') setOpenProgram(p);
    else if (p.type === 'projeto') handleOpenProjectProduct(p);
    else setSelectedProduct(p);
  };

  const toggleHubSection = (key) => {
    animateNextLayout();
    setHubCollapsedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setJsonPref('hub_collapsed_sections_v1', next);
      return next;
    });
  };

  useEffect(() => {
    if (openChatOnMount && personalId) {
      handleOpenChatFor('');
      onConsumeInitialChat?.();
    }
  }, [openChatOnMount, personalId]);

  useEffect(() => {
    if (activeDietId) loadMealsForDiet(activeDietId);
  }, [activeDietId]);

  useEffect(() => {
    loadDiaryTotals();
    loadWaterAndNote();
  }, [diaryRefreshKey, user.id]);

  const applyEntriesDelta = (rows, sign) => {
    if (!rows || rows.length === 0) return;
    setTodaysEntries((prev) => (sign > 0 ? [...prev, ...rows] : prev.filter((e) => !rows.some((r) => r.id === e.id))));
    setConsumedTotals((prev) => rows.reduce((acc, r) => ({
      kcal: acc.kcal + sign * (r.calories_kcal || 0),
      protein: acc.protein + sign * (r.protein_g || 0),
      carbs: acc.carbs + sign * (r.carbs_g || 0),
      fat: acc.fat + sign * (r.fat_g || 0),
    }), prev));
  };

  const handleAddFoodToDiary = async (foodData) => {
    const { data, error } = await supabase.from('food_diary_entries').insert({
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
    }).select().single();
    setAddingFoodForMeal(null);
    if (!error && data) {
      applyEntriesDelta([data], 1);
    } else {
      setDiaryRefreshKey((k) => k + 1);
    }
  };

  const handleDeleteEntry = (entryId) => {
    showAlert('Remover registro', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const removed = todaysEntries.find((e) => e.id === entryId);
          if (removed) applyEntriesDelta([removed], -1);
          const { error } = await supabase.from('food_diary_entries').delete().eq('id', entryId);
          if (error) setDiaryRefreshKey((k) => k + 1);
        },
      },
    ]);
  };

  const handleRegisterOption = async (mealName, option, registerKey) => {
    setRegisteringKey(registerKey);
    const { data, error } = await supabase.from('food_diary_entries').insert({
      student_id: user.id,
      food_name: option.food_name,
      quantity_g: option.quantity_g,
      calories_kcal: option.calories_kcal,
      protein_g: option.protein_g,
      carbs_g: option.carbs_g,
      fat_g: option.fat_g,
      meal_type: mapMealNameToType(mealName),
      entry_date: todayStr,
    }).select().single();
    setRegisteringKey(null);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      applyEntriesDelta([data], 1);
      showAlert('Registrado!', `${option.food_name} adicionado ao seu diário de hoje.`);
    }
  };

  const handleCompleteMeal = async (meal) => {
    const foods = meal.diet_meal_foods || [];
    if (foods.length === 0) return;
    const mealKey = `${meal.id}-meal`;
    setRegisteringKey(mealKey);
    const { data, error } = await supabase.from('food_diary_entries').insert(
      foods.map((food) => ({
        student_id: user.id,
        food_name: food.food_name,
        quantity_g: food.quantity_g,
        calories_kcal: food.calories_kcal,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        meal_type: mapMealNameToType(meal.name),
        entry_date: todayStr,
      }))
    ).select();
    setRegisteringKey(null);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      applyEntriesDelta(data, 1);
      showAlert('Refeição concluída!', `${meal.name} registrada no seu diário de hoje.`);
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
    } catch {
      showAlert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const isOverdue = nextDuePayment && todayStr >= nextDuePayment.due_date;

  const hubGroups = buildHubGroups(categorizedProducts, hubAudienceFilter).filter((g) => g.key !== 'corrida_cardio');
  const hasAnyHubProgram = buildHubGroups(categorizedProducts, 'todos').length > 0;
  const runningLevelCards = buildRunningLevelCards(categorizedProducts, hubAudienceFilter);
  const hasAnyRunningProgram = buildRunningLevelCards(categorizedProducts, 'todos').some((c) => c.product);
  const showHubAudienceToggle = !myGender;

  const nutritionItems = categorizedProducts.filter((p) => NUTRITION_LIBRARY_CATEGORIES.includes(p.category) || p.type === 'ebook_receitas');
  const nutritionCollections = collections
    .map((c) => ({ ...c, items: nutritionItems.filter((p) => p.collection_id === c.id) }))
    .filter((c) => c.items.length > 0);
  const ungroupedNutritionItems = nutritionItems.filter((p) => !p.collection_id);

  if (showVolumeSummary) {
    return (
      <VolumeSummaryScreen
        studentId={user.id}
        studentName={null}
        onClose={() => setShowVolumeSummary(false)}
      />
    );
  }

  if (previewWorkout) {
    return (
      <WorkoutPreviewScreen
        workout={previewWorkout}
        muscleSummary={muscleSummaryByWorkout[previewWorkout.id]}
        onStart={() => {
          setPlayingWorkout(previewWorkout);
          setPreviewWorkout(null);
        }}
        onClose={() => setPreviewWorkout(null)}
      />
    );
  }

  if (playingWorkout) {
    return (
      <WorkoutPlayerScreen
        workout={playingWorkout}
        studentId={user.id}
        onExit={() => {
          setPlayingWorkout(null);
          loadData();
        }}
        onNavigateTab={(tab) => {
          setPlayingWorkout(null);
          setActiveTab(tab);
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

  if (showAnamnesePrompt) {
    return (
      <AnamneseFormScreen
        studentId={user.id}
        personalId={personalId}
        accessLevel={myAccessLevel}
        personalName={personalName}
        personalPhone={personalPhone}
        allowSkip
        onClose={() => setShowAnamnesePrompt(false)}
        onComplete={() => { setShowAnamnesePrompt(false); loadData(); }}
      />
    );
  }

  if (openStudentProjectId) {
    return (
      <ProjectDashboardScreen
        studentProjectId={openStudentProjectId}
        studentId={user.id}
        onClose={() => setOpenStudentProjectId(null)}
      />
    );
  }

  if (openProgram) {
    return (
      <ProgramDetailScreen
        product={openProgram}
        studentId={user.id}
        personalId={personalId}
        unlocked={unlockedProductIds.has(openProgram.id)}
        onClose={() => setOpenProgram(null)}
        onAdded={async (workout) => {
          setOpenProgram(null);
          await loadData();
          if (workout) setPreviewWorkout(workout);
        }}
      />
    );
  }

  if (openCategoryGroup) {
    const items = categorizedProducts.filter((p) => openCategoryGroup.categories.includes(p.category));
    return (
      <View style={styles.subContainer}>
        <HeaderBack title={openCategoryGroup.title} onBack={() => setOpenCategoryGroup(null)} style={{ paddingHorizontal: 16 }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum conteúdo nessa categoria ainda.</Text>
          ) : (
            items.map((p) => {
              const unlocked = unlockedProductIds.has(p.id);
              const lvl = PROGRAM_LEVELS.find((l) => l.value === p.level)?.label;
              const goal = PROGRAM_GOALS.find((g) => g.value === p.goal)?.label;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.categoryListCard}
                  onPress={() => openProductOrProgram(p)}
                >
                  <View style={styles.categoryListCoverWrap}>
                    {p.cover_image_url ? (
                      <Image source={{ uri: p.cover_image_url }} style={styles.categoryListCoverImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.categoryListCoverPlaceholder}>
                        <Ionicons name={p.type === 'treino_template' ? 'barbell-outline' : 'book-outline'} size={20} color={ACCENT} />
                      </View>
                    )}
                    {!unlocked && (
                      <View style={styles.categoryLockOverlay}>
                        <Ionicons name="lock-closed" size={14} color="#F5F5F7" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryListName} numberOfLines={2}>{p.name}</Text>
                    {(lvl || goal) && (
                      <View style={styles.hubBadgeRow}>
                        {lvl ? <View style={styles.hubBadgeChip}><Text style={styles.hubBadgeChipText}>{lvl}</Text></View> : null}
                        {goal ? <View style={styles.hubBadgeChip}><Text style={styles.hubBadgeChipText}>{goal}</Text></View> : null}
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
        <ProductDetailModal
          product={selectedProduct}
          unlocked={selectedProduct ? unlockedProductIds.has(selectedProduct.id) : false}
          recipes={[]}
          onClose={() => setSelectedProduct(null)}
          personalName={personalName}
          personalPhone={personalPhone}
        />
      </View>
    );
  }

  if (openCollection) {
    const items = categorizedProducts.filter((p) => p.collection_id === openCollection.id);
    return (
      <View style={styles.subContainer}>
        <HeaderBack title={toTitleCase(openCollection.name)} onBack={() => setOpenCollection(null)} style={{ paddingHorizontal: 16 }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {openCollection.description ? <Text style={styles.collectionDescription}>{openCollection.description}</Text> : null}
          {items.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum item nessa coleção ainda.</Text>
          ) : (
            items.map((p) => {
              const unlocked = unlockedProductIds.has(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.categoryListCard}
                  onPress={() => openProductOrProgram(p)}
                >
                  <View style={styles.categoryListCoverWrap}>
                    {p.cover_image_url ? (
                      <Image source={{ uri: p.cover_image_url }} style={styles.categoryListCoverImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.categoryListCoverPlaceholder}>
                        <Ionicons name={p.type === 'treino_template' ? 'barbell-outline' : 'book-outline'} size={20} color={ACCENT} />
                      </View>
                    )}
                    {!unlocked && (
                      <View style={styles.categoryLockOverlay}>
                        <Ionicons name="lock-closed" size={14} color="#F5F5F7" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.categoryListName} numberOfLines={2}>{toTitleCase(p.name)}</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
        <ProductDetailModal
          product={selectedProduct}
          unlocked={selectedProduct ? unlockedProductIds.has(selectedProduct.id) : false}
          recipes={[]}
          onClose={() => setSelectedProduct(null)}
          personalName={personalName}
          personalPhone={personalPhone}
        />
      </View>
    );
  }

  if (showNutritionLibrary) {
    return (
      <View style={styles.subContainer}>
        <HeaderBack title="Dietas & Nutrição" onBack={() => setShowNutritionLibrary(false)} style={{ paddingHorizontal: 16 }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {nutritionCollections.length === 0 && ungroupedNutritionItems.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum e-book ou guia disponível ainda.</Text>
          ) : (
            <>
              {nutritionCollections.map((c) => (
                <TouchableOpacity key={c.id} style={styles.categoryListCard} onPress={() => setOpenCollection(c)}>
                  <View style={styles.categoryListCoverWrap}>
                    {c.cover_image_url ? (
                      <Image source={{ uri: c.cover_image_url }} style={styles.categoryListCoverImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.categoryListCoverPlaceholder}>
                        <Ionicons name="folder-outline" size={20} color={ACCENT} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.categoryListName} numberOfLines={2}>{toTitleCase(c.name)}</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
                </TouchableOpacity>
              ))}
              {ungroupedNutritionItems.map((p) => {
                const unlocked = unlockedProductIds.has(p.id);
                return (
                  <TouchableOpacity key={p.id} style={styles.categoryListCard} onPress={() => setSelectedProduct(p)}>
                    <View style={styles.categoryListCoverWrap}>
                      {p.cover_image_url ? (
                        <Image source={{ uri: p.cover_image_url }} style={styles.categoryListCoverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.categoryListCoverPlaceholder}>
                          <Ionicons name="book-outline" size={20} color={ACCENT} />
                        </View>
                      )}
                      {!unlocked && (
                        <View style={styles.categoryLockOverlay}>
                          <Ionicons name="lock-closed" size={14} color="#F5F5F7" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.categoryListName} numberOfLines={2}>{toTitleCase(p.name)}</Text>
                    <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
        <ProductDetailModal
          product={selectedProduct}
          unlocked={selectedProduct ? unlockedProductIds.has(selectedProduct.id) : false}
          recipes={[]}
          onClose={() => setSelectedProduct(null)}
          personalName={personalName}
          personalPhone={personalPhone}
        />
      </View>
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

  if (showEvolution) {
    return (
      <AlunoEvolutionScreen
        studentId={user.id}
        studentName={user?.name || 'Você'}
        onClose={() => setShowEvolution(false)}
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

  if (activeTab === 'treinos') {
    return (
      <View style={{ flex: 1 }}>
      <View style={styles.subContainer}>
        <View style={styles.subTopBar}>
          <Text style={styles.subTitle}>Treinos</Text>
        </View>
        {workouts.length === 0 ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
            <MeusProjetosSection studentId={user.id} onOpenProject={setOpenStudentProjectId} />

            <Text style={styles.libraryIntro}>Você ainda não tem um programa ativo. Escolha um abaixo pra começar a treinar hoje.</Text>

            {showHubAudienceToggle && (
              <View style={styles.audienceFilterRow}>
                {[{ value: 'todos', label: 'Todos' }, { value: 'feminino', label: 'Feminino' }, { value: 'masculino', label: 'Masculino' }].map((a) => (
                  <TouchableOpacity
                    key={a.value}
                    style={[styles.audienceFilterChip, hubAudienceFilter === a.value && styles.audienceFilterChipActive]}
                    onPress={() => setHubAudienceFilter(a.value)}
                  >
                    <Text style={[styles.audienceFilterChipText, hubAudienceFilter === a.value && styles.audienceFilterChipTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!hasAnyHubProgram && !hasAnyRunningProgram ? (
              <Text style={styles.emptyText}>Nenhum programa disponível ainda. Fale com seu personal.</Text>
            ) : (
              <>
                {hubGroups.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>PROGRAMAS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 24 }}>
                      {hubGroups.map((group) => (
                        <TouchableOpacity key={group.key} style={styles.nutritionCard} onPress={() => setOpenCategoryGroup(group)}>
                          <View style={styles.nutritionCoverWrap}>
                            {group.cover ? (
                              <Image source={{ uri: group.cover }} style={styles.nutritionCoverImage} resizeMode="cover" />
                            ) : (
                              <View style={styles.nutritionCoverPlaceholder}>
                                <Ionicons name={group.icon} size={22} color={ACCENT} />
                              </View>
                            )}
                          </View>
                          <Text style={styles.nutritionCardName} numberOfLines={2}>{group.title}</Text>
                          {group.badges.length > 0 && (
                            <View style={styles.hubBadgeRow}>
                              {group.badges.map((b) => (
                                <View key={b} style={styles.hubBadgeChip}>
                                  <Text style={styles.hubBadgeChipText}>{b}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {hasAnyRunningProgram && (
                  <>
                    <Text style={styles.sectionTitle}>MÓDULO CORRIDA</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 24 }}>
                      {runningLevelCards.map((lvl) => {
                        const locked = !lvl.product;
                        return (
                          <TouchableOpacity
                            key={lvl.value}
                            style={styles.nutritionCard}
                            disabled={locked}
                            onPress={() => openProductOrProgram(lvl.product)}
                          >
                            <View style={styles.nutritionCoverWrap}>
                              {lvl.product?.cover_image_url ? (
                                <Image source={{ uri: lvl.product.cover_image_url }} style={coverFocalImageStyle(lvl.product.cover_focal_position)} resizeMode="cover" />
                              ) : (
                                <View style={styles.nutritionCoverPlaceholder}>
                                  <Ionicons name={lvl.icon} size={22} color={locked ? '#525252' : ACCENT} />
                                </View>
                              )}
                              {locked && (
                                <View style={styles.categoryLockOverlay}>
                                  <Ionicons name="lock-closed" size={14} color="#F5F5F7" />
                                </View>
                              )}
                            </View>
                            <Text style={[styles.nutritionCardName, locked && { color: '#737373' }]} numberOfLines={2}>{lvl.label}</Text>
                            {locked && <Text style={styles.runningLevelLockedText}>Em breve</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}
              </>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ListHeaderComponent={<MeusProjetosSection studentId={user.id} onOpenProject={setOpenStudentProjectId} />}
            renderItem={({ item }) => {
              const done = completedToday[item.id];
              const summary = muscleSummaryByWorkout[item.id] || [];
              return (
                <TouchableOpacity style={styles.workoutCard} onPress={() => setPreviewWorkout(item)} activeOpacity={0.7}>
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
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
      <AlunoTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    );
  }

  if (activeTab === 'nutricao') {
    return (
      <View style={{ flex: 1 }}>
      <View style={styles.subContainer}>
        <View style={styles.subTopBar}>
          <Text style={styles.subTitle}>Nutrição</Text>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.nutriTopCard}>
            <CollapsibleSection
              title="Resumo do Dia"
              collapsed={resumoDoDiaCollapsed}
              onToggle={() => { animateNextLayout(); setResumoDoDiaCollapsed((v) => !v); }}
              style={{ padding: 14 }}
              headerRight={
                <Text style={styles.hojeSummary}>
                  {Math.round(consumedTotals.kcal)}{diets[0]?.goal_kcal ? ` / ${diets[0].goal_kcal}` : ''} kcal
                </Text>
              }
            >
              <View style={styles.resumoDoDiaBody}>
                {[
                  { label: 'Proteína', value: consumedTotals.protein, goal: diets[0]?.goal_protein_g, unit: 'g', color: '#a3a3a3' },
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
                    <View style={styles.macroBarTrack}>
                      <View style={[styles.macroBarFill, { width: macro.goal ? `${Math.min(100, (macro.value / macro.goal) * 100)}%` : '0%', backgroundColor: macro.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </CollapsibleSection>
          </View>

          <TouchableOpacity style={styles.nutriLibraryShortcut} onPress={() => setShowNutritionLibrary(true)}>
            <Ionicons name="book-outline" size={18} color={ACCENT} />
            <Text style={styles.nutriLibraryShortcutText}>Biblioteca de Receitas e E-books</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.nutriLibraryShortcut} onPress={() => setShowRecipes(true)}>
            <Ionicons name="restaurant-outline" size={18} color={ACCENT} />
            <Text style={styles.nutriLibraryShortcutText}>Ver Receitas</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
          </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.dietSubTabButton, dietSubTab === 'substituicoes' && styles.dietSubTabButtonActive]}
            onPress={() => setDietSubTab('substituicoes')}
          >
            <Text style={[styles.dietSubTabText, dietSubTab === 'substituicoes' && styles.dietSubTabTextActive]}>Substituições</Text>
          </TouchableOpacity>
        </View>

        {dietSubTab === 'substituicoes' ? (
          <FoodSubstituteScreen />
        ) : dietSubTab === 'prescrita' ? (
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
                <ActivityIndicator color="#FF6B00" style={{ marginTop: 10 }} />
              ) : mealsForActiveDiet.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma refeição prescrita ainda.</Text>
              ) : (
                mealsForActiveDiet.map((meal) => {
                  // When the aluno hasn't touched any accordion yet, auto-open whichever
                  // prescribed meal matches the current time window and isn't logged yet.
                  const smartOpenId = expandedMealId === null
                    ? mealsForActiveDiet.find((m) => {
                        const key = mapMealNameToType(m.name);
                        return key === currentMealWindowKey() && !todaysEntries.some((e) => e.meal_type === key);
                      })?.id ?? null
                    : null;
                  const isExpanded = expandedMealId != null ? expandedMealId === meal.id : meal.id === smartOpenId;
                  const mealTotals = (meal.diet_meal_foods || []).reduce((sum, f) => sum + (f.calories_kcal || 0), 0);
                  const mealKey = `${meal.id}-meal`;
                  return (
                    <View key={meal.id} style={styles.mealAccordionCard}>
                      <TouchableOpacity
                        style={styles.mealAccordionHeader}
                        onPress={() => { animateNextLayout(); setExpandedMealId(isExpanded ? null : meal.id); }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mealAccordionName}>{meal.name}</Text>
                          <Text style={styles.mealAccordionMeta}>
                            {meal.meal_time ? `${meal.meal_time} · ` : ''}{Math.round(mealTotals)} kcal
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.completeMealButton}
                          onPress={() => handleCompleteMeal(meal)}
                          disabled={registeringKey === mealKey}
                        >
                          {registeringKey === mealKey ? (
                            <ActivityIndicator color="#22c55e" size="small" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
                              <Text style={styles.completeMealButtonText}>Concluída</Text>
                            </>
                          )}
                        </TouchableOpacity>
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
                                      <ActivityIndicator color="#FF6B00" size="small" />
                                    ) : (
                                      <View style={styles.consumedBadge}>
                                        <Ionicons name="checkmark-outline" size={12} color="#FF6B00" />
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
                                                <ActivityIndicator color="#FF6B00" size="small" />
                                              ) : (
                                                <View style={styles.consumedBadge}>
                                                  <Ionicons name="checkmark-outline" size={12} color="#FF6B00" />
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
            {!showMealPicker ? (
              <TouchableOpacity style={styles.addExtraButton} onPress={() => setShowMealPicker(true)}>
                <Text style={styles.addExtraButtonText}>+ Registrar Alimento Extra</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.mealPickerBox}>
                <View style={styles.mealPickerHeaderRow}>
                  <Text style={styles.mealPickerLabel}>Em qual refeição?</Text>
                  <TouchableOpacity onPress={() => setShowMealPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={20} color="#a3a3a3" />
                  </TouchableOpacity>
                </View>
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
              </View>
            )}

            <View style={styles.hojeCard}>
              <TouchableOpacity style={styles.hojeHeader} onPress={() => { animateNextLayout(); setHojeExpanded(!hojeExpanded); }}>
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
                    { label: 'Calorias', value: consumedTotals.kcal, goal: diets[0]?.goal_kcal, unit: 'kcal', color: '#FF6B00' },
                    { label: 'Proteína', value: consumedTotals.protein, goal: diets[0]?.goal_protein_g, unit: 'g', color: '#a3a3a3' },
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
              <CollapsibleSection
                title="Água"
                collapsed={waterCardCollapsed}
                onToggle={() => { animateNextLayout(); setWaterCardCollapsed((v) => !v); }}
                headerRight={<Text style={styles.waterValue}>{(waterMl / 1000).toFixed(1)}L / 2.0L</Text>}
              >
                <View style={{ marginTop: 10 }}>
                  <View style={styles.macroBarTrack}>
                    <View style={[styles.macroBarFill, { width: `${Math.min(100, (waterMl / 2000) * 100)}%`, backgroundColor: '#5EC8D8' }]} />
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
              </CollapsibleSection>
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
                    {savingNote ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.noteSaveButtonText}>Salvar</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => setEditingNote(true)}>
                  <Text style={styles.noteText}>{dailyNote || 'Toque pra escrever uma observação...'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>Registros de hoje</Text>
            {MEAL_OPTIONS.map((m) => {
              const mealEntries = todaysEntries.filter((e) => e.meal_type === m.value);
              const hasEntries = mealEntries.length > 0;
              const mealKcal = mealEntries.reduce((sum, e) => sum + (e.calories_kcal || 0), 0);
              // Current-time meal starts open (if not logged yet); already-logged
              // and not-yet-due meals start collapsed — until the aluno overrides it.
              const smartDefaultCollapsed = !(m.value === currentMealWindowKey() && !hasEntries);
              const collapsed = diarioMealOverrides[m.value] !== undefined ? diarioMealOverrides[m.value] : smartDefaultCollapsed;
              return (
                <View key={m.value} style={styles.mealAccordionCard}>
                  <CollapsibleSection
                    title={m.label}
                    collapsed={collapsed}
                    onToggle={() => {
                      animateNextLayout();
                      setDiarioMealOverrides((prev) => ({ ...prev, [m.value]: !collapsed }));
                    }}
                    style={styles.diarioMealHeader}
                    headerRight={hasEntries ? <Text style={styles.mealAccordionMeta}>{Math.round(mealKcal)} kcal</Text> : null}
                  >
                    <View style={styles.diarioMealBody}>
                      {hasEntries ? (
                        mealEntries.map((entry) => (
                          <View key={entry.id} style={styles.entryRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.entryFoodName}>{entry.food_name}</Text>
                              <Text style={styles.entryMeta}>{entry.quantity_g ? `${entry.quantity_g}g · ` : ''}{Math.round(entry.calories_kcal || 0)}kcal</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleDeleteEntry(entry.id)}>
                              <Text style={styles.entryDelete}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyText}>Nada registrado ainda.</Text>
                      )}
                    </View>
                  </CollapsibleSection>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
      <AlunoTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    );
  }

  if (activeTab === 'loja') {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <AlunoProductsScreen studentId={user.id} personalId={personalId} onClose={() => setActiveTab('inicio')} />
        </View>
        <AlunoTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    );
  }

  if (activeTab === 'perfil') {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <AlunoProfileScreen
            user={user}
            onLogout={onLogout}
            onClose={() => {
              setActiveTab('inicio');
              loadData();
            }}
          />
        </View>
        <AlunoTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    );
  }

  const oldestWorkoutTime = workouts.length > 0
    ? Math.min(...workouts.map((w) => new Date(w.created_at).getTime()))
    : null;
  const programWeeksActive = oldestWorkoutTime != null
    ? Math.floor((Date.now() - oldestWorkoutTime) / (7 * 24 * 60 * 60 * 1000))
    : null;
  const showRotationOffer = myAccessLevel === 'plataforma_base' && programWeeksActive != null && programWeeksActive >= 6;

  const handleRequestRotation = () => {
    handleOpenChatFor(`Olá! Já estou há ${programWeeksActive} semanas no mesmo ciclo de treino e gostaria de renovar minha ficha. Pode me ajudar?`);
  };

  // Offer the *next* ficha in the rotation right after the aluno finishes one
  // — cycles through active workouts in creation order, wrapping around —
  // instead of always resetting to the first workout on a new day.
  let todaysWorkout = workouts[0] || null;
  if (workouts.length > 0 && lastCompletedWorkoutId) {
    const lastIndex = workouts.findIndex((w) => w.id === lastCompletedWorkoutId);
    if (lastIndex !== -1) {
      todaysWorkout = workouts[(lastIndex + 1) % workouts.length];
    }
  }
  const todaysWorkoutDone = Object.values(completedToday).some(Boolean);

  // Home hero card reflects where the aluno actually is right now: hasn't
  // started, mid-session (workout_sessions row with no finished_at yet),
  // just finished today, or no active program at all.
  const activeSessionToday = todaySessions.find((s) => !s.finished_at) || null;
  const latestFinishedSessionToday = todaySessions.find((s) => s.finished_at) || null;
  let heroState = 'no_workout';
  let heroWorkout = null;
  let heroSession = null;
  if (activeSessionToday) {
    heroState = 'in_progress';
    heroWorkout = workouts.find((w) => w.id === activeSessionToday.workout_id) || null;
    heroSession = activeSessionToday;
  } else if (latestFinishedSessionToday) {
    heroState = 'done';
    heroWorkout = workouts.find((w) => w.id === latestFinishedSessionToday.workout_id) || null;
    heroSession = latestFinishedSessionToday;
  } else if (todaysWorkout) {
    heroState = 'pending';
    heroWorkout = todaysWorkout;
  }
  const heroWorkoutExerciseCount = heroWorkout ? (muscleSummaryByWorkout[heroWorkout.id] || []).reduce((sum, [, count]) => sum + count, 0) : 0;
  const heroSessionDurationMin = heroSession && heroSession.finished_at
    ? Math.max(1, Math.round((new Date(heroSession.finished_at) - new Date(heroSession.started_at)) / 60000))
    : null;
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayLabelCapitalized = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);
  const mealsCompletedCount = mealsForActiveDiet.filter((m) => todaysEntries.some((e) => e.meal_type === mapMealNameToType(m.name))).length;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <HeaderWelcome
        avatarUrl={ownAvatarUrl}
        initial={user?.name?.charAt(0).toUpperCase() || '?'}
        greeting={`Olá, ${user?.name}!`}
        subtitle={todayLabelCapitalized}
        onAvatarPress={() => setActiveTab('perfil')}
        rightSlot={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setMode('agenda')}>
              <Ionicons name="calendar-outline" size={20} color="#a3a3a3" />
            </TouchableOpacity>
          </View>
        }
      />

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
      ) : (
        <>
          <WaterLogModal
            visible={showWaterModal}
            studentId={user.id}
            currentMl={waterMl}
            goalMl={waterGoalMl}
            onClose={() => setShowWaterModal(false)}
            onAdd={handleAddWater}
            onGoalChanged={setWaterGoalMl}
          />

          <WeightLogModal
            visible={showWeightModal}
            studentId={user.id}
            currentWeightKg={todaysWeightKg}
            onClose={() => setShowWeightModal(false)}
            onSaved={setTodaysWeightKg}
          />

          {heroState === 'pending' && (
            <TouchableOpacity style={styles.heroWorkoutCard} onPress={() => setPreviewWorkout(heroWorkout)} activeOpacity={0.85}>
              <View style={styles.heroWorkoutEyebrowRow}>
                <View style={[styles.heroStatusDot, styles.heroStatusDotAmber]} />
                <Text style={styles.heroWorkoutEyebrow}>SEU TREINO ESTÁ ESPERANDO</Text>
              </View>
              <Text style={styles.heroWorkoutName}>{heroWorkout.name}</Text>
              {heroWorkoutExerciseCount > 0 && (
                <Text style={styles.heroWorkoutMeta}>{heroWorkoutExerciseCount} exercício{heroWorkoutExerciseCount !== 1 ? 's' : ''}</Text>
              )}
              <TouchableOpacity style={styles.heroWorkoutButton} onPress={() => setPlayingWorkout(heroWorkout)}>
                <Ionicons name="play" size={18} color="#0F0F12" />
                <Text style={styles.heroWorkoutButtonText}>Começar Treino</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {heroState === 'in_progress' && heroWorkout && (
            <TouchableOpacity style={styles.heroWorkoutCard} onPress={() => setPlayingWorkout(heroWorkout)} activeOpacity={0.85}>
              <View style={styles.heroWorkoutEyebrowRow}>
                <View style={[styles.heroStatusDot, styles.heroStatusDotAmber]} />
                <Text style={styles.heroWorkoutEyebrow}>CONTINUE SEU TREINO</Text>
              </View>
              <Text style={styles.heroWorkoutName}>{heroWorkout.name}</Text>
              <Text style={styles.heroWorkoutMeta}>
                {sessionOfInterestExercisesDone} de {heroWorkoutExerciseCount} exercício{heroWorkoutExerciseCount !== 1 ? 's' : ''} concluído{sessionOfInterestExercisesDone !== 1 ? 's' : ''}
              </Text>
              {heroWorkoutExerciseCount > 0 && (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.min(100, (sessionOfInterestExercisesDone / heroWorkoutExerciseCount) * 100)}%` }]} />
                </View>
              )}
              <TouchableOpacity style={styles.heroWorkoutButton} onPress={() => setPlayingWorkout(heroWorkout)}>
                <Ionicons name="play" size={18} color="#0F0F12" />
                <Text style={styles.heroWorkoutButtonText}>Continuar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {heroState === 'done' && heroWorkout && (
            <TouchableOpacity style={styles.heroWorkoutCard} onPress={() => setPreviewWorkout(heroWorkout)} activeOpacity={0.85}>
              <View style={styles.heroWorkoutEyebrowRow}>
                <View style={[styles.heroStatusDot, styles.heroStatusDotGreen]} />
                <Text style={[styles.heroWorkoutEyebrow, styles.heroWorkoutEyebrowGreen]}>TREINO CONCLUÍDO!</Text>
              </View>
              <Text style={styles.heroWorkoutName}>{heroWorkout.name}</Text>
              <Text style={styles.heroWorkoutMeta}>
                {sessionOfInterestExercisesDone} de {heroWorkoutExerciseCount} exercício{heroWorkoutExerciseCount !== 1 ? 's' : ''}
                {heroSession?.pse != null ? ` · RPE ${heroSession.pse}` : ''}
                {heroSessionDurationMin != null ? ` · ${heroSessionDurationMin} min` : ''}
              </Text>
              <TouchableOpacity style={[styles.heroWorkoutButton, styles.heroWorkoutButtonDone]} onPress={() => setPreviewWorkout(heroWorkout)}>
                <Ionicons name="checkmark-circle" size={18} color="#0F0F12" />
                <Text style={styles.heroWorkoutButtonText}>Ver Resumo</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {heroState === 'no_workout' && (
            <View style={styles.heroWorkoutCard}>
              {workouts.length === 0 ? (
                <>
                  <Text style={styles.heroWorkoutEyebrow}>NENHUM PROGRAMA ATIVO</Text>
                  <Text style={styles.heroWorkoutName}>Escolha seu primeiro treino</Text>
                  <Text style={styles.heroWorkoutMeta}>Veja a biblioteca de programas na aba Treinos e comece agora.</Text>
                  <TouchableOpacity style={styles.heroWorkoutButton} onPress={() => setActiveTab('treinos')}>
                    <Ionicons name="albums-outline" size={18} color="#0F0F12" />
                    <Text style={styles.heroWorkoutButtonText}>Ver Programas</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.heroWorkoutName}>Hoje é dia de recuperação 😴</Text>
                  <Text style={styles.heroWorkoutMeta}>Aproveite pra descansar. Seu próximo treino te espera quando você voltar.</Text>
                </>
              )}
            </View>
          )}

          {showRotationOffer && (
            <View style={styles.rotationBanner}>
              <View style={styles.financeBannerRow}>
                <Ionicons name="refresh-outline" size={16} color="#3b82f6" />
                <Text style={styles.rotationBannerText}>
                  Você está há {programWeeksActive} semanas no mesmo ciclo de treino. Bora renovar sua ficha?
                </Text>
              </View>
              <TouchableOpacity style={styles.rotationBannerButton} onPress={handleRequestRotation}>
                <Text style={styles.rotationBannerButtonText}>Pedir Renovação</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.progressSectionLabel}>SEU PROGRESSO DE HOJE</Text>
          <MetricsMiniCards
            workoutStatus={{
              valueText: !todaysWorkout ? '—' : todaysWorkoutDone ? 'Feito' : 'Pendente',
              percent: todaysWorkoutDone ? 100 : 0,
            }}
            onPressWorkout={() => (todaysWorkout ? setPreviewWorkout(todaysWorkout) : setActiveTab('treinos'))}
            hideCalories
            caloriesConsumed={consumedTotals.kcal}
            caloriesGoal={diets[0]?.goal_kcal}
            waterMl={waterMl}
            waterGoalMl={waterGoalMl}
            onPressWater={() => setShowWaterModal(true)}
            mealsCompleted={mealsCompletedCount}
            mealsTotal={mealsForActiveDiet.length}
            onPressHabits={() => { setActiveTab('nutricao'); setDietSubTab('prescrita'); }}
            weeklyPercent={(weekDaysCount / 7) * 100}
            lastWorkoutLabel={lastWorkoutName}
            onPressFrequency={() => setShowVolumeSummary(true)}
          />

          {nextDuePayment && (
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
                  <Ionicons name="logo-whatsapp" size={14} color="#0F0F12" />
                  <Text style={styles.payButtonText}>Realizar Pagamento</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {personalId && (
            <TouchableOpacity style={styles.contactCard} onPress={() => handleOpenChatFor('')}>
              <View style={styles.contactCardIconWrap}>
                <Ionicons name="chatbubbles" size={20} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactCardTitle}>Falar com {personalName || 'meu treinador'}</Text>
                <Text style={styles.contactCardSubtitle}>Tire dúvidas, receba orientações e feedbacks.</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.contactCard} onPress={() => setShowWeightModal(true)}>
            <View style={styles.contactCardIconWrap}>
              <Ionicons name={todaysWeightKg != null ? 'checkmark-circle' : 'scale-outline'} size={20} color={todaysWeightKg != null ? '#22c55e' : ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactCardTitle}>{todaysWeightKg != null ? `Peso de hoje: ${todaysWeightKg} kg` : 'Registrar peso de hoje'}</Text>
              <Text style={styles.contactCardSubtitle}>{todaysWeightKg != null ? 'Toque para atualizar' : 'Ajuda a acompanhar sua evolução ao longo do tempo'}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>MINHA EVOLUÇÃO</Text>
          {myAccessLevel === 'consultoria_vip' ? (
            <>
              <WeightEvolutionChart studentId={user.id} />
              <View style={styles.evolutionShortcutRow}>
                <TouchableOpacity style={styles.evolutionShortcutCard} onPress={() => setShowEvolution(true)}>
                  <Ionicons name="images-outline" size={20} color={ACCENT} />
                  <Text style={styles.evolutionShortcutText}>Fotos de Progresso</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.evolutionShortcutCard} onPress={() => setShowEvolution(true)}>
                  <Ionicons name="clipboard-outline" size={20} color={ACCENT} />
                  <Text style={styles.evolutionShortcutText}>Avaliações Físicas</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.evolutionRow} onPress={() => setShowEvolutionLock(true)}>
              <Ionicons name="trending-up-outline" size={20} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={styles.evolutionRowTitle}>Evolução do Aluno</Text>
                <Text style={styles.evolutionRowSubtitle}>Fotos de progresso, peso e avaliações</Text>
              </View>
              <Ionicons name="lock-closed" size={16} color={ACCENT} />
            </TouchableOpacity>
          )}

          {hasAnyHubProgram && (
            <CollapsibleSection
              title="HUB DE PROGRAMAS"
              collapsed={!!hubCollapsedSections.hub}
              onToggle={() => toggleHubSection('hub')}
              style={styles.sectionTitleSpaced}
            >
              {showHubAudienceToggle && (
                <View style={styles.audienceFilterRow}>
                  {[{ value: 'todos', label: 'Todos' }, { value: 'feminino', label: 'Feminino' }, { value: 'masculino', label: 'Masculino' }].map((a) => (
                    <TouchableOpacity
                      key={a.value}
                      style={[styles.audienceFilterChip, hubAudienceFilter === a.value && styles.audienceFilterChipActive]}
                      onPress={() => setHubAudienceFilter(a.value)}
                    >
                      <Text style={[styles.audienceFilterChipText, hubAudienceFilter === a.value && styles.audienceFilterChipTextActive]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {hubGroups.length === 0 && !hasAnyRunningProgram ? (
                <Text style={[styles.emptyText, { marginBottom: 16, marginTop: 10 }]}>Nenhum programa para esse público ainda.</Text>
              ) : hubGroups.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 10, marginBottom: 24 }}>
                {hubGroups.map((group) => (
                  <TouchableOpacity key={group.key} style={styles.nutritionCard} onPress={() => setOpenCategoryGroup(group)}>
                    <View style={styles.nutritionCoverWrap}>
                      {group.cover ? (
                        <Image source={{ uri: group.cover }} style={styles.nutritionCoverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.nutritionCoverPlaceholder}>
                          <Ionicons name={group.icon} size={22} color={ACCENT} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.nutritionCardName} numberOfLines={2}>{group.title}</Text>
                    {group.badges.length > 0 && (
                      <View style={styles.hubBadgeRow}>
                        {group.badges.map((b) => (
                          <View key={b} style={styles.hubBadgeChip}>
                            <Text style={styles.hubBadgeChipText}>{b}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              )}
            </CollapsibleSection>
          )}

          {hasAnyRunningProgram && (
            <CollapsibleSection
              title="MÓDULO CORRIDA"
              collapsed={!!hubCollapsedSections.corrida}
              onToggle={() => toggleHubSection('corrida')}
              style={styles.sectionTitleSpaced}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 10, marginBottom: 24 }}>
                {runningLevelCards.map((lvl) => {
                  const locked = !lvl.product;
                  return (
                    <TouchableOpacity
                      key={lvl.value}
                      style={styles.nutritionCard}
                      disabled={locked}
                      onPress={() => openProductOrProgram(lvl.product)}
                    >
                      <View style={styles.nutritionCoverWrap}>
                        {lvl.product?.cover_image_url ? (
                          <Image source={{ uri: lvl.product.cover_image_url }} style={coverFocalImageStyle(lvl.product.cover_focal_position)} resizeMode="cover" />
                        ) : (
                          <View style={styles.nutritionCoverPlaceholder}>
                            <Ionicons name={lvl.icon} size={22} color={locked ? '#525252' : ACCENT} />
                          </View>
                        )}
                        {locked && (
                          <View style={styles.categoryLockOverlay}>
                            <Ionicons name="lock-closed" size={14} color="#F5F5F7" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.nutritionCardName, locked && { color: '#737373' }]} numberOfLines={2}>{lvl.label}</Text>
                      {locked && <Text style={styles.runningLevelLockedText}>Em breve</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </CollapsibleSection>
          )}

        </>
      )}

      <TouchableOpacity style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
    <AlunoTabBar activeTab={activeTab} onChange={setActiveTab} />
    <UpgradeLockModal
      visible={showEvolutionLock}
      onClose={() => setShowEvolutionLock(false)}
      personalName={personalName}
      personalPhone={personalPhone}
      featureLabel="Evolução Física"
    />
    <ProductDetailModal
      product={selectedProduct}
      unlocked={selectedProduct ? unlockedProductIds.has(selectedProduct.id) : false}
      recipes={[]}
      onClose={() => setSelectedProduct(null)}
      personalName={personalName}
      personalPhone={personalPhone}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', alignItems: 'center', justifyContent: 'center' },
  financeBanner: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#eab308', borderRadius: 12, padding: 12, marginBottom: 16 },
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
  payButtonText: { color: '#0F0F12', fontSize: 11, fontWeight: '800' },
  rotationBanner: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 12, padding: 12, marginBottom: 16 },
  rotationBannerText: { color: '#3b82f6', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  rotationBannerButton: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  rotationBannerButtonText: { color: '#0F0F12', fontSize: 11, fontWeight: '800' },
  sectionTitleSpaced: { marginTop: 4 },
  evolutionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 16, marginBottom: 24 },
  evolutionRowTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  evolutionRowSubtitle: { color: '#A1A1AA', fontSize: 11, marginTop: 2 },
  progressSectionLabel: { color: '#737373', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4, marginBottom: 10 },
  heroWorkoutCard: { borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 16, ...GLASS_CARD, borderColor: ACCENT },
  heroWorkoutEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatusDotAmber: { backgroundColor: '#f59e0b' },
  heroStatusDotGreen: { backgroundColor: '#22c55e' },
  heroWorkoutEyebrow: { color: ACCENT, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroWorkoutEyebrowGreen: { color: '#22c55e' },
  heroWorkoutName: { color: '#F5F5F7', fontSize: 24, fontWeight: '800' },
  heroWorkoutMeta: { color: '#a3a3a3', fontSize: 13, marginTop: 6, lineHeight: 18 },
  heroWorkoutButton: { flexDirection: 'row', gap: 8, backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  heroWorkoutButtonDone: { backgroundColor: '#2B2B36' },
  heroWorkoutButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '800' },
  track: { height: 4, backgroundColor: '#0F0F12', borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: ACCENT },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 24, ...GLASS_CARD },
  contactCardIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  contactCardTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  contactCardSubtitle: { color: '#737373', fontSize: 11, marginTop: 2 },
  evolutionShortcutRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  evolutionShortcutCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, ...GLASS_CARD },
  evolutionShortcutText: { color: '#F5F5F7', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  hubBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hubBadgeChip: { backgroundColor: '#27272A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  hubBadgeChipText: { color: '#D4D4D8', fontSize: 10, fontWeight: '600' },
  audienceFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  audienceFilterChip: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  audienceFilterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  audienceFilterChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  audienceFilterChipTextActive: { color: '#0F0F12' },
  nutritionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nutritionCard: { width: 176 },
  nutritionCoverWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 6, position: 'relative', ...GLASS_CARD },
  nutritionCoverImage: { ...COVER_TOP_IMAGE },
  nutritionCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  nutritionCardName: { color: '#F5F5F7', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  runningLevelLockedText: { color: '#525252', fontSize: 10, fontWeight: '600', marginTop: 2 },
  categoryListCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 10, ...GLASS_CARD },
  categoryListCoverWrap: { width: 72, aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: '#0F0F12', overflow: 'hidden', position: 'relative' },
  categoryListCoverImage: { width: '100%', height: '100%' },
  categoryListCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  categoryListName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700', flex: 1 },
  collectionDescription: { color: '#A1A1AA', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  categoryLockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12 },
  libraryIntro: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
  button: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#FF6B00', fontSize: 15, fontWeight: '700' },
  subContainer: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  subTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  subCloseText: { color: '#FF6B00', fontSize: 14, fontWeight: '600' },
  subTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  workoutCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 16, marginBottom: 12 },
  workoutTopRow: { flexDirection: 'row', alignItems: 'center' },
  workoutName: { color: '#F5F5F7', fontSize: 16, fontWeight: '700' },
  workoutDate: { color: '#525252', fontSize: 10, marginTop: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  statusDotDone: { backgroundColor: '#22c55e' },
  statusDotPending: { backgroundColor: '#525252' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  summaryBadge: { backgroundColor: '#0F0F12', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  summaryBadgeText: { color: '#a3a3a3', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  startButton: { backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  startButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '700' },
  dietSubTabRow: { flexDirection: 'row', backgroundColor: '#1C1C22', borderRadius: 10, padding: 3, marginHorizontal: 16, marginBottom: 14 },
  dietSubTabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  dietSubTabButtonActive: { backgroundColor: '#FF6B00' },
  dietSubTabText: { color: '#a3a3a3', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  dietSubTabTextActive: { color: '#0F0F12' },
  dietTabScroll: { maxHeight: 46, marginBottom: 8 },
  dietTabChip: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  dietTabChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  dietTabChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  dietTabChipTextActive: { color: '#0F0F12' },
  mealAccordionCard: { borderWidth: 1, borderRadius: 12, marginBottom: 8, overflow: 'hidden', ...GLASS_CARD },
  mealAccordionHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  mealAccordionName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  mealAccordionMeta: { color: '#737373', fontSize: 11, marginTop: 2 },
  mealAccordionBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#0F0F12' },
  diarioMealHeader: { padding: 12 },
  diarioMealBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0F0F12' },
  foodItemBox: { marginTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#0F0F12' },
  foodOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodText: { color: '#a3a3a3', fontSize: 12, flexShrink: 1 },
  registerButton: { padding: 2 },
  consumedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,107,0,0.12)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  consumedBadgeText: { color: '#FF6B00', fontSize: 10, fontWeight: '700' },
  orConnector: { color: '#525252', fontSize: 9, fontWeight: '700', marginVertical: 4, marginLeft: 8 },
  substitutesBox: { marginLeft: 8, marginTop: 2 },
  substituteText: { color: '#737373', fontSize: 11, flexShrink: 1 },
  nutriTopCard: { borderWidth: 1, borderRadius: 12, marginTop: 14, marginBottom: 14, overflow: 'hidden', ...GLASS_CARD },
  nutriTopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  nutriLibraryShortcut: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 14 },
  nutriLibraryShortcutText: { flex: 1, color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
  completeMealButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginRight: 8 },
  completeMealButtonText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  hojeCard: { borderWidth: 1, borderRadius: 12, marginBottom: 14, overflow: 'hidden', ...GLASS_CARD },
  hojeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  hojeTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  hojeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hojeSummary: { color: '#FF6B00', fontSize: 12, fontWeight: '700' },
  hojeBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#0F0F12' },
  resumoDoDiaBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#0F0F12' },
  macroRow: { marginTop: 12 },
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  macroLabel: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  macroValue: { color: '#F5F5F7', fontSize: 11, fontWeight: '700' },
  macroBarTrack: { height: 6, backgroundColor: '#0F0F12', borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 3 },
  waterCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14, ...GLASS_CARD },
  waterHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  waterTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  waterValue: { color: '#5EC8D8', fontSize: 12, fontWeight: '700' },
  waterButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  waterButton: { flex: 1, backgroundColor: 'rgba(94,200,216,0.12)', borderWidth: 1, borderColor: '#5EC8D8', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  waterButtonText: { color: '#5EC8D8', fontSize: 12, fontWeight: '700' },
  noteCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14, ...GLASS_CARD },
  noteCardTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  noteText: { color: '#737373', fontSize: 12, fontStyle: 'italic' },
  noteInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 12, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
  noteSaveButton: { backgroundColor: '#FF6B00', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  noteSaveButtonText: { color: '#0F0F12', fontSize: 12, fontWeight: '700' },
  addExtraButton: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 16 },
  addExtraButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  mealPickerBox: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 16 },
  mealPickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  mealPickerLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase' },
  mealPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealPickerChip: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  mealPickerChipText: { color: '#F5F5F7', fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, padding: 12, marginBottom: 8 },
  entryFoodName: { color: '#F5F5F7', fontSize: 12, fontWeight: '600' },
  entryMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  entryDelete: { color: '#ef4444', fontSize: 14, marginLeft: 8 },
});
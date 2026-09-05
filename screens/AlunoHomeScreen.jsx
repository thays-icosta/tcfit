import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView, Image, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabaseClient';
import WorkoutPlayerScreen from './WorkoutPlayerScreen';
import WorkoutPreviewScreen from './WorkoutPreviewScreen';
import AlunoProfileScreen from './AlunoProfileScreen';
import FoodCatalogScreen from './FoodCatalogScreen';
import AlunoAgendaScreen from './AlunoAgendaScreen';
import ChatScreen from './ChatScreen';
import RecipesScreen from './RecipesScreen';
import AlunoProductsScreen from './AlunoProductsScreen';
import AlunoTabBar from './AlunoTabBar';
import ProgramDetailScreen from './ProgramDetailScreen';
import AnamneseFormScreen from './AnamneseFormScreen';
import UpgradeLockModal from './UpgradeLockModal';
import PhysicalAssessmentHistoryScreen from './PhysicalAssessmentHistoryScreen';
import FoodSubstituteScreen from './FoodSubstituteScreen';
import { showAlert } from './alertUtils';
import { hasAccessByLevel, PROGRAM_LEVELS, PROGRAM_GOALS } from './accessLevel';
import { HeaderWelcome, HeaderBack } from './Header';
import { toTitleCase } from './textUtils';
import { COVER_TOP_IMAGE } from './vitrineStyles';
import ProductDetailModal from './ProductDetailModal';

const ACCENT = '#E05A17';

const PROGRAM_HUB_GROUPS = [
  { key: 'academia', title: 'TREINOS NA ACADEMIA', categories: ['planilha_academia', 'treino_3d', 'treino_extra'], icon: 'barbell-outline' },
  { key: 'corrida_cardio', title: 'CORRIDA & CARDIO', categories: ['modulo_corrida'], icon: 'walk-outline' },
  { key: 'em_casa', title: 'TREINOS EM CASA', categories: ['planilha_casa'], icon: 'home-outline' },
];

const NUTRITION_LIBRARY_CATEGORIES = ['dieta_ebook'];

function buildHubGroups(products) {
  return PROGRAM_HUB_GROUPS.map((group) => {
    const items = products.filter((p) => group.categories.includes(p.category));
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

export default function AlunoHomeScreen({ user, onLogout, openChatOnMount, onConsumeInitialChat }) {
  const [personalId, setPersonalId] = useState(null);
  const [myAccessLevel, setMyAccessLevel] = useState('plataforma_base');
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
  const [previewWorkout, setPreviewWorkout] = useState(null);
  const [showRecipes, setShowRecipes] = useState(false);
  const [addingFoodForMeal, setAddingFoodForMeal] = useState(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0);
  const [registeringKey, setRegisteringKey] = useState(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [partnerBrands, setPartnerBrands] = useState([]);
  const [showPartnersSection, setShowPartnersSection] = useState(false);
  const [copiedCouponId, setCopiedCouponId] = useState(null);
  const [activeTab, setActiveTab] = useState('inicio');
  const [categorizedProducts, setCategorizedProducts] = useState([]);
  const [unlockedProductIds, setUnlockedProductIds] = useState(new Set());
  const [openProgram, setOpenProgram] = useState(null);
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
      .select('personal_id, avatar_url, student_type, access_level, anamnese_completed_at')
      .eq('id', user.id)
      .single();

    setOwnAvatarUrl(myRow?.avatar_url || null);
    setPersonalId(myRow?.personal_id || null);
    setStudentType(myRow?.student_type || 'consultoria');
    setShowAnamnesePrompt(!!myRow?.personal_id && !myRow?.anamnese_completed_at);

    if (myRow?.personal_id) {
      const { data: personalRow } = await supabase
        .from('users')
        .select('name, avatar_url, phone, pix_key, payment_link, show_partners_section')
        .eq('id', myRow.personal_id)
        .single();
      setPersonalName(personalRow?.name || null);
      setPersonalAvatarUrl(personalRow?.avatar_url || null);
      setPersonalPhone(personalRow?.phone || null);
      setPersonalPixKey(personalRow?.pix_key || null);
      setPersonalPaymentLink(personalRow?.payment_link || null);
      setShowPartnersSection(personalRow?.show_partners_section !== false);

      const { data: brandRows } = await supabase
        .from('partner_brands')
        .select('id, name, logo_url, coupon_code, affiliate_link')
        .eq('personal_id', myRow.personal_id)
        .eq('active', true)
        .order('created_at', { ascending: false });
      setPartnerBrands(brandRows || []);

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

  const handleCompleteMeal = async (meal) => {
    const foods = meal.diet_meal_foods || [];
    if (foods.length === 0) return;
    const mealKey = `${meal.id}-meal`;
    setRegisteringKey(mealKey);
    const { error } = await supabase.from('food_diary_entries').insert(
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
    );
    setRegisteringKey(null);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setDiaryRefreshKey((k) => k + 1);
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

  const handleCopyCoupon = async (brand) => {
    if (brand.coupon_code) {
      await Clipboard.setStringAsync(brand.coupon_code);
      setCopiedCouponId(brand.id);
      setTimeout(() => setCopiedCouponId((prev) => (prev === brand.id ? null : prev)), 2500);
    }
    if (brand.affiliate_link) {
      Linking.openURL(brand.affiliate_link).catch(() => {});
    }
  };

  const handleOpenWhatsApp = () => {
    if (!personalPhone) {
      handleOpenChatFor('');
      return;
    }
    const cleanPhone = personalPhone.replace(/\D/g, '');
    const message = `Olá${personalName ? `, ${personalName}` : ''}! Tudo bem?`;
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`).catch(() => {});
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
        onComplete={() => setShowAnamnesePrompt(false)}
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
                  onPress={() => (p.type === 'treino_template' ? setOpenProgram(p) : setSelectedProduct(p))}
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
                        <Ionicons name="lock-closed" size={14} color="#f5f5f5" />
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
                  onPress={() => (p.type === 'treino_template' ? setOpenProgram(p) : setSelectedProduct(p))}
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
                        <Ionicons name="lock-closed" size={14} color="#f5f5f5" />
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
      <PhysicalAssessmentHistoryScreen
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
            <View style={styles.nutriTopHeaderRow}>
              <Text style={styles.hojeTitle}>Resumo do Dia</Text>
              <Text style={styles.hojeSummary}>
                {Math.round(consumedTotals.kcal)}{diets[0]?.goal_kcal ? ` / ${diets[0].goal_kcal}` : ''} kcal
              </Text>
            </View>
            <View style={styles.hojeBody}>
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
          </View>

          <TouchableOpacity style={styles.nutriLibraryShortcut} onPress={() => setShowRecipes(true)}>
            <Ionicons name="book-outline" size={18} color={ACCENT} />
            <Text style={styles.nutriLibraryShortcutText}>Biblioteca de Receitas e E-books</Text>
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
                <ActivityIndicator color="#f97316" style={{ marginTop: 10 }} />
              ) : mealsForActiveDiet.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma refeição prescrita ainda.</Text>
              ) : (
                mealsForActiveDiet.map((meal) => {
                  const isExpanded = expandedMealId === meal.id;
                  const mealTotals = (meal.diet_meal_foods || []).reduce((sum, f) => sum + (f.calories_kcal || 0), 0);
                  const mealKey = `${meal.id}-meal`;
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
                                      <ActivityIndicator color="#f97316" size="small" />
                                    ) : (
                                      <View style={styles.consumedBadge}>
                                        <Ionicons name="checkmark-outline" size={12} color="#f97316" />
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
                                                <ActivityIndicator color="#f97316" size="small" />
                                              ) : (
                                                <View style={styles.consumedBadge}>
                                                  <Ionicons name="checkmark-outline" size={12} color="#f97316" />
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
              <View style={styles.waterHeaderRow}>
                <Text style={styles.waterTitle}>Água</Text>
                <Text style={styles.waterValue}>{(waterMl / 1000).toFixed(1)}L / 2.0L</Text>
              </View>
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

  const hubGroups = buildHubGroups(categorizedProducts);
  const nutritionItems = categorizedProducts.filter((p) => NUTRITION_LIBRARY_CATEGORIES.includes(p.category) || p.type === 'ebook_receitas');
  const nutritionCollections = collections
    .map((c) => ({ ...c, items: nutritionItems.filter((p) => p.collection_id === c.id) }))
    .filter((c) => c.items.length > 0);
  const ungroupedNutritionItems = nutritionItems.filter((p) => !p.collection_id);

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <HeaderWelcome
        avatarUrl={ownAvatarUrl}
        initial={user?.name?.charAt(0).toUpperCase() || '?'}
        greeting={`Olá, ${user?.name}!`}
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
          <View style={styles.topMetaRow}>
            <View style={[styles.financePill, isOverdue && styles.financePillOverdue]}>
              <Ionicons name={isOverdue ? 'alert-circle' : 'checkmark-circle'} size={13} color={isOverdue ? '#ef4444' : '#22c55e'} />
              <Text style={[styles.financePillText, isOverdue && styles.financePillTextOverdue]} numberOfLines={1}>
                {isOverdue ? 'Mensalidade vencida' : 'Financeiro em dia'}
              </Text>
            </View>
            {personalId && (
              <TouchableOpacity style={styles.personalPill} onPress={() => handleOpenChatFor('')}>
                {personalAvatarUrl ? (
                  <Image source={{ uri: personalAvatarUrl }} style={styles.personalPillAvatar} />
                ) : (
                  <View style={styles.personalPillAvatarPlaceholder}>
                    <Text style={styles.personalPillAvatarLetter}>{personalName?.charAt(0).toUpperCase() || '?'}</Text>
                  </View>
                )}
                <Text style={styles.personalPillName} numberOfLines={1}>{personalName || 'Seu Personal'}</Text>
              </TouchableOpacity>
            )}
          </View>

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
                  <Ionicons name="logo-whatsapp" size={14} color="#0a0a0a" />
                  <Text style={styles.payButtonText}>Realizar Pagamento</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {personalId && (
            <TouchableOpacity style={styles.whatsappStrip} onPress={handleOpenWhatsApp}>
              <Ionicons name="logo-whatsapp" size={16} color="#0a0a0a" />
              <Text style={styles.whatsappStripText}>Falar com {personalName || 'seu Personal'} no WhatsApp</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>ACESSO RÁPIDO</Text>
          <View style={styles.quickAccessRow}>
            <TouchableOpacity style={styles.quickAccessCard} onPress={() => setActiveTab('treinos')}>
              <View style={styles.quickAccessIconCircle}>
                <Ionicons name="barbell-outline" size={22} color={ACCENT} />
              </View>
              <Text style={styles.quickAccessTitle}>Seu Treino de Hoje</Text>
              <Text style={styles.quickAccessSubtitle}>
                {workouts.length} ficha{workouts.length !== 1 ? 's' : ''} · {weekDaysCount}/7 dias essa semana
              </Text>
              <View style={styles.quickAccessProgressTrack}>
                <View style={[styles.quickAccessProgressFill, { width: `${Math.min(100, (weekDaysCount / 7) * 100)}%` }]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAccessCard} onPress={() => setActiveTab('nutricao')}>
              <View style={styles.quickAccessIconCircle}>
                <Ionicons name="restaurant-outline" size={22} color={ACCENT} />
              </View>
              <Text style={styles.quickAccessTitle}>Seu Plano Alimentar</Text>
              <Text style={styles.quickAccessSubtitle}>
                {diets.length} plano{diets.length !== 1 ? 's' : ''} · {Math.round(consumedTotals.kcal)} kcal hoje
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.evolutionRow}
            onPress={() => (myAccessLevel === 'consultoria_vip' ? setShowEvolution(true) : setShowEvolutionLock(true))}
          >
            <Ionicons name="trending-up-outline" size={20} color={ACCENT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.evolutionRowTitle}>Evolução Física</Text>
              <Text style={styles.evolutionRowSubtitle}>Fotos de progresso, peso e avaliações</Text>
            </View>
            {myAccessLevel === 'consultoria_vip' ? (
              <Ionicons name="chevron-forward-outline" size={18} color="#525252" />
            ) : (
              <Ionicons name="lock-closed" size={16} color={ACCENT} />
            )}
          </TouchableOpacity>

          {hubGroups.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>HUB DE PROGRAMAS</Text>
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

          <View style={styles.nutritionHeaderRow}>
            <Text style={styles.sectionTitle}>BIBLIOTECA DE NUTRIÇÃO</Text>
            <TouchableOpacity onPress={() => setShowRecipes(true)}>
              <Text style={styles.nutritionHeaderLink}>Ver Receitas</Text>
            </TouchableOpacity>
          </View>
          {nutritionItems.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum e-book ou guia disponível ainda.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {nutritionCollections.map((c) => (
                <TouchableOpacity key={c.id} style={styles.nutritionCard} onPress={() => setOpenCollection(c)}>
                  <View style={styles.nutritionCoverWrap}>
                    {c.cover_image_url ? (
                      <Image source={{ uri: c.cover_image_url }} style={styles.nutritionCoverImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.nutritionCoverPlaceholder}>
                        <Ionicons name="folder-outline" size={22} color={ACCENT} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.nutritionCardName} numberOfLines={3}>{toTitleCase(c.name)}</Text>
                </TouchableOpacity>
              ))}
              {ungroupedNutritionItems.map((p) => {
                const unlocked = unlockedProductIds.has(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.nutritionCard}
                    onPress={() => (p.type === 'treino_template' ? setOpenProgram(p) : setSelectedProduct(p))}
                  >
                    <View style={styles.nutritionCoverWrap}>
                      {p.cover_image_url ? (
                        <Image source={{ uri: p.cover_image_url }} style={styles.nutritionCoverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.nutritionCoverPlaceholder}>
                          <Ionicons name="book-outline" size={22} color={ACCENT} />
                        </View>
                      )}
                      {!unlocked && (
                        <View style={styles.categoryLockOverlay}>
                          <Ionicons name="lock-closed" size={14} color="#f5f5f5" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.nutritionCardName} numberOfLines={3}>{toTitleCase(p.name)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {showPartnersSection && partnerBrands.length > 0 && (
            <View style={styles.partnersFooterSection}>
              <Text style={styles.sectionTitle}>Marcas Parceiras</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {partnerBrands.map((b) => (
                  <View key={b.id} style={styles.partnerBanner}>
                    <View style={styles.partnerBannerLogoWrap}>
                      {b.logo_url ? (
                        <Image source={{ uri: b.logo_url }} style={styles.partnerBannerLogoImage} resizeMode="contain" />
                      ) : (
                        <Ionicons name="pricetag-outline" size={20} color={ACCENT} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partnerBannerName} numberOfLines={1}>{b.name}</Text>
                      {(b.coupon_code || b.affiliate_link) && (
                        <View style={styles.partnerBannerTagBadge}>
                          <Text style={styles.partnerBannerTagBadgeText}>
                            {b.coupon_code ? 'CUPOM DISPONÍVEL' : 'DESCONTO EXCLUSIVO'}
                          </Text>
                        </View>
                      )}
                      {b.coupon_code ? (
                        <TouchableOpacity style={styles.partnerBannerCouponButton} onPress={() => handleCopyCoupon(b)}>
                          <Ionicons name={copiedCouponId === b.id ? 'checkmark-outline' : 'copy-outline'} size={12} color={ACCENT} />
                          <Text style={styles.partnerBannerCouponText}>
                            {copiedCouponId === b.id ? 'Copiado!' : b.coupon_code}
                          </Text>
                        </TouchableOpacity>
                      ) : b.affiliate_link ? (
                        <TouchableOpacity style={styles.partnerBannerCouponButton} onPress={() => handleCopyCoupon(b)}>
                          <Text style={styles.partnerBannerCouponText}>Ver oferta</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center' },
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
  topMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  financePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  financePillOverdue: { backgroundColor: 'rgba(239,68,68,0.12)' },
  financePillText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  financePillTextOverdue: { color: '#ef4444' },
  personalPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, flexShrink: 1 },
  personalPillAvatar: { width: 22, height: 22, borderRadius: 11 },
  personalPillAvatarPlaceholder: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  personalPillAvatarLetter: { color: '#E05A17', fontSize: 10, fontWeight: '800' },
  personalPillName: { color: '#D4D4D8', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  whatsappStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E05A17', borderRadius: 16, paddingVertical: 12, marginBottom: 20 },
  whatsappStripText: { color: '#0a0a0a', fontSize: 13, fontWeight: '800' },
  sectionTitleSpaced: { marginTop: 4 },
  quickAccessRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  quickAccessCard: { flex: 1, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 16, minHeight: 120 },
  quickAccessIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(224,90,23,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickAccessTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  quickAccessSubtitle: { color: '#A1A1AA', fontSize: 10, marginTop: 4, lineHeight: 14 },
  quickAccessProgressTrack: { height: 4, backgroundColor: '#27272A', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  quickAccessProgressFill: { height: '100%', borderRadius: 2, backgroundColor: ACCENT },
  evolutionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 16, marginBottom: 24 },
  evolutionRowTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  evolutionRowSubtitle: { color: '#A1A1AA', fontSize: 11, marginTop: 2 },
  hubBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hubBadgeChip: { backgroundColor: '#27272A', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  hubBadgeChipText: { color: '#D4D4D8', fontSize: 10, fontWeight: '600' },
  nutritionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nutritionHeaderLink: { color: '#E05A17', fontSize: 12, fontWeight: '700' },
  nutritionCard: { width: 176 },
  nutritionCoverWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', overflow: 'hidden', marginBottom: 6, position: 'relative' },
  nutritionCoverImage: { ...COVER_TOP_IMAGE },
  nutritionCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  nutritionCardName: { color: '#f5f5f5', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  partnersFooterSection: { marginTop: 24 },
  categoryListCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 10, marginBottom: 10 },
  categoryListCoverWrap: { width: 72, aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: '#0a0a0a', overflow: 'hidden', position: 'relative' },
  categoryListCoverImage: { width: '100%', height: '100%' },
  categoryListCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  categoryListName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', flex: 1 },
  collectionDescription: { color: '#A1A1AA', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  categoryLockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  partnerBanner: { width: 260, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 12 },
  partnerBannerLogoWrap: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  partnerBannerLogoImage: { width: '100%', height: '100%' },
  partnerBannerName: { color: '#f5f5f5', fontSize: 12, fontWeight: '700' },
  partnerBannerTagBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3, marginBottom: 6 },
  partnerBannerTagBadgeText: { color: '#22c55e', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  partnerBannerCouponButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(224,90,23,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  partnerBannerCouponText: { color: '#E05A17', fontSize: 10, fontWeight: '800' },
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
  dietSubTabButtonActive: { backgroundColor: '#f97316' },
  dietSubTabText: { color: '#a3a3a3', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  dietSubTabTextActive: { color: '#0a0a0a' },
  dietTabScroll: { maxHeight: 46, marginBottom: 8 },
  dietTabChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  dietTabChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
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
  consumedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  consumedBadgeText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  orConnector: { color: '#525252', fontSize: 9, fontWeight: '700', marginVertical: 4, marginLeft: 8 },
  substitutesBox: { marginLeft: 8, marginTop: 2 },
  substituteText: { color: '#737373', fontSize: 11, flexShrink: 1 },
  nutriTopCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginTop: 14, marginBottom: 14, overflow: 'hidden' },
  nutriTopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  nutriLibraryShortcut: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 14 },
  nutriLibraryShortcutText: { flex: 1, color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  completeMealButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginRight: 8 },
  completeMealButtonText: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  hojeCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  hojeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  hojeTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  hojeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hojeSummary: { color: '#f97316', fontSize: 12, fontWeight: '700' },
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
  waterValue: { color: '#5EC8D8', fontSize: 12, fontWeight: '700' },
  waterButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  waterButton: { flex: 1, backgroundColor: 'rgba(94,200,216,0.12)', borderWidth: 1, borderColor: '#5EC8D8', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  waterButtonText: { color: '#5EC8D8', fontSize: 12, fontWeight: '700' },
  noteCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 14 },
  noteCardTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  noteText: { color: '#737373', fontSize: 12, fontStyle: 'italic' },
  noteInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 12, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
  noteSaveButton: { backgroundColor: '#f97316', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  noteSaveButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  addExtraButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 16 },
  addExtraButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
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
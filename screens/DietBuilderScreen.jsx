import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Modal, Switch } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabaseClient';
import DietMealsDetailScreen from './DietMealsDetailScreen';
import { showAlert } from './alertUtils';
import PromptModal from './PromptModal';

function mapMealNameToType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('café') || n.includes('cafe') || n.includes('manhã') || n.includes('manha')) return 'cafe';
  if (n.includes('almo')) return 'almoco';
  if (n.includes('lanche')) return 'lanche';
  if (n.includes('jant')) return 'jantar';
  if (n.includes('ceia')) return 'ceia';
  return 'lanche';
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildDietHtml(studentName, dietName, meals, goals, branding) {
  const formatDate = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const brandColor = branding?.brandColor || '#22c55e';

  const mealBlocks = meals.map((meal) => {
    const foodRows = (meal.diet_meal_foods || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((f) => {
        const subs = (f.diet_meal_food_substitutes || []).sort((a, b) => a.order_index - b.order_index);
        const subLines = subs.map((s) => `
          <tr>
            <td class="food-name substitute-name">OU ${s.food_name}${s.quantity_g ? ` — ${s.quantity_g}g` : s.quantity ? ` — ${s.quantity}` : ''}</td>
            <td class="food-macros">${s.calories_kcal != null ? `${Math.round(s.calories_kcal)}kcal` : ''}</td>
          </tr>
        `).join('');
        return `
          <tr>
            <td class="food-name">${f.food_name}${f.quantity_g ? ` — ${f.quantity_g}g` : f.quantity ? ` — ${f.quantity}` : ''}</td>
            <td class="food-macros">${f.calories_kcal != null ? `${Math.round(f.calories_kcal)}kcal · P:${f.protein_g}g · C:${f.carbs_g}g · G:${f.fat_g}g` : ''}</td>
          </tr>
          ${subLines}
        `;
      }).join('');

    return `
      <div class="meal-block">
        <h3>${meal.name}${meal.meal_time ? ` <span class="time">· ${meal.meal_time}</span>` : ''}</h3>
        <table>${foodRows || '<tr><td class="food-name">Nenhum alimento cadastrado.</td></tr>'}</table>
      </div>
    `;
  }).join('');

  const goalsSection = goals && (goals.goal_kcal || goals.goal_protein_g)
    ? `
      <h2>Metas diárias</h2>
      <table class="goals-table">
        ${goals.goal_kcal ? `<tr><td class="label">Calorias</td><td class="value">${goals.goal_kcal} kcal</td></tr>` : ''}
        ${goals.goal_protein_g ? `<tr><td class="label">Proteína</td><td class="value">${goals.goal_protein_g}g</td></tr>` : ''}
        ${goals.goal_carbs_g ? `<tr><td class="label">Carboidrato</td><td class="value">${goals.goal_carbs_g}g</td></tr>` : ''}
        ${goals.goal_fat_g ? `<tr><td class="label">Gordura</td><td class="value">${goals.goal_fat_g}g</td></tr>` : ''}
      </table>
    `
    : '';

  const headerBlock = branding?.useLogo && branding?.logoUrl
    ? `<div class="header-with-logo"><img src="${branding.logoUrl}" class="logo" /><div><h1 style="color:${brandColor}">Plano Alimentar</h1><div class="subtitle">${studentName} · ${dietName} · Gerado em ${formatDate()}</div></div></div>`
    : `<h1 style="color:${brandColor}">Plano Alimentar</h1><div class="subtitle">${studentName} · ${dietName} · Gerado em ${formatDate()}</div>`;

  const footerParts = [];
  if (branding?.professionalRegister) footerParts.push(branding.professionalRegister);
  if (branding?.phone) footerParts.push(`WhatsApp: ${branding.phone}`);
  if (branding?.contactInstagram) footerParts.push(branding.contactInstagram);
  if (branding?.contactEmail) footerParts.push(branding.contactEmail);
  const footerText = footerParts.length > 0
    ? footerParts.join(' · ')
    : 'Gerado pelo NutriTreino · Este plano é uma orientação, não substitui acompanhamento nutricional individualizado.';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .header-with-logo { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
          .logo { width: 60px; height: 60px; object-fit: contain; }
          .subtitle { color: #737373; font-size: 12px; margin-bottom: 24px; }
          h2 { font-size: 15px; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid ${brandColor}; padding-bottom: 4px; }
          h3 { font-size: 14px; margin-top: 16px; margin-bottom: 6px; color: #1a1a1a; }
          .time { color: ${brandColor}; font-weight: normal; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          .goals-table td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
          .goals-table .label { color: #555; }
          .goals-table .value { text-align: right; font-weight: 700; }
          .meal-block { margin-bottom: 12px; }
          .food-name { padding: 4px; font-size: 12px; color: #333; }
          .substitute-name { padding-left: 16px; color: #777; font-style: italic; }
          .food-macros { padding: 4px; font-size: 10px; color: #888; text-align: right; }
          .footer { margin-top: 32px; color: #a3a3a3; font-size: 10px; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
        </style>
      </head>
      <body>
        ${headerBlock}
        ${goalsSection}
        <h2>Refeições</h2>
        ${mealBlocks || '<p>Nenhuma refeição cadastrada ainda.</p>'}
        <div class="footer">${footerText}</div>
      </body>
    </html>
  `;
}

export default function DietBuilderScreen({ studentId, studentName, personalId, onClose }) {
  const [diets, setDiets] = useState([]);
  const [activeDietId, setActiveDietId] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showMealsDetail, setShowMealsDetail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportWithBranding, setExportWithBranding] = useState(true);
  const [branding, setBranding] = useState(null);

  const [diaryToday, setDiaryToday] = useState([]);
  const [loadingDiary, setLoadingDiary] = useState(true);
  const [adherenceTrend, setAdherenceTrend] = useState([]);

  const [newDietName, setNewDietName] = useState('');
  const [renamingDiet, setRenamingDiet] = useState(null);

  const [goalKcal, setGoalKcal] = useState('');
  const [goalProtein, setGoalProtein] = useState('');
  const [goalCarbs, setGoalCarbs] = useState('');
  const [goalFat, setGoalFat] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);

  const [showSendModal, setShowSendModal] = useState(false);
  const [otherStudents, setOtherStudents] = useState([]);
  const [loadingOtherStudents, setLoadingOtherStudents] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [sendingDiet, setSendingDiet] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadDiets = async () => {
    const { data } = await supabase
      .from('diets')
      .select('id, name, goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at', { ascending: true });
    setDiets(data || []);
    if (data && data.length > 0) {
      setActiveDietId((prev) => (prev && data.some((d) => d.id === prev)) ? prev : data[0].id);
    } else {
      setActiveDietId(null);
    }
  };

  const loadMeals = async (dietId) => {
    if (!dietId) { setMeals([]); return; }
    const { data } = await supabase
      .from('diet_meals')
      .select('id, name, meal_time, diet_meal_foods (calories_kcal, protein_g, carbs_g, fat_g)')
      .eq('diet_id', dietId);
    setMeals(data || []);
  };

  const loadBranding = async () => {
    const { data } = await supabase
      .from('users')
      .select('logo_url, brand_color, professional_register, phone, contact_instagram, contact_email')
      .eq('id', personalId)
      .single();
    if (data) {
      setBranding({
        logoUrl: data.logo_url,
        brandColor: data.brand_color,
        professionalRegister: data.professional_register,
        phone: data.phone,
        contactInstagram: data.contact_instagram,
        contactEmail: data.contact_email,
      });
      setExportWithBranding(!!data.logo_url);
    }
  };

  const loadDiaryToday = async () => {
    setLoadingDiary(true);
    const { data } = await supabase
      .from('food_diary_entries')
      .select('meal_type, food_name, quantity_g, calories_kcal')
      .eq('student_id', studentId)
      .eq('entry_date', todayStr);
    setDiaryToday(data || []);
    setLoadingDiary(false);
  };

  const loadAdherenceTrend = async (mealList) => {
    const mealTypesSet = new Set(mealList.map((m) => mapMealNameToType(m.name)));
    const totalMeals = mealTypesSet.size || 1;
    if (mealList.length === 0) {
      setAdherenceTrend([]);
      return;
    }

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const { data: entries } = await supabase
      .from('food_diary_entries')
      .select('entry_date, meal_type')
      .eq('student_id', studentId)
      .gte('entry_date', fourWeeksAgo.toISOString().slice(0, 10));

    const byDate = {};
    (entries || []).forEach((e) => {
      if (!byDate[e.entry_date]) byDate[e.entry_date] = new Set();
      byDate[e.entry_date].add(e.meal_type);
    });

    const thisMonday = getMonday(new Date());
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - i * 7);
      weeks.push(start);
    }

    const trend = weeks.map((weekStart) => {
      let daySum = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const key = day.toISOString().slice(0, 10);
        const loggedTypes = byDate[key] || new Set();
        const matched = [...mealTypesSet].filter((t) => loggedTypes.has(t)).length;
        daySum += matched / totalMeals;
      }
      return Math.round((daySum / 7) * 100);
    });

    setAdherenceTrend(trend);
  };

  useEffect(() => {
    (async () => {
      await loadDiets();
      await loadDiaryToday();
      await loadBranding();
      setLoading(false);
    })();
  }, [studentId]);

  useEffect(() => {
    if (activeDietId) {
      loadMeals(activeDietId);
      const diet = diets.find((d) => d.id === activeDietId);
      setGoalKcal(diet?.goal_kcal ? String(diet.goal_kcal) : '');
      setGoalProtein(diet?.goal_protein_g ? String(diet.goal_protein_g) : '');
      setGoalCarbs(diet?.goal_carbs_g ? String(diet.goal_carbs_g) : '');
      setGoalFat(diet?.goal_fat_g ? String(diet.goal_fat_g) : '');
    } else {
      setMeals([]);
    }
  }, [activeDietId, diets]);

  useEffect(() => {
    if (meals.length > 0) loadAdherenceTrend(meals);
    else setAdherenceTrend([]);
  }, [meals]);

  const handleCreateDiet = async () => {
    if (!newDietName.trim()) {
      showAlert('Ops', 'Dá um nome pra dieta (ex: "Cutting - Fase 1").');
      return;
    }
    const { data, error } = await supabase
      .from('diets')
      .insert({ student_id: studentId, personal_id: personalId, name: newDietName.trim(), active: true })
      .select()
      .single();
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    setNewDietName('');
    await loadDiets();
    setActiveDietId(data.id);
  };

  const handleRenameDiet = (diet) => {
    setRenamingDiet(diet);
  };

  const handleConfirmRenameDiet = async (newName) => {
    const diet = renamingDiet;
    setRenamingDiet(null);
    const { error } = await supabase.from('diets').update({ name: newName }).eq('id', diet.id);
    if (error) showAlert('Erro', error.message);
    else loadDiets();
  };

  const handleDeleteDiet = (diet) => {
    showAlert(
      'Excluir dieta',
      `Tem certeza que quer excluir "${diet.name}"? Todas as refeições dela também serão removidas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('diets').update({ active: false }).eq('id', diet.id);
            if (error) {
              showAlert('Erro', error.message);
            } else {
              if (activeDietId === diet.id) setActiveDietId(null);
              await loadDiets();
            }
          },
        },
      ]
    );
  };

  const handleLongPressDiet = (diet) => {
    showAlert(
      diet.name,
      'O que você quer fazer com essa dieta?',
      [
        { text: 'Renomear', onPress: () => handleRenameDiet(diet) },
        { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteDiet(diet) },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    const { error } = await supabase
      .from('diets')
      .update({
        goal_kcal: goalKcal ? Number(goalKcal) : null,
        goal_protein_g: goalProtein ? Number(goalProtein) : null,
        goal_carbs_g: goalCarbs ? Number(goalCarbs) : null,
        goal_fat_g: goalFat ? Number(goalFat) : null,
      })
      .eq('id', activeDietId);
    setSavingGoals(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      loadDiets();
    }
  };

  const handleGeneratePdf = async () => {
    setShowExportModal(false);
    if (meals.length === 0) {
      showAlert('Ops', 'Adiciona pelo menos uma refeição antes de gerar o PDF.');
      return;
    }
    setGeneratingPdf(true);
    try {
      const { data: fullMeals } = await supabase
        .from('diet_meals')
        .select('id, name, meal_time, order_index, diet_meal_foods (id, food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index, diet_meal_food_substitutes (id, food_name, quantity, quantity_g, calories_kcal, order_index))')
        .eq('diet_id', activeDietId)
        .order('order_index', { ascending: true });

      const activeDiet = diets.find((d) => d.id === activeDietId);
      const goals = {
        goal_kcal: activeDiet?.goal_kcal,
        goal_protein_g: activeDiet?.goal_protein_g,
        goal_carbs_g: activeDiet?.goal_carbs_g,
        goal_fat_g: activeDiet?.goal_fat_g,
      };
      const brandingToUse = exportWithBranding ? { ...branding, useLogo: true } : null;
      const html = buildDietHtml(studentName, activeDiet?.name || 'Dieta', fullMeals || [], goals, brandingToUse);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar plano alimentar' });
      } else {
        showAlert('PDF gerado', 'O compartilhamento não está disponível nesse dispositivo, mas o PDF foi criado.');
      }
    } catch (e) {
      showAlert('Erro ao gerar PDF', e.message);
    }
    setGeneratingPdf(false);
  };

  const handleOpenSendModal = async () => {
    if (meals.length === 0) {
      showAlert('Ops', 'Essa dieta ainda não tem refeições cadastradas.');
      return;
    }
    setSelectedTargets([]);
    setShowSendModal(true);
    setLoadingOtherStudents(true);
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('personal_id', personalId)
      .eq('role', 'aluno')
      .neq('id', studentId)
      .order('name');
    setOtherStudents(data || []);
    setLoadingOtherStudents(false);
  };

  const handleToggleTarget = (student) => {
    setSelectedTargets((prev) =>
      prev.some((s) => s.id === student.id)
        ? prev.filter((s) => s.id !== student.id)
        : [...prev, student]
    );
  };

  const handleConfirmSendDiet = async () => {
    if (selectedTargets.length === 0) {
      showAlert('Ops', 'Escolhe pelo menos um aluno.');
      return;
    }
    setSendingDiet(true);

    const activeDiet = diets.find((d) => d.id === activeDietId);
    const { data: fullMeals } = await supabase
      .from('diet_meals')
      .select('name, meal_time, order_index, diet_meal_foods (food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index, diet_meal_food_substitutes (food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index))')
      .eq('diet_id', activeDietId)
      .order('order_index', { ascending: true });

    let successCount = 0;
    for (const target of selectedTargets) {
      const { data: newDiet, error } = await supabase
        .from('diets')
        .insert({
          student_id: target.id,
          personal_id: personalId,
          name: activeDiet?.name || 'Dieta',
          active: true,
          goal_kcal: activeDiet?.goal_kcal,
          goal_protein_g: activeDiet?.goal_protein_g,
          goal_carbs_g: activeDiet?.goal_carbs_g,
          goal_fat_g: activeDiet?.goal_fat_g,
        })
        .select()
        .single();
      if (error || !newDiet) continue;

      for (const meal of fullMeals || []) {
        const { data: newMeal } = await supabase
          .from('diet_meals')
          .insert({ diet_id: newDiet.id, name: meal.name, meal_time: meal.meal_time, order_index: meal.order_index })
          .select()
          .single();
        if (!newMeal) continue;

        for (const food of meal.diet_meal_foods || []) {
          const { data: newFood } = await supabase
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
              order_index: food.order_index,
            })
            .select()
            .single();
          if (!newFood) continue;

          const subs = food.diet_meal_food_substitutes || [];
          if (subs.length > 0) {
            await supabase.from('diet_meal_food_substitutes').insert(
              subs.map((s) => ({
                diet_meal_food_id: newFood.id,
                food_name: s.food_name,
                quantity: s.quantity,
                quantity_g: s.quantity_g,
                calories_kcal: s.calories_kcal,
                protein_g: s.protein_g,
                carbs_g: s.carbs_g,
                fat_g: s.fat_g,
                order_index: s.order_index,
              }))
            );
          }
        }
      }
      successCount += 1;
    }

    setSendingDiet(false);
    setShowSendModal(false);
    showAlert('Enviado!', `Dieta copiada para ${successCount} aluno${successCount !== 1 ? 's' : ''}.`);
  };

  const dayTotals = meals.reduce(
    (acc, meal) => {
      (meal.diet_meal_foods || []).forEach((f) => {
        acc.kcal += f.calories_kcal || 0;
        acc.protein += f.protein_g || 0;
        acc.carbs += f.carbs_g || 0;
        acc.fat += f.fat_g || 0;
      });
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const checklistItems = meals.map((meal) => {
    const mappedType = mapMealNameToType(meal.name);
    const entriesForMeal = diaryToday.filter((e) => e.meal_type === mappedType);
    return {
      mealName: meal.name,
      done: entriesForMeal.length > 0,
      entries: entriesForMeal,
    };
  });
  const doneCount = checklistItems.filter((c) => c.done).length;
  const activeDiet = diets.find((d) => d.id === activeDietId);
  const maxTrend = Math.max(...adherenceTrend, 1);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (showMealsDetail && activeDietId) {
    return (
      <DietMealsDetailScreen
        dietId={activeDietId}
        dietName={activeDiet?.name || 'Dieta'}
        studentId={studentId}
        onClose={() => {
          setShowMealsDetail(false);
          loadMeals(activeDietId);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.studentLabel}>{studentName}</Text>
      </View>

      <View style={styles.dietRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {diets.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.dietTab, activeDietId === d.id && styles.dietTabActive]}
              onPress={() => setActiveDietId(d.id)}
              onLongPress={() => handleLongPressDiet(d)}
            >
              <Text style={[styles.dietTabText, activeDietId === d.id && styles.dietTabTextActive]}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {diets.length > 0 && <Text style={styles.hintText}>Segure uma aba pra renomear ou excluir</Text>}
      <View style={styles.newDietRow}>
        <TextInput
          style={styles.newDietInput}
          placeholder="Nome da nova dieta (ex: Cutting - Fase 1)"
          placeholderTextColor="#737373"
          value={newDietName}
          onChangeText={setNewDietName}
        />
        <TouchableOpacity style={styles.addDietButton} onPress={handleCreateDiet}>
          <Text style={styles.addDietButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {!activeDietId ? (
        <Text style={styles.emptyText}>Cria uma dieta acima pra começar.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.pdfRow}>
            {meals.length > 0 && (
              <TouchableOpacity style={styles.pdfLink} onPress={() => setShowExportModal(true)} disabled={generatingPdf}>
                {generatingPdf ? (
                  <ActivityIndicator color="#22c55e" size="small" />
                ) : (
                  <Text style={styles.pdfLinkText}>Gerar PDF</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.pdfLink} onPress={handleOpenSendModal}>
              <Text style={styles.sendLinkText}>Enviar p/ outro aluno</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bigCard}>
            <Text style={styles.bigCardTitle}>Meta Diária</Text>
            <View style={styles.metaInputsRow}>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Kcal</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholder="2000" placeholderTextColor="#525252" value={goalKcal} onChangeText={setGoalKcal} />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Prot.</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholder="150" placeholderTextColor="#525252" value={goalProtein} onChangeText={setGoalProtein} />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Carbo</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholder="200" placeholderTextColor="#525252" value={goalCarbs} onChangeText={setGoalCarbs} />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Gord.</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholder="60" placeholderTextColor="#525252" value={goalFat} onChangeText={setGoalFat} />
              </View>
              <TouchableOpacity style={styles.metaSaveButton} onPress={handleSaveGoals} disabled={savingGoals}>
                {savingGoals ? <ActivityIndicator color="#f97316" size="small" /> : <Text style={styles.metaSaveButtonText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.bigCard} onPress={() => setShowMealsDetail(true)}>
            <View style={styles.dietSummaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bigCardTitle}>Dieta Elaborada</Text>
                <Text style={styles.dietSummaryName}>{activeDiet?.name}</Text>
                <Text style={styles.dietSummaryMeta}>
                  {Math.round(dayTotals.kcal)} kcal prescritas · {meals.length} Refeiç{meals.length === 1 ? 'ão' : 'ões'}
                </Text>
              </View>
              <View style={styles.editDietBadge}>
                <Text style={styles.editDietBadgeText}>Editar Dieta</Text>
                <Text style={styles.editDietArrow}>›</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.bigCard}>
            <View style={styles.diaryCardHeader}>
              <Text style={styles.bigCardTitle}>Refeições Registradas pelo Aluno</Text>
              <TouchableOpacity onPress={loadDiaryToday}>
                <Text style={styles.refreshLink}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            {adherenceTrend.length === 4 && (
              <View style={styles.trendBox}>
                <Text style={styles.trendTitle}>Adesão nas últimas 4 semanas</Text>
                <View style={styles.trendBarsRow}>
                  {adherenceTrend.map((pct, i) => (
                    <View key={i} style={styles.trendBarColumn}>
                      <View style={styles.trendBarTrack}>
                        <View style={[styles.trendBarFill, { height: `${Math.max(4, pct)}%` }]} />
                      </View>
                      <Text style={styles.trendBarPct}>{pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {loadingDiary ? (
              <ActivityIndicator color="#f97316" size="small" style={{ marginVertical: 10 }} />
            ) : checklistItems.length === 0 ? (
              <Text style={styles.emptyInnerText}>Cadastre refeições na dieta pra acompanhar aqui.</Text>
            ) : (
              <>
                <Text style={styles.adherenceText}>
                  {doneCount} de {checklistItems.length} refeições concluídas hoje ({Math.round((doneCount / checklistItems.length) * 100)}%)
                </Text>
                <View style={styles.adherenceBarTrack}>
                  <View style={[styles.adherenceBarFill, { width: `${(doneCount / checklistItems.length) * 100}%` }]} />
                </View>

                {checklistItems.map((item, i) => (
                  <View key={i} style={styles.checklistRow}>
                    <View style={[styles.checklistDot, item.done && styles.checklistDotDone]}>
                      {item.done && <Text style={styles.checklistCheck}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checklistMealName}>{item.mealName}</Text>
                      {item.done && (
                        <Text style={styles.checklistDetail} numberOfLines={1}>
                          {item.entries.map((e) => e.food_name).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={onClose}>
        <Text style={styles.saveButtonText}>Salvar Dieta</Text>
      </TouchableOpacity>

      <PromptModal
        visible={!!renamingDiet}
        title="Renomear dieta"
        subtitle="Digite o novo nome:"
        initialValue={renamingDiet?.name}
        onCancel={() => setRenamingDiet(null)}
        onSubmit={handleConfirmRenameDiet}
      />

      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Exportar PDF</Text>
            <View style={styles.brandingToggleRow}>
              <Text style={styles.brandingToggleLabel}>Gerar com minha marca personalizada</Text>
              <Switch
                value={exportWithBranding}
                onValueChange={setExportWithBranding}
                trackColor={{ false: '#292524', true: '#22c55e' }}
                thumbColor="#f5f5f5"
                disabled={!branding?.logoUrl}
              />
            </View>
            {!branding?.logoUrl && (
              <Text style={styles.brandingToggleHint}>Cadastre sua logo no Perfil pra habilitar essa opção.</Text>
            )}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowExportModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleGeneratePdf}>
                <Text style={styles.modalConfirmButtonText}>Gerar PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSendModal} transparent animationType="slide" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sendModalSheet}>
            <Text style={styles.modalTitle}>Enviar dieta</Text>
            <Text style={styles.modalSubtitle}>Escolhe pra quais alunos você quer copiar essa dieta inteira (refeições, alimentos e substituições).</Text>

            {loadingOtherStudents ? (
              <ActivityIndicator color="#f97316" style={{ marginVertical: 20 }} />
            ) : otherStudents.length === 0 ? (
              <Text style={styles.emptyText}>Você não tem outros alunos ainda.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 260, marginBottom: 16 }}>
                {otherStudents.map((s) => {
                  const isSelected = selectedTargets.some((t) => t.id === s.id);
                  return (
                    <TouchableOpacity key={s.id} style={[styles.targetRow, isSelected && styles.targetRowSelected]} onPress={() => handleToggleTarget(s)}>
                      <Text style={styles.targetRowText}>{s.name}</Text>
                      <Text style={styles.targetRowCheck}>{isSelected ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowSendModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleConfirmSendDiet} disabled={sendingDiet}>
                {sendingDiet ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.modalConfirmButtonText}>Enviar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  studentLabel: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  dietRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  dietTab: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  dietTabActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  dietTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  dietTabTextActive: { color: '#0a0a0a' },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 8 },
  newDietRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  newDietInput: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#f5f5f5', fontSize: 12 },
  addDietButton: { backgroundColor: '#22c55e', width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addDietButtonText: { color: '#0a0a0a', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  emptyInnerText: { color: '#525252', fontSize: 12, marginTop: 4, marginBottom: 4 },
  pdfRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginHorizontal: 16, marginBottom: 14 },
  pdfLink: { alignItems: 'center' },
  pdfLinkText: { color: '#22c55e', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  sendLinkText: { color: '#3b82f6', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  bigCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  bigCardTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaInputsRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  metaField: { flex: 1 },
  metaFieldLabel: { color: '#525252', fontSize: 9, marginBottom: 4 },
  metaInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 8, color: '#f5f5f5', fontSize: 12, textAlign: 'center' },
  metaSaveButton: { paddingHorizontal: 10, paddingVertical: 9 },
  metaSaveButtonText: { color: '#f97316', fontSize: 11, fontWeight: '700' },
  dietSummaryRow: { flexDirection: 'row', alignItems: 'center' },
  dietSummaryName: { color: '#22c55e', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  dietSummaryMeta: { color: '#737373', fontSize: 11 },
  editDietBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editDietBadgeText: { color: '#f97316', fontSize: 11, fontWeight: '700' },
  editDietArrow: { color: '#f97316', fontSize: 18, fontWeight: '700' },
  diaryCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshLink: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  trendBox: { marginBottom: 16, marginTop: 4 },
  trendTitle: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8 },
  trendBarsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 70 },
  trendBarColumn: { alignItems: 'center', flex: 1 },
  trendBarTrack: { width: 20, height: 50, backgroundColor: '#0a0a0a', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBarFill: { width: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  trendBarPct: { color: '#525252', fontSize: 9, marginTop: 4 },
  adherenceText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  adherenceBarTrack: { height: 8, backgroundColor: '#0a0a0a', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  adherenceBarFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 4 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checklistDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#292524', alignItems: 'center', justifyContent: 'center' },
  checklistDotDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checklistCheck: { color: '#0a0a0a', fontSize: 12, fontWeight: '800' },
  checklistMealName: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  checklistDetail: { color: '#525252', fontSize: 10, marginTop: 1 },
  saveButton: { backgroundColor: '#f97316', margin: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#171717', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  brandingToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandingToggleLabel: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  brandingToggleHint: { color: '#525252', fontSize: 10, marginTop: 8, lineHeight: 14 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 11, marginBottom: 16, lineHeight: 16 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  sendModalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '80%' },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  targetRowSelected: { borderColor: '#3b82f6' },
  targetRowText: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  targetRowCheck: { color: '#3b82f6', fontSize: 15, fontWeight: '800' },
});
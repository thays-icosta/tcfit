import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import PromptModal from './PromptModal';
import { HeaderBack } from './Header';

// Personal's private, reusable diet plans — the nutrition equivalent of
// workout Modelos. Created and edited here, then copied (never linked) into
// a specific student's own diets/diet_meals/diet_meal_foods rows when applied,
// exactly like handleApplyTemplate does for workouts.
export default function DietTemplateBuilderScreen({ personalId, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [renamingTemplate, setRenamingTemplate] = useState(null);

  const [newMealName, setNewMealName] = useState('');
  const [renamingMeal, setRenamingMeal] = useState(null);

  const [addingFoodFor, setAddingFoodFor] = useState(null);
  const [foodName, setFoodName] = useState('');
  const [foodQuantity, setFoodQuantity] = useState('');
  const [foodKcal, setFoodKcal] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [savingFood, setSavingFood] = useState(false);

  const [goalKcal, setGoalKcal] = useState('');
  const [goalProtein, setGoalProtein] = useState('');
  const [goalCarbs, setGoalCarbs] = useState('');
  const [goalFat, setGoalFat] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [applyingStudentId, setApplyingStudentId] = useState(null);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('diet_templates')
      .select('*')
      .eq('personal_id', personalId)
      .order('created_at', { ascending: true });
    setTemplates(data || []);
    setActiveTemplateId((prev) => (data && data.some((t) => t.id === prev)) ? prev : null);
    setLoading(false);
  };

  const loadMeals = async (templateId) => {
    if (!templateId) { setMeals([]); return; }
    setLoadingMeals(true);
    const { data } = await supabase
      .from('diet_template_meals')
      .select('id, name, meal_time, order_index, diet_template_meal_foods (id, food_name, quantity, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, order_index)')
      .eq('template_id', templateId)
      .order('order_index', { ascending: true });
    setMeals((data || []).map((m) => ({ ...m, diet_template_meal_foods: (m.diet_template_meal_foods || []).sort((a, b) => a.order_index - b.order_index) })));
    setLoadingMeals(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  useEffect(() => {
    loadMeals(activeTemplateId);
    const t = templates.find((t) => t.id === activeTemplateId);
    setGoalKcal(t?.goal_kcal != null ? String(t.goal_kcal) : '');
    setGoalProtein(t?.goal_protein_g != null ? String(t.goal_protein_g) : '');
    setGoalCarbs(t?.goal_carbs_g != null ? String(t.goal_carbs_g) : '');
    setGoalFat(t?.goal_fat_g != null ? String(t.goal_fat_g) : '');
  }, [activeTemplateId]);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      showAlert('Ops', 'Dá um nome pro modelo (ex: "Cutting Padrão").');
      return;
    }
    const { data, error } = await supabase
      .from('diet_templates')
      .insert({ personal_id: personalId, name: newTemplateName.trim() })
      .select()
      .single();
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    setNewTemplateName('');
    setShowCreateModal(false);
    await loadTemplates();
    setActiveTemplateId(data.id);
  };

  const handleRenameTemplate = async (newName) => {
    const template = renamingTemplate;
    setRenamingTemplate(null);
    const { error } = await supabase.from('diet_templates').update({ name: newName }).eq('id', template.id);
    if (error) showAlert('Erro', error.message);
    else loadTemplates();
  };

  const handleDeleteTemplate = (template) => {
    showAlert('Excluir modelo', `Tem certeza que quer excluir "${template.name}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('diet_templates').delete().eq('id', template.id);
          if (activeTemplateId === template.id) setActiveTemplateId(null);
          loadTemplates();
        },
      },
    ]);
  };

  const handleLongPressTemplate = (template) => {
    showAlert(template.name, 'O que você quer fazer com esse modelo?', [
      { text: 'Renomear', onPress: () => setRenamingTemplate(template) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteTemplate(template) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    const { error } = await supabase
      .from('diet_templates')
      .update({
        goal_kcal: goalKcal ? Number(goalKcal) : null,
        goal_protein_g: goalProtein ? Number(goalProtein) : null,
        goal_carbs_g: goalCarbs ? Number(goalCarbs) : null,
        goal_fat_g: goalFat ? Number(goalFat) : null,
      })
      .eq('id', activeTemplateId);
    setSavingGoals(false);
    if (error) showAlert('Erro', error.message);
    else loadTemplates();
  };

  const handleAddMeal = async () => {
    if (!newMealName.trim()) return;
    const { error } = await supabase
      .from('diet_template_meals')
      .insert({ template_id: activeTemplateId, name: newMealName.trim(), order_index: meals.length });
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    setNewMealName('');
    loadMeals(activeTemplateId);
  };

  const handleRenameMeal = async (newName) => {
    const meal = renamingMeal;
    setRenamingMeal(null);
    const { error } = await supabase.from('diet_template_meals').update({ name: newName }).eq('id', meal.id);
    if (error) showAlert('Erro', error.message);
    else loadMeals(activeTemplateId);
  };

  const handleDeleteMeal = (meal) => {
    showAlert('Excluir refeição', `Excluir "${meal.name}" e todos os alimentos dela?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('diet_template_meals').delete().eq('id', meal.id);
          loadMeals(activeTemplateId);
        },
      },
    ]);
  };

  const handleLongPressMeal = (meal) => {
    showAlert(meal.name, 'O que você quer fazer com essa refeição?', [
      { text: 'Renomear', onPress: () => setRenamingMeal(meal) },
      { text: 'Excluir', style: 'destructive', onPress: () => handleDeleteMeal(meal) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const resetFoodForm = () => {
    setFoodName('');
    setFoodQuantity('');
    setFoodKcal('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
  };

  const handleOpenAddFood = (mealId) => {
    resetFoodForm();
    setAddingFoodFor(mealId);
  };

  const handleSaveFood = async () => {
    if (!foodName.trim()) {
      showAlert('Ops', 'Dá um nome pro alimento.');
      return;
    }
    const meal = meals.find((m) => m.id === addingFoodFor);
    setSavingFood(true);
    const { error } = await supabase.from('diet_template_meal_foods').insert({
      meal_id: addingFoodFor,
      food_name: foodName.trim(),
      quantity: foodQuantity.trim() || null,
      calories_kcal: foodKcal ? Number(foodKcal) : null,
      protein_g: foodProtein ? Number(foodProtein) : null,
      carbs_g: foodCarbs ? Number(foodCarbs) : null,
      fat_g: foodFat ? Number(foodFat) : null,
      order_index: meal?.diet_template_meal_foods?.length || 0,
    });
    setSavingFood(false);
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    setAddingFoodFor(null);
    loadMeals(activeTemplateId);
  };

  const handleDeleteFood = (food) => {
    showAlert('Remover alimento', `Remover "${food.food_name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('diet_template_meal_foods').delete().eq('id', food.id);
          loadMeals(activeTemplateId);
        },
      },
    ]);
  };

  const handleOpenApply = async () => {
    setShowApplyModal(true);
    setLoadingStudents(true);
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('personal_id', personalId)
      .eq('role', 'aluno')
      .order('name');
    setStudents(data || []);
    setLoadingStudents(false);
  };

  const handleApplyToStudent = async (studentId) => {
    const template = templates.find((t) => t.id === activeTemplateId);
    if (!template) return;
    setApplyingStudentId(studentId);

    const { data: newDiet, error } = await supabase
      .from('diets')
      .insert({
        student_id: studentId,
        personal_id: personalId,
        name: template.name,
        active: true,
        goal_kcal: template.goal_kcal,
        goal_protein_g: template.goal_protein_g,
        goal_carbs_g: template.goal_carbs_g,
        goal_fat_g: template.goal_fat_g,
      })
      .select()
      .single();

    if (error || !newDiet) {
      setApplyingStudentId(null);
      showAlert('Erro', error?.message || 'Não foi possível aplicar o modelo.');
      return;
    }

    for (const meal of meals) {
      const { data: newMeal } = await supabase
        .from('diet_meals')
        .insert({ diet_id: newDiet.id, name: meal.name, meal_time: meal.meal_time, order_index: meal.order_index })
        .select()
        .single();
      if (!newMeal) continue;

      const foods = meal.diet_template_meal_foods || [];
      if (foods.length > 0) {
        await supabase.from('diet_meal_foods').insert(
          foods.map((f) => ({
            meal_id: newMeal.id,
            food_name: f.food_name,
            quantity: f.quantity,
            calories_kcal: f.calories_kcal,
            protein_g: f.protein_g,
            carbs_g: f.carbs_g,
            fat_g: f.fat_g,
            order_index: f.order_index,
          }))
        );
      }
    }

    setApplyingStudentId(null);
    setShowApplyModal(false);
    const studentName = students.find((s) => s.id === studentId)?.name || 'aluno';
    showAlert('Aplicado!', `"${template.name}" foi criado como dieta ativa pra ${studentName}.`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack
        title="Modelos de Dieta"
        onBack={onClose}
        style={{ paddingHorizontal: 16 }}
        rightSlot={
          <TouchableOpacity onPress={() => setShowCreateModal(true)} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={22} color="#FF6B00" />
          </TouchableOpacity>
        }
      />

      {templates.length === 0 ? (
        <View style={styles.emptyStateBox}>
          <Ionicons name="restaurant-outline" size={36} color="#525252" />
          <Text style={styles.emptyStateTitle}>Nenhum modelo ainda</Text>
          <Text style={styles.emptyStateSubtitle}>Crie um plano alimentar reutilizável pra aplicar rápido em qualquer aluno.</Text>
          <TouchableOpacity style={styles.emptyStatePrimaryButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={18} color="#0F0F12" />
            <Text style={styles.emptyStatePrimaryButtonText}>Criar Modelo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 44, flexGrow: 0, marginBottom: 6, paddingLeft: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {templates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.templateTab, activeTemplateId === t.id && styles.templateTabActive]}
                  onPress={() => setActiveTemplateId(t.id)}
                  onLongPress={() => handleLongPressTemplate(t)}
                >
                  <Text style={[styles.templateTabText, activeTemplateId === t.id && styles.templateTabTextActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.hintText}>Segure um modelo pra renomear ou excluir</Text>

          {!activeTemplateId ? (
            <Text style={styles.emptyText}>Escolha um modelo acima.</Text>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
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
                    {savingGoals ? <ActivityIndicator color="#FF6B00" size="small" /> : <Text style={styles.metaSaveButtonText}>Salvar</Text>}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.applyButton} onPress={handleOpenApply}>
                <Ionicons name="person-add-outline" size={18} color="#0F0F12" />
                <Text style={styles.applyButtonText}>Aplicar a um Aluno</Text>
              </TouchableOpacity>

              <View style={styles.newMealRow}>
                <TextInput
                  style={styles.newMealInput}
                  placeholder="Nome da refeição (ex: Café da Manhã)"
                  placeholderTextColor="#737373"
                  value={newMealName}
                  onChangeText={setNewMealName}
                />
                <TouchableOpacity style={styles.addMealButton} onPress={handleAddMeal}>
                  <Text style={styles.addMealButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              {loadingMeals ? (
                <ActivityIndicator color="#FF6B00" style={{ marginTop: 10 }} />
              ) : meals.length === 0 ? (
                <Text style={styles.emptyText}>Adicione a primeira refeição acima.</Text>
              ) : (
                meals.map((meal) => (
                  <View key={meal.id} style={styles.mealCard}>
                    <TouchableOpacity style={styles.mealHeader} onLongPress={() => handleLongPressMeal(meal)}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <TouchableOpacity onPress={() => handleOpenAddFood(meal.id)} hitSlop={8}>
                        <Ionicons name="add-circle-outline" size={20} color="#FF6B00" />
                      </TouchableOpacity>
                    </TouchableOpacity>

                    {(meal.diet_template_meal_foods || []).length === 0 ? (
                      <Text style={styles.emptyFoodText}>Nenhum alimento ainda.</Text>
                    ) : (
                      meal.diet_template_meal_foods.map((f) => (
                        <TouchableOpacity key={f.id} style={styles.foodRow} onLongPress={() => handleDeleteFood(f)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.foodName}>{f.food_name}{f.quantity ? ` — ${f.quantity}` : ''}</Text>
                            {f.calories_kcal != null && (
                              <Text style={styles.foodMacros}>
                                {Math.round(f.calories_kcal)}kcal · P:{f.protein_g || 0}g · C:{f.carbs_g || 0}g · G:{f.fat_g || 0}g
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Criar Modelo de Dieta</Text>
            <Text style={styles.modalSubtitle}>Dá um nome pro modelo. Você adiciona as refeições depois.</Text>
            <TextInput
              style={styles.newMealInput}
              placeholder="ex: Cutting Padrão"
              placeholderTextColor="#737373"
              value={newTemplateName}
              onChangeText={setNewTemplateName}
            />
            <TouchableOpacity style={styles.saveMetaButton} onPress={handleCreateTemplate}>
              <Text style={styles.saveMetaButtonText}>Criar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!addingFoodFor} transparent animationType="slide" onRequestClose={() => setAddingFoodFor(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Adicionar Alimento</Text>
            <TextInput style={styles.newMealInput} placeholder="Nome do alimento" placeholderTextColor="#737373" value={foodName} onChangeText={setFoodName} />
            <TextInput style={[styles.newMealInput, { marginTop: 8 }]} placeholder="Quantidade (ex: 100g, 1 unidade)" placeholderTextColor="#737373" value={foodQuantity} onChangeText={setFoodQuantity} />
            <View style={styles.metaInputsRow}>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Kcal</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholderTextColor="#525252" value={foodKcal} onChangeText={setFoodKcal} />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Prot.</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholderTextColor="#525252" value={foodProtein} onChangeText={setFoodProtein} />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Carbo</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholderTextColor="#525252" value={foodCarbs} onChangeText={setFoodCarbs} />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaFieldLabel}>Gord.</Text>
                <TextInput style={styles.metaInput} keyboardType="number-pad" placeholderTextColor="#525252" value={foodFat} onChangeText={setFoodFat} />
              </View>
            </View>
            <TouchableOpacity style={styles.saveMetaButton} onPress={handleSaveFood} disabled={savingFood}>
              {savingFood ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.saveMetaButtonText}>Adicionar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAddingFoodFor(null)}>
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showApplyModal} transparent animationType="slide" onRequestClose={() => setShowApplyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Aplicar a um Aluno</Text>
            <Text style={styles.modalSubtitle}>Cria uma dieta ativa nova pro aluno com todas as refeições desse modelo. O modelo original não é alterado.</Text>
            {loadingStudents ? (
              <ActivityIndicator color="#FF6B00" style={{ marginVertical: 20 }} />
            ) : students.length === 0 ? (
              <Text style={styles.emptyText}>Você ainda não tem alunos.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {students.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.studentPickerRow} onPress={() => handleApplyToStudent(s.id)} disabled={applyingStudentId === s.id}>
                    <Text style={styles.studentPickerName}>{s.name}</Text>
                    {applyingStudentId === s.id ? <ActivityIndicator color="#FF6B00" size="small" /> : <Text style={styles.chevron}>›</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowApplyModal(false)}>
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PromptModal
        visible={!!renamingTemplate}
        title="Renomear modelo"
        subtitle="Digite o novo nome:"
        initialValue={renamingTemplate?.name}
        onCancel={() => setRenamingTemplate(null)}
        onSubmit={handleRenameTemplate}
      />

      <PromptModal
        visible={!!renamingMeal}
        title="Renomear refeição"
        subtitle="Digite o novo nome:"
        initialValue={renamingMeal?.name}
        onCancel={() => setRenamingMeal(null)}
        onSubmit={handleRenameMeal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  hintText: { color: '#525252', fontSize: 10, paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { color: '#737373', fontSize: 13, textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
  emptyStateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyStateTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyStateSubtitle: { color: '#737373', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 10 },
  emptyStatePrimaryButton: { flexDirection: 'row', gap: 8, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  emptyStatePrimaryButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  templateTab: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 18, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
  templateTabActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  templateTabText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  templateTabTextActive: { color: '#0F0F12' },
  bigCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 14 },
  bigCardTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaInputsRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginTop: 8 },
  metaField: { flex: 1 },
  metaFieldLabel: { color: '#525252', fontSize: 9, marginBottom: 4 },
  metaInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 8, color: '#F5F5F7', fontSize: 12, textAlign: 'center' },
  metaSaveButton: { paddingHorizontal: 10, paddingVertical: 9 },
  metaSaveButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },
  applyButton: { flexDirection: 'row', gap: 8, backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  applyButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  newMealRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  newMealInput: { flex: 1, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#F5F5F7', fontSize: 13 },
  addMealButton: { backgroundColor: '#FF6B00', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addMealButtonText: { color: '#0F0F12', fontSize: 20, fontWeight: '700' },
  mealCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 12, marginBottom: 12 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mealName: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  emptyFoodText: { color: '#525252', fontSize: 11 },
  foodRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#0F0F12' },
  foodName: { color: '#F5F5F7', fontSize: 12, fontWeight: '600' },
  foodMacros: { color: '#737373', fontSize: 10, marginTop: 2 },
  chevron: { color: '#525252', fontSize: 20, fontWeight: '300' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#F5F5F7', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 16, lineHeight: 17 },
  saveMetaButton: { backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveMetaButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '700' },
  modalCloseButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  studentPickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  studentPickerName: { color: '#F5F5F7', fontSize: 13, fontWeight: '600' },
});

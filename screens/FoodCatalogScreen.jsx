import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import BarcodeScannerScreen from './BarcodeScannerScreen';
import { showAlert } from './alertUtils';

const CATEGORY_CHIPS = [
  { value: 'todos', label: 'Todos' },
  { value: 'proteina', label: 'Proteína' },
  { value: 'carboidrato', label: 'Carboidrato' },
  { value: 'cereal', label: 'Cereal' },
  { value: 'leguminosa', label: 'Leguminosa' },
  { value: 'vegetal', label: 'Vegetal' },
  { value: 'fruta', label: 'Fruta' },
  { value: 'laticinio', label: 'Laticínio' },
  { value: 'bebida', label: 'Bebidas' },
  { value: 'refrigerante', label: 'Refrigerantes' },
  { value: 'doce', label: 'Doces' },
  { value: 'gordura', label: 'Gordura' },
  { value: 'suplemento', label: 'Suplemento' },
  { value: 'escaneado', label: 'Escaneados' },
];

const STOPWORDS = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'com', 'sem'];

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(foodName, query) {
  const normName = normalize(foodName);
  const tokens = normalize(query).split(/\s+/).filter((t) => t && !STOPWORDS.includes(t));
  if (tokens.length === 0) return true;
  return tokens.every((t) => normName.includes(t));
}

export default function FoodCatalogScreen({ onAddFood, onClose, recentForStudentId }) {
  const [allFoods, setAllFoods] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [quantityInput, setQuantityInput] = useState('100');
  const [adding, setAdding] = useState(false);
  const [addedIds, setAddedIds] = useState({});
  const [showScanner, setShowScanner] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodKcal, setNewFoodKcal] = useState('');
  const [newFoodProtein, setNewFoodProtein] = useState('');
  const [newFoodCarbs, setNewFoodCarbs] = useState('');
  const [newFoodFat, setNewFoodFat] = useState('');
  const [savingNewFood, setSavingNewFood] = useState(false);

  const loadFoods = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('foods').select('*').order('name');
    if (error) {
      showAlert('Erro ao carregar alimentos', error.message);
    }
    setAllFoods(data || []);
    setLoading(false);
    return data || [];
  };

  const loadRecentFoods = async (foodsList) => {
    if (!recentForStudentId) return;
    const { data } = await supabase
      .from('food_diary_entries')
      .select('food_id, created_at')
      .eq('student_id', recentForStudentId)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    const seen = new Set();
    const recentIds = [];
    (data || []).forEach((row) => {
      if (!seen.has(row.food_id)) {
        seen.add(row.food_id);
        recentIds.push(row.food_id);
      }
    });

    const matched = recentIds
      .slice(0, 8)
      .map((id) => foodsList.find((f) => f.id === id))
      .filter(Boolean);
    setRecentFoods(matched);
  };

  useEffect(() => {
    (async () => {
      const foodsList = await loadFoods();
      await loadRecentFoods(foodsList);
    })();
  }, []);

  const isSearching = search.trim().length > 0;

  const filtered = allFoods.filter((f) => {
    if (!isSearching && categoryFilter !== 'todos' && f.category !== categoryFilter) return false;
    if (isSearching && !matchesSearch(f.name, search)) return false;
    return true;
  });

  const handleToggleExpand = (food) => {
    if (expandedId === food.id) {
      setExpandedId(null);
    } else {
      setExpandedId(food.id);
      setQuantityInput('100');
    }
  };

  const computePreview = (food) => {
    const g = Number(quantityInput) || 0;
    const factor = g / 100;
    return {
      kcal: Math.round(food.kcal_per_100g * factor),
      protein: (food.protein_g_per_100g * factor).toFixed(1),
      carbs: (food.carbs_g_per_100g * factor).toFixed(1),
      fat: (food.fat_g_per_100g * factor).toFixed(1),
    };
  };

  const handleConfirmAdd = async (food) => {
    const g = Number(quantityInput);
    if (!g || g <= 0) return;
    setAdding(true);
    const preview = computePreview(food);
    await onAddFood({
      food_id: food.id,
      food_name: food.name,
      quantity_g: g,
      calories_kcal: preview.kcal,
      protein_g: Number(preview.protein),
      carbs_g: Number(preview.carbs),
      fat_g: Number(preview.fat),
    });
    setAdding(false);
    setExpandedId(null);
    setAddedIds((prev) => ({ ...prev, [food.id]: true }));
    setTimeout(() => setAddedIds((prev) => ({ ...prev, [food.id]: false })), 2000);
  };

  const handleFoodFoundFromBarcode = async (scannedData) => {
    setShowScanner(false);

    const existing = allFoods.find((f) => f.barcode === scannedData.barcode);
    if (existing) {
      handleToggleExpand(existing);
      return;
    }

    const { data: newFood, error } = await supabase
      .from('foods')
      .insert({
        name: scannedData.name,
        category: 'escaneado_novo',
        barcode: scannedData.barcode,
        kcal_per_100g: scannedData.kcal,
        protein_g_per_100g: scannedData.protein,
        carbs_g_per_100g: scannedData.carbs,
        fat_g_per_100g: scannedData.fat,
      })
      .select()
      .single();

    if (error) {
      showAlert('Erro ao salvar produto', error.message);
      return;
    }

    await loadFoods();
    setExpandedId(newFood.id);
    setQuantityInput('100');
    setCategoryFilter('escaneado');
  };

  const handleOpenCreateForm = () => {
    setNewFoodName(search.trim());
    setNewFoodKcal('');
    setNewFoodProtein('');
    setNewFoodCarbs('');
    setNewFoodFat('');
    setShowCreateForm(true);
  };

  const handleSaveNewFood = async () => {
    if (!newFoodName.trim() || !newFoodKcal.trim()) {
      showAlert('Ops', 'Preenche pelo menos o nome e as calorias.');
      return;
    }
    setSavingNewFood(true);
    const { data: newFood, error } = await supabase
      .from('foods')
      .insert({
        name: newFoodName.trim(),
        category: 'personalizado',
        kcal_per_100g: Number(newFoodKcal),
        protein_g_per_100g: newFoodProtein ? Number(newFoodProtein) : 0,
        carbs_g_per_100g: newFoodCarbs ? Number(newFoodCarbs) : 0,
        fat_g_per_100g: newFoodFat ? Number(newFoodFat) : 0,
      })
      .select()
      .single();
    setSavingNewFood(false);
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    await loadFoods();
    setShowCreateForm(false);
    setSearch('');
    setExpandedId(newFood.id);
    setQuantityInput('100');
  };

  if (showScanner) {
    return (
      <BarcodeScannerScreen
        onFoodFound={handleFoodFoundFromBarcode}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  const renderFoodCard = (item) => {
    const isExpanded = expandedId === item.id;
    const justAdded = addedIds[item.id];
    const preview = isExpanded ? computePreview(item) : null;
    return (
      <View key={item.id} style={styles.foodCard}>
        <TouchableOpacity style={styles.foodRow} onPress={() => handleToggleExpand(item)}>
          <View style={{ flex: 1 }}>
            <View style={styles.foodNameRow}>
              <Text style={styles.foodName}>{item.name}</Text>
              {item.barcode ? <Text style={styles.barcodeTag}>📷</Text> : null}
            </View>
            <Text style={styles.foodMeta}>{Math.round(item.kcal_per_100g)}kcal / 100g</Text>
          </View>
          <Text style={styles.expandIcon}>{justAdded ? '✓' : isExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandBox}>
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Quantidade (g)</Text>
              <TextInput
                style={styles.quantityInput}
                keyboardType="number-pad"
                value={quantityInput}
                onChangeText={setQuantityInput}
              />
            </View>
            {preview && (
              <View style={styles.previewRow}>
                <Text style={styles.previewBadge}>{preview.kcal}kcal</Text>
                <Text style={styles.previewBadge}>P: {preview.protein}g</Text>
                <Text style={styles.previewBadge}>C: {preview.carbs}g</Text>
                <Text style={styles.previewBadge}>G: {preview.fat}g</Text>
              </View>
            )}
            <TouchableOpacity style={styles.confirmButton} onPress={() => handleConfirmAdd(item)} disabled={adding}>
              {adding ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.confirmButtonText}>Adicionar à refeição</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Catálogo de Alimentos</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Concluir</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>Valores de referência por 100g, não substituem laudo nutricional oficial.</Text>

      <TouchableOpacity style={styles.scanButton} onPress={() => setShowScanner(true)}>
        <Text style={styles.scanButtonText}>📷 Escanear código de barras</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar alimento..."
        placeholderTextColor="#525252"
        value={search}
        onChangeText={setSearch}
      />

      {!isSearching && (
        <View style={styles.chipScrollWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORY_CHIPS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.chip, categoryFilter === item.value && styles.chipActive]}
                onPress={() => setCategoryFilter(item.value)}
              >
                <Text style={[styles.chipText, categoryFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {showCreateForm ? (
        <View style={styles.createFormCard}>
          <Text style={styles.createFormTitle}>Criar alimento personalizado</Text>
          <Text style={styles.createLabel}>Nome *</Text>
          <TextInput style={styles.createInput} placeholder="ex: Vitamina caseira" placeholderTextColor="#525252" value={newFoodName} onChangeText={setNewFoodName} />
          <View style={styles.createRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.createLabel}>Kcal / 100g *</Text>
              <TextInput style={styles.createInput} keyboardType="decimal-pad" placeholder="150" placeholderTextColor="#525252" value={newFoodKcal} onChangeText={setNewFoodKcal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createLabel}>Proteína (g)</Text>
              <TextInput style={styles.createInput} keyboardType="decimal-pad" placeholder="5" placeholderTextColor="#525252" value={newFoodProtein} onChangeText={setNewFoodProtein} />
            </View>
          </View>
          <View style={styles.createRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.createLabel}>Carbo (g)</Text>
              <TextInput style={styles.createInput} keyboardType="decimal-pad" placeholder="20" placeholderTextColor="#525252" value={newFoodCarbs} onChangeText={setNewFoodCarbs} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createLabel}>Gordura (g)</Text>
              <TextInput style={styles.createInput} keyboardType="decimal-pad" placeholder="3" placeholderTextColor="#525252" value={newFoodFat} onChangeText={setNewFoodFat} />
            </View>
          </View>
          <View style={styles.createButtonRow}>
            <TouchableOpacity style={styles.createCancelButton} onPress={() => setShowCreateForm(false)}>
              <Text style={styles.createCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createSaveButton} onPress={handleSaveNewFood} disabled={savingNewFood}>
              {savingNewFood ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.createSaveButtonText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, marginTop: 8 }}
          ListHeaderComponent={
            !isSearching && categoryFilter === 'todos' && recentFoods.length > 0 ? (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recentes</Text>
                {recentFoods.map((item) => renderFoodCard(item))}
                <Text style={styles.recentDivider}>Todos os alimentos</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Text style={styles.emptyText}>Nenhum alimento encontrado.</Text>
              <TouchableOpacity style={styles.createEmptyButton} onPress={handleOpenCreateForm}>
                <Text style={styles.createEmptyButtonText}>+ Criar alimento personalizado</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => renderFoodCard(item)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  backText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  closeButton: { backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  closeButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  disclaimer: { color: '#525252', fontSize: 10, marginBottom: 10 },
  scanButton: { backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 10 },
  scanButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  searchInput: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, marginBottom: 8 },
  chipScrollWrap: { height: 28, marginBottom: 6 },
  chip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4, marginRight: 5, height: 24, justifyContent: 'center' },
  chipActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  chipText: { color: '#a3a3a3', fontSize: 10, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center' },
  createEmptyButton: { borderWidth: 1, borderColor: '#22c55e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginTop: 12 },
  createEmptyButtonText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  createFormCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 14, marginTop: 8 },
  createFormTitle: { color: '#22c55e', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  createLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  createInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  createRow: { flexDirection: 'row', gap: 8 },
  createButtonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  createCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  createCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  createSaveButton: { flex: 1, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  createSaveButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  recentSection: { marginBottom: 4 },
  recentTitle: { color: '#f97316', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  recentDivider: { color: '#525252', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
  foodCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  foodRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  foodNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foodName: { color: '#f5f5f5', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  barcodeTag: { fontSize: 11 },
  foodMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  expandIcon: { color: '#22c55e', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  expandBox: { backgroundColor: '#0a0a0a', padding: 12, borderTopWidth: 1, borderTopColor: '#171717' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  quantityLabel: { color: '#a3a3a3', fontSize: 12 },
  quantityInput: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  previewBadge: { backgroundColor: '#171717', color: '#22c55e', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  confirmButton: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  confirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
});
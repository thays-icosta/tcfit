import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const CATEGORIES = [
  { value: 'cafe_da_manha', label: 'Café da Manhã' },
  { value: 'almoco_jantar', label: 'Almoço/Jantar' },
  { value: 'doces_fit', label: 'Doces Fit' },
  { value: 'lanches_rapidos', label: 'Lanches Rápidos' },
];

export default function RecipeManagerScreen({ personalId, onClose }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [title, setTitle] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [category, setCategory] = useState('cafe_da_manha');
  const [prepTime, setPrepTime] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const loadRecipes = async () => {
    const { data } = await supabase.from('recipes').select('*').eq('personal_id', personalId).order('created_at', { ascending: false });
    setRecipes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setPhotoUrl(null);
    setCategory('cafe_da_manha');
    setPrepTime('');
    setIngredients('');
    setInstructions('');
    setKcal('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (recipe) => {
    setEditingId(recipe.id);
    setTitle(recipe.title || '');
    setPhotoUrl(recipe.photo_url || null);
    setCategory(recipe.category || 'cafe_da_manha');
    setPrepTime(recipe.prep_time_minutes ? String(recipe.prep_time_minutes) : '');
    setIngredients(recipe.ingredients || '');
    setInstructions(recipe.instructions || '');
    setKcal(recipe.calories_kcal ? String(recipe.calories_kcal) : '');
    setProtein(recipe.protein_g ? String(recipe.protein_g) : '');
    setCarbs(recipe.carbs_g ? String(recipe.carbs_g) : '');
    setFat(recipe.fat_g ? String(recipe.fat_g) : '');
    setShowForm(true);
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setUploadingPhoto(true);
    try {
      const fileName = `${uuidv4()}.jpg`;
      const { error } = await supabase.storage.from('recipes').upload(fileName, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
      if (error) throw error;

      const { data } = supabase.storage.from('recipes').getPublicUrl(fileName);
      setPhotoUrl(data.publicUrl);
    } catch {
      setPhotoUrl(null);
      Alert.alert('Não deu pra enviar a foto', 'Sem problema, você pode salvar a receita sem foto e adicionar depois.');
    }
    setUploadingPhoto(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Ops', 'Digita o título da receita.');
      return;
    }
    setSaving(true);
    const payload = {
      personal_id: personalId,
      title: title.trim(),
      photo_url: photoUrl,
      category,
      prep_time_minutes: prepTime ? Number(prepTime) : null,
      ingredients: ingredients.trim(),
      instructions: instructions.trim(),
      calories_kcal: kcal ? Number(kcal) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('recipes').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('recipes').insert(payload));
    }

    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setShowForm(false);
      resetForm();
      loadRecipes();
    }
  };

  const handleDelete = (recipeId) => {
    Alert.alert('Excluir receita', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('recipes').delete().eq('id', recipeId);
          loadRecipes();
        },
      },
    ]);
  };

  if (showForm) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.closeText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Editar Receita' : 'Nova Receita'}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator color="#f97316" />
            ) : photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
            ) : (
              <Text style={styles.photoPickerText}>📷 Adicionar foto</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Título</Text>
          <TextInput style={styles.input} placeholder="ex: Panqueca de Banana Fit" placeholderTextColor="#525252" value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c.value} style={[styles.categoryChip, category === c.value && styles.categoryChipActive]} onPress={() => setCategory(c.value)}>
                <Text style={[styles.categoryChipText, category === c.value && styles.categoryChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Tempo de preparo (minutos)</Text>
          <TextInput style={styles.input} keyboardType="number-pad" placeholder="15" placeholderTextColor="#525252" value={prepTime} onChangeText={setPrepTime} />

          <Text style={styles.label}>Ingredientes</Text>
          <TextInput style={styles.textArea} multiline placeholder="Liste os ingredientes, um por linha" placeholderTextColor="#525252" value={ingredients} onChangeText={setIngredients} />

          <Text style={styles.label}>Modo de preparo</Text>
          <TextInput style={styles.textArea} multiline placeholder="Descreva o passo a passo" placeholderTextColor="#525252" value={instructions} onChangeText={setInstructions} />

          <Text style={styles.label}>Macronutrientes (porção)</Text>
          <View style={styles.macroFormRow}>
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" placeholder="kcal" placeholderTextColor="#525252" value={kcal} onChangeText={setKcal} />
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" placeholder="prot(g)" placeholderTextColor="#525252" value={protein} onChangeText={setProtein} />
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" placeholder="carbo(g)" placeholderTextColor="#525252" value={carbs} onChangeText={setCarbs} />
            <TextInput style={[styles.input, { flex: 1 }]} keyboardType="decimal-pad" placeholder="gord(g)" placeholderTextColor="#525252" value={fat} onChangeText={setFat} />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Receita</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Receitas</Text>
      </View>

      <TouchableOpacity style={styles.newButton} onPress={handleOpenNew}>
        <Text style={styles.newButtonText}>+ Nova Receita</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {recipes.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma receita cadastrada ainda.</Text>
          ) : (
            recipes.map((r) => (
              <View key={r.id} style={styles.recipeRow}>
                {r.photo_url ? <Image source={{ uri: r.photo_url }} style={styles.recipeThumb} /> : <View style={styles.recipeThumbPlaceholder} />}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.recipeTitle}>{r.title}</Text>
                  <Text style={styles.recipeMeta}>{CATEGORIES.find((c) => c.value === r.category)?.label || r.category}</Text>
                </View>
                <TouchableOpacity onPress={() => handleOpenEdit(r)}>
                  <Text style={styles.editLink}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(r.id)}>
                  <Text style={styles.deleteLink}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  newButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  newButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 10, marginBottom: 10 },
  recipeThumb: { width: 48, height: 48, borderRadius: 10 },
  recipeThumbPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#0a0a0a' },
  recipeTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  recipeMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  editLink: { color: '#3b82f6', fontSize: 11, fontWeight: '700', marginRight: 12 },
  deleteLink: { fontSize: 14 },
  photoPicker: { height: 140, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPickerText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  textArea: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  categoryChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  categoryChipTextActive: { color: '#0a0a0a' },
  macroFormRow: { flexDirection: 'row', gap: 6 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
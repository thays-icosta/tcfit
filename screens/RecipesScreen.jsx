import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import RecipeDetailScreen from './RecipeDetailScreen';

const WHATSAPP_NUMBER = '5537998231382';

const CATEGORIES = [
  { value: 'todas', label: 'Todas' },
  { value: 'cafe_da_manha', label: 'Café da Manhã' },
  { value: 'almoco_jantar', label: 'Almoço/Jantar' },
  { value: 'doces_fit', label: 'Doces Fit' },
  { value: 'lanches_rapidos', label: 'Lanches Rápidos' },
];

export default function RecipesScreen({ studentId, hasFullAccess, onClose }) {
  const [recipes, setRecipes] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
      setRecipes(data || []);

      if (studentId) {
        const { data: grantRows } = await supabase
          .from('product_grants')
          .select('products (recipe_ids)')
          .eq('student_id', studentId);
        const ids = new Set();
        (grantRows || []).forEach((g) => (g.products?.recipe_ids || []).forEach((id) => ids.add(id)));
        setUnlockedIds(ids);
      }

      setLoading(false);
    })();
  }, [studentId]);

  const filtered = categoryFilter === 'todas' ? recipes : recipes.filter((r) => r.category === categoryFilter);
  const hasAccessTo = (recipe) => hasFullAccess || unlockedIds.has(recipe.id);

  const handleWantGuide = () => {
    const message = 'Olá! Vi o Guia de Receitas Fitness no app e gostaria de saber como ter acesso completo.';
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
  };

  if (selectedRecipe) {
    return (
      <RecipeDetailScreen
        recipe={selectedRecipe}
        studentId={hasAccessTo(selectedRecipe) ? studentId : null}
        onClose={() => setSelectedRecipe(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Guia de Receitas Fitness</Text>
      </View>

      {!hasFullAccess && unlockedIds.size === 0 && (
        <TouchableOpacity style={styles.premiumBanner} onPress={handleWantGuide}>
          <Ionicons name="lock-closed-outline" size={16} color="#eab308" />
          <Text style={styles.premiumBannerText}>Conteúdo Premium — toque pra desbloquear o guia completo</Text>
        </TouchableOpacity>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.categoryChip, categoryFilter === c.value && styles.categoryChipActive]}
            onPress={() => setCategoryFilter(c.value)}
          >
            <Text style={[styles.categoryChipText, categoryFilter === c.value && styles.categoryChipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma receita nessa categoria ainda.</Text>
          ) : (
            filtered.map((recipe) => {
              const unlocked = hasAccessTo(recipe);
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recipeCard}
                  onPress={() => unlocked ? setSelectedRecipe(recipe) : handleWantGuide()}
                >
                  {recipe.photo_url ? (
                    <Image source={{ uri: recipe.photo_url }} style={styles.recipeThumb} />
                  ) : (
                    <View style={styles.recipeThumbPlaceholder}>
                      <Text style={{ fontSize: 20 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                    <Text style={styles.recipeMeta}>
                      {recipe.prep_time_minutes != null ? `${recipe.prep_time_minutes}min · ` : ''}{Math.round(recipe.calories_kcal || 0)}kcal
                    </Text>
                  </View>
                  {!unlocked && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed-outline" size={14} color="#eab308" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
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
  premiumBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(234,179,8,0.1)', borderWidth: 1, borderColor: '#eab308', borderRadius: 10, padding: 12, marginHorizontal: 16, marginBottom: 12 },
  premiumBannerText: { color: '#eab308', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  categoryScroll: { maxHeight: 40, marginBottom: 12, paddingHorizontal: 16 },
  categoryChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  categoryChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  categoryChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#0a0a0a' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  recipeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 10, marginBottom: 10 },
  recipeThumb: { width: 56, height: 56, borderRadius: 10 },
  recipeThumbPlaceholder: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  recipeTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  recipeMeta: { color: '#737373', fontSize: 11, marginTop: 3 },
  lockBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(234,179,8,0.12)', alignItems: 'center', justifyContent: 'center' },
});
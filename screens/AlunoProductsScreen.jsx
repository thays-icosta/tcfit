import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Linking, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import RecipeDetailScreen from './RecipeDetailScreen';

const WHATSAPP_NUMBER = '5537998231382';

function hasAccessByLevel(myLevel, requiredLevel) {
  if (!requiredLevel) return false;
  if (requiredLevel === 'plataforma_base') return true;
  return myLevel === 'consultoria_vip';
}

export default function AlunoProductsScreen({ studentId, personalId, onClose }) {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [addedWorkoutProductIds, setAddedWorkoutProductIds] = useState(new Set());
  const [unlockedProductIds, setUnlockedProductIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [addingWorkout, setAddingWorkout] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: myRow }, { data: productRows }, { data: grantRows }, { data: existingWorkouts }] = await Promise.all([
        supabase.from('users').select('access_level').eq('id', studentId).single(),
        personalId
          ? supabase.from('products').select('*').eq('personal_id', personalId).eq('active', true).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('product_grants').select('product_id').eq('student_id', studentId),
        supabase.from('workouts').select('product_id').eq('student_id', studentId).not('product_id', 'is', null),
      ]);

      const level = myRow?.access_level || 'plataforma_base';
      setProducts(productRows || []);
      setAddedWorkoutProductIds(new Set((existingWorkouts || []).map((w) => w.product_id)));

      const grantedIds = new Set((grantRows || []).map((g) => g.product_id));
      const unlocked = new Set();
      (productRows || []).forEach((p) => {
        if (grantedIds.has(p.id) || hasAccessByLevel(level, p.required_access_level)) unlocked.add(p.id);
      });
      setUnlockedProductIds(unlocked);

      if (personalId) {
        const [{ data: recipeRows }, { data: templateRows }] = await Promise.all([
          supabase.from('recipes').select('id, title').eq('personal_id', personalId),
          supabase.from('workout_templates').select('id, name').eq('personal_id', personalId),
        ]);
        setRecipes(recipeRows || []);
        setTemplates(templateRows || []);
      }

      setLoading(false);
    })();
  }, [studentId, personalId]);

  const handleUnlockRequest = (product) => {
    const message = `Olá! Vi o conteúdo "${product.name}" no app e quero desbloquear.`;
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const handleAddWorkoutFromTemplate = async (product) => {
    if (!product.template_id || addedWorkoutProductIds.has(product.id)) return;
    setAddingWorkout(true);
    try {
      const { data: templateItems } = await supabase
        .from('workout_template_exercises')
        .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
        .eq('template_id', product.template_id);

      const templateName = templates.find((t) => t.id === product.template_id)?.name || product.name;
      const { data: newWorkout, error } = await supabase
        .from('workouts')
        .insert({ student_id: studentId, personal_id: personalId, name: templateName, active: true, product_id: product.id })
        .select()
        .single();

      if (error || !newWorkout) throw error || new Error('no workout');

      if (templateItems && templateItems.length > 0) {
        const copies = templateItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
        await supabase.from('workout_exercises').insert(copies);
      }

      setAddedWorkoutProductIds((prev) => new Set(prev).add(product.id));
      showAlert('Ficha adicionada!', 'Confira na aba de Treinos.');
    } catch {
      showAlert('Ops', 'Não deu pra adicionar a ficha agora. Tenta de novo.');
    }
    setAddingWorkout(false);
  };

  if (selectedRecipe) {
    return <RecipeDetailScreen recipe={selectedRecipe} studentId={studentId} onClose={() => setSelectedRecipe(null)} />;
  }

  const linkedRecipes = selectedProduct ? recipes.filter((r) => (selectedProduct.recipe_ids || []).includes(r.id)) : [];
  const selectedUnlocked = selectedProduct ? unlockedProductIds.has(selectedProduct.id) : false;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Conteúdos e Produtos</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {products.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum conteúdo disponível ainda.</Text>
          ) : (
            <View style={styles.grid}>
              {products.map((p) => {
                const unlocked = unlockedProductIds.has(p.id);
                return (
                  <TouchableOpacity key={p.id} style={styles.card} onPress={() => setSelectedProduct(p)}>
                    <View style={styles.coverWrap}>
                      {p.cover_image_url ? (
                        <Image source={{ uri: p.cover_image_url }} style={styles.coverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.coverPlaceholder}>
                          <Ionicons name={p.type === 'treino_template' ? 'barbell-outline' : 'pricetag-outline'} size={26} color="#f97316" />
                        </View>
                      )}
                      {!unlocked && (
                        <View style={styles.lockOverlay}>
                          <Ionicons name="lock-closed" size={20} color="#f5f5f5" />
                        </View>
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                      <Text style={styles.cardPrice}>{p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : 'Consulte'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={!!selectedProduct} transparent animationType="slide" onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView>
              {selectedProduct?.cover_image_url ? (
                <Image source={{ uri: selectedProduct.cover_image_url }} style={styles.modalCover} resizeMode="cover" />
              ) : null}
              <Text style={styles.modalTitle}>{selectedProduct?.name}</Text>
              {selectedProduct?.description ? <Text style={styles.modalDescription}>{selectedProduct.description}</Text> : null}
              <Text style={styles.modalPrice}>{selectedProduct?.price != null ? `R$ ${Number(selectedProduct.price).toFixed(2)}` : 'Consulte'}</Text>

              {selectedUnlocked ? (
                <>
                  {selectedProduct?.type === 'treino_template' ? (
                    <>
                      <Text style={styles.modalSectionLabel}>O que está incluso</Text>
                      <View style={styles.includedRow}>
                        <Ionicons name="barbell-outline" size={16} color="#f97316" />
                        <Text style={styles.includedRowText}>
                          {templates.find((t) => t.id === selectedProduct.template_id)?.name || selectedProduct.name}
                        </Text>
                      </View>
                      {addedWorkoutProductIds.has(selectedProduct.id) ? (
                        <View style={styles.addedBox}>
                          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                          <Text style={styles.addedBoxText}>Ficha já está na sua aba de Treinos</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.unlockButton}
                          onPress={() => handleAddWorkoutFromTemplate(selectedProduct)}
                          disabled={addingWorkout}
                        >
                          {addingWorkout ? (
                            <ActivityIndicator color="#0a0a0a" />
                          ) : (
                            <Text style={styles.unlockButtonText}>🏋️ Adicionar Ficha aos Meus Treinos</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      {linkedRecipes.length > 0 && (
                        <>
                          <Text style={styles.modalSectionLabel}>O que está incluso</Text>
                          {linkedRecipes.map((r) => (
                            <TouchableOpacity key={r.id} style={styles.includedRow} onPress={() => setSelectedRecipe(r)}>
                              <Ionicons name="restaurant-outline" size={16} color="#f97316" />
                              <Text style={styles.includedRowText}>{r.title}</Text>
                              <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                      {selectedProduct?.delivery_type === 'arquivo' && selectedProduct?.delivery_value && (
                        <>
                          {Platform.OS === 'web' && selectedProduct.delivery_value.toLowerCase().includes('.pdf') && (
                            <iframe
                              src={selectedProduct.delivery_value}
                              style={{ width: '100%', height: 340, border: 'none', borderRadius: 12, marginBottom: 10, background: '#0a0a0a' }}
                              title="Pré-visualização do PDF"
                            />
                          )}
                          <TouchableOpacity
                            style={styles.unlockButton}
                            onPress={() => Linking.openURL(selectedProduct.delivery_value).catch(() => {})}
                          >
                            <Text style={styles.unlockButtonText}>
                              {selectedProduct.delivery_value.toLowerCase().includes('.pdf') ? '📄 Abrir E-book em PDF' : '📥 Abrir Arquivo'}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {selectedProduct?.delivery_type === 'chave' && selectedProduct?.delivery_value && (
                        <View style={styles.keyBox}>
                          <Text style={styles.keyBoxLabel}>Chave de liberação</Text>
                          <Text style={styles.keyBoxValue}>{selectedProduct.delivery_value}</Text>
                        </View>
                      )}
                    </>
                  )}
                </>
              ) : (
                <TouchableOpacity style={styles.unlockButton} onPress={() => handleUnlockRequest(selectedProduct)}>
                  <Ionicons name="lock-open-outline" size={16} color="#0a0a0a" />
                  <Text style={styles.unlockButtonText}>Desbloquear Conteúdo / Assinar Plano</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedProduct(null)}>
                <Text style={styles.modalCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, overflow: 'hidden' },
  coverWrap: { width: '100%', height: 100, backgroundColor: '#0a0a0a', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { padding: 10 },
  cardName: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', minHeight: 32 },
  cardPrice: { color: '#f97316', fontSize: 15, fontWeight: '800', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalCover: { width: '100%', height: 160, borderRadius: 12, marginBottom: 14, backgroundColor: '#0a0a0a' },
  modalTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalDescription: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  modalPrice: { color: '#f97316', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalSectionLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8 },
  includedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0a0a0a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  includedRowText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flex: 1 },
  chevron: { color: '#525252', fontSize: 18 },
  unlockButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  unlockButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  addedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginTop: 8 },
  addedBoxText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  keyBox: { backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14, marginTop: 8 },
  keyBoxLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  keyBoxValue: { color: '#22c55e', fontSize: 15, fontWeight: '800', fontFamily: 'Courier' },
  modalCloseButton: { paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import RecipeDetailScreen from './RecipeDetailScreen';
import ProgramDetailScreen from './ProgramDetailScreen';
import ProductDetailModal from './ProductDetailModal';
import { hasAccessByLevel } from './accessLevel';
import { HeaderBack } from './Header';

const WHATSAPP_NUMBER = '5537998231382';

export default function AlunoProductsScreen({ studentId, personalId, onClose }) {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [unlockedProductIds, setUnlockedProductIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [openProgram, setOpenProgram] = useState(null);
  const [studentAccessLevel, setStudentAccessLevel] = useState('plataforma_base');
  const [personalName, setPersonalName] = useState(null);
  const [personalPhone, setPersonalPhone] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: myRow }, { data: productRows }, { data: grantRows }, { data: personalRow }] = await Promise.all([
        supabase.from('users').select('access_level').eq('id', studentId).single(),
        personalId
          ? supabase.from('products').select('*').eq('personal_id', personalId).eq('active', true).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('product_grants').select('product_id').eq('student_id', studentId),
        personalId
          ? supabase.from('users').select('name, phone').eq('id', personalId).single()
          : Promise.resolve({ data: null }),
      ]);

      const level = myRow?.access_level || 'plataforma_base';
      setStudentAccessLevel(level);
      setPersonalName(personalRow?.name || null);
      setPersonalPhone(personalRow?.phone || null);
      setProducts(productRows || []);

      const grantedIds = new Set((grantRows || []).map((g) => g.product_id));
      const unlocked = new Set();
      (productRows || []).forEach((p) => {
        if (grantedIds.has(p.id) || hasAccessByLevel(level, p.required_access_level)) unlocked.add(p.id);
      });
      setUnlockedProductIds(unlocked);

      if (personalId) {
        const { data: recipeRows } = await supabase.from('recipes').select('id, title').eq('personal_id', personalId);
        setRecipes(recipeRows || []);
      }

      setLoading(false);
    })();
  }, [studentId, personalId]);

  const handleUpsellConsultoria = () => {
    const phone = (personalPhone || WHATSAPP_NUMBER).replace(/\D/g, '') || WHATSAPP_NUMBER;
    const message = `Olá${personalName ? `, ${personalName}` : ''}! Vi no app e quero saber mais sobre a consultoria individual com acompanhamento exclusivo.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  if (selectedRecipe) {
    return <RecipeDetailScreen recipe={selectedRecipe} studentId={studentId} onClose={() => setSelectedRecipe(null)} />;
  }

  if (openProgram) {
    return (
      <ProgramDetailScreen
        product={openProgram}
        studentId={studentId}
        personalId={personalId}
        unlocked={unlockedProductIds.has(openProgram.id)}
        onClose={() => setOpenProgram(null)}
      />
    );
  }

  const selectedUnlocked = selectedProduct ? unlockedProductIds.has(selectedProduct.id) : false;

  return (
    <View style={styles.container}>
      <HeaderBack title="Conteúdos e Produtos" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      {!loading && studentAccessLevel !== 'consultoria_vip' && (
        <View style={styles.upsellCard}>
          <Text style={styles.upsellTitle}>Quer um acompanhamento 100% individual?</Text>
          <Text style={styles.upsellText}>
            {personalName ? `${personalName} pode montar` : 'Seu personal pode montar'} sua ficha de treino do zero, sob medida pras suas necessidades específicas.
          </Text>
          <TouchableOpacity style={styles.upsellButton} onPress={handleUpsellConsultoria}>
            <Ionicons name="logo-whatsapp" size={16} color="#0a0a0a" />
            <Text style={styles.upsellButtonText}>Quero Consultoria Individual</Text>
          </TouchableOpacity>
        </View>
      )}

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
                  <TouchableOpacity
                    key={p.id}
                    style={styles.card}
                    onPress={() => (p.type === 'treino_template' ? setOpenProgram(p) : setSelectedProduct(p))}
                  >
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

      <ProductDetailModal
        product={selectedProduct}
        unlocked={selectedUnlocked}
        recipes={recipes}
        onSelectRecipe={setSelectedRecipe}
        onClose={() => setSelectedProduct(null)}
        personalName={personalName}
        personalPhone={personalPhone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  upsellCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 16 },
  upsellTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  upsellText: { color: '#a3a3a3', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  upsellButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  upsellButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, overflow: 'hidden' },
  coverWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#0a0a0a', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { padding: 10 },
  cardName: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', minHeight: 32 },
  cardPrice: { color: '#f97316', fontSize: 15, fontWeight: '800', marginTop: 6 },
});

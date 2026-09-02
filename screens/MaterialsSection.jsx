import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { NUTRITION_TAGS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, SUPPORT_TEXT, CARD_DESCRIPTION, GRID_GAP } from './vitrineStyles';

const MATERIAL_TYPE_META = {
  plano_alimentar: { badge: 'PLANOS ALIMENTARES', icon: 'restaurant-outline' },
  ebook_receita: { badge: 'E-BOOKS DE RECEITA', icon: 'book-outline' },
};

export default function MaterialsSection({ onSelectMaterial, isDesktop }) {
  const [materialsData, setMaterialsData] = useState([]);
  const [activeTags, setActiveTags] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, description, cover_image_url, delivery_value, material_type, nutrition_tags, active')
        .eq('active', true)
        .not('material_type', 'is', null)
        .order('created_at', { ascending: false });

      const normalized = (data || []).map((p) => ({
        id: p.id,
        category: p.material_type,
        title: p.name,
        description: p.description,
        nutritionTags: p.nutrition_tags || [],
        coverImage: p.cover_image_url,
        fileUrl: p.delivery_value,
        active: p.active,
      }));
      setMaterialsData(normalized);
    })();
  }, []);

  const toggleTag = (value) => {
    setActiveTags((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  };

  const visibleItems = activeTags.length === 0
    ? materialsData
    : materialsData.filter((m) => activeTags.every((t) => m.nutritionTags.includes(t)));

  if (materialsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>PLANOS ALIMENTARES E E-BOOKS DE RECEITA</Text>
      <Text style={styles.sectionSupport}>
        Planos alimentares e e-books exclusivos adaptados à sua rotina: emagrecimento, ganho de massa, receitas funcionais, opção sem glúten e rotinas vegetarianas.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {NUTRITION_TAGS.map((tag) => {
          const active = activeTags.includes(tag.value);
          return (
            <TouchableOpacity
              key={tag.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => toggleTag(tag.value)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tag.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visibleItems.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum material encontrado nessa categoria.</Text>
      ) : (
        <View style={styles.itemGrid}>
          {visibleItems.map((item) => {
            const typeMeta = MATERIAL_TYPE_META[item.category];
            return (
              <View key={item.id} style={[styles.itemCard, isDesktop && styles.itemCardDesktop]}>
                <View style={styles.bannerWrap}>
                  {item.coverImage ? (
                    <Image source={{ uri: item.coverImage }} style={styles.itemCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                      <Ionicons name={typeMeta?.icon || 'document-outline'} size={28} color="#525252" />
                    </View>
                  )}
                  {typeMeta && (
                    <View style={styles.bannerBadge}>
                      <Ionicons name={typeMeta.icon} size={11} color="#FFFFFF" />
                      <Text style={styles.bannerBadgeText}>{typeMeta.badge}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                  <TouchableOpacity style={styles.viewButton} onPress={() => onSelectMaterial?.(item)}>
                    <Text style={styles.viewButtonText}>Ver Mais</Text>
                    <Ionicons name="arrow-forward" size={13} color={ACCENT} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionSupport: {
    ...SUPPORT_TEXT,
    textAlign: 'center',
    maxWidth: 440,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  filterScroll: { marginBottom: GRID_GAP },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  filterChip: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3F3F46', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, ...TRANSITION },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipText: { color: '#d4d4d4', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#000000' },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  itemCard: { width: '100%', ...FLAT_CARD, padding: 0, overflow: 'hidden' },
  itemCardDesktop: { width: '48%' },
  bannerWrap: { width: '100%', aspectRatio: 4 / 3, position: 'relative' },
  itemCover: { width: '100%', height: '100%', backgroundColor: '#171717' },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bannerBadge: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(10,10,10,0.7)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  bannerBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  itemBody: { padding: 14 },
  itemTitle: { ...CARD_TITLE, fontSize: 15 },
  itemDescription: { ...CARD_DESCRIPTION, marginTop: 6 },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-start', ...TRANSITION },
  viewButtonText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
});

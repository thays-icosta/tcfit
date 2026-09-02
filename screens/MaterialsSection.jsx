import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, SUPPORT_TEXT, CARD_DESCRIPTION, CARD_BADGE, CARD_BADGE_TEXT, GRID_GAP } from './vitrineStyles';

const DIET_TAGS = [
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'ganho_de_massa', label: 'Ganho de Massa' },
  { value: 'sem_gluten', label: 'Sem Glúten' },
  { value: 'vegetariano', label: 'Vegetariano/Vegano' },
];

const CATEGORY_FILTERS = [
  { value: 'plano_alimentar', label: 'Planos Alimentares' },
  { value: 'ebook_receita', label: 'E-books' },
];

const FILTERS = [{ value: 'todos', label: 'Todos' }, ...CATEGORY_FILTERS, ...DIET_TAGS];

export default function MaterialsSection({ onSelectMaterial, isDesktop }) {
  const [materialsData, setMaterialsData] = useState([]);
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, description, cover_image_url, delivery_value, material_type, diet_tag, active')
        .eq('active', true)
        .not('material_type', 'is', null)
        .order('created_at', { ascending: false });

      const normalized = (data || []).map((p) => ({
        id: p.id,
        category: p.material_type,
        title: p.name,
        description: p.description,
        badge: p.material_type === 'plano_alimentar' ? 'Plano Alimentar' : 'E-book',
        dietTagLabel: p.diet_tag ? DIET_TAGS.find((t) => t.value === p.diet_tag)?.label : null,
        coverImage: p.cover_image_url,
        fileUrl: p.delivery_value,
        active: p.active,
        dietTag: p.diet_tag,
      }));
      setMaterialsData(normalized);
    })();
  }, []);

  const visibleItems = filter === 'todos'
    ? materialsData
    : materialsData.filter((m) => m.category === filter || m.dietTag === filter);

  if (materialsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>PLANOS ALIMENTARES E E-BOOKS DE RECEITA</Text>
      <Text style={styles.sectionSupport}>
        Planos alimentares e e-books exclusivos adaptados à sua rotina: emagrecimento, ganho de massa, receitas funcionais, opção sem glúten e rotinas vegetarianas.
      </Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {visibleItems.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum material encontrado nessa categoria.</Text>
      ) : (
        <View style={styles.itemGrid}>
          {visibleItems.map((item) => (
            <View key={item.id} style={[styles.itemCard, isDesktop && styles.itemCardDesktop]}>
              {item.coverImage ? (
                <Image source={{ uri: item.coverImage }} style={styles.itemCover} resizeMode="cover" />
              ) : (
                <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                  <Ionicons name={item.category === 'plano_alimentar' ? 'restaurant-outline' : 'book-outline'} size={26} color="#525252" />
                </View>
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.itemBadgeRow}>
                  <View style={styles.itemBadge}>
                    <Text style={styles.itemBadgeText}>{item.badge}</Text>
                  </View>
                  {item.dietTagLabel && (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{item.dietTagLabel}</Text>
                    </View>
                  )}
                </View>
                {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                <TouchableOpacity style={styles.viewButton} onPress={() => onSelectMaterial?.(item)}>
                  <Text style={styles.viewButtonText}>Ver Mais</Text>
                  <Ionicons name="arrow-forward" size={13} color={ACCENT} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: GRID_GAP, justifyContent: 'center' },
  filterChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, ...TRANSITION },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipText: { color: '#d4d4d4', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#000000' },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  itemCard: { width: '100%', ...FLAT_CARD, padding: 0, overflow: 'hidden' },
  itemCardDesktop: { width: '48%' },
  itemCover: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#171717' },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemBody: { padding: 14 },
  itemTitle: { ...CARD_TITLE, fontSize: 15 },
  itemDescription: { ...CARD_DESCRIPTION, marginTop: 6 },
  itemBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  itemBadge: { ...CARD_BADGE },
  itemBadgeText: { ...CARD_BADGE_TEXT },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-start', ...TRANSITION },
  viewButtonText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
});

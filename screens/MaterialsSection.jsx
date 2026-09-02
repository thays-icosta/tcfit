import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, SUPPORT_TEXT, CARD_DESCRIPTION, CARD_BADGE, CARD_BADGE_TEXT, GRID_GAP } from './vitrineStyles';

const DIET_TAGS = [
  { value: 'emagrecimento', label: 'Emagrecimento', icon: 'flame-outline' },
  { value: 'ganho_de_massa', label: 'Ganho de Massa', icon: 'barbell-outline' },
  { value: 'sem_gluten', label: 'Sem Glúten', icon: 'leaf-outline' },
  { value: 'vegetariano', label: 'Vegetariano/Vegano', icon: 'nutrition-outline' },
];

function HoverCard({ style, hoverStyle, onPress, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable style={[style, hovered && hoverStyle]} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
      {children}
    </Pressable>
  );
}

export default function MaterialsSection({ onSelectMaterial, isDesktop }) {
  const [materialsData, setMaterialsData] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedDietTag, setSelectedDietTag] = useState(null);

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
        badge: p.material_type === 'plano_alimentar' ? 'Plano' : 'E-book',
        dietTagLabel: p.diet_tag ? DIET_TAGS.find((t) => t.value === p.diet_tag)?.label : null,
        coverImage: p.cover_image_url,
        fileUrl: p.delivery_value,
        active: p.active,
        dietTag: p.diet_tag,
      }));
      setMaterialsData(normalized);
    })();
  }, []);

  const planos = materialsData.filter((m) => m.category === 'plano_alimentar');
  const ebooks = materialsData.filter((m) => m.category === 'ebook_receita');

  const handleToggleCategory = (cat) => {
    setSelectedDietTag(null);
    setExpandedCategory((prev) => (prev === cat ? null : cat));
  };

  const visiblePlanos = selectedDietTag ? planos.filter((m) => m.dietTag === selectedDietTag) : planos;

  const renderItemCard = (item) => (
    <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => onSelectMaterial?.(item)}>
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.itemCover} resizeMode="cover" />
      ) : (
        <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
          <Ionicons name={item.category === 'plano_alimentar' ? 'restaurant-outline' : 'book-outline'} size={24} color="#525252" />
        </View>
      )}
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
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
      </View>
    </TouchableOpacity>
  );

  if (materialsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>PLANOS ALIMENTARES E E-BOOKS DE RECEITA</Text>
      <Text style={styles.sectionSupport}>
        Planos alimentares e e-books exclusivos adaptados à sua rotina: emagrecimento, ganho de massa, receitas funcionais, opção sem glúten e rotinas vegetarianas.
      </Text>

      <View style={styles.level1Row}>
        <HoverCard
          style={[styles.level1Card, expandedCategory === 'plano_alimentar' && styles.level1CardActive]}
          hoverStyle={styles.level1CardHover}
          onPress={() => handleToggleCategory('plano_alimentar')}
        >
          <Ionicons name="restaurant-outline" size={26} color={ACCENT} />
          <Text style={styles.level1Title}>Planos Alimentares</Text>
          <Text style={styles.level1Counter}>{planos.length} {planos.length === 1 ? 'Dieta e Meta' : 'Dietas e Metas'}</Text>
        </HoverCard>
        <HoverCard
          style={[styles.level1Card, expandedCategory === 'ebook_receita' && styles.level1CardActive]}
          hoverStyle={styles.level1CardHover}
          onPress={() => handleToggleCategory('ebook_receita')}
        >
          <Ionicons name="book-outline" size={26} color={ACCENT} />
          <Text style={styles.level1Title}>E-books e Receitas</Text>
          <Text style={styles.level1Counter}>{ebooks.length} {ebooks.length === 1 ? 'Guia Prático' : 'Guias Práticos'}</Text>
        </HoverCard>
      </View>

      {expandedCategory === 'plano_alimentar' && (
        <>
          <View style={styles.level2Row}>
            {DIET_TAGS.map((tag) => {
              const count = planos.filter((m) => m.dietTag === tag.value).length;
              const active = selectedDietTag === tag.value;
              return (
                <TouchableOpacity
                  key={tag.value}
                  style={[styles.level2Chip, active && styles.level2ChipActive]}
                  onPress={() => setSelectedDietTag(active ? null : tag.value)}
                >
                  <Ionicons name={tag.icon} size={14} color={active ? '#000000' : ACCENT} />
                  <Text style={[styles.level2ChipText, active && styles.level2ChipTextActive]}>{tag.label}</Text>
                  <Text style={[styles.level2ChipCount, active && styles.level2ChipTextActive]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {visiblePlanos.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum plano alimentar cadastrado ainda nessa categoria.</Text>
          ) : (
            <View style={styles.itemGrid}>{visiblePlanos.map(renderItemCard)}</View>
          )}
        </>
      )}

      {expandedCategory === 'ebook_receita' && (
        ebooks.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum e-book cadastrado ainda.</Text>
        ) : (
          <View style={styles.itemGrid}>{ebooks.map(renderItemCard)}</View>
        )
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
  level1Row: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  level1Card: { flex: 1, ...FLAT_CARD, alignItems: 'center', ...TRANSITION },
  level1CardActive: { borderColor: ACCENT, backgroundColor: 'rgba(224,90,23,0.1)' },
  level1CardHover: { borderColor: 'rgba(224,90,23,0.5)' },
  level1Title: { ...CARD_TITLE, marginTop: 10, textAlign: 'center' },
  level1Counter: { color: '#737373', fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  level2Row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: GRID_GAP },
  level2Chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, ...TRANSITION },
  level2ChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  level2ChipText: { color: '#d4d4d4', fontSize: 11, fontWeight: '700' },
  level2ChipTextActive: { color: '#000000' },
  level2ChipCount: { color: '#737373', fontSize: 10, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, justifyContent: 'center' },
  itemCard: { width: 150, ...FLAT_CARD, padding: 0, overflow: 'hidden' },
  itemCover: { width: '100%', aspectRatio: 1, backgroundColor: '#171717' },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemBody: { padding: 12 },
  itemTitle: { ...CARD_TITLE, fontSize: 13 },
  itemDescription: { ...CARD_DESCRIPTION, marginTop: 4 },
  itemBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  itemBadge: { ...CARD_BADGE },
  itemBadgeText: { ...CARD_BADGE_TEXT },
});

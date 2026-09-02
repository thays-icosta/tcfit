import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';

const ACCENT = '#E05A17';
const TRANSITION = Platform.OS === 'web' ? { transitionProperty: 'all', transitionDuration: '200ms', transitionTimingFunction: 'ease' } : {};

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

export default function MaterialsSection({ onSelectMaterial }) {
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
        badge: p.diet_tag ? DIET_TAGS.find((t) => t.value === p.diet_tag)?.label : null,
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
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        {item.badge && (
          <View style={styles.itemBadge}>
            <Text style={styles.itemBadgeText}>{item.badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (materialsData.length === 0) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>PLANOS ALIMENTARES E E-BOOKS DE RECEITA</Text>
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
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 16 * 0.08,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionSupport: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 440,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 21,
  },
  level1Row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  level1Card: {
    flex: 1,
    backgroundColor: 'rgba(23,23,28,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(224,90,23,0.16)',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
    ...TRANSITION,
  },
  level1CardActive: { borderColor: ACCENT, backgroundColor: 'rgba(224,90,23,0.1)' },
  level1CardHover: { borderColor: 'rgba(224,90,23,0.5)' },
  level1Title: { color: '#f5f5f5', fontSize: 13, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  level1Counter: { color: '#737373', fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  level2Row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  level2Chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, ...TRANSITION },
  level2ChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  level2ChipText: { color: '#d4d4d4', fontSize: 11, fontWeight: '700' },
  level2ChipTextActive: { color: '#000000' },
  level2ChipCount: { color: '#737373', fontSize: 10, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  itemCard: { width: 130 },
  itemCover: {
    width: 130,
    height: 130,
    borderRadius: 16,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(224,90,23,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemInfo: { marginTop: 8, alignItems: 'center' },
  itemTitle: { color: '#d4d4d4', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  itemBadge: { backgroundColor: 'rgba(224,90,23,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  itemBadgeText: { color: ACCENT, fontSize: 9, fontWeight: '700' },
});

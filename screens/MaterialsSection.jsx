import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { NUTRITION_TAGS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, SUPPORT_TEXT } from './vitrineStyles';

const MATERIAL_TYPE_META = {
  plano_alimentar: { label: 'Plano Alimentar', icon: 'restaurant-outline' },
  ebook_receita: { label: 'E-book', icon: 'book-outline' },
};

const NUTRITION_LABELS = {};
NUTRITION_TAGS.forEach((t) => { NUTRITION_LABELS[t.value] = t.label; });

export default function MaterialsSection({ onSelectMaterial, isDesktop }) {
  const [materialsData, setMaterialsData] = useState([]);

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

  if (materialsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>PLANOS ALIMENTARES E E-BOOKS DE RECEITA</Text>
      <Text style={styles.sectionSupport}>
        Planos alimentares e e-books exclusivos adaptados à sua rotina: emagrecimento, ganho de massa, receitas funcionais, opção sem glúten e rotinas vegetarianas.
      </Text>

      <View style={styles.itemGrid}>
        {materialsData.map((item) => {
          const typeMeta = MATERIAL_TYPE_META[item.category];
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.bannerWrap}>
                {item.coverImage ? (
                  <Image source={{ uri: item.coverImage }} style={styles.itemCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                    <Ionicons name={typeMeta?.icon || 'document-outline'} size={26} color="#525252" />
                  </View>
                )}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                {(typeMeta || item.nutritionTags.length > 0) && (
                  <View style={styles.tagRow}>
                    {typeMeta && (
                      <View style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{typeMeta.label}</Text>
                      </View>
                    )}
                    {item.nutritionTags.map((t) => (
                      <View key={t} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{NUTRITION_LABELS[t] || t}</Text>
                      </View>
                    ))}
                  </View>
                )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  sectionSupport: {
    ...SUPPORT_TEXT,
    textAlign: 'center',
    maxWidth: 360,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: { width: '48%', ...FLAT_CARD, borderRadius: 12, padding: 0, overflow: 'hidden' },
  bannerWrap: { width: '100%', height: 120, position: 'relative' },
  itemCover: { width: '100%', height: '100%', backgroundColor: '#171717' },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemBody: { padding: 10 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagChip: { backgroundColor: '#27272A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagChipText: { color: '#D4D4D8', fontSize: 10, fontWeight: '600' },
  itemDescription: { fontSize: 11, fontWeight: '400', color: '#A1A1AA', lineHeight: 15, marginTop: 6 },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', ...TRANSITION },
  viewButtonText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
});

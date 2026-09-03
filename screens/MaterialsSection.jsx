import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { NUTRITION_TAGS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, SUPPORT_TEXT, COVER_TOP_IMAGE } from './vitrineStyles';
import { toTitleCase } from './textUtils';

const MATERIAL_TYPE_META = {
  plano_alimentar: { label: 'Plano Alimentar', icon: 'restaurant-outline' },
  ebook_receita: { label: 'E-book', icon: 'book-outline' },
};

const NUTRITION_LABELS = {};
NUTRITION_TAGS.forEach((t) => { NUTRITION_LABELS[t.value] = t.label; });

function MaterialItemCard({ item, onSelectMaterial }) {
  const typeMeta = MATERIAL_TYPE_META[item.category];
  return (
    <View style={styles.itemCard}>
      <View style={styles.bannerWrap}>
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} style={styles.itemCoverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
            <Ionicons name={typeMeta?.icon || 'document-outline'} size={26} color="#525252" />
          </View>
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={2}>{toTitleCase(item.title)}</Text>
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
}

export default function MaterialsSection({ onSelectMaterial, isDesktop }) {
  const [materialsData, setMaterialsData] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: collectionRows }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, description, cover_image_url, delivery_value, pdf_url, material_type, nutrition_tags, active, collection_id')
          .eq('active', true)
          .not('material_type', 'is', null)
          .order('created_at', { ascending: false }),
        supabase.from('product_collections').select('*').order('order_index'),
      ]);

      const normalized = (data || []).map((p) => ({
        id: p.id,
        category: p.material_type,
        title: p.name,
        description: p.description,
        nutritionTags: p.nutrition_tags || [],
        coverImage: p.cover_image_url,
        fileUrl: p.pdf_url || p.delivery_value,
        active: p.active,
        collectionId: p.collection_id,
      }));
      setMaterialsData(normalized);
      setCollections(collectionRows || []);
    })();
  }, []);

  if (materialsData.length === 0) return null;

  const groupedCollections = collections
    .map((c) => ({ ...c, items: materialsData.filter((m) => m.collectionId === c.id) }))
    .filter((c) => c.items.length > 0);
  const ungroupedItems = materialsData.filter((m) => !m.collectionId);

  if (selectedCollection) {
    return (
      <View>
        <TouchableOpacity style={styles.backLink} onPress={() => setSelectedCollection(null)}>
          <Ionicons name="arrow-back" size={14} color={ACCENT} />
          <Text style={styles.backLinkText}>Todas as coleções</Text>
        </TouchableOpacity>
        <Text style={sectionTitleStyle(isDesktop)}>{toTitleCase(selectedCollection.name).toUpperCase()}</Text>
        {selectedCollection.description ? (
          <Text style={styles.sectionSupport}>{selectedCollection.description}</Text>
        ) : null}
        <View style={styles.itemGrid}>
          {selectedCollection.items.map((item) => (
            <MaterialItemCard key={item.id} item={item} onSelectMaterial={onSelectMaterial} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>PLANOS ALIMENTARES E E-BOOKS DE RECEITA</Text>
      <Text style={styles.sectionSupport}>
        Planos alimentares e e-books exclusivos adaptados à sua rotina: emagrecimento, ganho de massa, receitas funcionais, opção sem glúten e rotinas vegetarianas.
      </Text>

      <View style={styles.itemGrid}>
        {groupedCollections.map((c) => (
          <TouchableOpacity key={c.id} style={styles.itemCard} onPress={() => setSelectedCollection(c)}>
            <View style={styles.bannerWrap}>
              {c.cover_image_url ? (
                <Image source={{ uri: c.cover_image_url }} style={styles.itemCoverImage} resizeMode="cover" />
              ) : (
                <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                  <Ionicons name="folder-outline" size={26} color="#525252" />
                </View>
              )}
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle} numberOfLines={2}>{toTitleCase(c.name)}</Text>
              <View style={styles.viewButton}>
                <Text style={styles.viewButtonText}>Acessar Coleção</Text>
                <Ionicons name="arrow-forward" size={13} color={ACCENT} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
        {ungroupedItems.map((item) => (
          <MaterialItemCard key={item.id} item={item} onSelectMaterial={onSelectMaterial} />
        ))}
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
  bannerWrap: { width: '100%', aspectRatio: 16 / 9, position: 'relative', overflow: 'hidden' },
  itemCover: { width: '100%', height: '100%', backgroundColor: '#171717' },
  itemCoverImage: { ...COVER_TOP_IMAGE },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginBottom: 10 },
  backLinkText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  itemBody: { padding: 10 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagChip: { backgroundColor: '#27272A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagChipText: { color: '#D4D4D8', fontSize: 10, fontWeight: '600' },
  itemDescription: { fontSize: 11, fontWeight: '400', color: '#A1A1AA', lineHeight: 15, marginTop: 6 },
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', ...TRANSITION },
  viewButtonText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
});

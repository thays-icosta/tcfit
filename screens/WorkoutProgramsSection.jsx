import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, PROGRAM_GOALS } from './accessLevel';
import { FLAT_CARD, sectionTitleStyle, SUPPORT_TEXT, COVER_TOP_IMAGE } from './vitrineStyles';
import { toTitleCase } from './textUtils';

const WORKOUT_PRODUCT_TYPES = ['treino_template', 'planilha_treino'];

function badgesFor(items) {
  const set = new Set();
  items.forEach((p) => {
    const lvl = PROGRAM_LEVELS.find((l) => l.value === p.level)?.label;
    const goal = PROGRAM_GOALS.find((g) => g.value === p.goal)?.label;
    if (lvl) set.add(lvl);
    if (goal) set.add(goal);
  });
  return Array.from(set);
}

function ProgramCard({ title, coverImage, badges }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.bannerWrap}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.itemCoverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
            <Ionicons name="barbell-outline" size={26} color="#525252" />
          </View>
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={2}>{toTitleCase(title)}</Text>
        {badges.length > 0 && (
          <View style={styles.tagRow}>
            {badges.map((b) => (
              <View key={b} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function WorkoutProgramsSection({ isDesktop }) {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: productRows }, { data: collectionRows }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, cover_image_url, collection_id, level, goal, active, type')
          .in('type', WORKOUT_PRODUCT_TYPES)
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase.from('product_collections').select('*').order('order_index'),
      ]);
      setProducts(productRows || []);
      setCollections(collectionRows || []);
    })();
  }, []);

  if (products.length === 0) return null;

  const groupedCollections = collections
    .map((c) => ({ ...c, items: products.filter((p) => p.collection_id === c.id) }))
    .filter((c) => c.items.length > 0);
  const ungroupedItems = products.filter((p) => !p.collection_id);

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>SEU TREINO COMPLETO</Text>
      <Text style={styles.sectionSupport}>
        Treine onde quiser e quando quiser, tudo pensado no seu objetivo e na palma da sua mão.
      </Text>

      <View style={styles.itemGrid}>
        {groupedCollections.map((c) => (
          <ProgramCard
            key={c.id}
            title={c.name}
            coverImage={c.cover_image_url || c.items.find((p) => p.cover_image_url)?.cover_image_url}
            badges={badgesFor(c.items)}
          />
        ))}
        {ungroupedItems.map((item) => (
          <ProgramCard
            key={item.id}
            title={item.name}
            coverImage={item.cover_image_url}
            badges={badgesFor([item])}
          />
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
  itemCoverImage: { backgroundColor: '#171717', ...COVER_TOP_IMAGE },
  itemCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemBody: { padding: 10 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagChip: { backgroundColor: '#27272A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagChipText: { color: '#D4D4D8', fontSize: 10, fontWeight: '600' },
});

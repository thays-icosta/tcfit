import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, PROGRAM_GOALS, HOME_CATEGORIES } from './accessLevel';
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

function CategoryRow({ title, units }) {
  if (units.length === 0) return null;
  return (
    <View style={styles.categoryRow}>
      <Text style={styles.categoryRowTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRowScroll}>
        {units.map((u) => (
          <ProgramCard key={u.key} title={u.title} coverImage={u.coverImage} badges={u.badges} />
        ))}
      </ScrollView>
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
          .select('id, name, cover_image_url, collection_id, level, goal, category, active, type')
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

  // Collapse each collection's products into a single showcase unit (a
  // collection with items shows its own cover, not every item separately),
  // then treat any product without a collection as its own unit.
  const collectionUnits = collections
    .map((c) => {
      const items = products.filter((p) => p.collection_id === c.id);
      if (items.length === 0) return null;
      return {
        key: `collection-${c.id}`,
        title: c.name,
        coverImage: c.cover_image_url || items.find((p) => p.cover_image_url)?.cover_image_url,
        badges: badgesFor(items),
        category: items.find((p) => p.category)?.category || null,
      };
    })
    .filter(Boolean);

  const productUnits = products
    .filter((p) => !p.collection_id)
    .map((p) => ({
      key: `product-${p.id}`,
      title: p.name,
      coverImage: p.cover_image_url,
      badges: badgesFor([p]),
      category: p.category || null,
    }));

  const allUnits = [...collectionUnits, ...productUnits];
  const categoryRows = HOME_CATEGORIES
    .map((c) => ({ ...c, units: allUnits.filter((u) => u.category === c.value) }))
    .filter((c) => c.units.length > 0);
  const uncategorizedUnits = allUnits.filter((u) => !HOME_CATEGORIES.some((c) => c.value === u.category));

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>SEU TREINO COMPLETO</Text>
      <Text style={styles.sectionSupport}>
        Treine onde quiser e quando quiser, tudo pensado no seu objetivo e na palma da sua mão.
      </Text>

      {categoryRows.map((row) => (
        <CategoryRow key={row.value} title={row.label} units={row.units} />
      ))}
      <CategoryRow title="Outros Treinos" units={uncategorizedUnits} />
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
  categoryRow: { marginBottom: 20 },
  categoryRowTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
  categoryRowScroll: { gap: 12, paddingRight: 4 },
  itemCard: { width: 160, ...FLAT_CARD, borderRadius: 12, padding: 0, overflow: 'hidden' },
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

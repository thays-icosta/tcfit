import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, PROGRAM_GOALS } from './accessLevel';
import { FLAT_CARD, sectionTitleStyle, SUPPORT_TEXT, COVER_TOP_IMAGE } from './vitrineStyles';
import { toTitleCase } from './textUtils';

const WORKOUT_PRODUCT_TYPES = ['treino_template', 'planilha_treino'];

function ProgramItemCard({ item }) {
  const lvl = PROGRAM_LEVELS.find((l) => l.value === item.level)?.label;
  const goal = PROGRAM_GOALS.find((g) => g.value === item.goal)?.label;
  return (
    <View style={styles.itemCard}>
      <View style={styles.bannerWrap}>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.itemCoverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
            <Ionicons name="barbell-outline" size={26} color="#525252" />
          </View>
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={2}>{toTitleCase(item.name)}</Text>
        {(lvl || goal) && (
          <View style={styles.tagRow}>
            {lvl ? <View style={styles.tagChip}><Text style={styles.tagChipText}>{lvl}</Text></View> : null}
            {goal ? <View style={styles.tagChip}><Text style={styles.tagChipText}>{goal}</Text></View> : null}
          </View>
        )}
      </View>
    </View>
  );
}

export default function WorkoutProgramsSection({ isDesktop }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: productRows } = await supabase
        .from('products')
        .select('id, name, cover_image_url, level, goal, active, type')
        .in('type', WORKOUT_PRODUCT_TYPES)
        .eq('active', true)
        .order('created_at', { ascending: false });
      setProducts(productRows || []);
    })();
  }, []);

  if (products.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>SEU TREINO COMPLETO</Text>
      <Text style={styles.sectionSupport}>
        Treine onde quiser e quando quiser, tudo pensado no seu objetivo e na palma da sua mão.
      </Text>

      <View style={styles.itemGrid}>
        {products.map((item) => (
          <ProgramItemCard key={item.id} item={item} />
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

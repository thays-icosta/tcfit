import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, PROGRAM_GOALS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, SUPPORT_TEXT, COVER_TOP_IMAGE } from './vitrineStyles';
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

function ProgramItemCard({ item, onSelectProgram }) {
  const lvl = PROGRAM_LEVELS.find((l) => l.value === item.level)?.label;
  const goal = PROGRAM_GOALS.find((g) => g.value === item.goal)?.label;
  return (
    <TouchableOpacity style={styles.itemCard} onPress={() => onSelectProgram?.(item)}>
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
        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>Ver Mais</Text>
          <Ionicons name="arrow-forward" size={13} color={ACCENT} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function WorkoutProgramsSection({ onSelectProgram, isDesktop }) {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);

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

  if (selectedCollection) {
    return (
      <View>
        <TouchableOpacity style={styles.backLink} onPress={() => setSelectedCollection(null)}>
          <Ionicons name="arrow-back" size={14} color={ACCENT} />
          <Text style={styles.backLinkText}>Todos os programas</Text>
        </TouchableOpacity>
        <Text style={sectionTitleStyle(isDesktop)}>{toTitleCase(selectedCollection.name).toUpperCase()}</Text>
        {selectedCollection.description ? (
          <Text style={styles.sectionSupport}>{selectedCollection.description}</Text>
        ) : null}
        <View style={styles.itemGrid}>
          {selectedCollection.items.map((item) => (
            <ProgramItemCard key={item.id} item={item} onSelectProgram={onSelectProgram} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>SEU TREINO COMPLETO</Text>
      <Text style={styles.sectionSupport}>
        Treine onde quiser e quando quiser, tudo pensado no seu objetivo e na palma da sua mão.
      </Text>

      <View style={styles.itemGrid}>
        {groupedCollections.map((c) => {
          const badges = badgesFor(c.items);
          const cover = c.cover_image_url || c.items.find((p) => p.cover_image_url)?.cover_image_url;
          return (
            <TouchableOpacity key={c.id} style={styles.itemCard} onPress={() => setSelectedCollection(c)}>
              <View style={styles.bannerWrap}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.itemCoverImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                    <Ionicons name="barbell-outline" size={26} color="#525252" />
                  </View>
                )}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>{toTitleCase(c.name)}</Text>
                {badges.length > 0 && (
                  <View style={styles.tagRow}>
                    {badges.map((b) => (
                      <View key={b} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.viewButton}>
                  <Text style={styles.viewButtonText}>Acessar Coleção</Text>
                  <Ionicons name="arrow-forward" size={13} color={ACCENT} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {ungroupedItems.map((item) => (
          <ProgramItemCard key={item.id} item={item} onSelectProgram={onSelectProgram} />
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
  viewButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', ...TRANSITION },
  viewButtonText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginBottom: 10 },
  backLinkText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
});

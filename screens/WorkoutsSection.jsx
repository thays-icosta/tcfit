import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { WORKOUT_TAGS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, SUPPORT_TEXT, CARD_DESCRIPTION, GRID_GAP } from './vitrineStyles';

const TAG_META = {};
WORKOUT_TAGS.forEach((t) => { TAG_META[t.value] = t; });
const BADGE_PRIORITY = ['mulheres', 'homens', 'academia', 'em_casa', 'planilhas'];

function primaryTag(tags) {
  const value = BADGE_PRIORITY.find((v) => tags.includes(v));
  return value ? TAG_META[value] : null;
}

export default function WorkoutsSection({ onSelectWorkout, isDesktop }) {
  const [workoutsData, setWorkoutsData] = useState([]);
  const [activeTags, setActiveTags] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workout_templates')
        .select('id, name, description, cover_image_url, workout_tags, is_public')
        .eq('is_public', true)
        .not('workout_tags', 'is', null)
        .order('created_at', { ascending: false });

      const normalized = (data || []).map((t) => ({
        id: t.id,
        title: t.name,
        description: t.description,
        tags: t.workout_tags || [],
        bannerImage: t.cover_image_url,
        active: t.is_public,
      }));
      setWorkoutsData(normalized);
    })();
  }, []);

  const toggleTag = (value) => {
    setActiveTags((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  };

  const visibleList = activeTags.length === 0
    ? workoutsData
    : workoutsData.filter((w) => activeTags.every((t) => w.tags.includes(t)));

  if (workoutsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>METODOLOGIA E PROGRAMAS DE TREINO</Text>
      <Text style={styles.sectionSupport}>
        Treine com quem te guia até os resultados! Nossa metodologia entrega evolução real com treinos dinâmicos, desafiadores e adaptáveis à sua rotina. O TcFit te mostra o caminho.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {WORKOUT_TAGS.map((tag) => {
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

      {visibleList.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum programa encontrado nessa categoria.</Text>
      ) : (
        <View style={styles.itemGrid}>
          {visibleList.map((item) => {
            const badge = primaryTag(item.tags);
            return (
              <View key={item.id} style={[styles.itemCard, isDesktop && styles.itemCardDesktop]}>
                <View style={styles.bannerWrap}>
                  {item.bannerImage ? (
                    <Image source={{ uri: item.bannerImage }} style={styles.itemCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                      <Ionicons name="barbell-outline" size={28} color="#525252" />
                    </View>
                  )}
                  {badge && (
                    <View style={styles.bannerBadge}>
                      <Ionicons name={badge.icon} size={11} color="#FFFFFF" />
                      <Text style={styles.bannerBadgeText}>{badge.badge}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                  <TouchableOpacity style={styles.viewButton} onPress={() => onSelectWorkout?.(item)}>
                    <Text style={styles.viewButtonText}>Ver Treino</Text>
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
    maxWidth: 460,
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

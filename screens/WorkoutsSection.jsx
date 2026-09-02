import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, WORKOUT_GOALS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, SUPPORT_TEXT, CARD_DESCRIPTION, CARD_BADGE, CARD_BADGE_TEXT, GRID_GAP } from './vitrineStyles';

const ENV_FILTERS = [
  { value: 'academia', label: 'Academia' },
  { value: 'casa', label: 'Casa' },
];

const TAG_FILTER_VALUES = ['iniciante', 'intermediario', 'avancado', 'hipertrofia', 'emagrecimento', 'sem_equipamentos', 'cardio', 'definicao'];

const TAG_LABELS = {};
[...PROGRAM_LEVELS, ...WORKOUT_GOALS].forEach((t) => { TAG_LABELS[t.value] = t.label; });

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  ...ENV_FILTERS,
  ...TAG_FILTER_VALUES.map((value) => ({ value, label: TAG_LABELS[value] || value })),
];

export default function WorkoutsSection({ onSelectWorkout, isDesktop }) {
  const [workoutsData, setWorkoutsData] = useState([]);
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workout_templates')
        .select('id, name, description, cover_image_url, environment, level, goal, is_public')
        .eq('is_public', true)
        .not('environment', 'is', null)
        .order('created_at', { ascending: false });

      const normalized = (data || []).map((t) => ({
        id: t.id,
        title: t.name,
        description: t.description,
        environment: t.environment,
        level: t.level,
        goal: t.goal,
        bannerImage: t.cover_image_url,
        active: t.is_public,
      }));
      setWorkoutsData(normalized);
    })();
  }, []);

  const visibleList = filter === 'todos'
    ? workoutsData
    : filter === 'academia' || filter === 'casa'
      ? workoutsData.filter((w) => w.environment === filter)
      : workoutsData.filter((w) => w.level === filter || w.goal === filter);

  if (workoutsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>METODOLOGIA E PROGRAMAS DE TREINO</Text>
      <Text style={styles.sectionSupport}>
        Treine com quem te guia até os resultados! Nossa metodologia entrega evolução real com treinos dinâmicos, desafiadores e adaptáveis à sua rotina. O TcFit te mostra o caminho.
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

      {visibleList.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum programa encontrado nessa categoria.</Text>
      ) : (
        <View style={styles.itemGrid}>
          {visibleList.map((item) => (
            <View key={item.id} style={[styles.itemCard, isDesktop && styles.itemCardDesktop]}>
              {item.bannerImage ? (
                <Image source={{ uri: item.bannerImage }} style={styles.itemCover} resizeMode="cover" />
              ) : (
                <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                  <Ionicons name="barbell-outline" size={26} color="#525252" />
                </View>
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.itemBadgeRow}>
                  <View style={styles.itemBadge}>
                    <Text style={styles.itemBadgeText}>{item.environment === 'academia' ? 'Academia' : 'Casa'}</Text>
                  </View>
                  {item.level && (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{TAG_LABELS[item.level]}</Text>
                    </View>
                  )}
                </View>
                {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
                <TouchableOpacity style={styles.viewButton} onPress={() => onSelectWorkout?.(item)}>
                  <Text style={styles.viewButtonText}>Ver Treino</Text>
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
    maxWidth: 460,
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

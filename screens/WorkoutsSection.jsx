import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, WORKOUT_GOALS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, CARD_TITLE, SUPPORT_TEXT, CARD_DESCRIPTION, CARD_BADGE, CARD_BADGE_TEXT, GRID_GAP } from './vitrineStyles';

const ACADEMIA_TAGS = ['iniciante', 'intermediario', 'avancado', 'hipertrofia', 'emagrecimento'];
const CASA_TAGS = ['sem_equipamentos', 'iniciante', 'cardio', 'definicao'];

const TAG_LABELS = {};
[...PROGRAM_LEVELS, ...WORKOUT_GOALS].forEach((t) => { TAG_LABELS[t.value] = t.label; });

function HoverCard({ style, hoverStyle, onPress, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable style={[style, hovered && hoverStyle]} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
      {children}
    </Pressable>
  );
}

export default function WorkoutsSection({ onSelectWorkout, isDesktop }) {
  const [workoutsData, setWorkoutsData] = useState([]);
  const [expandedEnv, setExpandedEnv] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);

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

  const academia = workoutsData.filter((w) => w.environment === 'academia');
  const casa = workoutsData.filter((w) => w.environment === 'casa');

  const handleToggleEnv = (env) => {
    setSelectedTag(null);
    setExpandedEnv((prev) => (prev === env ? null : env));
  };

  const activeList = expandedEnv === 'academia' ? academia : expandedEnv === 'casa' ? casa : [];
  const visibleList = selectedTag ? activeList.filter((w) => w.level === selectedTag || w.goal === selectedTag) : activeList;
  const tagList = expandedEnv === 'academia' ? ACADEMIA_TAGS : expandedEnv === 'casa' ? CASA_TAGS : [];

  const renderItemCard = (item) => (
    <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => onSelectWorkout?.(item)}>
      {item.bannerImage ? (
        <Image source={{ uri: item.bannerImage }} style={styles.itemCover} resizeMode="cover" />
      ) : (
        <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
          <Ionicons name="barbell-outline" size={24} color="#525252" />
        </View>
      )}
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
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
      </View>
    </TouchableOpacity>
  );

  if (workoutsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>METODOLOGIA E PROGRAMAS DE TREINO</Text>
      <Text style={styles.sectionSupport}>
        Treine com quem te guia até os resultados! Nossa metodologia entrega evolução real com treinos dinâmicos, desafiadores e adaptáveis à sua rotina. O TcFit te mostra o caminho.
      </Text>

      <View style={styles.level1Row}>
        <HoverCard
          style={[styles.level1Card, expandedEnv === 'academia' && styles.level1CardActive]}
          hoverStyle={styles.level1CardHover}
          onPress={() => handleToggleEnv('academia')}
        >
          <Ionicons name="barbell-outline" size={26} color={ACCENT} />
          <Text style={styles.level1Title}>Treinos na Academia</Text>
          <Text style={styles.level1Counter}>{academia.length} {academia.length === 1 ? 'Programa' : 'Programas'}</Text>
        </HoverCard>
        <HoverCard
          style={[styles.level1Card, expandedEnv === 'casa' && styles.level1CardActive]}
          hoverStyle={styles.level1CardHover}
          onPress={() => handleToggleEnv('casa')}
        >
          <Ionicons name="body-outline" size={26} color={ACCENT} />
          <Text style={styles.level1Title}>Treinos em Casa</Text>
          <Text style={styles.level1Counter}>{casa.length} {casa.length === 1 ? 'Programa' : 'Programas'}</Text>
        </HoverCard>
      </View>

      {expandedEnv && (
        <>
          <View style={styles.level2Row}>
            {tagList.map((tagValue) => {
              const count = activeList.filter((w) => w.level === tagValue || w.goal === tagValue).length;
              const active = selectedTag === tagValue;
              return (
                <TouchableOpacity
                  key={tagValue}
                  style={[styles.level2Chip, active && styles.level2ChipActive]}
                  onPress={() => setSelectedTag(active ? null : tagValue)}
                >
                  <Text style={[styles.level2ChipText, active && styles.level2ChipTextActive]}>{TAG_LABELS[tagValue] || tagValue}</Text>
                  <Text style={[styles.level2ChipCount, active && styles.level2ChipTextActive]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {visibleList.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum programa cadastrado ainda nessa categoria.</Text>
          ) : (
            <View style={styles.itemGrid}>{visibleList.map(renderItemCard)}</View>
          )}
        </>
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

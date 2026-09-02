import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { PROGRAM_LEVELS, WORKOUT_GOALS } from './accessLevel';

const ACCENT = '#E05A17';
const TRANSITION = Platform.OS === 'web' ? { transitionProperty: 'all', transitionDuration: '200ms', transitionTimingFunction: 'ease' } : {};

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

export default function WorkoutsSection({ onSelectWorkout }) {
  const [workoutsData, setWorkoutsData] = useState([]);
  const [expandedEnv, setExpandedEnv] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workout_templates')
        .select('id, name, cover_image_url, environment, level, goal, is_public')
        .eq('is_public', true)
        .not('environment', 'is', null)
        .order('created_at', { ascending: false });

      const normalized = (data || []).map((t) => ({
        id: t.id,
        title: t.name,
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
      <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );

  if (workoutsData.length === 0) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>METODOLOGIA E PROGRAMAS DE TREINO</Text>
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
    maxWidth: 460,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 24,
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
  itemTitle: { color: '#d4d4d4', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});

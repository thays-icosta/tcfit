import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { WORKOUT_TAGS } from './accessLevel';
import { ACCENT, TRANSITION, FLAT_CARD, sectionTitleStyle, SUPPORT_TEXT } from './vitrineStyles';

const TAG_LABELS = {};
WORKOUT_TAGS.forEach((t) => { TAG_LABELS[t.value] = t.label; });

export default function WorkoutsSection({ onSelectWorkout, isDesktop }) {
  const [workoutsData, setWorkoutsData] = useState([]);

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

  if (workoutsData.length === 0) return null;

  return (
    <View>
      <Text style={sectionTitleStyle(isDesktop)}>METODOLOGIA E PROGRAMAS DE TREINO</Text>
      <Text style={styles.sectionSupport}>
        Treine com quem te guia até os resultados! Nossa metodologia entrega evolução real com treinos dinâmicos, desafiadores e adaptáveis à sua rotina. O TcFit te mostra o caminho.
      </Text>

      <View style={styles.itemGrid}>
        {workoutsData.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.bannerWrap}>
              {item.bannerImage ? (
                <Image source={{ uri: item.bannerImage }} style={styles.itemCover} resizeMode="cover" />
              ) : (
                <View style={[styles.itemCover, styles.itemCoverPlaceholder]}>
                  <Ionicons name="barbell-outline" size={26} color="#525252" />
                </View>
              )}
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              {item.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {item.tags.map((t) => (
                    <View key={t} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{TAG_LABELS[t] || t}</Text>
                    </View>
                  ))}
                </View>
              )}
              {item.description ? <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text> : null}
              <TouchableOpacity style={styles.viewButton} onPress={() => onSelectWorkout?.(item)}>
                <Text style={styles.viewButtonText}>Ver Treino</Text>
                <Ionicons name="arrow-forward" size={13} color={ACCENT} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
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

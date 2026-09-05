import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import ExerciseVideoScreen from './ExerciseVideoScreen';

const METHOD_LABELS = {
  'tradicional': 'Tradicional',
  'rest-pause': 'Rest-Pause',
  'bi-set': 'Bi-set',
  'drop-set': 'Drop-set',
  'piramide': 'Pirâmide',
};

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WorkoutPreviewScreen({ workout, muscleSummary, onStart, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchingVideo, setWatchingVideo] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workout_exercises')
        .select('id, order_index, sets, reps, rest_time_seconds, execution_method, exercises (name, muscle_group, thumbnail_url, video_url)')
        .eq('workout_id', workout.id)
        .order('order_index', { ascending: true });
      setItems(data || []);
      setLoading(false);
    })();
  }, [workout.id]);

  if (watchingVideo) {
    return (
      <ExerciseVideoScreen
        videoUrl={watchingVideo.video_url}
        exerciseName={watchingVideo.name}
        onClose={() => setWatchingVideo(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text style={styles.title}>{workout.name}</Text>
        <Text style={styles.subtitle}>Criado em {formatDate(workout.created_at)}</Text>

        {muscleSummary && muscleSummary.length > 0 && (
          <View style={styles.summaryRow}>
            {muscleSummary.map(([group, count]) => (
              <View key={group} style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>{count}x {group}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Exercícios ({items.length})</Text>

        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum exercício nessa ficha ainda.</Text>
        ) : (
          items.map((item) => {
            const hasVideo = !!item.exercises?.video_url;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.exerciseCard}
                onPress={() => hasVideo && setWatchingVideo({ video_url: item.exercises.video_url, name: item.exercises.name })}
                disabled={!hasVideo}
                activeOpacity={hasVideo ? 0.7 : 1}
              >
                <View style={styles.exerciseThumbWrap}>
                  {item.exercises?.thumbnail_url ? (
                    <Image source={{ uri: item.exercises.thumbnail_url }} style={styles.exerciseThumbImage} />
                  ) : (
                    <View style={styles.exerciseThumbPlaceholder}>
                      <Text style={styles.exerciseThumbMuscle}>{item.exercises?.muscle_group?.charAt(0).toUpperCase() || '?'}</Text>
                    </View>
                  )}
                  {hasVideo && (
                    <View style={styles.playBadge}>
                      <Text style={styles.playBadgeText}>▶</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.exerciseName}>{item.exercises?.name}</Text>
                  <View style={styles.pillsRow}>
                    <View style={styles.pill}><Text style={styles.pillText}>{item.sets || 3} séries</Text></View>
                    <View style={styles.pill}><Text style={styles.pillText}>{item.reps || '-'} reps</Text></View>
                    <View style={styles.pill}><Text style={styles.pillText}>{METHOD_LABELS[item.execution_method] || item.execution_method}</Text></View>
                    {item.rest_time_seconds != null && (
                      <View style={styles.pill}><Text style={styles.pillText}>{item.rest_time_seconds}s descanso</Text></View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.startButton} onPress={onStart}>
        <Ionicons name="play" size={18} color="#0a0a0a" />
        <Text style={styles.startButtonText}>Iniciar Treino</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 20, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#737373', fontSize: 12, marginTop: 4 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  summaryBadge: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  summaryBadgeText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 20 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 10, marginBottom: 10 },
  exerciseThumbWrap: { position: 'relative' },
  exerciseThumbImage: { width: 52, height: 52, borderRadius: 10 },
  exerciseThumbPlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  exerciseThumbMuscle: { color: '#f97316', fontSize: 15, fontWeight: '800' },
  playBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#171717' },
  playBadgeText: { color: '#0a0a0a', fontSize: 7, fontWeight: '800' },
  exerciseName: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  pill: { backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  startButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginBottom: 20 },
  startButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
});

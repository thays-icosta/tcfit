import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../../screens/supabaseClient';

function ExerciseVideo({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView style={styles.video} player={player} allowsFullscreen nativeControls />;
}

export default function PublicExercisePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, video_url, thumbnail_url, instructions, equipment')
        .eq('id', id)
        .maybeSingle();
      if (data) setExercise(data);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (notFound || !exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.logoText}>TcFit</Text>
        <Text style={styles.notFoundTitle}>Exercício não disponível</Text>
        <Text style={styles.notFoundSubtitle}>
          Esse exercício faz parte da biblioteca privada de um personal, ou o link não é válido. Faça login pra ver.
        </Text>
        <Link href="/?view=auth" style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Entrar no TcFit</Text>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.brand}>TcFit</Text>

      {exercise.video_url ? (
        <ExerciseVideo videoUrl={exercise.video_url} />
      ) : exercise.thumbnail_url ? (
        <Image source={{ uri: exercise.thumbnail_url }} style={styles.video} resizeMode="cover" />
      ) : (
        <View style={[styles.video, styles.videoPlaceholder]}>
          <Text style={styles.videoPlaceholderText}>{exercise.muscle_group?.toUpperCase() || '?'}</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>

        <View style={styles.badgeRow}>
          {exercise.muscle_group && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{exercise.muscle_group}</Text>
            </View>
          )}
          {exercise.equipment && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{exercise.equipment}</Text>
            </View>
          )}
        </View>

        {exercise.instructions ? (
          <>
            <Text style={styles.sectionTitle}>Como executar</Text>
            <Text style={styles.instructions}>{exercise.instructions}</Text>
          </>
        ) : null}

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Gostou desse exercício?</Text>
          <Text style={styles.ctaSubtitle}>
            No TcFit você tem a ficha completa do seu treino, dieta personalizada e acompanhamento do seu personal — tudo num só app.
          </Text>
          <Link href="/?view=plans" style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Quero contratar um personal</Text>
          </Link>
          <Link href="/?view=auth" style={styles.secondaryLink}>
            <Text style={styles.secondaryLinkText}>Já sou aluno(a) — Entrar</Text>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { color: '#f97316', fontSize: 20, fontWeight: '800', textAlign: 'center', paddingTop: 20, paddingBottom: 12 },
  logoText: { color: '#f97316', fontSize: 28, fontWeight: '800', marginBottom: 20 },
  video: { width: '100%', height: 260, backgroundColor: '#171717' },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  videoPlaceholderText: { color: '#f97316', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  exerciseName: { color: '#f5f5f5', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  badge: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { color: '#f97316', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  sectionTitle: { color: '#737373', fontSize: 11, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' },
  instructions: { color: '#d4d4d4', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  ctaCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 8 },
  ctaTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  ctaSubtitle: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  ctaButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', width: '100%', textAlign: 'center' },
  ctaButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  secondaryLink: { marginTop: 14, textAlign: 'center' },
  secondaryLinkText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  notFoundTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  notFoundSubtitle: { color: '#a3a3a3', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
});

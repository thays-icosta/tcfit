import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { supabase } from './supabaseClient';
import { computeStreaks } from './projectUtils';
import { WHATSAPP_NUMBER } from './ProgramDetailScreen';

const ACCENT = '#FF6B00';

// 🏆 Final screen shown once a student's Projeto run reaches its last day.
export default function ProjectCelebrationScreen({ studentProject, template, onClose }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ treinosConcluidos: 0, diasAtivos: 0, melhorCarga: null, sequenciaMaxima: 0, avaliacoesRegistradas: 0 });

  useEffect(() => {
    (async () => {
      const { data: completions } = await supabase
        .from('student_project_activity_completions')
        .select('workout_id, day_in_phase')
        .eq('student_project_id', studentProject.id)
        .not('completed_at', 'is', null);

      const workoutIds = [...new Set((completions || []).filter((c) => c.workout_id).map((c) => c.workout_id))];
      const diasAtivos = new Set((completions || []).map((c) => c.day_in_phase)).size;
      const sequenciaMaxima = computeStreaks([...new Set((completions || []).map((c) => c.day_in_phase))].sort((a, b) => a - b)).max;

      let melhorCarga = null;
      if (workoutIds.length > 0) {
        const { data: sessions } = await supabase.from('workout_sessions').select('id').in('workout_id', workoutIds);
        const sessionIds = (sessions || []).map((s) => s.id);
        if (sessionIds.length > 0) {
          const { data: sets } = await supabase.from('workout_session_sets').select('load_used_kg').in('session_id', sessionIds);
          const loads = (sets || []).map((s) => s.load_used_kg).filter((v) => v != null);
          if (loads.length > 0) melhorCarga = Math.max(...loads);
        }
      }

      const { data: assessments } = await supabase
        .from('physical_assessments')
        .select('id')
        .eq('student_id', studentProject.student_id)
        .gte('created_at', studentProject.started_at)
        .lte('created_at', studentProject.completed_at || new Date().toISOString());

      setStats({
        treinosConcluidos: workoutIds.length,
        diasAtivos,
        melhorCarga,
        sequenciaMaxima,
        avaliacoesRegistradas: (assessments || []).length,
      });
      setLoading(false);
    })();
  }, [studentProject.id]);

  const handleContactConsultoria = () => {
    const message = 'Olá! Acabei de concluir um Projeto no TcFit e quero saber mais sobre a Consultoria VIP.';
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>Projeto Concluído!</Text>
        <Text style={styles.subtitle}>Você concluiu</Text>
        <Text style={styles.projectName}>{template.name}</Text>
        <Text style={styles.days}>{template.total_days} / {template.total_days} DIAS</Text>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 30 }} />
        ) : (
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Treinos concluídos</Text>
              <Text style={styles.statValue}>{stats.treinosConcluidos}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Dias ativos</Text>
              <Text style={styles.statValue}>{stats.diasAtivos}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Melhor carga registrada</Text>
              <Text style={styles.statValue}>{stats.melhorCarga != null ? `${stats.melhorCarga}kg` : '—'}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Sequência máxima</Text>
              <Text style={styles.statValue}>{stats.sequenciaMaxima} dias</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Evolução registrada</Text>
              <Text style={styles.statValue}>{stats.avaliacoesRegistradas} avaliação(ões)</Text>
            </View>
          </View>
        )}

        <View style={styles.ctaCard}>
          <Text style={styles.ctaText}>Quer um planejamento feito pra você?</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={handleContactConsultoria}>
            <Text style={styles.ctaButtonText}>Conhecer Consultoria TcFit</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Fechar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12' },
  content: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 70, paddingBottom: 40 },
  trophy: { fontSize: 56, marginBottom: 8 },
  title: { color: '#F5F5F7', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  subtitle: { color: '#a3a3a3', fontSize: 13 },
  projectName: { color: ACCENT, fontSize: 18, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  days: { color: '#737373', fontSize: 12, fontWeight: '700', marginTop: 8, letterSpacing: 1 },
  statsCard: { width: '100%', backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 16, marginTop: 24 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0F0F12' },
  statLabel: { color: '#a3a3a3', fontSize: 12 },
  statValue: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  ctaCard: { width: '100%', backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: ACCENT, borderRadius: 14, padding: 16, marginTop: 20, alignItems: 'center' },
  ctaText: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  ctaButton: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  ctaButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  closeButton: { marginTop: 20, paddingVertical: 10 },
  closeButtonText: { color: '#737373', fontSize: 13, fontWeight: '600' },
});

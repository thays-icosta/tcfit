import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from './supabaseClient';

const ACCENT = '#FF6B00';

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Read-only view for the personal: which Projetos this student is running
// (or finished), current day, and last activity — reuses student_projects
// exactly as the aluno's own dashboard does, just without any action buttons.
export default function PersonalProjectProgressSection({ studentId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sps } = await supabase
        .from('student_projects')
        .select('id, current_day, started_at, completed_at, active, project_templates (name, total_days)')
        .eq('student_id', studentId)
        .order('started_at', { ascending: false });

      const rows = await Promise.all((sps || []).map(async (sp) => {
        const [{ count: treinosConcluidos }, { data: lastCompletion }] = await Promise.all([
          supabase
            .from('student_project_activity_completions')
            .select('workout_id', { count: 'exact', head: true })
            .eq('student_project_id', sp.id)
            .not('completed_at', 'is', null)
            .not('workout_id', 'is', null),
          supabase
            .from('student_project_activity_completions')
            .select('completed_at')
            .eq('student_project_id', sp.id)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        return { ...sp, treinosConcluidos: treinosConcluidos || 0, lastActivityAt: lastCompletion?.completed_at || null };
      }));

      setProjects(rows);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading || projects.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Projetos</Text>
      {projects.map((sp) => {
        const template = sp.project_templates;
        if (!template) return null;
        const pct = Math.min(100, Math.max(0, Math.round((sp.current_day / template.total_days) * 100)));
        return (
          <View key={sp.id} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.name}>{template.name}</Text>
              {sp.completed_at ? (
                <Text style={styles.statusDone}>Concluído</Text>
              ) : (
                <Text style={styles.statusActive}>Em andamento</Text>
              )}
            </View>
            <Text style={styles.dayLabel}>Dia {sp.current_day} de {template.total_days} · {pct}%</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.metaLine}>
              {sp.treinosConcluidos} treino(s) concluído(s) · última atividade {formatDate(sp.lastActivityAt) || '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 14 },
  title: { color: '#F5F5F7', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { marginBottom: 10 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { color: '#F5F5F7', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  statusActive: { color: ACCENT, fontSize: 10, fontWeight: '700' },
  statusDone: { color: '#22c55e', fontSize: 10, fontWeight: '700' },
  dayLabel: { color: '#a3a3a3', fontSize: 11, marginBottom: 6 },
  track: { height: 4, backgroundColor: '#0F0F12', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: ACCENT },
  metaLine: { color: '#737373', fontSize: 10, marginTop: 6 },
});

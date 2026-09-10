import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { supabase } from './supabaseClient';

const ACCENT = '#FF6B00';

// "Meus Projetos" — active multi-day programs (e.g. "Quadríceps Grandes e
// Fortes — 90 Dias") the student is currently running. Lives at the top of
// the aluno's Treinos tab; tapping "Continuar" opens ProjectDashboardScreen.
export default function MeusProjetosSection({ studentId, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('student_projects')
        .select('id, current_day, project_templates (id, name, total_days, cover_image_url)')
        .eq('student_id', studentId)
        .eq('active', true)
        .order('started_at', { ascending: false });
      setProjects(data || []);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading || projects.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>MEUS PROJETOS</Text>
      {projects.map((sp) => {
        const template = sp.project_templates;
        if (!template) return null;
        const pct = Math.min(100, Math.max(0, Math.round((sp.current_day / template.total_days) * 100)));
        return (
          <TouchableOpacity key={sp.id} style={styles.card} onPress={() => onOpenProject(sp.id)} activeOpacity={0.8}>
            {template.cover_image_url ? (
              <Image source={{ uri: template.cover_image_url }} style={styles.cover} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{template.name}</Text>
              <Text style={styles.dayLabel}>Dia {sp.current_day} de {template.total_days} · {pct}%</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
            </View>
            <TouchableOpacity style={styles.continueButton} onPress={() => onOpenProject(sp.id)}>
              <Text style={styles.continueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  sectionTitle: { color: '#737373', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 16, padding: 12, marginBottom: 10 },
  cover: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#1C1C22' },
  coverPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#1C1C22' },
  name: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  dayLabel: { color: '#a3a3a3', fontSize: 11, marginTop: 2, marginBottom: 6 },
  track: { height: 4, backgroundColor: '#0F0F12', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: ACCENT },
  continueButton: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  continueButtonText: { color: '#0F0F12', fontSize: 11, fontWeight: '700' },
});

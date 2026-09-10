import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';
import { buildFullTimeline } from './projectUtils';

const ACCENT = '#FF6B00';

const TYPE_ICON = {
  treino: 'barbell-outline',
  programa: 'layers-outline',
  exercicio: 'body-outline',
  video: 'play-circle-outline',
  conteudo: 'book-outline',
  checklist: 'checkbox-outline',
  recovery: 'bed-outline',
};

// Read-only day-by-day view of the whole journey, grouped by phase — lets
// the student see where they are, what they've done, and what's still
// locked, without spoiling activities they haven't reached yet.
export default function ProjectTimelineScreen({ studentProjectId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: sp } = await supabase.from('student_projects').select('*').eq('id', studentProjectId).single();
      if (!sp) { setLoading(false); return; }
      const { data: phases } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_template_id', sp.project_template_id)
        .order('order_index', { ascending: true });
      const phaseIds = (phases || []).map((p) => p.id);
      const { data: activities } = phaseIds.length > 0
        ? await supabase.from('project_activities').select('*').in('phase_id', phaseIds)
        : { data: [] };
      const activitiesByPhaseId = {};
      (activities || []).forEach((a) => {
        (activitiesByPhaseId[a.phase_id] = activitiesByPhaseId[a.phase_id] || []).push(a);
      });
      setTimeline(buildFullTimeline(phases || [], activitiesByPhaseId, sp.current_day));
      setLoading(false);
    })();
  }, [studentProjectId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title="Linha do Tempo" onBack={onClose} style={{ paddingHorizontal: 16 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {timeline.map(({ phase, days }) => (
          <View key={phase.id} style={styles.phaseBlock}>
            <Text style={styles.phaseTitle}>{phase.name.toUpperCase()}</Text>
            <Text style={styles.phaseSubtitle}>Dias {days[0]?.absoluteDay}–{days[days.length - 1]?.absoluteDay}</Text>
            {days.map((day) => {
              const label = day.activities.length === 0
                ? 'Descanso'
                : day.activities.map((a) => a.title).join(' + ');
              return (
                <View key={day.dayInPhase} style={[styles.dayRow, day.status === 'current' && styles.dayRowCurrent]}>
                  <Ionicons
                    name={day.status === 'done' ? 'checkmark-circle' : day.status === 'current' ? 'arrow-forward-circle' : 'lock-closed'}
                    size={18}
                    color={day.status === 'done' ? '#22c55e' : day.status === 'current' ? ACCENT : '#525252'}
                  />
                  <Text style={styles.dayNumber}>Dia {day.absoluteDay}</Text>
                  {day.status === 'locked' ? (
                    <Text style={styles.dayLabelLocked}>—</Text>
                  ) : (
                    <>
                      {day.activities[0] && (
                        <Ionicons name={TYPE_ICON[day.activities[0].activity_type] || 'ellipse-outline'} size={13} color="#737373" style={{ marginRight: 4 }} />
                      )}
                      <Text style={styles.dayLabel} numberOfLines={1}>{label}</Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  phaseBlock: { marginBottom: 20 },
  phaseTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  phaseSubtitle: { color: '#525252', fontSize: 11, marginBottom: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1C1C22' },
  dayRowCurrent: { backgroundColor: 'rgba(255,107,0,0.08)', borderRadius: 8, paddingHorizontal: 6 },
  dayNumber: { color: '#a3a3a3', fontSize: 12, fontWeight: '700', width: 56 },
  dayLabel: { color: '#F5F5F7', fontSize: 12, flex: 1 },
  dayLabelLocked: { color: '#525252', fontSize: 12, flex: 1 },
});

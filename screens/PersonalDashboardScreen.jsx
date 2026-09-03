import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';

export default function PersonalDashboardScreen({ personalId, onClose, onSelectStudent }) {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [trainedTodayCount, setTrainedTodayCount] = useState(0);
  const [avgWeekly, setAvgWeekly] = useState(0);
  const [attentionList, setAttentionList] = useState([]);
  const [activeList, setActiveList] = useState([]);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      const { data: students } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .eq('personal_id', personalId)
        .eq('role', 'aluno');

      const studentList = students || [];
      setTotalStudents(studentList.length);

      if (studentList.length === 0) {
        setLoading(false);
        return;
      }

      const studentIds = studentList.map((s) => s.id);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: completions } = await supabase
        .from('workout_completions')
        .select('student_id, completed_at')
        .in('student_id', studentIds)
        .gte('completed_at', thirtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false });

      const byStudent = {};
      (completions || []).forEach((c) => {
        if (!byStudent[c.student_id]) byStudent[c.student_id] = [];
        byStudent[c.student_id].push(c.completed_at);
      });

      let trainedToday = 0;
      let totalWeeklySessions = 0;
      const enrichedStudents = studentList.map((s) => {
        const dates = byStudent[s.id] || [];
        const lastTrainedAt = dates.length > 0 ? dates[0] : null;
        const weeklyCount = dates.filter((d) => new Date(d) >= sevenDaysAgo).length;
        const trainedToday_ = dates.some((d) => d.slice(0, 10) === todayStr);
        if (trainedToday_) trainedToday += 1;
        totalWeeklySessions += weeklyCount;

        let daysSince = null;
        if (lastTrainedAt) {
          daysSince = Math.floor((new Date() - new Date(lastTrainedAt)) / (1000 * 60 * 60 * 24));
        }

        return { ...s, lastTrainedAt, weeklyCount, daysSince, trainedToday: trainedToday_ };
      });

      setTrainedTodayCount(trainedToday);
      setAvgWeekly(studentList.length > 0 ? (totalWeeklySessions / studentList.length).toFixed(1) : 0);

      const needsAttention = enrichedStudents
        .filter((s) => s.daysSince === null || s.daysSince >= 3)
        .sort((a, b) => {
          if (a.daysSince === null) return -1;
          if (b.daysSince === null) return 1;
          return b.daysSince - a.daysSince;
        });
      setAttentionList(needsAttention);

      const mostActive = enrichedStudents
        .filter((s) => s.weeklyCount > 0)
        .sort((a, b) => b.weeklyCount - a.weeklyCount)
        .slice(0, 3);
      setActiveList(mostActive);

      setLoading(false);
    })();
  }, [personalId]);

  return (
    <View style={styles.container}>
      <HeaderBack title="Painel Geral" onBack={onClose} />

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
      ) : totalStudents === 0 ? (
        <Text style={styles.emptyText}>Convide alunos pra começar a ver estatísticas aqui.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalStudents}</Text>
              <Text style={styles.statLabel}>alunos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{trainedTodayCount}/{totalStudents}</Text>
              <Text style={styles.statLabel}>treinaram hoje</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{avgWeekly}</Text>
              <Text style={styles.statLabel}>média semanal</Text>
            </View>
          </View>

          {attentionList.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>⚠️ Precisam de atenção</Text>
              {attentionList.map((s) => (
                <TouchableOpacity key={s.id} style={styles.studentRow} onPress={() => onSelectStudent(s)}>
                  <View style={styles.avatarCircle}>
                    {s.avatar_url ? (
                      <Image source={{ uri: s.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarLetter}>{s.name?.charAt(0).toUpperCase() || '?'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{s.name}</Text>
                    <Text style={styles.attentionText}>
                      {s.daysSince === null ? 'Nunca treinou' : `${s.daysSince} dia${s.daysSince !== 1 ? 's' : ''} sem treinar`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {activeList.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>🔥 Mais ativos essa semana</Text>
              {activeList.map((s) => (
                <TouchableOpacity key={s.id} style={styles.studentRow} onPress={() => onSelectStudent(s)}>
                  <View style={styles.avatarCircle}>
                    {s.avatar_url ? (
                      <Image source={{ uri: s.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarLetter}>{s.name?.charAt(0).toUpperCase() || '?'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{s.name}</Text>
                    <Text style={styles.activeText}>{s.weeklyCount}x essa semana</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  statValue: { color: '#f97316', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 4, textAlign: 'center' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  avatarImage: { width: 40, height: 40 },
  avatarLetter: { color: '#f97316', fontSize: 16, fontWeight: '800' },
  studentName: { color: '#f5f5f5', fontSize: 14, fontWeight: '600' },
  attentionText: { color: '#ef4444', fontSize: 11, marginTop: 2 },
  activeText: { color: '#22c55e', fontSize: 11, marginTop: 2 },
});
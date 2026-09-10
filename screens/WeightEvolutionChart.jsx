import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { supabase } from './supabaseClient';

const ACCENT = '#FF6B00';

function formatShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Self-contained like the other reusable sub-widgets in this codebase — just
// hand it a studentId and it loads its own data. Used both on the aluno's own
// Home and on the personal's student-detail screen.
export default function WeightEvolutionChart({ studentId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: assessments }, { data: entries }] = await Promise.all([
        supabase
          .from('physical_assessments')
          .select('weight_kg, created_at')
          .eq('student_id', studentId)
          .not('weight_kg', 'is', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('weight_entries')
          .select('weight_kg, entry_date')
          .eq('student_id', studentId)
          .order('entry_date', { ascending: true }),
      ]);

      // Merge both sources (periodic professional assessments + daily
      // self-logged weight) into one chronological-by-day series. When both
      // exist for the same day, the self-logged entry wins (it's what the
      // student just typed in and expects to see reflected immediately).
      const byDate = new Map();
      (assessments || []).forEach((r) => {
        byDate.set(r.created_at.slice(0, 10), { created_at: r.created_at, weight_kg: r.weight_kg });
      });
      (entries || []).forEach((r) => {
        byDate.set(r.entry_date, { created_at: r.entry_date, weight_kg: r.weight_kg });
      });
      const merged = Array.from(byDate.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));

      setRows(merged);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) {
    return <ActivityIndicator color={ACCENT} style={{ marginVertical: 20 }} />;
  }

  if (rows.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.title}>Evolução do Aluno</Text>
        <Text style={styles.emptyText}>Ainda não há avaliações físicas com peso registrado.</Text>
      </View>
    );
  }

  const chartData = rows.map((r) => ({ date: formatShortDate(r.created_at), weight: Number(r.weight_kg) }));
  const lastPoint = chartData[chartData.length - 1];

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.title}>Evolução do Aluno</Text>
        <Text style={styles.emptyText}>Peso atual: {lastPoint.weight} kg</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.headerRow} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <Text style={styles.title}>Evolução do Aluno</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#737373" />
      </TouchableOpacity>
      {expanded && (
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 24, right: 20, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2B2B36" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} axisLine={{ stroke: '#2B2B36' }} tickLine={false} />
              <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C1C22', border: '1px solid #2B2B36', borderRadius: 8 }}
                labelStyle={{ color: '#a3a3a3' }}
                itemStyle={{ color: ACCENT }}
                formatter={(value) => [`${value} kg`, 'Peso']}
              />
              <Line type="monotone" dataKey="weight" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5 }} />
              <ReferenceDot
                x={lastPoint.date}
                y={lastPoint.weight}
                r={5}
                fill={ACCENT}
                stroke="#1C1C22"
                strokeWidth={2}
                label={{ value: `${lastPoint.weight} kg`, position: 'top', fill: ACCENT, fontSize: 12, fontWeight: 700 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: '#F5F5F7', fontSize: 14, fontWeight: '700' },
  emptyBox: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 14, padding: 14, marginBottom: 16 },
  emptyText: { color: '#525252', fontSize: 12, marginTop: 8 },
});

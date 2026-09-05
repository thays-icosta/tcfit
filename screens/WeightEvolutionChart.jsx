import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { supabase } from './supabaseClient';

const ACCENT = '#E05A17';

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('physical_assessments')
        .select('weight_kg, created_at')
        .eq('student_id', studentId)
        .not('weight_kg', 'is', null)
        .order('created_at', { ascending: true });
      setRows(data || []);
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
      <Text style={styles.title}>Evolução do Aluno</Text>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 24, right: 20, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#737373', fontSize: 10 }} axisLine={{ stroke: '#292524' }} tickLine={false} />
            <YAxis tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#171717', border: '1px solid #292524', borderRadius: 8 }}
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
              stroke="#171717"
              strokeWidth={2}
              label={{ value: `${lastPoint.weight} kg`, position: 'top', fill: ACCENT, fontSize: 12, fontWeight: 700 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 16 },
  title: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  emptyBox: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 16 },
  emptyText: { color: '#525252', fontSize: 12, marginTop: 8 },
});

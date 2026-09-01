import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { PROGRAM_GOALS, TRAINING_LOCATIONS, PAIN_ZONES } from './accessLevel';

export default function AnamneseViewScreen({ studentId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState(null);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: responseRow }, { data: answerRows }] = await Promise.all([
        supabase.from('anamnese_responses').select('*').eq('student_id', studentId).maybeSingle(),
        supabase.from('anamnese_answers').select('answer_text, anamnese_questions (question_text)').eq('student_id', studentId),
      ]);
      setResponse(responseRow || null);
      setAnswers((answerRows || []).filter((a) => a.answer_text));
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Anamnese</Text>
      </View>

      {!response || !response.completed_at ? (
        <Text style={styles.emptyText}>O aluno ainda não preencheu a anamnese.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Objetivo Principal</Text>
            <Text style={styles.fieldValue}>{PROGRAM_GOALS.find((g) => g.value === response.main_goal)?.label || '—'}</Text>

            <Text style={styles.fieldLabel}>Local de Treino</Text>
            <Text style={styles.fieldValue}>{TRAINING_LOCATIONS.find((l) => l.value === response.training_location)?.label || '—'}</Text>

            <Text style={styles.fieldLabel}>Lesões / Problemas de Saúde</Text>
            <Text style={styles.fieldValue}>{response.health_issues || 'Nenhuma relatada'}</Text>

            <Text style={styles.fieldLabel}>Zonas de Dor</Text>
            {response.pain_zones && response.pain_zones.length > 0 ? (
              <View style={styles.zoneRow}>
                {response.pain_zones.map((z) => (
                  <View key={z} style={styles.zoneBadge}>
                    <Text style={styles.zoneBadgeText}>{PAIN_ZONES.find((p) => p.value === z)?.label || z}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>Nenhuma</Text>
            )}
          </View>

          {answers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Perguntas Extras</Text>
              {answers.map((a, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.fieldLabel}>{a.anamnese_questions?.question_text}</Text>
                  <Text style={styles.fieldValue}>{a.answer_text}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30, paddingHorizontal: 16 },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 12 },
  fieldLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  fieldValue: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  zoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  zoneBadge: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  zoneBadgeText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },
});

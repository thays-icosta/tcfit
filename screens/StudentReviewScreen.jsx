import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';
import { requestStudentReview } from './aiCopilot';
import { BulletListCard, ImprovementCard, ReferencesCard } from './EvidenceBlocks';

const SECTIONS = [
  { key: 'objetivo', title: 'Objetivo' },
  { key: 'frequencia', title: 'Frequência' },
  { key: 'volume', title: 'Volume' },
  { key: 'progressao', title: 'Progressão' },
];

const STATUS = {
  ok: { icon: 'checkmark-circle', color: '#22c55e', label: 'Em linha' },
  atencao: { icon: 'alert-circle', color: '#f59e0b', label: 'Atenção' },
  insuficiente: { icon: 'help-circle', color: '#A7AAB0', label: 'Dados insuficientes' },
};

// "Revisar Aluno": a read-only x-ray of the student — goal, frequency, volume
// and progression at a glance, plus positives, attention points, restrictions
// and evidence-backed suggestions. It never changes anything; the personal
// reads it and decides. Nothing is stored — close the screen and it's gone.
export default function StudentReviewScreen({ studentId, studentName, onClose }) {
  const [phase, setPhase] = useState('loading'); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState('');
  const [review, setReview] = useState(null);
  const runIdRef = useRef(0);

  const run = async () => {
    const runId = ++runIdRef.current;
    setPhase('loading');
    try {
      const result = await requestStudentReview(supabase, { studentId });
      if (runId !== runIdRef.current) return;
      setReview(result);
      setPhase('ready');
    } catch (e) {
      if (runId !== runIdRef.current) return;
      setErrorMessage(e.message || 'Não consegui revisar o aluno agora.');
      setPhase('error');
    }
  };

  useEffect(() => {
    run();
    return () => { runIdRef.current += 1; };
  }, []);

  return (
    <View style={styles.container}>
      <HeaderBack backLabel="← Voltar" title="Revisão do aluno" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {!!studentName && <Text style={styles.studentName}>{studentName}</Text>}

        {phase === 'loading' && (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.stateTitle}>Revisando o aluno…</Text>
            <Text style={styles.stateText}>Lendo o perfil, a ficha, o histórico de cargas, o volume e a frequência. Pode levar alguns segundos.</Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.stateBox}>
            <Ionicons name="alert-circle-outline" size={28} color="#f59e0b" />
            <Text style={styles.stateTitle}>Não consegui revisar agora</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={run}>
              <Text style={styles.retryText}>Tentar de novo</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'ready' && review && (
          <>
            {!!review.resumo && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Resumo</Text>
                <Text style={styles.summaryText}>{review.resumo}</Text>
              </View>
            )}

            <Text style={styles.blockTitle}>Panorama</Text>
            <View style={styles.card}>
              {SECTIONS.map((sec, i) => {
                const data = review.secoes?.[sec.key];
                const st = STATUS[data?.status] || STATUS.insuficiente;
                return (
                  <View key={sec.key} style={[styles.panoramaRow, i > 0 && styles.panoramaRowBorder]}>
                    <Ionicons name={st.icon} size={20} color={st.color} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.panoramaHeader}>
                        <Text style={styles.panoramaTitle}>{sec.title}</Text>
                        <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
                      </View>
                      {!!data?.texto && <Text style={styles.panoramaText}>{data.texto}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            <BulletListCard title="Pontos positivos" list={review.pontosPositivos} icon="checkmark-circle" color="#22c55e" />
            <BulletListCard title="Pontos de atenção" list={review.pontosDeAtencao} icon="alert-circle" color="#f59e0b" />
            <BulletListCard title="Restrições e cuidados" list={review.restricoes} icon="warning" color="#ef4444" />
            <BulletListCard title="Dados insuficientes" list={review.dadosInsuficientes} icon="help-circle" color="#A7AAB0" />

            {review.sugestoes?.length > 0 && (
              <>
                <Text style={styles.blockTitle}>Sugestões{review.objetivo ? ` para o objetivo: ${review.objetivo}` : ''}</Text>
                {review.sugestoes.map((s, i) => <ImprovementCard key={`s${i}`} item={s} referencias={review.referencias} />)}
              </>
            )}

            <ReferencesCard referencias={review.referencias} verifiedAt={review.fontesVerificadasEm} />

            <TouchableOpacity style={styles.refreshButton} onPress={run}>
              <Ionicons name="refresh" size={15} color="#FFFFFF" />
              <Text style={styles.refreshText}>Revisar de novo</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Leitura informativa gerada por IA a partir dos dados do aluno. Nada é alterado por aqui, e ela não substitui a sua avaliação.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 50 },
  studentName: { color: '#A7AAB0', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  stateBox: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 22, alignItems: 'center', gap: 8, marginTop: 8 },
  stateTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stateText: { color: '#A7AAB0', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#08090B', fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 14, marginBottom: 10 },
  sectionTitle: { color: '#A7AAB0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  summaryText: { color: '#FFFFFF', fontSize: 14, lineHeight: 21 },
  blockTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  panoramaRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  panoramaRowBorder: { borderTopWidth: 1, borderTopColor: '#292D34' },
  panoramaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 },
  panoramaTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  panoramaText: { color: '#D1D5DB', fontSize: 12, lineHeight: 18 },
  refreshButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 10, paddingVertical: 12, minHeight: 44, marginTop: 4 },
  refreshText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disclaimer: { color: '#737373', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});

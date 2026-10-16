import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';
import { useSpeechToText } from './useSpeechToText';
import { requestWorkoutProposal, createFichaFromProposal } from './aiCopilot';
import { BulletListCard, ReferencesCard, SourceChips, CONFIDENCE_LABEL, CONFIDENCE_COLOR } from './EvidenceBlocks';

const GROUP_LABEL = {
  quadriceps: 'Quadríceps', isquiotibiais: 'Posterior', gluteo: 'Glúteo', panturrilha: 'Panturrilha', peito: 'Peito',
  costas: 'Costas', ombro: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', 'antebraço': 'Antebraço',
  trapezio: 'Trapézio', lombar: 'Lombar', abdomen: 'Abdômen', aerobico: 'Aeróbico',
};

// "Montar com IA" in two steps. Step 1: the AI reads the student and the
// personal's request and PROPOSES a structure (treinos, focus, muscle groups,
// exercises/sets/reps/rest) in plain text — nothing is created. Step 2: only
// after the personal approves (and can untick treinos), each approved treino is
// built by picking exercises from the personal's own library and saved as a new
// ficha in the current week. Existing fichas are never touched.
export default function AiWorkoutBuilderScreen({ studentId, personalId, phaseId, onClose }) {
  const [step, setStep] = useState('input'); // input | proposing | proposal | generate
  const [instruction, setInstruction] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [proposal, setProposal] = useState(null);
  const [selected, setSelected] = useState([]); // boolean per proposed treino
  const [results, setResults] = useState([]); // per treino: { state: 'idle'|'running'|'ok'|'error', ... }
  const [running, setRunning] = useState(false);
  const aliveRef = useRef(true);
  const runIdRef = useRef(0);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const { recording, toggle: toggleRecording } = useSpeechToText({
    active: step === 'input',
    getBaseText: () => instruction,
    onTranscriptChange: setInstruction,
  });

  const propose = async () => {
    const runId = ++runIdRef.current;
    setErrorMessage('');
    setStep('proposing');
    try {
      const result = await requestWorkoutProposal(supabase, { studentId, instruction });
      if (!aliveRef.current || runId !== runIdRef.current) return;
      setProposal(result);
      setSelected(result.estrutura.map(() => true));
      setResults(result.estrutura.map(() => ({ state: 'idle' })));
      setStep('proposal');
    } catch (e) {
      if (!aliveRef.current || runId !== runIdRef.current) return;
      setErrorMessage(e.message || 'Não consegui montar a proposta agora.');
      setStep('input');
    }
  };

  const runGeneration = async (indexes) => {
    setRunning(true);
    for (const i of indexes) {
      if (!aliveRef.current) return;
      setResults((prev) => prev.map((r, k) => (k === i ? { state: 'running' } : r)));
      let outcome;
      try {
        outcome = await createFichaFromProposal(supabase, {
          treino: proposal.estrutura[i],
          objetivo: proposal.objetivo,
          studentId,
          personalId,
          phaseId,
        });
      } catch (e) {
        outcome = { ok: false, error: e.message || 'Algo deu errado ao montar esta ficha.' };
      }
      if (!aliveRef.current) return;
      setResults((prev) => prev.map((r, k) => (k === i ? (outcome.ok ? { state: 'ok', ...outcome } : { state: 'error', error: outcome.error }) : r)));
    }
    setRunning(false);
  };

  const startGeneration = () => {
    const indexes = selected.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (indexes.length === 0) return;
    setStep('generate');
    runGeneration(indexes);
  };

  const retryFailed = () => {
    const indexes = results.map((r, i) => (selected[i] && r.state === 'error' ? i : -1)).filter((i) => i >= 0);
    if (indexes.length > 0) runGeneration(indexes);
  };

  const firstCreatedId = () => results.find((r) => r.state === 'ok')?.workoutId || null;

  const back = () => {
    if (step === 'generate') {
      if (!running) onClose(firstCreatedId());
    } else if (step === 'proposal') {
      setStep('input');
    } else if (step === 'proposing') {
      runIdRef.current += 1; // abandon the pending request
      setStep('input');
    } else {
      onClose(null);
    }
  };

  const selectedCount = selected.filter(Boolean).length;
  const failedCount = results.filter((r, i) => selected[i] && r.state === 'error').length;

  const stepLabel = step === 'generate' ? 'Etapa 2 de 2 · Montando as fichas' : step === 'proposal' || step === 'proposing' ? 'Etapa 1 de 2 · Proposta' : 'Etapa 1 de 2 · Seu pedido';

  return (
    <View style={styles.container}>
      <HeaderBack backLabel={step === 'generate' ? (running ? '' : '← Fechar') : '← Voltar'} title="Montar com IA" onBack={back} style={{ paddingHorizontal: 16 }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>{stepLabel}</Text>

        {step === 'input' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Como funciona</Text>
              <Text style={styles.bodyText}>
                Primeiro a IA lê o perfil do aluno e o seu pedido e propõe a <Text style={styles.bold}>estrutura</Text> dos treinos — sem escolher exercícios ainda. Você confere, ajusta se quiser e só então ela monta as fichas, usando apenas exercícios da sua biblioteca. Nada é criado antes da sua aprovação.
              </Text>
            </View>

            <Text style={styles.label}>Seu pedido (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder='ex: "3 treinos na semana, foco em glúteo e quadríceps, 6 exercícios cada, séries de 8 a 12"'
              placeholderTextColor="#525252"
              value={instruction}
              onChangeText={setInstruction}
              multiline
              maxLength={600}
              accessibilityLabel="Pedido para a IA"
            />
            <Text style={styles.hint}>Pode deixar em branco: a IA propõe a partir do perfil do aluno (objetivo, nível, frequência e restrições).</Text>

            <TouchableOpacity style={[styles.micButton, recording && styles.micButtonActive]} onPress={toggleRecording}>
              <Ionicons name={recording ? 'mic' : 'mic-outline'} size={18} color={recording ? '#ef4444' : '#A7AAB0'} />
              <Text style={[styles.micText, recording && { color: '#ef4444' }]}>{recording ? 'Gravando... toque pra parar' : 'Falar em vez de digitar'}</Text>
            </TouchableOpacity>

            {!!errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={propose}>
              <Text style={styles.primaryButtonText}>{errorMessage ? 'Tentar de novo' : 'Propor estrutura'}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'proposing' && (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.stateTitle}>Entendendo o contexto…</Text>
            <Text style={styles.stateText}>Lendo o perfil, as restrições, o histórico e a sua biblioteca para propor a estrutura. Pode levar alguns segundos.</Text>
          </View>
        )}

        {step === 'proposal' && proposal && (
          <>
            {proposal.entendimento?.length > 0 && <BulletListCard title="Entendi este contexto" list={proposal.entendimento} icon="chevron-forward-circle" color="#A7AAB0" />}

            <Text style={styles.blockTitle}>Proponho esta estrutura</Text>
            {proposal.estrutura.length === 0 ? (
              <View style={styles.stateBox}>
                <Ionicons name="alert-circle-outline" size={26} color="#f59e0b" />
                <Text style={styles.stateTitle}>Não consegui propor uma estrutura</Text>
                <Text style={styles.stateText}>Com a sua biblioteca e esse pedido não deu para montar treinos. Ajuste o pedido e tente de novo.</Text>
              </View>
            ) : (
              proposal.estrutura.map((t, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.workoutCard, !selected[i] && styles.workoutCardOff]}
                  onPress={() => setSelected((prev) => prev.map((v, k) => (k === i ? !v : v)))}
                  accessibilityLabel={`${selected[i] ? 'Desmarcar' : 'Incluir'} treino ${i + 1}`}
                  activeOpacity={0.8}
                >
                  <View style={styles.workoutHeader}>
                    <View style={[styles.checkbox, selected[i] && styles.checkboxOn]}>
                      {selected[i] && <Ionicons name="checkmark" size={16} color="#08090B" />}
                    </View>
                    <Text style={styles.workoutName}>{t.nome}</Text>
                  </View>
                  {!!t.foco && <Text style={styles.workoutFocus}>{t.foco}</Text>}
                  <View style={styles.groupRow}>
                    {t.grupos.map((g) => <Text key={g} style={styles.groupChip}>{GROUP_LABEL[g] || g}</Text>)}
                  </View>
                  <Text style={styles.workoutMeta}>
                    {t.numExercicios} exercícios · {t.seriesPorExercicio} séries de {t.repeticoes} · {t.descansoSeg}s de descanso
                  </Text>
                  <Text style={styles.workoutTotal}>{t.seriesTotais} séries no total</Text>
                  {t.evitar.length > 0 && <Text style={styles.avoidText}>Evitar: {t.evitar.join('; ')}</Text>}
                </TouchableOpacity>
              ))
            )}

            {!!proposal.porQue && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Por que essa estrutura</Text>
                  <Text style={[styles.confChip, { color: CONFIDENCE_COLOR[proposal.confianca], borderColor: CONFIDENCE_COLOR[proposal.confianca] }]}>
                    {CONFIDENCE_LABEL[proposal.confianca]}
                  </Text>
                </View>
                <Text style={styles.bodyText}>{proposal.porQue}</Text>
                <SourceChips numbers={proposal.fontes} referencias={proposal.referencias} />
              </View>
            )}

            <BulletListCard title="Pontos de atenção" list={proposal.pontosDeAtencao} icon="alert-circle" color="#f59e0b" />
            <BulletListCard title="Dados insuficientes" list={proposal.dadosInsuficientes} icon="help-circle" color="#A7AAB0" />
            <ReferencesCard referencias={proposal.referencias} verifiedAt={proposal.fontesVerificadasEm} />

            {proposal.estrutura.length > 0 && (
              <Text style={styles.note}>As fichas serão criadas na semana atual, sem apagar nenhuma ficha existente. Depois é só editar como qualquer outra.</Text>
            )}

            {proposal.estrutura.length > 0 && (
              <TouchableOpacity style={[styles.primaryButton, selectedCount === 0 && styles.buttonDisabled]} onPress={startGeneration} disabled={selectedCount === 0}>
                <Text style={styles.primaryButtonText}>
                  {selectedCount === 0 ? 'Marque ao menos um treino' : `Gerar ${selectedCount} ficha${selectedCount !== 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('input')}>
              <Text style={styles.secondaryButtonText}>Ajustar pedido</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'generate' && (
          <>
            <Text style={styles.blockTitle}>{running ? 'Montando as fichas…' : failedCount > 0 ? 'Algumas fichas não saíram' : 'Fichas criadas'}</Text>
            {proposal.estrutura.map((t, i) => {
              if (!selected[i]) return null;
              const r = results[i] || { state: 'idle' };
              return (
                <View key={i} style={[styles.resultRow, r.state === 'ok' && styles.resultRowOk, r.state === 'error' && styles.resultRowError]}>
                  <View style={styles.resultIcon}>
                    {r.state === 'running' ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : r.state === 'ok' ? <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                      : r.state === 'error' ? <Ionicons name="close-circle" size={22} color="#ef4444" />
                      : <Ionicons name="ellipse-outline" size={22} color="#525252" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{t.nome}</Text>
                    {r.state === 'idle' && <Text style={styles.resultText}>Na fila</Text>}
                    {r.state === 'running' && <Text style={styles.resultText}>Escolhendo exercícios da sua biblioteca…</Text>}
                    {r.state === 'ok' && (
                      <Text style={styles.resultText}>
                        {r.exerciseCount} exercício{r.exerciseCount !== 1 ? 's' : ''} adicionado{r.exerciseCount !== 1 ? 's' : ''}
                        {r.missing > 0 ? ` (${r.missing} a menos que o proposto: a biblioteca não tinha mais)` : ''}
                      </Text>
                    )}
                    {r.state === 'error' && <Text style={[styles.resultText, { color: '#ef4444' }]}>{r.error}</Text>}
                  </View>
                </View>
              );
            })}

            {!running && failedCount > 0 && (
              <TouchableOpacity style={styles.secondaryButton} onPress={retryFailed}>
                <Text style={styles.secondaryButtonText}>Tentar de novo {failedCount === 1 ? 'a que falhou' : 'as que falharam'}</Text>
              </TouchableOpacity>
            )}
            {!running && (
              <TouchableOpacity style={styles.primaryButton} onPress={() => onClose(firstCreatedId())}>
                <Text style={styles.primaryButtonText}>{firstCreatedId() ? 'Ver as fichas' : 'Fechar'}</Text>
              </TouchableOpacity>
            )}
            {!running && (
              <Text style={styles.note}>Revise cada ficha antes de passar ao aluno: a IA só escolhe exercícios e ordem; séries, repetições e descanso seguem o que você aprovou.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 50 },
  stepLabel: { color: '#A7AAB0', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { color: '#A7AAB0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  bodyText: { color: '#FFFFFF', fontSize: 13, lineHeight: 20 },
  bold: { fontWeight: '800' },
  label: { color: '#A7AAB0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 96, textAlignVertical: 'top' },
  hint: { color: '#737373', fontSize: 11, lineHeight: 16, marginTop: 6 },
  micButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#292D34', borderRadius: 10, paddingVertical: 12, marginTop: 12, minHeight: 44 },
  micButtonActive: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  micText: { color: '#A7AAB0', fontSize: 12, fontWeight: '600' },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: 10, padding: 12, marginTop: 14 },
  errorText: { color: '#f59e0b', fontSize: 12, lineHeight: 18, flex: 1 },
  primaryButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50, marginTop: 16 },
  primaryButtonText: { color: '#08090B', fontSize: 15, fontWeight: '800' },
  buttonDisabled: { opacity: 0.4 },
  secondaryButton: { borderWidth: 1, borderColor: '#3A3F48', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 10 },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  stateBox: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 22, alignItems: 'center', gap: 8, marginTop: 8 },
  stateTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stateText: { color: '#A7AAB0', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  blockTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  workoutCard: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  workoutCardOff: { borderColor: '#292D34', opacity: 0.5 },
  workoutHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#5A6070', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  workoutName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1 },
  workoutFocus: { color: '#D1D5DB', fontSize: 12, marginTop: 8 },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  groupChip: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  workoutMeta: { color: '#A7AAB0', fontSize: 12, marginTop: 10 },
  workoutTotal: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginTop: 2 },
  avoidText: { color: '#f59e0b', fontSize: 11, lineHeight: 16, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  confChip: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 8 },
  note: { color: '#737373', fontSize: 11, lineHeight: 16, marginTop: 12, textAlign: 'center' },
  resultRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 12, padding: 14, marginBottom: 8 },
  resultRowOk: { borderColor: 'rgba(34,197,94,0.5)' },
  resultRowError: { borderColor: 'rgba(239,68,68,0.5)' },
  resultIcon: { width: 24, alignItems: 'center' },
  resultName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  resultText: { color: '#A7AAB0', fontSize: 12, lineHeight: 17, marginTop: 2 },
});

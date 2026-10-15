import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';
import { METHODS, METHOD_LABELS } from './exerciseMethods';
import { requestWorkoutAnalysis, applyAdjustment, parseAdjustmentValue, FIELD_LABEL } from './aiCopilot';
import { SourceChips, ImprovementCard, BulletListCard, ReferencesCard, CONFIDENCE_LABEL, CONFIDENCE_COLOR } from './EvidenceBlocks';

const KEYBOARD_BY_FIELD = { series: 'number-pad', descansoSeg: 'number-pad', cargaKg: 'decimal-pad', reps: 'numbers-and-punctuation' };

function formatValue(campo, value) {
  if (value == null || value === '') return '—';
  if (campo === 'metodo') return METHOD_LABELS[value] || value;
  if (campo === 'cargaKg') return `${String(value).replace('.', ',')} kg`;
  if (campo === 'descansoSeg') return `${value}s`;
  return String(value);
}

// "Analisar Treino": the AI reads the student's context plus this ficha and
// proposes small adjustments. Nothing changes until the personal taps
// "Aplicar" (or edits the value first) on a specific suggestion — and even
// then only that one field of that one exercise is written. Suggestions are
// shown here and discarded when the screen closes; nothing is stored.
export default function WorkoutAnalysisScreen({ studentId, workoutName, items, onClose }) {
  const [phase, setPhase] = useState('loading'); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [refToItemId, setRefToItemId] = useState({});
  const [status, setStatus] = useState({}); // adjustment id -> 'applied' | 'ignored'
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [busyId, setBusyId] = useState(null);
  const changedRef = useRef(false); // did anything get written? (tells the ficha to reload)
  const runIdRef = useRef(0);

  const run = async () => {
    const runId = ++runIdRef.current;
    setPhase('loading');
    try {
      const result = await requestWorkoutAnalysis(supabase, { studentId, workoutName, items });
      if (runId !== runIdRef.current) return;
      setAnalysis(result.analysis);
      setRefToItemId(result.refToItemId);
      setStatus({});
      setEditingId(null);
      setPhase('ready');
    } catch (e) {
      if (runId !== runIdRef.current) return;
      setErrorMessage(e.message || 'Não consegui analisar o treino agora.');
      setPhase('error');
    }
  };

  useEffect(() => {
    run();
    return () => { runIdRef.current += 1; };
  }, []);

  const close = () => onClose(changedRef.current);

  const write = async (adj, valor) => {
    const itemId = refToItemId[adj.ref];
    setBusyId(adj.id);
    const { error } = await applyAdjustment(supabase, { itemId, campo: adj.campo, valor });
    setBusyId(null);
    if (error) {
      showAlert('Não deu pra aplicar', error.message || 'Tenta de novo.');
      return false;
    }
    changedRef.current = true;
    return true;
  };

  const handleApply = async (adj, valor = adj.valorSugerido) => {
    if (busyId) return;
    if (await write(adj, valor)) {
      setStatus((prev) => ({ ...prev, [adj.id]: { state: 'applied', value: valor } }));
      setEditingId(null);
    }
  };

  const handleUndo = async (adj) => {
    if (busyId) return;
    if (await write(adj, adj.atual)) {
      setStatus((prev) => {
        const next = { ...prev };
        delete next[adj.id];
        return next;
      });
    }
  };

  const startEdit = (adj) => {
    setEditingId(adj.id);
    setEditValue(adj.valorSugerido == null ? '' : String(adj.valorSugerido).replace('.', adj.campo === 'cargaKg' ? ',' : '.'));
  };

  const confirmEdit = (adj) => {
    const value = parseAdjustmentValue(adj.campo, editValue);
    if (value == null) {
      showAlert('Valor inválido', `Confira o valor de "${FIELD_LABEL[adj.campo]}". Exemplos: séries 3, reps 8-10, carga 62,5, descanso 90.`);
      return;
    }
    handleApply(adj, value);
  };

  const renderImprovement = (m, i) => <ImprovementCard key={`m${i}`} item={m} referencias={analysis.referencias} />;

  const renderList = (title, list, icon, color) => <BulletListCard title={title} list={list} icon={icon} color={color} />;

  const renderAdjustment = (adj) => {
    const st = status[adj.id];
    const applied = st?.state === 'applied';
    const ignored = st?.state === 'ignored';
    const editing = editingId === adj.id;
    const busy = busyId === adj.id;

    return (
      <View key={adj.id} style={[styles.adjCard, applied && styles.adjCardApplied, ignored && styles.adjCardIgnored]}>
        <View style={styles.adjHeader}>
          <Text style={styles.adjExercise} numberOfLines={1}>{adj.exercicio || 'Recomendação geral'}</Text>
          <Text style={[styles.confChip, { color: CONFIDENCE_COLOR[adj.confianca], borderColor: CONFIDENCE_COLOR[adj.confianca] }]}>
            {CONFIDENCE_LABEL[adj.confianca]}
          </Text>
        </View>

        <Text style={styles.adjSuggestion}>{adj.sugestao}</Text>

        {adj.aplicavel && (
          <View style={[styles.changeRow, adj.campo === 'observacao' && styles.changeRowStack]}>
            <Text style={styles.changeField}>{FIELD_LABEL[adj.campo]}</Text>
            <Text style={[styles.changeValues, adj.campo === 'observacao' && styles.changeValuesStack]}>
              {formatValue(adj.campo, adj.atual)}  →  <Text style={styles.changeNew}>{formatValue(adj.campo, applied ? st.value : adj.valorSugerido)}</Text>
            </Text>
          </View>
        )}

        {!!adj.motivo && (
          <View style={styles.adjBlock}>
            <Text style={styles.adjLabel}>Motivo</Text>
            <Text style={styles.adjText}>{adj.motivo}</Text>
          </View>
        )}
        {!!adj.impacto && (
          <View style={styles.adjBlock}>
            <Text style={styles.adjLabel}>Impacto esperado</Text>
            <Text style={styles.adjText}>{adj.impacto}</Text>
          </View>
        )}
        <SourceChips numbers={adj.fontes} referencias={analysis.referencias} />

        {applied ? (
          <View style={styles.statusRow}>
            <Text style={styles.appliedText}>✓ Aplicado na ficha</Text>
            <TouchableOpacity onPress={() => handleUndo(adj)} disabled={!!busyId} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.linkText}>Desfazer</Text>}
            </TouchableOpacity>
          </View>
        ) : ignored ? (
          <View style={styles.statusRow}>
            <Text style={styles.ignoredText}>Ignorado</Text>
            <TouchableOpacity onPress={() => setStatus((prev) => { const n = { ...prev }; delete n[adj.id]; return n; })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.linkText}>Desfazer</Text>
            </TouchableOpacity>
          </View>
        ) : editing ? (
          <View style={styles.editBox}>
            <Text style={styles.adjLabel}>{FIELD_LABEL[adj.campo]} — valor que você quer aplicar</Text>
            {adj.campo === 'metodo' ? (
              <View style={styles.methodRow}>
                {METHODS.map((m) => (
                  <TouchableOpacity key={m} style={[styles.methodChip, editValue === m && styles.methodChipActive]} onPress={() => setEditValue(m)}>
                    <Text style={[styles.methodChipText, editValue === m && styles.methodChipTextActive]}>{METHOD_LABELS[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.editInput}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType={KEYBOARD_BY_FIELD[adj.campo]}
                selectTextOnFocus
                autoFocus
                placeholderTextColor="#525252"
              />
            )}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.btnPrimary, busy && { opacity: 0.6 }]} onPress={() => confirmEdit(adj)} disabled={!!busyId}>
                {busy ? <ActivityIndicator color="#08090B" size="small" /> : <Text style={styles.btnPrimaryText}>Aplicar valor</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setEditingId(null)} disabled={!!busyId}>
                <Text style={styles.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            {adj.aplicavel && (
              <>
                <TouchableOpacity style={[styles.btnPrimary, busy && { opacity: 0.6 }]} onPress={() => handleApply(adj)} disabled={!!busyId}>
                  {busy ? <ActivityIndicator color="#08090B" size="small" /> : <Text style={styles.btnPrimaryText}>Aplicar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhost} onPress={() => startEdit(adj)} disabled={!!busyId}>
                  <Text style={styles.btnGhostText}>Editar</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.btnGhost} onPress={() => setStatus((prev) => ({ ...prev, [adj.id]: { state: 'ignored' } }))} disabled={!!busyId}>
              <Text style={styles.btnGhostText}>{adj.aplicavel ? 'Ignorar' : 'Entendi'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HeaderBack backLabel="← Voltar" title="Análise do treino" onBack={close} style={{ paddingHorizontal: 16 }} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.workoutName}>{workoutName}</Text>

        {phase === 'loading' && (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.stateTitle}>Analisando o treino…</Text>
            <Text style={styles.stateText}>Cruzando a ficha com o perfil, o histórico de cargas, o volume e a frequência do aluno. Pode levar alguns segundos.</Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.stateBox}>
            <Ionicons name="alert-circle-outline" size={28} color="#f59e0b" />
            <Text style={styles.stateTitle}>Não consegui analisar agora</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 14, flex: 0, paddingHorizontal: 24 }]} onPress={run}>
              <Text style={styles.btnPrimaryText}>Tentar de novo</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'ready' && analysis && (
          <>
            {!!analysis.resumo && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Resumo</Text>
                <Text style={styles.summaryText}>{analysis.resumo}</Text>
              </View>
            )}
            {renderList('Pontos positivos', analysis.pontosPositivos, 'checkmark-circle', '#22c55e')}
            {renderList('Pontos de atenção', analysis.pontosDeAtencao, 'alert-circle', '#f59e0b')}
            {renderList('Dados insuficientes', analysis.dadosInsuficientes, 'help-circle', '#A7AAB0')}

            {analysis.melhoriasParaObjetivo?.length > 0 && (
              <>
                <Text style={styles.adjustmentsTitle}>
                  Para atingir o objetivo{analysis.objetivo ? `: ${analysis.objetivo}` : ''}
                </Text>
                {analysis.melhoriasParaObjetivo.map(renderImprovement)}
              </>
            )}

            <Text style={styles.adjustmentsTitle}>
              {analysis.ajustes.length > 0 ? `Ajustes sugeridos (${analysis.ajustes.length})` : 'Nenhum ajuste sugerido'}
            </Text>
            {analysis.ajustes.length === 0 && (
              <Text style={styles.stateText}>A IA não encontrou nada a mudar com os dados disponíveis.</Text>
            )}
            {analysis.ajustes.map(renderAdjustment)}

            <ReferencesCard referencias={analysis.referencias} verifiedAt={analysis.fontesVerificadasEm} />

            <Text style={styles.disclaimer}>
              Sugestões geradas por IA a partir dos dados do aluno. Elas não substituem a sua avaliação — nada é alterado sem você tocar em &ldquo;Aplicar&rdquo;.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 50 },
  workoutName: { color: '#A7AAB0', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  stateBox: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 22, alignItems: 'center', gap: 8, marginTop: 8 },
  stateTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stateText: { color: '#A7AAB0', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  card: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 14, marginBottom: 10 },
  sectionTitle: { color: '#A7AAB0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  summaryText: { color: '#FFFFFF', fontSize: 14, lineHeight: 21 },
  adjustmentsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  adjCard: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 14, marginBottom: 10 },
  adjCardApplied: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.06)' },
  adjCardIgnored: { opacity: 0.55 },
  adjHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  adjExercise: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', flex: 1 },
  confChip: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  adjSuggestion: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  changeRow: { backgroundColor: '#08090B', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeField: { color: '#A7AAB0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  changeValues: { color: '#A7AAB0', fontSize: 14, fontWeight: '700', flexShrink: 1, marginLeft: 12, textAlign: 'right' },
  changeRowStack: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  changeValuesStack: { marginLeft: 0, textAlign: 'left', fontSize: 13, lineHeight: 19 },
  changeNew: { color: '#FFFFFF', fontWeight: '800' },
  adjBlock: { marginBottom: 6 },
  adjLabel: { color: '#737373', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  adjText: { color: '#D1D5DB', fontSize: 12, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnPrimary: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnPrimaryText: { color: '#08090B', fontSize: 13, fontWeight: '800' },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: '#3A3F48', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnGhostText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  appliedText: { color: '#22c55e', fontSize: 13, fontWeight: '800' },
  ignoredText: { color: '#A7AAB0', fontSize: 13, fontWeight: '700' },
  linkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  editBox: { marginTop: 10 },
  editInput: { backgroundColor: '#08090B', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 10, height: 48, paddingHorizontal: 12, color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  methodChip: { backgroundColor: '#08090B', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  methodChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  methodChipText: { color: '#A7AAB0', fontSize: 12, fontWeight: '600' },
  methodChipTextActive: { color: '#08090B' },
  disclaimer: { color: '#737373', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});

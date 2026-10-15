import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from './alertUtils';

// Building blocks shared by the AI screens ("Analisar Treino", "Revisar
// Aluno") so evidence is always presented the same way: a claim, why, and chips
// that open the exact study on PubMed. The reference list the app shows comes
// from the server's verified library (never from the AI's own text).

export const CONFIDENCE_LABEL = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' };
export const CONFIDENCE_COLOR = { alta: '#22c55e', media: '#f59e0b', baixa: '#A7AAB0' };

export function formatVerifiedDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function openReference(ref) {
  if (!ref) return;
  Linking.openURL(ref.url).catch(() => showAlert('Não consegui abrir o link', ref.url));
}

export function SourceChips({ numbers, referencias }) {
  if (!numbers || numbers.length === 0) return null;
  const byNumber = (n) => (referencias || []).find((r) => r.n === n);
  return (
    <View style={styles.sourcesRow}>
      <Text style={styles.label}>Base científica</Text>
      <View style={styles.sourceChips}>
        {numbers.map((n) => (
          <TouchableOpacity
            key={n}
            style={styles.sourceChip}
            onPress={() => openReference(byNumber(n))}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel={`Abrir referência ${n} no PubMed`}
          >
            <Text style={styles.sourceChipText}>[{n}] {byNumber(n)?.tipo?.split(' (')[0] || 'Estudo'} ↗</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// A recommendation with its reasoning and sources ("melhorias para o
// objetivo" / "sugestões").
export function ImprovementCard({ item, referencias }) {
  return (
    <View style={styles.improvementCard}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.titulo}</Text>
        <Text style={[styles.confChip, { color: CONFIDENCE_COLOR[item.confianca], borderColor: CONFIDENCE_COLOR[item.confianca] }]}>
          {CONFIDENCE_LABEL[item.confianca]}
        </Text>
      </View>
      <Text style={styles.recommendation}>{item.recomendacao}</Text>
      {!!item.porQue && (
        <View style={styles.block}>
          <Text style={styles.label}>Por quê</Text>
          <Text style={styles.text}>{item.porQue}</Text>
        </View>
      )}
      <SourceChips numbers={item.fontes} referencias={referencias} />
    </View>
  );
}

export function BulletListCard({ title, list, icon, color }) {
  if (!list || list.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {list.map((text, i) => (
        <View key={i} style={styles.bulletRow}>
          <Ionicons name={icon} size={15} color={color} style={{ marginTop: 2 }} />
          <Text style={styles.bulletText}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReferencesCard({ referencias, verifiedAt }) {
  if (!referencias || referencias.length === 0) return null;
  const date = formatVerifiedDate(verifiedAt);
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Referências</Text>
      {referencias.map((r) => (
        <View key={r.id} style={styles.refItem}>
          <Text style={styles.refTipo}>[{r.n}] {r.tipo}</Text>
          <Text style={styles.refCitacao}>{r.citacao}</Text>
          <Text style={styles.label}>O que o estudo conclui</Text>
          <Text style={styles.text}>{r.achado}</Text>
          <TouchableOpacity onPress={() => openReference(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={`Ver referência ${r.n} no PubMed`}>
            <Text style={styles.link}>Ver no PubMed ↗</Text>
          </TouchableOpacity>
        </View>
      ))}
      {!!date && (
        <Text style={styles.refNote}>
          Referências conferidas no PubMed em {date}. Os resultados são médias de estudos com adultos saudáveis: a resposta individual varia.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 14, padding: 14, marginBottom: 10 },
  sectionTitle: { color: '#A7AAB0', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bulletText: { color: '#FFFFFF', fontSize: 13, lineHeight: 19, flex: 1 },
  improvementCard: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#3A3F48', borderRadius: 14, padding: 14, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', flex: 1 },
  confChip: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  recommendation: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  block: { marginBottom: 6 },
  label: { color: '#737373', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  text: { color: '#D1D5DB', fontSize: 12, lineHeight: 18 },
  sourcesRow: { marginTop: 4 },
  sourceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  sourceChip: { borderWidth: 1, borderColor: '#3A3F48', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#08090B' },
  sourceChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  refItem: { borderTopWidth: 1, borderTopColor: '#292D34', paddingTop: 10, marginTop: 10 },
  refTipo: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  refCitacao: { color: '#A7AAB0', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  link: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline', marginTop: 6 },
  refNote: { color: '#737373', fontSize: 11, lineHeight: 16, marginTop: 12 },
});

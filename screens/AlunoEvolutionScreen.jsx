import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBack } from './Header';
import PhysicalAssessmentHistoryScreen from './PhysicalAssessmentHistoryScreen';

const TABS = [
  { key: 'medidas', label: 'Peso e Medidas' },
  { key: 'fotos', label: 'Fotos de Comparação' },
];

export default function AlunoEvolutionScreen({ studentId, studentName, onClose }) {
  const [activeTab, setActiveTab] = useState('medidas');

  return (
    <View style={styles.container}>
      <HeaderBack title="Evolução do Aluno" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabChipText, activeTab === tab.key && styles.tabChipTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'medidas' ? (
        <PhysicalAssessmentHistoryScreen studentId={studentId} studentName={studentName} embedded />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={36} color="#525252" />
          <Text style={styles.emptyTitle}>Em breve</Text>
          <Text style={styles.emptyText}>
            A comparação de fotos de progresso ainda está a caminho. Continue registrando suas avaliações físicas
            que assim que o recurso estiver pronto, o histórico já vai estar aqui.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  tabChip: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524' },
  tabChipActive: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: '#f97316' },
  tabChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  tabChipTextActive: { color: '#f97316' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyText: { color: '#737373', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});

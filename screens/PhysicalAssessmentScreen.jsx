import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PhysicalAssessmentFormScreen from './PhysicalAssessmentFormScreen';
import PhysicalAssessmentHistoryScreen from './PhysicalAssessmentHistoryScreen';

export default function PhysicalAssessmentScreen({ studentId, studentName, personalId, onClose }) {
  const [mode, setMode] = useState(null);

  if (mode === 'form') {
    return (
      <PhysicalAssessmentFormScreen
        studentId={studentId}
        studentName={studentName}
        personalId={personalId}
        onClose={() => setMode(null)}
      />
    );
  }

  if (mode === 'history') {
    return (
      <PhysicalAssessmentHistoryScreen
        studentId={studentId}
        studentName={studentName}
        personalId={personalId}
        onClose={() => setMode(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Avaliação Física</Text>
      </View>

      <Text style={styles.studentLabel}>{studentName}</Text>

      <TouchableOpacity style={styles.optionCard} onPress={() => setMode('form')}>
        <Ionicons name="clipboard-outline" size={28} color="#3b82f6" />
        <Text style={styles.optionTitle}>Nova Avaliação</Text>
        <Text style={styles.optionSubtitle}>Registrar bioimpedância ou dobras cutâneas</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionCard} onPress={() => setMode('history')}>
        <Ionicons name="trending-up-outline" size={28} color="#a855f7" />
        <Text style={styles.optionTitle}>Ver Evolução</Text>
        <Text style={styles.optionSubtitle}>Gráficos e comparação com avaliações anteriores</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  studentLabel: { color: '#737373', fontSize: 12, marginBottom: 24 },
  optionCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 14 },
  optionTitle: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', marginTop: 10 },
  optionSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
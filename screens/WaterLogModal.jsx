import React, { useState } from 'react';
import { ACCENT } from './theme';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';


// Shared "quick-add water + adjust daily goal" popup, opened from the
// Água mini-card on both the aluno's own Home and the personal's
// student-detail screen.
export default function WaterLogModal({ visible, studentId, currentMl, goalMl, onClose, onAdd, onGoalChanged }) {
  const [goalInput, setGoalInput] = useState(String(goalMl || 2000));
  const [savingGoal, setSavingGoal] = useState(false);

  const handleSaveGoal = async () => {
    const value = Number(goalInput);
    if (!value || value <= 0) {
      showAlert('Ops', 'Digite uma meta válida em ml (ex: 2000).');
      return;
    }
    setSavingGoal(true);
    const { error } = await supabase.from('users').update({ water_goal_ml: value }).eq('id', studentId);
    setSavingGoal(false);
    if (error) {
      console.error('Erro ao salvar meta de água:', error);
      showAlert('Ops', 'Não foi possível salvar sua meta de água agora. Tenta de novo em instantes.');
    } else {
      onGoalChanged?.(value);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>💧 Água</Text>
          <Text style={styles.currentText}>{((currentMl || 0) / 1000).toFixed(1)}L / {((goalMl || 2000) / 1000).toFixed(1)}L hoje</Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.addButton} onPress={() => onAdd?.(250)}>
              <Text style={styles.addButtonText}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => onAdd?.(500)}>
              <Text style={styles.addButtonText}>+500ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => onAdd?.(750)}>
              <Text style={styles.addButtonText}>+750ml</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.goalLabel}>Meta diária (ml)</Text>
          <View style={styles.goalRow}>
            <TextInput
              style={styles.goalInput}
              keyboardType="number-pad"
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder="2000"
              placeholderTextColor="#525252"
            />
            <TouchableOpacity style={styles.saveGoalButton} onPress={handleSaveGoal} disabled={savingGoal}>
              {savingGoal ? <ActivityIndicator color="#08090B" size="small" /> : <Text style={styles.saveGoalButtonText}>Salvar</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#121419', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  currentText: { color: '#D1D5DB', fontSize: 13, fontWeight: '700', marginBottom: 16 },
  buttonsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  addButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addButtonText: { color: '#D1D5DB', fontSize: 13, fontWeight: '700' },
  goalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  goalRow: { flexDirection: 'row', gap: 8 },
  goalInput: { flex: 1, backgroundColor: '#08090B', borderWidth: 1, borderColor: '#292D34', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#FFFFFF', fontSize: 13 },
  saveGoalButton: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  saveGoalButtonText: { color: '#08090B', fontSize: 12, fontWeight: '700' },
  closeButton: { paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeButtonText: { color: '#A7AAB0', fontSize: 13, fontWeight: '600' },
});

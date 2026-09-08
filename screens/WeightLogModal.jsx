import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

const ACCENT = '#FF6B00';

// Quick "log today's weight" popup, opened from the "Registrar peso" task on
// the aluno's Home. One row per student per day (weight_entries), separate
// from the personal's periodic physical_assessments.
export default function WeightLogModal({ visible, studentId, currentWeightKg, onClose, onSaved }) {
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setWeightInput(currentWeightKg != null ? String(currentWeightKg) : '');
  }, [visible, currentWeightKg]);

  const handleSave = async () => {
    const value = Number(weightInput.replace(',', '.'));
    if (!value || value <= 0) {
      showAlert('Ops', 'Digite um peso válido em kg (ex: 72.4).');
      return;
    }
    setSaving(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('weight_entries')
      .upsert({ student_id: studentId, entry_date: todayStr, weight_kg: value }, { onConflict: 'student_id,entry_date' });
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      onSaved?.(value);
      onClose?.();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>⚖️ Peso de Hoje</Text>
          <Text style={styles.helperText}>Registra seu peso de hoje pra acompanhar sua evolução ao longo do tempo.</Text>

          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder="72.4"
            placeholderTextColor="#525252"
            autoFocus
          />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.saveButtonText}>Salvar</Text>}
          </TouchableOpacity>

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
  sheet: { backgroundColor: '#1C1C22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  title: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  helperText: { color: '#737373', fontSize: 12, lineHeight: 17, marginBottom: 16 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, color: '#F5F5F7', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  saveButton: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
  closeButton: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal } from 'react-native';

export default function PromptModal({ visible, title, subtitle, initialValue, placeholder, onCancel, onSubmit }) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    if (visible) setValue(initialValue || '');
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#525252"
            autoFocus
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => { if (value.trim()) onSubmit(value.trim()); }}
            >
              <Text style={styles.confirmButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#121419', borderRadius: 16, padding: 20 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#A7AAB0', fontSize: 12, marginBottom: 14 },
  input: { backgroundColor: '#08090B', borderWidth: 1, borderColor: '#292D34', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, marginTop: 6 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelButton: { flex: 1, backgroundColor: '#08090B', borderWidth: 1, borderColor: '#292D34', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: '#A7AAB0', fontSize: 13, fontWeight: '600' },
  confirmButton: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmButtonText: { color: '#08090B', fontSize: 13, fontWeight: '700' },
});

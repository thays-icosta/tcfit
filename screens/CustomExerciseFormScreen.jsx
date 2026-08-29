import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';

const MUSCLE_OPTIONS = ['peito', 'costas', 'ombro', 'biceps', 'triceps', 'abdomen', 'quadriceps', 'isquiotibiais', 'gluteo', 'panturrilha', 'aerobico'];
const EQUIPMENT_OPTIONS = ['halter', 'barra', 'maquina', 'peso_corporal'];

export default function CustomExerciseFormScreen({ personalId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('peito');
  const [equipment, setEquipment] = useState('halter');
  const [instructions, setInstructions] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Ops', 'Dá um nome pro exercício primeiro.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('exercises').insert({
      personal_id: personalId,
      name: name.trim(),
      muscle_group: muscleGroup,
      equipment,
      instructions: instructions.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      video_url: videoUrl.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert('Exercício criado!', `"${name}" foi adicionado aos seus exercícios.`, [
        { text: 'OK', onPress: () => { onCreated(); onClose(); } },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Novo Exercício</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Nome *</Text>
        <TextInput style={styles.input} placeholder="ex: Supino na máquina específica da academia" placeholderTextColor="#525252" value={name} onChangeText={setName} />

        <Text style={styles.label}>Grupo muscular principal *</Text>
        <View style={styles.chipRow}>
          {MUSCLE_OPTIONS.map((m) => (
            <TouchableOpacity key={m} style={[styles.chip, muscleGroup === m && styles.chipActive]} onPress={() => setMuscleGroup(m)}>
              <Text style={[styles.chipText, muscleGroup === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Equipamento *</Text>
        <View style={styles.chipRow}>
          {EQUIPMENT_OPTIONS.map((e) => (
            <TouchableOpacity key={e} style={[styles.chip, equipment === e && styles.chipActive]} onPress={() => setEquipment(e)}>
              <Text style={[styles.chipText, equipment === e && styles.chipTextActive]}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Instruções de execução</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Como executar esse exercício corretamente..." placeholderTextColor="#525252" multiline value={instructions} onChangeText={setInstructions} />

        <Text style={styles.label}>URL de imagem/GIF (opcional)</Text>
        <TextInput style={styles.input} placeholder="cole um link de imagem ou GIF" placeholderTextColor="#525252" value={thumbnailUrl} onChangeText={setThumbnailUrl} autoCapitalize="none" />

        <Text style={styles.label}>URL de vídeo demonstrativo (opcional)</Text>
        <TextInput style={styles.input} placeholder="cole um link de vídeo (.mp4)" placeholderTextColor="#525252" value={videoUrl} onChangeText={setVideoUrl} autoCapitalize="none" />
        <Text style={styles.helperText}>Ainda não temos upload de arquivo direto — por enquanto, cole um link já hospedado em algum lugar (ex: um vídeo público).</Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Criar Exercício</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  formCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  textArea: { height: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#0a0a0a' },
  helperText: { color: '#525252', fontSize: 10, marginTop: 4 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
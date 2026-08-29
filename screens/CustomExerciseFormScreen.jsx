import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { getYoutubeVideoId, getYoutubeThumbnailUrl } from './youtubeUtils';

const MUSCLE_OPTIONS = ['peito', 'costas', 'ombro', 'biceps', 'triceps', 'abdomen', 'quadriceps', 'isquiotibiais', 'gluteo', 'panturrilha', 'aerobico'];
const EQUIPMENT_OPTIONS = ['halter', 'barra', 'maquina', 'peso_corporal'];
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CustomExerciseFormScreen({ personalId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('peito');
  const [equipment, setEquipment] = useState('halter');
  const [instructions, setInstructions] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoMode, setVideoMode] = useState('youtube');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos e vídeos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    try {
      const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
      if (info.exists && info.size > MAX_VIDEO_BYTES) {
        Alert.alert('Vídeo muito grande', 'O vídeo precisa ter no máximo 30MB. Escolhe um menor ou grava com qualidade reduzida.');
        return;
      }

      setUploadingVideo(true);
      const ext = (asset.uri.split('.').pop() || 'mp4').toLowerCase();
      const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const fileName = `${uuidv4()}.${ext}`;

      const { error } = await supabase.storage.from('exercise-videos').upload(fileName, decode(base64), { contentType });
      if (error) throw error;

      const { data } = supabase.storage.from('exercise-videos').getPublicUrl(fileName);
      setVideoUrl(data.publicUrl);
    } catch (e) {
      Alert.alert('Erro ao enviar vídeo', e.message || 'Tente um vídeo menor ou tente novamente.');
    }
    setUploadingVideo(false);
  };

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

        <Text style={styles.label}>Vídeo de demonstração (opcional)</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, videoMode === 'youtube' && styles.modeButtonActive]}
            onPress={() => { setVideoMode('youtube'); setVideoUrl(''); }}
          >
            <Text style={[styles.modeButtonText, videoMode === 'youtube' && styles.modeButtonTextActive]}>Link do YouTube</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, videoMode === 'gallery' && styles.modeButtonActive]}
            onPress={() => { setVideoMode('gallery'); setVideoUrl(''); }}
          >
            <Text style={[styles.modeButtonText, videoMode === 'gallery' && styles.modeButtonTextActive]}>Enviar da galeria</Text>
          </TouchableOpacity>
        </View>

        {videoMode === 'youtube' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="cole o link do YouTube (vídeo ou Shorts)"
              placeholderTextColor="#525252"
              value={videoUrl}
              onChangeText={setVideoUrl}
              autoCapitalize="none"
            />
            {getYoutubeVideoId(videoUrl) ? (
              <Image source={{ uri: getYoutubeThumbnailUrl(videoUrl) }} style={styles.videoPreview} resizeMode="cover" />
            ) : videoUrl.trim() ? (
              <Text style={styles.helperText}>Não reconheci esse link como um vídeo do YouTube. Confere se copiou certo.</Text>
            ) : null}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.videoPickerButton} onPress={handlePickVideo} disabled={uploadingVideo}>
              {uploadingVideo ? (
                <ActivityIndicator color="#f97316" />
              ) : videoUrl ? (
                <Text style={styles.videoPickerButtonText}>✓ Vídeo enviado — toque pra trocar</Text>
              ) : (
                <Text style={styles.videoPickerButtonText}>📹 Escolher vídeo da galeria (.mp4/.mov, até 30MB)</Text>
              )}
            </TouchableOpacity>
          </>
        )}

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
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  modeButtonText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  modeButtonTextActive: { color: '#0a0a0a' },
  videoPreview: { width: '100%', height: 140, borderRadius: 8, marginTop: 8, backgroundColor: '#0a0a0a' },
  videoPickerButton: { backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  videoPickerButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
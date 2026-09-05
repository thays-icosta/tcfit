import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { getYoutubeVideoId, getYoutubeThumbnailUrl } from './youtubeUtils';
import { showAlert, describeFunctionError } from './alertUtils';
import { HeaderBack } from './Header';

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

export default function CustomExerciseFormScreen({ personalId, exercise, onClose, onCreated }) {
  const isEditing = !!exercise;
  const [name, setName] = useState(exercise?.name || '');
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscle_group || 'peito');
  const [equipment, setEquipment] = useState(exercise?.equipment || 'halter');
  const [instructions, setInstructions] = useState(exercise?.instructions || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(exercise?.thumbnail_url || '');
  const [videoMode, setVideoMode] = useState('youtube');
  const [videoUrl, setVideoUrl] = useState(exercise?.video_url || '');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dbSearch, setDbSearch] = useState('');
  const [dbSearching, setDbSearching] = useState(false);
  const [dbResults, setDbResults] = useState([]);
  const [dbImportingId, setDbImportingId] = useState(null);

  const handleSearchExerciseDb = async () => {
    if (!dbSearch.trim()) {
      showAlert('Ops', 'Digite o nome do exercício pra buscar (ex: "supino").');
      return;
    }
    setDbSearching(true);
    setDbResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('search-exercisedb', {
        body: { query: dbSearch.trim() },
      });
      if (error || data?.error) {
        showAlert('Não deu pra buscar', await describeFunctionError(error, data, 'Tenta de novo em alguns instantes.'));
      } else if (!data.results || data.results.length === 0) {
        showAlert('Nada encontrado', 'Não achei nenhum exercício com esse nome no banco. Tenta em inglês ou um termo mais simples.');
      } else {
        setDbResults(data.results);
      }
    } catch (e) {
      console.error('Erro ao buscar no ExerciseDB:', e);
      showAlert('Erro', e?.message || 'Não foi possível buscar agora.');
    }
    setDbSearching(false);
  };

  const handleImportExerciseDbResult = async (result) => {
    setDbImportingId(result.id);
    try {
      const { data, error } = await supabase.functions.invoke('import-exercisedb-gif', {
        body: { gifUrl: result.gifUrl },
      });
      if (error || data?.error) {
        showAlert('Não deu pra importar', await describeFunctionError(error, data, 'Tenta de novo em alguns instantes.'));
      } else {
        setVideoUrl(data.url);
        if (!thumbnailUrl.trim()) setThumbnailUrl(data.url);
        showAlert('Vídeo importado!', `Vídeo de "${result.name}" pronto. Você pode trocar por outro a qualquer momento.`);
      }
    } catch (e) {
      console.error('Erro ao importar vídeo do ExerciseDB:', e);
      showAlert('Erro', e?.message || 'Não foi possível importar agora.');
    }
    setDbImportingId(null);
  };

  const handlePickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', 'Autorize o acesso às fotos e vídeos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    try {
      const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
      if (info.exists && info.size > MAX_VIDEO_BYTES) {
        showAlert('Vídeo muito grande', 'O vídeo precisa ter no máximo 30MB. Escolhe um menor ou grava com qualidade reduzida.');
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
      showAlert('Erro ao enviar vídeo', e.message || 'Tente um vídeo menor ou tente novamente.');
    }
    setUploadingVideo(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Ops', 'Dá um nome pro exercício primeiro.');
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      muscle_group: muscleGroup,
      equipment,
      instructions: instructions.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      video_url: videoUrl.trim() || null,
    };
    const { error } = isEditing
      ? await supabase.from('exercises').update(payload).eq('id', exercise.id)
      : await supabase.from('exercises').insert({ personal_id: personalId, ...payload });
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      showAlert(isEditing ? 'Exercício atualizado!' : 'Exercício criado!', `"${name}" foi ${isEditing ? 'atualizado' : 'adicionado aos seus exercícios'}.`, [
        { text: 'OK', onPress: () => { onCreated(); onClose(); } },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <HeaderBack title={isEditing ? 'Editar Exercício' : 'Novo Exercício'} onBack={onClose} />

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
        {videoUrl.trim() ? <Text style={styles.helperText}>Já tem um vídeo definido. Escolha um modo abaixo pra trocar por outro a qualquer momento.</Text> : null}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, videoMode === 'database' && styles.modeButtonActive]}
            onPress={() => { setVideoMode('database'); setVideoUrl(''); }}
          >
            <Text style={[styles.modeButtonText, videoMode === 'database' && styles.modeButtonTextActive]}>Banco de exercícios</Text>
          </TouchableOpacity>
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

        {videoMode === 'database' ? (
          <>
            <View style={styles.dbSearchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder='ex: "bench press", "squat"'
                placeholderTextColor="#525252"
                value={dbSearch}
                onChangeText={setDbSearch}
                autoCapitalize="none"
                onSubmitEditing={handleSearchExerciseDb}
              />
              <TouchableOpacity style={styles.dbSearchButton} onPress={handleSearchExerciseDb} disabled={dbSearching}>
                {dbSearching ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.dbSearchButtonText}>Buscar</Text>}
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>Busque em inglês pra mais resultados (ex: &quot;bench press&quot; em vez de &quot;supino&quot;).</Text>

            {videoUrl.trim() && dbResults.length === 0 ? (
              <Image source={{ uri: videoUrl }} style={styles.videoPreview} resizeMode="cover" />
            ) : null}

            {dbResults.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.dbResultRow}
                onPress={() => handleImportExerciseDbResult(r)}
                disabled={dbImportingId === r.id}
              >
                <Image source={{ uri: r.gifUrl }} style={styles.dbResultThumb} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dbResultName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.dbResultMeta}>{r.bodyPart} · {r.target}{r.equipment ? ` · ${r.equipment}` : ''}</Text>
                </View>
                {dbImportingId === r.id ? <ActivityIndicator color="#f97316" size="small" /> : <Text style={styles.dbResultUseText}>Usar</Text>}
              </TouchableOpacity>
            ))}
          </>
        ) : videoMode === 'youtube' ? (
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
          {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Salvar Alterações' : 'Criar Exercício'}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  formCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14 },
  dbSearchRow: { flexDirection: 'row', gap: 8 },
  dbSearchButton: { backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  dbSearchButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '700' },
  dbResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 8, marginTop: 8 },
  dbResultThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#171717' },
  dbResultName: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  dbResultMeta: { color: '#737373', fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
  dbResultUseText: { color: '#f97316', fontSize: 11, fontWeight: '700' },
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
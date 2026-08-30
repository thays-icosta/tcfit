import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function calculatePollock3(sex, age, sum) {
  const bd = sex === 'M'
    ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
  return (495 / bd) - 450;
}

function calculatePollock7(sex, age, sum) {
  const bd = sex === 'M'
    ? 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age
    : 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age;
  return (495 / bd) - 450;
}

const POLLOCK7_LABELS = ['Peitoral (mm)', 'Axilar Média (mm)', 'Tríceps (mm)', 'Subescapular (mm)', 'Abdominal (mm)', 'Supra-ilíaca (mm)', 'Coxa (mm)'];

const PERIMETER_FIELDS = [
  { key: 'pescoco', label: 'Pescoço (cm)' },
  { key: 'torax', label: 'Tórax (cm)' },
  { key: 'cintura', label: 'Cintura (cm)' },
  { key: 'abdomen', label: 'Abdômen (cm)' },
  { key: 'quadril', label: 'Quadril (cm)' },
  { key: 'braco_direito', label: 'Braço direito (cm)' },
  { key: 'braco_esquerdo', label: 'Braço esquerdo (cm)' },
  { key: 'antebraco_direito', label: 'Antebraço direito (cm)' },
  { key: 'antebraco_esquerdo', label: 'Antebraço esquerdo (cm)' },
  { key: 'coxa_direita', label: 'Coxa direita (cm)' },
  { key: 'coxa_esquerda', label: 'Coxa esquerda (cm)' },
  { key: 'panturrilha_direita', label: 'Panturrilha direita (cm)' },
  { key: 'panturrilha_esquerda', label: 'Panturrilha esquerda (cm)' },
];

const SEGMENTS = [
  { key: 'braco_direito', label: 'Braço Direito' },
  { key: 'braco_esquerdo', label: 'Braço Esquerdo' },
  { key: 'tronco', label: 'Tronco' },
  { key: 'perna_direita', label: 'Perna Direita' },
  { key: 'perna_esquerda', label: 'Perna Esquerda' },
];

const CLASSIFICATIONS = [
  { value: 'abaixo', label: 'Abaixo' },
  { value: 'padrao', label: 'Padrão' },
  { value: 'acima', label: 'Acima' },
];

export default function PhysicalAssessmentFormScreen({ studentId, studentName, personalId, onClose }) {
  const [mode, setMode] = useState('bioimpedancia');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [fatMassKg, setFatMassKg] = useState('');
  const [bodyWaterPct, setBodyWaterPct] = useState('');
  const [bodyWaterKg, setBodyWaterKg] = useState('');
  const [visceralFat, setVisceralFat] = useState('');
  const [bmr, setBmr] = useState('');
  const [proteinKg, setProteinKg] = useState('');
  const [inorganicSaltKg, setInorganicSaltKg] = useState('');
  const [subcutaneousFat, setSubcutaneousFat] = useState('');

  const [showSegmental, setShowSegmental] = useState(false);
  const [segmental, setSegmental] = useState({});

  const [reportUrl, setReportUrl] = useState(null);
  const [reportIsPdf, setReportIsPdf] = useState(false);
  const [reportFileName, setReportFileName] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);

  const [scanning, setScanning] = useState(false);
  const webFileInputRef = useRef(null);

  const [protocol, setProtocol] = useState('pollock3');
  const [sex, setSex] = useState('M');
  const [age, setAge] = useState('');
  const [skinfold1, setSkinfold1] = useState('');
  const [skinfold2, setSkinfold2] = useState('');
  const [skinfold3, setSkinfold3] = useState('');
  const [skinfold4, setSkinfold4] = useState('');
  const [skinfold5, setSkinfold5] = useState('');
  const [skinfold6, setSkinfold6] = useState('');
  const [skinfold7, setSkinfold7] = useState('');
  const [bicepsFold, setBicepsFold] = useState('');
  const [perimeters, setPerimeters] = useState({});
  const [showPerimeters, setShowPerimeters] = useState(false);

  const pollock3Labels = sex === 'M'
    ? ['Peitoral (mm)', 'Abdominal (mm)', 'Coxa (mm)']
    : ['Tríceps (mm)', 'Supra-ilíaca (mm)', 'Coxa (mm)'];

  const is7 = protocol === 'pollock7';
  const activeLabels = is7 ? POLLOCK7_LABELS : pollock3Labels;
  const foldValues = is7
    ? [skinfold1, skinfold2, skinfold3, skinfold4, skinfold5, skinfold6, skinfold7]
    : [skinfold1, skinfold2, skinfold3];
  const foldSetters = is7
    ? [setSkinfold1, setSkinfold2, setSkinfold3, setSkinfold4, setSkinfold5, setSkinfold6, setSkinfold7]
    : [setSkinfold1, setSkinfold2, setSkinfold3];

  const allFilled = foldValues.every((v) => v && v.trim());
  const sum = allFilled ? foldValues.reduce((acc, v) => acc + Number(v), 0) : null;

  const computed = (sum && age && weight)
    ? (() => {
        const bodyFatPct = is7 ? calculatePollock7(sex, Number(age), sum) : calculatePollock3(sex, Number(age), sum);
        const weightNum = Number(weight);
        const fatMass = weightNum * (bodyFatPct / 100);
        const leanMass = weightNum - fatMass;
        return { bodyFatPct, fatMass, leanMass };
      })()
    : null;

  const handleProtocolChange = (newProtocol) => {
    setProtocol(newProtocol);
    setSkinfold1(''); setSkinfold2(''); setSkinfold3('');
    setSkinfold4(''); setSkinfold5(''); setSkinfold6(''); setSkinfold7('');
  };

  const handleSegmentField = (segKey, field, value) => {
    setSegmental((prev) => ({ ...prev, [segKey]: { ...prev[segKey], [field]: value } }));
  };

  const handleUploadReport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setUploadingReport(true);

      const isPdf = file.mimeType === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');

      let base64, contentType, ext;
      if (isPdf) {
        base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        contentType = 'application/pdf';
        ext = 'pdf';
      } else {
        const manipulated = await ImageManipulator.manipulateAsync(
          file.uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        base64 = manipulated.base64;
        contentType = 'image/jpeg';
        ext = 'jpg';
      }

      const fileName = `report_${uuidv4()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(fileName, decode(base64), { contentType });
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setReportUrl(data.publicUrl);
      setReportIsPdf(isPdf);
      setReportFileName(file.name || (isPdf ? 'laudo.pdf' : 'laudo.jpg'));
    } catch (e) {
      showAlert('Erro ao enviar laudo', e.message || 'Erro desconhecido');
    }
    setUploadingReport(false);
  };

  const applyScanResult = (result) => {
    if (result.peso != null) setWeight(String(result.peso));
    if (result.percentual_gordura != null) setBodyFat(String(result.percentual_gordura));
    if (result.massa_magra != null) setMuscleMass(String(result.massa_magra));
    if (result.massa_gorda != null) setFatMassKg(String(result.massa_gorda));
    if (result.agua_corporal_pct != null) setBodyWaterPct(String(result.agua_corporal_pct));
    if (result.agua_corporal_kg != null) setBodyWaterKg(String(result.agua_corporal_kg));
    if (result.taxa_metabolica_basal != null) setBmr(String(result.taxa_metabolica_basal));
    if (result.gordura_visceral != null) setVisceralFat(String(result.gordura_visceral));
    if (result.proteina_kg != null) setProteinKg(String(result.proteina_kg));
    if (result.sal_inorganico_kg != null) setInorganicSaltKg(String(result.sal_inorganico_kg));
    if (result.gordura_subcutanea_pct != null) setSubcutaneousFat(String(result.gordura_subcutanea_pct));
    if (result.dobras_cutaneas) {
      setNotes((prev) => (prev.trim() ? `${prev}\n\nDobras cutâneas (laudo): ${result.dobras_cutaneas}` : `Dobras cutâneas (laudo): ${result.dobras_cutaneas}`));
    }
  };

  const extractFunctionErrorMessage = async (error) => {
    if (error?.context?.json) {
      try {
        const body = await error.context.json();
        if (body?.error) return body.error;
      } catch {
        // resposta não era JSON, ignora e cai no fallback abaixo
      }
    }
    return error?.message || 'Erro desconhecido ao chamar a IA.';
  };

  const runScan = async (base64) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-body-scan', {
        body: { image: base64, mimeType: 'image/jpeg' },
      });
      if (error) throw new Error(await extractFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      if (!data?.data) throw new Error('A IA não retornou dados.');

      applyScanResult(data.data);
      showAlert('Relatório analisado!', 'Confira os campos preenchidos e ajuste o que precisar antes de salvar.');
    } catch (e) {
      console.log('Erro ao escanear relatório com IA:', e.message);
      showAlert(
        'Não foi possível ler a imagem com IA',
        `${e.message}\n\nVerifique a chave da OpenAI configurada no Supabase, ou preencha os campos manualmente.`
      );
    }
    setScanning(false);
  };

  const pickAndScanImage = async (fromCamera) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', fromCamera ? 'Precisamos da câmera para tirar a foto do laudo.' : 'Precisamos de acesso à galeria para escolher a foto do laudo.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      await runScan(manipulated.base64);
    } catch (e) {
      showAlert('Erro ao processar imagem', e.message || 'Tente novamente ou preencha manualmente.');
    }
  };

  const handleScanReport = () => {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
      return;
    }
    showAlert('Escanear Relatório com IA', 'Como você quer enviar a imagem do laudo?', [
      { text: 'Tirar Foto', onPress: () => pickAndScanImage(true) },
      { text: 'Escolher da Galeria', onPress: () => pickAndScanImage(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleWebFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        objectUrl,
        [{ resize: { width: 1000 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      await runScan(manipulated.base64);
    } catch (e) {
      showAlert('Erro ao processar imagem', e.message || 'Tente novamente ou preencha manualmente.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const buildSegmentalPayload = () => {
    const result = {};
    SEGMENTS.forEach((s) => {
      const seg = segmental[s.key];
      if (seg && (seg.muscle_kg || seg.fat_pct || seg.classification)) {
        result[s.key] = {
          muscle_kg: seg.muscle_kg ? Number(seg.muscle_kg) : null,
          fat_pct: seg.fat_pct ? Number(seg.fat_pct) : null,
          classification: seg.classification || null,
        };
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  const handleSaveBioimpedancia = async () => {
    if (!weight.trim()) {
      showAlert('Ops', 'Pelo menos o peso é obrigatório.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('physical_assessments').insert({
      student_id: studentId,
      personal_id: personalId,
      mode: 'bioimpedancia',
      weight_kg: Number(weight),
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
      skeletal_muscle_kg: muscleMass ? Number(muscleMass) : null,
      fat_mass_kg: fatMassKg ? Number(fatMassKg) : null,
      body_water_pct: bodyWaterPct ? Number(bodyWaterPct) : null,
      body_water_kg: bodyWaterKg ? Number(bodyWaterKg) : null,
      visceral_fat: visceralFat ? Number(visceralFat) : null,
      bmr_kcal: bmr ? Number(bmr) : null,
      protein_kg: proteinKg ? Number(proteinKg) : null,
      inorganic_salt_kg: inorganicSaltKg ? Number(inorganicSaltKg) : null,
      subcutaneous_fat_pct: subcutaneousFat ? Number(subcutaneousFat) : null,
      segmental_analysis: buildSegmentalPayload(),
      report_url: reportUrl,
      notes: notes.trim() || null,
    });
    if (!error) {
      await supabase.from('users').update({ weight_kg: Number(weight) }).eq('id', studentId);
    }
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      showAlert('Avaliação registrada!', `Peso do ${studentName} atualizado para ${weight}kg.`, [{ text: 'OK', onPress: onClose }]);
    }
  };

  const handleSaveDobras = async () => {
    if (!weight.trim() || !age.trim() || !computed) {
      showAlert('Ops', `Preenche peso, idade e ${is7 ? 'as sete' : 'as três'} dobras pra calcular.`);
      return;
    }
    setSaving(true);

    const filledPerimeters = {};
    PERIMETER_FIELDS.forEach((f) => {
      if (perimeters[f.key] && perimeters[f.key].trim()) {
        filledPerimeters[f.key] = Number(perimeters[f.key]);
      }
    });

    const skinfoldData = {
      protocol,
      labels: activeLabels,
      values: foldValues.map(Number),
    };
    if (bicepsFold && bicepsFold.trim()) {
      skinfoldData.biceps_referencia = Number(bicepsFold);
    }

    const { error } = await supabase.from('physical_assessments').insert({
      student_id: studentId,
      personal_id: personalId,
      mode: 'dobras',
      weight_kg: Number(weight),
      body_fat_pct: Number(computed.bodyFatPct.toFixed(1)),
      skeletal_muscle_kg: Number(computed.leanMass.toFixed(1)),
      fat_mass_kg: Number(computed.fatMass.toFixed(1)),
      protocol,
      age: Number(age),
      sex,
      skinfold_values: skinfoldData,
      perimeters: Object.keys(filledPerimeters).length > 0 ? filledPerimeters : null,
      report_url: reportUrl,
      notes: notes.trim() || null,
    });
    if (!error) {
      await supabase.from('users').update({ weight_kg: Number(weight) }).eq('id', studentId);
    }
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      showAlert('Avaliação registrada!', `% de gordura calculada: ${computed.bodyFatPct.toFixed(1)}%`, [{ text: 'OK', onPress: onClose }]);
    }
  };

  const renderReportUpload = () => (
    <>
      <Text style={styles.label}>Anexar Foto/Imagem ou PDF do Laudo</Text>
      {reportUrl ? (
        <View style={styles.reportPreviewBox}>
          {reportIsPdf ? (
            <View style={styles.pdfPreviewBox}>
              <Text style={styles.pdfPreviewIcon}>📄</Text>
              <Text style={styles.pdfPreviewName} numberOfLines={1}>{reportFileName}</Text>
            </View>
          ) : (
            <Image source={{ uri: reportUrl }} style={styles.reportPreviewImage} resizeMode="cover" />
          )}
          <TouchableOpacity onPress={() => { setReportUrl(null); setReportIsPdf(false); }} style={styles.reportRemoveButton}>
            <Text style={styles.reportRemoveButtonText}>Remover</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadButton} onPress={handleUploadReport} disabled={uploadingReport}>
          {uploadingReport ? <ActivityIndicator color="#3b82f6" size="small" /> : <Text style={styles.uploadButtonText}>📎 Anexar Laudo (Foto ou PDF)</Text>}
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.studentLabel}>{studentName}</Text>
      </View>

      <Text style={styles.title}>Nova Avaliação Física</Text>

      <View style={styles.modeRow}>
        <TouchableOpacity style={[styles.modeButton, mode === 'bioimpedancia' && styles.modeButtonActive]} onPress={() => setMode('bioimpedancia')}>
          <Text style={[styles.modeButtonText, mode === 'bioimpedancia' && styles.modeButtonTextActive]}>Bioimpedância</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeButton, mode === 'dobras' && styles.modeButtonActive]} onPress={() => setMode('dobras')}>
          <Text style={[styles.modeButtonText, mode === 'dobras' && styles.modeButtonTextActive]}>Dobras Cutâneas</Text>
        </TouchableOpacity>
      </View>

      {mode === 'bioimpedancia' ? (
        <View style={styles.formCard}>
          <TouchableOpacity style={styles.scanButton} onPress={handleScanReport} disabled={scanning}>
            {scanning ? (
              <View style={styles.scanButtonRow}>
                <ActivityIndicator color="#0a0a0a" />
                <Text style={styles.scanButtonText}>Analisando relatório com IA...</Text>
              </View>
            ) : (
              <Text style={styles.scanButtonText}>📷 Escanear Relatório com IA</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.scanHint}>Tire uma foto (ou escolha da galeria) do laudo de bioimpedância e a IA preenche os campos abaixo pra você conferir.</Text>
          {Platform.OS === 'web' && (
            <input
              ref={webFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleWebFileSelected}
              style={{ display: 'none' }}
            />
          )}

          <Text style={styles.label}>Peso (kg) *</Text>
          <TextInput style={styles.input} placeholder="ex: 70.4" placeholderTextColor="#525252" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />

          <Text style={styles.label}>Massa Magra (kg)</Text>
          <TextInput style={styles.input} placeholder="ex: 29.1" placeholderTextColor="#525252" keyboardType="decimal-pad" value={muscleMass} onChangeText={setMuscleMass} />

          <Text style={styles.label}>Massa Gorda (kg)</Text>
          <TextInput style={styles.input} placeholder="ex: 18.3" placeholderTextColor="#525252" keyboardType="decimal-pad" value={fatMassKg} onChangeText={setFatMassKg} />

          <Text style={styles.label}>% Gordura</Text>
          <TextInput style={styles.input} placeholder="ex: 26.2" placeholderTextColor="#525252" keyboardType="decimal-pad" value={bodyFat} onChangeText={setBodyFat} />

          <Text style={styles.label}>Água Corporal (%)</Text>
          <TextInput style={styles.input} placeholder="ex: 54.1" placeholderTextColor="#525252" keyboardType="decimal-pad" value={bodyWaterPct} onChangeText={setBodyWaterPct} />

          <Text style={styles.label}>Gordura Visceral</Text>
          <TextInput style={styles.input} placeholder="ex: 7" placeholderTextColor="#525252" keyboardType="decimal-pad" value={visceralFat} onChangeText={setVisceralFat} />

          <Text style={styles.label}>Taxa Metabólica Basal — TMB (kcal)</Text>
          <TextInput style={styles.input} placeholder="ex: 1493" placeholderTextColor="#525252" keyboardType="number-pad" value={bmr} onChangeText={setBmr} />

          <Text style={styles.label}>Água Corporal (kg)</Text>
          <TextInput style={styles.input} placeholder="ex: 38.1" placeholderTextColor="#525252" keyboardType="decimal-pad" value={bodyWaterKg} onChangeText={setBodyWaterKg} />

          <Text style={styles.label}>Proteína (kg)</Text>
          <TextInput style={styles.input} placeholder="ex: 10.4" placeholderTextColor="#525252" keyboardType="decimal-pad" value={proteinKg} onChangeText={setProteinKg} />

          <Text style={styles.label}>Sal Inorgânico (kg)</Text>
          <TextInput style={styles.input} placeholder="ex: 3.5" placeholderTextColor="#525252" keyboardType="decimal-pad" value={inorganicSaltKg} onChangeText={setInorganicSaltKg} />

          <Text style={styles.label}>Gordura Subcutânea (%)</Text>
          <TextInput style={styles.input} placeholder="ex: 18.7" placeholderTextColor="#525252" keyboardType="decimal-pad" value={subcutaneousFat} onChangeText={setSubcutaneousFat} />

          <TouchableOpacity style={styles.perimetersToggle} onPress={() => setShowSegmental(!showSegmental)}>
            <Text style={styles.perimetersToggleText}>
              {showSegmental ? '▲ Esconder análise segmentada' : '▼ Adicionar análise segmentada (equilíbrio muscular) — opcional'}
            </Text>
          </TouchableOpacity>

          {showSegmental && (
            <View style={styles.perimetersBox}>
              {SEGMENTS.map((s) => (
                <View key={s.key} style={styles.segmentBlock}>
                  <Text style={styles.segmentTitle}>{s.label}</Text>
                  <View style={styles.segmentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Massa Muscular (kg)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        placeholder="kg"
                        placeholderTextColor="#525252"
                        value={segmental[s.key]?.muscle_kg || ''}
                        onChangeText={(t) => handleSegmentField(s.key, 'muscle_kg', t)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>% Gordura</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        placeholder="%"
                        placeholderTextColor="#525252"
                        value={segmental[s.key]?.fat_pct || ''}
                        onChangeText={(t) => handleSegmentField(s.key, 'fat_pct', t)}
                      />
                    </View>
                  </View>
                  <Text style={styles.label}>Classificação</Text>
                  <View style={styles.classRow}>
                    {CLASSIFICATIONS.map((c) => (
                      <TouchableOpacity
                        key={c.value}
                        style={[styles.classChip, segmental[s.key]?.classification === c.value && styles.classChipActive]}
                        onPress={() => handleSegmentField(s.key, 'classification', c.value)}
                      >
                        <Text style={[styles.classChipText, segmental[s.key]?.classification === c.value && styles.classChipTextActive]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {renderReportUpload()}

          <Text style={styles.label}>Parecer Técnico & Recomendações</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="anamnese, histórico, recomendações..." placeholderTextColor="#525252" multiline value={notes} onChangeText={setNotes} />

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveBioimpedancia} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Avaliação</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.label}>Protocolo</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.protocolButton, protocol === 'pollock3' && styles.protocolButtonActive]} onPress={() => handleProtocolChange('pollock3')}>
              <Text style={[styles.protocolButtonText, protocol === 'pollock3' && styles.protocolButtonTextActive]}>Pollock 3 dobras</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.protocolButton, protocol === 'pollock7' && styles.protocolButtonActive]} onPress={() => handleProtocolChange('pollock7')}>
              <Text style={[styles.protocolButtonText, protocol === 'pollock7' && styles.protocolButtonTextActive]}>Pollock 7 dobras</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.protocolNote}>
            {is7
              ? 'Protocolo de 7 pontos, mais preciso. Inclui subescapular (região das costas).'
              : 'Protocolo de 3 pontos, mais rápido de medir.'}{' '}
            É uma estimativa validada, não substitui bioimpedância ou DEXA.
          </Text>

          <Text style={styles.label}>Peso (kg) *</Text>
          <TextInput style={styles.input} placeholder="ex: 72.5" placeholderTextColor="#525252" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />

          <Text style={styles.label}>Sexo biológico *</Text>
          <View style={styles.sexRow}>
            <TouchableOpacity style={[styles.sexButton, sex === 'M' && styles.sexButtonActive]} onPress={() => setSex('M')}>
              <Text style={[styles.sexButtonText, sex === 'M' && styles.sexButtonTextActive]}>Masculino</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sexButton, sex === 'F' && styles.sexButtonActive]} onPress={() => setSex('F')}>
              <Text style={[styles.sexButtonText, sex === 'F' && styles.sexButtonTextActive]}>Feminino</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Idade *</Text>
          <TextInput style={styles.input} placeholder="ex: 28" placeholderTextColor="#525252" keyboardType="number-pad" value={age} onChangeText={setAge} />

          {activeLabels.map((label, i) => (
            <View key={i}>
              <Text style={styles.label}>{label} *</Text>
              <TextInput
                style={styles.input}
                placeholder="mm"
                placeholderTextColor="#525252"
                keyboardType="decimal-pad"
                value={foldValues[i]}
                onChangeText={foldSetters[i]}
              />
            </View>
          ))}

          <Text style={styles.label}>Dobra Bíceps (mm) — referência, não entra no cálculo</Text>
          <TextInput style={styles.input} placeholder="ex: 6" placeholderTextColor="#525252" keyboardType="decimal-pad" value={bicepsFold} onChangeText={setBicepsFold} />

          <TouchableOpacity style={styles.perimetersToggle} onPress={() => setShowPerimeters(!showPerimeters)}>
            <Text style={styles.perimetersToggleText}>
              {showPerimeters ? '▲ Esconder perímetros (fita métrica)' : '▼ Adicionar perímetros (fita métrica) — opcional'}
            </Text>
          </TouchableOpacity>

          {showPerimeters && (
            <View style={styles.perimetersBox}>
              {PERIMETER_FIELDS.map((f) => (
                <View key={f.key}>
                  <Text style={styles.label}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="cm"
                    placeholderTextColor="#525252"
                    keyboardType="decimal-pad"
                    value={perimeters[f.key] || ''}
                    onChangeText={(t) => setPerimeters((prev) => ({ ...prev, [f.key]: t }))}
                  />
                </View>
              ))}
            </View>
          )}

          {renderReportUpload()}

          <Text style={styles.label}>Parecer Técnico & Recomendações</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="anamnese, histórico, recomendações..." placeholderTextColor="#525252" multiline value={notes} onChangeText={setNotes} />

          {computed && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>Resultado calculado ({is7 ? 'Pollock 7' : 'Pollock 3'})</Text>
              <View style={styles.resultRow}>
                <View style={styles.resultItem}>
                  <Text style={styles.resultValue}>{computed.bodyFatPct.toFixed(1)}%</Text>
                  <Text style={styles.resultLabel}>Gordura</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultValue}>{computed.fatMass.toFixed(1)}kg</Text>
                  <Text style={styles.resultLabel}>Massa gorda</Text>
                </View>
                <View style={styles.resultItem}>
                  <Text style={styles.resultValue}>{computed.leanMass.toFixed(1)}kg</Text>
                  <Text style={styles.resultLabel}>Massa magra</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveDobras} disabled={saving || !computed}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Avaliação</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  studentLabel: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  title: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeButton: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  modeButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  modeButtonTextActive: { color: '#0a0a0a' },
  protocolButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  protocolButtonActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  protocolButtonText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  protocolButtonTextActive: { color: '#0a0a0a' },
  formCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14 },
  protocolNote: { color: '#737373', fontSize: 11, lineHeight: 16, marginBottom: 6 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 13 },
  textArea: { height: 90, textAlignVertical: 'top' },
  sexRow: { flexDirection: 'row', gap: 8 },
  sexButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  sexButtonActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  sexButtonText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  sexButtonTextActive: { color: '#0a0a0a' },
  perimetersToggle: { paddingVertical: 10, marginTop: 8 },
  perimetersToggleText: { color: '#f97316', fontSize: 12, fontWeight: '600' },
  perimetersBox: { backgroundColor: '#0a0a0a', borderRadius: 10, padding: 10 },
  segmentBlock: { borderBottomWidth: 1, borderBottomColor: '#171717', paddingBottom: 10, marginBottom: 10 },
  segmentTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  classRow: { flexDirection: 'row', gap: 6 },
  classChip: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  classChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  classChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  classChipTextActive: { color: '#0a0a0a' },
  scanButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 6 },
  scanButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  scanHint: { color: '#737373', fontSize: 11, lineHeight: 16, marginBottom: 4 },
  uploadButton: { backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  uploadButtonText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  reportPreviewBox: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  reportPreviewImage: { width: '100%', height: 140 },
  pdfPreviewBox: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfPreviewIcon: { fontSize: 24 },
  pdfPreviewName: { color: '#f5f5f5', fontSize: 12, flexShrink: 1 },
  reportRemoveButton: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reportRemoveButtonText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
  resultBox: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#f97316', borderRadius: 10, padding: 12, marginTop: 16 },
  resultTitle: { color: '#f97316', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultItem: { alignItems: 'center' },
  resultValue: { color: '#f5f5f5', fontSize: 18, fontWeight: '800' },
  resultLabel: { color: '#a3a3a3', fontSize: 9, marginTop: 2 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
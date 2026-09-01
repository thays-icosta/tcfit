import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { PROGRAM_GOALS, TRAINING_LOCATIONS, PAIN_ZONES, SEX_OPTIONS, calculateMacroGoals } from './accessLevel';

const WHATSAPP_NUMBER = '5537998231382';

export default function AnamneseFormScreen({ studentId, personalId, onClose, onComplete, allowSkip, accessLevel, personalName, personalPhone }) {
  const isVip = accessLevel === 'consultoria_vip';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [ebooks, setEbooks] = useState([]);

  const [mainGoal, setMainGoal] = useState(null);
  const [trainingLocation, setTrainingLocation] = useState(null);
  const [healthIssues, setHealthIssues] = useState('');
  const [painZones, setPainZones] = useState([]);
  const [customAnswers, setCustomAnswers] = useState({});

  const [sex, setSex] = useState(null);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: existing }, { data: questionRows }, { data: existingAnswers }, { data: ebookRows }] = await Promise.all([
        supabase.from('anamnese_responses').select('*').eq('student_id', studentId).maybeSingle(),
        personalId && isVip
          ? supabase.from('anamnese_questions').select('*').eq('personal_id', personalId).eq('active', true).order('order_index')
          : Promise.resolve({ data: [] }),
        supabase.from('anamnese_answers').select('question_id, answer_text').eq('student_id', studentId),
        personalId && isVip
          ? supabase.from('products').select('id, name, cover_image_url, delivery_type, delivery_value').eq('personal_id', personalId).eq('type', 'ebook_receitas').eq('active', true)
          : Promise.resolve({ data: [] }),
      ]);

      if (existing) {
        setMainGoal(existing.main_goal || null);
        setTrainingLocation(existing.training_location || null);
        setHealthIssues(existing.health_issues || '');
        setPainZones(existing.pain_zones || []);
        setSex(existing.sex || null);
        setWeightKg(existing.weight_kg != null ? String(existing.weight_kg) : '');
        setHeightCm(existing.height_cm != null ? String(existing.height_cm) : '');
        setAge(existing.age != null ? String(existing.age) : '');
        if (existing.calc_goal_kcal) {
          setCalcResult({
            kcal: existing.calc_goal_kcal,
            protein: existing.calc_goal_protein_g,
            carbs: existing.calc_goal_carbs_g,
            fat: existing.calc_goal_fat_g,
          });
        }
      }

      setQuestions(questionRows || []);
      setEbooks(ebookRows || []);
      const answerMap = {};
      (existingAnswers || []).forEach((a) => { answerMap[a.question_id] = a.answer_text || ''; });
      setCustomAnswers(answerMap);

      setLoading(false);
    })();
  }, [studentId, personalId, isVip]);

  const handleCalculate = () => {
    const result = calculateMacroGoals({ sex, weightKg, heightCm, age, goal: mainGoal });
    if (!result) {
      showAlert('Ops', 'Preenche sexo, peso, altura, idade e objetivo pra calcular.');
      return;
    }
    setCalcResult(result);
  };

  const handleUpgrade = () => {
    const phone = (personalPhone || WHATSAPP_NUMBER).replace(/\D/g, '') || WHATSAPP_NUMBER;
    const message = `Olá${personalName ? `, ${personalName}` : ''}! Vi que a calculadora de macros e as perguntas personalizadas da anamnese são exclusivas da Consultoria VIP e quero saber mais sobre fazer upgrade.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const togglePainZone = (value) => {
    setPainZones((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handleSave = async () => {
    if (!mainGoal) {
      showAlert('Ops', 'Escolhe seu objetivo principal.');
      return;
    }
    if (!trainingLocation) {
      showAlert('Ops', 'Escolhe onde você vai treinar.');
      return;
    }
    if (isVip) {
      for (const q of questions) {
        if (q.required && !(customAnswers[q.id] || '').trim()) {
          showAlert('Ops', `Responde: "${q.question_text}"`);
          return;
        }
      }
    }

    setSaving(true);
    const { error: responseError } = await supabase.from('anamnese_responses').upsert(
      {
        student_id: studentId,
        personal_id: personalId,
        main_goal: mainGoal,
        training_location: trainingLocation,
        health_issues: healthIssues.trim() || null,
        pain_zones: painZones,
        sex: sex || null,
        weight_kg: weightKg ? Number(weightKg) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        age: age ? Number(age) : null,
        calc_goal_kcal: calcResult?.kcal || null,
        calc_goal_protein_g: calcResult?.protein || null,
        calc_goal_carbs_g: calcResult?.carbs || null,
        calc_goal_fat_g: calcResult?.fat || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );

    if (!responseError && questions.length > 0) {
      const rows = questions.map((q) => ({
        student_id: studentId,
        question_id: q.id,
        answer_text: (customAnswers[q.id] || '').trim() || null,
      }));
      await supabase.from('anamnese_answers').upsert(rows, { onConflict: 'student_id,question_id' });
    }

    if (!responseError) {
      await supabase.from('users').update({ anamnese_completed_at: new Date().toISOString() }).eq('id', studentId);
    }

    setSaving(false);
    if (responseError) {
      showAlert('Erro', responseError.message);
    } else {
      showAlert('Anamnese enviada!', 'Seu personal já pode ver suas respostas.');
      if (onComplete) onComplete();
      else if (onClose) onClose();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>{allowSkip ? 'Pular por agora' : '← Voltar'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{allowSkip ? 'Anamnese Inicial' : 'Anamnese'}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={styles.intro}>Antes de começar, conta um pouco sobre você — isso ajuda seu personal a montar o treino certo.</Text>

        <Text style={styles.label}>Objetivo Principal</Text>
        <View style={styles.chipRow}>
          {PROGRAM_GOALS.map((g) => (
            <TouchableOpacity key={g.value} style={[styles.chip, mainGoal === g.value && styles.chipActive]} onPress={() => setMainGoal(g.value)}>
              <Text style={[styles.chipText, mainGoal === g.value && styles.chipTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isVip ? (
          <>
            <Text style={styles.label}>Calculadora de Calorias e Macros</Text>
            <Text style={styles.helperText}>Preenche pra receber uma estimativa de meta diária. Seu personal pode ajustar depois.</Text>
            <View style={styles.chipRow}>
              {SEX_OPTIONS.map((s) => (
                <TouchableOpacity key={s.value} style={[styles.chip, sex === s.value && styles.chipActive]} onPress={() => setSex(s.value)}>
                  <Text style={[styles.chipText, sex === s.value && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.calcFieldRow}>
              <View style={styles.calcFieldSmall}>
                <Text style={styles.calcFieldLabel}>Peso (kg)</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="70" placeholderTextColor="#525252" value={weightKg} onChangeText={setWeightKg} />
              </View>
              <View style={styles.calcFieldSmall}>
                <Text style={styles.calcFieldLabel}>Altura (cm)</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="170" placeholderTextColor="#525252" value={heightCm} onChangeText={setHeightCm} />
              </View>
              <View style={styles.calcFieldSmall}>
                <Text style={styles.calcFieldLabel}>Idade</Text>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="30" placeholderTextColor="#525252" value={age} onChangeText={setAge} />
              </View>
            </View>

            <TouchableOpacity style={styles.calcButton} onPress={handleCalculate}>
              <Text style={styles.calcButtonText}>Calcular Estimativa</Text>
            </TouchableOpacity>

            {calcResult && (
              <View style={styles.calcResultCard}>
                <Text style={styles.calcResultKcal}>{calcResult.kcal} kcal/dia</Text>
                <Text style={styles.calcResultNote}>Estimativa baseada nos seus dados — não substitui o ajuste do seu personal.</Text>
                <View style={styles.calcMacroRow}>
                  <View style={styles.calcMacroItem}>
                    <Text style={styles.calcMacroValue}>{calcResult.protein}g</Text>
                    <Text style={styles.calcMacroLabel}>Proteína</Text>
                  </View>
                  <View style={styles.calcMacroItem}>
                    <Text style={styles.calcMacroValue}>{calcResult.carbs}g</Text>
                    <Text style={styles.calcMacroLabel}>Carbo</Text>
                  </View>
                  <View style={styles.calcMacroItem}>
                    <Text style={styles.calcMacroValue}>{calcResult.fat}g</Text>
                    <Text style={styles.calcMacroLabel}>Gordura</Text>
                  </View>
                </View>

                {ebooks.length > 0 && (
                  <>
                    <Text style={styles.calcEbooksLabel}>Guias que podem te ajudar</Text>
                    {ebooks.map((e) => (
                      <View key={e.id} style={styles.calcEbookRow}>
                        <Text style={styles.calcEbookName} numberOfLines={1}>📘 {e.name}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed" size={20} color="#f97316" />
            <Text style={styles.lockedTitle}>Calculadora de Macros e perguntas personalizadas</Text>
            <Text style={styles.lockedText}>Exclusivo da Consultoria VIP.</Text>
            <TouchableOpacity style={styles.lockedButton} onPress={handleUpgrade}>
              <Ionicons name="logo-whatsapp" size={14} color="#0a0a0a" />
              <Text style={styles.lockedButtonText}>Fazer Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Local de Treino</Text>
        <View style={styles.chipRow}>
          {TRAINING_LOCATIONS.map((l) => (
            <TouchableOpacity key={l.value} style={[styles.chip, trainingLocation === l.value && styles.chipActive]} onPress={() => setTrainingLocation(l.value)}>
              <Text style={[styles.chipText, trainingLocation === l.value && styles.chipTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Lesões / Problemas de Saúde</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="ex: hérnia de disco, cirurgia no joelho, nenhuma..."
          placeholderTextColor="#525252"
          value={healthIssues}
          onChangeText={setHealthIssues}
        />

        <Text style={styles.label}>Zonas de Dor (se tiver alguma)</Text>
        <View style={styles.chipRow}>
          {PAIN_ZONES.map((z) => {
            const checked = painZones.includes(z.value);
            return (
              <TouchableOpacity key={z.value} style={[styles.chip, checked && styles.chipActive]} onPress={() => togglePainZone(z.value)}>
                <Text style={[styles.chipText, checked && styles.chipTextActive]}>{z.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isVip && questions.map((q) => (
          <View key={q.id}>
            <Text style={styles.label}>{q.question_text}{q.required ? ' *' : ''}</Text>
            {q.question_type === 'sim_nao' ? (
              <View style={styles.chipRow}>
                {['Sim', 'Não'].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, customAnswers[q.id] === opt && styles.chipActive]}
                    onPress={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  >
                    <Text style={[styles.chipText, customAnswers[q.id] === opt && styles.chipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : q.question_type === 'multipla_escolha' ? (
              <View style={styles.chipRow}>
                {(q.options || []).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, customAnswers[q.id] === opt && styles.chipActive]}
                    onPress={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  >
                    <Text style={[styles.chipText, customAnswers[q.id] === opt && styles.chipTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                style={q.question_type === 'texto_longo' ? styles.textArea : styles.input}
                multiline={q.question_type === 'texto_longo'}
                placeholderTextColor="#525252"
                value={customAnswers[q.id] || ''}
                onChangeText={(text) => setCustomAnswers((prev) => ({ ...prev, [q.id]: text }))}
              />
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Enviar Anamnese</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 13, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700' },
  intro: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  chipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#0a0a0a' },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  helperText: { color: '#525252', fontSize: 11, marginBottom: 10, lineHeight: 15 },
  calcFieldRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  calcFieldSmall: { flex: 1 },
  calcFieldLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 },
  calcButton: { backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  calcButtonText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  calcResultCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, padding: 16, marginTop: 12, alignItems: 'center' },
  calcResultKcal: { color: '#f97316', fontSize: 26, fontWeight: '800' },
  calcResultNote: { color: '#737373', fontSize: 10, textAlign: 'center', marginTop: 4, marginBottom: 14, lineHeight: 14 },
  calcMacroRow: { flexDirection: 'row', gap: 24 },
  calcMacroItem: { alignItems: 'center' },
  calcMacroValue: { color: '#f5f5f5', fontSize: 15, fontWeight: '700' },
  calcMacroLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginTop: 2 },
  calcEbooksLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, alignSelf: 'flex-start' },
  calcEbookRow: { backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, width: '100%', marginBottom: 6 },
  calcEbookName: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  textArea: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  lockedCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  lockedTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  lockedText: { color: '#737373', fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  lockedButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20, alignItems: 'center' },
  lockedButtonText: { color: '#0a0a0a', fontSize: 12, fontWeight: '800' },
});

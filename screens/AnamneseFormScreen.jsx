import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { PROGRAM_GOALS, TRAINING_LOCATIONS, PAIN_ZONES } from './accessLevel';

export default function AnamneseFormScreen({ studentId, personalId, onClose, onComplete, allowSkip }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState([]);

  const [mainGoal, setMainGoal] = useState(null);
  const [trainingLocation, setTrainingLocation] = useState(null);
  const [healthIssues, setHealthIssues] = useState('');
  const [painZones, setPainZones] = useState([]);
  const [customAnswers, setCustomAnswers] = useState({});

  useEffect(() => {
    (async () => {
      const [{ data: existing }, { data: questionRows }, { data: existingAnswers }] = await Promise.all([
        supabase.from('anamnese_responses').select('*').eq('student_id', studentId).maybeSingle(),
        personalId
          ? supabase.from('anamnese_questions').select('*').eq('personal_id', personalId).eq('active', true).order('order_index')
          : Promise.resolve({ data: [] }),
        supabase.from('anamnese_answers').select('question_id, answer_text').eq('student_id', studentId),
      ]);

      if (existing) {
        setMainGoal(existing.main_goal || null);
        setTrainingLocation(existing.training_location || null);
        setHealthIssues(existing.health_issues || '');
        setPainZones(existing.pain_zones || []);
      }

      setQuestions(questionRows || []);
      const answerMap = {};
      (existingAnswers || []).forEach((a) => { answerMap[a.question_id] = a.answer_text || ''; });
      setCustomAnswers(answerMap);

      setLoading(false);
    })();
  }, [studentId, personalId]);

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
    for (const q of questions) {
      if (q.required && !(customAnswers[q.id] || '').trim()) {
        showAlert('Ops', `Responde: "${q.question_text}"`);
        return;
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

        {questions.map((q) => (
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
  textArea: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});

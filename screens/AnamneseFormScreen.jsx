import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import {
  PROGRAM_GOALS, PROGRAM_LEVELS, TRAINING_LOCATIONS, PAIN_ZONES, SEX_OPTIONS, calculateMacroGoals,
  DAYS_PER_WEEK_OPTIONS, SESSION_DURATION_OPTIONS, ACTIVITY_LEVELS, SLEEP_QUALITY_OPTIONS, MUSCLE_FOCUS_OPTIONS,
} from './accessLevel';

const WHATSAPP_NUMBER = '5537998231382';
const TOTAL_STEPS = 3;

const PAIN_ZONE_OPTIONS = [...PAIN_ZONES, { value: 'nenhuma', label: 'Nenhuma' }];

// Reorders (never removes) the shared focus-muscle vocabulary so the picks
// most relevant to the selected profile show first — same emphasis used on
// the gendered sales pages ("Glúteos & Pernas" vs "Hipertrofia & Cargas").
const FOCUS_PRIORITY = {
  feminino: ['gluteo', 'quadriceps', 'abdomen', 'costas', 'peito', 'ombro', 'biceps'],
  masculino: ['peito', 'costas', 'ombro', 'biceps', 'abdomen', 'quadriceps', 'gluteo'],
};
function focusOptionsFor(sex) {
  const order = FOCUS_PRIORITY[sex];
  if (!order) return MUSCLE_FOCUS_OPTIONS;
  return [...MUSCLE_FOCUS_OPTIONS].sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
}

function ChipRow({ children }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Step1PersonalData({ sex, setSex, age, setAge, weightKg, setWeightKg, heightCm, setHeightCm, activityLevel, setActivityLevel }) {
  return (
    <>
      <Text style={styles.intro}>Antes de começar, conta um pouco sobre você — isso ajuda a gente a personalizar seu app e seu treino.</Text>

      <Text style={styles.label}>Sexo Biológico</Text>
      <ChipRow>
        {SEX_OPTIONS.map((s) => (
          <Chip key={s.value} label={s.label} active={sex === s.value} onPress={() => setSex(s.value)} />
        ))}
      </ChipRow>

      <View style={styles.calcFieldRow}>
        <View style={styles.calcFieldSmall}>
          <Text style={styles.calcFieldLabel}>Idade</Text>
          <TextInput style={styles.input} keyboardType="number-pad" placeholder="30" placeholderTextColor="#525252" value={age} onChangeText={setAge} />
        </View>
        <View style={styles.calcFieldSmall}>
          <Text style={styles.calcFieldLabel}>Peso (kg)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="70" placeholderTextColor="#525252" value={weightKg} onChangeText={setWeightKg} />
        </View>
        <View style={styles.calcFieldSmall}>
          <Text style={styles.calcFieldLabel}>Altura (cm)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="170" placeholderTextColor="#525252" value={heightCm} onChangeText={setHeightCm} />
        </View>
      </View>

      <Text style={styles.label}>Nível de Atividade Diária</Text>
      <ChipRow>
        {ACTIVITY_LEVELS.map((a) => (
          <Chip key={a.value} label={a.label} active={activityLevel === a.value} onPress={() => setActivityLevel(a.value)} />
        ))}
      </ChipRow>
    </>
  );
}

function Step2Objectives({
  mainGoal, setMainGoal, experienceLevel, setExperienceLevel, focusMuscleGroup, setFocusMuscleGroup, sex,
  isVip, sexReady, calcResult, onCalculate, ebooks, onUpgrade,
}) {
  return (
    <>
      <Text style={styles.label}>Objetivo Principal</Text>
      <ChipRow>
        {PROGRAM_GOALS.map((g) => (
          <Chip key={g.value} label={g.label} active={mainGoal === g.value} onPress={() => setMainGoal(g.value)} />
        ))}
      </ChipRow>

      <Text style={styles.label}>Nível de Experiência</Text>
      <ChipRow>
        {PROGRAM_LEVELS.map((l) => (
          <Chip key={l.value} label={l.label} active={experienceLevel === l.value} onPress={() => setExperienceLevel(l.value)} />
        ))}
      </ChipRow>

      <Text style={styles.label}>Foco Muscular (opcional)</Text>
      <ChipRow>
        {focusOptionsFor(sex).map((m) => (
          <Chip
            key={m.value}
            label={m.label}
            active={focusMuscleGroup === m.value}
            onPress={() => setFocusMuscleGroup(focusMuscleGroup === m.value ? null : m.value)}
          />
        ))}
      </ChipRow>

      {isVip ? (
        <>
          <Text style={styles.label}>Calculadora de Calorias e Macros</Text>
          <Text style={styles.helperText}>
            {sexReady ? 'Usa seus dados do Passo 1 pra estimar sua meta diária. Seu personal pode ajustar depois.' : 'Preenche sexo, idade, peso e altura no Passo 1 pra liberar a calculadora.'}
          </Text>
          <TouchableOpacity style={[styles.calcButton, !sexReady && styles.calcButtonDisabled]} onPress={onCalculate} disabled={!sexReady}>
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
          <TouchableOpacity style={styles.lockedButton} onPress={onUpgrade}>
            <Ionicons name="logo-whatsapp" size={14} color="#0a0a0a" />
            <Text style={styles.lockedButtonText}>Fazer Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

function Step3Health({
  trainingLocation, setTrainingLocation, painZones, togglePainZone, healthIssues, setHealthIssues,
  daysPerWeek, setDaysPerWeek, sessionDurationMin, setSessionDurationMin, sleepQuality, setSleepQuality,
  isVip, questions, customAnswers, setCustomAnswers,
}) {
  return (
    <>
      <Text style={styles.label}>Local de Treino</Text>
      <ChipRow>
        {TRAINING_LOCATIONS.map((l) => (
          <Chip key={l.value} label={l.label} active={trainingLocation === l.value} onPress={() => setTrainingLocation(l.value)} />
        ))}
      </ChipRow>

      <Text style={styles.label}>Zonas de Dor / Lesões</Text>
      <ChipRow>
        {PAIN_ZONE_OPTIONS.map((z) => (
          <Chip key={z.value} label={z.label} active={painZones.includes(z.value)} onPress={() => togglePainZone(z.value)} />
        ))}
      </ChipRow>

      <Text style={styles.label}>Restrições médicas (opcional)</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="ex: hérnia de disco, cirurgia no joelho..."
        placeholderTextColor="#525252"
        value={healthIssues}
        onChangeText={setHealthIssues}
      />

      <Text style={styles.sectionHeader}>Disponibilidade</Text>

      <Text style={styles.label}>Dias Disponíveis por Semana</Text>
      <ChipRow>
        {DAYS_PER_WEEK_OPTIONS.map((d) => (
          <Chip key={d} label={`${d}x`} active={daysPerWeek === d} onPress={() => setDaysPerWeek(d)} />
        ))}
      </ChipRow>

      <Text style={styles.label}>Tempo por Sessão</Text>
      <ChipRow>
        {SESSION_DURATION_OPTIONS.map((s) => (
          <Chip key={s.value} label={s.label} active={sessionDurationMin === s.value} onPress={() => setSessionDurationMin(s.value)} />
        ))}
      </ChipRow>

      <Text style={styles.label}>Qualidade do Sono</Text>
      <ChipRow>
        {SLEEP_QUALITY_OPTIONS.map((s) => (
          <Chip key={s.value} label={s.label} active={sleepQuality === s.value} onPress={() => setSleepQuality(s.value)} />
        ))}
      </ChipRow>

      {isVip && questions.map((q) => (
        <View key={q.id}>
          <Text style={styles.label}>{q.question_text}{q.required ? ' *' : ''}</Text>
          {q.question_type === 'sim_nao' ? (
            <ChipRow>
              {['Sim', 'Não'].map((opt) => (
                <Chip key={opt} label={opt} active={customAnswers[q.id] === opt} onPress={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: opt }))} />
              ))}
            </ChipRow>
          ) : q.question_type === 'multipla_escolha' ? (
            <ChipRow>
              {(q.options || []).map((opt) => (
                <Chip key={opt} label={opt} active={customAnswers[q.id] === opt} onPress={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: opt }))} />
              ))}
            </ChipRow>
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
    </>
  );
}

export default function AnamneseFormScreen({ studentId, personalId, onClose, onComplete, allowSkip, accessLevel, personalName, personalPhone }) {
  const isVip = accessLevel === 'consultoria_vip';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);
  const [step, setStep] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [ebooks, setEbooks] = useState([]);

  const [mainGoal, setMainGoal] = useState(null);
  const [experienceLevel, setExperienceLevel] = useState(null);
  const [focusMuscleGroup, setFocusMuscleGroup] = useState(null);
  const [trainingLocation, setTrainingLocation] = useState(null);
  const [daysPerWeek, setDaysPerWeek] = useState(null);
  const [sessionDurationMin, setSessionDurationMin] = useState(null);
  const [activityLevel, setActivityLevel] = useState(null);
  const [sleepQuality, setSleepQuality] = useState(null);
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
      const [{ data: existing }, { data: questionRows }, { data: existingAnswers }, { data: ebookRows }, { data: profileRow }] = await Promise.all([
        supabase.from('anamnese_responses').select('*').eq('student_id', studentId).maybeSingle(),
        personalId && isVip
          ? supabase.from('anamnese_questions').select('*').eq('personal_id', personalId).eq('active', true).order('order_index')
          : Promise.resolve({ data: [] }),
        supabase.from('anamnese_answers').select('question_id, answer_text').eq('student_id', studentId),
        personalId && isVip
          ? supabase.from('products').select('id, name, cover_image_url, delivery_type, delivery_value').eq('personal_id', personalId).eq('type', 'ebook_receitas').eq('active', true)
          : Promise.resolve({ data: [] }),
        supabase.from('users').select('gender').eq('id', studentId).maybeSingle(),
      ]);

      if (existing) {
        setMainGoal(existing.main_goal || null);
        setExperienceLevel(existing.experience_level || null);
        setFocusMuscleGroup(existing.focus_muscle_group || null);
        setTrainingLocation(existing.training_location || null);
        setDaysPerWeek(existing.days_per_week || null);
        setSessionDurationMin(existing.session_duration_min || null);
        setActivityLevel(existing.activity_level || null);
        setSleepQuality(existing.sleep_quality || null);
        setHealthIssues(existing.health_issues || '');
        setPainZones(existing.pain_zones || []);
        setSex(existing.sex || profileRow?.gender || null);
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
      } else if (profileRow?.gender) {
        setSex(profileRow.gender);
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
      showAlert('Ops', 'Preenche sexo, peso, altura e idade no Passo 1 (e um objetivo aqui) pra calcular.');
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
    setPainZones((prev) => {
      if (value === 'nenhuma') return prev.includes('nenhuma') ? [] : ['nenhuma'];
      const withoutNone = prev.filter((v) => v !== 'nenhuma');
      return withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
    });
  };

  const sexReady = !!(sex && age.trim() && weightKg.trim() && heightCm.trim());

  const handleNext = () => {
    if (step === 1) {
      if (!sex || !age.trim() || !weightKg.trim() || !heightCm.trim() || !activityLevel) {
        showAlert('Ops', 'Preenche sexo, idade, peso, altura e nível de atividade pra continuar.');
        return;
      }
    } else if (step === 2) {
      if (!mainGoal || !experienceLevel) {
        showAlert('Ops', 'Escolhe seu objetivo principal e nível de experiência.');
        return;
      }
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSave = async () => {
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
        experience_level: experienceLevel,
        focus_muscle_group: focusMuscleGroup,
        training_location: trainingLocation,
        days_per_week: daysPerWeek,
        session_duration_min: sessionDurationMin,
        activity_level: activityLevel,
        sleep_quality: sleepQuality,
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
      // The sex collected here is the same tag that drives the app's gendered
      // content filtering, so it needs to land on the profile, not just the
      // anamnese record.
      if (sex === 'masculino' || sex === 'feminino') {
        await supabase.from('users').update({ gender: sex }).eq('id', studentId);
      }
    }

    setSaving(false);
    if (responseError) {
      showAlert('Erro', responseError.message);
      return;
    }

    setPersonalizing(true);
    setTimeout(() => {
      if (onComplete) onComplete();
      else if (onClose) onClose();
    }, 2000);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (personalizing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" size="large" />
        <Text style={styles.personalizingText}>Personalizando seu plano...</Text>
      </View>
    );
  }

  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={step === 1 ? onClose : handleBack}>
          <Text style={styles.closeText}>{step === 1 ? (allowSkip ? 'Pular por agora' : '← Voltar') : '← Voltar'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Anamnese</Text>
      </View>

      <View style={styles.progressWrap}>
        <Text style={styles.progressLabel}>Passo {step} de {TOTAL_STEPS}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {step === 1 && (
          <Step1PersonalData
            sex={sex} setSex={setSex}
            age={age} setAge={setAge}
            weightKg={weightKg} setWeightKg={setWeightKg}
            heightCm={heightCm} setHeightCm={setHeightCm}
            activityLevel={activityLevel} setActivityLevel={setActivityLevel}
          />
        )}

        {step === 2 && (
          <Step2Objectives
            mainGoal={mainGoal} setMainGoal={setMainGoal}
            experienceLevel={experienceLevel} setExperienceLevel={setExperienceLevel}
            focusMuscleGroup={focusMuscleGroup} setFocusMuscleGroup={setFocusMuscleGroup}
            sex={sex}
            isVip={isVip}
            sexReady={sexReady}
            calcResult={calcResult}
            onCalculate={handleCalculate}
            ebooks={ebooks}
            onUpgrade={handleUpgrade}
          />
        )}

        {step === 3 && (
          <Step3Health
            trainingLocation={trainingLocation} setTrainingLocation={setTrainingLocation}
            painZones={painZones} togglePainZone={togglePainZone}
            healthIssues={healthIssues} setHealthIssues={setHealthIssues}
            daysPerWeek={daysPerWeek} setDaysPerWeek={setDaysPerWeek}
            sessionDurationMin={sessionDurationMin} setSessionDurationMin={setSessionDurationMin}
            sleepQuality={sleepQuality} setSleepQuality={setSleepQuality}
            isVip={isVip}
            questions={questions}
            customAnswers={customAnswers}
            setCustomAnswers={setCustomAnswers}
          />
        )}

        {step < TOTAL_STEPS ? (
          <TouchableOpacity style={styles.saveButton} onPress={handleNext}>
            <Text style={styles.saveButtonText}>Continuar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Enviar Anamnese</Text>}
          </TouchableOpacity>
        )}
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
  progressWrap: { paddingHorizontal: 16, marginBottom: 16 },
  progressLabel: { color: '#737373', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#171717', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#f97316', borderRadius: 3 },
  personalizingText: { color: '#f5f5f5', fontSize: 15, fontWeight: '700', marginTop: 16 },
  intro: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  sectionHeader: { color: '#f97316', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginTop: 22, marginBottom: 4, borderTopWidth: 1, borderTopColor: '#292524', paddingTop: 18 },
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
  calcButtonDisabled: { opacity: 0.4 },
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

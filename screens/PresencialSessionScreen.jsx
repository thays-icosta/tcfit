import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert, describeFunctionError } from './alertUtils';
import { HeaderBack } from './Header';

function parseReps(repsStr) {
  if (!repsStr) return 10;
  const numbers = repsStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 10;
  const nums = numbers.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function PresencialSessionScreen({ student, personalId, onClose }) {
  const [loadingFichas, setLoadingFichas] = useState(true);
  const [fichas, setFichas] = useState([]);
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [setLoads, setSetLoads] = useState({});
  const [setReps, setSetReps] = useState({});
  const [completedSets, setCompletedSets] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('workouts')
        .select('id, name')
        .eq('student_id', student.id)
        .eq('active', true);
      setFichas(data || []);
      setLoadingFichas(false);
    })();
  }, [student.id]);

  const handleSelectFicha = async (ficha) => {
    setLoadingExercises(true);
    setWorkout(ficha);
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, order_index, sets, reps, load_kg, exercise_id, exercises (name, muscle_group, thumbnail_url)')
      .eq('workout_id', ficha.id)
      .order('order_index', { ascending: true });
    setExercises(data || []);
    setLoadingExercises(false);

    setStarting(true);
    const { data: startData, error } = await supabase.functions.invoke('log-presencial-session', {
      body: { action: 'start', studentId: student.id, workoutId: ficha.id },
    });
    setStarting(false);
    if (error || !startData?.sessionId) {
      showAlert('Erro ao iniciar aula', await describeFunctionError(error, startData, 'Não foi possível iniciar a aula presencial.'));
      setWorkout(null);
      return;
    }
    setSessionId(startData.sessionId);
  };

  const handleCompleteSet = async (exercise, setNumber) => {
    Keyboard.dismiss();
    const key = `${exercise.id}-${setNumber}`;
    const loadValue = setLoads[key] !== undefined ? setLoads[key] : (exercise.load_kg != null ? String(exercise.load_kg) : '');
    const repsValue = setReps[key] !== undefined ? setReps[key] : (exercise.reps || '');

    setSavingKey(key);
    const { data, error } = await supabase.functions.invoke('log-presencial-session', {
      body: {
        action: 'log_set',
        studentId: student.id,
        sessionId,
        workoutExerciseId: exercise.id,
        setNumber,
        loadKg: loadValue || null,
        reps: repsValue || null,
      },
    });
    setSavingKey(null);
    if (error || !data?.ok) {
      showAlert('Erro ao salvar série', await describeFunctionError(error, data, 'Não foi possível salvar essa série.'));
      return;
    }
    setCompletedSets((prev) => ({ ...prev, [key]: true }));
  };

  const handleFinish = async () => {
    let tonnage = 0;
    exercises.forEach((ex) => {
      const setCount = ex.sets || 3;
      for (let i = 1; i <= setCount; i++) {
        const key = `${ex.id}-${i}`;
        if (!completedSets[key]) continue;
        const load = Number(setLoads[key] || ex.load_kg || 0);
        const reps = parseReps(setReps[key] || ex.reps);
        tonnage += load * reps;
      }
    });

    setFinishing(true);
    const { data, error } = await supabase.functions.invoke('log-presencial-session', {
      body: { action: 'finish', studentId: student.id, sessionId, workoutId: workout.id, totalTonnageKg: tonnage },
    });
    setFinishing(false);
    if (error || !data?.ok) {
      showAlert('Erro ao concluir aula', await describeFunctionError(error, data, 'Não foi possível concluir a aula.'));
      return;
    }
    showAlert('Aula registrada!', `Sessão presencial de ${student.name} salva com sucesso.`, [{ text: 'OK', onPress: onClose }]);
  };

  if (loadingFichas) {
    return (
      <View style={styles.container}>
        <HeaderBack title="Modo Aula Presencial" onBack={onClose} />
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.container}>
        <HeaderBack title="Modo Aula Presencial" onBack={onClose} />
        <Text style={styles.subtitle}>Escolha a ficha de {student.name} pra essa aula:</Text>
        {fichas.length === 0 ? (
          <Text style={styles.emptyText}>Esse aluno ainda não tem nenhuma ficha ativa.</Text>
        ) : (
          <ScrollView>
            {fichas.map((f) => (
              <TouchableOpacity key={f.id} style={styles.fichaCard} onPress={() => handleSelectFicha(f)} disabled={starting}>
                <Ionicons name="barbell-outline" size={20} color="#FF6B00" />
                <Text style={styles.fichaCardText}>{f.name}</Text>
                {starting ? <ActivityIndicator color="#FF6B00" size="small" /> : <Ionicons name="chevron-forward-outline" size={18} color="#525252" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title={workout.name} onBack={onClose} />
      <Text style={styles.subtitle}>Lançamento rápido — {student.name}</Text>

      {loadingExercises ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {exercises.map((ex) => {
            const setCount = ex.sets || 3;
            return (
              <View key={ex.id} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{ex.exercises?.name}</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.colSet]}>Série</Text>
                  <Text style={[styles.tableHeaderText, styles.colKg]}>Kg</Text>
                  <Text style={[styles.tableHeaderText, styles.colReps]}>Reps</Text>
                  <Text style={[styles.tableHeaderText, styles.colCheck]}> </Text>
                </View>
                {Array.from({ length: setCount }).map((_, i) => {
                  const setNumber = i + 1;
                  const key = `${ex.id}-${setNumber}`;
                  const done = completedSets[key];
                  return (
                    <View key={key} style={styles.tableRow}>
                      <Text style={[styles.setNumberText, styles.colSet]}>{setNumber}</Text>
                      <TextInput
                        style={[styles.cellInput, styles.colKg, done && styles.cellInputDone]}
                        keyboardType="number-pad"
                        editable={!done}
                        placeholder={ex.load_kg != null ? String(ex.load_kg) : '-'}
                        placeholderTextColor="#525252"
                        value={setLoads[key] !== undefined ? setLoads[key] : (ex.load_kg != null ? String(ex.load_kg) : '')}
                        onChangeText={(t) => setSetLoads((prev) => ({ ...prev, [key]: t }))}
                      />
                      <TextInput
                        style={[styles.cellInput, styles.colReps, done && styles.cellInputDone]}
                        editable={!done}
                        placeholder={ex.reps || '-'}
                        placeholderTextColor="#525252"
                        value={setReps[key] !== undefined ? setReps[key] : (ex.reps || '')}
                        onChangeText={(t) => setSetReps((prev) => ({ ...prev, [key]: t }))}
                      />
                      <View style={styles.colCheck}>
                        <TouchableOpacity
                          style={[styles.checkCircle, done && styles.checkCircleDone]}
                          onPress={() => !done && handleCompleteSet(ex, setNumber)}
                          disabled={done || savingKey === key}
                        >
                          {savingKey === key ? (
                            <ActivityIndicator color="#0F0F12" size="small" />
                          ) : (
                            <Text style={styles.checkText}>{done ? '✓' : ''}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.finishButton} onPress={handleFinish} disabled={finishing}>
        {finishing ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.finishButtonText}>Concluir Aula</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50, paddingHorizontal: 16 },
  subtitle: { color: '#a3a3a3', fontSize: 12, marginBottom: 14 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  fichaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 10 },
  fichaCardText: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', flex: 1 },
  exerciseCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 10 },
  exerciseName: { color: '#F5F5F7', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  tableHeader: { flexDirection: 'row', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#0F0F12', paddingBottom: 6 },
  tableHeaderText: { color: '#525252', fontSize: 9, textTransform: 'uppercase', fontWeight: '700', textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colSet: { width: 32 },
  colKg: { flex: 1, minWidth: 0, marginHorizontal: 3 },
  colReps: { flex: 1, minWidth: 0, marginHorizontal: 3 },
  colCheck: { width: 40, alignItems: 'center' },
  setNumberText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cellInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 2, minWidth: 0, color: '#F5F5F7', fontSize: 13, textAlign: 'center' },
  cellInputDone: { opacity: 0.5 },
  checkCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#2B2B36', alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkText: { color: '#0F0F12', fontSize: 15, fontWeight: '800' },
  finishButton: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  finishButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '700' },
});

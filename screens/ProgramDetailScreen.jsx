import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { PROGRAM_LEVELS, PROGRAM_GOALS } from './accessLevel';

const WHATSAPP_NUMBER = '5537998231382';

export default function ProgramDetailScreen({ product, studentId, personalId, unlocked, onClose }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [exercisesByTemplate, setExercisesByTemplate] = useState({});
  const [loadingExercisesFor, setLoadingExercisesFor] = useState(null);
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sessionBased, setSessionBased] = useState(false);

  useEffect(() => {
    (async () => {
      if (product.source_template_id) {
        const { data: sessionRows } = await supabase
          .from('template_sessions')
          .select('id, name, order_index')
          .eq('template_id', product.source_template_id)
          .order('order_index');
        setDivisions((sessionRows || []).map((s) => ({ id: s.id, name: s.name })));
        setSessionBased(true);
      } else {
        const { data: rows } = await supabase
          .from('product_templates')
          .select('template_id, order_index, workout_templates (name)')
          .eq('product_id', product.id)
          .order('order_index');

        const list = rows && rows.length > 0
          ? rows.map((r) => ({ id: r.template_id, name: r.workout_templates?.name || 'Treino' }))
          : product.template_id
            ? [{ id: product.template_id, name: product.name }]
            : [];
        setDivisions(list);
        setSessionBased(false);
      }

      if (unlocked) {
        const { data: existing } = await supabase
          .from('workouts')
          .select('id')
          .eq('student_id', studentId)
          .eq('product_id', product.id)
          .limit(1);
        setAlreadyAdded((existing || []).length > 0);
      }

      setLoading(false);
    })();
  }, [product.id, unlocked]);

  const handleExpand = async (templateId) => {
    if (expandedId === templateId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(templateId);
    if (exercisesByTemplate[templateId]) return;

    setLoadingExercisesFor(templateId);
    const { data } = await supabase
      .from('workout_template_exercises')
      .select('id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, exercises (name, muscle_group)')
      .eq(sessionBased ? 'session_id' : 'template_id', templateId)
      .order('order_index');
    setExercisesByTemplate((prev) => ({ ...prev, [templateId]: data || [] }));
    setLoadingExercisesFor(null);
  };

  const handleUnlockRequest = () => {
    const message = `Olá! Vi o programa "${product.name}" no app e quero desbloquear.`;
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const handleAddProgram = async () => {
    if (alreadyAdded || divisions.length === 0) return;
    setAdding(true);
    try {
      for (const division of divisions) {
        const { data: templateItems } = await supabase
          .from('workout_template_exercises')
          .select('exercise_id, order_index, sets, reps, load_kg, cadence, rest_time_seconds, execution_method, notes')
          .eq(sessionBased ? 'session_id' : 'template_id', division.id);

        const { data: newWorkout, error } = await supabase
          .from('workouts')
          .insert({ student_id: studentId, personal_id: personalId, name: division.name, active: true, product_id: product.id })
          .select()
          .single();

        if (error || !newWorkout) throw error || new Error('no workout');

        if (templateItems && templateItems.length > 0) {
          const copies = templateItems.map((it) => ({ ...it, workout_id: newWorkout.id }));
          await supabase.from('workout_exercises').insert(copies);
        }
      }
      setAlreadyAdded(true);
      showAlert('Programa adicionado!', 'Confira na aba de Treinos.');
    } catch {
      showAlert('Ops', 'Não deu pra adicionar o programa agora. Tenta de novo.');
    }
    setAdding(false);
  };

  const levelLabel = PROGRAM_LEVELS.find((l) => l.value === product.level)?.label;
  const goalLabel = PROGRAM_GOALS.find((g) => g.value === product.goal)?.label;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{product.name}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View style={styles.posterWrap}>
          {product.cover_image_url ? (
            <Image source={{ uri: product.cover_image_url }} style={styles.posterImage} resizeMode="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="barbell-outline" size={40} color="#f97316" />
            </View>
          )}
          {!unlocked && (
            <View style={styles.posterLockOverlay}>
              <Ionicons name="lock-closed" size={28} color="#f5f5f5" />
            </View>
          )}
        </View>

        {(levelLabel || goalLabel) && (
          <View style={styles.metaBadgeRow}>
            {levelLabel ? <Text style={styles.metaBadge}>{levelLabel}</Text> : null}
            {goalLabel ? <Text style={styles.metaBadge}>{goalLabel}</Text> : null}
          </View>
        )}

        {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

        {loading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
        ) : !unlocked ? (
          <>
            <Text style={styles.price}>{product.price != null ? `R$ ${Number(product.price).toFixed(2).replace('.', ',')}` : 'Consulte'}</Text>
            <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockRequest}>
              <Ionicons name="lock-open-outline" size={16} color="#0a0a0a" />
              <Text style={styles.unlockButtonText}>Desbloquear Conteúdo / Assinar Plano</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {alreadyAdded ? (
              <View style={styles.addedBox}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text style={styles.addedBoxText}>Programa já está na sua aba de Treinos</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.unlockButton} onPress={handleAddProgram} disabled={adding}>
                {adding ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.unlockButtonText}>🏋️ Adicionar Programa aos Meus Treinos</Text>}
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>Divisão de Treinos</Text>
            {divisions.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum treino vinculado a esse programa ainda.</Text>
            ) : (
              divisions.map((d, i) => {
                const expanded = expandedId === d.id;
                const exercises = exercisesByTemplate[d.id];
                return (
                  <View key={d.id} style={styles.divisionCard}>
                    <TouchableOpacity style={styles.divisionHeader} onPress={() => handleExpand(d.id)}>
                      <View style={styles.divisionLetterCircle}>
                        <Text style={styles.divisionLetterText}>{String.fromCharCode(65 + i)}</Text>
                      </View>
                      <Text style={styles.divisionName}>{d.name}</Text>
                      <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#737373" />
                    </TouchableOpacity>

                    {expanded && (
                      <View style={styles.divisionBody}>
                        {loadingExercisesFor === d.id ? (
                          <ActivityIndicator color="#f97316" style={{ marginVertical: 10 }} />
                        ) : !exercises || exercises.length === 0 ? (
                          <Text style={styles.emptyText}>Nenhum exercício nesse treino ainda.</Text>
                        ) : (
                          exercises.map((ex) => (
                            <View key={ex.id} style={styles.exerciseRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.exerciseName}>{ex.exercises?.name || 'Exercício'}</Text>
                                <Text style={styles.exerciseMeta}>
                                  {ex.sets ? `${ex.sets}x` : ''}{ex.reps || ''}{ex.load_kg ? ` · ${ex.load_kg}kg` : ''}{ex.rest_time_seconds ? ` · ${ex.rest_time_seconds}s desc.` : ''}
                                </Text>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16, flexShrink: 1 },
  posterWrap: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', overflow: 'hidden', position: 'relative' },
  posterImage: { width: '100%', height: '100%' },
  posterPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  posterLockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  metaBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  metaBadge: { color: '#a3a3a3', fontSize: 11, fontWeight: '700', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  description: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginTop: 12 },
  price: { color: '#f97316', fontSize: 22, fontWeight: '800', marginTop: 16 },
  unlockButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  unlockButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  addedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginTop: 16 },
  addedBoxText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  sectionLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 },
  emptyText: { color: '#525252', fontSize: 12, textAlign: 'center', marginTop: 10 },
  divisionCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  divisionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  divisionLetterCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center' },
  divisionLetterText: { color: '#f97316', fontSize: 12, fontWeight: '800' },
  divisionName: { flex: 1, color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  divisionBody: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0a0a0a' },
  exerciseName: { color: '#f5f5f5', fontSize: 12, fontWeight: '600' },
  exerciseMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
});

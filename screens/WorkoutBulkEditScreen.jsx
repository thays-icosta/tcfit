import React, { useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './supabaseClient';
import ExerciseVideoScreen from './ExerciseVideoScreen';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';
import { hasLoggedExerciseHistory } from './workoutVersioning';
import { METHODS, METHOD_LABELS } from './exerciseMethods';
import { COLORS } from './theme';

// "Editar treino": the whole ficha on one compact screen. Step 1 of building
// a ficha is just picking exercises; this is step 2 — set series / reps /
// descanso / método (plus carga and observação) for every exercise without
// opening a screen per exercise.
//
// Nothing is written until "Salvar treino". Edits, duplicates, deletions and
// the new order are a local draft; saving applies them to the SAME
// workout_exercises rows the rest of the app reads (same table, same
// columns), so history, progression, volume and the aluno's view keep working.

const toDraftRow = (item) => ({
  key: item.id,
  id: item.id,
  exercise: item.exercises || null,
  sets: item.sets != null ? String(item.sets) : '3',
  reps: item.reps || '',
  rest: item.rest_time_seconds != null ? String(item.rest_time_seconds) : '',
  load: item.load_kg != null ? String(item.load_kg) : '',
  method: item.execution_method || 'tradicional',
  notes: item.notes || '',
  cadence: item.cadence || null,
});

const parseInteger = (text) => {
  const n = parseInt(String(text).trim(), 10);
  return Number.isFinite(n) ? n : null;
};

export default function WorkoutBulkEditScreen({ workoutId, workoutName, items, onSaved, onClose }) {
  const [draft, setDraft] = useState(() => items.map(toDraftRow));
  const [deletedIds, setDeletedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [watching, setWatching] = useState(null);
  const [showApplyAll, setShowApplyAll] = useState(false);
  const [applySets, setApplySets] = useState('');
  const [applyReps, setApplyReps] = useState('');
  const [applyRest, setApplyRest] = useState('');
  const tempCounter = useRef(0);
  const initialSnapshot = useRef(JSON.stringify(items.map(toDraftRow).map(({ exercise, ...rest }) => rest)));

  const dirty = useMemo(
    () => deletedIds.length > 0 || JSON.stringify(draft.map(({ exercise, ...rest }) => rest)) !== initialSnapshot.current,
    [draft, deletedIds]
  );

  const patchRow = (key, patch) => setDraft((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleDuplicate = (row) => {
    tempCounter.current += 1;
    const copy = { ...row, key: `new-${tempCounter.current}`, id: null };
    setDraft((prev) => {
      const at = prev.findIndex((r) => r.key === row.key);
      return [...prev.slice(0, at + 1), copy, ...prev.slice(at + 1)];
    });
  };

  const handleRemove = async (row) => {
    // Same protection as removing from the ficha list: a row the student has
    // already logged sets against can't be deleted without wiping that history.
    if (row.id && (await hasLoggedExerciseHistory(supabase, row.id))) {
      showAlert(
        'Não é possível remover',
        'Esse exercício já tem histórico de execução registrado pelo aluno. Removê-lo apagaria esse histórico permanentemente. Se a prescrição mudou, crie uma nova semana em vez de editar esta.'
      );
      return;
    }
    setDraft((prev) => prev.filter((r) => r.key !== row.key));
    if (row.id) setDeletedIds((prev) => [...prev, row.id]);
  };

  // "Aplicar a todos": copies whichever of séries/reps/descanso are filled into
  // every row of the draft. Nothing is saved until "Salvar treino".
  const handleApplyAll = () => {
    const patch = {};
    if (applySets.trim() !== '') {
      if (parseInteger(applySets) == null || parseInteger(applySets) < 1) { showAlert('Confere os dados', 'Séries inválidas. Use um número inteiro.'); return; }
      patch.sets = String(parseInteger(applySets));
    }
    if (applyReps.trim() !== '') patch.reps = applyReps.trim();
    if (applyRest.trim() !== '') {
      if (parseInteger(applyRest) == null || parseInteger(applyRest) < 0) { showAlert('Confere os dados', 'Descanso inválido. Use segundos (ex: 60).'); return; }
      patch.rest = String(parseInteger(applyRest));
    }
    if (Object.keys(patch).length === 0) { showAlert('Nada pra aplicar', 'Preenche séries, reps ou descanso.'); return; }
    setDraft((prev) => prev.map((r) => ({ ...r, ...patch })));
    setShowApplyAll(false);
  };

  const handleClose = () => {
    if (!dirty) { onClose(); return; }
    showAlert('Descartar alterações?', 'Você mudou o treino e ainda não salvou.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: onClose },
    ]);
  };

  const handleSave = async () => {
    // validate before touching the database
    const rows = [];
    for (let i = 0; i < draft.length; i += 1) {
      const r = draft[i];
      const sets = r.sets.trim() === '' ? 3 : parseInteger(r.sets);
      if (sets == null || sets < 1) {
        showAlert('Confere os dados', `Séries inválidas em "${r.exercise?.name}". Use um número inteiro.`);
        return;
      }
      const rest = r.rest.trim() === '' ? null : parseInteger(r.rest);
      if (r.rest.trim() !== '' && (rest == null || rest < 0)) {
        showAlert('Confere os dados', `Descanso inválido em "${r.exercise?.name}". Use segundos (ex: 60).`);
        return;
      }
      const load = r.load.trim() === '' ? null : parseFloat(r.load.replace(',', '.'));
      if (r.load.trim() !== '' && !Number.isFinite(load)) {
        showAlert('Confere os dados', `Carga inválida em "${r.exercise?.name}". Use número (ex: 20 ou 22,5).`);
        return;
      }
      rows.push({ row: r, order_index: i, fields: {
        sets,
        reps: r.reps.trim(),
        rest_time_seconds: rest,
        load_kg: load,
        execution_method: r.method,
        notes: r.notes.trim() || null,
      } });
    }

    setSaving(true);
    try {
      if (deletedIds.length > 0) {
        const { error } = await supabase.from('workout_exercises').delete().in('id', deletedIds);
        if (error) throw error;
      }
      const results = await Promise.all(rows.map(({ row, order_index, fields }) => (
        row.id
          ? supabase.from('workout_exercises').update({ ...fields, order_index }).eq('id', row.id)
          : supabase.from('workout_exercises').insert({
              workout_id: workoutId,
              exercise_id: row.exercise.id,
              cadence: row.cadence,
              ...fields,
              order_index,
            })
      )));
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
      setSaving(false);
      onSaved();
    } catch (e) {
      console.error('Erro ao salvar treino:', e);
      setSaving(false);
      showAlert('Não foi possível salvar', 'Algo deu errado ao salvar o treino. Suas alterações continuam aqui na tela — tenta de novo.');
    }
  };

  if (watching) {
    return <ExerciseVideoScreen videoUrl={watching.url} exerciseName={watching.name} onClose={() => setWatching(null)} />;
  }

  const renderRow = ({ item: row, getIndex, drag, isActive }) => {
    const index = getIndex();
    const hasVideo = !!row.exercise?.video_url;
    return (
      <View style={[styles.rowCard, isActive && styles.rowCardActive]}>
        <View style={styles.rowHeader}>
          <TouchableOpacity onPressIn={drag} disabled={isActive} hitSlop={8} style={styles.dragHandle} accessibilityLabel="Arrastar para reordenar">
            <Ionicons name="reorder-three-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.rowName} numberOfLines={2}>{row.exercise?.name}</Text>
          <TouchableOpacity onPress={() => handleDuplicate(row)} hitSlop={8} style={styles.iconButton} accessibilityLabel="Duplicar exercício">
            <Ionicons name="copy-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemove(row)} hitSlop={8} style={styles.iconButton} accessibilityLabel="Excluir exercício">
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.fieldsRow}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Séries</Text>
            <TextInput
              style={styles.input}
              value={row.sets}
              onChangeText={(t) => patchRow(row.key, { sets: t })}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <View style={[styles.field, { flex: 1.4 }]}>
            <Text style={styles.fieldLabel}>Reps</Text>
            <TextInput
              style={styles.input}
              value={row.reps}
              onChangeText={(t) => patchRow(row.key, { reps: t })}
              placeholder="8-10"
              placeholderTextColor="#525252"
              selectTextOnFocus
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Descanso (s)</Text>
            <TextInput
              style={styles.input}
              value={row.rest}
              onChangeText={(t) => patchRow(row.key, { rest: t })}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor="#525252"
              selectTextOnFocus
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Carga (kg)</Text>
            <TextInput
              style={styles.input}
              value={row.load}
              onChangeText={(t) => patchRow(row.key, { load: t })}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor="#525252"
              selectTextOnFocus
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
          {METHODS.map((m) => {
            const active = row.method === m;
            return (
              <TouchableOpacity key={m} style={[styles.methodChip, active && styles.methodChipActive]} onPress={() => patchRow(row.key, { method: m })}>
                <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>{METHOD_LABELS[m]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={[styles.input, styles.notesInput]}
          value={row.notes}
          onChangeText={(t) => patchRow(row.key, { notes: t })}
          placeholder="Observação (opcional)"
          placeholderTextColor="#525252"
        />

        {hasVideo && (
          <TouchableOpacity onPress={() => setWatching({ url: row.exercise.video_url, name: row.exercise.name })}>
            <Text style={styles.watchLink}>▶ Ver execução</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <HeaderBack title="Editar treino" onBack={handleClose} style={{ paddingHorizontal: 16 }} />
        <Text style={styles.subtitle}>
          {workoutName} · {draft.length} exercício{draft.length !== 1 ? 's' : ''}
        </Text>

        <View style={styles.applyAllWrap}>
          <TouchableOpacity onPress={() => setShowApplyAll((v) => !v)} style={styles.applyAllToggle} accessibilityLabel="Aplicar a todos">
            <Ionicons name={showApplyAll ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
            <Text style={styles.applyAllToggleText}>Aplicar a todos</Text>
          </TouchableOpacity>
          {showApplyAll && (
            <View style={styles.applyAllPanel}>
              <View style={styles.fieldsRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Séries</Text>
                  <TextInput style={styles.input} value={applySets} onChangeText={setApplySets} keyboardType="number-pad" placeholder="4" placeholderTextColor="#525252" />
                </View>
                <View style={[styles.field, { flex: 1.4 }]}>
                  <Text style={styles.fieldLabel}>Reps</Text>
                  <TextInput style={styles.input} value={applyReps} onChangeText={setApplyReps} placeholder="8-10" placeholderTextColor="#525252" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Descanso (s)</Text>
                  <TextInput style={styles.input} value={applyRest} onChangeText={setApplyRest} keyboardType="number-pad" placeholder="60" placeholderTextColor="#525252" />
                </View>
              </View>
              <TouchableOpacity style={styles.applyAllButton} onPress={handleApplyAll}>
                <Text style={styles.applyAllButtonText}>Aplicar a todos os exercícios</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <DraggableFlatList
          data={draft}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          onDragEnd={({ data }) => setDraft(data)}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício na ficha.</Text>}
        />

        <View style={styles.bottomBar}>
          <TouchableOpacity style={[styles.saveButton, (!dirty || saving) && styles.saveButtonDisabled]} onPress={handleSave} disabled={!dirty || saving}>
            {saving ? <ActivityIndicator color={COLORS.onAccent} /> : <Text style={styles.saveButtonText}>Salvar treino</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50 },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, paddingHorizontal: 16, marginBottom: 12 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 30, fontSize: 13 },

  rowCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 12 },
  rowCardActive: { borderColor: COLORS.accent, opacity: 0.92 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dragHandle: { paddingVertical: 2, paddingRight: 2 },
  rowIndex: { color: '#525252', fontSize: 13, fontWeight: '800', width: 22 },
  rowName: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  iconButton: { padding: 6 },

  fieldsRow: { flexDirection: 'row', gap: 8 },
  field: { flex: 1 },
  fieldLabel: { color: '#737373', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 },
  input: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: COLORS.text, fontSize: 14 },

  methodRow: { gap: 6, paddingVertical: 10 },
  methodChip: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  methodChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  methodChipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  methodChipTextActive: { color: COLORS.onAccent, fontWeight: '800' },

  applyAllWrap: { marginHorizontal: 16, marginBottom: 10 },
  applyAllToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  applyAllToggleText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  applyAllPanel: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginTop: 6 },
  applyAllButton: { borderWidth: 1, borderColor: COLORS.accent, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  applyAllButtonText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  notesInput: { fontSize: 12 },
  watchLink: { color: COLORS.text, fontSize: 11, fontWeight: '700', marginTop: 10, textDecorationLine: 'underline' },

  bottomBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  saveButton: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: COLORS.onAccent, fontSize: 15, fontWeight: '800' },
});

// App-side glue for the AI copilot: builds the request (student context + the
// ficha being looked at), calls the `ai-copilot` edge function, and applies a
// suggestion the personal explicitly accepted. Nothing here writes to the
// database on its own — applyAdjustment is only ever called from a button tap.

import { buildStudentContext } from './aiContext';
import { describeFunctionError } from './alertUtils';
import { METHODS } from './exerciseMethods';

// suggestion field -> workout_exercises column
const FIELD_TO_COLUMN = {
  series: 'sets',
  reps: 'reps',
  cargaKg: 'load_kg',
  descansoSeg: 'rest_time_seconds',
  metodo: 'execution_method',
  observacao: 'notes',
};

export const FIELD_LABEL = {
  series: 'Séries',
  reps: 'Reps',
  cargaKg: 'Carga (kg)',
  descansoSeg: 'Descanso (s)',
  metodo: 'Método',
  observacao: 'Observação',
};

// Same rules the edge function enforces, so a value the personal edits by hand
// is held to the same limits as one the AI proposed. Returns null when invalid.
export function parseAdjustmentValue(campo, raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  switch (campo) {
    case 'series': {
      if (!/^\d{1,2}$/.test(s)) return null;
      const n = Number(s);
      return n >= 1 && n <= 10 ? n : null;
    }
    case 'reps':
      return /^\d{1,2}(\s*-\s*\d{1,2})?$/.test(s) ? s.replace(/\s+/g, '') : null;
    case 'cargaKg': {
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.round(n * 2) / 2 : null;
    }
    case 'descansoSeg': {
      if (!/^\d{1,3}$/.test(s)) return null;
      const n = Number(s);
      return n >= 15 && n <= 600 ? n : null;
    }
    case 'metodo':
      return METHODS.includes(s) ? s : null;
    case 'observacao':
      return s.slice(0, 120);
    default:
      return null;
  }
}

// What the ficha looks like to the AI: neutral refs (e1, e2…) instead of row
// ids, and a map back to the real workout_exercises ids for applying.
export function buildFichaPayload(workoutName, items) {
  const refToItemId = {};
  const exercicios = items.map((it, i) => {
    const ref = `e${i + 1}`;
    refToItemId[ref] = it.id;
    return {
      ref,
      nome: it.exercises?.name || 'Exercício',
      grupo: it.exercises?.muscle_group || null,
      series: it.sets ?? null,
      reps: it.reps ?? null,
      cargaKg: it.load_kg ?? null,
      descansoSeg: it.rest_time_seconds ?? null,
      metodo: it.execution_method || null,
      observacao: it.notes || null,
    };
  });
  return { ficha: { nome: workoutName || 'Treino', exercicios }, refToItemId };
}

export async function requestWorkoutAnalysis(client, { studentId, workoutName, items }) {
  const { ficha, refToItemId } = buildFichaPayload(workoutName, items);
  const context = await buildStudentContext(client, { studentId });
  const { data, error } = await client.functions.invoke('ai-copilot', {
    body: { action: 'analyze_workout', context, ficha },
  });
  if (error || !data?.analysis) {
    throw new Error(await describeFunctionError(error, data, 'Não consegui analisar o treino agora. Tenta de novo em instantes.'));
  }
  return { analysis: data.analysis, refToItemId };
}

// "Revisar Aluno": a read-only x-ray. Only the student context goes out — there
// is no ficha and nothing is ever applied from the answer.
export async function requestStudentReview(client, { studentId }) {
  const context = await buildStudentContext(client, { studentId });
  const { data, error } = await client.functions.invoke('ai-copilot', {
    body: { action: 'review_student', context },
  });
  if (error || !data?.review) {
    throw new Error(await describeFunctionError(error, data, 'Não consegui revisar o aluno agora. Tenta de novo em instantes.'));
  }
  return data.review;
}

// "Montar com IA", step 1: the AI proposes a STRUCTURE (how many treinos, focus,
// muscle groups, exercises/sets/reps/rest per treino) for the personal to
// approve. No exercise is chosen and nothing is created at this point.
export async function requestWorkoutProposal(client, { studentId, instruction }) {
  const context = await buildStudentContext(client, { studentId });
  const { data, error } = await client.functions.invoke('ai-copilot', {
    body: { action: 'propose_workout', context, instruction: (instruction || '').trim() },
  });
  if (error || !data?.proposal) {
    throw new Error(await describeFunctionError(error, data, 'Não consegui montar a proposta agora. Tenta de novo em instantes.'));
  }
  return data.proposal;
}

// The text step 2 (the existing generate-workout function) receives for one
// approved treino. That function only ever picks exercises that exist in the
// personal's library.
export function buildGenerationInstruction(treino, { objetivo } = {}) {
  const parts = [
    `${treino.nome}. Foco: ${treino.foco || treino.grupos.join(', ')}.`,
    `Grupos musculares: ${treino.grupos.join(', ')}.`,
    `Monte ${treino.numExercicios} exercícios, cada um com ${treino.seriesPorExercicio} séries de ${treino.repeticoes} repetições e ${treino.descansoSeg} segundos de descanso.`,
  ];
  if (objetivo) parts.push(`Objetivo do aluno: ${objetivo}.`);
  if (treino.evitar && treino.evitar.length > 0) parts.push(`Evite: ${treino.evitar.join('; ')}.`);
  return parts.join(' ');
}

// "Montar com IA", step 2 for ONE approved treino: asks generate-workout for
// exercises from the library, then creates the ficha. Name, sets, reps and rest
// are exactly what the personal approved in step 1 — the AI only picks which
// exercises (and their order). Never touches existing fichas. If saving the
// exercises fails, the empty ficha is removed again.
export async function createFichaFromProposal(client, { treino, objetivo, studentId, personalId, phaseId }) {
  const { data, error } = await client.functions.invoke('generate-workout', {
    body: { instruction: buildGenerationInstruction(treino, { objetivo }) },
  });
  if (error || data?.error) {
    return { ok: false, error: await describeFunctionError(error, data, 'Tenta de novo em alguns instantes.') };
  }
  const found = (data?.exercises || []).slice(0, treino.numExercicios);
  if (found.length === 0) {
    return { ok: false, error: 'A IA não encontrou exercícios da sua biblioteca para este treino.' };
  }

  const { data: workout, error: workoutError } = await client
    .from('workouts')
    .insert({ student_id: studentId, personal_id: personalId, name: treino.nome, active: true, phase_id: phaseId || null })
    .select()
    .single();
  if (workoutError || !workout) {
    return { ok: false, error: workoutError?.message || 'Não foi possível criar a ficha.' };
  }

  const rows = found.map((ex, index) => ({
    workout_id: workout.id,
    exercise_id: ex.exercise_id,
    order_index: index,
    sets: treino.seriesPorExercicio,
    reps: treino.repeticoes,
    rest_time_seconds: treino.descansoSeg,
  }));
  const { error: rowsError } = await client.from('workout_exercises').insert(rows);
  if (rowsError) {
    await client.from('workouts').delete().eq('id', workout.id);
    return { ok: false, error: rowsError.message || 'Não foi possível salvar os exercícios.' };
  }

  return { ok: true, workoutId: workout.id, nome: workout.name, exerciseCount: rows.length, missing: Math.max(0, treino.numExercicios - rows.length) };
}

// Writes ONE field of ONE exercise row — the same kind of edit the manual
// editors make. Never touches history rows, never deletes or swaps anything.
export async function applyAdjustment(client, { itemId, campo, valor }) {
  const column = FIELD_TO_COLUMN[campo];
  if (!column || !itemId) return { error: new Error('Ajuste inválido.') };
  const value = valor === '' || valor === undefined ? null : valor;
  return client.from('workout_exercises').update({ [column]: value }).eq('id', itemId);
}

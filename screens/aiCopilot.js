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

// Writes ONE field of ONE exercise row — the same kind of edit the manual
// editors make. Never touches history rows, never deletes or swaps anything.
export async function applyAdjustment(client, { itemId, campo, valor }) {
  const column = FIELD_TO_COLUMN[campo];
  if (!column || !itemId) return { error: new Error('Ajuste inválido.') };
  const value = valor === '' || valor === undefined ? null : valor;
  return client.from('workout_exercises').update({ [column]: value }).eq('id', itemId);
}

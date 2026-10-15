// Student-context orchestrator for the AI copilot ("Revisar Aluno", "Analisar
// Treino", "Montar com IA"). It does NOT call any AI: it gathers what the app
// already knows about a student — scattered across a dozen tables and the
// existing helpers (volume, progression, periodization, ficha versioning) —
// and packs it into one compact, structured object the AI functions can read.
//
// Rules this module follows on purpose:
//  * Reuses the existing helpers instead of re-deriving numbers, so the AI
//    sees the same volume/progression figures the personal sees on screen.
//  * Runs with the caller's own Supabase client, so RLS decides what's
//    readable — it can never see a student the personal couldn't open.
//  * Nothing that identifies the student leaves the app: no name, e-mail,
//    phone or ids — only training/health data the AI needs to reason.
//  * Missing data is explicit (`null` + the `lacunas` list), never guessed, so
//    the prompt can tell the AI to say "insuficiente" instead of inventing.
//  * Read-only: it never writes anything and nothing is stored.

import { loadWeeklyVolumeTargets, resolveSetsMuscleGroups, getVolumeStatus } from './volumeUtils';
import { estimate1RM, topSetsBySession, suggestNextLoad, parseRepsNumber } from './progressionUtils';
import { loadPeriodizationPlan, getCurrentPhase } from './periodizationUtils';
import { loadCurrentWeekWorkouts, loadWeekHistory, loadWorkoutSummaries } from './workoutVersioning';
import {
  PROGRAM_GOALS, PROGRAM_LEVELS, TRAINING_LOCATIONS, PAIN_ZONES, ACTIVITY_LEVELS,
  SLEEP_QUALITY_OPTIONS, MUSCLE_FOCUS_OPTIONS,
} from './accessLevel';

export const STUDENT_CONTEXT_VERSION = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_WINDOW_DAYS = 90; // progression history
const VOLUME_WINDOW_DAYS = 28; // executed volume / frequency
const NOTES_WINDOW_DAYS = 60;
const MAX_PROGRESSION_EXERCISES = 15;
const PREVIOUS_WEEKS = 3;
const SESSION_ID_CHUNK = 40; // keeps the `in.(…)` URL short
const PAGE_SIZE = 1000; // PostgREST default row cap
const MAX_CONTEXT_CHARS = 24000;

const WEEKDAY_LABEL = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };

const labelOf = (list, value) => {
  if (value == null || value === '') return null;
  return list.find((o) => o.value === value)?.label || String(value);
};
const round1 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const clip = (text, max) => {
  if (text == null) return null;
  const s = String(text).trim();
  return s ? s.slice(0, max) : null;
};
const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const average = (nums) => {
  const v = nums.filter((n) => n != null && Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function ageFromBirthDate(birthDate, now) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const beforeBirthday = now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

// Collects query failures instead of throwing: one table being unreadable must
// not stop the whole context, but the caller can see what's missing.
function makeRunner(avisos) {
  return async (label, promise) => {
    try {
      const { data, error } = await promise;
      if (error) {
        avisos.push(`${label}: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      avisos.push(`${label}: ${String(e?.message || e)}`);
      return null;
    }
  };
}

async function fetchAllPages(makePage) {
  const rows = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await makePage(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) return { rows, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

function trendFrom(history) {
  // history: topSetsBySession output, newest first.
  const e1rms = history.map((h) => estimate1RM(h.load, h.repsNum)).filter((v) => v != null);
  if (e1rms.length < 2) return { tendencia: 'insuficiente', deltaPct: null, e1RM: e1rms[0] ?? null };
  const latest = e1rms[0];
  const baseline = average(e1rms.slice(1, 4));
  const deltaPct = baseline ? round1(((latest - baseline) / baseline) * 100) : null;
  let tendencia = 'estavel';
  if (deltaPct != null && deltaPct > 2) tendencia = 'subindo';
  else if (deltaPct != null && deltaPct < -2) tendencia = 'caindo';
  return { tendencia, deltaPct, e1RM: latest };
}

// Trims the biggest arrays if the context would be too large for a prompt.
function fitContext(ctx) {
  const size = () => JSON.stringify(ctx).length;
  if (size() <= MAX_CONTEXT_CHARS) return ctx;
  if (ctx.progressao?.porExercicio) ctx.progressao.porExercicio = ctx.progressao.porExercicio.slice(0, 10);
  if (size() <= MAX_CONTEXT_CHARS) return ctx;
  ctx.semanasAnteriores = ctx.semanasAnteriores.slice(0, 2);
  if (ctx.avaliacao?.evolucao) ctx.avaliacao.evolucao = ctx.avaliacao.evolucao.slice(0, 4);
  ctx.meta.truncado = true;
  return ctx;
}

export async function buildStudentContext(client, { studentId, now = new Date() }) {
  const avisos = [];
  const run = makeRunner(avisos);
  const since = (days) => new Date(now.getTime() - days * DAY_MS).toISOString();

  const [userRow, anamneseRows, assessmentRows, periodization, activeWorkouts, weekHistory, targets, sessionRows, noteRows] = await Promise.all([
    run('users', client.from('users')
      .select('birth_date, gender, attendance_mode, student_type, personal_notes, weight_kg, anamnese_completed_at')
      .eq('id', studentId).maybeSingle()),
    run('anamnese_responses', client.from('anamnese_responses')
      .select('main_goal, experience_level, days_per_week, session_duration_min, training_location, activity_level, sleep_quality, focus_muscle_group, health_issues, pain_zones, sex, weight_kg, height_cm, age, completed_at')
      .eq('student_id', studentId).order('created_at', { ascending: false }).limit(1)),
    run('physical_assessments', client.from('physical_assessments')
      .select('assessment_date, mode, weight_kg, body_fat_pct, skeletal_muscle_kg, fat_mass_kg, body_water_pct, visceral_fat, bmi, height_cm, perimeters, notes')
      .eq('student_id', studentId).order('assessment_date', { ascending: false }).limit(6)),
    loadPeriodizationPlan(client, studentId).catch((e) => { avisos.push(`periodizacao: ${e.message}`); return { plan: null, phases: [] }; }),
    loadCurrentWeekWorkouts(client, studentId).catch((e) => { avisos.push(`fichas: ${e.message}`); return []; }),
    loadWeekHistory(client, studentId).catch((e) => { avisos.push(`historico_semanas: ${e.message}`); return []; }),
    loadWeeklyVolumeTargets(client, studentId).catch((e) => { avisos.push(`metas_volume: ${e.message}`); return {}; }),
    run('workout_sessions', client.from('workout_sessions')
      .select('id, workout_id, started_at, finished_at, pse, total_tonnage_kg')
      .eq('student_id', studentId).not('finished_at', 'is', null)
      .gte('started_at', since(SESSION_WINDOW_DAYS)).order('started_at', { ascending: false }).limit(120)),
    run('session_personal_notes', client.from('session_personal_notes')
      .select('notes, created_at')
      .eq('student_id', studentId).gte('created_at', since(NOTES_WINDOW_DAYS))
      .order('created_at', { ascending: false }).limit(5)),
  ]);

  const anamnese = (anamneseRows || [])[0] || null;
  const user = userRow || null;
  const sessions = sessionRows || [];

  // --- ficha ativa -------------------------------------------------------
  const activeIds = (activeWorkouts || []).map((w) => w.id);
  const itemRows = activeIds.length === 0 ? [] : (await run('workout_exercises', client.from('workout_exercises')
    .select('id, workout_id, exercise_id, order_index, sets, reps, load_kg, rest_time_seconds, execution_method, notes, exercises (name, muscle_group)')
    .in('workout_id', activeIds).order('order_index', { ascending: true }))) || [];

  const sortedWorkouts = [...(activeWorkouts || [])].sort((a, b) => {
    const aw = a.weekday == null ? 99 : a.weekday;
    const bw = b.weekday == null ? 99 : b.weekday;
    return aw - bw || String(a.created_at).localeCompare(String(b.created_at));
  });
  const plannedSetsByGroup = {};
  let totalSeriesSemana = 0;
  const fichas = sortedWorkouts.map((w) => {
    const items = itemRows.filter((r) => r.workout_id === w.id);
    return {
      nome: w.name,
      diaSemana: w.weekday != null ? WEEKDAY_LABEL[w.weekday] : null,
      observacao: clip(w.notes, 200),
      exercicios: items.map((it) => {
        const sets = it.sets || 3;
        const group = it.exercises?.muscle_group || null;
        totalSeriesSemana += sets;
        if (group && group !== 'aerobico') plannedSetsByGroup[group] = (plannedSetsByGroup[group] || 0) + sets;
        return {
          nome: it.exercises?.name || null,
          grupo: group,
          series: sets,
          reps: it.reps || null,
          cargaKg: it.load_kg ?? null,
          descansoSeg: it.rest_time_seconds ?? null,
          metodo: it.execution_method || null,
          observacao: clip(it.notes, 120),
        };
      }),
    };
  });

  // --- semanas anteriores (resumo) -----------------------------------------
  const lastGroups = (weekHistory || []).slice(0, PREVIOUS_WEEKS);
  const historyIds = lastGroups.flatMap((g) => g.workouts.map((w) => w.id));
  const summaries = historyIds.length > 0
    ? await loadWorkoutSummaries(client, historyIds).catch((e) => { avisos.push(`resumos_semanas: ${e.message}`); return {}; })
    : {};
  const semanasAnteriores = lastGroups.map((g) => ({
    inicio: isoDay(g.startDate),
    fim: isoDay(g.endDate),
    fichas: g.workouts.map((w) => {
      const s = summaries[w.id] || {};
      return {
        nome: w.name,
        exercicios: s.exerciseCount ?? null,
        series: s.setCount ?? null,
        gruposPrincipais: s.muscleGroups || [],
        volumeKgPrescrito: s.volumeKg ?? null,
      };
    }),
  }));

  // --- séries executadas (volume, progressão, RIR) ---------------------------
  const sessionDate = {};
  sessions.forEach((s) => { sessionDate[s.id] = s.started_at; });
  const sessionIds = sessions.map((s) => s.id);
  const setRows = [];
  for (let i = 0; i < sessionIds.length; i += SESSION_ID_CHUNK) {
    const chunk = sessionIds.slice(i, i + SESSION_ID_CHUNK);
    const { rows, error } = await fetchAllPages((from, to) => client.from('workout_session_sets')
      .select('session_id, load_used_kg, reps_done, rir, substituted_exercise_id, workout_exercises (exercise_id, exercises (name, muscle_group))')
      .in('session_id', chunk).range(from, to));
    if (error) avisos.push(`workout_session_sets: ${error.message}`);
    setRows.push(...rows);
  }
  const resolvedSets = sessionIds.length > 0
    ? await resolveSetsMuscleGroups(client, setRows).catch((e) => { avisos.push(`grupos_musculares: ${e.message}`); return []; })
    : [];

  // Volume: executed sets per muscle group, last 7 days and weekly average over 28.
  const cut7 = now.getTime() - 7 * DAY_MS;
  const cut28 = now.getTime() - VOLUME_WINDOW_DAYS * DAY_MS;
  const exec7 = {};
  const exec28 = {};
  resolvedSets.forEach((s) => {
    if (!s.muscleGroup || s.muscleGroup === 'aerobico') return;
    const t = new Date(sessionDate[s.session_id]).getTime();
    if (t >= cut28) exec28[s.muscleGroup] = (exec28[s.muscleGroup] || 0) + 1;
    if (t >= cut7) exec7[s.muscleGroup] = (exec7[s.muscleGroup] || 0) + 1;
  });
  const hasTargets = Object.keys(targets || {}).length > 0;
  const groups = [...new Set([...Object.keys(plannedSetsByGroup), ...Object.keys(exec28), ...Object.keys(targets || {})])].sort();
  const porGrupo = groups.map((g) => {
    const media = (exec28[g] || 0) / (VOLUME_WINDOW_DAYS / 7);
    const target = targets?.[g] ?? null;
    return {
      grupo: g,
      seriesPlanejadasNaFicha: plannedSetsByGroup[g] || 0,
      seriesExecutadasUltimos7Dias: exec7[g] || 0,
      mediaSemanalExecutada4Semanas: round1(media),
      metaSemanal: target,
      status: target != null ? getVolumeStatus(media, target)?.label || null : null,
    };
  });

  // Progression: per exercise currently in the ficha, across every ficha version.
  const exercisesInFicha = [];
  const seenExercise = new Set();
  itemRows.forEach((it) => {
    if (!it.exercise_id || seenExercise.has(it.exercise_id)) return;
    seenExercise.add(it.exercise_id);
    exercisesInFicha.push(it);
  });
  const porExercicio = exercisesInFicha.slice(0, MAX_PROGRESSION_EXERCISES).map((it) => {
    const sets = setRows
      .filter((s) => !s.substituted_exercise_id && s.workout_exercises?.exercise_id === it.exercise_id && s.load_used_kg != null && sessionDate[s.session_id])
      .map((s) => ({
        sessionId: s.session_id,
        date: sessionDate[s.session_id],
        load: s.load_used_kg,
        reps: s.reps_done,
        repsNum: parseRepsNumber(s.reps_done),
      }));
    const history = topSetsBySession(sets).slice(0, 6);
    const base = { exercicio: it.exercises?.name || null, grupo: it.exercises?.muscle_group || null, repsPrescritas: it.reps || null, sessoesRegistradas: history.length };
    if (history.length === 0) return { ...base, tendencia: 'insuficiente', ultimaCargaKg: null, ultimasRepsFeitas: null, e1RMEstimadoKg: null, deltaPct: null, proximaCargaSugeridaKg: null, bateuMetaDeReps: null };
    const trend = trendFrom(history);
    const next = suggestNextLoad(history, it.reps);
    return {
      ...base,
      tendencia: trend.tendencia,
      deltaPct: trend.deltaPct,
      ultimaCargaKg: history[0].load,
      ultimasRepsFeitas: history[0].repsNum,
      e1RMEstimadoKg: trend.e1RM,
      proximaCargaSugeridaKg: next?.suggestedLoad ?? null,
      bateuMetaDeReps: next?.hitTarget ?? null,
    };
  });

  // --- frequência real -----------------------------------------------------
  const sessions28 = sessions.filter((s) => new Date(s.started_at).getTime() >= cut28);
  const sessions7 = sessions28.filter((s) => new Date(s.started_at).getTime() >= cut7);
  const lastSession = sessions[0] || null;
  const declaredDays = anamnese?.days_per_week ?? null;
  const perWeek = sessions28.length / (VOLUME_WINDOW_DAYS / 7);
  const rirValues = setRows
    .filter((s) => s.rir != null && sessionDate[s.session_id] && new Date(sessionDate[s.session_id]).getTime() >= cut28)
    .map((s) => s.rir);
  const frequenciaReal = sessions.length === 0 ? null : {
    diasPorSemanaDeclarado: declaredDays,
    fichasAtivas: fichas.length,
    sessoesUltimos7Dias: sessions7.length,
    sessoesUltimas4Semanas: sessions28.length,
    mediaSessoesPorSemana: round1(perWeek),
    aderenciaAoDeclarado: declaredDays ? round1(perWeek / declaredDays) : null,
    ultimaSessaoEm: isoDay(lastSession.started_at),
    diasDesdeUltimaSessao: Math.floor((now.getTime() - new Date(lastSession.started_at).getTime()) / DAY_MS),
    pseMedia4Semanas: round1(average(sessions28.map((s) => s.pse))),
    ultimasPse: sessions.slice(0, 5).map((s) => s.pse).filter((p) => p != null),
    rirMedio4Semanas: round1(average(rirValues)),
    sessoesNos90Dias: sessions.length,
  };

  // --- perfil, avaliação, periodização, restrições ----------------------------
  const perfil = {
    objetivo: labelOf(PROGRAM_GOALS, anamnese?.main_goal),
    nivel: labelOf(PROGRAM_LEVELS, anamnese?.experience_level),
    frequenciaSemanalDeclarada: declaredDays,
    duracaoSessaoMin: anamnese?.session_duration_min ?? null,
    localTreino: labelOf(TRAINING_LOCATIONS, anamnese?.training_location),
    nivelAtividade: labelOf(ACTIVITY_LEVELS, anamnese?.activity_level),
    sono: labelOf(SLEEP_QUALITY_OPTIONS, anamnese?.sleep_quality),
    grupoMuscularEmFoco: labelOf(MUSCLE_FOCUS_OPTIONS, anamnese?.focus_muscle_group),
    idade: anamnese?.age ?? ageFromBirthDate(user?.birth_date, now),
    sexo: anamnese?.sex || user?.gender || null,
    pesoKg: anamnese?.weight_kg ?? user?.weight_kg ?? null,
    alturaCm: anamnese?.height_cm ?? null,
    modalidade: user?.attendance_mode || null,
    tipoAluno: user?.student_type || null,
  };
  const hasPerfil = !!anamnese;

  const assessments = assessmentRows || [];
  const avaliacao = assessments.length === 0 ? null : {
    ultima: {
      data: assessments[0].assessment_date,
      pesoKg: assessments[0].weight_kg,
      gorduraPct: assessments[0].body_fat_pct,
      massaMuscularEsqueleticaKg: assessments[0].skeletal_muscle_kg,
      massaGordaKg: assessments[0].fat_mass_kg,
      gorduraVisceral: assessments[0].visceral_fat,
      imc: assessments[0].bmi,
      perimetros: assessments[0].perimeters || null,
      observacoes: clip(assessments[0].notes, 300),
    },
    evolucao: assessments.map((a) => ({ data: a.assessment_date, pesoKg: a.weight_kg, gorduraPct: a.body_fat_pct, massaMuscularKg: a.skeletal_muscle_kg })),
  };

  const phase = periodization?.plan ? getCurrentPhase(periodization.plan, periodization.phases) : null;
  const periodizacao = !periodization?.plan ? null : (phase ? {
    fase: phase.phase.name,
    semanaNaFase: phase.weekInPhase,
    duracaoFaseSemanas: phase.phase.duration_weeks,
    semanaDoPlano: phase.globalWeek,
    totalSemanasPlano: periodization.plan.total_weeks,
    fases: periodization.phases.map((p) => ({ nome: p.name, semanas: p.duration_weeks })),
  } : { planoForaDoPeriodo: true, totalSemanasPlano: periodization.plan.total_weeks, fases: periodization.phases.map((p) => ({ nome: p.name, semanas: p.duration_weeks })) });

  const pain = (anamnese?.pain_zones || []).map((z) => labelOf(PAIN_ZONES, z));
  const sessionNotes = (noteRows || []).map((n) => ({ data: isoDay(n.created_at), nota: clip(n.notes, 300) })).filter((n) => n.nota);
  const restricoes = {
    problemasDeSaude: clip(anamnese?.health_issues, 600),
    zonasDeDor: pain,
    observacoesDoPersonal: clip(user?.personal_notes, 500),
    notasDeSessaoRecentes: sessionNotes,
  };

  const lacunas = [];
  if (!anamnese) lacunas.push('anamnese');
  if (!avaliacao) lacunas.push('avaliacao_fisica');
  if (!periodizacao) lacunas.push('periodizacao');
  if (!hasTargets) lacunas.push('metas_de_volume');
  if (fichas.length === 0) lacunas.push('ficha_ativa');
  else if (fichas.some((f) => f.diaSemana == null)) lacunas.push('dias_da_semana_nao_definidos');
  if (sessions.length === 0) lacunas.push('historico_de_execucao');
  if (!restricoes.problemasDeSaude && pain.length === 0) lacunas.push('restricoes_nao_informadas');

  const ctx = {
    meta: {
      versao: STUDENT_CONTEXT_VERSION,
      geradoEm: now.toISOString(),
      janelas: { progressaoDias: SESSION_WINDOW_DAYS, volumeEFrequenciaDias: VOLUME_WINDOW_DAYS },
      avisos,
      truncado: false,
    },
    perfil: hasPerfil ? perfil : { ...perfil, anamneseNaoPreenchida: true },
    avaliacao,
    periodizacao,
    treinoAtual: { fichas, totalSeriesSemanaPlanejada: totalSeriesSemana },
    semanasAnteriores,
    volume: { porGrupo, metasDefinidas: hasTargets },
    progressao: { porExercicio },
    frequenciaReal,
    restricoes,
    lacunas,
  };
  return fitContext(ctx);
}

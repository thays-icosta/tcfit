export function getPhaseForWeekIndex(phases, weekIndex) {
  let cumulative = 0;
  for (const phase of phases) {
    const start = cumulative + 1;
    const end = cumulative + phase.duration_weeks;
    if (weekIndex >= start && weekIndex <= end) {
      return { phase, weekInPhase: weekIndex - start + 1, startWeek: start, endWeek: end };
    }
    cumulative = end;
  }
  return null;
}

export function getPhaseForDate(plan, phases, date) {
  if (!plan || !phases || phases.length === 0) return null;
  const start = new Date(plan.start_date);
  start.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const weekIndex = Math.floor((d - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
  if (weekIndex < 1) return null;
  const result = getPhaseForWeekIndex(phases, weekIndex);
  if (!result) return null;
  return { ...result, globalWeek: weekIndex };
}

export function getCurrentPhase(plan, phases) {
  if (!plan) return null;
  return getPhaseForDate(plan, phases, new Date());
}

export async function loadPeriodizationPlan(supabase, studentId) {
  const { data: planRows } = await supabase
    .from('periodization_plans')
    .select('id, total_weeks, start_date')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!planRows || planRows.length === 0) return { plan: null, phases: [] };

  const plan = planRows[0];
  const { data: phaseRows } = await supabase
    .from('periodization_phases')
    .select('id, name, duration_weeks, order_index')
    .eq('plan_id', plan.id)
    .order('order_index', { ascending: true });

  return { plan, phases: phaseRows || [] };
}
// Turns a raw day-by-day weight series into something readable — a single
// day's reading is noisy (hydration, food, timing), a 7-day average and its
// week-over-week change is what actually says whether the aluno is trending
// up, down, or holding steady.

export function computeWeightTrend(rows) {
  // rows: [{ date: 'YYYY-MM-DD', weight: number }], ascending by date.
  if (!rows || rows.length === 0) return null;

  const last = rows[rows.length - 1];
  const lastDate = new Date(last.date);

  const avgOverWindow = (endDate, days) => {
    const start = new Date(endDate);
    start.setDate(start.getDate() - (days - 1));
    const inRange = rows.filter((r) => {
      const d = new Date(r.date);
      return d >= start && d <= endDate;
    });
    if (inRange.length === 0) return null;
    return inRange.reduce((sum, r) => sum + r.weight, 0) / inRange.length;
  };

  const avg7 = avgOverWindow(lastDate, 7);
  const prevWeekEnd = new Date(lastDate);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
  const avg7Prev = avgOverWindow(prevWeekEnd, 7);

  const weeklyChange = (avg7 != null && avg7Prev != null) ? avg7 - avg7Prev : null;

  let trend = null;
  if (weeklyChange != null) {
    if (Math.abs(weeklyChange) < 0.2) trend = 'estavel';
    else trend = weeklyChange > 0 ? 'subindo' : 'descendo';
  }

  return {
    current: last.weight,
    avg7: avg7 != null ? Math.round(avg7 * 10) / 10 : null,
    weeklyChange: weeklyChange != null ? Math.round(weeklyChange * 10) / 10 : null,
    trend,
  };
}

import { RANKS, RANK_THRESHOLDS } from './exercises.js';

export function e1rm(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  const r = Math.min(reps, 12);
  return r === 1 ? weight : weight * (1 + r / 30); // Epley
}

export const loadOf = (set, ex, bw) => (ex?.bw ? (bw || 0) + (set.weight || 0) : set.weight || 0);

// Sets válidos de un entrenamiento terminado
export const doneSets = (w) => (w.sets || []).filter((s) => s.done !== false && s.reps > 0);

/** Agrupa sets de un entrenamiento por ejercicio, en orden */
export function groupByExercise(w) {
  const map = new Map();
  for (const s of [...(w.sets || [])].sort((a, b) => a.ex_order - b.ex_order || a.set_order - b.set_order)) {
    if (!map.has(s.exercise_id)) map.set(s.exercise_id, []);
    map.get(s.exercise_id).push(s);
  }
  return [...map.entries()].map(([exercise_id, sets]) => ({ exercise_id, sets }));
}

export const volumeOf = (sets) => sets.reduce((a, s) => a + (s.done !== false ? (s.weight || 0) * (s.reps || 0) : 0), 0);

/** Sesiones por ejercicio: [{ date, workoutId, sets, best, maxWeight, volume }] ordenadas por fecha asc */
export function exerciseSessions(workouts, exId, exMap, defaultBw) {
  const ex = exMap.get(exId);
  const out = [];
  for (const w of workouts) {
    if (w.deleted || !w.ended_at) continue;
    const sets = doneSets(w).filter((s) => s.exercise_id === exId);
    if (!sets.length) continue;
    const bw = w.bodyweight || defaultBw;
    let best = 0, maxWeight = 0;
    for (const s of sets) {
      best = Math.max(best, e1rm(loadOf(s, ex, bw), s.reps));
      maxWeight = Math.max(maxWeight, ex?.bw ? loadOf(s, ex, bw) : s.weight);
    }
    out.push({ date: w.started_at, workoutId: w.id, sets, best, maxWeight, volume: volumeOf(sets) });
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Última sesión anterior de un ejercicio (antes de beforeTs, excluyendo un entrenamiento) */
export function previousSession(workouts, exId, beforeTs, excludeId) {
  let bestW = null;
  for (const w of workouts) {
    if (w.deleted || !w.ended_at || w.id === excludeId || w.started_at >= beforeTs) continue;
    if (!w.sets?.some((s) => s.exercise_id === exId && s.done !== false && s.reps > 0)) continue;
    if (!bestW || w.started_at > bestW.started_at) bestW = w;
  }
  if (!bestW) return null;
  return {
    date: bestW.started_at,
    sets: doneSets(bestW).filter((s) => s.exercise_id === exId).sort((a, b) => a.set_order - b.set_order),
  };
}

/** Mejor 1RM estimado histórico de un ejercicio */
export function bestE1rm(workouts, exId, exMap, defaultBw, excludeId) {
  const ex = exMap.get(exId);
  let best = 0;
  for (const w of workouts) {
    if (w.deleted || !w.ended_at || w.id === excludeId) continue;
    const bw = w.bodyweight || defaultBw;
    for (const s of w.sets || []) {
      if (s.exercise_id !== exId || s.done === false) continue;
      best = Math.max(best, e1rm(loadOf(s, ex, bw), s.reps));
    }
  }
  return best;
}

/** Récords personales de cada ejercicio: mejor 1RM estimado con su fecha */
export function personalRecords(workouts, exMap, defaultBw) {
  const recs = new Map();
  for (const w of workouts) {
    if (w.deleted || !w.ended_at) continue;
    const bw = w.bodyweight || defaultBw;
    for (const s of doneSets(w)) {
      const ex = exMap.get(s.exercise_id);
      const v = e1rm(loadOf(s, ex, bw), s.reps);
      const cur = recs.get(s.exercise_id);
      if (!cur || v > cur.e1rm) recs.set(s.exercise_id, { exercise_id: s.exercise_id, e1rm: v, weight: s.weight, reps: s.reps, date: w.started_at });
    }
  }
  return [...recs.values()].filter((r) => r.e1rm > 0).sort((a, b) => b.date - a.date);
}

/** Cuenta PRs logrados en un entrenamiento concreto (comparado con todo lo anterior) */
export function prsInWorkout(workouts, w, exMap, defaultBw) {
  let count = 0;
  for (const g of groupByExercise({ sets: doneSets(w) })) {
    const ex = exMap.get(g.exercise_id);
    const bw = w.bodyweight || defaultBw;
    let prev = 0;
    for (const o of workouts) {
      if (o.deleted || !o.ended_at || o.id === w.id || o.started_at >= w.started_at) continue;
      const obw = o.bodyweight || defaultBw;
      for (const s of o.sets || []) if (s.exercise_id === g.exercise_id && s.done !== false) prev = Math.max(prev, e1rm(loadOf(s, ex, obw), s.reps));
    }
    const best = Math.max(...g.sets.map((s) => e1rm(loadOf(s, ex, bw), s.reps)));
    if (prev > 0 && best > prev + 0.01) count++;
  }
  return count;
}

/** Rangos por grupo muscular: 1RM equivalente al levantamiento de referencia / peso corporal */
export function muscleRanks(workouts, exMap, bodyweight) {
  const groups = Object.keys(RANK_THRESHOLDS);
  const best = Object.fromEntries(groups.map((g) => [g, { ref: 0, exercise_id: null, e1rm: 0 }]));
  for (const w of workouts) {
    if (w.deleted || !w.ended_at) continue;
    const bw = w.bodyweight || bodyweight;
    for (const s of doneSets(w)) {
      const ex = exMap.get(s.exercise_id);
      if (!ex || !ex.factor || !best[ex.muscle]) continue;
      const v = e1rm(loadOf(s, ex, bw), s.reps);
      const ref = v * ex.factor;
      if (ref > best[ex.muscle].ref) best[ex.muscle] = { ref, exercise_id: s.exercise_id, e1rm: v };
    }
  }
  return groups.map((g) => {
    const th = RANK_THRESHOLDS[g];
    const ratio = bodyweight ? best[g].ref / bodyweight : 0;
    let idx = -1;
    if (best[g].ref > 0) { idx = 0; for (let i = 0; i < th.length; i++) if (ratio >= th[i]) idx = i; }
    const next = idx >= 0 && idx < th.length - 1 ? th[idx + 1] : null;
    const prevT = idx >= 0 ? th[idx] : 0;
    const progress = idx < 0 ? 0 : next ? Math.min(1, (ratio - prevT) / (next - prevT)) : 1;
    return {
      muscle: g, rankIndex: idx, rank: idx >= 0 ? RANKS[idx] : 'Sin rango',
      ratio, next, nextRank: next ? RANKS[idx + 1] : null, progress,
      refKg: best[g].ref, exercise_id: best[g].exercise_id, e1rm: best[g].e1rm,
      neededKg: next && bodyweight ? Math.max(0, next * bodyweight - best[g].ref) : 0,
    };
  });
}

// ---- Semanas y racha (lunes como inicio de semana, hora local) ----
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function weekStreak(timestamps, now = Date.now()) {
  if (!timestamps.length) return 0;
  const weeks = new Set(timestamps.map(weekStart));
  let w = weekStart(now);
  let n = weeks.has(w) ? 1 : 0;
  const prev = (t) => { const d = new Date(t); d.setDate(d.getDate() - 7); return weekStart(d.getTime()); };
  w = prev(w);
  while (weeks.has(w)) { n++; w = prev(w); }
  return n;
}

export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

// ---- Formato ----
const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
export const kg = (n) => `${nf1.format(Math.round((n || 0) * 10) / 10)} kg`;
export const num = (n, d = 1) => (d ? nf1 : nf0).format(n || 0);
export const fmtDate = (ts, opts = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('es-MX', opts).format(ts);
export const fmtDateLong = (ts) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(ts);
export function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function relDays(ts, now = Date.now()) {
  if (!ts) return 'nunca';
  const d = Math.floor((weekDayStart(now) - weekDayStart(ts)) / 864e5);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}
function weekDayStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

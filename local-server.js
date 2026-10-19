// Modo demo: backend completo dentro del navegador (mismas rutas que el Worker).
// Se activa solo cuando no hay API configurada (o con ?api=local). Los datos viven en IndexedDB del dispositivo.
import { ApiError } from './api.js';
import { EXERCISES } from './exercises.js';
import { e1rm, weekStreak } from './calc.js';

const DB_NAME = 'forja-local-server';
const enc = new TextEncoder();
const err = (s, m) => new ApiError(s, m);
const uid = () => crypto.randomUUID();
const now = () => Date.now();
const LIB = new Map(EXERCISES.map((e) => [e.id, e]));
const GOALS = ['fuerza', 'hipertrofia', 'perder_grasa', 'salud'];
const MUSCLES = ['pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'core'];
export const DEMO_PASSWORD = 'Forja2026demo';

// ---------------- Persistencia ----------------
let mem = null;
let idb = null;
const blank = () => ({ users: {}, sessions: {}, workouts: {}, exercises: {}, routines: {}, assignments: [], links: [], comments: [], seq: 0, fails: {} });

function openIdb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function load() {
  if (mem) return mem;
  try {
    idb = await openIdb();
    mem = await new Promise((res) => {
      const g = idb.transaction('kv').objectStore('kv').get('db');
      g.onsuccess = () => res(g.result || null);
      g.onerror = () => res(null);
    });
  } catch { idb = null; }
  if (!mem) { mem = blank(); await save(); } // arranca vacío, como la primera vez
  return mem;
}
async function save() {
  if (!idb) return;
  await new Promise((res) => {
    const t = idb.transaction('kv', 'readwrite');
    t.objectStore('kv').put(mem, 'db');
    t.oncomplete = res; t.onerror = res;
  });
}

// ---------------- Contraseñas ----------------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hash(pass, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}

// ---------------- Helpers ----------------
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, goal: u.goal, days_per_week: u.days_per_week, bodyweight: u.bodyweight, onboarded: !!u.onboarded, created_at: u.created_at });
function auth(token, role) {
  const s = mem.sessions[token];
  if (!s || s.revoked || s.expires_at < now()) throw err(401, 'Tu sesión expiró. Inicia sesión de nuevo.');
  const user = mem.users[s.user_id];
  if (!user) throw err(401, 'Tu sesión expiró. Inicia sesión de nuevo.');
  if (role && user.role !== role) throw err(403, `Esta función es solo para ${role}s`);
  return { user, sid: token };
}
function newSession(user) {
  const token = `local.${uid()}`;
  mem.sessions[token] = { user_id: user.id, expires_at: now() + 30 * 864e5, revoked: false };
  return { token, expires_at: now() + 30 * 864e5, user: pub(user) };
}
const linked = (coachId, athleteId) => mem.links.some((l) => l.coach_id === coachId && l.athlete_id === athleteId && l.status === 'accepted');
function assertLinked(c, a) { if (!linked(c, a)) throw err(404, 'Atleta no encontrado'); }
const str = (v, name, min, max) => {
  if (typeof v !== 'string') throw err(400, `Falta ${name}`);
  const s = v.trim();
  if (s.length < min) throw err(400, `${name} es demasiado corto`);
  if (s.length > max) throw err(400, `${name} es demasiado largo`);
  return s;
};
const shape = (w) => ({ ...w, sets: [...(w.sets || [])].sort((a, b) => a.ex_order - b.ex_order || a.set_order - b.set_order) });
const exInfo = () => { const m = Object.fromEntries(EXERCISES.map((e) => [e.id, e])); Object.values(mem.exercises).forEach((e) => (m[e.id] = e)); return m; };
function code8() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  while (c.length < 8) for (const b of crypto.getRandomValues(new Uint8Array(12))) if (b < 248 && c.length < 8) c += A[b % 31];
  return c;
}

// ---------------- Rutas ----------------
const R = {
  'GET /health': () => ({ ok: true, version: 'local', time: now() }),

  async 'POST /auth/register'({ body }) {
    const email = str(body.email, 'email', 6, 254).toLowerCase();
    if (!/^\S+@\S+\.\S{2,}$/.test(email)) throw err(400, 'Email inválido');
    const pass = body.password;
    if (typeof pass !== 'string' || pass.length < 8 || !/\d/.test(pass) || !/[a-zA-ZÀ-ÿ]/.test(pass)) throw err(400, 'La contraseña debe tener 8+ caracteres con letras y números');
    const name = str(body.name, 'nombre', 1, 60);
    const role = ['atleta', 'entrenador'].includes(body.role) ? body.role : 'atleta';
    if (Object.values(mem.users).some((u) => u.email === email)) throw err(409, 'Ese email ya está registrado');
    const h = await hash(pass);
    const u = { id: uid(), email, name, role, pass_hash: h.hash, pass_salt: h.salt, goal: null, days_per_week: null, bodyweight: null, onboarded: role === 'entrenador', created_at: now() };
    mem.users[u.id] = u;
    return newSession(u);
  },

  async 'POST /auth/login'({ body }) {
    const email = String(body.email || '').trim().toLowerCase();
    const f = mem.fails[email];
    if (f && f.n >= 5 && f.until > now()) throw err(429, 'Cuenta bloqueada temporalmente por intentos fallidos. Espera 15 minutos.');
    const u = Object.values(mem.users).find((x) => x.email === email);
    const ok = u && (await hash(String(body.password || ''), u.pass_salt)).hash === u.pass_hash;
    if (!ok) {
      const cur = f && f.until > now() ? f : { n: 0, until: now() + 15 * 60e3 };
      cur.n++; mem.fails[email] = cur;
      throw err(401, 'Email o contraseña incorrectos');
    }
    delete mem.fails[email];
    return newSession(u);
  },

  'POST /auth/logout'({ token }) { auth(token); mem.sessions[token].revoked = true; return { ok: true }; },
  'GET /auth/me'({ token }) { return { user: pub(auth(token).user), serverTime: now() }; },

  async 'POST /auth/password'({ token, body }) {
    const { user } = auth(token);
    if ((await hash(String(body.current || ''), user.pass_salt)).hash !== user.pass_hash) throw err(400, 'La contraseña actual no es correcta');
    const n = body.new;
    if (typeof n !== 'string' || n.length < 8 || !/\d/.test(n)) throw err(400, 'La contraseña debe tener 8+ caracteres con letras y números');
    const h = await hash(n);
    user.pass_hash = h.hash; user.pass_salt = h.salt;
    for (const [k, s] of Object.entries(mem.sessions)) if (s.user_id === user.id && k !== token) s.revoked = true;
    return { ok: true };
  },

  'PUT /auth/profile'({ token, body }) {
    const { user } = auth(token);
    if (body.name !== undefined) user.name = str(body.name, 'nombre', 1, 60);
    if (body.goal !== undefined) { if (!GOALS.includes(body.goal)) throw err(400, 'Objetivo inválido'); user.goal = body.goal; }
    if (body.days_per_week !== undefined) { const d = Number(body.days_per_week); if (!(d >= 1 && d <= 7)) throw err(400, 'Días inválidos'); user.days_per_week = d; }
    if (body.bodyweight !== undefined) { const b = Number(body.bodyweight); if (!(b >= 25 && b <= 350)) throw err(400, 'Peso corporal fuera de rango'); user.bodyweight = Math.round(b * 10) / 10; }
    if (body.onboarded !== undefined) user.onboarded = !!body.onboarded;
    return { user: pub(user) };
  },

  async 'POST /auth/delete'({ token, body }) {
    const { user } = auth(token);
    if ((await hash(String(body.password || ''), user.pass_salt)).hash !== user.pass_hash) throw err(400, 'Contraseña incorrecta');
    deleteUser(user.id);
    return { ok: true };
  },

  'GET /workouts'({ token, query }) {
    const { user } = auth(token);
    const cur = Number(String(query.get('cursor') || '0').split(':')[0]) || 0;
    const csince = Number(query.get('csince')) || 0;
    const ws = Object.values(mem.workouts).filter((w) => w.user_id === user.id && w.synced_at > cur).sort((a, b) => a.synced_at - b.synced_at);
    const comments = mem.comments.filter((c) => c.athlete_id === user.id && c.created_at > csince)
      .map((c) => ({ id: c.id, workout_id: c.workout_id, body: c.body, created_at: c.created_at, coach_name: mem.users[c.coach_id]?.name || 'Entrenador' }));
    return {
      workouts: ws.map(({ user_id, synced_at, ...w }) => shape(w)),
      cursor: String(ws.length ? ws[ws.length - 1].synced_at : cur), more: false,
      exercises: Object.values(mem.exercises).filter((e) => e.owner_id === user.id).map(({ owner_id, ...e }) => ({ ...e, custom: true })),
      comments, serverTime: now(),
    };
  },

  'POST /workouts/sync'({ token, body }) {
    const { user } = auth(token);
    const exercises = (body.exercises || []).slice(0, 200).map((e) => {
      const cur = mem.exercises[e.id];
      if (LIB.has(e.id) || (cur && cur.owner_id !== user.id)) return { id: e.id, status: 'forbidden' };
      if (!MUSCLES.includes(e.muscle) || typeof e.name !== 'string' || e.name.trim().length < 2) return { id: e.id, status: 'invalid' };
      if (cur && cur.updated_at > e.updated_at) return { id: e.id, status: 'stale' };
      mem.exercises[e.id] = { id: e.id, owner_id: user.id, name: e.name.trim().slice(0, 60), muscle: e.muscle, factor: 0, bw: !!e.bw, deleted: !!e.deleted, updated_at: e.updated_at };
      return { id: e.id, status: 'ok', updated_at: e.updated_at };
    });
    const workouts = (body.workouts || []).slice(0, 50).map((w) => {
      const cur = mem.workouts[w.id];
      if (cur && cur.user_id !== user.id) return { id: w.id, status: 'forbidden' };
      if (!(w.started_at > 0) || !Array.isArray(w.sets || [])) return { id: w.id, status: 'invalid' };
      if ((w.sets || []).some((s) => !(s.weight >= 0 && s.weight <= 1500 && s.reps >= 0 && s.reps <= 1000))) return { id: w.id, status: 'invalid', error: 'Valores fuera de rango' };
      if (cur && cur.updated_at > w.updated_at) { cur.synced_at = ++mem.seq; return { id: w.id, status: 'stale' }; }
      mem.workouts[w.id] = {
        id: w.id, user_id: user.id, started_at: w.started_at, ended_at: w.ended_at, title: String(w.title || '').slice(0, 80),
        notes: String(w.notes || '').slice(0, 2000), routine_id: w.routine_id || null, bodyweight: w.bodyweight || null,
        deleted: !!w.deleted, updated_at: w.updated_at, synced_at: ++mem.seq,
        sets: w.deleted ? [] : (w.sets || []).map((s) => ({ id: s.id, exercise_id: s.exercise_id, ex_order: s.ex_order, set_order: s.set_order, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, done: s.done !== false })),
      };
      return { id: w.id, status: 'ok', updated_at: w.updated_at };
    });
    return { workouts, exercises, serverTime: now() };
  },

  'GET /exercises'({ token }) {
    const { user } = auth(token);
    return { exercises: [...EXERCISES, ...Object.values(mem.exercises).filter((e) => e.owner_id === user.id).map((e) => ({ ...e, custom: true }))] };
  },

  // ----- Entrenador -----
  'POST /coach/invites'({ token }) {
    const { user } = auth(token, 'entrenador');
    const l = { id: uid(), coach_id: user.id, athlete_id: null, code: code8(), status: 'pending', created_at: now(), expires_at: now() + 7 * 864e5 };
    mem.links.push(l);
    return { code: l.code, expires_at: l.expires_at };
  },
  'GET /coach/invites'({ token }) {
    const { user } = auth(token, 'entrenador');
    return { invites: mem.links.filter((l) => l.coach_id === user.id && l.status === 'pending' && l.expires_at > now()).map(({ code, created_at, expires_at }) => ({ code, created_at, expires_at })) };
  },
  'DELETE /coach/invites/:code'({ token, params }) {
    const { user } = auth(token, 'entrenador');
    mem.links = mem.links.filter((l) => !(l.coach_id === user.id && l.code === params.code && l.status === 'pending'));
    return { ok: true };
  },
  'GET /coach/athletes'({ token }) {
    const { user } = auth(token, 'entrenador');
    const info = exInfo();
    const t = now();
    const athletes = mem.links.filter((l) => l.coach_id === user.id && l.status === 'accepted').map((l) => {
      const a = mem.users[l.athlete_id];
      if (!a) return null;
      const ws = Object.values(mem.workouts).filter((w) => w.user_id === a.id && !w.deleted).sort((x, y) => x.started_at - y.started_at);
      const ts = ws.map((w) => w.started_at);
      const last = ts[ts.length - 1] || null;
      const best = new Map(); const prs = new Map();
      for (const w of ws) for (const s of w.sets) {
        const ex = info[s.exercise_id] || {};
        const v = e1rm(ex.bw ? (a.bodyweight || 0) + s.weight : s.weight, s.reps);
        const prev = best.get(s.exercise_id) || 0;
        if (v > prev) { if (prev > 0 && w.started_at > t - 14 * 864e5) prs.set(s.exercise_id, { exercise_id: s.exercise_id, name: ex.name || 'Ejercicio', e1rm: Math.round(v * 10) / 10, weight: s.weight, reps: s.reps, at: w.started_at }); best.set(s.exercise_id, v); }
      }
      return {
        id: a.id, name: a.name, email: a.email, bodyweight: a.bodyweight, goal: a.goal, days_per_week: a.days_per_week, linked_at: l.accepted_at,
        last_workout: last, workouts_7d: ts.filter((x) => x > t - 7 * 864e5).length, streak: weekStreak(ts, t),
        inactive: !last || t - last > 7 * 864e5, recent_prs: [...prs.values()].sort((x, y) => y.at - x.at).slice(0, 5),
      };
    }).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name, 'es'));
    return { athletes };
  },
  'GET /coach/athletes/:id'({ token, params }) {
    const { user } = auth(token, 'entrenador');
    assertLinked(user.id, params.id);
    const a = mem.users[params.id];
    return {
      athlete: { id: a.id, name: a.name, email: a.email, bodyweight: a.bodyweight, goal: a.goal, days_per_week: a.days_per_week },
      workouts: Object.values(mem.workouts).filter((w) => w.user_id === a.id && !w.deleted).sort((x, y) => y.started_at - x.started_at).map(({ user_id, synced_at, ...w }) => shape(w)),
      exercises: Object.values(mem.exercises).filter((e) => e.owner_id === a.id && !e.deleted).map((e) => ({ ...e, custom: true })),
      comments: mem.comments.filter((c) => c.athlete_id === a.id && c.coach_id === user.id).map(({ id, workout_id, body, created_at }) => ({ id, workout_id, body, created_at })),
    };
  },
  'DELETE /coach/athletes/:id'({ token, params }) {
    const { user } = auth(token, 'entrenador');
    assertLinked(user.id, params.id);
    mem.links.forEach((l) => { if (l.coach_id === user.id && l.athlete_id === params.id && l.status === 'accepted') l.status = 'revoked'; });
    mem.assignments = mem.assignments.filter((x) => !(x.coach_id === user.id && x.athlete_id === params.id));
    return { ok: true };
  },
  'POST /coach/comments'({ token, body }) {
    const { user } = auth(token, 'entrenador');
    const w = mem.workouts[body.workout_id];
    if (!w || w.deleted) throw err(404, 'Entrenamiento no encontrado');
    assertLinked(user.id, w.user_id);
    const c = { id: uid(), workout_id: w.id, coach_id: user.id, athlete_id: w.user_id, body: str(body.body, 'comentario', 1, 1000), created_at: now() };
    mem.comments.push(c);
    return { id: c.id, workout_id: c.workout_id, body: c.body, created_at: c.created_at, coach_name: user.name };
  },
  'DELETE /coach/comments/:id'({ token, params }) {
    const { user } = auth(token, 'entrenador');
    mem.comments = mem.comments.filter((c) => !(c.id === params.id && c.coach_id === user.id));
    return { ok: true };
  },
  'GET /coach/link'({ token }) {
    const { user } = auth(token, 'atleta');
    const l = mem.links.find((x) => x.athlete_id === user.id && x.status === 'accepted');
    const c = l && mem.users[l.coach_id];
    return { coach: c ? { id: c.id, name: c.name, email: c.email, accepted_at: l.accepted_at } : null };
  },
  'POST /coach/link'({ token, body }) {
    const { user } = auth(token, 'atleta');
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (mem.links.some((x) => x.athlete_id === user.id && x.status === 'accepted')) throw err(409, 'Ya tienes entrenador. Desvincúlate primero.');
    const l = mem.links.find((x) => x.code === code && x.status === 'pending' && x.expires_at > now());
    if (!l) throw err(404, 'Código inválido o expirado');
    Object.assign(l, { athlete_id: user.id, status: 'accepted', accepted_at: now() });
    return { coach: { id: l.coach_id, name: mem.users[l.coach_id]?.name } };
  },
  'DELETE /coach/link'({ token }) {
    const { user } = auth(token, 'atleta');
    mem.links.forEach((l) => { if (l.athlete_id === user.id && l.status === 'accepted') l.status = 'revoked'; });
    mem.assignments = mem.assignments.filter((x) => x.athlete_id !== user.id);
    return { ok: true };
  },

  // ----- Rutinas -----
  'GET /routines'({ token }) {
    const { user } = auth(token, 'entrenador');
    return { routines: Object.values(mem.routines).filter((r) => r.coach_id === user.id && !r.deleted).sort((a, b) => b.updated_at - a.updated_at)
      .map((r) => ({ id: r.id, name: r.name, notes: r.notes, items: r.items, updated_at: r.updated_at, athlete_ids: mem.assignments.filter((x) => x.routine_id === r.id).map((x) => x.athlete_id) })) };
  },
  'POST /routines'({ token, body }) {
    const { user } = auth(token, 'entrenador');
    const r = { id: uid(), coach_id: user.id, ...validRoutine(body), deleted: false, updated_at: now() };
    mem.routines[r.id] = r;
    return { id: r.id, name: r.name, notes: r.notes, items: r.items, updated_at: r.updated_at, athlete_ids: [] };
  },
  'GET /routines/assigned'({ token }) {
    const { user } = auth(token, 'atleta');
    return { routines: mem.assignments.filter((x) => x.athlete_id === user.id && linked(x.coach_id, user.id))
      .map((x) => { const r = mem.routines[x.routine_id]; return r && !r.deleted ? { id: r.id, name: r.name, notes: r.notes, items: r.items, updated_at: r.updated_at, coach_name: mem.users[r.coach_id]?.name, assigned_at: x.created_at } : null; })
      .filter(Boolean) };
  },
  'PUT /routines/:id'({ token, params, body }) {
    const { user } = auth(token, 'entrenador');
    const r = mem.routines[params.id];
    if (!r || r.coach_id !== user.id || r.deleted) throw err(404, 'Rutina no encontrada');
    Object.assign(r, validRoutine(body), { updated_at: now() });
    return { id: r.id, name: r.name, notes: r.notes, items: r.items, updated_at: r.updated_at };
  },
  'DELETE /routines/:id'({ token, params }) {
    const { user } = auth(token, 'entrenador');
    const r = mem.routines[params.id];
    if (!r || r.coach_id !== user.id) throw err(404, 'Rutina no encontrada');
    r.deleted = true;
    mem.assignments = mem.assignments.filter((x) => x.routine_id !== r.id);
    return { ok: true };
  },
  'POST /routines/:id/assign'({ token, params, body }) {
    const { user } = auth(token, 'entrenador');
    const r = mem.routines[params.id];
    if (!r || r.coach_id !== user.id || r.deleted) throw err(404, 'Rutina no encontrada');
    const ids = [...new Set(body.athlete_ids || [])];
    ids.forEach((a) => assertLinked(user.id, a));
    mem.assignments = mem.assignments.filter((x) => x.routine_id !== r.id).concat(ids.map((a) => ({ id: uid(), routine_id: r.id, athlete_id: a, coach_id: user.id, created_at: now() })));
    return { ok: true, athlete_ids: ids };
  },

  async 'POST /debug/seed'() { await seed(); return seedInfo; },
  async 'POST /debug/reset'() { mem = blank(); return { ok: true }; },
  async 'POST /debug/reset-empty'() { mem = blank(); return { ok: true }; },
};

function validRoutine(body) {
  const name = str(body.name, 'nombre de la rutina', 2, 60);
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!items.length) throw err(400, 'Agrega al menos un ejercicio');
  if (items.some((i) => !LIB.has(i.exercise_id))) throw err(400, 'Las rutinas solo pueden usar ejercicios de la biblioteca');
  return {
    name, notes: String(body.notes || '').slice(0, 1000),
    items: items.map((i) => ({ exercise_id: i.exercise_id, sets: Math.min(20, Math.max(1, Number(i.sets) || 3)), reps: Math.min(100, Math.max(1, Number(i.reps) || 10)), weight: Math.min(1500, Math.max(0, Number(i.weight) || 0)) })),
  };
}

function deleteUser(id) {
  delete mem.users[id];
  for (const [k, s] of Object.entries(mem.sessions)) if (s.user_id === id) delete mem.sessions[k];
  for (const [k, w] of Object.entries(mem.workouts)) if (w.user_id === id) delete mem.workouts[k];
  for (const [k, e] of Object.entries(mem.exercises)) if (e.owner_id === id) delete mem.exercises[k];
  for (const [k, r] of Object.entries(mem.routines)) if (r.coach_id === id) delete mem.routines[k];
  mem.links = mem.links.filter((l) => l.coach_id !== id && l.athlete_id !== id);
  mem.assignments = mem.assignments.filter((x) => x.coach_id !== id && x.athlete_id !== id);
  mem.comments = mem.comments.filter((c) => c.coach_id !== id && c.athlete_id !== id);
}

// ---------------- Datos de prueba (igual que el Worker) ----------------
const DEMO = {
  coach: { email: 'entrenador@forja.test', name: 'Coach Marco' },
  ana: { email: 'ana@forja.test', name: 'Ana López', goal: 'hipertrofia', days: 4, bw: 62 },
  luis: { email: 'luis@forja.test', name: 'Luis Ramírez', goal: 'fuerza', days: 3, bw: 82 },
};
export const seedInfo = {
  ok: true, password: DEMO_PASSWORD,
  accounts: [{ role: 'entrenador', email: DEMO.coach.email }, { role: 'atleta', email: DEMO.ana.email }, { role: 'atleta', email: DEMO.luis.email }],
  workouts: 0, sets: 0,
};

function rng(seedN) { let s = seedN >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const round25 = (x) => Math.round(x / 2.5) * 2.5;
function buildProgram(plan, start, rand, skipLastDays) {
  const out = [];
  for (let w = 0; w < 8; w++) {
    plan.days.forEach((dayOffset, i) => {
      const t = start + (w * 7 + dayOffset) * 864e5 + (18 * 60 + Math.floor(rand() * 90)) * 60e3;
      if (t > now() - skipLastDays * 864e5 || rand() < 0.07) return;
      const session = plan.sessions[i % plan.sessions.length];
      const sets = [];
      session.ex.forEach(([exId, base, reps, nsets], exOrder) => {
        const progress = 1 + w * plan.rate + (rand() - 0.5) * 0.03;
        for (let s = 0; s < nsets; s++) {
          const fatigue = s >= nsets - 1 && rand() < 0.4 ? 1 : 0;
          sets.push({ id: uid(), exercise_id: exId, ex_order: exOrder, set_order: s, weight: base ? round25(base * progress) : 0, reps: Math.max(1, reps - fatigue + (rand() < 0.15 ? 1 : 0)), done: true });
        }
      });
      out.push({ id: uid(), started_at: t, ended_at: t + (55 + Math.floor(rand() * 25)) * 60e3, title: session.title, sets });
    });
  }
  return out;
}

async function seed() {
  for (const u of Object.values(mem.users)) if ([DEMO.coach.email, DEMO.ana.email, DEMO.luis.email].includes(u.email)) deleteUser(u.id);
  const h = await hash(DEMO_PASSWORD);
  const mk = (d, role) => ({ id: uid(), email: d.email, name: d.name, role, pass_hash: h.hash, pass_salt: h.salt, goal: d.goal || null, days_per_week: d.days || null, bodyweight: d.bw || null, onboarded: true, created_at: now() - 60 * 864e5 });
  const coach = mk(DEMO.coach, 'entrenador'), ana = mk(DEMO.ana, 'atleta'), luis = mk(DEMO.luis, 'atleta');
  [coach, ana, luis].forEach((u) => (mem.users[u.id] = u));
  const start = now() - 8 * 7 * 864e5;
  const rand = rng(42);
  const anaW = buildProgram({ days: [0, 1, 3, 4], rate: 0.012, sessions: [
    { title: 'Torso A', ex: [['bench_press', 37.5, 8, 4], ['lat_pulldown', 40, 10, 3], ['db_shoulder_press', 10, 10, 3], ['db_curl', 8, 12, 3], ['tricep_pushdown', 17.5, 12, 3]] },
    { title: 'Pierna A', ex: [['back_squat', 55, 8, 4], ['romanian_deadlift', 50, 10, 3], ['leg_press', 110, 12, 3], ['leg_curl', 25, 12, 3], ['calf_raise', 40, 15, 3]] },
    { title: 'Torso B', ex: [['incline_db', 14, 10, 3], ['seated_row', 40, 10, 3], ['lateral_raise', 6, 15, 3], ['pullups', 0, 5, 3], ['hammer_curl', 8, 12, 3]] },
    { title: 'Pierna B', ex: [['hip_thrust', 70, 10, 4], ['bulgarian_split', 10, 10, 3], ['leg_extension', 30, 12, 3], ['plank', 0, 45, 3]] },
  ] }, start, rand, 0);
  const luisW = buildProgram({ days: [0, 2, 4], rate: 0.015, sessions: [
    { title: 'Fuerza 1', ex: [['back_squat', 100, 5, 5], ['bench_press', 75, 5, 5], ['barbell_row', 65, 6, 4]] },
    { title: 'Fuerza 2', ex: [['deadlift', 130, 5, 3], ['ohp', 47.5, 5, 5], ['pullups', 5, 6, 4]] },
    { title: 'Fuerza 3', ex: [['back_squat', 90, 6, 4], ['incline_bench', 62.5, 6, 4], ['barbell_curl', 32.5, 8, 3], ['dips', 10, 8, 3]] },
  ] }, start, rand, 9);
  const add = (u, list) => list.forEach((w) => (mem.workouts[w.id] = { ...w, user_id: u.id, notes: '', routine_id: null, bodyweight: u.bodyweight, deleted: false, updated_at: w.ended_at, synced_at: ++mem.seq }));
  add(ana, anaW); add(luis, luisW);
  for (const a of [ana, luis]) mem.links.push({ id: uid(), coach_id: coach.id, athlete_id: a.id, code: code8(), status: 'accepted', created_at: start, expires_at: start + 7 * 864e5, accepted_at: start });
  const rid = uid();
  mem.routines[rid] = { id: rid, coach_id: coach.id, name: 'Full body 45 min', notes: 'Descansa 90 s entre series. Sube peso cuando completes todas las reps.', deleted: false, updated_at: now(),
    items: [{ exercise_id: 'back_squat', sets: 3, reps: 8, weight: 60 }, { exercise_id: 'bench_press', sets: 3, reps: 8, weight: 42.5 }, { exercise_id: 'seated_row', sets: 3, reps: 10, weight: 45 }, { exercise_id: 'lateral_raise', sets: 2, reps: 15, weight: 6 }] };
  for (const a of [ana, luis]) mem.assignments.push({ id: uid(), routine_id: rid, athlete_id: a.id, coach_id: coach.id, created_at: now() });
  const lastAna = anaW[anaW.length - 1];
  if (lastAna) mem.comments.push({ id: uid(), workout_id: lastAna.id, coach_id: coach.id, athlete_id: ana.id, body: '¡Gran sesión, Ana! La técnica en sentadilla se ve mucho mejor. La próxima semana sube 2.5 kg.', created_at: now() - 3600e3 });
  seedInfo.workouts = anaW.length + luisW.length;
  seedInfo.sets = [...anaW, ...luisW].reduce((a, w) => a + w.sets.length, 0);
}

// ---------------- Router ----------------
const table = Object.entries(R).map(([k, fn]) => {
  const [method, path] = k.split(' ');
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, n) => (keys.push(n), '([^/]+)')) + '$');
  return { method, re, keys, fn };
});

let queue = Promise.resolve();
export function handle(fullPath, { method = 'GET', body, token } = {}) {
  // Serializamos las peticiones para que no se pisen al guardar
  const run = queue.then(async () => {
    await load();
    const [p, qs] = fullPath.split('?');
    for (const r of table) {
      if (r.method !== method) continue;
      const m = r.re.exec(p);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      const out = await r.fn({ body: body || {}, token, params, query: new URLSearchParams(qs || '') });
      if (method !== 'GET') await save();
      return JSON.parse(JSON.stringify(out));
    }
    throw err(404, 'Ruta no encontrada');
  });
  queue = run.catch(() => {});
  return run;
}

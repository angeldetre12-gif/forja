// Forja · PWA de progresión en el gimnasio
import { API_BASE, APP_VERSION } from './config.js';
import { api, setToken, setAuthLostHandler, ApiError, IS_LOCAL } from './api.js';
import * as db from './db.js';
import { EXERCISES, MUSCLES, RANKS } from './exercises.js';
import * as C from './calc.js';
import { lineChart } from './chart.js';

// ======================================================================
// Utilidades
// ======================================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
const esc = (v) => String(v ?? '').replace(/[&<>"'`]/g, (c) => ESC[c]);
const uid = () => crypto.randomUUID();
const now = () => Date.now();
const parseNum = (v) => {
  if (v === '' || v === null || v === undefined) return NaN;
  return Number(String(v).replace(',', '.').trim());
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  lift: I('<path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/>'),
  cal: I('<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
  chart: I('<path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 5-6"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5"/>'),
  list: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  right: I('<path d="m9 6 6 6-6 6"/>'),
  left: I('<path d="m15 6-6 6 6 6"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  timer: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
  flame: I('<path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-7-4.5-11-2.5 1.5-4 4-4 6.5-1-1-1.5-2-1.5-3.5C6 9 5 11.5 5 15c0 4.2 3 7 7 7z"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 21h7M10 17h4v4h-4z"/>'),
  more: I('<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>'),
  share: I('<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  refresh: I('<path d="M20 11a8 8 0 0 0-14.6-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.6 4.5L21 15m0 5v-5h-5"/>'),
  logout: I('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>'),
  download: I('<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 19h14"/>'),
  key: I('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14.5 8.5l2 2"/>'),
  link: I('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  eye: I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  msg: I('<path d="M4 5h16v11H9l-5 4z"/>'),
  play: I('<path d="M7 5v14l11-7z"/>', 'fill="currentColor"'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>'),
  bolt: I('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
};
const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#1C1C21"/><path d="M14 40h36l-5 8H19z" fill="#FF6B2C"/><path d="M22 16h20v6H28v5h12v6H28v7h-6z" fill="#F2F1EE"/></svg>`;

const GOALS = {
  fuerza: { label: 'Ganar fuerza', desc: 'Levantar más peso en los básicos', ico: '🏋️', rest: 180 },
  hipertrofia: { label: 'Ganar músculo', desc: 'Volumen e hipertrofia', ico: '💪', rest: 90 },
  perder_grasa: { label: 'Perder grasa', desc: 'Mantener fuerza con déficit', ico: '🔥', rest: 60 },
  salud: { label: 'Salud y constancia', desc: 'Moverme y sentirme mejor', ico: '❤️', rest: 90 },
};
const RANK_CLASS = (i) => (i < 0 ? 'rn' : `r${i}`);
const GEM = (i) => `<svg class="gem" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 9v14L16 30 4 23V9z" fill="currentColor" opacity="${i < 0 ? 0.25 : 0.95}"/><path d="M16 2v28M4 9l12 7 12-7" stroke="#0B0B0D" stroke-opacity=".35" stroke-width="1.4" fill="none"/>${i >= 3 ? '<circle cx="16" cy="16" r="3" fill="#fff" opacity=".8"/>' : ''}</svg>`;

// ======================================================================
// Estado
// ======================================================================
const S = {
  user: null,
  token: null,
  workouts: [],          // entrenamientos terminados (locales + sincronizados)
  custom: [],            // ejercicios personalizados
  comments: [],          // comentarios del entrenador recibidos
  exMap: new Map(),
  active: null,          // entrenamiento en curso
  settings: { rest: null },
  sync: { online: navigator.onLine, busy: false, last: 0, error: '', cursor: '', csince: 0 },
  ui: {
    calMonth: null, calSel: null, progEx: null, progMetric: 'e1rm', histLimit: 30,
    exFilter: 'todos', exSearch: '', authTab: 'login', role: 'atleta', onb: null,
  },
  coach: { athletes: null, invites: [], routines: null, detail: {}, offline: false },
  myCoach: undefined,
  assigned: null,
  rest: null,
  charts: [],
  swReg: null,
};

function rebuildExMap() {
  S.exMap = new Map(EXERCISES.map((e) => [e.id, e]));
  for (const e of S.custom) S.exMap.set(e.id, { ...e, factor: 0 });
}
const exName = (id, map = S.exMap) => map.get(id)?.name || 'Ejercicio eliminado';
const liveWorkouts = () => S.workouts.filter((w) => !w.deleted && w.ended_at).sort((a, b) => b.started_at - a.started_at);
const pendingCount = () => S.workouts.filter((w) => w._dirty).length + S.custom.filter((e) => e._dirty).length;
const isCoach = () => S.user?.role === 'entrenador';
const defaultRest = () => S.settings.rest || GOALS[S.user?.goal]?.rest || 90;

// ======================================================================
// UI básicos: toasts, sheets, confirmaciones, confeti
// ======================================================================
function toast(msg, type = '', { ms = 2600, action, onAction } = {}) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { onAction?.(); el.remove(); };
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => el.remove(), ms);
}

let sheetStack = [];
function openSheet(title, bodyHtml, { onMount, onClose } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);
  sheet.innerHTML = `<div class="sheet-grip"></div><div class="sheet-head"><h2>${esc(title)}</h2>
    <button class="icon-btn plain" data-close aria-label="Cerrar">${ICON.x}</button></div><div class="sheet-body"></div>`;
  sheet.querySelector('.sheet-body').innerHTML = bodyHtml;
  document.body.append(scrim, sheet);
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });
  const close = () => {
    sheet.classList.remove('show');
    scrim.classList.remove('show');
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 260);
    sheetStack = sheetStack.filter((s) => s !== api);
    onClose?.();
  };
  const api = { el: sheet, body: sheet.querySelector('.sheet-body'), close };
  scrim.onclick = close;
  sheet.querySelector('[data-close]').onclick = close;
  sheetStack.push(api);
  onMount?.(api);
  return api;
}

function confirmDialog({ title, body = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet(title, `<p class="mute">${esc(body)}</p>
      <div class="grid-2" style="margin-top:20px">
        <button class="btn" data-no>${esc(cancel)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    s.body.querySelector('[data-no]').onclick = () => { answered = true; resolve(false); s.close(); };
    s.body.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); s.close(); };
  });
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.id = 'confetti';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#FF6B2C', '#F2C14E', '#3DDC97', '#7FE3E0', '#F2F1EE', '#FF8F4F'];
  const parts = Array.from({ length: 160 }, (_, i) => ({
    x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 15 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[i % colors.length], shape: Math.random() < 0.3,
  }));
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - el / 2600);
      ctx.fillStyle = p.c;
      if (p.shape) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (el < 2700) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

let audioCtx;
function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [0, 0.22].forEach((d) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + d); o.stop(t + d + 0.2);
    });
  } catch { /* sin audio */ }
}
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* */ } };

// ======================================================================
// Sesión y datos locales
// ======================================================================
async function loadLocal() {
  const [workouts, custom, comments, active, settings, sync] = await Promise.all([
    db.getAll('workouts'), db.getAll('exercises'), db.getAll('comments'),
    db.get('kv', 'active'), db.get('kv', 'settings'), db.get('kv', 'sync'),
  ]);
  S.workouts = workouts;
  S.custom = custom;
  S.comments = comments;
  S.active = active || null;
  S.settings = { rest: null, ...(settings || {}) };
  Object.assign(S.sync, sync || {});
  rebuildExMap();
}

const saveActive = debounce(() => (S.active ? db.put('kv', S.active, 'active') : db.del('kv', 'active')), 250);
const saveSyncMeta = () => db.put('kv', { last: S.sync.last, cursor: S.sync.cursor, csince: S.sync.csince, error: S.sync.error }, 'sync');

async function setSession(token, user) {
  const prevId = await db.get('kv', 'lastUserId');
  if (prevId && prevId !== user.id) {
    await db.clearAll(); // otra cuenta en este dispositivo → no mezclar datos
    S.workouts = []; S.custom = []; S.comments = []; S.active = null;
    S.sync.cursor = ''; S.sync.csince = 0; S.sync.last = 0;
  }
  S.token = token;
  S.user = user;
  setToken(token);
  await db.put('kv', { token, user }, 'session');
  await db.put('kv', user.id, 'lastUserId');
  rebuildExMap();
}

async function updateUser(user) {
  S.user = user;
  const s = await db.get('kv', 'session');
  if (s) await db.put('kv', { ...s, user }, 'session');
}

async function logout({ silent = false, wipe = true } = {}) {
  if (!silent && pendingCount() > 0) {
    await sync();
    if (pendingCount() > 0) {
      const ok = await confirmDialog({
        title: 'Datos sin sincronizar',
        body: `Tienes ${pendingCount()} cambio(s) que aún no llegan al servidor. Si cierras sesión ahora se perderán.`,
        ok: 'Cerrar sesión igual', danger: true,
      });
      if (!ok) return;
    }
  }
  try { if (S.token) await api('/auth/logout', { method: 'POST', body: {}, timeout: 5000 }); } catch { /* sin conexión: el token expira solo */ }
  if (wipe) { await db.clearAll(); S.workouts = []; S.custom = []; S.comments = []; S.active = null; }
  else await db.del('kv', 'session');
  S.token = null; S.user = null; S.myCoach = undefined; S.assigned = null;
  S.coach = { athletes: null, invites: [], routines: null, detail: {}, offline: false };
  S.sync = { ...S.sync, cursor: '', csince: 0, last: 0 };
  setToken(null);
  location.hash = '';
  render();
}

setAuthLostHandler(async (msg) => {
  if (!S.token || S.switching) return;
  S.token = null;
  setToken(null);
  await db.del('kv', 'session'); // conservamos los datos locales por si vuelve a entrar la misma cuenta
  S.user = null;
  render();
  toast(msg || 'Tu sesión expiró. Inicia sesión de nuevo.', 'bad', { ms: 5000 });
});

// ======================================================================
// Sincronización offline-first
// ======================================================================
let syncPromise = null;
function sync() {
  if (syncPromise) return syncPromise;
  syncPromise = doSync().finally(() => { syncPromise = null; });
  return syncPromise;
}

const stripLocal = (o) => { const { _dirty, _err, ...rest } = o; return rest; };

async function doSync() {
  if (!S.token || (!navigator.onLine && !IS_LOCAL)) { renderSyncPill(); return; }
  S.sync.busy = true;
  renderSyncPill();
  try {
    // 1) Subir cambios locales en lotes
    const dirtyEx = S.custom.filter((e) => e._dirty);
    let dirtyW = S.workouts.filter((w) => w._dirty);
    let first = true;
    while (first || dirtyW.length) {
      first = false;
      const batch = dirtyW.slice(0, 25);
      dirtyW = dirtyW.slice(25);
      const exBatch = dirtyEx.splice(0, dirtyEx.length);
      if (!batch.length && !exBatch.length) break;
      const res = await api('/workouts/sync', {
        method: 'POST', retries: 2, timeout: 20000,
        body: { exercises: exBatch.map(stripLocal), workouts: batch.map(stripLocal) },
      });
      const changedW = [];
      for (const r of res.workouts) {
        const w = S.workouts.find((x) => x.id === r.id);
        if (!w) continue;
        if (r.status === 'ok' && w.updated_at === r.updated_at) { delete w._dirty; delete w._err; changedW.push(w); }
        else if (r.status === 'stale') { delete w._dirty; changedW.push(w); }
        else if (r.status !== 'ok') { w._err = r.error || r.status; delete w._dirty; changedW.push(w); }
      }
      await db.putMany('workouts', changedW);
      const changedE = [];
      for (const r of res.exercises) {
        const e = S.custom.find((x) => x.id === r.id);
        if (!e) continue;
        if (r.status !== 'ok' || e.updated_at === r.updated_at) { delete e._dirty; changedE.push(e); }
      }
      await db.putMany('exercises', changedE);
    }

    // 2) Descargar cambios del servidor (paginado)
    let more = true;
    let guard = 0;
    while (more && guard++ < 50) {
      const q = new URLSearchParams({ cursor: S.sync.cursor || '', csince: String(S.sync.csince || 0) });
      const res = await api(`/workouts?${q}`, { retries: 2, timeout: 20000 });
      const puts = [];
      const dels = [];
      for (const sw of res.workouts) {
        const local = S.workouts.find((x) => x.id === sw.id);
        if (local?._dirty && local.updated_at >= sw.updated_at) continue;
        if (sw.deleted) { dels.push(sw.id); continue; }
        puts.push({ ...sw });
      }
      if (puts.length) await db.putMany('workouts', puts);
      for (const id of dels) await db.del('workouts', id);
      const map = new Map(S.workouts.map((w) => [w.id, w]));
      for (const w of puts) map.set(w.id, w);
      for (const id of dels) map.delete(id);
      S.workouts = [...map.values()];
      // Ejercicios personalizados
      const exMapLocal = new Map(S.custom.map((e) => [e.id, e]));
      for (const e of res.exercises) {
        const loc = exMapLocal.get(e.id);
        if (loc?._dirty && loc.updated_at >= e.updated_at) continue;
        exMapLocal.set(e.id, e);
      }
      S.custom = [...exMapLocal.values()];
      await db.putMany('exercises', S.custom);
      // Comentarios del entrenador
      if (res.comments.length) {
        const fresh = res.comments.filter((c) => !S.comments.some((x) => x.id === c.id));
        S.comments.push(...res.comments.filter((c) => !S.comments.some((x) => x.id === c.id)));
        await db.putMany('comments', res.comments);
        S.sync.csince = Math.max(S.sync.csince || 0, ...res.comments.map((c) => c.created_at));
        if (fresh.length && S.sync.last) toast(`💬 ${fresh[0].coach_name}: ${fresh[0].body.slice(0, 80)}`, '', { ms: 5000 });
      }
      S.sync.cursor = res.cursor;
      more = res.more;
    }
    rebuildExMap();
    S.sync.last = now();
    S.sync.error = '';
  } catch (err) {
    S.sync.error = err.message || String(err);
    if (!(err instanceof ApiError && err.offline)) console.warn('sync', err);
  } finally {
    S.sync.busy = false;
    await saveSyncMeta();
    renderSyncPill();
    if (!S.active || route().tab !== 'entreno') softRender();
  }
}

function renderSyncPill() {
  const el = $('#sync-pill');
  if (!el) return;
  const p = pendingCount();
  const online = navigator.onLine || IS_LOCAL;
  el.className = `sync-pill ${!online ? 'offline' : p ? 'pending' : ''} ${S.sync.busy ? 'busy' : ''}`;
  el.innerHTML = `<i></i>${!online ? 'Sin conexión' : S.sync.busy ? 'Sincronizando' : p ? `${p} pendiente${p > 1 ? 's' : ''}` : 'Al día'}`;
}

// ======================================================================
// Router
// ======================================================================
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { tab: parts[0] || (isCoach() ? 'alumnos' : 'entrenar'), id: parts[1] ? decodeURIComponent(parts[1]) : null };
}
const go = (path) => { if (location.hash !== `#/${path}`) location.hash = `#/${path}`; else render(); };

function destroyCharts() { S.charts.forEach((c) => c.destroy()); S.charts = []; }

// Re-render que no interrumpe si el usuario está escribiendo
function softRender() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && $('#app').contains(a)) return;
  if (sheetStack.length) return;
  render();
}

function render() {
  destroyCharts();
  const app = $('#app');
  if (!S.user) { app.innerHTML = viewAuth(); return; }
  if (!isCoach() && !S.user.onboarded) { app.innerHTML = viewOnboarding(); return; }

  const r = route();
  let body;
  const tabs = isCoach()
    ? [['alumnos', 'Alumnos', ICON.users], ['rutinas', 'Rutinas', ICON.list], ['perfil', 'Perfil', ICON.user]]
    : [['entrenar', 'Entrenar', ICON.lift], ['historial', 'Historial', ICON.cal], ['progreso', 'Progreso', ICON.chart], ['perfil', 'Perfil', ICON.user]];

  if (!isCoach() && r.tab === 'entreno' && !S.active) { location.replace('#/entrenar'); return; }
  if (!isCoach() && r.tab === 'entreno' && S.active) body = viewWorkout();
  else if (!isCoach() && r.tab === 'historial') body = viewHistory();
  else if (!isCoach() && r.tab === 'progreso') body = viewProgress();
  else if (r.tab === 'perfil') body = viewProfile();
  else if (isCoach() && r.tab === 'alumno' && r.id) body = viewAthlete(r.id);
  else if (isCoach() && r.tab === 'rutinas') body = viewRoutines();
  else if (isCoach() && r.tab === 'rutina') body = viewRoutineEditor(r.id);
  else if (isCoach()) body = viewCoachHome();
  else body = viewHome();

  const inWorkout = r.tab === 'entreno' && S.active && !isCoach();
  const activeTab = r.tab === 'alumno' ? 'alumnos' : r.tab === 'rutina' ? 'rutinas' : r.tab;
  app.innerHTML = `
    <header class="topbar" id="topbar">
      <button class="logo" data-a="logo" aria-label="Forja">${LOGO}<b>Forja</b></button>
      <span class="sync-pill" id="sync-pill"></span>
    </header>
    <main class="view ${inWorkout ? 'no-nav' : ''}" id="view">${body}</main>
    ${inWorkout ? viewWorkoutBottom() : `<nav class="nav" aria-label="Navegación"><div class="nav-inner">${tabs.map(([k, l, ic]) =>
      `<button data-a="nav" data-to="${k}" class="${activeTab === k ? 'active' : ''}" aria-current="${activeTab === k ? 'page' : 'false'}">${ic}<span>${l}</span></button>`).join('')}</div></nav>`}
    ${inWorkout ? viewRestBar() : ''}`;
  renderSyncPill();
  applyDynamicStyles(app);
  mountCharts();
  if (inWorkout) { tickRest(); requestWakeLock(); } else releaseWakeLock();
}

// CSP sin 'unsafe-inline': los anchos dinámicos se aplican por CSSOM
function applyDynamicStyles(root) {
  $$('[data-w]', root).forEach((el) => { el.style.width = `${clamp(Number(el.dataset.w) || 0, 0, 100)}%`; });
  $$('[data-mt]', root).forEach((el) => { el.style.marginTop = `${Number(el.dataset.mt) || 0}px`; });
}

// ======================================================================
// Vistas: autenticación
// ======================================================================
function viewAuth() {
  const reg = S.ui.authTab === 'register';
  return `<div class="auth">
    <div class="auth-hero">
      <div class="mark">${LOGO}</div>
      <h1>${reg ? 'Empieza a forjar tu progreso' : 'Bienvenido de vuelta'}</h1>
      <p>${reg ? 'Registra cada serie, rompe récords y entrena con tu coach.' : 'Tu progreso te está esperando.'}</p>
    </div>
    <div class="seg" role="tablist" style="margin-bottom:18px">
      <button role="tab" data-a="auth-tab" data-to="login" class="${!reg ? 'on' : ''}">Iniciar sesión</button>
      <button role="tab" data-a="auth-tab" data-to="register" class="${reg ? 'on' : ''}">Crear cuenta</button>
    </div>
    <form id="auth-form" class="stack" novalidate autocomplete="on">
      ${reg ? `<label class="field"><span>Nombre</span><input class="input" name="name" autocomplete="name" maxlength="60" required placeholder="¿Cómo te llamas?"></label>` : ''}
      <label class="field"><span>Email</span><input class="input" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required placeholder="tu@email.com"></label>
      <label class="field"><span>Contraseña</span><div class="pw-wrap">
        <input class="input" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" required placeholder="${reg ? 'Mínimo 8, con letras y números' : '••••••••'}">
        <button type="button" class="icon-btn plain" data-a="toggle-pw" aria-label="Mostrar contraseña">${ICON.eye}</button></div></label>
      ${reg ? `<div><span class="upper">Soy</span><div class="role-pick" style="margin-top:8px">
        <button type="button" data-a="pick-role" data-to="atleta" class="${S.ui.role === 'atleta' ? 'on' : ''}"><b>🏋️ Atleta</b><span>Registro mis entrenamientos</span></button>
        <button type="button" data-a="pick-role" data-to="entrenador" class="${S.ui.role === 'entrenador' ? 'on' : ''}"><b>📋 Entrenador</b><span>Sigo a mis alumnos</span></button>
      </div></div>` : ''}
      <p class="error-msg" id="auth-err" role="alert"></p>
      <button class="btn primary block" type="submit">${reg ? 'Crear cuenta' : 'Entrar'}</button>
    </form>
  </div>`;
}

async function submitAuth(form) {
  const f = new FormData(form);
  const err = $('#auth-err');
  const btn = form.querySelector('[type=submit]');
  err.textContent = '';
  const email = String(f.get('email') || '').trim();
  const password = String(f.get('password') || '');
  const reg = S.ui.authTab === 'register';
  if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Escribe un email válido'; return; }
  if (reg) {
    if (!String(f.get('name') || '').trim()) { err.textContent = 'Escribe tu nombre'; return; }
    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-ZÀ-ÿ]/.test(password)) { err.textContent = 'La contraseña necesita 8+ caracteres, con letras y números'; return; }
  }
  btn.disabled = true;
  btn.textContent = reg ? 'Creando…' : 'Entrando…';
  try {
    const res = reg
      ? await api('/auth/register', { method: 'POST', body: { name: f.get('name'), email, password, role: S.ui.role } })
      : await api('/auth/login', { method: 'POST', body: { email, password } });
    await setSession(res.token, res.user);
    await loadLocal();
    location.hash = '';
    render();
    sync();
    toast(reg ? `¡Bienvenido, ${res.user.name}!` : `Hola de nuevo, ${res.user.name}`, 'ok');
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    btn.textContent = reg ? 'Crear cuenta' : 'Entrar';
  }
}

// ======================================================================
// Onboarding (3 preguntas)
// ======================================================================
function viewOnboarding() {
  const o = (S.ui.onb ||= { step: 0, goal: S.user.goal || null, days: S.user.days_per_week || null, bw: S.user.bodyweight || '' });
  const dots = `<div class="onb-dots">${[0, 1, 2].map((i) => `<i class="${i <= o.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let content = '';
  let canNext = false;
  if (o.step === 0) {
    canNext = !!o.goal;
    content = `<span class="upper">Pregunta 1 de 3</span><h1 style="margin-top:8px">¿Cuál es tu objetivo principal?</h1>
      <div class="options">${Object.entries(GOALS).map(([k, g]) => `<button class="option ${o.goal === k ? 'on' : ''}" data-a="onb-goal" data-to="${k}">
        <span class="ico">${g.ico}</span><div><b>${g.label}</b><span>${g.desc}</span></div></button>`).join('')}</div>`;
  } else if (o.step === 1) {
    canNext = !!o.days;
    content = `<span class="upper">Pregunta 2 de 3</span><h1 style="margin-top:8px">¿Cuántos días por semana vas a entrenar?</h1>
      <p class="mute" style="margin-top:8px">Lo usamos para tu meta semanal y tu racha.</p>
      <div class="daypick">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<button class="${o.days === d ? 'on' : ''}" data-a="onb-days" data-to="${d}">${d}</button>`).join('')}</div>`;
  } else {
    const v = parseNum(o.bw);
    canNext = v >= 25 && v <= 350;
    content = `<span class="upper">Pregunta 3 de 3</span><h1 style="margin-top:8px">¿Cuánto pesas?</h1>
      <p class="mute" style="margin-top:8px">Sirve para calcular tus rangos de fuerza (Hierro → Platino). Puedes cambiarlo cuando quieras.</p>
      <div class="big-input"><input id="onb-bw" inputmode="decimal" autocomplete="off" placeholder="70" value="${esc(o.bw)}" aria-label="Peso corporal en kg" maxlength="5"><span>kg</span></div>`;
  }
  return `<div class="onb">${dots}${content}
    <div class="onb-foot">
      ${o.step > 0 ? `<button class="btn" data-a="onb-back">Atrás</button>` : ''}
      <button class="btn primary grow" id="onb-next" data-a="onb-next" ${canNext ? '' : 'disabled'}>${o.step === 2 ? 'Empezar' : 'Siguiente'}</button>
    </div></div>`;
}

async function finishOnboarding() {
  const o = S.ui.onb;
  const btn = $('#onb-next');
  btn.disabled = true;
  try {
    const res = await api('/auth/profile', { method: 'PUT', body: { goal: o.goal, days_per_week: o.days, bodyweight: parseNum(o.bw), onboarded: true } });
    await updateUser(res.user);
    S.ui.onb = null;
    go('entrenar');
    toast('¡Listo! Tu primer entrenamiento te espera 💪', 'ok');
  } catch (e) {
    toast(e.message, 'bad');
    btn.disabled = false;
  }
}

// ======================================================================
// Atleta: inicio
// ======================================================================
function weekCount(ws = liveWorkouts()) {
  const ws0 = C.weekStart(now());
  return ws.filter((w) => w.started_at >= ws0).length;
}

function viewHome() {
  const ws = liveWorkouts();
  const goal = S.user.days_per_week || 3;
  const thisWeek = weekCount(ws);
  const streak = C.weekStreak(ws.map((w) => w.started_at));
  const pct = Math.min(1, thisWeek / goal);
  const circ = 2 * Math.PI * 32;
  const lastComment = [...S.comments].sort((a, b) => b.created_at - a.created_at)[0];
  const recent = ws.slice(0, 3);
  const assigned = S.assigned;
  if (assigned === null) loadAssigned();

  return `<div class="stack">
    <div class="row between" style="margin-top:6px"><div><p class="mute small">${esc(C.fmtDateLong(now()))}</p><h1>Hola, ${esc(S.user.name.split(' ')[0])}</h1></div></div>
    ${S.active ? `<button class="card hero link" data-a="resume"><div class="active-banner"><span class="dot"></span><div class="grow">
        <b>Entrenamiento en curso</b><p class="mute small">${esc(S.active.title || 'Entrenamiento')} · ${C.fmtDuration(now() - S.active.started_at)}</p></div>
        <span class="btn sm primary">Continuar</span></div></button>` : ''}
    <div class="card">
      <div class="week-ring">
        <div class="ring"><svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="32" stroke="var(--surface-3)" stroke-width="8" fill="none"/>
          <circle cx="38" cy="38" r="32" stroke="var(--ember)" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/></svg>
          <b>${thisWeek}/${goal}</b></div>
        <div class="grow"><h3>${thisWeek >= goal ? '¡Meta semanal cumplida! 🎯' : (goal - thisWeek === 1 ? 'Te falta 1 entrenamiento' : `Te faltan ${goal - thisWeek} entrenamientos`)}</h3>
          <p class="mute small" style="margin-top:4px">Meta: ${goal} días por semana</p>
          <p class="streak-flame ember" style="margin-top:8px">${ICON.flame.replace('<svg', '<svg width="18" height="18"')} Racha: ${streak} semana${streak === 1 ? '' : 's'}</p></div>
      </div>
    </div>
    ${!S.active ? `<button class="btn primary block" data-a="start-empty">${ICON.plus} Empezar entrenamiento</button>` : ''}
    ${lastComment ? `<div class="comment"><div class="who">💬 ${esc(lastComment.coach_name)} · ${esc(C.relDays(lastComment.created_at))}</div>${esc(lastComment.body)}</div>` : ''}
    ${assigned?.length ? `<div class="section-title"><h2>Rutinas de tu entrenador</h2></div>
      <div class="stack-sm">${assigned.map((r) => `<div class="card tight"><div class="row">
        <div class="grow"><h3>${esc(r.name)}</h3><p class="mute small">${r.items.length} ejercicios · de ${esc(r.coach_name)}</p></div>
        <button class="btn sm primary" data-a="start-routine" data-id="${esc(r.id)}" ${S.active ? 'disabled' : ''}>${ICON.play} Empezar</button></div>
        ${r.notes ? `<p class="small mute" style="margin-top:8px">${esc(r.notes)}</p>` : ''}</div>`).join('')}</div>` : ''}
    ${recent.length ? `<div class="section-title"><h2>Repetir un entrenamiento</h2></div>
      <div class="card tight list">${recent.map((w) => `<button class="list-item" data-a="repeat" data-id="${esc(w.id)}" ${S.active ? 'disabled' : ''}>
        <div class="grow"><b>${esc(w.title || 'Entrenamiento')}</b><p class="mute small">${esc(C.fmtDate(w.started_at, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${C.groupByExercise(w).length} ejercicios</p></div>
        <span class="chev">${ICON.right}</span></button>`).join('')}</div>` : `<div class="empty"><div class="big">🏁</div><b>Tu historia empieza hoy</b>Toca “Empezar entrenamiento” y registra tu primera serie.</div>`}
  </div>`;
}

async function loadAssigned() {
  S.assigned = (await db.get('cache', 'assigned')) || [];
  if (!navigator.onLine || !S.token) return;
  try {
    const res = await api('/routines/assigned');
    S.assigned = res.routines;
    await db.put('cache', res.routines, 'assigned');
    if (route().tab === 'entrenar') softRender();
  } catch { /* usamos la caché */ }
}

// ======================================================================
// Atleta: entrenamiento en curso
// ======================================================================
function newSet(prevSet, target = {}) {
  return { id: uid(), weight: '', reps: '', done: false, pr: false, phW: prevSet?.weight ?? target.weight ?? '', phR: target.reps ?? prevSet?.reps ?? '' };
}

function makeExercise(exercise_id, { sets, target } = {}) {
  const prev = C.previousSession(S.workouts, exercise_id, now() + 1);
  const n = sets || (prev ? Math.min(prev.sets.length, 8) : 3);
  const tgtWeight = prev ? undefined : target?.weight || undefined;
  return {
    uid: uid(), exercise_id,
    sets: Array.from({ length: n }, (_, i) => newSet(prev?.sets[i] || prev?.sets[prev.sets.length - 1], { reps: target?.reps, weight: tgtWeight })),
  };
}

async function startWorkout({ title = '', routine_id = null, exercises = [] } = {}) {
  if (S.active) { go('entreno'); return; }
  S.active = { id: uid(), started_at: now(), title, routine_id, notes: '', exercises };
  await db.put('kv', S.active, 'active');
  go('entreno');
}

function viewWorkout() {
  const a = S.active;
  const body = a.exercises.length ? a.exercises.map((ex, i) => viewExerciseCard(ex, i)).join('') :
    `<div class="empty"><div class="big">🏋️</div><b>Agrega tu primer ejercicio</b>Busca entre más de 60 ejercicios o crea el tuyo.</div>`;
  return `<div class="wk-head">
      <input class="wk-title" id="wk-title" value="${esc(a.title)}" placeholder="Entrenamiento" maxlength="80" aria-label="Nombre del entrenamiento">
      <div class="wk-meta"><span>${ICON.timer.replace('<svg', '<svg width="15" height="15"')} <b id="wk-elapsed">${C.fmtClock((now() - a.started_at) / 1000)}</b></span>
        <span id="wk-volume">${C.kg(workoutVolume())}</span><span id="wk-sets">${doneCount()} series</span></div>
    </div>
    <div id="ex-list">${body}</div>
    <button class="btn block" style="margin-top:14px" data-a="add-exercise">${ICON.plus} Añadir ejercicio</button>
    <label class="field" style="margin-top:18px"><span>Notas</span><textarea class="input" id="wk-notes" maxlength="2000" placeholder="¿Cómo te sentiste?">${esc(a.notes)}</textarea></label>
    <button class="btn ghost danger block" style="margin-top:10px" data-a="discard">Descartar entrenamiento</button>`;
}

function viewExerciseCard(ex, i) {
  const info = S.exMap.get(ex.exercise_id);
  const prev = C.previousSession(S.workouts, ex.exercise_id, now() + 1);
  const doneSets = ex.sets.filter((s) => s.done);
  // Comparación justa: mismo número de series que llevas hechas
  const prevVol = prev ? C.volumeOf(prev.sets.slice(0, doneSets.length)) : 0;
  const curVol = C.volumeOf(doneSets.map((s) => ({ weight: +s.weight, reps: +s.reps })));
  const delta = prevVol && curVol ? ((curVol - prevVol) / prevVol) * 100 : null;
  return `<article class="ex-card" data-ex="${i}">
    <div class="ex-head"><div class="grow"><h3>${esc(info?.name || 'Ejercicio')}</h3>
      <p class="prev-line">${prev ? `Anterior · ${esc(C.fmtDate(prev.date))}: ${prev.sets.map((s) => `${C.num(s.weight)}×${s.reps}`).join(' · ')}` : `${esc(MUSCLES[info?.muscle] || '')} · Primera vez 🎉`}</p></div>
      <button class="icon-btn plain" data-a="ex-menu" data-ex="${i}" aria-label="Opciones del ejercicio">${ICON.more}</button></div>
    <div class="sets">
      <div class="set-head"><span>#</span><span>Anterior</span><span>${info?.bw ? '+Kg' : 'Kg'}</span><span>Reps</span><span></span></div>
      ${ex.sets.map((s, j) => viewSetRow(ex, i, s, j, prev?.sets[j])).join('')}
    </div>
    <div class="ex-foot">
      <span class="ex-summary" id="exsum-${i}">${curVol ? `Volumen <b>${C.kg(curVol)}</b>${delta !== null ? ` · <span class="${delta >= 0 ? 'ok' : 'bad'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}%</span> vs anterior` : ''}` : ''}</span>
      <div class="row"><button class="btn sm ghost" data-a="del-set" data-ex="${i}" aria-label="Quitar serie" ${ex.sets.length <= 1 ? 'disabled' : ''}>${ICON.minus}</button>
      <button class="btn sm" data-a="add-set" data-ex="${i}">${ICON.plus} Serie</button></div>
    </div>
  </article>`;
}

function compareText(s, p) {
  const w = parseNum(s.weight !== '' ? s.weight : s.phW);
  const r = parseNum(s.reps !== '' ? s.reps : s.phR);
  if (!p || (!s.done && s.weight === '' && s.reps === '')) return '';
  if (!(r > 0)) return '';
  const dw = Math.round((w - p.weight) * 100) / 100;
  if (dw > 0) return `<em class="up">▲ +${C.num(dw)} kg</em>`;
  if (dw < 0) return `<em class="down">▼ ${C.num(dw)} kg</em>`;
  const dr = r - p.reps;
  if (dr > 0) return `<em class="up">▲ +${dr} rep${dr > 1 ? 's' : ''}</em>`;
  if (dr < 0) return `<em class="down">▼ ${dr} rep${dr < -1 ? 's' : ''}</em>`;
  return '<em class="eq">= igual</em>';
}

function viewSetRow(ex, i, s, j, p) {
  return `<div class="set-row ${s.done ? 'done' : ''} ${s.pr ? 'pr' : ''}" data-row="${i}-${j}">
    <span class="set-n">${s.pr ? '🏆' : j + 1}</span>
    <span class="set-prev" id="cmp-${i}-${j}">${p ? `${C.num(p.weight)}×${p.reps}` : '—'}${compareText(s, p)}</span>
    <input class="set-in" inputmode="decimal" enterkeyhint="next" autocomplete="off" maxlength="6" data-in="weight" data-ex="${i}" data-set="${j}" value="${esc(s.weight)}" placeholder="${esc(s.phW)}" aria-label="Peso serie ${j + 1}">
    <input class="set-in" inputmode="numeric" enterkeyhint="done" autocomplete="off" maxlength="4" data-in="reps" data-ex="${i}" data-set="${j}" value="${esc(s.reps)}" placeholder="${esc(s.phR)}" aria-label="Repeticiones serie ${j + 1}">
    <button class="set-done" data-a="toggle-set" data-ex="${i}" data-set="${j}" aria-label="Marcar serie ${j + 1} como hecha" aria-pressed="${s.done}">${ICON.check}</button>
  </div>`;
}

function viewWorkoutBottom() {
  return `<div class="wk-bottom"><div class="inner"><button class="btn primary block" data-a="finish">${ICON.check} Terminar entrenamiento</button></div></div>`;
}
function viewRestBar() {
  return `<div class="rest" id="rest" aria-live="polite">
    <span class="clock" id="rest-clock">0:00</span>
    <div class="grow"><b class="small">Descanso</b><p class="tiny mute" id="rest-sub"></p></div>
    <button class="btn sm" data-a="rest-adj" data-to="-15">−15</button>
    <button class="btn sm" data-a="rest-adj" data-to="15">+15</button>
    <button class="icon-btn" data-a="rest-skip" aria-label="Saltar descanso">${ICON.x}</button>
    <div class="bar"><i id="rest-bar"></i></div></div>`;
}

const doneCount = () => (S.active?.exercises || []).reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
const workoutVolume = () => (S.active?.exercises || []).reduce((a, e) => a + C.volumeOf(e.sets.filter((s) => s.done).map((s) => ({ weight: +s.weight, reps: +s.reps }))), 0);

function refreshWorkoutMeta() {
  const v = $('#wk-volume'); if (v) v.textContent = C.kg(workoutVolume());
  const c = $('#wk-sets'); if (c) c.textContent = `${doneCount()} series`;
}
function rerenderExercise(i) {
  const card = $(`.ex-card[data-ex="${i}"]`);
  if (!card) return render();
  const tmp = document.createElement('div');
  tmp.innerHTML = viewExerciseCard(S.active.exercises[i], i);
  card.replaceWith(tmp.firstElementChild);
  refreshWorkoutMeta();
}

function bwNow() { return S.user?.bodyweight || 0; }

function toggleSet(i, j) {
  const ex = S.active.exercises[i];
  const s = ex.sets[j];
  if (s.done) {
    s.done = false;
    recomputePR(ex);
  } else {
    const w = parseNum(s.weight !== '' ? s.weight : s.phW);
    const r = parseNum(s.reps !== '' ? s.reps : s.phR);
    if (!(r > 0) || r > 1000) { toast('Escribe las repeticiones de la serie', 'bad'); $(`[data-in="reps"][data-ex="${i}"][data-set="${j}"]`)?.focus(); return; }
    s.weight = Number.isFinite(w) && w >= 0 ? Math.min(1500, Math.round(w * 100) / 100) : 0;
    s.reps = Math.round(r);
    s.done = true;
    buzz(25);
    const celebrated = recomputePR(ex);
    if (celebrated) {
      confetti();
      buzz([60, 40, 120]);
      toast(`¡Nuevo récord en ${exName(ex.exercise_id)}! 1RM est. ${C.kg(celebrated)}`, 'pr', { ms: 4500 });
    }
    startRest();
    // Copia el valor a la siguiente serie vacía como sugerencia
    const next = ex.sets[j + 1];
    if (next && !next.done && next.weight === '' && next.phW === '') next.phW = s.weight;
  }
  S.active.updated_at = now();
  saveActive();
  rerenderExercise(i);
}

// Marca como PR la mejor serie si supera el histórico. Devuelve el 1RM si es un PR nuevo a celebrar.
function recomputePR(ex) {
  const info = S.exMap.get(ex.exercise_id);
  const hist = C.bestE1rm(S.workouts, ex.exercise_id, S.exMap, bwNow());
  const prevBestFlag = Math.max(0, ...ex.sets.filter((s) => s.pr).map((s) => C.e1rm(C.loadOf(s, info, bwNow()), s.reps)));
  ex.sets.forEach((s) => (s.pr = false));
  if (!hist) return 0;
  let best = null, bestV = 0;
  for (const s of ex.sets) {
    if (!s.done) continue;
    const v = C.e1rm(C.loadOf(s, info, bwNow()), s.reps);
    if (v > bestV) { bestV = v; best = s; }
  }
  if (best && bestV > hist + 0.01) {
    best.pr = true;
    return bestV > prevBestFlag + 0.01 ? bestV : 0;
  }
  return 0;
}

// ----- Temporizador de descanso (basado en reloj real: sobrevive a pestañas en segundo plano) -----
let restTimer = null;
function startRest(sec = defaultRest()) {
  S.rest = { endAt: now() + sec * 1000, total: sec, ended: false };
  tickRest();
}
function tickRest() {
  clearInterval(restTimer);
  const el = $('#rest');
  if (!el || !S.rest) { el?.classList.remove('show'); return; }
  const update = () => {
    if (!S.rest) { el.classList.remove('show', 'ended'); clearInterval(restTimer); return; }
    const left = (S.rest.endAt - now()) / 1000;
    el.classList.add('show');
    $('#rest-clock').textContent = C.fmtClock(Math.max(0, left));
    $('#rest-sub').textContent = left > 0 ? `de ${C.fmtClock(S.rest.total)}` : '¡A la siguiente serie!';
    $('#rest-bar').style.transform = `scaleX(${clamp(left / S.rest.total, 0, 1)})`;
    if (left <= 0 && !S.rest.ended) {
      S.rest.ended = true;
      el.classList.add('ended');
      beep(); buzz([200, 100, 200]);
      setTimeout(() => { if (S.rest?.ended) { S.rest = null; el.classList.remove('show', 'ended'); } }, 4000);
    }
    const e = $('#wk-elapsed');
    if (e && S.active) e.textContent = C.fmtClock((now() - S.active.started_at) / 1000);
  };
  update();
  restTimer = setInterval(update, 250);
}
// Reloj del entrenamiento aunque no haya descanso
setInterval(() => {
  const e = $('#wk-elapsed');
  if (e && S.active && !S.rest) e.textContent = C.fmtClock((now() - S.active.started_at) / 1000);
}, 1000);

let wakeLock = null;
async function requestWakeLock() {
  try { if (!wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* no soportado */ }
}
function releaseWakeLock() { try { wakeLock?.release(); } catch { /* */ } wakeLock = null; }

function openExercisePicker(onPick, { libraryOnly = false, multi = false } = {}) {
  const selected = new Set();
  const draw = (s) => {
    const q = S.ui.exSearch.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const list = [...S.exMap.values()]
      .filter((e) => !e.deleted && (!libraryOnly || !e.custom))
      .filter((e) => S.ui.exFilter === 'todos' || e.muscle === S.ui.exFilter)
      .filter((e) => !q || e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    s.body.querySelector('#ex-results').innerHTML = list.length ? list.map((e) => `<button class="ex-pick ${selected.has(e.id) ? 'sel' : ''}" data-pick="${esc(e.id)}">
      <div class="grow"><b>${esc(e.name)}</b><div class="m">${esc(MUSCLES[e.muscle])}${e.custom ? ' · personalizado' : ''}${e.bw ? ' · peso corporal' : ''}</div></div>
      ${selected.has(e.id) ? ICON.check.replace('<svg', '<svg width="20" height="20"') : ICON.plus.replace('<svg', '<svg width="20" height="20"')}</button>`).join('')
      : `<div class="empty"><b>Sin resultados</b>${libraryOnly ? '' : 'Crea un ejercicio personalizado abajo.'}</div>`;
    s.body.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.m === S.ui.exFilter));
    const done = s.body.querySelector('#ex-done');
    if (done) { done.disabled = !selected.size; done.textContent = selected.size ? `Añadir ${selected.size}` : 'Selecciona ejercicios'; }
  };
  const s = openSheet('Añadir ejercicio', `
    <div class="pw-wrap"><input class="input" id="ex-search" placeholder="Buscar ejercicio…" value="${esc(S.ui.exSearch)}" autocomplete="off" maxlength="40"></div>
    <div class="chips" style="margin:12px 0 4px">${['todos', ...Object.keys(MUSCLES)].map((m) => `<button class="chip" data-m="${m}">${m === 'todos' ? 'Todos' : MUSCLES[m]}</button>`).join('')}</div>
    <div id="ex-results"></div>
    ${libraryOnly ? '' : `<details style="margin-top:16px"><summary class="btn block ghost">Crear ejercicio personalizado</summary>
      <form id="custom-form" class="stack" style="margin-top:12px">
        <input class="input" name="name" placeholder="Nombre del ejercicio" maxlength="60" required>
        <select class="input" name="muscle">${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" name="bw"> Usa mi peso corporal (dominadas, fondos…)</label>
        <button class="btn primary block" type="submit">Crear y añadir</button></form></details>`}
    ${multi ? `<div style="position:sticky;bottom:0;padding-top:12px;background:var(--surface)"><button class="btn primary block" id="ex-done" disabled>Selecciona ejercicios</button></div>` : ''}`,
  {
    onMount: (sh) => {
      draw(sh);
      const inp = sh.body.querySelector('#ex-search');
      inp.oninput = () => { S.ui.exSearch = inp.value; draw(sh); };
      sh.body.addEventListener('click', (ev) => {
        const chip = ev.target.closest('.chip');
        if (chip) { S.ui.exFilter = chip.dataset.m; draw(sh); return; }
        const pick = ev.target.closest('[data-pick]');
        if (pick) {
          if (multi) { selected.has(pick.dataset.pick) ? selected.delete(pick.dataset.pick) : selected.add(pick.dataset.pick); draw(sh); }
          else { sh.close(); onPick([pick.dataset.pick]); }
        }
        if (ev.target.id === 'ex-done') { sh.close(); onPick([...selected]); }
      });
      const form = sh.body.querySelector('#custom-form');
      if (form) form.onsubmit = async (ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const name = String(f.get('name') || '').trim().slice(0, 60);
        if (name.length < 2) { toast('Escribe un nombre', 'bad'); return; }
        const e = { id: `c_${uid().replace(/-/g, '').slice(0, 24)}`, name, muscle: f.get('muscle'), bw: !!f.get('bw'), deleted: false, custom: true, factor: 0, updated_at: now(), _dirty: 1 };
        S.custom.push(e);
        await db.put('exercises', e);
        rebuildExMap();
        sh.close();
        onPick([e.id]);
        sync();
      };
    },
  });
}

async function finishWorkout() {
  const a = S.active;
  const done = a.exercises.flatMap((e) => e.sets.filter((s) => s.done));
  if (!done.length) {
    const ok = await confirmDialog({ title: 'No marcaste ninguna serie', body: 'Marca cada serie con ✓ al terminarla. ¿Quieres descartar este entrenamiento?', ok: 'Descartar', danger: true, cancel: 'Seguir entrenando' });
    if (ok) await discardWorkout(true);
    return;
  }
  const sets = [];
  a.exercises.forEach((ex, ei) => {
    ex.sets.filter((s) => s.done && s.reps > 0).forEach((s, si) => {
      sets.push({ id: s.id, exercise_id: ex.exercise_id, ex_order: ei, set_order: si, weight: Number(s.weight) || 0, reps: Number(s.reps), done: true });
    });
  });
  const w = {
    id: a.id, started_at: a.started_at, ended_at: now(),
    title: (a.title || '').trim() || autoTitle(a), notes: (a.notes || '').trim(), routine_id: a.routine_id || null,
    bodyweight: S.user.bodyweight || null, deleted: false, updated_at: now(), sets, _dirty: 1,
  };
  const prs = C.prsInWorkout(S.workouts, w, S.exMap, bwNow());
  const ok = await confirmDialog({
    title: '¿Terminar entrenamiento?',
    body: `${C.fmtDuration(w.ended_at - w.started_at)} · ${sets.length} series · ${C.kg(C.volumeOf(sets))} de volumen${prs ? ` · ${prs} récord${prs > 1 ? 's' : ''} 🏆` : ''}`,
    ok: 'Guardar', cancel: 'Seguir',
  });
  if (!ok) return;
  S.workouts.push(w);
  await db.put('workouts', w);
  S.active = null;
  S.rest = null;
  await db.del('kv', 'active');
  go('historial');
  toast(prs ? `¡Entrenamiento guardado con ${prs} récord${prs > 1 ? 's' : ''}! 🏆` : '¡Entrenamiento guardado! 💪', 'ok');
  if (prs) confetti();
  sync();
}

function autoTitle(a) {
  const muscles = [...new Set(a.exercises.map((e) => S.exMap.get(e.exercise_id)?.muscle).filter(Boolean))].slice(0, 2);
  const h = new Date(a.started_at).getHours();
  return muscles.length ? muscles.map((m) => MUSCLES[m]).join(' y ') : h < 12 ? 'Entrenamiento matutino' : h < 19 ? 'Entrenamiento de tarde' : 'Entrenamiento nocturno';
}

async function discardWorkout(skipConfirm) {
  if (!skipConfirm) {
    const ok = await confirmDialog({ title: '¿Descartar entrenamiento?', body: 'Se perderán las series de esta sesión.', ok: 'Descartar', danger: true });
    if (!ok) return;
  }
  S.active = null;
  S.rest = null;
  await db.del('kv', 'active');
  go('entrenar');
}

// ======================================================================
// Atleta: historial y calendario
// ======================================================================
function viewHistory() {
  const ws = liveWorkouts();
  const streak = C.weekStreak(ws.map((w) => w.started_at));
  const cm = S.ui.calMonth || (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  S.ui.calMonth = cm;
  const d0 = new Date(cm);
  const monthWs = ws.filter((w) => { const d = new Date(w.started_at); return d.getMonth() === d0.getMonth() && d.getFullYear() === d0.getFullYear(); });
  const days = new Set(monthWs.map((w) => C.dayKey(w.started_at)));
  const firstDow = (d0.getDay() + 6) % 7;
  const inMonth = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const todayKey = C.dayKey(now());
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<button class="out" tabindex="-1" aria-hidden="true"></button>');
  for (let d = 1; d <= inMonth; d++) {
    const k = `${d0.getFullYear()}-${d0.getMonth()}-${d}`;
    cells.push(`<button class="${days.has(k) ? 'has' : ''} ${k === todayKey ? 'today' : ''} ${S.ui.calSel === k ? 'sel' : ''}" data-a="cal-day" data-to="${k}" aria-label="${d}">${d}</button>`);
  }
  const filtered = S.ui.calSel ? ws.filter((w) => C.dayKey(w.started_at) === S.ui.calSel) : ws;
  const shown = filtered.slice(0, S.ui.histLimit);
  const commentsBy = new Map();
  S.comments.forEach((c) => commentsBy.set(c.workout_id, (commentsBy.get(c.workout_id) || 0) + 1));
  return `<div class="stack">
    <h1 style="margin-top:6px">Historial</h1>
    <div class="grid-3">
      <div class="stat"><b class="ember">${streak}</b><span>semanas de racha</span></div>
      <div class="stat"><b>${monthWs.length}</b><span>este mes</span></div>
      <div class="stat"><b>${ws.length}</b><span>en total</span></div>
    </div>
    <div class="card">
      <div class="cal-head"><button class="icon-btn plain" data-a="cal-move" data-to="-1" aria-label="Mes anterior">${ICON.left}</button>
        <b>${esc(cap(C.fmtDate(cm, { month: 'long', year: 'numeric' })))}</b>
        <button class="icon-btn plain" data-a="cal-move" data-to="1" aria-label="Mes siguiente">${ICON.right}</button></div>
      <div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}${cells.join('')}</div>
    </div>
    <div class="section-title"><h2>${S.ui.calSel ? 'Ese día' : 'Entrenamientos'}</h2>${S.ui.calSel ? '<button class="btn sm ghost" data-a="cal-clear">Ver todos</button>' : ''}</div>
    ${shown.length ? `<div class="stack-sm">${shown.map((w) => {
      const vol = C.volumeOf(C.doneSets(w));
      const n = C.groupByExercise(w).length;
      return `<button class="card tight link" data-a="open-workout" data-id="${esc(w.id)}"><div class="row">
        <div class="grow"><b>${esc(w.title || 'Entrenamiento')}</b>
          <p class="mute small">${esc(C.fmtDate(w.started_at, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${C.fmtDuration((w.ended_at || w.started_at) - w.started_at)} · ${n} ejerc. · ${C.kg(vol)}</p></div>
        ${commentsBy.get(w.id) ? `<span class="badge ember">${ICON.msg.replace('<svg', '<svg width="13" height="13"')} ${commentsBy.get(w.id)}</span>` : ''}
        ${w._dirty ? '<span class="badge">Pendiente</span>' : ''}
        <span class="chev mute">${ICON.right}</span></div></button>`;
    }).join('')}</div>
    ${filtered.length > shown.length ? `<button class="btn block ghost" data-a="hist-more">Ver más</button>` : ''}`
      : `<div class="empty"><div class="big">📅</div><b>${S.ui.calSel ? 'Sin entrenamientos ese día' : 'Aún no hay entrenamientos'}</b>${S.ui.calSel ? '' : 'Tus sesiones aparecerán aquí.'}</div>`}
  </div>`;
}

function workoutDetailHtml(w, exMap, comments, { coach = false } = {}) {
  const groups = C.groupByExercise({ sets: C.doneSets(w) });
  return `<p class="mute small">${esc(C.fmtDateLong(w.started_at))} · ${C.fmtDuration((w.ended_at || w.started_at) - w.started_at)} · ${C.kg(C.volumeOf(C.doneSets(w)))}</p>
    <div style="margin-top:14px">${groups.map((g) => `<div class="wd-ex"><b>${esc(exName(g.exercise_id, exMap))}</b>
      <div class="wd-sets">${g.sets.map((s) => `<span>${C.num(s.weight)} kg × ${s.reps}</span>`).join('')}</div></div>`).join('')}</div>
    ${w.notes ? `<div class="card tight" style="margin-top:14px"><span class="upper">Notas</span><p style="margin-top:4px;white-space:pre-wrap">${esc(w.notes)}</p></div>` : ''}
    <div class="stack-sm wd-comments" style="margin-top:14px">${comments.map((c) => `<div class="comment"><div class="who">💬 ${esc(c.coach_name || 'Tu entrenador')} · ${esc(C.fmtDate(c.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</div>${esc(c.body)}</div>`).join('')}</div>
    ${coach ? `<form class="stack-sm" style="margin-top:12px" data-comment-for="${esc(w.id)}">
      <textarea class="input" name="body" maxlength="1000" placeholder="Escribe un comentario para tu alumno…" required></textarea>
      <button class="btn primary block" type="submit">${ICON.msg} Enviar comentario</button></form>` : ''}`;
}

function openWorkout(id) {
  const w = S.workouts.find((x) => x.id === id);
  if (!w) return;
  const comments = S.comments.filter((c) => c.workout_id === id).sort((a, b) => a.created_at - b.created_at);
  const s = openSheet(w.title || 'Entrenamiento', workoutDetailHtml(w, S.exMap, comments) + `
    <div class="grid-2" style="margin-top:20px">
      <button class="btn" data-x="repeat" ${S.active ? 'disabled' : ''}>${ICON.refresh} Repetir</button>
      <button class="btn danger" data-x="delete">${ICON.trash} Eliminar</button>
    </div>`);
  s.body.querySelector('[data-x="repeat"]').onclick = () => { s.close(); repeatWorkout(id); };
  s.body.querySelector('[data-x="delete"]').onclick = async () => {
    s.close();
    const ok = await confirmDialog({ title: '¿Eliminar entrenamiento?', body: 'Esta acción no se puede deshacer.', ok: 'Eliminar', danger: true });
    if (!ok) return;
    w.deleted = true; w.updated_at = now(); w._dirty = 1; w.sets = [];
    await db.put('workouts', w);
    render();
    toast('Entrenamiento eliminado');
    sync();
  };
}

function repeatWorkout(id) {
  const w = S.workouts.find((x) => x.id === id);
  if (!w) return;
  const exercises = C.groupByExercise({ sets: C.doneSets(w) }).map((g) => makeExercise(g.exercise_id, { sets: g.sets.length }));
  startWorkout({ title: w.title, exercises });
}

// ======================================================================
// Progreso: rangos, gráficas y récords (reutilizado por el entrenador)
// ======================================================================
const chartQueue = [];
function mountCharts() {
  while (chartQueue.length) {
    const { id, points, unit } = chartQueue.shift();
    const cv = document.getElementById(id);
    if (cv) S.charts.push(lineChart(cv, points, { unit, format: (v) => C.num(v) }));
  }
}

function progressHtml(workouts, exMap, bodyweight, { prefix = 'p', allowBwEdit = false } = {}) {
  const ranks = C.muscleRanks(workouts, exMap, bodyweight);
  const freq = new Map();
  for (const w of workouts) if (!w.deleted && w.ended_at) for (const g of C.groupByExercise(w)) freq.set(g.exercise_id, (freq.get(g.exercise_id) || 0) + 1);
  const exList = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  let sel = S.ui.progEx;
  if (!sel || !freq.has(sel)) sel = exList[0];
  S.ui.progEx = sel;
  const metric = S.ui.progMetric;
  const sessions = sel ? C.exerciseSessions(workouts, sel, exMap, bodyweight) : [];
  const points = sessions.map((s) => ({ x: s.date, y: metric === 'e1rm' ? s.best : metric === 'max' ? s.maxWeight : s.volume }));
  const chartId = `${prefix}-chart`;
  chartQueue.push({ id: chartId, points, unit: 'kg' });
  const prs = C.personalRecords(workouts, exMap, bodyweight).slice(0, 12);
  const first = sessions[0], last = sessions[sessions.length - 1];
  const gain = first && last && first.best ? ((last.best - first.best) / first.best) * 100 : 0;

  return `
    <div class="section-title"><h2>Rangos por grupo muscular</h2></div>
    ${!bodyweight ? `<div class="banner warn">Agrega el peso corporal para calcular los rangos.${allowBwEdit ? ' <button class="btn sm" data-a="nav" data-to="perfil">Ir a perfil</button>' : ''}</div>` : ''}
    <div class="ranks">${ranks.map((r) => `<div class="rank ${RANK_CLASS(r.rankIndex)}">
      <div class="row between">${GEM(r.rankIndex)}<span class="m">${esc(MUSCLES[r.muscle])}</span></div>
      <b>${esc(r.rank)}</b>
      <span class="m">${r.rankIndex >= 0 ? `${r.ratio.toFixed(2)}× peso corporal` : 'Registra un ejercicio'}</span>
      <div class="bar"><i data-w="${Math.round(r.progress * 100)}"></i></div>
      <p class="hint tiny">${r.nextRank ? `${C.kg(r.neededKg)} más para ${esc(r.nextRank)}` : r.rankIndex === 4 ? 'Rango máximo 👑' : ''}</p>
    </div>`).join('')}</div>
    <p class="hint" style="margin-top:8px">Rango = 1RM estimado (fórmula de Epley) del mejor ejercicio del grupo, convertido a su levantamiento de referencia y dividido entre el peso corporal.</p>

    <div class="section-title"><h2>Progreso por ejercicio</h2></div>
    ${exList.length ? `<div class="card">
      <select class="input" data-a-change="prog-ex" aria-label="Ejercicio">${exList.map((id) => `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(exName(id, exMap))}</option>`).join('')}</select>
      <div class="seg" style="margin-top:10px">${[['e1rm', '1RM est.'], ['max', 'Peso máx.'], ['vol', 'Volumen']].map(([k, l]) => `<button data-a="prog-metric" data-to="${k}" class="${metric === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="chart-box"><canvas id="${chartId}" role="img" aria-label="Gráfica de progreso"></canvas></div>
      <div class="grid-3" style="margin-top:10px">
        <div class="stat"><b>${C.num(Math.max(0, ...sessions.map((s) => s.best)))}</b><span>mejor 1RM est.</span></div>
        <div class="stat"><b>${sessions.length}</b><span>sesiones</span></div>
        <div class="stat"><b class="${gain >= 0 ? 'ok' : 'bad'}">${gain >= 0 ? '+' : ''}${C.num(gain, 0)}%</b><span>desde el inicio</span></div>
      </div></div>` : `<div class="empty"><div class="big">📈</div><b>Sin datos todavía</b>Tus gráficas aparecerán al registrar entrenamientos.</div>`}

    ${prs.length ? `<div class="section-title"><h2>Récords personales</h2></div>
      <div class="card tight list">${prs.map((p) => `<div class="list-item"><span class="ember">${ICON.trophy.replace('<svg', '<svg width="20" height="20"')}</span>
        <div class="grow"><b>${esc(exName(p.exercise_id, exMap))}</b><p class="mute small">${exMap.get(p.exercise_id)?.bw ? `Peso corporal${p.weight ? ` + ${C.num(p.weight)} kg` : ''}` : `${C.num(p.weight)} kg`} × ${p.reps} · ${esc(C.fmtDate(p.date))}</p></div>
        <span class="num"><b>${C.num(p.e1rm)}</b> <span class="mute small">kg</span></span></div>`).join('')}</div>` : ''}`;
}

function viewProgress() {
  return `<h1 style="margin-top:6px">Progreso</h1>${progressHtml(liveWorkouts(), S.exMap, S.user.bodyweight, { allowBwEdit: true })}`;
}

// ======================================================================
// Perfil (atleta y entrenador)
// ======================================================================
function viewProfile() {
  const u = S.user;
  if (!isCoach() && S.myCoach === undefined) loadMyCoach();
  return `<div class="stack">
    <div class="row" style="margin-top:6px"><div class="avatar">${esc(initials(u.name))}</div>
      <div class="grow"><h1>${esc(u.name)}</h1><p class="mute small">${esc(u.email)} · ${isCoach() ? 'Entrenador' : 'Atleta'}</p></div></div>

    ${isCoach() ? '' : `<div class="card"><h3>Mis datos</h3>
      <form id="profile-form" class="stack" style="margin-top:12px">
        <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(u.name)}" maxlength="60" required></label>
        <label class="field"><span>Objetivo</span><select class="input" name="goal">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${u.goal === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
        <div class="grid-2">
          <label class="field"><span>Días / semana</span><select class="input" name="days_per_week">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option ${u.days_per_week === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="field"><span>Peso corporal (kg)</span><input class="input" name="bodyweight" inputmode="decimal" value="${esc(u.bodyweight ?? '')}" maxlength="5"></label>
        </div>
        <label class="field"><span>Descanso entre series (segundos)</span><input class="input" name="rest" inputmode="numeric" value="${esc(defaultRest())}" maxlength="3"></label>
        <button class="btn primary block" type="submit">Guardar cambios</button>
      </form></div>

      <div class="card"><h3>Mi entrenador</h3>${coachLinkHtml()}</div>`}

    ${isCoach() ? `<div class="card"><h3>Mi cuenta</h3>
      <form id="profile-form" class="stack" style="margin-top:12px">
        <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(u.name)}" maxlength="60" required></label>
        <button class="btn primary block" type="submit">Guardar</button></form></div>` : ''}

    <div class="card tight list">
      <button class="list-item" data-a="change-pw"><span class="mute">${ICON.key}</span><span class="grow">Cambiar contraseña</span><span class="chev">${ICON.right}</span></button>
      ${isCoach() ? '' : `<button class="list-item" data-a="export"><span class="mute">${ICON.download}</span><span class="grow">Exportar mis datos (JSON)</span><span class="chev">${ICON.right}</span></button>`}
      <button class="list-item" data-a="sync-now"><span class="mute">${ICON.refresh}</span><span class="grow">Sincronizar ahora</span><span class="mute small">${S.sync.last ? esc(C.fmtDate(S.sync.last, { hour: 'numeric', minute: '2-digit' })) : '—'}</span></button>
      <button class="list-item" data-a="logout"><span class="bad">${ICON.logout}</span><span class="grow bad">Cerrar sesión</span></button>
    </div>
    <button class="btn ghost danger block sm" data-a="delete-account">Eliminar mi cuenta</button>
    <p class="hint" style="text-align:center">Forja v${APP_VERSION}</p>
  </div>`;
}

function coachLinkHtml() {
  if (S.myCoach === undefined) return '<div class="spinner"></div>';
  if (S.myCoach) {
    return `<div class="row" style="margin-top:12px"><div class="avatar">${esc(initials(S.myCoach.name))}</div>
      <div class="grow"><b>${esc(S.myCoach.name)}</b><p class="mute small">Vinculado ${esc(C.relDays(S.myCoach.accepted_at))}. Puede ver tu progreso y dejarte comentarios.</p></div></div>
      <button class="btn block danger" style="margin-top:12px" data-a="leave-coach">Desvincularme</button>`;
  }
  return `<p class="mute small" style="margin-top:6px">Pídele a tu entrenador su código de vínculo de 8 caracteres. Solo él podrá ver tus entrenamientos.</p>
    <form id="link-form" class="row" style="margin-top:12px">
      <input class="input grow" name="code" placeholder="ABCD2345" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Código de vínculo">
      <button class="btn primary" type="submit">${ICON.link} Vincular</button></form>
    ${!navigator.onLine && !IS_LOCAL ? '<p class="hint" style="margin-top:8px">Necesitas conexión para vincularte.</p>' : ''}
    ${IS_LOCAL ? '<p class="hint" style="margin-top:8px">Modo demo: crea un código desde una cuenta de entrenador en este mismo teléfono.</p>' : ''}`;
}

async function loadMyCoach() {
  const cached = await db.get('cache', 'myCoach');
  S.myCoach = cached === undefined ? undefined : cached;
  try {
    const r = await api('/coach/link');
    S.myCoach = r.coach;
    await db.put('cache', r.coach, 'myCoach');
  } catch { if (S.myCoach === undefined) S.myCoach = null; }
  if (route().tab === 'perfil') softRender();
}

function openChangePassword() {
  const s = openSheet('Cambiar contraseña', `<form class="stack" id="pw-form">
    <input class="input" type="password" name="current" placeholder="Contraseña actual" autocomplete="current-password" maxlength="128" required>
    <input class="input" type="password" name="new" placeholder="Nueva contraseña (8+, letras y números)" autocomplete="new-password" maxlength="128" required>
    <input class="input" type="password" name="new2" placeholder="Repite la nueva contraseña" autocomplete="new-password" maxlength="128" required>
    <p class="error-msg" id="pw-err"></p>
    <p class="hint">Por seguridad se cerrará la sesión en tus otros dispositivos.</p>
    <button class="btn primary block" type="submit">Cambiar contraseña</button></form>`);
  s.body.querySelector('#pw-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const err = s.body.querySelector('#pw-err');
    if (f.get('new') !== f.get('new2')) { err.textContent = 'Las contraseñas no coinciden'; return; }
    const btn = ev.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await api('/auth/password', { method: 'POST', body: { current: f.get('current'), new: f.get('new') } });
      s.close();
      toast('Contraseña actualizada', 'ok');
    } catch (e) { err.textContent = e.message; btn.disabled = false; }
  };
}

function openDeleteAccount() {
  const s = openSheet('Eliminar cuenta', `<form class="stack" id="del-form">
    <p class="mute">Se borrarán para siempre tu cuenta, entrenamientos, vínculos y comentarios. Exporta tus datos antes si los quieres conservar.</p>
    <input class="input" type="password" name="password" placeholder="Confirma con tu contraseña" autocomplete="current-password" maxlength="128" required>
    <p class="error-msg" id="del-err"></p>
    <button class="btn danger block" type="submit">Eliminar definitivamente</button></form>`);
  s.body.querySelector('#del-form').onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      await api('/auth/delete', { method: 'POST', body: { password: new FormData(ev.target).get('password') } });
      s.close();
      await db.clearAll();
      S.token = null; setToken(null); S.user = null;
      render();
      toast('Cuenta eliminada');
    } catch (e) { s.body.querySelector('#del-err').textContent = e.message; }
  };
}

function exportData() {
  const data = {
    app: 'Forja', version: APP_VERSION, exported_at: new Date().toISOString(),
    user: S.user,
    workouts: liveWorkouts().map((w) => ({ ...stripLocal(w), sets: w.sets.map((s) => ({ ...s, exercise: exName(s.exercise_id) })) })),
    custom_exercises: S.custom.filter((e) => !e.deleted).map(stripLocal),
    comments: S.comments,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forja-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Datos exportados', 'ok');
}

// ======================================================================
// Entrenador: alumnos
// ======================================================================
async function loadCoachData(force = false) {
  if (S.coach.athletes && !force) return;
  if (!S.coach.athletes) {
    S.coach.athletes = (await db.get('cache', 'athletes')) || null;
    S.coach.invites = (await db.get('cache', 'invites')) || [];
  }
  try {
    const [a, i] = await Promise.all([api(`/coach/athletes?tz=${new Date().getTimezoneOffset()}`), api('/coach/invites')]);
    S.coach.athletes = a.athletes;
    S.coach.invites = i.invites;
    S.coach.offline = false;
    await db.put('cache', a.athletes, 'athletes');
    await db.put('cache', i.invites, 'invites');
  } catch (e) {
    S.coach.offline = true;
    S.coach.athletes ||= [];
    if (!(e instanceof ApiError && e.offline)) toast(e.message, 'bad');
  }
  softRender();
}

function viewCoachHome() {
  if (!S.coach.athletes) { loadCoachData(); return '<div class="spinner"></div>'; }
  const list = S.coach.athletes;
  const inactive = list.filter((a) => a.inactive).length;
  return `<div class="stack">
    <div class="row between" style="margin-top:6px"><div><p class="mute small">Panel de entrenador</p><h1>Mis alumnos</h1></div>
      <button class="icon-btn" data-a="coach-refresh" aria-label="Actualizar">${ICON.refresh}</button></div>
    ${S.coach.offline ? '<div class="banner warn">Sin conexión: mostrando los últimos datos guardados.</div>' : ''}
    <div class="grid-3">
      <div class="stat"><b>${list.length}</b><span>alumnos</span></div>
      <div class="stat"><b class="ok">${list.filter((a) => a.workouts_7d > 0).length}</b><span>activos 7 días</span></div>
      <div class="stat"><b class="${inactive ? 'bad' : ''}">${inactive}</b><span>inactivos</span></div>
    </div>
    <div class="card hero"><div class="row"><div class="grow"><h3>Invita a un alumno</h3><p class="mute small">Genera un código y compártelo. Tu alumno lo acepta desde su perfil.</p></div></div>
      <button class="btn primary block" style="margin-top:12px" data-a="new-invite">${ICON.link} Generar código de vínculo</button>
      ${S.coach.invites.length ? `<div class="list" style="margin-top:10px">${S.coach.invites.map((i) => `<div class="list-item">
        <code class="grow ember" style="font-weight:800;letter-spacing:.12em">${esc(i.code)}</code>
        <span class="mute small">vence ${esc(C.fmtDate(i.expires_at))}</span>
        <button class="icon-btn plain" data-a="copy-code" data-to="${esc(i.code)}" aria-label="Copiar">${ICON.copy}</button>
        <button class="icon-btn plain" data-a="del-invite" data-to="${esc(i.code)}" aria-label="Eliminar código">${ICON.trash}</button></div>`).join('')}</div>` : ''}
    </div>
    ${list.length ? `<div class="stack-sm">${list.map((a) => `<button class="card link athlete-card" data-a="nav" data-to="alumno/${esc(a.id)}">
      <div class="row"><div class="avatar">${esc(initials(a.name))}</div>
        <div class="grow"><b>${esc(a.name)}</b><p class="mute small">Último: ${esc(C.relDays(a.last_workout))} · ${a.workouts_7d} esta semana</p></div>
        ${a.inactive ? `<span class="badge bad">Inactivo${a.last_workout ? ` ${Math.floor((now() - a.last_workout) / 864e5)} d` : ''}</span>` : `<span class="badge ember">${ICON.flame.replace('<svg', '<svg width="13" height="13"')} ${a.streak} sem</span>`}
      </div>
      ${a.recent_prs.length ? `<div class="prs">${a.recent_prs.slice(0, 3).map((p) => `<span class="badge ok">🏆 ${esc(p.name)} ${C.num(p.e1rm)} kg</span>`).join('')}</div>` : ''}
    </button>`).join('')}</div>` : `<div class="empty"><div class="big">👥</div><b>Aún no tienes alumnos</b>Genera un código y compártelo con tu primer alumno.</div>`}
  </div>`;
}

async function newInvite() {
  try {
    const r = await api('/coach/invites', { method: 'POST', body: {} });
    S.coach.invites.unshift(r);
    const s = openSheet('Código de vínculo', `<div class="code-box">${esc(r.code)}</div>
      <p class="mute small" style="margin-top:12px;text-align:center">Válido por 7 días y para un solo alumno. Tu alumno lo escribe en <b>Perfil → Mi entrenador</b>.</p>
      <div class="grid-2" style="margin-top:16px"><button class="btn" data-x="copy">${ICON.copy} Copiar</button><button class="btn primary" data-x="share">${ICON.share} Compartir</button></div>`);
    s.body.querySelector('[data-x=copy]').onclick = () => copyText(r.code);
    s.body.querySelector('[data-x=share]').onclick = async () => {
      const text = `Únete a mi equipo en Forja con el código ${r.code} (Perfil → Mi entrenador).`;
      if (navigator.share) { try { await navigator.share({ title: 'Forja', text }); } catch { /* cancelado */ } } else copyText(text);
    };
    render();
  } catch (e) { toast(e.message, 'bad'); }
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado', 'ok'); } catch { toast('No se pudo copiar', 'bad'); }
}

async function loadAthlete(id) {
  const key = `athlete:${id}`;
  if (!S.coach.detail[id]) S.coach.detail[id] = (await db.get('cache', key)) || { loading: true };
  try {
    const d = await api(`/coach/athletes/${encodeURIComponent(id)}`);
    S.coach.detail[id] = d;
    await db.put('cache', d, key);
  } catch (e) {
    if (S.coach.detail[id].loading) S.coach.detail[id] = { error: e.message };
    else toast('Sin conexión: datos guardados', '');
  }
  if (route().id === id) softRender();
}

function viewAthlete(id) {
  const d = S.coach.detail[id];
  if (!d) { loadAthlete(id); return '<div class="spinner"></div>'; }
  if (d.loading) return '<div class="spinner"></div>';
  if (d.error) return `<button class="back" data-a="nav" data-to="alumnos">${ICON.left} Alumnos</button><div class="empty"><b>No se pudo cargar</b>${esc(d.error)}</div>`;
  const exMap = new Map(EXERCISES.map((e) => [e.id, e]));
  d.exercises.forEach((e) => exMap.set(e.id, { ...e, factor: 0 }));
  const commentsBy = (wid) => d.comments.filter((c) => c.workout_id === wid).map((c) => ({ ...c, coach_name: S.user.name }));
  const ws = d.workouts.filter((w) => !w.deleted).sort((a, b) => b.started_at - a.started_at);
  const a = d.athlete;
  const streak = C.weekStreak(ws.map((w) => w.started_at));
  return `<button class="back" data-a="nav" data-to="alumnos">${ICON.left} Alumnos</button>
    <div class="row"><div class="avatar">${esc(initials(a.name))}</div><div class="grow"><h1>${esc(a.name)}</h1>
      <p class="mute small">${esc(GOALS[a.goal]?.label || 'Sin objetivo')} · ${a.days_per_week || '—'} días/sem · ${a.bodyweight ? C.kg(a.bodyweight) : 'sin peso'}</p></div></div>
    <div class="banner" style="margin-top:12px">${ICON.eye.replace('<svg', '<svg width="18" height="18"')} Vista de solo lectura</div>
    <div class="grid-3" style="margin-top:12px">
      <div class="stat"><b class="ember">${streak}</b><span>sem. de racha</span></div>
      <div class="stat"><b>${ws.filter((w) => w.started_at > now() - 30 * 864e5).length}</b><span>últimos 30 días</span></div>
      <div class="stat"><b>${ws.length}</b><span>en total</span></div>
    </div>
    ${progressHtml(ws.map((w) => ({ ...w, ended_at: w.ended_at || w.started_at })), exMap, a.bodyweight, { prefix: 'c' })}
    <div class="section-title"><h2>Entrenamientos</h2></div>
    ${ws.length ? `<div class="stack-sm">${ws.slice(0, 40).map((w) => `<details class="card tight"><summary class="row" style="list-style:none;cursor:pointer">
        <div class="grow"><b>${esc(w.title || 'Entrenamiento')}</b><p class="mute small">${esc(C.fmtDate(w.started_at, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${C.groupByExercise(w).length} ejercicios</p></div>
        ${commentsBy(w.id).length ? `<span class="badge ember">💬 ${commentsBy(w.id).length}</span>` : ''}<span class="chev mute">${ICON.right}</span></summary>
        <div style="margin-top:12px">${workoutDetailHtml(w, exMap, commentsBy(w.id), { coach: true })}</div></details>`).join('')}</div>`
      : '<div class="empty"><b>Sin entrenamientos aún</b></div>'}
    <button class="btn ghost danger block" style="margin-top:24px" data-a="unlink-athlete" data-id="${esc(a.id)}">Desvincular alumno</button>`;
}

// ======================================================================
// Entrenador: rutinas
// ======================================================================
async function loadRoutines() {
  if (!S.coach.routines) S.coach.routines = (await db.get('cache', 'routines')) || null;
  try {
    const r = await api('/routines');
    S.coach.routines = r.routines;
    await db.put('cache', r.routines, 'routines');
  } catch (e) { S.coach.routines ||= []; if (!(e instanceof ApiError && e.offline)) toast(e.message, 'bad'); }
  softRender();
}

function viewRoutines() {
  if (!S.coach.routines) { loadRoutines(); return '<div class="spinner"></div>'; }
  if (!S.coach.athletes) loadCoachData();
  return `<div class="stack">
    <div class="row between" style="margin-top:6px"><h1>Rutinas</h1><button class="btn sm primary" data-a="nav" data-to="rutina/nueva">${ICON.plus} Nueva</button></div>
    ${S.coach.routines.length ? `<div class="stack-sm">${S.coach.routines.map((r) => `<button class="card link" data-a="nav" data-to="rutina/${esc(r.id)}">
      <div class="row"><div class="grow"><h3>${esc(r.name)}</h3><p class="mute small">${r.items.length} ejercicios · ${r.items.reduce((a, i) => a + i.sets, 0)} series</p></div>
      <span class="badge ${r.athlete_ids.length ? 'ember' : ''}">${ICON.users.replace('<svg', '<svg width="13" height="13"')} ${r.athlete_ids.length}</span></div>
      <p class="mute small" style="margin-top:8px">${r.items.slice(0, 4).map((i) => esc(exName(i.exercise_id))).join(' · ')}${r.items.length > 4 ? '…' : ''}</p></button>`).join('')}</div>`
      : `<div class="empty"><div class="big">📋</div><b>Crea tu primera rutina</b>Asígnala a uno o varios alumnos y ellos la ejecutan registrando cada serie.</div>`}
  </div>`;
}

let routineDraft = null;
function viewRoutineEditor(id) {
  if (!S.coach.routines) { loadRoutines(); return '<div class="spinner"></div>'; }
  if (!S.coach.athletes) loadCoachData();
  if (!routineDraft || routineDraft._for !== id) {
    const src = id === 'nueva' ? null : S.coach.routines.find((r) => r.id === id);
    if (id !== 'nueva' && !src) return `<button class="back" data-a="nav" data-to="rutinas">${ICON.left} Rutinas</button><div class="empty"><b>Rutina no encontrada</b></div>`;
    routineDraft = src ? JSON.parse(JSON.stringify({ ...src, _for: id })) : { _for: id, name: '', notes: '', items: [], athlete_ids: [] };
  }
  const r = routineDraft;
  const athletes = S.coach.athletes || [];
  return `<button class="back" data-a="nav" data-to="rutinas">${ICON.left} Rutinas</button>
    <h1>${id === 'nueva' ? 'Nueva rutina' : 'Editar rutina'}</h1>
    <div class="stack" style="margin-top:14px">
      <label class="field"><span>Nombre</span><input class="input" data-rd="name" value="${esc(r.name)}" maxlength="60" placeholder="Ej. Torso fuerza"></label>
      <label class="field"><span>Indicaciones</span><textarea class="input" data-rd="notes" maxlength="1000" placeholder="Descansos, técnica, progresión…">${esc(r.notes)}</textarea></label>
      <div class="card">
        <div class="ri-head"><span>Ejercicio</span><span>Series</span><span>Reps</span><span>Kg</span><span></span></div>
        ${r.items.map((it, k) => `<div class="routine-item">
          <span class="lbl">${esc(exName(it.exercise_id))}</span>
          <input class="set-in" inputmode="numeric" data-ri="sets" data-k="${k}" value="${esc(it.sets)}" maxlength="2" aria-label="Series">
          <input class="set-in" inputmode="numeric" data-ri="reps" data-k="${k}" value="${esc(it.reps)}" maxlength="3" aria-label="Repeticiones">
          <input class="set-in" inputmode="decimal" data-ri="weight" data-k="${k}" value="${esc(it.weight || '')}" placeholder="—" maxlength="6" aria-label="Peso">
          <button class="icon-btn plain" data-a="ri-del" data-k="${k}" aria-label="Quitar">${ICON.x}</button></div>`).join('') || '<p class="mute small" style="padding:10px 0">Agrega ejercicios de la biblioteca.</p>'}
        <button class="btn block" style="margin-top:8px" data-a="ri-add">${ICON.plus} Añadir ejercicios</button>
      </div>
      <button class="btn primary block" data-a="routine-save">Guardar rutina</button>
      ${id !== 'nueva' ? `<div class="card"><h3>Asignar a alumnos</h3>
        ${athletes.length ? athletes.map((a) => `<label class="check"><input type="checkbox" data-assign="${esc(a.id)}" ${r.athlete_ids.includes(a.id) ? 'checked' : ''}> ${esc(a.name)}</label>`).join('') : '<p class="mute small" style="margin-top:6px">Primero vincula alumnos.</p>'}
        ${athletes.length ? '<button class="btn block" data-a="routine-assign" style="margin-top:6px">Guardar asignación</button>' : ''}</div>
      <button class="btn ghost danger block" data-a="routine-delete">Eliminar rutina</button>` : '<p class="hint">Después de guardarla podrás asignarla a tus alumnos.</p>'}
    </div>`;
}

async function saveRoutine() {
  const r = routineDraft;
  if (r.name.trim().length < 2) { toast('Ponle un nombre a la rutina', 'bad'); return; }
  if (!r.items.length) { toast('Agrega al menos un ejercicio', 'bad'); return; }
  const body = { name: r.name, notes: r.notes, items: r.items.map((i) => ({ exercise_id: i.exercise_id, sets: Number(i.sets) || 3, reps: Number(i.reps) || 10, weight: parseNum(i.weight) || 0 })) };
  try {
    if (r._for === 'nueva') {
      const res = await api('/routines', { method: 'POST', body });
      S.coach.routines.unshift(res);
      routineDraft = null;
      toast('Rutina creada. Ahora asígnala.', 'ok');
      go(`rutina/${res.id}`);
    } else {
      const res = await api(`/routines/${encodeURIComponent(r._for)}`, { method: 'PUT', body });
      const i = S.coach.routines.findIndex((x) => x.id === r._for);
      S.coach.routines[i] = { ...S.coach.routines[i], ...res };
      toast('Rutina guardada', 'ok');
    }
  } catch (e) { toast(e.message, 'bad'); }
}

// ======================================================================
// Pantalla de debug (5 toques al logo)
// ======================================================================
let logoTaps = [];
function onLogoTap() {
  const t = now();
  logoTaps = logoTaps.filter((x) => t - x < 2000);
  logoTaps.push(t);
  if (logoTaps.length >= 5) { logoTaps = []; openDebug(); }
}

async function openDebug() {
  let storage = '';
  try { const e = await navigator.storage?.estimate(); if (e) storage = `${(e.usage / 1024).toFixed(0)} KB de ${(e.quota / 1048576).toFixed(0)} MB`; } catch { /* */ }
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const errs = S.workouts.filter((w) => w._err);
  const kv = [
    ['Conexión', navigator.onLine ? 'En línea' : 'Sin conexión'],
    ['API', IS_LOCAL ? 'Modo demo (en este dispositivo)' : API_BASE],
    ['Usuario', S.user ? `${S.user.email} (${S.user.role})` : '—'],
    ['Entrenamientos locales', String(S.workouts.filter((w) => !w.deleted).length)],
    ['Pendientes de subir', String(pendingCount())],
    ['Con error de validación', String(errs.length)],
    ['Última sincronización', S.sync.last ? new Date(S.sync.last).toLocaleString('es-MX') : 'nunca'],
    ['Último error', S.sync.error || '—'],
    ['Cursor', S.sync.cursor || '—'],
    ['Entreno en curso', S.active ? 'sí' : 'no'],
    ['Almacenamiento', storage || '—'],
    ['Almacenamiento persistente', persisted ? 'sí' : 'no'],
    ['Service worker', navigator.serviceWorker?.controller ? 'activo' : 'no'],
    ['Versión', APP_VERSION],
  ];
  const s = openSheet('🛠 Debug', `<div class="card tight">${kv.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
    <div class="stack-sm" style="margin-top:14px">
      <button class="btn block" data-x="sync">${ICON.refresh} Sincronizar ahora</button>
      <button class="btn block" data-x="full">Forzar descarga completa</button>
      <button class="btn block" data-x="seed">${ICON.bolt} Cargar datos de prueba</button>
      <div id="seed-out"></div>
      <button class="btn block danger" data-x="wipe">${ICON.trash} Borrar datos locales</button>
    </div>
    <p class="hint" style="margin-top:12px">Los datos de prueba crean 1 entrenador y 2 atletas con 8 semanas de entrenamientos.${IS_LOCAL ? ' Sin servidor: “Borrar datos locales” deja la app como recién instalada.' : ' Requiere ALLOW_SEED=true en el Worker.'}</p>`);
  const b = (x) => s.body.querySelector(`[data-x="${x}"]`);
  b('sync').onclick = async () => { await sync(); s.close(); toast(S.sync.error ? `Error: ${S.sync.error}` : 'Sincronizado', S.sync.error ? 'bad' : 'ok'); };
  b('full').onclick = async () => { S.sync.cursor = ''; S.sync.csince = 0; await sync(); s.close(); toast('Descarga completa terminada', 'ok'); };
  b('wipe').onclick = async () => {
    const ok = await confirmDialog({ title: '¿Borrar datos locales?', body: `Se borrará todo lo guardado en este dispositivo y se cerrará la sesión.${pendingCount() ? ` ¡Hay ${pendingCount()} cambio(s) sin sincronizar!` : ''}`, ok: 'Borrar', danger: true });
    if (!ok) return;
    s.close();
    await db.clearAll();
    if (IS_LOCAL) { try { await api('/debug/reset', { method: 'POST', body: {} }); } catch { /* */ } }
    try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* */ }
    S.token = null; setToken(null); S.user = null; S.workouts = []; S.custom = []; S.comments = []; S.active = null;
    S.sync.cursor = ''; S.sync.csince = 0; S.sync.last = 0;
    render();
    toast('Datos locales borrados');
  };
  b('seed').onclick = async () => {
    const out = s.body.querySelector('#seed-out');
    S.switching = true; // la carga borra y recrea las cuentas demo: ignoramos 401 transitorios
    out.innerHTML = '<div class="spinner"></div>';
    try {
      const r = await api('/debug/seed', { method: 'POST', body: {}, timeout: 30000 });
      out.innerHTML = `<div class="card tight"><p class="small"><b>Listo:</b> ${r.workouts} entrenamientos, ${r.sets} series. Contraseña: <code>${esc(r.password)}</code></p>
        ${r.accounts.map((a) => `<button class="btn sm block" style="margin-top:8px" data-login="${esc(a.email)}">Entrar como ${esc(a.email)} (${esc(a.role)})</button>`).join('')}</div>`;
      out.querySelectorAll('[data-login]').forEach((btn) => {
        btn.onclick = async () => {
          try {
            S.switching = true;
            if (S.token) { try { await api('/auth/logout', { method: 'POST', body: {} }); } catch { /* sesión de cuenta demo ya borrada */ } }
            await db.clearAll();
            S.workouts = []; S.custom = []; S.comments = []; S.active = null; S.sync.cursor = ''; S.sync.csince = 0; S.sync.last = 0;
            S.coach = { athletes: null, invites: [], routines: null, detail: {}, offline: false }; S.myCoach = undefined; S.assigned = null;
            const res = await api('/auth/login', { method: 'POST', body: { email: btn.dataset.login, password: r.password } });
            await setSession(res.token, res.user);
            S.switching = false;
            s.close();
            location.hash = '';
            render();
            await sync();
            toast(`Sesión iniciada como ${res.user.name}`, 'ok');
          } catch (e) { S.switching = false; toast(e.message, 'bad'); }
        };
      });
    } catch (e) { out.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`; }
    S.switching = false;
  };
}

// ======================================================================
// Eventos (delegación: compatible con CSP estricta, sin handlers inline)
// ======================================================================
async function demoLogin(email) {
  try {
    const res = await api('/auth/login', { method: 'POST', body: { email, password: 'Forja2026demo' } });
    await setSession(res.token, res.user);
    await loadLocal();
    location.hash = '';
    render();
    await sync();
    toast(`Hola, ${res.user.name}`, 'ok');
  } catch (e) { toast(e.message, 'bad'); }
}

const ACTIONS = {
  logo: onLogoTap,
  'demo-login': (el) => demoLogin(el.dataset.to),
  nav: (el) => go(el.dataset.to),
  'auth-tab': (el) => { S.ui.authTab = el.dataset.to; render(); },
  'pick-role': (el) => { S.ui.role = el.dataset.to; $$('.role-pick button').forEach((b) => b.classList.toggle('on', b === el)); },
  'toggle-pw': (el) => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; },
  'onb-goal': (el) => { S.ui.onb.goal = el.dataset.to; render(); },
  'onb-days': (el) => { S.ui.onb.days = Number(el.dataset.to); render(); },
  'onb-back': () => { S.ui.onb.step--; render(); },
  'onb-next': () => { if (S.ui.onb.step < 2) { S.ui.onb.step++; render(); setTimeout(() => $('#onb-bw')?.focus(), 50); } else finishOnboarding(); },
  'start-empty': () => startWorkout(),
  resume: () => go('entreno'),
  repeat: (el) => repeatWorkout(el.dataset.id),
  'start-routine': (el) => {
    const r = S.assigned?.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const exercises = r.items.filter((it) => S.exMap.has(it.exercise_id)).map((it) => makeExercise(it.exercise_id, { sets: it.sets, target: it }));
    startWorkout({ title: r.name, routine_id: r.id, exercises });
  },
  'add-exercise': () => openExercisePicker((ids) => {
    ids.forEach((id) => S.active.exercises.push(makeExercise(id)));
    S.active.updated_at = now();
    saveActive();
    render();
    requestAnimationFrame(() => $$('.ex-card').pop()?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, { multi: true }),
  'toggle-set': (el) => toggleSet(Number(el.dataset.ex), Number(el.dataset.set)),
  'add-set': (el) => {
    const ex = S.active.exercises[Number(el.dataset.ex)];
    const last = ex.sets[ex.sets.length - 1];
    if (ex.sets.length >= 20) return;
    ex.sets.push(newSet(last ? { weight: last.weight !== '' ? last.weight : last.phW, reps: last.reps !== '' ? last.reps : last.phR } : null));
    saveActive();
    rerenderExercise(Number(el.dataset.ex));
  },
  'del-set': (el) => {
    const ex = S.active.exercises[Number(el.dataset.ex)];
    if (ex.sets.length > 1) { ex.sets.pop(); recomputePR(ex); saveActive(); rerenderExercise(Number(el.dataset.ex)); }
  },
  'ex-menu': (el) => {
    const i = Number(el.dataset.ex);
    const s = openSheet(exName(S.active.exercises[i].exercise_id), `<div class="stack-sm">
      <button class="btn block" data-x="up" ${i === 0 ? 'disabled' : ''}>Subir</button>
      <button class="btn block" data-x="down" ${i === S.active.exercises.length - 1 ? 'disabled' : ''}>Bajar</button>
      <button class="btn block" data-x="rest">${ICON.timer} Iniciar descanso (${C.fmtClock(defaultRest())})</button>
      <button class="btn block danger" data-x="del">${ICON.trash} Quitar ejercicio</button></div>`);
    const mv = (d) => { const a = S.active.exercises; [a[i], a[i + d]] = [a[i + d], a[i]]; saveActive(); s.close(); render(); };
    s.body.querySelector('[data-x=up]').onclick = () => mv(-1);
    s.body.querySelector('[data-x=down]').onclick = () => mv(1);
    s.body.querySelector('[data-x=rest]').onclick = () => { s.close(); startRest(); };
    s.body.querySelector('[data-x=del]').onclick = () => { S.active.exercises.splice(i, 1); saveActive(); s.close(); render(); };
  },
  'rest-adj': (el) => { if (S.rest) { S.rest.endAt += Number(el.dataset.to) * 1000; S.rest.total = Math.max(5, S.rest.total + Number(el.dataset.to)); S.rest.ended = false; tickRest(); } },
  'rest-skip': () => { S.rest = null; $('#rest')?.classList.remove('show', 'ended'); },
  finish: () => finishWorkout(),
  discard: () => discardWorkout(),
  'cal-move': (el) => { const d = new Date(S.ui.calMonth); d.setMonth(d.getMonth() + Number(el.dataset.to)); S.ui.calMonth = d.getTime(); S.ui.calSel = null; render(); },
  'cal-day': (el) => { S.ui.calSel = S.ui.calSel === el.dataset.to ? null : el.dataset.to; render(); },
  'cal-clear': () => { S.ui.calSel = null; render(); },
  'hist-more': () => { S.ui.histLimit += 30; render(); },
  'open-workout': (el) => openWorkout(el.dataset.id),
  'prog-metric': (el) => { S.ui.progMetric = el.dataset.to; render(); },
  'change-pw': openChangePassword,
  'delete-account': openDeleteAccount,
  export: exportData,
  'sync-now': async () => { if (!navigator.onLine && !IS_LOCAL) { toast('Sin conexión. Se sincronizará al volver.', 'bad'); return; } await sync(); toast(S.sync.error ? `Error: ${S.sync.error}` : 'Todo sincronizado ✓', S.sync.error ? 'bad' : 'ok'); },
  logout: () => logout(),
  'leave-coach': async () => {
    const ok = await confirmDialog({ title: '¿Desvincularte?', body: 'Tu entrenador dejará de ver tu progreso y sus rutinas asignadas desaparecerán.', ok: 'Desvincular', danger: true });
    if (!ok) return;
    try { await api('/coach/link', { method: 'DELETE' }); S.myCoach = null; S.assigned = []; await db.put('cache', null, 'myCoach'); await db.put('cache', [], 'assigned'); render(); toast('Te desvinculaste'); } catch (e) { toast(e.message, 'bad'); }
  },
  'coach-refresh': () => loadCoachData(true),
  'new-invite': newInvite,
  'copy-code': (el) => copyText(el.dataset.to),
  'del-invite': async (el) => {
    try { await api(`/coach/invites/${encodeURIComponent(el.dataset.to)}`, { method: 'DELETE' }); S.coach.invites = S.coach.invites.filter((i) => i.code !== el.dataset.to); render(); } catch (e) { toast(e.message, 'bad'); }
  },
  'unlink-athlete': async (el) => {
    const ok = await confirmDialog({ title: '¿Desvincular alumno?', body: 'Dejarás de ver su progreso. Para volver a vincularlo necesitará un código nuevo.', ok: 'Desvincular', danger: true });
    if (!ok) return;
    try { await api(`/coach/athletes/${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' }); delete S.coach.detail[el.dataset.id]; await loadCoachData(true); go('alumnos'); toast('Alumno desvinculado'); } catch (e) { toast(e.message, 'bad'); }
  },
  'ri-add': () => openExercisePicker((ids) => { ids.forEach((id) => routineDraft.items.push({ exercise_id: id, sets: 3, reps: 10, weight: '' })); render(); }, { libraryOnly: true, multi: true }),
  'ri-del': (el) => { routineDraft.items.splice(Number(el.dataset.k), 1); render(); },
  'routine-save': saveRoutine,
  'routine-assign': async () => {
    const ids = $$('[data-assign]').filter((c) => c.checked).map((c) => c.dataset.assign);
    try {
      await api(`/routines/${encodeURIComponent(routineDraft._for)}/assign`, { method: 'POST', body: { athlete_ids: ids } });
      routineDraft.athlete_ids = ids;
      const r = S.coach.routines.find((x) => x.id === routineDraft._for);
      if (r) r.athlete_ids = ids;
      toast(ids.length ? `Asignada a ${ids.length} alumno${ids.length > 1 ? 's' : ''}` : 'Asignación eliminada', 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  },
  'routine-delete': async () => {
    const ok = await confirmDialog({ title: '¿Eliminar rutina?', body: 'También se quitará de los alumnos asignados.', ok: 'Eliminar', danger: true });
    if (!ok) return;
    try { await api(`/routines/${encodeURIComponent(routineDraft._for)}`, { method: 'DELETE' }); S.coach.routines = S.coach.routines.filter((r) => r.id !== routineDraft._for); routineDraft = null; go('rutinas'); toast('Rutina eliminada'); } catch (e) { toast(e.message, 'bad'); }
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.a];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.aChange === 'prog-ex') { S.ui.progEx = el.value; render(); }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'onb-bw' && S.ui.onb) {
    S.ui.onb.bw = el.value;
    const v = parseNum(el.value);
    $('#onb-next').disabled = !(v >= 25 && v <= 350);
    return;
  }
  if (el.dataset.in && S.active) {
    const i = Number(el.dataset.ex), j = Number(el.dataset.set);
    const s = S.active.exercises[i]?.sets[j];
    if (!s) return;
    const clean = el.value.replace(el.dataset.in === 'reps' ? /[^\d]/g : /[^\d.,]/g, '');
    if (clean !== el.value) el.value = clean;
    s[el.dataset.in] = clean;
    if (s.done) { const n = parseNum(clean); if (Number.isFinite(n)) s[el.dataset.in] = n; }
    S.active.updated_at = now();
    saveActive();
    const p = C.previousSession(S.workouts, S.active.exercises[i].exercise_id, now() + 1)?.sets[j];
    const cmp = $(`#cmp-${i}-${j}`);
    if (cmp) cmp.innerHTML = `${p ? `${C.num(p.weight)}×${p.reps}` : '—'}${compareText(s, p)}`;
    return;
  }
  if (el.id === 'wk-title' && S.active) { S.active.title = el.value.slice(0, 80); saveActive(); return; }
  if (el.id === 'wk-notes' && S.active) { S.active.notes = el.value.slice(0, 2000); saveActive(); return; }
  if (el.dataset.rd && routineDraft) { routineDraft[el.dataset.rd] = el.value; return; }
  if (el.dataset.ri && routineDraft) { routineDraft.items[Number(el.dataset.k)][el.dataset.ri] = el.value.replace(/[^\d.,]/g, ''); }
});

// Enter en un input de serie → salta al siguiente
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.dataset?.in) return;
  ev.preventDefault();
  const inputs = $$('.set-in[data-in]');
  const idx = inputs.indexOf(ev.target);
  if (ev.target.dataset.in === 'reps') { $(`[data-a="toggle-set"][data-ex="${ev.target.dataset.ex}"][data-set="${ev.target.dataset.set}"]`)?.click(); }
  else inputs[idx + 1]?.focus();
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target;
  if (form.id === 'auth-form') { ev.preventDefault(); submitAuth(form); }
  else if (form.id === 'profile-form') {
    ev.preventDefault();
    const f = new FormData(form);
    const body = { name: String(f.get('name') || '').trim() };
    if (!isCoach()) {
      body.goal = f.get('goal');
      body.days_per_week = Number(f.get('days_per_week'));
      const bw = parseNum(f.get('bodyweight'));
      if (!(bw >= 25 && bw <= 350)) { toast('Peso corporal entre 25 y 350 kg', 'bad'); return; }
      body.bodyweight = bw;
      const rest = clamp(Math.round(parseNum(f.get('rest')) || 90), 10, 600);
      S.settings.rest = rest;
      await db.put('kv', S.settings, 'settings');
    }
    try {
      const r = await api('/auth/profile', { method: 'PUT', body });
      await updateUser(r.user);
      toast('Perfil actualizado', 'ok');
      render();
    } catch (e) { toast(e.message, 'bad'); }
  } else if (form.id === 'link-form') {
    ev.preventDefault();
    const code = String(new FormData(form).get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 8) { toast('El código tiene 8 caracteres', 'bad'); return; }
    try {
      const r = await api('/coach/link', { method: 'POST', body: { code } });
      S.myCoach = { ...r.coach, accepted_at: now() };
      await db.put('cache', S.myCoach, 'myCoach');
      S.assigned = null;
      render();
      confetti();
      toast(`¡Vinculado con ${r.coach.name}!`, 'ok');
    } catch (e) { toast(e.message, 'bad'); }
  } else if (form.dataset.commentFor) {
    ev.preventDefault();
    const text = String(new FormData(form).get('body') || '').trim();
    if (!text) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const c = await api('/coach/comments', { method: 'POST', body: { workout_id: form.dataset.commentFor, body: text } });
      const id = route().id;
      S.coach.detail[id]?.comments.push(c);
      form.reset();
      const box = form.parentElement.querySelector('.wd-comments');
      if (box) box.insertAdjacentHTML('beforeend', `<div class="comment"><div class="who">💬 ${esc(S.user.name)} · ahora</div>${esc(c.body)}</div>`);
      toast('Comentario enviado', 'ok');
    } catch (e) { toast(e.message, 'bad'); }
    btn.disabled = false;
  }
});

addEventListener('hashchange', () => { sheetStack.slice().forEach((s) => s.close()); window.scrollTo(0, 0); render(); });
addEventListener('scroll', () => $('#topbar')?.classList.toggle('scrolled', scrollY > 4), { passive: true });
addEventListener('online', () => { renderSyncPill(); sync(); });
addEventListener('offline', renderSyncPill);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    sync();
    if (S.active && route().tab === 'entreno') { requestWakeLock(); tickRest(); }
  } else if (S.active) {
    db.put('kv', S.active, 'active'); // guarda al salir de la app
  }
});
setInterval(() => { if (document.visibilityState === 'visible' && pendingCount()) sync(); }, 30000);
setInterval(() => { if (document.visibilityState === 'visible' && S.token) sync(); }, 5 * 60000);

// ======================================================================
// Arranque
// ======================================================================
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    S.swReg = reg;
    const notify = (w) => toast('Nueva versión disponible', '', { ms: 15000, action: 'Actualizar', onAction: () => w.postMessage('skipWaiting') });
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w); });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!refreshing) { refreshing = true; location.reload(); } });
  } catch (e) { console.warn('SW', e); }
}

async function boot() {
  registerSW();
  try { await navigator.storage?.persist?.(); } catch { /* */ }
  let session = null;
  try {
    session = await db.get('kv', 'session');
    await loadLocal();
  } catch (e) {
    console.error(e);
    toast('Tu navegador bloqueó el almacenamiento local. El modo offline no funcionará.', 'bad', { ms: 8000 });
  }
  // v1.2: en modo demo, la primera vez que abre esta versión arranca totalmente limpia
  if (IS_LOCAL) {
    try {
      if (!(await db.get('kv', 'fresh-1.2'))) {
        await db.clearAll();
        try { await api('/debug/reset-empty', { method: 'POST', body: {} }); } catch { /* */ }
        await db.put('kv', true, 'fresh-1.2');
        session = null;
        await loadLocal();
      }
    } catch { /* sin almacenamiento */ }
  }
  if (!session && !(await db.get('kv', 'lastUserId').catch(() => null))) S.ui.authTab = 'register';
  if (session?.token && session.user) {
    S.token = session.token;
    S.user = session.user;
    setToken(session.token);
    rebuildExMap();
  }
  render();
  if (S.token && (navigator.onLine || IS_LOCAL)) {
    try {
      const r = await api('/auth/me', { timeout: 8000 });
      await updateUser(r.user);
      if (!S.active || route().tab !== 'entreno') softRender();
    } catch { /* offline o servidor caído: seguimos con los datos locales */ }
    sync();
  }
}

boot();

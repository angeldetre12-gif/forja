// IndexedDB mínimo: kv (sesión/ajustes), workouts, exercises (personalizados), comments, cache (datos del entrenador)
const NAME = 'forja';
const VERSION = 1;
const STORES = { kv: null, cache: null, workouts: 'id', exercises: 'id', comments: 'id' };

// Si el navegador bloquea IndexedDB (modo incógnito estricto, vista previa embebida), usamos memoria
const memStores = Object.fromEntries(Object.keys(STORES).map((k) => [k, new Map()]));
let useMem = false;

let dbp;
function open() {
  return (dbp ||= new Promise((resolve, reject) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, keyPath ? { keyPath } : undefined);
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('IndexedDB bloqueado'));
  }));
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

async function ready() {
  if (useMem) return null;
  try { return await open(); } catch (e) { console.warn('IndexedDB no disponible, usando memoria', e); useMem = true; return null; }
}
const keyOf = (store, value, key) => (key !== undefined ? key : value[STORES[store]]);

export async function get(store, key) {
  const db = await ready();
  if (!db) return memStores[store].get(key);
  return req(db.transaction(store).objectStore(store).get(key));
}
export async function getAll(store) {
  const db = await ready();
  if (!db) return [...memStores[store].values()];
  return req(db.transaction(store).objectStore(store).getAll());
}
export async function put(store, value, key) {
  const db = await ready();
  if (!db) { memStores[store].set(keyOf(store, value, key), structuredClone(value)); return; }
  const t = db.transaction(store, 'readwrite');
  key === undefined ? t.objectStore(store).put(value) : t.objectStore(store).put(value, key);
  return done(t);
}
export async function putMany(store, values) {
  if (!values.length) return;
  const db = await ready();
  if (!db) { for (const v of values) memStores[store].set(keyOf(store, v), structuredClone(v)); return; }
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  for (const v of values) s.put(v);
  return done(t);
}
export async function del(store, key) {
  const db = await ready();
  if (!db) { memStores[store].delete(key); return; }
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(key);
  return done(t);
}
export async function clearAll() {
  const db = await ready();
  if (!db) { Object.values(memStores).forEach((m) => m.clear()); return; }
  const t = db.transaction(Object.keys(STORES), 'readwrite');
  for (const s of Object.keys(STORES)) t.objectStore(s).clear();
  return done(t);
}

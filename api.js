import { API_BASE } from './config.js';

let token = null;
let onAuthLost = () => {};

export const IS_LOCAL = API_BASE === 'local';
let localHandle = null;

export const setToken = (t) => { token = t; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  get offline() { return this.status === 0; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (n) => Math.min(8000, 400 * 2 ** n) + Math.random() * 300;

/**
 * Llamada a la API con timeout, reintentos con backoff exponencial (GET y peticiones idempotentes)
 * y manejo uniforme de errores.
 */
export async function api(path, { method = 'GET', body, timeout = 12000, retries } = {}) {
  if (IS_LOCAL) {
    // Modo demo: el "servidor" corre dentro del teléfono
    localHandle ||= (await import('./local-server.js')).handle;
    try {
      return await localHandle(path, { method, body, token });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 && token) onAuthLost(err.message);
        throw err;
      }
      throw new ApiError(500, err?.message || 'Error interno');
    }
  }
  const maxRetries = retries ?? (method === 'GET' ? 2 : 0);
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(API_BASE + path, {
        method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      });
      clearTimeout(timer);
      let data = null;
      try { data = await res.json(); } catch { /* sin cuerpo */ }
      if (!res.ok) {
        if (res.status === 401 && token) onAuthLost(data?.error);
        if ((res.status >= 500 || res.status === 429) && attempt < maxRetries && res.status !== 429) {
          await sleep(backoff(attempt));
          continue;
        }
        throw new ApiError(res.status, data?.error || `Error del servidor (${res.status})`);
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;
      if (attempt < maxRetries) { await sleep(backoff(attempt)); continue; }
      throw new ApiError(0, 'Sin conexión con el servidor');
    }
  }
}

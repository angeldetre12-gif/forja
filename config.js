// URL de tu API (Worker). Cambia la de producción después de "wrangler deploy".
// Mientras siga con "TU-SUBDOMINIO", la app funciona sin servidor: todo vive dentro del teléfono
// y arranca vacía. También puedes forzarlo con ?api=local en la URL.
const PRODUCTION_API = 'https://forja-api.TU-SUBDOMINIO.workers.dev';

const host = location.hostname;
const LOCALHOST = ['localhost', '127.0.0.1'].includes(host);
const params = new URLSearchParams(location.search);
const forced = params.get('api') || 'local'; // AI Studio: modo demo por defecto

export const API_BASE =
  forced === 'local' ? 'local'
  : LOCALHOST && forced !== 'demo' ? `http://${host}:8787`
  : PRODUCTION_API.includes('TU-SUBDOMINIO') ? 'local'
  : PRODUCTION_API;

export const APP_VERSION = '1.2.0';

/**
 * ⭐ ORION Bridge — Módulo de integración con OpenClaw
 * Conecta el servidor Express/WS con el agente ORION vía CLI y API local.
 *
 * Responsabilidades:
 *  - sendToAgent()     → enviar mensajes al agente y obtener respuestas
 *  - getMemory()       → leer MEMORY.md del workspace
 *  - sendWhatsApp()    → enviar WhatsApp via gateway de OpenClaw
 *  - listCrons()       → listar crons activos
 *  - streamResponse()  → responder via WebSocket con datos del agente
 */

'use strict';

const { exec } = require('child_process');
const fs        = require('fs');
const path      = require('path');
const util      = require('util');

// Promisificar exec para uso async/await
const execAsync = util.promisify(exec);

// ─── Configuración ───────────────────────────────────────────────────────────

const OPENCLAW_PORT      = process.env.OPENCLAW_PORT      || 3000;
const OPENCLAW_TOKEN     = process.env.OPENCLAW_TOKEN     || '';
const OPENCLAW_WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace');
const MEMORY_PATH        = path.join(OPENCLAW_WORKSPACE, 'MEMORY.md');
const OPENCLAW_BASE_URL  = `http://localhost:${OPENCLAW_PORT}`;

// Prefijo estándar para todos los logs
const TAG = '[ORION]';

/**
 * Detecta el puerto real de OpenClaw leyendo su config local.
 * Si no encuentra nada, usa el valor de .env o el default 3000.
 */
function detectOpenClawPort() {
  const configPaths = [
    path.join(process.env.HOME, '.openclaw', 'config.json'),
    path.join(process.env.HOME, '.openclaw', 'config.yaml'),
    path.join(process.env.HOME, '.openclaw', '.config'),
  ];

  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        // Buscar puerto en JSON o línea "port:"
        const matchJson = raw.match(/"port"\s*:\s*(\d+)/);
        const matchYaml = raw.match(/port:\s*(\d+)/);
        const port = matchJson?.[1] || matchYaml?.[1];
        if (port) {
          console.log(`${TAG} Puerto OpenClaw detectado en config: ${port}`);
          return parseInt(port, 10);
        }
      } catch (_) { /* ignorar errores de lectura */ }
    }
  }
  return parseInt(OPENCLAW_PORT, 10);
}

const RESOLVED_PORT = detectOpenClawPort();
const BASE_URL      = `http://localhost:${RESOLVED_PORT}`;

// ─── Headers comunes para peticiones a OpenClaw ──────────────────────────────

function buildHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (OPENCLAW_TOKEN) h['Authorization'] = `Bearer ${OPENCLAW_TOKEN}`;
  return h;
}

// ─── sendToAgent ─────────────────────────────────────────────────────────────

/**
 * Envía un mensaje al agente ORION y retorna la respuesta en texto.
 * Intenta primero la API HTTP local; si falla, usa el CLI `openclaw`.
 *
 * @param {string} message - Mensaje a enviar al agente
 * @returns {Promise<string>} - Respuesta del agente
 */
async function sendToAgent(message) {
  console.log(`${TAG} sendToAgent →`, message.slice(0, 80));

  // Intento 1: API HTTP local de OpenClaw
  try {
    // Importación dinámica de node-fetch (CommonJS compat)
    const fetch = (await import('node-fetch')).default;

    const res = await fetch(`${BASE_URL}/api/chat`, {
      method:  'POST',
      headers: buildHeaders(),
      body:    JSON.stringify({ message, session: 'orion-jarvis' }),
      signal:  AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = await res.json();
      // Distintos formatos posibles de respuesta OpenClaw
      const reply = data?.reply || data?.response || data?.content || data?.text || '';
      if (reply) {
        console.log(`${TAG} Respuesta vía API HTTP (${reply.length} chars)`);
        return reply;
      }
    }
  } catch (err) {
    console.warn(`${TAG} API HTTP no disponible, usando CLI:`, err.message);
  }

  // Intento 2: CLI openclaw
  try {
    const escaped = message.replace(/"/g, '\\"');
    const { stdout } = await execAsync(`openclaw chat --message "${escaped}" --no-color 2>/dev/null`, {
      timeout: 20_000,
    });
    const reply = stdout.trim();
    if (reply) {
      console.log(`${TAG} Respuesta vía CLI openclaw (${reply.length} chars)`);
      return reply;
    }
  } catch (err) {
    console.warn(`${TAG} CLI openclaw falló:`, err.message);
  }

  // Degradación elegante: respuesta offline
  return `⭐ ORION recibió tu mensaje. OpenClaw no está respondiendo en este momento. Intenta de nuevo en un instante.`;
}

// ─── getMemory ───────────────────────────────────────────────────────────────

/**
 * Lee las últimas N líneas de MEMORY.md.
 * Si se pasa un query, filtra por líneas que lo contengan.
 *
 * @param {string} [query='']  - Texto a buscar (opcional)
 * @param {number} [lines=50] - Número de líneas a retornar
 * @returns {Promise<string>}
 */
async function getMemory(query = '', lines = 50) {
  console.log(`${TAG} getMemory query="${query}" lines=${lines}`);

  try {
    if (!fs.existsSync(MEMORY_PATH)) {
      return '# MEMORY.md\n_(vacío por ahora)_';
    }

    const content = fs.readFileSync(MEMORY_PATH, 'utf8');
    const allLines = content.split('\n');

    if (query) {
      // Filtrar líneas con el query (case-insensitive)
      const q = query.toLowerCase();
      const filtered = allLines.filter(l => l.toLowerCase().includes(q));
      return filtered.slice(-lines).join('\n') || `_(sin resultados para "${query}")_`;
    }

    // Sin query: últimas N líneas
    return allLines.slice(-lines).join('\n');
  } catch (err) {
    console.error(`${TAG} Error leyendo MEMORY.md:`, err.message);
    return `_(error leyendo memoria: ${err.message})_`;
  }
}

// ─── sendWhatsApp ────────────────────────────────────────────────────────────

/**
 * Envía un WhatsApp via gateway de OpenClaw.
 * Usa el CLI `openclaw` con el canal whatsapp.
 *
 * @param {string} to       - Número destino (ej: +593999...)
 * @param {string} message  - Texto del mensaje
 * @param {string} [filePath] - Ruta de archivo adjunto (opcional)
 * @returns {Promise<{ok: boolean, detail: string}>}
 */
async function sendWhatsApp(to, message, filePath = null) {
  console.log(`${TAG} sendWhatsApp → ${to} | "${message.slice(0, 60)}"`);

  try {
    let cmd = `openclaw message --channel whatsapp --target "${to}" --message "${message.replace(/"/g, '\\"')}"`;
    if (filePath && fs.existsSync(filePath)) {
      cmd += ` --file "${filePath}"`;
    }

    const { stdout, stderr } = await execAsync(cmd, { timeout: 20_000 });
    console.log(`${TAG} WhatsApp enviado:`, stdout.trim() || stderr.trim());
    return { ok: true, detail: stdout.trim() || 'Mensaje enviado' };
  } catch (err) {
    console.error(`${TAG} Error enviando WhatsApp:`, err.message);
    return { ok: false, detail: err.message };
  }
}

// ─── listCrons ───────────────────────────────────────────────────────────────

/**
 * Lista los crons activos via `openclaw crons list`.
 * Parsea el output en un arreglo de objetos.
 *
 * @returns {Promise<Array<{id: string, schedule: string, command: string, status: string}>>}
 */
async function listCrons() {
  console.log(`${TAG} listCrons`);

  try {
    const { stdout } = await execAsync('openclaw crons list --no-color 2>/dev/null', {
      timeout: 10_000,
    });

    // Parseo básico: cada línea puede tener formato "ID  SCHEDULE  COMMAND  STATUS"
    const lines = stdout.trim().split('\n').filter(Boolean);
    const crons = lines
      .filter(l => !l.startsWith('#') && !l.toLowerCase().startsWith('id'))
      .map(line => {
        const parts = line.split(/\s{2,}/);
        return {
          id:       parts[0]?.trim() || '?',
          schedule: parts[1]?.trim() || '?',
          command:  parts[2]?.trim() || line.trim(),
          status:   parts[3]?.trim() || 'active',
        };
      });

    console.log(`${TAG} ${crons.length} cron(s) encontrado(s)`);
    return crons;
  } catch (err) {
    console.warn(`${TAG} No se pudo listar crons:`, err.message);
    return [];
  }
}

// ─── createCron ──────────────────────────────────────────────────────────────

/**
 * Crea un nuevo cron job via CLI de OpenClaw.
 *
 * @param {string} schedule - Expresión cron (ej: "0 9 * * 1")
 * @param {string} command  - Comando a ejecutar
 * @returns {Promise<{ok: boolean, detail: string}>}
 */
async function createCron(schedule, command) {
  console.log(`${TAG} createCron schedule="${schedule}" cmd="${command.slice(0, 60)}"`);

  try {
    const cmd = `openclaw crons add --schedule "${schedule}" --command "${command.replace(/"/g, '\\"')}"`;
    const { stdout } = await execAsync(cmd, { timeout: 10_000 });
    return { ok: true, detail: stdout.trim() };
  } catch (err) {
    console.error(`${TAG} Error creando cron:`, err.message);
    return { ok: false, detail: err.message };
  }
}

// ─── streamResponse ──────────────────────────────────────────────────────────

/**
 * Envía un mensaje al agente y transmite la respuesta al cliente WS.
 * Emite evento `orion:response` con { text, state }.
 *
 * @param {string} message   - Mensaje del usuario
 * @param {object} wsClient  - Cliente WebSocket (instancia ws)
 */
async function streamResponse(message, wsClient) {
  console.log(`${TAG} streamResponse para cliente WS`);

  // Notificar estado "procesando"
  wsSend(wsClient, 'orion:state', { state: 'processing' });

  try {
    const reply = await sendToAgent(message);

    // Emitir respuesta
    wsSend(wsClient, 'orion:response', { text: reply, voiceBright: 0.9 });
    wsSend(wsClient, 'orion:state',    { state: 'idle' });
  } catch (err) {
    console.error(`${TAG} streamResponse error:`, err.message);
    wsSend(wsClient, 'orion:response', {
      text: '⭐ Error interno de ORION. Intenta de nuevo.',
      voiceBright: 0.3,
    });
    wsSend(wsClient, 'orion:state', { state: 'idle' });
  }
}

// ─── Helper: envío seguro a WebSocket ────────────────────────────────────────

/**
 * Envía un mensaje JSON al cliente WS si la conexión está abierta.
 *
 * @param {object} client - Cliente ws
 * @param {string} event  - Nombre del evento
 * @param {object} data   - Payload
 */
function wsSend(client, event, data) {
  try {
    if (client && client.readyState === 1 /* OPEN */) {
      client.send(JSON.stringify({ event, data, ts: Date.now() }));
    }
  } catch (err) {
    console.warn(`${TAG} wsSend error (${event}):`, err.message);
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  sendToAgent,
  getMemory,
  sendWhatsApp,
  listCrons,
  createCron,
  streamResponse,
  wsSend,
  OPENCLAW_WORKSPACE,
  MEMORY_PATH,
};

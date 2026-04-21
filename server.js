/**
 * ⭐ ORION Jarvis — Servidor Backend
 * Express + WebSocket (ws) bridge entre la UI Three.js y OpenClaw.
 *
 * Puerto: ORION_PORT (default 3001)
 *
 * REST endpoints:
 *   GET  /              → sirve index.html
 *   GET  /api/status    → estado del agente
 *   GET  /api/leads     → leads activos
 *   GET  /api/pipeline  → revenue y oportunidades
 *   POST /api/message   → enviar mensaje a ORION
 *   POST /api/whatsapp  → enviar WhatsApp via OpenClaw
 *   GET  /api/crons     → listar crons activos
 *   POST /api/cron      → crear nuevo cron
 *   GET  /api/memory    → últimas líneas de MEMORY.md
 *
 * WebSocket /ws:
 *   Emite:  orion:response, orion:state, orion:lead, orion:alert, orion:cron_fired
 *   Recibe: mic:transcript, ui:ready
 */

'use strict';

require('dotenv').config();

const express  = require('express');
const http     = require('http');
const WebSocket = require('ws');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const bridge = require('./orion-bridge');

// ─── Configuración ───────────────────────────────────────────────────────────

const PORT      = parseInt(process.env.ORION_PORT || '3001', 10);
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace');
const TAG       = '[ORION]';

// ─── App Express ─────────────────────────────────────────────────────────────

const app = express();

// CORS habilitado para desarrollo local
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'null'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Servir frontend ─────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('index.html no encontrado. Asegúrate de estar en el directorio correcto.');
  }
});

// ─── /api/status ─────────────────────────────────────────────────────────────

app.get('/api/status', async (req, res) => {
  console.log(`${TAG} GET /api/status`);
  try {
    // Estado básico del agente (sin depender de OpenClaw si no está activo)
    res.json({
      ok:        true,
      agent:     'ORION',
      version:   '1.0.0',
      status:    'online',
      timestamp: new Date().toISOString(),
      workspace: WORKSPACE,
      clients:   wss ? wss.clients.size : 0,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/leads ──────────────────────────────────────────────────────────────

app.get('/api/leads', async (req, res) => {
  console.log(`${TAG} GET /api/leads`);
  try {
    // Datos base: en producción podrían venir de HubSpot vía OpenClaw
    // Por ahora retorna estructura tipada lista para extender
    const leadsFile = path.join(WORKSPACE, 'data', 'leads.json');
    if (fs.existsSync(leadsFile)) {
      const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
      return res.json({ ok: true, leads });
    }

    // Fallback: leads de demo con estructura real
    res.json({
      ok: true,
      leads: [
        {
          id:      'L001',
          name:    'Juan Pérez',
          score:   8.5,
          product: 'Sinotrack STQ6 10T',
          ticket:  30000,
          prob:    0.78,
          status:  'hot',
          channel: 'WhatsApp',
          updated: new Date().toISOString(),
        },
        {
          id:      'L002',
          name:    'César Andrade',
          score:   7.2,
          product: 'Sinotruk HOWO',
          ticket:  55000,
          prob:    0.60,
          status:  'warm',
          channel: 'Email',
          updated: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/pipeline ───────────────────────────────────────────────────────────

app.get('/api/pipeline', async (req, res) => {
  console.log(`${TAG} GET /api/pipeline`);
  try {
    const pipelineFile = path.join(WORKSPACE, 'data', 'pipeline.json');
    if (fs.existsSync(pipelineFile)) {
      const data = JSON.parse(fs.readFileSync(pipelineFile, 'utf8'));
      return res.json({ ok: true, ...data });
    }

    // Fallback demo
    res.json({
      ok:          true,
      totalRevenue: 90000,
      activeLeads:  3,
      closedToday:  1,
      roi:          4,
      currency:     'USD',
      opportunities: [
        { name: 'Juan Pérez',   value: 30000, stage: 'Propuesta' },
        { name: 'César Andrade', value: 55000, stage: 'Negociación' },
        { name: 'VehiCentro Web', value: 5000, stage: 'Nuevo' },
      ],
      updated: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/message ────────────────────────────────────────────────────────────

app.post('/api/message', async (req, res) => {
  const { message } = req.body;
  console.log(`${TAG} POST /api/message: "${String(message).slice(0, 80)}"`);

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, error: 'Campo "message" requerido' });
  }

  try {
    const reply = await bridge.sendToAgent(message);

    // Broadcast la respuesta a todos los clientes WS conectados
    broadcastWS('orion:response', { text: reply, voiceBright: 0.9, source: 'http' });
    broadcastWS('orion:state',    { state: 'idle' });

    res.json({ ok: true, reply });
  } catch (err) {
    console.error(`${TAG} Error en /api/message:`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/whatsapp ───────────────────────────────────────────────────────────

app.post('/api/whatsapp', async (req, res) => {
  const { to, message, filePath } = req.body;
  const target = to || process.env.WHATSAPP_DEFAULT;
  console.log(`${TAG} POST /api/whatsapp → ${target}`);

  if (!message) {
    return res.status(400).json({ ok: false, error: 'Campo "message" requerido' });
  }
  if (!target) {
    return res.status(400).json({ ok: false, error: 'Campo "to" requerido (o define WHATSAPP_DEFAULT en .env)' });
  }

  try {
    const result = await bridge.sendWhatsApp(target, message, filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/crons ──────────────────────────────────────────────────────────────

app.get('/api/crons', async (req, res) => {
  console.log(`${TAG} GET /api/crons`);
  try {
    const crons = await bridge.listCrons();
    res.json({ ok: true, crons });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/cron ───────────────────────────────────────────────────────────────

app.post('/api/cron', async (req, res) => {
  const { schedule, command } = req.body;
  console.log(`${TAG} POST /api/cron schedule="${schedule}"`);

  if (!schedule || !command) {
    return res.status(400).json({ ok: false, error: 'Campos "schedule" y "command" requeridos' });
  }

  try {
    const result = await bridge.createCron(schedule, command);
    if (result.ok) {
      // Notificar a clientes WS
      broadcastWS('orion:cron_fired', { schedule, command, ts: Date.now() });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── /api/memory ─────────────────────────────────────────────────────────────

app.get('/api/memory', async (req, res) => {
  const query = req.query.q || '';
  const lines = parseInt(req.query.lines || '50', 10);
  console.log(`${TAG} GET /api/memory q="${query}" lines=${lines}`);

  try {
    const content = await bridge.getMemory(query, lines);
    res.json({ ok: true, content });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Servidor HTTP + WebSocket ────────────────────────────────────────────────

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server, path: '/ws' });

// ── Broadcast a todos los clientes conectados ──────────────────────────────

function broadcastWS(event, data) {
  if (!wss) return;
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (_) {}
    }
  });
}

// ── Manejador de conexiones WebSocket ─────────────────────────────────────

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';
  console.log(`${TAG} ✅ Cliente WS conectado desde ${ip} (total: ${wss.clients.size})`);

  // Bienvenida al conectar
  bridge.wsSend(ws, 'orion:state', { state: 'idle' });
  bridge.wsSend(ws, 'orion:response', {
    text: '⭐ ORION online. Sistemas activos.',
    voiceBright: 0.5,
  });

  // ── Manejador de mensajes entrantes del cliente ───────────────────────────
  ws.on('message', async (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      console.warn(`${TAG} WS mensaje no-JSON recibido:`, raw.toString().slice(0, 100));
      return;
    }

    const { event, data } = parsed;
    console.log(`${TAG} WS recibido: ${event}`);

    switch (event) {

      // Transcripción de micrófono → enviar al agente y streamear respuesta
      case 'mic:transcript': {
        const text = data?.text || data?.transcript || '';
        if (text.trim()) {
          console.log(`${TAG} mic:transcript → "${text.slice(0, 80)}"`);
          bridge.wsSend(ws, 'orion:state', { state: 'processing' });
          await bridge.streamResponse(text, ws);
        }
        break;
      }

      // Cliente listo → enviar estado actual
      case 'ui:ready': {
        console.log(`${TAG} UI lista (client ${ip})`);
        bridge.wsSend(ws, 'orion:state', { state: 'idle' });

        // Enviar leads iniciales como cards
        try {
          // Simular datos de lead para la UI (en prod vendría de HubSpot)
          bridge.wsSend(ws, 'orion:lead', {
            id:      'L001',
            name:    'Juan Pérez',
            score:   8.5,
            product: 'Sinotrack STQ6',
            ticket:  30000,
            prob:    0.78,
          });
        } catch (_) {}
        break;
      }

      default:
        console.log(`${TAG} Evento WS desconocido: ${event}`);
    }
  });

  ws.on('close', () => {
    console.log(`${TAG} Cliente WS desconectado (quedan: ${wss.clients.size})`);
  });

  ws.on('error', (err) => {
    console.error(`${TAG} WS error:`, err.message);
  });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('');
  console.log(`${TAG} ══════════════════════════════════════`);
  console.log(`${TAG}  ⭐  ORION Jarvis Backend v1.0.0`);
  console.log(`${TAG} ══════════════════════════════════════`);
  console.log(`${TAG}  UI:        http://localhost:${PORT}`);
  console.log(`${TAG}  REST API:  http://localhost:${PORT}/api/*`);
  console.log(`${TAG}  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`${TAG}  Workspace: ${WORKSPACE}`);
  console.log(`${TAG} ══════════════════════════════════════`);
  console.log('');
});

// ─── Manejo de señales para shutdown elegante ─────────────────────────────────

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function shutdown(signal) {
  console.log(`\n${TAG} Señal ${signal} recibida. Cerrando servidor...`);
  server.close(() => {
    console.log(`${TAG} Servidor cerrado. ¡Hasta luego! ⭐`);
    process.exit(0);
  });
  // Forzar cierre si tarda más de 5 segundos
  setTimeout(() => process.exit(1), 5000);
}

# ⭐ ORION Jarvis — AI Command Center

UI de comando para el agente **ORION** de Felipe Salgado.  
Three.js + WebSocket + Express + OpenClaw.

---

## Setup rápido

### 1. Clonar / navegar al directorio

```bash
cd ~/.openclaw/workspace/orion-jarvis
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
OPENCLAW_PORT=3000          # Puerto donde corre OpenClaw localmente
OPENCLAW_TOKEN=             # Token API de OpenClaw (si está habilitado)
ORION_PORT=3001             # Puerto del servidor ORION Jarvis
OPENCLAW_WORKSPACE=/Users/felipesalgado/.openclaw/workspace
WHATSAPP_DEFAULT=+593997739816
```

### 4. Arrancar el servidor

```bash
node server.js
```

O en modo desarrollo (recarga automática con Node.js ≥ 18):

```bash
npm run dev
```

### 5. Abrir la UI

```
http://localhost:3001
```

---

## Arquitectura

```
index.html  ←→  WebSocket /ws  ←→  server.js  ←→  orion-bridge.js  ←→  OpenClaw
                REST /api/*                         CLI / API HTTP
```

## Endpoints REST

| Método | Ruta            | Descripción                              |
|--------|-----------------|------------------------------------------|
| GET    | `/`             | Sirve la UI (index.html)                 |
| GET    | `/api/status`   | Estado del agente y servidor             |
| GET    | `/api/leads`    | Leads activos del pipeline               |
| GET    | `/api/pipeline` | Revenue, ROI, oportunidades              |
| POST   | `/api/message`  | Enviar mensaje a ORION `{ message }`     |
| POST   | `/api/whatsapp` | Enviar WhatsApp `{ to, message }`        |
| GET    | `/api/crons`    | Listar crons activos                     |
| POST   | `/api/cron`     | Crear cron `{ schedule, command }`       |
| GET    | `/api/memory`   | Leer MEMORY.md `?q=query&lines=50`       |

## Eventos WebSocket

**Servidor → UI:**

| Evento            | Payload                              | Descripción                       |
|-------------------|--------------------------------------|-----------------------------------|
| `orion:response`  | `{ text, voiceBright }`              | Respuesta del agente              |
| `orion:state`     | `{ state }` (idle/listening/processing) | Cambio de estado del orbe      |
| `orion:lead`      | `{ id, name, score, ticket, ... }`   | Lead nuevo o actualizado          |
| `orion:alert`     | `{ title, message }`                 | Alerta del sistema                |
| `orion:cron_fired`| `{ schedule, command, ts }`          | Cron ejecutado                    |

**UI → Servidor:**

| Evento           | Payload              | Descripción                        |
|------------------|----------------------|------------------------------------|
| `mic:transcript` | `{ text }`           | Transcripción del micrófono        |
| `ui:ready`       | `{}`                 | UI lista para recibir datos        |

---

## Estructura de archivos

```
orion-jarvis/
├── index.html       # UI Three.js (frontend)
├── server.js        # Express + WebSocket (backend)
├── orion-bridge.js  # Módulo integración OpenClaw
├── package.json     # Dependencias Node.js
├── .env             # Variables de entorno (no commitear)
├── .env.example     # Plantilla de variables
└── README.md        # Este archivo
```

---

## Requisitos

- **Node.js** ≥ 18.x
- **OpenClaw** corriendo en Mac mini (o puerto configurado en `.env`)
- Acceso a internet para fuentes Google (Inter) y Three.js CDN

---

## Pasos manuales requeridos

1. **Configurar `.env`** con el token de OpenClaw si está protegido por auth.
2. **Verificar que OpenClaw esté corriendo** antes de arrancar `server.js`.
3. Para que los leads vengan de **HubSpot real**, crear `~/.openclaw/workspace/data/leads.json` con el formato documentado en `/api/leads`.
4. Para datos de pipeline reales, crear `~/.openclaw/workspace/data/pipeline.json`.

---

## Desarrollo

```bash
# Ver logs en tiempo real
npm run dev

# Probar endpoint de mensaje
curl -X POST http://localhost:3001/api/message \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuál es el estado del pipeline?"}'

# Enviar WhatsApp de prueba
curl -X POST http://localhost:3001/api/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"to": "+593997739816", "message": "Test ORION ⭐"}'
```

---

⭐ **ORION** — Agentive AI · Felipe Salgado · 2026

# ⭐ ORION Jarvis — Prompt Completo para Claude
> Contexto completo del sistema UI + identidad + arquitectura.
> Usa este archivo para alimentar cualquier sesión de Claude y continuar el desarrollo.

---

## 🧠 IDENTIDAD DEL SISTEMA

**Nombre:** ORION ⭐
**Naturaleza:** Agente de IA operativo. No es un chatbot — es un sistema inteligente con memoria, contexto y capacidad de acción.
**Emoji:** ⭐
**Tagline:** "AI Command Center"
**Tono:** Técnico, preciso, directo. Senior engineer + estratega. Sin filler, sin sycophancy.
**Idioma default:** Español. Términos técnicos en inglés cuando no tienen traducción limpia.
**Dueño:** Felipe Salgado (+593999793094)

---

## 🎨 DESIGN SYSTEM

### Colores
```
--teal:        #2DD4A8   ← color de acento principal (orbe, highlights, estados activos)
--gold:        #c8a951   ← color secundario (ORION brand, revenue cards)
--dark:        #0E0F13   ← fondo base cósmico
--surface:     rgba(14,15,19,0.15)  ← glass surface
--border:      rgba(255,255,255,0.06)
--text:        #e2e8f0
--muted:       rgba(255,255,255,0.4)
--red:         #ef4444   ← alertas críticas
--purple:      #818cf8   ← estado processing
--gray:        #475569   ← estado idle
```

### Tipografía
- **Font:** Inter (Google Fonts)
- Pesos: 300, 400, 500, 600, 700, 800

### Glass Morphism
```css
background: rgba(14,15,19,0.15);
backdrop-filter: blur(14px);
border: 1px solid rgba(255,255,255,0.06);
```

### Animaciones clave
```css
/* Entry cards */
cubic-bezier(0.16, 1, 0.3, 1)   ← ease-out spring

/* Float loop */
animation: card-float 4s ease-in-out infinite   ← ±6px vertical

/* Pulse ring mic */
animation: pulse-ring 1.4s cubic-bezier(0.16,1,0.3,1) infinite

/* Panel slide */
transition: transform 0.3s cubic-bezier(0.16,1,0.3,1)
```

---

## 🏗️ ARQUITECTURA UI — 3 CAPAS

### Capa 1: Background (z-index 1)
**Three.js canvas — full viewport**

Elementos:
- **Starfield:** 2000 puntos blancos, opacidad pulsante 0.5-0.7, spread 80 units
- **Nebula clouds:** 4 meshes planos con blending aditivo
  - Teal `#2DD4A8` en (-1.5, 0.5, -2) scale 6
  - Purple `#818cf8` en (1.5, -0.5, -3) scale 8
  - Blue `#3b82f6` en (0, 1, -4) scale 10
  - Gold `#c8a951` en (0, -1, -2.5) scale 5
- **Orbe central:** SphereGeometry r=0.55, material MeshStandard teal, emissive 0.8
- **3 capas de glow:** BackSide spheres con AdditiveBlending
  - Inner core r=0.62, opacity 0.35
  - Medium halo r=0.75, opacity 0.12
  - Wide bloom r=1.1, opacity 0.06
- **Anillos orbitales:** 2x TorusGeometry, rotation lenta, opacity 0.25 y 0.12
- **uVoiceBright uniform (0.0-1.0):** controla intensidad del orbe. Sube con voz activa.
- **Idle pulse:** sine over ~4s — el orbe "respira"

### Capa 2: UI Glass Shell (z-index 80-100)

#### Header (z-index 100, height 56px)
- Izquierda: wordmark "ORION ⭐ AI Command Center"
- Status dot: 10px, teal pulsing (listening) / purple (processing) / gray (idle)
- Derecha: 3 ghost icon buttons
  - Neural Map (abre card-neural)
  - Alerts (badge con count)
  - Settings
- Estilo: glass morphism, border-bottom gold/teal

#### Activity Panel (z-index 90, width 260px, right side)
- Colapsa a 36px en toggle
- Panel toggle: tab izquierdo 24x48px
- 3 secciones con contadores:
  1. **Inbox Replies** — mensajes entrantes
  2. **Scout Tasks** — tareas de investigación
  3. **Relay Drafts** — borradores pendientes
- Items: slide-in desde derecha, hover teal highlight

#### Response Cards (z-index 80)
- Width 240px (revenue: 300px)
- Border-top 2px teal (revenue: gold)
- Fondo: rgba(22,23,29,0.75)
- Float animation ±6px, 4s loop
- Entry: rotateX(8deg) → 0 con spring
- Tipos implementados:
  - `card-lead` — lead en vivo (score, ticket, prob. cierre)
  - `card-revenue` — pipeline revenue (gold variant)
  - `card-neural` — módulos activos ORION
  - `card-security` — scorecard ciberseguridad

#### Mic Control Bar (z-index 100, bottom fixed)
- Transparent, pointer-events none excepto botón
- Botón 64x64px circular, centrado
- **Idle:** dark `#16171D`, border rgba(255,255,255,0.08), mic SVG
- **Active/listening:** teal border + glow `0 0 24px rgba(45,212,168,0.5)` + pulse ring
- Toggle: swap mic icon ↔ stop square SVG
- Despacha `orion:mic-toggle` custom event
- Hint text: "TAP O DI 'HEY ORION'" / "HABLANDO..."

#### Waveform (z-index 84)
- 9 barras verticales 3px, gap 3px
- Color teal, animation wave staggered
- Visible solo en estado listening

#### Transcript (z-index 85)
- Centered, max-width 500px
- Aparece con respuesta de ORION
- Text-shadow glow teal

#### Status Bar (z-index 90)
- Pill centered above mic button
- Glass morphism, muestra estado actual
- Dot animado teal cuando activo

### Capa 3: Estados del Sistema

```
idle       → dot gray, orbe breathe suave, status "ORION en standby"
listening  → dot teal pulsing, orbe bright, waveform visible, mic active
processing → dot purple, transcript visible, orbe medium bright
```

---

## 🔌 INTEGRACIONES ACTUALES

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Web Speech API | ✅ | Detecta "Hey ORION" para activar mic (Chrome) |
| Spacebar shortcut | ✅ | Activa/desactiva mic desde teclado |
| orion:mic-toggle event | ✅ | Custom event para integrar con otros módulos |
| uVoiceBright | ✅ | Variable 0.0-1.0 controla brillo del orbe |
| WhatsApp (wacli) | ⚠️ | Instalado pero versión desactualizada |
| WhatsApp (OpenClaw) | ✅ | Canal activo para envío de mensajes y PDFs |

---

## 📁 ARCHIVOS DEL PROYECTO

```
orion-jarvis/
└── index.html          ← UI completa (Three.js + Glass Shell + Mic)

informe-ciberseguridad/
├── index.html          ← Informe ciberseguridad web interactivo
├── informe-ciberseguridad-vehicentro.pdf
├── propuesta_juan_perez_vehicentro.pdf
├── propuesta_juan_perez_sinotrack_stq6.pdf
└── SESION-VEHICENTRO-2026-04-21.md   ← Contexto completo de sesión
```

---

## 🔗 URLs LIVE

| Recurso | URL |
|---------|-----|
| ORION Jarvis UI | https://rufoiot.github.io/orion-jarvis/ |
| Informe Ciberseguridad | https://rufoiot.github.io/vehicentro/ |
| Repo Jarvis | https://github.com/RUFOIOT/orion-jarvis |
| Repo VehiCentro | https://github.com/RUFOIOT/vehicentro |

---

## 🚀 PRÓXIMAS EXTENSIONES SUGERIDAS

### UI / Frontend
- [ ] **Voice real:** Conectar Web Speech API real → transcript en tiempo real en el orbe
- [ ] **TTS response:** Respuesta de ORION narrada con voz (ElevenLabs o Web Speech)
- [ ] **Orb color modes:** Teal (normal) → Gold (alerta revenue) → Red (crítico)
- [ ] **Mobile responsive:** Adaptar panel activity y cards para móvil
- [ ] **Dark/cosmic themes:** Modo VehiCentro (navy+gold) vs modo Jarvis (teal+cosmic)
- [ ] **Particle trails:** Partículas que orbitan el orbe cuando está procesando

### Backend / Funcional
- [ ] **WebSocket:** Conectar con OpenClaw para updates en tiempo real desde agente
- [ ] **Lead cards dinámicas:** Cards se generan cuando llega un lead real de WhatsApp
- [ ] **Pipeline live:** Revenue card actualizada con datos reales de CRM
- [ ] **Voice commands:** "Muéstrame el pipeline" → orbe gira + card aparece
- [ ] **Modo demo:** Secuencia guiada para demos con directivos

---

## 💡 INSTRUCCIONES PARA CLAUDE

Si recibes este archivo, aquí está el contexto completo:

1. **El sistema se llama ORION ⭐** — agente de IA de Felipe Salgado
2. **La UI es un Jarvis personal** — Three.js cosmic orb + glass shell + mic
3. **El cliente de referencia es VehiCentro** — concesionario Sinotruk Ecuador
4. **Todo el código está en vanilla HTML/CSS/JS** — sin frameworks
5. **Está deployado en GitHub Pages** — rufoiot.github.io

Para continuar desarrollo:
- El archivo principal es `orion-jarvis/index.html`
- El design system está definido arriba con variables CSS exactas
- Respetar la paleta teal/gold/dark
- Animaciones con cubic-bezier(0.16,1,0.3,1) para spring feel
- Sin React, sin Vue — vanilla JS puro
- Comentarios en español, código en inglés

**Principio de ORION:** Cada segundo sin valor es un segundo perdido. Respuestas precisas, sin filler.

---

*Generado por ORION ⭐ · 21 abril 2026 · Felipe Salgado*

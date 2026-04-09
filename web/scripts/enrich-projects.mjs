import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envFile = readFileSync(resolve(process.cwd(), "../.env"), "utf-8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim()];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Descripciones en markdown — rich context para cada proyecto
const enrichments = {
  "KREOON (PWA)": {
    status: "active",
    description: `**Qué es:** PWA (Progressive Web App) del producto principal de KREOON Tech, enfocada en creadores de contenido UGC.

**Para qué sirve:** Plataforma web instalable que permite a creadores gestionar contenido, briefs, entregables y pagos con marcas. Incluye módulo de guionización con IA ("modo director" y "método esfera").

**Stack:**
- React 18 + TypeScript + Vite
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Tailwind CSS + shadcn/ui
- PWA manifest + Service Worker

**Integraciones:**
- Supabase (base de datos, auth, RLS)
- Bunny CDN (hosting de video)
- Claude/Gemini (guionizador IA)

**Estado:** En desarrollo activo. Producción en https://kreoon.app. Último commit: guionizador con modo director y método esfera (2026-04-09).

**Próximos hitos:** Optimización de bundle, revisión de lazy loading, revisión de políticas RLS, flujo de onboarding.`,
  },

  "KREOON Studio": {
    status: "active",
    description: `**Qué es:** Aplicación Next.js companion de KREOON. Panel administrativo / dashboard para creadores y operaciones internas.

**Para qué sirve:** Interfaz premium tipo "Liquid Glass" para gestión de contenido, analytics y workflows del ecosistema KREOON.

**Stack:**
- Next.js 16 + React 19
- Supabase
- Tailwind CSS 4
- Design system propio "Liquid Glass"

**Estado:** UI/UX completa, rediseño Premium Liquid Glass. Último commit: 2026-03-23 (Complete UI/UX redesign).

**Próximos hitos:** Integración con el backend de KREOON, módulos de analytics, sincronización con Jarvis.`,
  },

  "Jarvis v2": {
    status: "active",
    description: `**Qué es:** Asistente AI multi-agente para WhatsApp, corazón operativo del ecosistema Infiny.

**Para qué sirve:** Procesa mensajes de WhatsApp (texto + audio), delega a agentes especializados (core, memory, content, ops, analyst, engine, social, lead-hunter, task-agent), y ejecuta acciones en Gmail, Google Calendar, Meta Ads, Obsidian, Supabase. Ahora también incluye el Command Center PWA para gestión visual de tareas, proyectos y agenda.

**Stack:**
- Backend: TypeScript + Express + tsx (Node 22)
- Frontend: Next.js 16 + React 19 + Tailwind 4 (este mismo dashboard)
- Supabase (tareas, proyectos, chat history)
- CouchDB LiveSync (Obsidian)
- Docker + docker-compose (VPS 194.163.161.151)
- Caddy reverse proxy

**LLM providers (cadena de fallback):**
Groq → Anthropic Claude → Gemini 2.5 Flash → OpenRouter

**Integraciones conectadas:**
- WhatsApp Cloud API (jarvis.kreoon.com/webhook)
- Gmail / Google Calendar / Drive (OAuth por cuenta)
- Meta Ads (auditor + reportes)
- Perplexity (búsqueda web)
- ElevenLabs (TTS voz Cristian Sanchez / Adam)
- Whisper (STT)
- OpenClaw (13 skills, Docker socket)
- Instagram API (lead hunter + social manager)
- n8n (automatizaciones en dev.kreoon.com)
- Resend (email)
- Bunny CDN
- Serwist (PWA service worker)

**Agentes activos (9):**
core, memory, content, ops, analyst, engine, social, lead-hunter, task-agent

**Deploy:**
- Backend: VPS Docker (jarvis-v2 container, puerto 3000)
- Frontend: Vercel (jarvis-reports.vercel.app) + VPS (jarvis-web container, puerto 3001)

**Estado:** En producción. Command Center recién rediseñado a PWA Apple-vibrancy. Créditos Anthropic agotados → corre con Gemini fallback. Necesita conectar cuenta Google 'founder' para sync Calendar.`,
  },

  "Efficommerce Scheduler": {
    status: "active",
    description: `**Qué es:** CRM + sistema de booking para agendamiento de citas y gestión de clientes.

**Para qué sirve:** Permite a negocios de servicios (estética, salud, consultoría) agendar citas online, gestionar clientes, enviar recordatorios y procesar pagos.

**Stack:**
- React 18 + Vite + TypeScript
- shadcn/ui + Tailwind
- Supabase (booking_orgs, sales, appointments)
- Deploy: Vercel

**Funciones principales:**
- Calendario de citas multi-organización
- Búsqueda de ventas con path migrations
- Booking org fallback
- Gestión de horarios y disponibilidad

**Estado:** Base funcional. Último commit: add booking org fallback and sales search path migrations (2026-03-13). Pendiente: siguientes iteraciones producto.`,
  },

  "Bot Telegram Reels": {
    status: "paused",
    description: `**Qué es:** Bot de Telegram en Python que extrae reels/videos de Instagram y TikTok.

**Para qué sirve:** El usuario envía un link de reel al bot por Telegram y recibe el video descargado sin marca de agua, para reutilizar en análisis de tendencias y creación de contenido.

**Stack:**
- Python 3
- python-telegram-bot
- yt-dlp / instaloader

**Estado:** Primera versión funcionando. Último commit: fix .env tracking (2026-03-13). Pausado — funciona pero sin desarrollo activo. Próximo paso: integrar con Jarvis para análisis automático de reels virales.`,
  },

  "Meta Ads Agent": {
    status: "active",
    description: `**Qué es:** Agente IA especializado en auditoría y gestión de campañas de Meta Ads (Facebook + Instagram).

**Para qué sirve:** Conecta a una cuenta Meta Ads, analiza el rendimiento de campañas, detecta anomalías (CPA alto, CTR bajo, fatiga creativa), y sugiere optimizaciones. Puede ejecutar cambios via Meta Graph API con aprobación del usuario.

**Stack:**
- Next.js 16 + React 19 + TypeScript
- Supabase (auth, config, logs)
- Meta Graph API v18+
- Claude/Gemini (análisis y recomendaciones)

**Estado:** En desarrollo. Último commit: trim env vars para prevenir headers inválidos (2026-03-14). Pendiente: conectar cuenta Meta real, definir prompts base del auditor.`,
  },

  "Ads Analizer": {
    status: "paused",
    description: `**Qué es:** Herramienta de análisis de campañas publicitarias multi-plataforma.

**Para qué sirve:** Consolidar datos de Meta Ads, Google Ads, TikTok Ads y generar reportes unificados de ROAS, CAC, LTV.

**Estado:** Proyecto iniciado, estado por revisar. Candidato a fusionarse con Meta Ads Agent o convertirse en módulo.`,
  },

  "Salud ProLab": {
    status: "active",
    description: `**Qué es:** SaaS de dropshipping para el nicho de productos de salud y suplementos.

**Para qué sirve:** Plataforma multi-tenant (workspace) que permite a emprendedores lanzar tiendas de salud con catálogo preexistente, gestión de citas con profesionales, conversaciones con pacientes, tasks y etiquetas.

**Stack:**
- Next.js 15
- Prisma ORM
- PostgreSQL
- Multi-tenant con workspace modules

**Módulos activos:**
- Appointments (citas)
- Conversations (chat con clientes)
- Tasks
- Tags
- Workspaces

**Estado:** Arquitectura base completa. Último commit: módulos core añadidos (2026-03-13). Pendiente: siguientes hitos producto.`,
  },

  "Contenido UGC Colombia": {
    status: "active",
    description: `**Qué es:** Pipeline operativo de contenido orgánico para @agenciaugccolombia en Instagram.

**Para qué sirve:** Mantener presencia constante en redes de la agencia UGC Colombia: calendario editorial, briefs para creators, publicación, engagement.

**Herramientas conectadas:**
- Instagram (@agenciaugccolombia)
- Canva (diseño)
- Remotion (videos programáticos, ~/my-video/)
- ElevenLabs (voz)
- Notion / Obsidian (calendario)

**Estado:** En ejecución permanente. Calendario semanal pendiente de definir por trimestre.`,
  },

  "PDF Lead Magnet": {
    status: "active",
    description: `**Qué es:** Documento PDF "UGC-Colombia-Estrategia-Contenido-2026.pdf" usado como lead magnet para capturar prospectos en UGC Colombia.

**Para qué sirve:** Se entrega a cambio del email/WhatsApp del visitante en landing pages. Contiene estrategia anual de contenido, calendario por industria, y frameworks de UGC.

**Estado:** Versión actual publicada. **Bug conocido high-priority:** footer desborda en algunas páginas. Pendiente de corrección.`,
  },

  "Serie Tips Contenido": {
    status: "active",
    description: `**Qué es:** Serie de 5 episodios cortos de video "Tips de Creación de Contenido" para IG Reels + TikTok + YouTube Shorts.

**Para qué sirve:** Posicionar a Alexander Cast como autoridad en creación de contenido, generar seguidores y leads para UGC Colombia y KREOON.

**Herramientas de producción:**
- Remotion (videos programáticos) — carpeta ~/my-video/
- ElevenLabs (voz "Cristian Sanchez" paisa colombiano)
- Veo 3 + Gemini (B-roll e imágenes)
- Canva (thumbnails)
- DaVinci Resolve (edición final)

**Estado:** Guiones en borrador. Próximo paso: grabar episodio 1 (high priority), guion y storyboard episodios 2-5.`,
  },

  "Comunidad Reyes": {
    status: "active",
    description: `**Qué es:** Comunidad "Los Reyes del Contenido" — comunidad privada de creadores de contenido.

**Para qué sirve:** Espacio educativo y de networking para creadores que quieren profesionalizar su oficio. Pilar #2 del ecosistema Alexander Cast.

**Plataformas candidatas:** Circle / Discord / Skool / WhatsApp Community.

**Frameworks:** CLG (Community-Led Growth), SPACE, gamificación.

**Estado:** En fase de diseño estratégico. Pendiente: definir pilares de contenido, onboarding de miembros, sistemas de retención.`,
  },

  "Podcast Cafetiando": {
    status: "paused",
    description: `**Qué es:** Podcast "Cafetiando" — conversaciones informales sobre emprendimiento digital, creadores, marketing, desde la cultura cafetera colombiana.

**Para qué sirve:** Pilar #4 del ecosistema Alexander Cast. Posicionamiento, autoridad, generación de leads cualificados.

**Herramientas previstas:** Riverside.fm / Descript (grabación), Spotify for Podcasters, YouTube, Anchor.

**Estado:** Concepto definido. Pendiente: agendar primera grabación, definir intro musical, estructura de episodio.`,
  },

  "Sanavi Natural": {
    status: "active",
    description: `**Qué es:** Línea de productos naturales (suplementos / bienestar).

**Para qué sirve:** Negocio físico/e-commerce dentro del ecosistema, categoría salud natural.

**Estado:** En definición. Pendiente: catálogo inicial de productos, decisión sobre plataforma de venta (Shopify / WooCommerce / integración con Salud ProLab).`,
  },

  "Segundo Cerebro": {
    status: "active",
    description: `**Qué es:** Obsidian vault — sistema de notas Zettelkasten usado como segundo cerebro personal y de trabajo.

**Ubicación:** F:/Users/SICOMMER SAS/Documents/GitHub/Obsidian

**Estructura PARA + 10-Claude:**
- 00 Inbox / 01 Proyectos / 02 Areas / 03 Recursos / 04 Archivo
- 05 Zettelkasten / 06 Contenido / 07 Diario / 08 Templates
- 09 Adjuntos / 10 Claude (sesiones, decisiones, aprendizajes)

**Sincronización:**
- CouchDB LiveSync ↔ Jarvis backend (sync.kreoon.com)
- Git remote: AlexanderKast/obsidian-brain
- Móvil: Obsidian app + LiveSync

**Integraciones:**
- Jarvis guarda reportes diarios en jarvis/daily-engine/
- Jarvis guarda tareas completadas en jarvis/tasks/YYYY-MM/
- Reportes semanales en jarvis/reports/YYYY-WW.md

**Estado:** Funcionando. Pendiente: configurar fal.ai API key para generación de carruseles IA desde el vault.`,
  },

  "Remotion my-video": {
    status: "active",
    description: `**Qué es:** Proyecto Remotion en ~/my-video/ para producir videos programáticos sociales.

**Para qué sirve:** Generar reels/shorts/TikToks automatizados con React + Remotion, fusionando voiceovers ElevenLabs, B-roll Veo 3, y overlays dinámicos.

**Stack:**
- Remotion (React + Node)
- ElevenLabs SDK (voz Cristian Sanchez)
- Google Veo 3 + Gemini (B-roll + imágenes)
- FFmpeg (encode final)

**Formatos:** Reels 9:16, TikTok 9:16, YouTube Shorts 9:16, horizontal 16:9 para repurpose.

**Estado:** Setup funcional. Pendiente: push del proyecto a GitHub (no está versionado aún), primera grabación serie Tips.`,
  },
};

let updated = 0;
for (const [name, patch] of Object.entries(enrichments)) {
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("name", name)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) {
    console.warn("not found:", name);
    continue;
  }
  const { error } = await supabase
    .from("projects")
    .update({ description: patch.description, status: patch.status })
    .eq("id", existing.id);
  if (error) console.error("update fail", name, error.message);
  else {
    console.log("enriched:", name);
    updated++;
  }
}
console.log(`\nDone. ${updated}/${Object.keys(enrichments).length} proyectos enriquecidos.`);

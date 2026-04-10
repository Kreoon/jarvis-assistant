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

const { data: workspaces } = await supabase.from("workspaces").select("slug, id");
const ws = Object.fromEntries(workspaces.map((w) => [w.slug, w.id]));

// Nuevos proyectos (repos de GitHub faltantes)
const projects = [
  // === KREOON ===
  {
    workspace: "kreoon",
    name: "KREOON Reports",
    status: "active",
    description: `**Qué es:** Sistema de reportes internos de KREOON Tech.

**Para qué sirve:** Generar reportes automáticos sobre métricas de la plataforma KREOON (usuarios, engagement, contenido producido, revenue) para dashboards internos y comunicación con stakeholders.

**Repo:** AlexanderKast/kreoon-reports (privado)

**Estado:** Activo. Último push 2026-04-02.`,
  },
  {
    workspace: "kreoon",
    name: "Reporte Leads",
    status: "active",
    description: `**Qué es:** Sistema de reporte y tracking de leads del ecosistema.

**Para qué sirve:** Consolidar leads de todas las fuentes (web, WhatsApp, ads, landing pages) en un único pipeline con atribución.

**Repo:** AlexanderKast/reporteleads (privado)

**Estado:** Activo. Último push 2026-03-31.`,
  },

  // === INFINY LATAM ===
  {
    workspace: "infiny-latam",
    name: "Effix 2026 (Feria)",
    status: "active",
    description: `**Qué es:** Sitio web y plataforma operativa de la feria Effix 2026 — evento presencial del ecosistema Efficommerce.

**Para qué sirve:** Landing del evento, registro de asistentes, agenda, ponentes, auditoría SEO y Google Ads de la campaña de difusión.

**Stack:** Next.js, Supabase.

**Incluye:** Auditoría completa de página web + Google Ads (commit 2026-03-24).

**Repo:** AlexanderKast/effix-2026 (público)

**Estado:** Activo. Feria programada para 2026.`,
  },
  {
    workspace: "infiny-latam",
    name: "Cartelera Effi",
    status: "active",
    description: `**Qué es:** Sistema de cartelera digital (signage) para la feria Efficommerce y puntos físicos.

**Para qué sirve:** Gestión de contenido mostrado en pantallas durante eventos presenciales, con programación por slots y contenido dinámico.

**Repo:** AlexanderKast/carteleraeffi (privado)

**Estado:** Activo. Relacionado con Effix 2026.`,
  },

  // === UGC COLOMBIA ===
  {
    workspace: "ugc-colombia",
    name: "UGC Colombia (Web + Ecosistema)",
    status: "active",
    description: `**Qué es:** Ecosistema digital completo de UGC Colombia — web, Supabase, n8n workflows, Remotion, sistemas operativos.

**Para qué sirve:** Agencia boutique de UGC para LATAM + USA Hispanic. Incluye sitio web de marca, landing para creators, pipeline de producción, CRM de brands y workflows automatizados.

**Stack:**
- Web: Next.js / React + Tailwind
- Supabase (creators, brands, proyectos)
- n8n (automatizaciones)
- Remotion (videos programáticos)

**Features recientes:** Bloque "Aliados estratégicos" con marquee inverso (2026-04-09).

**Repo:** AlexanderKast/ugc-colombia (privado)

**Estado:** Activo con desarrollo constante.`,
  },

  // === PERSONAL ===
  {
    workspace: "personal",
    name: "OpenClaw",
    status: "active",
    description: `**Qué es:** Asistente AI personal OpenClaw — framework open-source que corre en Docker, conectado a Jarvis v2.

**Para qué sirve:** Proveer 13+ skills ejecutables (búsqueda web, scraping, manipulación de archivos, automatizaciones) que Jarvis puede invocar como "capacidades extendidas" cuando el usuario pide algo fuera del alcance de los agentes nativos.

**Tagline:** "Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞"

**Stack:**
- Docker + Docker Compose
- Gateway con auth token
- Skills en Python/Node

**Integración con Jarvis:** conector \`src/connectors/openclaw.ts\` con auto-approve y delegación desde base-agent.

**Repo:** AlexanderKast/openclaw (público)

**Estado:** Activo en producción. Container \`jarvis-openclaw\` corriendo en el VPS.`,
  },
  {
    workspace: "personal",
    name: "Claude Skills (1280+)",
    status: "active",
    description: `**Qué es:** Colección privada de 1,280+ skills de Claude Code para extender las capacidades del asistente.

**Para qué sirve:** Biblioteca personal de skills reutilizables que Claude Code carga bajo demanda según contexto — desde generación de imágenes hasta integraciones con APIs de terceros, frameworks de análisis, y workflows específicos del ecosistema.

**Repo:** AlexanderKast/claude-skills (privado)

**Estado:** Activo, sincronización constante (último push hoy).`,
  },
  {
    workspace: "personal",
    name: "Claude Config (sync)",
    status: "active",
    description: `**Qué es:** Repo de configuración de Claude Code — settings, hooks, agentes, memorias.

**Para qué sirve:** Sincronizar la config de Claude Code entre dispositivos (Mac, Windows) vía git. Incluye hooks personalizados, permisos, agents locales y memorias.

**Repo:** AlexanderKast/claude-config (privado)

**Estado:** Activo, sincronización diaria.`,
  },
  {
    workspace: "personal",
    name: "Claude Skills Library",
    status: "active",
    description: `**Qué es:** Versión pública de una biblioteca curada de skills de Claude Code.

**Para qué sirve:** Compartir con la comunidad los skills más valiosos desarrollados, como fuente de autoridad técnica.

**Repo:** AlexanderKast/claude-skills-library (público)

**Estado:** Activo.`,
  },
  {
    workspace: "personal",
    name: "Obsidian Brain (repo)",
    status: "active",
    description: `**Qué es:** Repo git del vault de Obsidian — "segundo cerebro".

**Para qué sirve:** Respaldo versionado del Obsidian vault, sync entre dispositivos, y destino donde Jarvis guarda tareas completadas y reportes diarios.

**Estructura:**
- Sistema PARA (00-Inbox, 01-Proyectos, 02-Areas, 03-Recursos, 04-Archivo)
- 05-Zettelkasten / 06-Contenido / 07-Diario / 10-Claude
- jarvis/daily-engine/ — reportes diarios automáticos
- jarvis/tasks/YYYY-MM/ — tareas completadas del Command Center
- jarvis/reports/YYYY-WW.md — reportes semanales

**Repo:** AlexanderKast/obsidian-brain (privado)

**Estado:** Activo con sync automático via CouchDB LiveSync + git.`,
  },

  // === INFINY / Contratos ===
  {
    workspace: "infiny-latam",
    name: "Sistema de Contratos",
    status: "active",
    description: `**Qué es:** Sistema interno de generación y gestión de contratos del ecosistema (creadores, marcas, servicios).

**Para qué sirve:** Centralizar templates de contratos (UGC, consultoría, performance), firma electrónica, y tracking de estado legal de cada acuerdo.

**Repo:** AlexanderKast/Sistema-de-contratos (privado)

**Estado:** Activo. Último push 2026-04-06.`,
  },

  // === ARCHIVE (proyectos viejos) ===
  {
    workspace: "kreoon",
    name: "Legacy Calculator (Nu Skin)",
    status: "done",
    description: `**Qué es:** Calculadora web de ganancias para red de mercadeo Nu Skin.

**Para qué sirve:** Permite a distribuidores calcular sus comisiones proyectadas según volumen de ventas y estructura de downline.

**Stack:** Vanilla JS + HTML + CSS.

**Repo:** AlexanderKast/legacy-calculator (público)

**Estado:** Completado. Último commit feb 2026 (ajuste UX del campo cantidad). No requiere desarrollo activo.`,
  },
  {
    workspace: "kreoon",
    name: "Telegram Content Bot",
    status: "archived",
    description: `**Qué es:** Bot de Telegram para generación y publicación de contenido.

**Estado:** Archivado. Último push oct 2025. Reemplazado por Bot Telegram Reels y flujos más modernos en Jarvis.

**Repo:** AlexanderKast/telegram-content-bot`,
  },
  {
    workspace: "kreoon",
    name: "TG Media Agent",
    status: "archived",
    description: `**Qué es:** Agente de medios para Telegram (prototipo).

**Estado:** Archivado. Último push oct 2025. Experimento previo, sustituido por la arquitectura multi-agente de Jarvis.

**Repo:** AlexanderKast/tg-media-agent`,
  },
  {
    workspace: "kreoon",
    name: "Jarvis v1 (legacy)",
    status: "archived",
    description: `**Qué es:** Primera versión de Jarvis — WhatsApp AI agent para Kreoon.

**Estado:** Archivado. Reemplazado completamente por Jarvis v2 (este proyecto). Último push mar 2026.

**Repo:** AlexanderKast/jarvis-v2 (confusingly named)`,
  },
  {
    workspace: "personal",
    name: "Next.js with Supabase (template)",
    status: "archived",
    description: `**Qué es:** Template/prototipo Next.js + Supabase para pruebas de conceptos.

**Estado:** Archivado. Último push ago 2025.

**Repo:** AlexanderKast/nextjs-with-supabase`,
  },
  {
    workspace: "personal",
    name: "Firebase Next Proyecto",
    status: "archived",
    description: `**Qué es:** Prototipo Next.js + Firebase.

**Estado:** Archivado. Último push ago 2025. Stack migrado a Supabase en todos los proyectos nuevos.

**Repo:** AlexanderKast/firebase-next-proyecto`,
  },
  {
    workspace: "personal",
    name: "Product Dashboard",
    status: "archived",
    description: `**Qué es:** Dashboard de productos (prototipo).

**Estado:** Archivado. Último push abr 2025.

**Repo:** AlexanderKast/product-dashboard`,
  },
  {
    workspace: "personal",
    name: "Tablero Productos",
    status: "archived",
    description: `**Qué es:** Tablero de productos (prototipo previo al Product Dashboard).

**Estado:** Archivado. Último push abr 2025.

**Repo:** AlexanderKast/tablero-productos`,
  },
];

let created = 0;
let skipped = 0;
for (const p of projects) {
  const workspace_id = ws[p.workspace];
  if (!workspace_id) {
    console.warn("skip", p.name, "— no workspace", p.workspace);
    continue;
  }
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("name", p.name)
    .maybeSingle();
  if (existing) {
    // Update existing with new description/status
    await supabase
      .from("projects")
      .update({ description: p.description, status: p.status })
      .eq("id", existing.id);
    console.log("updated:", p.name);
    skipped++;
    continue;
  }
  const { error } = await supabase.from("projects").insert({
    workspace_id,
    name: p.name,
    description: p.description,
    status: p.status,
  });
  if (error) console.error("insert fail", p.name, error.message);
  else {
    console.log("created:", p.name);
    created++;
  }
}

// Tareas adicionales para los nuevos proyectos
const extraTasks = [
  { workspace: "infiny-latam", project: "Effix 2026 (Feria)", title: "Revisar auditoría SEO + Google Ads de la campaña", priority: "medium" },
  { workspace: "infiny-latam", project: "Effix 2026 (Feria)", title: "Definir fecha y venue de la feria 2026", priority: "high" },
  { workspace: "infiny-latam", project: "Sistema de Contratos", title: "Catalogar templates actuales y digitalizar firmas", priority: "medium" },
  { workspace: "ugc-colombia", project: "UGC Colombia (Web + Ecosistema)", title: "Review de workflows n8n activos del pipeline UGC", priority: "medium" },
  { workspace: "ugc-colombia", project: "UGC Colombia (Web + Ecosistema)", title: "Optimizar landing para creators y agregar form de aplicación", priority: "high" },
  { workspace: "personal", project: "OpenClaw", title: "Documentar las 13 skills activas en README", priority: "low" },
  { workspace: "personal", project: "Claude Skills (1280+)", title: "Curar top 50 skills más usadas para publicar en library", priority: "low" },
  { workspace: "personal", project: "Obsidian Brain (repo)", title: "Verificar sync automático con CouchDB LiveSync", priority: "medium" },
  { workspace: "kreoon", project: "KREOON Reports", title: "Definir KPIs principales a reportar en dashboard ejecutivo", priority: "medium" },
  { workspace: "kreoon", project: "Reporte Leads", title: "Conectar con Jarvis task-agent para crear tareas desde leads", priority: "medium" },
];

const { data: allProjects } = await supabase
  .from("projects")
  .select("id, name, workspace_id")
  .is("deleted_at", null);
const projLookup = new Map(allProjects.map((p) => [`${p.workspace_id}::${p.name}`, p.id]));

for (const t of extraTasks) {
  const workspace_id = ws[t.workspace];
  if (!workspace_id) continue;
  const project_id = projLookup.get(`${workspace_id}::${t.project}`);
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("title", t.title)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) continue;
  const { error } = await supabase.from("tasks").insert({
    workspace_id,
    project_id: project_id || null,
    title: t.title,
    priority: t.priority,
    status: "backlog",
    source: "api",
  });
  if (error) console.error("task fail", t.title, error.message);
  else console.log("task:", t.title);
}

console.log(`\nDone. ${created} nuevos · ${skipped} actualizados.`);

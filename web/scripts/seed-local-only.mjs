import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envFile = readFileSync(resolve(process.cwd(), "../.env"), "utf-8");
const env = Object.fromEntries(
  envFile.split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim()]; })
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: workspaces } = await supabase.from("workspaces").select("slug, id");
const ws = Object.fromEntries(workspaces.map((w) => [w.slug, w.id]));

const projects = [
  {
    workspace: "kreoon",
    name: "KREOON Visuals",
    status: "active",
    description: `**Qué es:** Proyecto frontend de visuales para KREOON — scaffold Vite + React 19 + TypeScript para componentes visuales, animaciones y UI kit propio.

**Para qué sirve:** Biblioteca de visuales y animaciones reutilizables en el ecosistema KREOON (PWA, Studio, landings). Punto central para el sistema de diseño de la marca.

**Stack:**
- Vite 8
- React 19
- TypeScript
- ESLint config propia
- Bridge con otras apps (carpeta /bridge)

**Ubicación local:** C:/Users/SICOMMER SAS/Projects/kreoon-visuals

**Estado:** ⚠️ **Solo local, sin repo en GitHub** — scaffold inicial commiteado 2026-03-27 pero no pusheado a remote. Pendiente: crear repo AlexanderKast/kreoon-visuals y hacer push inicial.

**Próximos hitos:** Inicializar remote, primer set de componentes visuales, integración con KREOON PWA.`,
  },
  {
    workspace: "infiny-latam",
    name: "Social Publisher",
    status: "active",
    description: `**Qué es:** Sistema de publicación automatizada en redes sociales — workflows n8n + migraciones Supabase.

**Para qué sirve:** Programar y publicar contenido en múltiples plataformas (Instagram, TikTok, YouTube, X) desde una cola unificada, con filtros de validación, selección de posts y videos, y enriquecimiento con Gemini.

**Stack:**
- n8n workflows (drive-query, filter-valid-posts, filter-videos, gemini enrichment)
- Supabase (migración 001_create_social_publisher_tables.sql)
- Google Drive API (fuente de assets)
- Gemini API (clasificación/enrichment)

**Módulos detectados:**
- Consultas a Google Drive para localizar assets
- Filtros de posts válidos (JavaScript code)
- Filtros de videos (JavaScript code)
- Fix instructions para recovery
- Body templates para Gemini

**Ubicación local:** C:/Users/SICOMMER SAS/Projects/social-publisher

**Estado:** ⚠️ **Solo local, sin git** — estructura armada con n8n y migraciones Supabase pendientes de aplicar. No versionado.

**Próximos hitos:** Inicializar repo, aplicar migración Supabase, importar workflows a n8n dev.kreoon.com, conectar con pipeline de UGC Colombia.`,
  },
  {
    workspace: "ugc-colombia",
    name: "Video Editor AI (FastAPI)",
    status: "active",
    description: `**Qué es:** Editor de video automatizado con IA — servidor FastAPI con pipeline paralelo streaming y WebSocket real-time.

**Para qué sirve:** Recibe un video en bruto, lo analiza con IA (escenas, transcripción, highlights), genera assets (cortes, thumbnails, overlays), y exporta un video editado vía FFmpeg. Diseñado para acelerar producción de UGC y reels.

**Stack:**
- FastAPI (Python) — servidor async
- WebSocket para eventos real-time por job
- FFmpeg (export final)
- Pipeline paralelo: /upload → /prepare (analyze + assets) → /export
- Frontend propio (/frontend) + templates Jinja
- Assets, outputs, uploads separados

**Endpoints principales:**
- \`POST /upload\` — subir video
- \`POST /prepare\` — análisis paralelo + generación de assets (streaming)
- \`POST /export\` — export final FFmpeg
- \`GET /status/{job_id}\`, \`GET /jobs\`, \`GET /download/{job_id}\`, \`GET /preview/{job_id}\`
- \`WS /ws/{job_id}\` — eventos real-time

**Ubicación local:** C:/Users/SICOMMER SAS/Projects/video-editor

**Estado:** ⚠️ **Solo local, sin git** — API funcional en Python con estructura completa. No versionado, no deployado.

**Próximos hitos:** Inicializar repo, dockerizar, integrar con pipeline UGC Colombia + Remotion, conectar con Jarvis para trigger desde WhatsApp.`,
  },
];

for (const p of projects) {
  const workspace_id = ws[p.workspace];
  if (!workspace_id) continue;
  const { data: existing } = await supabase.from("projects").select("id")
    .eq("workspace_id", workspace_id).eq("name", p.name).maybeSingle();
  if (existing) {
    await supabase.from("projects").update({ description: p.description, status: p.status }).eq("id", existing.id);
    console.log("updated:", p.name);
  } else {
    const { error } = await supabase.from("projects").insert({
      workspace_id, name: p.name, description: p.description, status: p.status,
    });
    if (error) console.error("fail", p.name, error.message);
    else console.log("created:", p.name);
  }
}

// Tareas high priority para estos proyectos locales sin versionar
const { data: allProjects } = await supabase.from("projects").select("id, name, workspace_id").is("deleted_at", null);
const projLookup = new Map(allProjects.map((p) => [`${p.workspace_id}::${p.name}`, p.id]));

const tasks = [
  { workspace: "kreoon", project: "KREOON Visuals", title: "Crear repo GitHub AlexanderKast/kreoon-visuals y push inicial", priority: "high" },
  { workspace: "infiny-latam", project: "Social Publisher", title: "Inicializar repo git y publicar en GitHub", priority: "high" },
  { workspace: "infiny-latam", project: "Social Publisher", title: "Aplicar migración 001_create_social_publisher_tables.sql", priority: "high" },
  { workspace: "infiny-latam", project: "Social Publisher", title: "Importar workflows n8n a dev.kreoon.com", priority: "medium" },
  { workspace: "ugc-colombia", project: "Video Editor AI (FastAPI)", title: "Inicializar repo git y publicar en GitHub", priority: "high" },
  { workspace: "ugc-colombia", project: "Video Editor AI (FastAPI)", title: "Dockerizar servidor FastAPI para deploy VPS", priority: "medium" },
  { workspace: "ugc-colombia", project: "Video Editor AI (FastAPI)", title: "Integrar con Jarvis (trigger desde WhatsApp)", priority: "low" },
];

for (const t of tasks) {
  const workspace_id = ws[t.workspace];
  const project_id = projLookup.get(`${workspace_id}::${t.project}`);
  const { data: existing } = await supabase.from("tasks").select("id")
    .eq("workspace_id", workspace_id).eq("title", t.title).is("deleted_at", null).maybeSingle();
  if (existing) continue;
  const { error } = await supabase.from("tasks").insert({
    workspace_id, project_id: project_id || null, title: t.title,
    priority: t.priority, status: "backlog", source: "api",
  });
  if (error) console.error("task fail", t.title, error.message);
  else console.log("task:", t.title);
}

console.log("Done.");

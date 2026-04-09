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

const { data: workspaces, error: wsErr } = await supabase
  .from("workspaces")
  .select("slug, id");
if (wsErr) {
  console.error(wsErr);
  process.exit(1);
}

const ws = Object.fromEntries(workspaces.map((w) => [w.slug, w.id]));
console.log("Workspaces:", Object.keys(ws).join(", "));

const projects = [
  { workspace: "kreoon", name: "KREOON (PWA)", description: "PWA React 18 + TypeScript + Vite + Supabase. Producción: https://kreoon.app" },
  { workspace: "kreoon", name: "KREOON Studio", description: "Next.js companion app para KREOON" },
  { workspace: "kreoon", name: "Jarvis v2", description: "WhatsApp AI agent en Docker + Command Center PWA" },
  { workspace: "kreoon", name: "Efficommerce Scheduler", description: "CRM + Booking en React + Supabase" },
  { workspace: "kreoon", name: "Bot Telegram Reels", description: "Bot Python + Telegram API para extracción de reels" },
  { workspace: "infiny-latam", name: "Meta Ads Agent", description: "Agente IA en Next.js 16 + Supabase para gestión de campañas Meta" },
  { workspace: "infiny-latam", name: "Ads Analizer", description: "Herramienta de análisis de campañas publicitarias" },
  { workspace: "infiny-latam", name: "Salud ProLab", description: "SaaS Dropshipping en Next.js 15 + Prisma" },
  { workspace: "ugc-colombia", name: "Contenido UGC Colombia", description: "Pipeline de contenido para @agenciaugccolombia" },
  { workspace: "ugc-colombia", name: "PDF Lead Magnet", description: "UGC-Colombia-Estrategia-Contenido-2026.pdf" },
  { workspace: "ugc-colombia", name: "Serie Tips Contenido", description: "5 episodios de Tips de Creación de Contenido" },
  { workspace: "reyes-contenido", name: "Comunidad Reyes", description: "Comunidad de creadores de contenido" },
  { workspace: "cafetiando", name: "Podcast Cafetiando", description: "Grabación y distribución del podcast" },
  { workspace: "sanavi", name: "Sanavi Natural", description: "Línea de productos naturales" },
  { workspace: "personal", name: "Segundo Cerebro", description: "Obsidian vault en F:/Documents/GitHub/Obsidian" },
  { workspace: "personal", name: "Remotion my-video", description: "Videos programáticos con Remotion + ElevenLabs + Veo 3" },
];

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
    console.log("exists:", p.name);
    continue;
  }
  const { error } = await supabase.from("projects").insert({
    workspace_id,
    name: p.name,
    description: p.description,
    status: "active",
  });
  if (error) console.error("insert fail", p.name, error.message);
  else console.log("created:", p.name);
}

const tasks = [
  { workspace: "kreoon", project: "Jarvis v2", title: "Aplicar migración 0002_chat_history.sql en Supabase", priority: "urgent" },
  { workspace: "kreoon", project: "Jarvis v2", title: "Renovar créditos Anthropic (agotados, corriendo en Gemini fallback)", priority: "urgent" },
  { workspace: "kreoon", project: "Jarvis v2", title: "Habilitar Google Drive API en jarvis-kreoon-ai", priority: "high" },
  { workspace: "kreoon", project: "Jarvis v2", title: "Smoke test PWA instalada en móvil iOS y Android", priority: "high" },
  { workspace: "kreoon", project: "Jarvis v2", title: "Conectar cuenta Google founder para sync de Calendar", priority: "high" },
  { workspace: "kreoon", project: "Jarvis v2", title: "Probar captura rápida del Command Center con Cmd+K", priority: "medium" },
  { workspace: "kreoon", project: "Jarvis v2", title: "Verificar webhook WhatsApp /webhook/jarvis-tasks", priority: "medium" },
  { workspace: "kreoon", project: "KREOON (PWA)", title: "Revisar bundle size y lazy loading", priority: "medium" },
  { workspace: "kreoon", project: "KREOON (PWA)", title: "Revisar flujo onboarding y políticas RLS", priority: "medium" },
  { workspace: "kreoon", project: "Bot Telegram Reels", title: "Probar extracción de reels desde Instagram", priority: "low" },
  { workspace: "infiny-latam", project: "Meta Ads Agent", title: "Conectar cuenta Meta Ads para pruebas", priority: "high" },
  { workspace: "infiny-latam", project: "Meta Ads Agent", title: "Definir prompts base del agente para auditoría", priority: "medium" },
  { workspace: "infiny-latam", project: "Ads Analizer", title: "Revisar estado del proyecto y próximos pasos", priority: "low" },
  { workspace: "infiny-latam", project: "Salud ProLab", title: "Checkpoint del SaaS y siguientes hitos", priority: "medium" },
  { workspace: "ugc-colombia", project: "PDF Lead Magnet", title: "Corregir footer que desborda en algunas páginas", priority: "high" },
  { workspace: "ugc-colombia", project: "Serie Tips Contenido", title: "Grabar episodio 1 con Remotion + ElevenLabs", priority: "high" },
  { workspace: "ugc-colombia", project: "Serie Tips Contenido", title: "Guion y storyboard episodios 2-5", priority: "medium" },
  { workspace: "ugc-colombia", project: "Contenido UGC Colombia", title: "Calendario de contenido semanal IG @agenciaugccolombia", priority: "medium" },
  { workspace: "personal", project: "Remotion my-video", title: "Push de my-video a GitHub", priority: "medium" },
  { workspace: "personal", project: "Segundo Cerebro", title: "Configurar fal.ai API key para generación carruseles IA", priority: "medium" },
  { workspace: "reyes-contenido", project: "Comunidad Reyes", title: "Definir pilares de contenido y onboarding miembros", priority: "medium" },
  { workspace: "cafetiando", project: "Podcast Cafetiando", title: "Agendar primera grabación", priority: "low" },
  { workspace: "sanavi", project: "Sanavi Natural", title: "Definir catálogo inicial de productos", priority: "medium" },
];

const { data: allProjects } = await supabase
  .from("projects")
  .select("id, name, workspace_id")
  .is("deleted_at", null);
const projLookup = new Map(allProjects.map((p) => [`${p.workspace_id}::${p.name}`, p.id]));

for (const t of tasks) {
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
  if (existing) {
    console.log("task exists:", t.title);
    continue;
  }
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

console.log("Done.");

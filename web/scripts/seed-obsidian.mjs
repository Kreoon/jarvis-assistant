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

// Proyectos estratégicos sin código (Obsidian vault)
const projects = [
  {
    workspace: "reyes-contenido",
    name: "Curso Creador 360",
    status: "active",
    description: `**Qué es:** Curso educativo completo "Creador 360" — programa formativo insignia de Los Reyes del Contenido.

**Para qué sirve:** Certificación para creadores de contenido UGC + estrategas digitales. Fuente de ingresos recurrente del pilar comunidad y posicionamiento de autoridad de los instructores.

**Estructura:**
- **8 módulos + M0 índice maestro**
- **23 temas** totales
- **87 videos cortos** con guiones de teleprompter, derroteros y checkpoints Edpuzzle

| Módulo | Instructor | Videos | Duración |
|---|---|---|---|
| M1 Mentalidad del Creador Estratégico | Alexander + Equipo | 11 | ~33 min |
| M2 Psicología del Contenido que Convierte | Alexander + Lucas | 10 | ~33 min |
| M3 Producción Audiovisual Vieja Escuela | Santiago + Lucas | 11 | ~34 min |
| M4 Edición Performance | Santiago + Alexander | 7 | ~23 min |
| M5 IA para Contenido | Alexander | 13 | ~45 min |
| M6-M8 | — | por definir | — |

**Archivos generados** (2026-04-07): \`F:/Descargas/Modulos-Curso-Reyes-Contenido/\`

**Instructores:** Alexander Cast, Lucas, Santiago, Equipo.

**Estado:** ✅ **LISTO PARA GRABAR** — Todos los documentos de producción (9 docx) generados. Pendiente: grabación, edición, subida a plataforma LMS.

**Próximos hitos:** Grabar módulos 1-5, editar, decidir plataforma (Hotmart/Teachable/Kajabi), landing de ventas, lanzamiento.`,
  },
  {
    workspace: "ugc-colombia",
    name: "Banco 250 Cápsulas Diana Mile",
    status: "active",
    description: `**Qué es:** Banco de 250 ideas para Reels/TikTok de Diana Milena Torres (@militougc) — admin de UGC Colombia y co-instructora Certificación UGC Los Reyes.

**Para qué sirve:** Pipeline de contenido a largo plazo para la marca personal de Diana, distribuido en 10 pilares temáticos de 25 ideas cada uno.

**Pilares:**
1. UGC para principiantes
2. (9 pilares adicionales por mapear del documento)

**Tono:** Natural, cercano, aspiracional, mentora femenina. "Mi amor", "mi gente linda".

**Marcas reales integradas:** Galia Vital, Clorofull, Animus Lab, WomanBlock, Beemo, Gomitas Slimx, Multibrina.

**Equipo:**
- **Creadora:** Diana Mile (@militougc)
- **Editor:** Sebastian Romero

**Ubicación:** Obsidian vault → 06 - Contenido/Ideas/Diana-Mile-250-Capsulas-Reels.md

**Estado:** En progreso — banco creado, en proceso de grabación y publicación progresiva.

**Próximos hitos:** Calendario de grabación semanal, plantilla de brief por cápsula, tracking de performance por idea.`,
  },
  {
    workspace: "personal",
    name: "Marca Personal Alexander Cast",
    status: "active",
    description: `**Qué es:** Sistema operativo completo de la marca personal "Alexander Cast — Dios. Estrategia. IA."

**Para qué sirve:** Pilar #1 del ecosistema — generar autoridad, leads y posicionamiento del fundador. Alimenta todos los demás pilares con confianza y alcance orgánico.

**Posicionamiento:** "Dios. Estrategia. IA." — intersección entre fe, estrategia de negocio y tecnología/IA.

**Carpeta maestra** (Obsidian 06 - Contenido/Marca-Personal-Alexander-Cast/):
- **00-Estrategia** — plan maestro, ICP, mensajes clave
- **01-Configuración-Plataformas** — setup IG, YouTube, TikTok, LinkedIn, X
- **02-YouTube** — estrategia de canal, series, thumbnails
- **03-Reels-TikTok-Shorts** — pipeline corto
- **04-Referencias** — benchmarks
- **CARPETA-MAESTRA-Alexander-Cast.pdf** — documento guía
- **README.md** — índice general

**Plan Maestro:** \`Plan-Maestro-Alexander-Cast-Completo.pdf\` disponible en 06-Contenido.

**Herramientas vinculadas:**
- Remotion (producción videos)
- ElevenLabs (voz Cristian Sanchez)
- Canva (carruseles + thumbnails)
- Obsidian (sistema)

**Estado:** Sistema armado, en ejecución. Pendiente: calendario trimestral de contenido y producción constante.`,
  },
  {
    workspace: "ugc-colombia",
    name: "Banco de Hooks 60",
    status: "active",
    description: `**Qué es:** Banco de 60 hooks probados para videos cortos.

**Para qué sirve:** Biblioteca de aperturas virales reutilizables para Reels, TikToks y Shorts de todo el ecosistema (UGC Colombia, Diana Mile, Alexander Cast, curso Creador 360).

**Ubicación:** Obsidian 06 - Contenido/Banco-de-Hooks-60.md

**Estado:** Activo — banco curado listo para usar. Se amplía con hooks que prueben alto engagement.`,
  },
  {
    workspace: "ugc-colombia",
    name: "Calendario Contenido Abril 2026",
    status: "active",
    description: `**Qué es:** Calendario editorial del mes de abril 2026.

**Para qué sirve:** Planificación mensual de publicaciones por pilar (UGC Colombia, Alexander Cast, Reyes del Contenido), con formatos, temas y responsables.

**Ubicación:** Obsidian 06 - Contenido/Calendario-Contenido-Abril-2026.md

**Estado:** Activo este mes. Próximo: calendario de mayo 2026.`,
  },
  {
    workspace: "ugc-colombia",
    name: "Manual Operativo Community Manager",
    status: "active",
    description: `**Qué es:** Manual operativo para el rol de Community Manager del ecosistema.

**Para qué sirve:** SOP (Standard Operating Procedure) para cualquier persona que gestione la comunidad y el engagement de las redes sociales. Respuestas tipo, tiempos, tono, escalamiento a ventas.

**Ubicación:** Obsidian 06 - Contenido/Manual-Operativo-Community-Manager.md

**Estado:** Listo para onboarding de nuevos community managers.`,
  },
  {
    workspace: "ugc-colombia",
    name: "Guiones Primeros 10 Videos",
    status: "active",
    description: `**Qué es:** Set de guiones para los primeros 10 videos de lanzamiento de una cuenta/marca.

**Para qué sirve:** Kickoff operativo para lanzar cualquier nueva cuenta de UGC (creator o marca). Garantiza los primeros 10 videos listos con estructura viral probada.

**Ubicación:** Obsidian 06 - Contenido/Guiones-Primeros-10-Videos.md

**Estado:** Template reutilizable. Se instancia por cada nuevo creator.`,
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

// Tareas asociadas
const { data: allProjects } = await supabase.from("projects").select("id, name, workspace_id").is("deleted_at", null);
const projLookup = new Map(allProjects.map((p) => [`${p.workspace_id}::${p.name}`, p.id]));

const tasks = [
  { workspace: "reyes-contenido", project: "Curso Creador 360", title: "Grabar módulos 1-5 del curso", priority: "urgent" },
  { workspace: "reyes-contenido", project: "Curso Creador 360", title: "Completar documentos de producción M6-M8", priority: "high" },
  { workspace: "reyes-contenido", project: "Curso Creador 360", title: "Decidir plataforma LMS (Hotmart / Teachable / Kajabi)", priority: "high" },
  { workspace: "reyes-contenido", project: "Curso Creador 360", title: "Editar videos grabados con checkpoints Edpuzzle", priority: "high" },
  { workspace: "reyes-contenido", project: "Curso Creador 360", title: "Landing page de ventas del curso", priority: "medium" },
  { workspace: "reyes-contenido", project: "Curso Creador 360", title: "Secuencia de email marketing de lanzamiento", priority: "medium" },
  { workspace: "ugc-colombia", project: "Banco 250 Cápsulas Diana Mile", title: "Mapear y documentar los 10 pilares temáticos completos", priority: "high" },
  { workspace: "ugc-colombia", project: "Banco 250 Cápsulas Diana Mile", title: "Calendario de grabación semanal con Sebastian Romero", priority: "high" },
  { workspace: "ugc-colombia", project: "Banco 250 Cápsulas Diana Mile", title: "Template de brief por cápsula para producción", priority: "medium" },
  { workspace: "personal", project: "Marca Personal Alexander Cast", title: "Calendario trimestral de contenido Q2 2026", priority: "high" },
  { workspace: "personal", project: "Marca Personal Alexander Cast", title: "Revisar Plan Maestro y ajustar al rediseño del ecosistema", priority: "medium" },
  { workspace: "ugc-colombia", project: "Calendario Contenido Abril 2026", title: "Preparar calendario de Mayo 2026", priority: "medium" },
  { workspace: "ugc-colombia", project: "Manual Operativo Community Manager", title: "Revisar tiempos de respuesta estándar y actualizar SOP", priority: "low" },
];

for (const t of tasks) {
  const workspace_id = ws[t.workspace];
  if (!workspace_id) continue;
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

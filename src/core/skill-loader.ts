import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { agentLogger } from '../shared/logger.js';

const log = agentLogger('skill-loader');

// === Skill types ===

export interface Skill {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  content: string;
}

// === Keyword map: skill filename (without .md) → trigger keywords ===
// Keywords are matched against the user message (case-insensitive)

const SKILL_KEYWORDS: Record<string, string[]> = {
  skill_comportamiento_humano: [
    'psicología', 'comportamiento', 'maslow', 'disc', 'sesgo', 'sesgos',
    'cognitivo', 'persuasión', 'motivación', 'personalidad', 'viaje del héroe',
    'economía conductual', 'nudge', 'heurística',
  ],
  skill_neuroventas: [
    'neuroventas', 'cialdini', 'gatillo mental', 'gatillos', 'cerebro triuno',
    'reciprocidad', 'escasez', 'autoridad social', 'neurocopy', 'neuromarketing',
    'persuasión científica',
  ],
  skill_creacion_contenido: [
    'crear contenido', 'producción', 'audiovisual', 'ugc', 'guión', 'guion',
    'grabación', 'grabar', 'edición', 'editar', 'formato video', 'reel',
    'reels', 'carrusel', 'story', 'stories', 'creator', 'creador',
  ],
  skill_estrategia_contenido: [
    'estrategia contenido', 'pilares contenido', 'calendario contenido',
    'tofu', 'mofu', 'bofu', 'embudo contenido', 'repurposing', 'reciclaje contenido',
    'plan contenido', 'content strategy',
  ],
  skill_copywriting_avanzado: [
    'copy', 'copywriting', 'aida', 'pas formula', 'bab', 'headline',
    'headlines', 'cta', 'llamada a la acción', 'texto persuasivo',
    'palabras de poder', 'hook', 'hooks', 'fórmula escritura',
  ],
  skill_humanizer: [
    'humanizar', 'humanizer', 'suena a ia', 'suena artificial', 'parece robot',
    'más humano', 'más natural', 'detectar ia', 'anti ia', 'anti-ia',
    'texto natural', 'reescribir natural', 'sonar humano',
  ],
  skill_viralidad_redes: [
    'viral', 'viralidad', 'algoritmo', 'algoritmos', 'alcance', 'reach',
    'engagement', 'instagram algoritmo', 'tiktok algoritmo', 'youtube algoritmo',
    'linkedin algoritmo', 'hack alcance', 'crecer en redes',
  ],
  skill_growth_hacking: [
    'growth', 'growth hacking', 'growth loop', 'a/b test', 'ab test',
    'lead magnet', 'conversión', 'funnel conversión', 'métricas crecimiento',
    'pirate metrics', 'aarrr', 'north star metric',
  ],
  skill_branding_personal: [
    'marca personal', 'branding', 'posicionamiento', 'diferenciación',
    'arquetipo', 'arquetipos', 'personal brand', 'monetizar marca',
    'identidad de marca', 'propuesta de valor',
  ],
  skill_ventas_negociacion: [
    'ventas', 'vender', 'negociación', 'negociar', 'objeción', 'objeciones',
    'pricing', 'precio', 'spin selling', 'pipeline', 'cierre de venta',
    'prospección', 'propuesta comercial', 'cotización',
  ],
  skill_seo_posicionamiento: [
    'seo', 'posicionamiento web', 'google ranking', 'keywords', 'schema',
    'on-page', 'backlinks', 'search console', 'geo', 'aeo', 'seo local',
    'youtube seo', 'búsqueda orgánica',
  ],
  skill_whatsapp_marketing: [
    'whatsapp marketing', 'whatsapp business', 'whatsapp api', 'chatbot',
    'automatización whatsapp', 'broadcast', 'plantilla whatsapp',
    'mensaje masivo', 'whatsapp ventas',
  ],
  skill_community_building: [
    'comunidad', 'community', 'community building', 'gamificación',
    'onboarding comunidad', 'engagement comunidad', 'clg', 'space framework',
    'monetizar comunidad', 'grupo', 'miembros',
  ],
  skill_infoproductos_educacion: [
    'infoproducto', 'curso online', 'curso digital', 'lanzamiento',
    'escalera de valor', 'plf', 'launch', 'evergreen', 'webinar launch',
    'educación digital', 'ebook', 'masterclass', 'membresía',
  ],
  skill_ugc_agency_ops: [
    'agencia ugc', 'operaciones agencia', 'brief ugc', 'gestión creators',
    'pricing ugc', 'contrato creator', 'pipeline clientes', 'onboarding cliente',
    'escalar agencia', 'agency ops',
  ],
  skill_paid_media: [
    'ads', 'pauta', 'meta ads', 'facebook ads', 'google ads', 'tiktok ads',
    'roas', 'cpa', 'cpm', 'ctr', 'creative testing', 'audiencias',
    'campaña pagada', 'presupuesto ads', 'pixel', 'tracking',
  ],
  skill_consultoria_digital: [
    'consultoría', 'consultoria', 'diagnóstico digital', 'sostac', 'race',
    'framework consultoría', 'client management', 'propuesta consultoría',
    'auditoría digital',
  ],
  skill_funnels_email_marketing: [
    'funnel', 'embudo', 'email marketing', 'secuencia email', 'tripwire',
    'vsl', 'webinar funnel', 'challenge funnel', 'automatización email',
    'lead nurturing', 'drip campaign', 'newsletter',
  ],
  skill_data_analytics: [
    'analytics', 'ga4', 'google analytics', 'métricas', 'dashboard',
    'atribución', 'roi contenido', 'kpi', 'tracking', 'data',
    'reporte métricas', 'conversiones',
  ],
  skill_public_speaking_authority: [
    'speaking', 'conferencia', 'tarima', 'orador', 'speaker', 'pr',
    'relaciones públicas', 'prensa', 'autoridad', 'linkedin autoridad',
    'speaker kit', 'media kit', 'podcast guest',
  ],
  skill_finanzas_creadores: [
    'finanzas', 'impuestos', 'cash flow', 'facturación', 'cobro internacional',
    'wise', 'payoneer', 'pricing servicios', 'rentabilidad', 'costos',
    'contabilidad', 'flujo de caja', 'margen',
  ],
  skill_storytelling_avanzado: [
    'storytelling', 'storybrand', 'hero journey', 'pixar', 'narrativa',
    'historia de marca', 'transmedia', 'vulnerabilidad', 'arco narrativo',
    'contar historias', 'story',
  ],
  skill_productizacion: [
    'productizar', 'productización', 'producto digital', 'escalera de valor',
    'servicio productizado', 'paquetizar', 'automatizar delivery',
    'producto escalable', 'digital product',
  ],
  skill_ia_contenido: [
    'ia contenido', 'inteligencia artificial', 'chatgpt', 'midjourney',
    'workflow ia', 'prompt', 'prompts', 'automatizar contenido',
    'stack ia', 'herramientas ia', 'ai tools',
  ],
  skill_agenda_inteligente: [
    'agenda', 'calendario', 'reunión', 'reuniones', 'evento', 'eventos',
    'cita', 'bloquear tiempo', 'time blocking', 'productividad',
    'planificar semana', 'programar', 'horario', 'disponibilidad',
    'organizar semana', 'organizar agenda', 'deep work', 'batching',
    'bloquear', 'mi semana', 'mi día', 'agendar',
  ],
};

// === Loader ===

const SKILLS_DIR = join(
  new URL('..', import.meta.url).pathname,
  '..',
  'data',
  'skills',
);

let skillsCache: Skill[] | null = null;

function loadSkills(): Skill[] {
  if (skillsCache) return skillsCache;

  try {
    const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    skillsCache = files.map(file => {
      const id = file.replace('.md', '');
      const raw = readFileSync(join(SKILLS_DIR, file), 'utf-8');

      // Parse frontmatter
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let name = id;
      let description = '';
      let content = raw;

      if (fmMatch) {
        const fm = fmMatch[1];
        const nameMatch = fm.match(/name:\s*(.+)/);
        const descMatch = fm.match(/description:\s*(.+)/);
        if (nameMatch) name = nameMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
        content = fmMatch[2].trim();
      }

      return {
        id,
        name,
        description,
        keywords: SKILL_KEYWORDS[id] || [],
        content,
      };
    });

    log.info({ count: skillsCache.length }, 'Skills loaded');
    return skillsCache;
  } catch (error: any) {
    log.error({ error: error.message }, 'Failed to load skills');
    return [];
  }
}

// === Matcher ===

export function matchSkills(message: string, maxSkills = 2): Skill[] {
  const skills = loadSkills();
  const msgLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const scored: { skill: Skill; score: number }[] = [];

  for (const skill of skills) {
    let score = 0;

    for (const keyword of skill.keywords) {
      const kwNorm = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (msgLower.includes(kwNorm)) {
        // Longer keywords = more specific = higher score
        score += kwNorm.length;
      }
    }

    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  // Sort by score descending, return top N
  scored.sort((a, b) => b.score - a.score);
  const matched = scored.slice(0, maxSkills).map(s => s.skill);

  if (matched.length) {
    log.info(
      { matched: matched.map(s => s.id), message: message.slice(0, 100) },
      'Skills matched',
    );
  }

  return matched;
}

// === Format for injection into system prompt ===

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (!skills.length) return '';

  const sections = skills.map(s =>
    `## 📚 Skill activa: ${s.name}\n${s.description}\n\n${s.content}`
  );

  return `\n\n---\n# SKILLS DE CONOCIMIENTO ACTIVADAS\nUsa el siguiente conocimiento especializado para enriquecer tu respuesta. Aplica los frameworks, fórmulas y técnicas relevantes de forma natural.\n\n${sections.join('\n\n---\n\n')}`;
}

// Load content for a specific skill by ID
export function loadSkillContent(skillId: string): string | null {
  const skills = loadSkills();
  const skill = skills.find(s => s.id === skillId);
  return skill?.content ?? null;
}

// Force reload (useful after adding new skills)
export function reloadSkills(): void {
  skillsCache = null;
  loadSkills();
}

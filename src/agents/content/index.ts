import { BaseAgent } from '../../core/base-agent.js';
import { searchWeb } from '../../shared/perplexity.js';
import type { AgentRequest, LLMTool } from '../../shared/types.js';

const SYSTEM_PROMPT = `Eres el agente de contenido de Jarvis para Kreoon, una agencia UGC en Colombia.

Especializado en:
- Creación de contenido UGC (User Generated Content) para marcas en LATAM y USA
- Copywriting persuasivo y estrategia de contenido
- Generación de captions, hashtags, guiones y briefs para creators

Dominas las fórmulas de copywriting:
- AIDA (Atención, Interés, Deseo, Acción)
- PAS (Problema, Agitación, Solución)
- BAB (Before, After, Bridge)
- 4U (Urgente, Único, Útil, Ultra-específico)
- ACCA (Awareness, Comprensión, Convicción, Acción)

Conoces los algoritmos y mejores prácticas de:
- Instagram (Reels, carruseles, Stories)
- TikTok (hooks, retención, trending sounds)
- YouTube (títulos, thumbnails, retención)
- LinkedIn (contenido B2B, autoridad)

Generas contenido en español por defecto (español colombiano/LATAM natural, no genérico).
Puedes generar en inglés si el usuario lo solicita explícitamente.

Tono adaptable según necesidad: profesional, casual, persuasivo, educativo.
Siempre orientado a resultados: engagement, conversiones, awareness.`;

const tools: LLMTool[] = [
  {
    name: 'web_search',
    description: 'Busca información actualizada en la web via Perplexity. Úsalo para tendencias, noticias, referencias de contenido o datos de mercado.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La consulta de búsqueda en lenguaje natural',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_caption',
    description: 'Genera un caption optimizado para redes sociales según la plataforma, tema y tono deseado.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Plataforma de destino: instagram, tiktok, youtube, linkedin, twitter',
        },
        topic: {
          type: 'string',
          description: 'Tema o producto sobre el que trata el contenido',
        },
        tone: {
          type: 'string',
          description: 'Tono del caption: casual, profesional, persuasivo, educativo, humorístico',
        },
        language: {
          type: 'string',
          description: 'Idioma: español (default) o inglés',
        },
      },
      required: ['platform', 'topic'],
    },
  },
  {
    name: 'generate_hashtags',
    description: 'Genera una lista de hashtags relevantes y optimizados para la plataforma y tema dados.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Tema o nicho del contenido',
        },
        platform: {
          type: 'string',
          description: 'Plataforma: instagram, tiktok, youtube, linkedin',
        },
        count: {
          type: 'number',
          description: 'Cantidad de hashtags a generar (default: 15)',
        },
      },
      required: ['topic', 'platform'],
    },
  },
  {
    name: 'content_calendar',
    description: 'Crea un calendario de contenido estructurado con ideas de posts para los días y plataformas indicados.',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Número de días del calendario',
        },
        pillars: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pilares de contenido (ej: educativo, entretenimiento, venta, behind-the-scenes)',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Plataformas a incluir: instagram, tiktok, youtube, linkedin',
        },
      },
      required: ['days', 'pillars', 'platforms'],
    },
  },
  {
    name: 'write_copy',
    description: 'Escribe copy persuasivo usando fórmulas probadas de copywriting (AIDA, PAS, BAB, 4U, ACCA).',
    parameters: {
      type: 'object',
      properties: {
        formula: {
          type: 'string',
          description: 'Fórmula a usar: AIDA, PAS, BAB, 4U, ACCA',
        },
        product: {
          type: 'string',
          description: 'Producto o servicio del que se escribe',
        },
        audience: {
          type: 'string',
          description: 'Audiencia objetivo (ej: emprendedores colombianos 25-35 años)',
        },
        pain_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Puntos de dolor o problemas principales de la audiencia',
        },
      },
      required: ['formula', 'product', 'audience'],
    },
  },
  {
    name: 'ugc_brief',
    description: 'Genera un brief completo para creators UGC con instrucciones claras de grabación, mensajes clave y entregables.',
    parameters: {
      type: 'object',
      properties: {
        brand: {
          type: 'string',
          description: 'Nombre de la marca o cliente',
        },
        product: {
          type: 'string',
          description: 'Producto o servicio a promocionar',
        },
        objective: {
          type: 'string',
          description: 'Objetivo del contenido: awareness, conversión, retención, educación',
        },
        platform: {
          type: 'string',
          description: 'Plataforma de destino: tiktok, instagram, youtube',
        },
        duration: {
          type: 'string',
          description: 'Duración del video (ej: 15s, 30s, 60s)',
        },
      },
      required: ['brand', 'product', 'objective', 'platform'],
    },
  },
];

class ContentAgent extends BaseAgent {
  constructor() {
    super({
      name: 'content',
      systemPrompt: SYSTEM_PROMPT,
      tools,
      toolHandlers: {
        web_search: async (args) => {
          const query = args.query as string;
          const result = await searchWeb(query);
          return { ...result, query };
        },

        generate_caption: async (args) => {
          return {
            action: 'generate_caption',
            platform: args.platform,
            topic: args.topic,
            tone: args.tone ?? 'casual',
            language: args.language ?? 'español',
            instructions: `Genera un caption de alta conversión para ${args.platform} sobre: "${args.topic}".
Tono: ${args.tone ?? 'casual'}. Idioma: ${args.language ?? 'español'}.
Incluye: hook poderoso en la primera línea, cuerpo con valor real, CTA claro al final.
Adapta el formato y longitud óptimos para ${args.platform}.`,
          };
        },

        generate_hashtags: async (args) => {
          const count = (args.count as number) ?? 15;
          return {
            action: 'generate_hashtags',
            topic: args.topic,
            platform: args.platform,
            count,
            instructions: `Genera ${count} hashtags optimizados para ${args.platform} sobre el tema: "${args.topic}".
Mix recomendado: 30% hashtags grandes (>1M posts), 40% medianos (100K-1M), 30% pequeños (<100K) o de nicho.
Incluye hashtags en español e inglés si aplica para mayor alcance.
Formato: lista de hashtags listos para copiar y pegar.`,
          };
        },

        content_calendar: async (args) => {
          const pillars = (args.pillars as string[]).join(', ');
          const platforms = (args.platforms as string[]).join(', ');
          return {
            action: 'content_calendar',
            days: args.days,
            pillars: args.pillars,
            platforms: args.platforms,
            instructions: `Crea un calendario de contenido para ${args.days} días.
Pilares de contenido: ${pillars}.
Plataformas: ${platforms}.
Formato tabla por día: Fecha | Pilar | Plataforma | Formato (Reel/Carrusel/Story/etc) | Idea/Tema | Hook sugerido.
Distribuye los pilares de forma balanceada. Incluye ideas específicas y accionables, no genéricas.
Considera los mejores días/horarios para cada plataforma.`,
          };
        },

        write_copy: async (args) => {
          const painPoints = args.pain_points
            ? `\nPuntos de dolor: ${(args.pain_points as string[]).join(', ')}`
            : '';
          return {
            action: 'write_copy',
            formula: args.formula,
            product: args.product,
            audience: args.audience,
            pain_points: args.pain_points ?? [],
            instructions: `Escribe copy persuasivo usando la fórmula ${args.formula} para:
Producto/Servicio: "${args.product}"
Audiencia objetivo: "${args.audience}"${painPoints}

Aplica la fórmula ${args.formula} correctamente:
${getFormulaGuide(args.formula as string)}

El copy debe ser en español colombiano/LATAM natural. Longitud apropiada para uso en redes sociales o landing page.`,
          };
        },

        ugc_brief: async (args) => {
          return {
            action: 'ugc_brief',
            brand: args.brand,
            product: args.product,
            objective: args.objective,
            platform: args.platform,
            duration: args.duration ?? '30s',
            instructions: `Genera un brief profesional de UGC para:
Marca: "${args.brand}"
Producto: "${args.product}"
Objetivo: "${args.objective}"
Plataforma: ${args.platform}
Duración: ${args.duration ?? '30s'}

El brief debe incluir:
1. Resumen del proyecto y contexto de marca
2. Objetivo del video y KPI principal
3. Audiencia objetivo
4. Mensajes clave (3 máximo)
5. Estructura del video (hook, desarrollo, CTA) con tiempos
6. Do's y Don'ts de grabación
7. Referencias visuales o estilo deseado
8. Entregables: formato, resolución, archivos requeridos
9. Deadline y proceso de revisión

Redactar en español, tono profesional pero accesible para creators independientes.`,
          };
        },
      },
    });
  }
}

function getFormulaGuide(formula: string): string {
  const guides: Record<string, string> = {
    AIDA: '- Atención: hook que detiene el scroll\n- Interés: datos o historia que engancha\n- Deseo: beneficios transformadores, no características\n- Acción: CTA claro y urgente',
    PAS: '- Problema: nombra el dolor exacto que siente la audiencia\n- Agitación: amplifica las consecuencias de no resolverlo\n- Solución: presenta el producto como la salida ideal',
    BAB: '- Before: describe la situación actual dolorosa\n- After: pinta la vida ideal después de la solución\n- Bridge: el producto es el puente entre ambas realidades',
    '4U': '- Urgente: crea sentido de urgencia real\n- Único: diferenciador claro frente a la competencia\n- Útil: valor concreto y medible para la audiencia\n- Ultra-específico: datos, números, resultados exactos',
    ACCA: '- Awareness: presenta el problema que quizás no saben que tienen\n- Comprensión: explica por qué importa y cómo les afecta\n- Convicción: prueba social, evidencia, resultados\n- Acción: CTA directo y sin fricción',
  };
  return guides[formula.toUpperCase()] ?? `Aplica correctamente los pasos de la fórmula ${formula}.`;
}

export const contentAgent = new ContentAgent();

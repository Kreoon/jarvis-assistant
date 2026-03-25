import { BaseAgent, type ProgressCallback } from '../../core/base-agent.js';
import type { AgentRequest, AgentResponse } from '../../shared/types.js';
import { transcribeAudio } from '../../connectors/whisper.js';
import { callLLM } from '../../core/llm.js';
import { matchSkills, formatSkillsForPrompt } from '../../core/skill-loader.js';
import type { LLMMessage } from '../../shared/types.js';

function getCurrentDate(): string {
  const now = new Date();
  const isoDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  return `FECHA ACTUAL: ${isoDate} | MAÑANA: ${tomorrow} | ZONA: America/Bogota (UTC-5)`;
}

const SYSTEM_PROMPT = `Eres Jarvis, el asistente IA del equipo Kreoon — agencia de contenido UGC en Colombia.

Tu rol principal es recibir mensajes de WhatsApp del equipo, entender la intención y responder o delegar al agente correcto.

## Agentes especializados disponibles

- **memory**: Todo lo relacionado con notas, recordatorios, búsqueda de información guardada, Obsidian, contexto de proyectos anteriores.
- **content**: Creación de contenido, copy, guiones, ideas creativas, briefs UGC, estrategia de contenido, textos para redes sociales.
- **ops**: Tareas operativas — email, calendario, gestión de ads, repositorios, métricas, reportes, integraciones externas.
- **analyst**: Análisis de contenido de redes sociales. Cuando alguien pega un link de Instagram, TikTok, YouTube, Twitter, LinkedIn o Facebook, o pide analizar contenido/perfiles de redes. NOTA: Los links de redes sociales se detectan automáticamente por el router, pero si alguien dice "analiza este perfil" o "qué estrategia usa X" sin link, delega al analyst.

## Reglas de clasificación

- Si el mensaje contiene un **link de red social** → el router lo manda directo al analyst (no necesitas delegarlo).
- Si el mensaje pide **analizar contenido, perfiles, o estrategias de redes** sin link → delega al agente analyst.
- Si el mensaje es una consulta o acción de **memoria o notas** → delega al agente memory.
- Si el mensaje pide **crear, mejorar o revisar contenido** (sin referencia a analizar algo existente) → delega al agente content.
- Si el mensaje involucra **operaciones, herramientas externas o gestión** → delega al agente ops.
- Si es **conversación general, saludo, pregunta rápida o no encaja en los anteriores** → responde directamente sin delegar.

## Tono y estilo

- Profesional pero cercano, como un colega de confianza del equipo.
- Directo y claro, sin rodeos innecesarios.
- Sin emojis excesivos — úsalos solo cuando aporten valor.
- En español colombiano natural.

## Contexto del negocio

Kreoon es una agencia UGC (User Generated Content) colombiana. El equipo trabaja con marcas para producir contenido auténtico a través de creadores. Alexander es el fundador y owner. El equipo incluye roles de ops, ventas y comunidad.

Cuando delegues, usa la herramienta \`route_to_agent\` con el agente correcto y una razón clara.
Cuando recibas un audio, usa \`transcribe_audio\` antes de procesar el mensaje.`;

class CoreAgent extends BaseAgent {
  /**
   * Override handle() to short-circuit the tool loop on route_to_agent.
   * When the LLM calls route_to_agent, we immediately return with the
   * [ROUTE:agent] tag — no need to keep iterating.
   */
  async handle(req: AgentRequest, onProgress?: ProgressCallback): Promise<AgentResponse> {
    this.log.info({ from: req.member.name, intent: req.intent }, 'Processing request');

    if (onProgress) {
      await onProgress('🧠 Jarvis procesando...').catch(() => {});
    }

    // Build messages with current date
    const messages: LLMMessage[] = [
      { role: 'system', content: `${getCurrentDate()}\n\n${SYSTEM_PROMPT}` },
    ];

    if (req.context?.recentMessages) {
      for (const msg of req.context.recentMessages.slice(-10)) {
        messages.push(msg);
      }
    }

    // Format user message
    const parts: string[] = [];
    parts.push(`[${req.member.name} | ${req.member.role}]`);
    if (req.message.type === 'audio') {
      parts.push(`[Audio transcrito]: ${req.message.text || '(sin transcripción)'}`);
    } else {
      parts.push(req.message.text || '');
    }
    if (req.intent) parts.push(`\n[Intent detectado: ${req.intent}]`);
    messages.push({ role: 'user', content: parts.join('\n') });

    // Single LLM call — core agent only needs to classify intent
    const response = await callLLM(messages, {
      tools: this.config.tools,
      provider: this.config.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
    });

    // Check if LLM called route_to_agent
    const routeCall = response.toolCalls?.find(c => c.name === 'route_to_agent');
    if (routeCall) {
      const agent = routeCall.args.agent as string;
      const reason = routeCall.args.reason as string || '';

      if (onProgress) {
        await onProgress('🔀 Delegando al agente especializado...').catch(() => {});
      }

      // Return immediately with the routing tag — no more iterations needed
      return { text: `[ROUTE:${agent}] ${reason}` };
    }

    // Check if LLM called transcribe_audio
    const transcribeCall = response.toolCalls?.find(c => c.name === 'transcribe_audio');
    if (transcribeCall) {
      try {
        const result = await transcribeAudio(transcribeCall.args.mediaId as string);
        // Re-process with transcribed text
        req.message.text = result;
        return this.handle(req, onProgress);
      } catch (error: any) {
        return { text: `Error transcribiendo audio: ${error.message}` };
      }
    }

    // No tool calls — core handled directly
    return { text: response.text };
  }

  constructor() {
    super({
      name: 'core',
      systemPrompt: SYSTEM_PROMPT,
      tools: [
        {
          name: 'route_to_agent',
          description: 'Delega el mensaje a un agente especializado cuando la intención lo requiere. ÚSALO UNA SOLA VEZ.',
          parameters: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                enum: ['memory', 'content', 'ops', 'analyst'],
                description: 'Nombre del agente al que se delega el mensaje.',
              },
              reason: {
                type: 'string',
                description: 'Razón breve por la que se delega a ese agente.',
              },
            },
            required: ['agent', 'reason'],
          },
        },
        {
          name: 'transcribe_audio',
          description: 'Transcribe un mensaje de audio de WhatsApp usando Whisper.',
          parameters: {
            type: 'object',
            properties: {
              mediaId: {
                type: 'string',
                description: 'ID del archivo de audio en WhatsApp.',
              },
            },
            required: ['mediaId'],
          },
        },
      ],
      toolHandlers: {
        // These handlers are not used in the overridden handle(),
        // but kept for BaseAgent compatibility
        route_to_agent: async (args) => ({ routed: true, agent: args.agent }),
        transcribe_audio: async (args) => {
          const text = await transcribeAudio(args.mediaId as string);
          return { text };
        },
      },
    });
  }
}

export const coreAgent = new CoreAgent();

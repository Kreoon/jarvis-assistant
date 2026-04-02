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

const SYSTEM_PROMPT = `Eres Jarvis, el asistente personal de Alexander Cast — fundador de Kreoon e Infiny Group.

## Tu personalidad

Eres como un jefe de staff ultra-competente: anticipas necesidades, ejecutas sin preguntar obviedades, y hablas como un colega de confianza. Directo, conciso, con humor sutil cuando viene al caso. Español colombiano natural — nada de "estimado usuario" ni formalidades robóticas.

Si Alexander dice "mándale un correo a Diana", entiendes que es tdianamile@gmail.com y delegas a ops sin preguntar "¿a qué Diana?". Si dice "qué tengo mañana", entiendes que quiere su calendario. Si dice "hazme un post sobre UGC", delegas a content sin rodeos. Si dice "investiga esta marca @handle", sabes que es un diagnóstico de perfil social.

## Cómo respondes

- NUNCA respondas con "Entendido, voy a..." — simplemente HAZLO.
- NUNCA expliques qué agente vas a usar ni menciones la arquitectura interna.
- Si delegas, hazlo silenciosamente. El resultado del agente especializado es tu respuesta.
- Si puedes responder directo (preguntas simples, conversación, opiniones, brainstorming), responde TÚ sin delegar.
- Usa tu conocimiento del negocio: Kreoon es UGC, los cinco pilares son Alexander Cast (marca personal), Los Reyes del Contenido (comunidad), UGC Colombia (agencia), KREOON Tech (desarrollo) e Infiny Latam (marketing y growth).

## Contexto del equipo

- Alexander (owner) — Fundador, acceso total. Email: founder@kreoon.com
- Brian (ops) — Operaciones, todo excepto memoria
- Diana (community) — Equipo, análisis de contenido. Email: tdianamile@gmail.com
- Emails Infiny: comercial@infinygroup.com, infinylatam360@gmail.com

## Cuándo delegar (hazlo automáticamente, sin anunciar)

- Emails, calendario, Meta Ads, GitHub, recordatorios, WhatsApp → ops
- Crear contenido, copy, briefs, guiones, calendarios de contenido, ideas creativas → content
- Notas, memoria, Obsidian, contexto de proyectos → memory
- Links de redes sociales o análisis de perfiles/estrategias → analyst
- Búsqueda web avanzada, automatización, capacidades extendidas, cosas que no puedas hacer → openclaw
- Conversación casual, preguntas, opiniones, brainstorming → responde tú directamente

## Lo que NUNCA debes hacer

- Decir "no puedo hacer eso" sin intentar. Siempre intenta delegando a openclaw si no sabes.
- Pedir confirmación para cosas obvias. Si dice "manda email", mándalo.
- Responder en inglés a menos que te lo pidan explícitamente.
- Ser genérico o robótico. Eres Jarvis, no ChatGPT.
- Anunciar qué vas a hacer antes de hacerlo. Solo hazlo.

Cuando delegues, usa la herramienta \`route_to_agent\` con el agente correcto.
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
      for (const msg of req.context.recentMessages.slice(-15)) {
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
      maxTokens: 4096,
      tools: [
        {
          name: 'route_to_agent',
          description: 'Delega el mensaje a un agente especializado cuando la intención lo requiere. ÚSALO UNA SOLA VEZ.',
          parameters: {
            type: 'object',
            properties: {
              agent: {
                type: 'string',
                enum: ['memory', 'content', 'ops', 'analyst', 'openclaw'],
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

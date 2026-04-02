import { callLLM } from './llm.js';
import { matchSkills, formatSkillsForPrompt } from './skill-loader.js';
import { agentLogger } from '../shared/logger.js';
import { delegateToOpenClaw, isOpenClawConnected } from '../connectors/openclaw.js';
import type {
  AgentName,
  AgentRequest,
  AgentResponse,
  LLMMessage,
  LLMTool,
  LLMProvider,
} from '../shared/types.js';

// Progress callback type
export type ProgressCallback = (message: string) => Promise<void>;

// Friendly tool names for progress messages
const TOOL_PROGRESS: Record<string, { start: string; done: string }> = {
  // Analyst
  extract_content: { start: 'Dale, descargando eso...', done: 'Listo, ya lo tengo' },
  analyze_strategy: { start: 'Revisando el contenido a fondo...', done: 'Ya lo analicé completo' },
  replicate_content: { start: 'Armando unas versiones para vos...', done: 'Ahí te van las réplicas' },
  generate_pdf: { start: 'Montando el PDF...', done: 'PDF listo, ya está en Drive' },
  extract_profile: { start: 'Mirando ese perfil...', done: 'Ya tengo el perfil' },
  batch_analyze: { start: 'Analizando todo el perfil, dame un momento...', done: 'Análisis completo parce' },
  download_only: { start: 'Descargando y guardando en Drive...', done: 'Guardado, listo' },
  // Content
  web_search: { start: 'Buscando info...', done: 'Ya encontré lo que necesitaba' },
  generate_caption: { start: 'Escribiendo el caption...', done: 'Caption listo' },
  content_calendar: { start: 'Armando el calendario...', done: 'Calendario listo' },
  write_copy: { start: 'Escribiendo el copy...', done: 'Copy listo' },
  ugc_brief: { start: 'Armando el brief...', done: 'Brief listo' },
  // Ops
  send_email: { start: 'Mandando el email...', done: 'Email enviado' },
  read_emails: { start: 'Revisando los emails...', done: 'Ya los leí' },
  create_calendar_event: { start: 'Agendando eso...', done: 'Evento creado' },
  list_calendar_events: { start: 'Mirando la agenda...', done: 'Listo' },
  check_meta_ads: { start: 'Revisando los ads...', done: 'Ya tengo los datos' },
  github_action: { start: 'Haciendo eso en GitHub...', done: 'Listo en GitHub' },
  // Memory
  search_memory: { start: 'Déjame buscar eso...', done: 'Encontré algo' },
  search_notes: { start: 'Buscando en las notas...', done: 'Ya encontré' },
  save_note: { start: 'Guardando eso...', done: 'Guardado' },
  // Ops — new tools
  update_calendar_event: { start: 'Actualizando el evento...', done: 'Evento actualizado' },
  delete_calendar_event: { start: 'Eliminando el evento...', done: 'Eliminado' },
  search_calendar_events: { start: 'Buscando en la agenda...', done: 'Listo' },
  read_email_full: { start: 'Leyendo ese email...', done: 'Ya lo leí' },
  reply_to_email: { start: 'Respondiendo...', done: 'Respuesta enviada' },
  create_draft: { start: 'Armando el borrador...', done: 'Borrador listo' },
  connect_google_account: { start: 'Generando el link...', done: 'Ahí te va el link' },
  list_google_accounts: { start: 'Mirando las cuentas...', done: 'Listo' },
  list_calendars: { start: 'Revisando calendarios...', done: 'Listo' },
  create_calendar: { start: 'Creando el calendario...', done: 'Calendario creado' },
  set_reminder: { start: 'Poniendo el recordatorio...', done: 'Recordatorio listo' },
  // Memory — new tools
  list_notes: { start: 'Mirando las notas...', done: 'Listo' },
  verify_obsidian: { start: 'Verificando la conexión...', done: 'Todo bien' },
  // Core
  route_to_agent: { start: '', done: '' },
  transcribe_audio: { start: 'Escuchando el audio...', done: 'Ya lo tengo' },
  // OpenClaw — universal
  openclaw_query: { start: 'Dame un momento, estoy en eso...', done: 'Listo' },
};

// Universal OpenClaw tool definition — inyectada automáticamente en todos los agentes
const OPENCLAW_TOOL: LLMTool = {
  name: 'openclaw_query',
  description:
    'Delega una tarea a OpenClaw (IA con acceso a browser, web scraping, y 5700+ skills). ' +
    'Úsalo para: búsquedas web avanzadas, automatización de browser, scraping de páginas, ' +
    'o cualquier capacidad que no tengas directamente.',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Descripción de la tarea a delegar a OpenClaw en lenguaje natural',
      },
    },
    required: ['task'],
  },
};

export interface AgentConfig {
  name: AgentName;
  systemPrompt: string;
  tools: LLMTool[];
  toolHandlers: Record<string, (args: Record<string, unknown>, req: AgentRequest) => Promise<unknown>>;
  provider?: LLMProvider;
  model?: string;
  maxTokens?: number;
  maxIterations?: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected log;

  constructor(config: AgentConfig) {
    this.config = config;
    this.log = agentLogger(config.name);
  }

  async handle(req: AgentRequest, onProgress?: ProgressCallback): Promise<AgentResponse> {
    this.log.info({ from: req.member.name, intent: req.intent }, 'Processing request');

    // Send initial progress if we have a callback
    if (onProgress) {
      const agentNames: Record<string, string> = {
        core: 'Va, dame un momento...',
        memory: 'Déjame revisar eso...',
        content: 'Dale, ya me pongo en eso...',
        ops: 'En eso estoy...',
        analyst: 'Analizando eso, ya te cuento...',
      };
      await onProgress(agentNames[this.config.name] || 'Dame un seg...').catch(() => {});
    }

    const messages = this.buildMessages(req);

    // Skills are matched silently — no need to announce them to the user
    if (this.config.name !== 'core') {
      const messageText = req.message.text || req.intent || '';
      matchSkills(messageText); // skills get injected into context, no progress message
    }

    // Build the effective tool list: agent tools + universal OpenClaw tool
    // Only inject OpenClaw if it is not already defined by the agent to avoid duplicates
    const agentToolNames = new Set(this.config.tools.map(t => t.name));
    const effectiveTools: LLMTool[] = agentToolNames.has('openclaw_query')
      ? this.config.tools
      : [...this.config.tools, OPENCLAW_TOOL];

    // Tool use loop
    let iteration = 0;
    const maxIterations = this.config.maxIterations ?? 10;

    while (iteration < maxIterations) {
      iteration++;

      if (onProgress && iteration > 1) {
        await onProgress('Sigo en eso, un momento...').catch(() => {});
      }

      const response = await callLLM(messages, {
        tools: effectiveTools.length ? effectiveTools : undefined,
        provider: this.config.provider,
        model: this.config.model,
        maxTokens: this.config.maxTokens,
      });

      // No tool calls → return text response
      if (!response.toolCalls?.length) {
        return { text: response.text };
      }

      // Execute tool calls with progress reporting
      const toolResults: string[] = [];
      for (const call of response.toolCalls) {
        // --- Universal OpenClaw handler (BaseAgent level) ---
        if (call.name === 'openclaw_query') {
          const progress = TOOL_PROGRESS['openclaw_query'];
          if (onProgress && progress?.start) {
            await onProgress(progress.start).catch(() => {});
          }

          if (!isOpenClawConnected()) {
            this.log.warn('openclaw_query called but OpenClaw is not connected');
            toolResults.push(JSON.stringify({ error: 'OpenClaw no está conectado en este momento' }));
          } else {
            try {
              const result = await delegateToOpenClaw(call.args.task as string, {
                agent: this.config.name,
                from: req.member.name,
              });
              toolResults.push(JSON.stringify({ result }));

              if (onProgress && progress?.done) {
                await onProgress(progress.done).catch(() => {});
              }
            } catch (err: any) {
              this.log.error({ error: err.message }, 'OpenClaw delegation failed');
              toolResults.push(JSON.stringify({ error: err.message }));

              if (onProgress) {
                await onProgress(`Uy, no me funcionó eso: ${err.message.slice(0, 100)}`).catch(() => {});
              }
            }
          }
          continue;
        }

        // --- Agent-specific handler ---
        const handler = this.config.toolHandlers[call.name];
        if (!handler) {
          toolResults.push(`Error: tool "${call.name}" not found`);
          continue;
        }

        // Report tool start
        const progress = TOOL_PROGRESS[call.name];
        if (onProgress && progress?.start) {
          await onProgress(progress.start).catch(() => {});
        }

        try {
          const result = await handler(call.args, req);
          toolResults.push(JSON.stringify(result));

          // Report tool done
          if (onProgress && progress?.done) {
            await onProgress(progress.done).catch(() => {});
          }
        } catch (error: any) {
          this.log.error({ tool: call.name, error: error.message }, 'Tool execution failed');
          toolResults.push(`Error: ${error.message}`);

          if (onProgress) {
            await onProgress(`Se me complicó con eso: ${error.message.slice(0, 100)}`).catch(() => {});
          }
        }
      }

      // Add assistant response + tool results to conversation
      if (response.text) {
        messages.push({ role: 'assistant', content: response.text });
      }
      messages.push({
        role: 'user',
        content: `Tool results:\n${response.toolCalls.map((c, i) => `${c.name}: ${toolResults[i]}`).join('\n')}`,
      });
    }

    // Max iterations reached
    const finalResponse = await callLLM(messages, {
      provider: this.config.provider,
      model: this.config.model,
    });

    return { text: finalResponse.text };
  }

  private buildMessages(req: AgentRequest): LLMMessage[] {
    // Dynamic skill injection based on message content
    let systemPrompt = this.config.systemPrompt;
    const messageText = req.message.text || req.intent || '';

    if (messageText && this.config.name !== 'core') {
      const matched = matchSkills(messageText);
      if (matched.length) {
        systemPrompt += formatSkillsForPrompt(matched);
      }
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation context
    if (req.context?.recentMessages) {
      for (const msg of req.context.recentMessages.slice(-10)) {
        messages.push(msg);
      }
    }

    // Add current message
    const userContent = this.formatUserMessage(req);
    messages.push({ role: 'user', content: userContent });

    return messages;
  }

  private formatUserMessage(req: AgentRequest): string {
    const parts: string[] = [];

    parts.push(`[${req.member.name} | ${req.member.role}]`);

    if (req.message.type === 'audio') {
      parts.push(`[Audio transcrito]: ${req.message.text || '(sin transcripción)'}`);
    } else if (req.message.type === 'image') {
      parts.push(`[Imagen]: ${req.message.caption || '(sin caption)'}`);
    } else {
      parts.push(req.message.text || '');
    }

    if (req.intent) {
      parts.push(`\n[Intent detectado: ${req.intent}]`);
    }

    return parts.join('\n');
  }
}

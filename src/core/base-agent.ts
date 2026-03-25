import { callLLM } from './llm.js';
import { matchSkills, formatSkillsForPrompt } from './skill-loader.js';
import { agentLogger } from '../shared/logger.js';
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
  extract_content: { start: '📥 Descargando contenido...', done: '✅ Contenido extraído' },
  analyze_strategy: { start: '🔍 Analizando estrategia (12 dimensiones)...', done: '✅ Análisis completo' },
  replicate_content: { start: '🔄 Generando 3 versiones de réplica...', done: '✅ Réplicas listas' },
  generate_pdf: { start: '📄 Generando PDF del reporte...', done: '✅ PDF generado y subido a Drive' },
  extract_profile: { start: '👤 Extrayendo perfil...', done: '✅ Perfil extraído' },
  batch_analyze: { start: '📊 Analizando perfil completo...', done: '✅ Análisis batch completo' },
  download_only: { start: '📥 Descargando y subiendo a Drive...', done: '✅ Guardado en Drive' },
  // Content
  web_search: { start: '🌐 Buscando en la web...', done: '✅ Búsqueda completa' },
  generate_caption: { start: '✍️ Generando caption...', done: '✅ Caption listo' },
  content_calendar: { start: '📅 Creando calendario...', done: '✅ Calendario listo' },
  write_copy: { start: '✍️ Escribiendo copy...', done: '✅ Copy listo' },
  ugc_brief: { start: '📋 Generando brief UGC...', done: '✅ Brief listo' },
  // Ops
  send_email: { start: '📧 Enviando email...', done: '✅ Email enviado' },
  read_emails: { start: '📧 Leyendo emails...', done: '✅ Emails leídos' },
  create_calendar_event: { start: '📅 Creando evento...', done: '✅ Evento creado' },
  list_calendar_events: { start: '📅 Consultando calendario...', done: '✅ Calendario consultado' },
  check_meta_ads: { start: '📊 Consultando Meta Ads...', done: '✅ Datos de ads obtenidos' },
  github_action: { start: '🔧 Ejecutando acción en GitHub...', done: '✅ GitHub listo' },
  // Memory
  search_memory: { start: '🔍 Buscando en memoria...', done: '✅ Búsqueda completa' },
  search_notes: { start: '🔍 Buscando en Obsidian...', done: '✅ Notas encontradas' },
  save_note: { start: '💾 Guardando nota en Obsidian...', done: '✅ Nota guardada' },
  // Ops — new tools
  update_calendar_event: { start: '📅 Actualizando evento...', done: '✅ Evento actualizado' },
  delete_calendar_event: { start: '📅 Eliminando evento...', done: '✅ Evento eliminado' },
  search_calendar_events: { start: '📅 Buscando eventos...', done: '✅ Búsqueda completa' },
  read_email_full: { start: '📧 Leyendo email completo...', done: '✅ Email leído' },
  reply_to_email: { start: '📧 Respondiendo email...', done: '✅ Respuesta enviada' },
  create_draft: { start: '📧 Creando borrador...', done: '✅ Borrador creado' },
  connect_google_account: { start: '🔗 Generando link de conexión...', done: '✅ Link generado' },
  list_google_accounts: { start: '👥 Listando cuentas...', done: '✅ Cuentas listadas' },
  list_calendars: { start: '📅 Listando calendarios...', done: '✅ Calendarios listados' },
  create_calendar: { start: '📅 Creando calendario...', done: '✅ Calendario creado' },
  set_reminder: { start: '⏰ Creando recordatorio...', done: '✅ Recordatorio creado' },
  // Memory — new tools
  list_notes: { start: '📂 Listando notas de Obsidian...', done: '✅ Notas listadas' },
  verify_obsidian: { start: '🔍 Verificando conexión Obsidian...', done: '✅ Verificación completa' },
  // Core
  route_to_agent: { start: '🔀 Delegando al agente especializado...', done: '' },
  transcribe_audio: { start: '🎤 Transcribiendo audio...', done: '✅ Audio transcrito' },
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
        core: '🧠 Jarvis procesando...',
        memory: '💾 Agente de Memoria trabajando...',
        content: '✍️ Agente de Contenido trabajando...',
        ops: '⚙️ Agente de Operaciones trabajando...',
        analyst: '🔬 Agente Analista trabajando...',
      };
      await onProgress(agentNames[this.config.name] || '⏳ Procesando...').catch(() => {});
    }

    const messages = this.buildMessages(req);

    // Notify which skills were activated
    if (onProgress && this.config.name !== 'core') {
      const messageText = req.message.text || req.intent || '';
      const matched = matchSkills(messageText);
      if (matched.length) {
        const names = matched.map(s => s.name).join(', ');
        await onProgress(`📚 Skills activadas: ${names}`).catch(() => {});
      }
    }

    // Tool use loop
    let iteration = 0;
    const maxIterations = this.config.maxIterations ?? 5;

    while (iteration < maxIterations) {
      iteration++;

      if (onProgress && iteration > 1) {
        await onProgress(`⏳ Paso ${iteration}/${maxIterations}...`).catch(() => {});
      }

      const response = await callLLM(messages, {
        tools: this.config.tools.length ? this.config.tools : undefined,
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
            await onProgress(`❌ Error en ${call.name}: ${error.message.slice(0, 100)}`).catch(() => {});
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

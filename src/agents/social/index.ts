import { BaseAgent } from '../../core/base-agent.js';
import { callLLM } from '../../core/llm.js';
import { SOCIAL_ACCOUNTS, isInstagramApiReady, getComments, replyToComment, getRecentMedia, getConversations, sendIgMessage } from '../../connectors/instagram-api.js';
import { agentLogger } from '../../shared/logger.js';
import type { AgentRequest, AgentResponse } from '../../shared/types.js';

const log = agentLogger('social');

// Brand voice guides for each account
const BRAND_VOICES: Record<string, string> = {
  alexander_cast: 'Experto en Estrategia Digital, IA y Contenido. Cercano pero con autoridad. Datos duros + opinión propia. Colombiano, directo.',
  reyes_contenido: 'Comunidad de creadores. Tono motivador, inclusivo, energético. "Somos un equipo". Emojis moderados.',
  ugc_colombia: 'Agencia UGC profesional. Cálido pero orientado a servicio. Respuestas que demuestren expertise en UGC.',
  esposa: 'Marca personal auténtica. Cercana, empática, inspiradora. Tono femenino natural.',
  infiny_latam: 'Agencia de marketing digital. Profesional, orientado a resultados, growth mindset.',
  kreoon: 'Plataforma tech. Innovador, moderno, accesible. Explica tech de forma simple.',
  prolab: 'Proveeduría dropshipping. Emprendedor, práctico, enfocado en resultados. Habla de oportunidades.',
};

const SYSTEM_PROMPT = `Eres el Social Manager de Jarvis — gestionas 7 cuentas de Instagram para el ecosistema de Alexander Cast.

## Cuentas que gestionas
${Object.entries(SOCIAL_ACCOUNTS).map(([key, acc]) => `- ${key}: @${acc.instagram}`).join('\n')}

## Tu trabajo
- Responder comentarios en todas las cuentas con el tono correcto de cada marca
- Responder DMs de consultas de servicio
- Obtener métricas y analytics
- Detectar oportunidades (leads, colaboraciones, viral moments)
- Escalar a Alexander por WhatsApp cuando algo es importante

## Reglas
- NUNCA respondas con el tono equivocado. Cada marca tiene su voz.
- Si un comentario es hate o spam, ignóralo o responde con clase.
- Si alguien pregunta precios o servicios, responde y escala a Alexander.
- Detecta leads potenciales y márcalos.
- Responde en español por defecto, en inglés si el comentario es en inglés.`;

class SocialManagerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'social',
      systemPrompt: SYSTEM_PROMPT,
      tools: [
        {
          name: 'get_pending_comments',
          description: 'Obtiene comentarios pendientes de responder en una o todas las cuentas de Instagram.',
          parameters: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Nombre de la cuenta (alexander_cast, ugc_colombia, etc.) o "all" para todas' },
              limit: { type: 'number', description: 'Máximo de comentarios a traer. Default: 20' },
            },
            required: ['account'],
          },
        },
        {
          name: 'reply_comment',
          description: 'Responde a un comentario de Instagram con el tono de la marca correspondiente.',
          parameters: {
            type: 'object',
            properties: {
              comment_id: { type: 'string', description: 'ID del comentario a responder' },
              account: { type: 'string', description: 'Cuenta desde la que se responde' },
              reply: { type: 'string', description: 'Texto de la respuesta' },
            },
            required: ['comment_id', 'account', 'reply'],
          },
        },
        {
          name: 'batch_reply_comments',
          description: 'Genera y envía respuestas para múltiples comentarios de una cuenta, usando el tono de marca correcto.',
          parameters: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Cuenta de Instagram' },
              comments: { type: 'string', description: 'JSON array de comentarios [{id, text, username}]' },
            },
            required: ['account', 'comments'],
          },
        },
        {
          name: 'get_dms',
          description: 'Obtiene mensajes directos (DMs) pendientes de una cuenta.',
          parameters: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Cuenta de Instagram' },
              limit: { type: 'number', description: 'Máximo de conversaciones. Default: 10' },
            },
            required: ['account'],
          },
        },
        {
          name: 'reply_dm',
          description: 'Responde a un DM de Instagram.',
          parameters: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Cuenta desde la que se responde' },
              conversation_id: { type: 'string', description: 'ID de la conversación' },
              recipient_id: { type: 'string', description: 'ID del destinatario' },
              message: { type: 'string', description: 'Texto del mensaje' },
            },
            required: ['account', 'recipient_id', 'message'],
          },
        },
        {
          name: 'get_account_stats',
          description: 'Obtiene métricas y estadísticas de una cuenta de Instagram.',
          parameters: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Cuenta o "all" para todas' },
            },
            required: ['account'],
          },
        },
        {
          name: 'generate_reply',
          description: 'Genera una respuesta inteligente para un comentario usando el tono de la marca.',
          parameters: {
            type: 'object',
            properties: {
              account: { type: 'string', description: 'Cuenta (define el tono de voz)' },
              comment_text: { type: 'string', description: 'Texto del comentario original' },
              comment_username: { type: 'string', description: 'Username de quien comentó' },
              post_context: { type: 'string', description: 'Contexto del post (caption, tema)' },
            },
            required: ['account', 'comment_text'],
          },
        },
      ],
      toolHandlers: {
        get_pending_comments: async (args) => {
          const account = args.account as string;
          const limit = (args.limit as number) || 20;

          if (!isInstagramApiReady()) {
            return { error: 'Instagram API no configurada. Necesitas conectar las cuentas a Meta Business Suite y configurar META_GRAPH_TOKEN.' };
          }

          const accounts = account === 'all' ? Object.keys(SOCIAL_ACCOUNTS) : [account];
          const results: Record<string, any[]> = {};

          for (const acc of accounts) {
            const config = SOCIAL_ACCOUNTS[acc];
            if (!config?.igId) {
              results[acc] = [{ error: 'IG Business ID no configurado para esta cuenta' }];
              continue;
            }
            try {
              const media = await getRecentMedia(config.igId, 5);
              const allComments: any[] = [];
              for (const post of media) {
                const comments = await getComments(post.id, limit);
                allComments.push(...comments.map((c: any) => ({ ...c, postId: post.id, postCaption: post.caption?.slice(0, 100) })));
              }
              results[acc] = allComments;
            } catch (error: any) {
              results[acc] = [{ error: error.message }];
            }
          }

          return results;
        },

        reply_comment: async (args) => {
          if (!isInstagramApiReady()) {
            return { error: 'Instagram API no configurada' };
          }
          try {
            const replyId = await replyToComment(args.comment_id as string, args.reply as string);
            return { success: true, replyId, account: args.account };
          } catch (error: any) {
            return { error: error.message };
          }
        },

        batch_reply_comments: async (args, req) => {
          const account = args.account as string;
          const voice = BRAND_VOICES[account] || 'Profesional y amable';

          let comments: any[];
          try {
            comments = JSON.parse(args.comments as string);
          } catch {
            return { error: 'Invalid comments JSON' };
          }

          // Generate replies using LLM
          const repliesResponse = await callLLM(
            [
              {
                role: 'system',
                content: `Eres el community manager de @${SOCIAL_ACCOUNTS[account]?.instagram}.
Voz de marca: ${voice}

Genera respuestas para cada comentario. Responde en JSON array:
[{"commentId": "...", "reply": "..."}]

Reglas:
- Máximo 150 caracteres por respuesta
- Usa el nombre del usuario cuando sea natural
- Si es spam/hate, responde con clase o ignora (reply: null)
- Si detectas un lead potencial, marca con [LEAD] al inicio del reply
- Emojis moderados, naturales`,
              },
              {
                role: 'user',
                content: JSON.stringify(comments),
              },
            ],
            { maxTokens: 2000 },
          );

          try {
            let jsonStr = repliesResponse.text.trim();
            const match = jsonStr.match(/\[[\s\S]*\]/);
            if (match) jsonStr = match[0];
            const replies = JSON.parse(jsonStr);

            if (!isInstagramApiReady()) {
              return { generated: replies, note: 'Respuestas generadas pero NO enviadas — Instagram API no configurada' };
            }

            // Send replies
            const sent: any[] = [];
            for (const r of replies) {
              if (!r.reply || r.reply === 'null') continue;
              try {
                const replyId = await replyToComment(r.commentId, r.reply.replace('[LEAD] ', ''));
                sent.push({ ...r, sent: true, replyId });
              } catch (error: any) {
                sent.push({ ...r, sent: false, error: error.message });
              }
            }
            return { sent, leads: replies.filter((r: any) => r.reply?.startsWith('[LEAD]')) };
          } catch {
            return { error: 'Failed to parse LLM response', raw: repliesResponse.text.slice(0, 500) };
          }
        },

        get_dms: async (args) => {
          if (!isInstagramApiReady()) {
            return { error: 'Instagram API no configurada' };
          }
          const account = args.account as string;
          const config = SOCIAL_ACCOUNTS[account];
          if (!config?.igId) return { error: 'IG Business ID no configurado' };
          try {
            return await getConversations(config.igId, (args.limit as number) || 10);
          } catch (error: any) {
            return { error: error.message };
          }
        },

        reply_dm: async (args) => {
          if (!isInstagramApiReady()) {
            return { error: 'Instagram API no configurada' };
          }
          const account = args.account as string;
          const config = SOCIAL_ACCOUNTS[account];
          if (!config?.pageId) return { error: 'Page ID no configurado para esta cuenta' };
          try {
            await sendIgMessage(args.recipient_id as string, args.message as string, config.pageId);
            return { success: true };
          } catch (error: any) {
            return { error: error.message };
          }
        },

        get_account_stats: async (args) => {
          const account = args.account as string;
          if (!isInstagramApiReady()) {
            return {
              note: 'Instagram API no configurada. Datos basados en último scraping.',
              accounts: Object.entries(SOCIAL_ACCOUNTS).map(([key, acc]) => ({
                name: key,
                instagram: `@${acc.instagram}`,
                apiReady: !!acc.igId,
              })),
            };
          }
          return { note: 'Stats disponibles cuando se configure META_GRAPH_TOKEN' };
        },

        generate_reply: async (args) => {
          const account = args.account as string;
          const voice = BRAND_VOICES[account] || 'Profesional y amable';

          const response = await callLLM(
            [
              {
                role: 'system',
                content: `Eres el CM de @${SOCIAL_ACCOUNTS[account]?.instagram}. Voz: ${voice}. Genera UNA respuesta corta (máx 150 chars) para este comentario. Solo el texto, nada más.`,
              },
              {
                role: 'user',
                content: `Comentario de @${args.comment_username || 'usuario'}: "${args.comment_text}"\n${args.post_context ? `Contexto del post: ${args.post_context}` : ''}`,
              },
            ],
            { maxTokens: 200 },
          );

          return { reply: response.text.trim(), account, voice };
        },
      },
    });
  }
}

export const socialAgent = new SocialManagerAgent();

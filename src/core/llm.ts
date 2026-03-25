import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';
import type { LLMMessage, LLMTool, LLMResponse, LLMProvider } from '../shared/types.js';

const log = agentLogger('llm');

// === Claude Client ===
const claude = config.llm.anthropicKey
  ? new Anthropic({ apiKey: config.llm.anthropicKey })
  : null;

// === Gemini Client ===
const genai = new GoogleGenerativeAI(config.llm.geminiKey);

export async function callLLM(
  messages: LLMMessage[],
  options: {
    tools?: LLMTool[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    provider?: LLMProvider;
  } = {}
): Promise<LLMResponse> {
  const provider = options.provider || config.llm.primaryProvider;

  // Try primary provider, fallback to secondary
  try {
    if (provider === 'claude' && claude) {
      return await callClaude(messages, options);
    }
    return await callGemini(messages, options);
  } catch (error: any) {
    log.warn({ error: error.message, provider }, 'Primary LLM failed, trying fallback');

    try {
      if (provider === 'claude') {
        return await callGemini(messages, options);
      } else if (claude) {
        return await callClaude(messages, options);
      }
      throw error;
    } catch (fallbackError: any) {
      log.error({ error: fallbackError.message }, 'All LLM providers failed');
      throw fallbackError;
    }
  }
}

async function callClaude(
  messages: LLMMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number; tools?: LLMTool[] }
): Promise<LLMResponse> {
  if (!claude) throw new Error('Claude not configured');

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const tools = options.tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }));

  const response = await claude.messages.create({
    model: options.model || 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.7,
    system: systemMsg,
    messages: chatMessages,
    ...(tools?.length ? { tools } : {}),
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const toolUses = response.content.filter(b => b.type === 'tool_use');

  return {
    text: textBlock?.type === 'text' ? textBlock.text : '',
    toolCalls: toolUses.map(t => t.type === 'tool_use' ? { name: t.name, args: t.input as Record<string, unknown> } : { name: '', args: {} }),
    provider: 'claude',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

async function callGemini(
  messages: LLMMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number; tools?: LLMTool[] }
): Promise<LLMResponse> {
  const model = genai.getGenerativeModel({
    model: options.model || 'gemini-2.5-flash',
  });

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

  const tools = options.tools?.length
    ? [{
        functionDeclarations: options.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }]
    : undefined;

  const result = await model.generateContent({
    contents: chatMessages,
    systemInstruction: systemMsg ? { role: 'user', parts: [{ text: systemMsg }] } : undefined,
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    },
    tools,
  });

  const response = result.response;
  const text = response.text?.() || '';
  const fnCalls = response.functionCalls?.() || [];

  return {
    text,
    toolCalls: fnCalls.map(fc => ({ name: fc.name, args: fc.args as Record<string, unknown> })),
    provider: 'gemini',
  };
}

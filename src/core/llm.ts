import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';
import type { LLMMessage, LLMTool, LLMResponse, LLMProvider } from '../shared/types.js';

const log = agentLogger('llm');

const claude = config.llm.anthropicKey
  ? new Anthropic({ apiKey: config.llm.anthropicKey })
  : null;

const genai = new GoogleGenerativeAI(config.llm.geminiKey);

// Fallback chain: groq -> openrouter -> gemini -> claude
const FALLBACK_CHAIN: LLMProvider[] = ['groq', 'openrouter', 'gemini', 'claude'];

// Rate limit protection: wait between calls to same provider
const lastCallTime: Record<string, number> = {};
const MIN_DELAY_MS: Record<string, number> = { groq: 3000, openrouter: 2000 };

async function respectRateLimit(provider: string): Promise<void> {
  const minDelay = MIN_DELAY_MS[provider];
  if (!minDelay) return;
  const last = lastCallTime[provider] || 0;
  const elapsed = Date.now() - last;
  if (elapsed < minDelay) {
    await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
  }
  lastCallTime[provider] = Date.now();
}

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
  const preferred = options.provider || config.llm.primaryProvider;
  const chain = [preferred, ...FALLBACK_CHAIN.filter(p => p !== preferred)];

  for (const provider of chain) {
    try {
      await respectRateLimit(provider);
      switch (provider) {
        case 'groq':
          if (!config.llm.groqKey) continue;
          return await callOpenAICompat(messages, options, 'https://api.groq.com/openai/v1/chat/completions', config.llm.groqKey, options.model || 'llama-3.3-70b-versatile', 'groq');
        case 'openrouter':
          if (!config.llm.openrouterKey) continue;
          return await callOpenAICompat(messages, options, 'https://openrouter.ai/api/v1/chat/completions', config.llm.openrouterKey, options.model || 'meta-llama/llama-3.3-70b-instruct:free', 'openrouter');
        case 'gemini':
          return await callGemini(messages, options);
        case 'claude':
          if (!claude) continue;
          return await callClaude(messages, options);
        default:
          continue;
      }
    } catch (error: any) {
      log.warn({ error: error.message?.slice(0, 200), provider }, `${provider} failed, trying next`);
      continue;
    }
  }

  throw new Error('All LLM providers failed');
}

// OpenAI-compatible API (Groq, OpenRouter)
async function callOpenAICompat(
  messages: LLMMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number; tools?: LLMTool[] },
  url: string,
  apiKey: string,
  model: string,
  providerName: LLMProvider,
): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.7,
  };

  if (options.tools?.length) {
    body.tools = options.tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (providerName === 'openrouter') {
    headers['HTTP-Referer'] = 'https://jarvis.kreoon.com';
    headers['X-Title'] = 'Jarvis AI';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    // On 429, skip to next provider immediately (don't wait long retries)
    throw new Error(`${providerName} ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json() as any;
  const msg = data.choices?.[0]?.message;

  const toolCalls = msg?.tool_calls?.map((tc: any) => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments || '{}'),
  })) || [];

  return {
    text: msg?.content || '',
    toolCalls: toolCalls.length ? toolCalls : undefined,
    provider: providerName,
    tokensUsed: data.usage?.total_tokens,
  };
}

// Claude
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

// Gemini (with 2.5 -> 1.5 internal fallback)
async function callGemini(
  messages: LLMMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number; tools?: LLMTool[] }
): Promise<LLMResponse> {
  const modelName = options.model || 'gemini-2.5-flash';
  const model = genai.getGenerativeModel({ model: modelName });

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

  const genConfig = {
    contents: chatMessages,
    systemInstruction: systemMsg ? { role: 'user' as const, parts: [{ text: systemMsg }] } : undefined,
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    },
    tools,
  };

  let result;
  try {
    result = await model.generateContent(genConfig);
  } catch (err: any) {
    if (modelName === 'gemini-2.5-flash' && (err.message?.includes('503') || err.message?.includes('overloaded') || err.message?.includes('high demand'))) {
      log.warn('Gemini 2.5 overloaded, trying 1.5 Flash');
      const fb = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      result = await fb.generateContent(genConfig);
    } else {
      throw err;
    }
  }

  const response = result.response;
  const text = response.text?.() || '';
  const fnCalls = response.functionCalls?.() || [];

  return {
    text,
    toolCalls: fnCalls.map(fc => ({ name: fc.name, args: fc.args as Record<string, unknown> })),
    provider: 'gemini',
  };
}

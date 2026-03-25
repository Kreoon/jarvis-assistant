import axios from 'axios';
import { config } from './config.js';

export async function searchWeb(
  query: string
): Promise<{ result: string; citations: string[] }> {
  if (!config.perplexity.apiKey) {
    throw new Error('Perplexity API key not configured');
  }

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'sonar',
      messages: [{ role: 'user', content: query }],
    },
    {
      headers: {
        Authorization: `Bearer ${config.perplexity.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    },
  );

  const content = response.data?.choices?.[0]?.message?.content ?? '';
  const citations = response.data?.citations ?? [];

  return { result: content, citations };
}

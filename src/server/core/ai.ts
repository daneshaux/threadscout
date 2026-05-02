import { settings } from '@devvit/web/server';

export async function generateDuplicateExplanation(
  postA: string,
  postB: string
) {
  const OPENAI_API_KEY = await settings.get('openaiApiKey');

  if (!OPENAI_API_KEY) {
    console.log('⚠️ No OpenAI key found');
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a moderation assistant. Explain briefly why two posts might be duplicates.',
        },
        {
          role: 'user',
          content: `Post A: ${postA}\n\nPost B: ${postB}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  const data = await response.json();

  return data.choices?.[0]?.message?.content ?? null;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = await settings.get('openaiApiKey');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  const data = await response.json();

  return data.data?.[0]?.embedding ?? [];
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) return 0;

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const valueA = a[i] ?? 0;
    const valueB = b[i] ?? 0;

    dot += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (!magnitudeA || !magnitudeB) return 0;

  return dot / (magnitudeA * magnitudeB);
}
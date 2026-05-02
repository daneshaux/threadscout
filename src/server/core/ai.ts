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
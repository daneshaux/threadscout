import { settings } from '@devvit/web/server';

export type DuplicateVerificationResult = {
  isDuplicate: boolean;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
};

function getObjectValue(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function isConfidence(value: unknown): value is DuplicateVerificationResult['confidence'] {
  return value === 'low' || value === 'medium' || value === 'high';
}

function parseDuplicateVerificationResult(
  value: unknown
): DuplicateVerificationResult | null {
  const isDuplicate = getObjectValue(value, 'isDuplicate');
  const confidence = getObjectValue(value, 'confidence');
  const explanation = getObjectValue(value, 'explanation');

  if (
    typeof isDuplicate !== 'boolean' ||
    !isConfidence(confidence) ||
    typeof explanation !== 'string' ||
    explanation.trim().length === 0
  ) {
    return null;
  }

  return {
    isDuplicate,
    confidence,
    explanation: explanation.trim(),
  };
}

export async function verifyDuplicateWithAi(
  postA: string,
  postB: string
): Promise<DuplicateVerificationResult | null> {
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
          content: [
            'You are a strict moderation assistant for duplicate Reddit post detection.',
            'Decide whether two posts ask substantially the same question/request or would fragment the same discussion.',
            'Return false when posts only share location, format, broad recommendation intent, general category overlap, or similar wording with different actual topics.',
            'Return only valid JSON with this exact shape: {"isDuplicate": boolean, "confidence": "low" | "medium" | "high", "explanation": string}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `New post:\n${postA}\n\nPotential original post:\n${postB}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });

  if (!response.ok) {
    console.error('❌ AI duplicate verification request failed:', await response.text());
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    return null;
  }

  try {
    return parseDuplicateVerificationResult(JSON.parse(content));
  } catch (error) {
    console.error('❌ Failed to parse AI duplicate verification JSON:', error);
    return null;
  }
}

export async function generateDuplicateExplanation(
  postA: string,
  postB: string
) {
  const result = await verifyDuplicateWithAi(postA, postB);
  return result?.explanation ?? null;
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

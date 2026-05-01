export type SimilarityResult = {
  score: number;
  matchedWords: string[];
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'this', 'that', 'it', 'as', 'at', 'by', 'from',
]);

export function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function calculateSimilarity(textA: string, textB: string): SimilarityResult {
  const wordsA = new Set(normalizeText(textA));
  const wordsB = new Set(normalizeText(textB));

  if (wordsA.size === 0 || wordsB.size === 0) {
    return { score: 0, matchedWords: [] };
  }

  const matchedWords = [...wordsA].filter((word) => wordsB.has(word));
  const totalUniqueWords = new Set([...wordsA, ...wordsB]).size;

  const score = matchedWords.length / totalUniqueWords;

  return {
    score: Math.round(score * 100),
    matchedWords,
  };
}
import { redis } from '@devvit/redis';

export type IndexedPost = {
  id: string;
  title: string;
  text: string;
  permalink?: string;
  createdAt?: number | Date;
};

const INDEX_KEY = 'threadscout:index';

function isIndexedPost(value: unknown): value is IndexedPost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'text' in value &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.text === 'string'
  );
}

function parseIndexedPosts(raw: string): IndexedPost[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed) || !parsed.every(isIndexedPost)) {
    throw new Error('ThreadScout Redis index has an unexpected shape.');
  }

  return parsed;
}

export async function getIndexedPosts(): Promise<IndexedPost[]> {
  const raw = await redis.get(INDEX_KEY);

  if (!raw) return [];

  return parseIndexedPosts(raw);
}

export async function saveIndexedPost(post: IndexedPost): Promise<boolean> {
  const existing = await getIndexedPosts();

  const updated = [post, ...existing.filter((indexedPost) => indexedPost.id !== post.id)];

  // Keep the index bounded so trigger work stays predictable.
  const trimmed = updated.slice(0, 100);

  await redis.set(INDEX_KEY, JSON.stringify(trimmed));

  return true;
}

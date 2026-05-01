import { Hono } from 'hono';
import { reddit, redis } from '@devvit/web/server';
import { calculateSimilarity } from '../core/similarity';

export const triggers = new Hono();

type IndexedPost = {
  id: string;
  title: string;
  text: string;
  permalink?: string;
  createdAt?: number;
};
const REDIS_KEY = 'threadscout:posts';

async function getIndexedPostsFromRedis(): Promise<IndexedPost[]> {
  const data = await redis.get(REDIS_KEY);
  return data ? JSON.parse(data) : [];
}

async function savePostsToRedis(posts: IndexedPost[]) {
  await redis.set(REDIS_KEY, JSON.stringify(posts));
}

const SIMILARITY_THRESHOLD = 20;
const ENABLE_AUTOCOMMENTS = true;

async function commentOnDuplicate(
  postId: `t3_${string}`,
  bestMatch: {
    title: string;
    permalink?: string;
    score: number;
  }
) {
  const existingThreadLink = bestMatch.permalink
    ? `https://www.reddit.com${bestMatch.permalink}`
    : undefined;

  const commentText = [
    '👋 ThreadScout found a similar discussion.',
    '',
    existingThreadLink
      ? `This topic may already exist here: [${bestMatch.title}](${existingThreadLink})`
      : `This topic may already exist in another recent thread: "${bestMatch.title}"`,
    '',
    'Consider joining the existing conversation to keep the subreddit organized 💬',
    '',
    `Similarity score: ${bestMatch.score}%`,
  ].join('\n');

  await reddit.submitComment({
    id: postId,
    text: commentText,
  });
}

triggers.post('/on-app-install', async (c) => {
  return c.json({
    status: 'success',
    message: 'ThreadScout installed successfully',
  });
});

triggers.post('/on-post-submit', async (c) => {
  const body = await c.req.json();

  const newPost = body?.post;
  const subredditName = body?.subreddit?.name;

  if (!newPost || !subredditName) {
    console.log('ThreadScout: Missing post or subreddit data.');
    return c.json({ status: 'error', message: 'Missing post data' }, 400);
  }


  const newPostText = `${newPost.title ?? ''} ${newPost.selftext ?? ''}`.trim();

  console.log('👀 ThreadScout checking new post:');
  console.log(`Title: ${newPost.title}`);
  console.log(`Subreddit: ${subredditName}`);

  const indexedPosts = await getIndexedPostsFromRedis();

  console.log(`📚 Indexed posts count: ${indexedPosts.length}`);

  const candidates = indexedPosts.filter((post) => post.id !== newPost.id);

  const matches = candidates.map((post) => {
    const similarity = calculateSimilarity(newPostText, post.text);

    return {
      id: post.id,
      title: post.title,
      permalink: post.permalink,
      score: similarity.score,
      matchedWords: similarity.matchedWords,
    };
  });

const bestMatch =
  matches.length > 0
    ? matches.sort((a, b) => b.score - a.score)[0]
    : undefined;

const isLikelyDuplicate =
  !!bestMatch && bestMatch.score >= SIMILARITY_THRESHOLD;

  console.log('🧠 ThreadScout best match:');
  console.log(bestMatch ?? 'No indexed posts to compare yet.');

  if (ENABLE_AUTOCOMMENTS && isLikelyDuplicate && bestMatch) {
      console.log('🚨 Possible duplicate detected!');
      console.log(`Matched post: ${bestMatch.title}`);
      console.log(`Score: ${bestMatch.score}%`);
      console.log(`Link: ${bestMatch.permalink}`);

      try {
        await commentOnDuplicate(newPost.id as `t3_${string}`, bestMatch);
        console.log('💬 ThreadScout comment posted.');
      } catch (error) {
        console.error('❌ Failed to post ThreadScout comment:', error);
      }
    } else {
      console.log('✅ No duplicate detected.');
    }

const updatedPosts = [
    {
      id: newPost.id,
      title: newPost.title ?? '',
      text: newPostText,
      permalink: newPost.permalink,
      createdAt: newPost.createdAt,
    },
    ...indexedPosts,
  ].slice(0, 100); // keep max 100

  await savePostsToRedis(updatedPosts);

  console.log('✅ Saved new post to Redis index');
  console.log('🧠 ThreadScout updated Redis index');

  return c.json({
    status: 'success',
    message: 'Post checked by ThreadScout',
    bestMatch,
    isLikelyDuplicate,
  });
});
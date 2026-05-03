import { Hono } from 'hono';
import { reddit, redis } from '@devvit/web/server';
import { calculateSimilarity } from '../core/similarity';
import { saveDuplicateCase } from '../core/duplicateCases';
import {
  generateDuplicateExplanation,
  getEmbedding,
  cosineSimilarity,
} from '../core/ai';

import {
  getThreadScoutSettings,
  getSimilarityThreshold,
  getLookbackMs,
} from '../core/settings';

export const triggers = new Hono();

type IndexedPost = {
  id: string;
  title: string;
  text: string;
  permalink?: string;
  createdAt?: number;
  embedding?: number[];
};

const REDIS_KEY = 'threadscout:posts';

async function getIndexedPostsFromRedis(): Promise<IndexedPost[]> {
  const data = await redis.get(REDIS_KEY);
  return data ? JSON.parse(data) : [];
}

async function savePostsToRedis(posts: IndexedPost[]) {
  await redis.set(REDIS_KEY, JSON.stringify(posts));
}

function prunePostsByLookback(posts: IndexedPost[], lookbackMs: number) {
  const now = Date.now();

  return posts.filter((post) => {
    if (!post.createdAt) return true;

    const createdAtMs =
      post.createdAt < 10_000_000_000 ? post.createdAt * 1000 : post.createdAt;

    return now - createdAtMs <= lookbackMs;
  });
}

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

  if (newPost.title === 'ThreadScout Dashboard') {
    console.log('🧭 Skipping ThreadScout Dashboard post.');
    return c.json({
      status: 'success',
      message: 'Skipped ThreadScout Dashboard post',
    });
  }

  const settings = await getThreadScoutSettings();
  const similarityThreshold = getSimilarityThreshold(settings.sensitivity);
  const lookbackMs = getLookbackMs(settings.lookbackWindow);

  console.log('⚙️ ThreadScout settings:', settings);
  console.log(`🎚️ Similarity threshold: ${similarityThreshold}`);

  const newPostText = `${newPost.title ?? ''} ${newPost.selftext ?? ''}`.trim();

  console.log('👀 ThreadScout checking new post:');
  console.log(`Title: ${newPost.title}`);
  console.log(`Subreddit: ${subredditName}`);

  const indexedPosts = await getIndexedPostsFromRedis();

  console.log(`📚 Indexed posts count: ${indexedPosts.length}`);

  const now = Date.now();

  const candidates = indexedPosts.filter((post) => {
    if (post.id === newPost.id) return false;

    if (!post.createdAt) return true;

    const createdAtMs =
      post.createdAt < 10_000_000_000 ? post.createdAt * 1000 : post.createdAt;

    return now - createdAtMs <= lookbackMs;
  });

  let redisIndexChanged = false;
  let newPostEmbedding: number[] = [];

  try {
    newPostEmbedding = await getEmbedding(newPostText);
    console.log('🧠 Generated embedding for new post.');
  } catch (error) {
    console.error('❌ Failed to generate new post embedding:', error);
  }

  const matches = await Promise.all(
    candidates.map(async (post) => {
      const keywordSimilarity = calculateSimilarity(newPostText, post.text);

      let embeddingStatus = 'not_used';

      let semanticPercent = 0;

      if (newPostEmbedding.length > 0) {
        try {
          let existingPostEmbedding = post.embedding;

          if (!existingPostEmbedding || existingPostEmbedding.length === 0) {
            existingPostEmbedding = await getEmbedding(post.text);
            post.embedding = existingPostEmbedding;
            redisIndexChanged = true;

            embeddingStatus = 'created_and_cached';
          } else {
            embeddingStatus = 'reused_from_cache';
          }

          const semanticScore = cosineSimilarity(
            newPostEmbedding,
            existingPostEmbedding
          );

          semanticPercent = Math.round(semanticScore * 100);
        } catch (error) {
          embeddingStatus = 'failed';
          console.error('❌ Failed to get candidate embedding:', error);
        }
      }

      const finalScore = Math.max(keywordSimilarity.score, semanticPercent);

      return {
        id: post.id,
        title: post.title,
        permalink: post.permalink,
        score: finalScore,
        keywordScore: keywordSimilarity.score,
        semanticScore: semanticPercent,
        matchedWords: keywordSimilarity.matchedWords,
        embeddingStatus,
      };
    })
  );

  const sortedMatches = [...matches].sort((a, b) => b.score - a.score);

  const bestMatch = sortedMatches.length > 0 ? sortedMatches[0] : undefined;

  const isLikelyDuplicate =
    !!bestMatch && bestMatch.score >= similarityThreshold;

  console.log('🏆 Top candidate matches:', sortedMatches.slice(0, 3));
  console.log('🧠 ThreadScout best match:', bestMatch ?? 'No indexed posts to compare yet.');

  if (isLikelyDuplicate && bestMatch) {
    console.log('🚨 Possible duplicate detected!');

    let aiExplanation = '';

    try {
      aiExplanation = await generateDuplicateExplanation(
        newPostText,
        `${bestMatch.title}`
      );

      console.log('🤖 AI duplicate explanation generated:', aiExplanation);
    } catch (error) {
      console.error('❌ Failed to generate AI explanation:', error);
    }

    await saveDuplicateCase({
      id: `${newPost.id}:${bestMatch.id}`,

      duplicatePostId: newPost.id,
      duplicateTitle: newPost.title ?? '',
      duplicatePermalink: newPost.permalink,

      originalPostId: bestMatch.id,
      originalTitle: bestMatch.title,
      originalPermalink: bestMatch.permalink,

      similarityScore: bestMatch.score,
      aiExplanation,

      subredditName,
      createdAt: Date.now(),

      status: 'pending',
    });

    console.log('📦 Saved duplicate case to Redis');

    if (settings.actionMode === 'comment_only') {
      try {
        await commentOnDuplicate(newPost.id as `t3_${string}`, bestMatch);
        console.log('💬 ThreadScout auto-comment posted.');
      } catch (error) {
        console.error('❌ Failed to post auto-comment:', error);
      }
    }

    if (settings.actionMode === 'flag_only') {
      console.log(
        '🏷️ Flag-only mode: case saved for mod review. No automatic action taken.'
      );
    }
  }

  // Scale guardrail:
  // 1. Add the newest post with its cached embedding.
  // 2. Remove posts outside the selected lookback window.
  // 3. Remove duplicate IDs.
  // 4. Cap Redis index size so large subreddits do not cause unbounded comparisons.

  const postsWithNewPost = [
    {
      id: newPost.id,
      title: newPost.title ?? '',
      text: newPostText,
      permalink: newPost.permalink,
      createdAt: newPost.createdAt,
      embedding: newPostEmbedding.length > 0 ? newPostEmbedding : undefined,
    },
    ...indexedPosts,
  ];

  const prunedPosts = prunePostsByLookback(postsWithNewPost, lookbackMs);

  const uniquePosts = Array.from(
    new Map(prunedPosts.map((post) => [post.id, post])).values()
  );

  const updatedPosts = uniquePosts.slice(0, 100);

  await savePostsToRedis(updatedPosts);

  if (redisIndexChanged) {
    console.log('🧠 Updated Redis index with newly cached candidate embeddings.');
  }

  console.log('🧹 Pruned Redis index by lookback window');
  console.log(`📦 Redis index size after guardrails: ${updatedPosts.length}`);
  console.log('✅ Saved new post to Redis index');
  console.log('🧠 ThreadScout updated Redis index');

  return c.json({
    status: 'success',
    message: 'Post checked by ThreadScout',
    bestMatch,
    isLikelyDuplicate,
  });
});
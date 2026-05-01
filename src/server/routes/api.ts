import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';

export const api = new Hono();

api.get('/test-reddit', async (c) => {
  try {
    const subredditName = 'threadscout_dev';

    const posts = await reddit
      .getNewPosts({
        subredditName,
        limit: 10,
        pageSize: 10,
      })
      .all();

    return c.json({
      status: 'success',
      count: posts.length,
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        permalink: post.permalink,
      })),
    });
  } catch (error) {
    console.error('❌ API test failed:', error);

    return c.json({
      status: 'error',
      message: 'Reddit API test failed',
      error: String(error),
    });
  }
});

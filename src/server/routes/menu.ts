import { Hono } from 'hono';
import { reddit, redis } from '@devvit/web/server';

export const menu = new Hono();

menu.post('/test-reddit-history', async (c) => {
  const subredditName = 'threadscout_dev';

  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subredditName}/new.json?limit=25`,
      {
        headers: {
          'User-Agent': 'ThreadScout Devvit Hackathon App by u/NeeshUX',
          Accept: 'application/json',
        },
      }
    );

    console.log('🌐 Public JSON status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Public JSON failed:', text);

      return c.json({
        message: 'Could not fetch subreddit history from public JSON.',
      });
    }

    const data = await response.json();

    const posts = data.data.children.map((child: any) => ({
      id: `t3_${child.data.id}`,
      title: child.data.title,
      selftext: child.data.selftext,
      permalink: child.data.permalink,
      createdAt: child.data.created_utc,
    }));

    console.log('✅ Public JSON history fetch worked!');
    console.log(posts);

    return c.json({
        showToast: `Fetched ${posts.length} posts from r/${subredditName}. Check terminal logs.`,
     });
  } catch (error) {
    console.error('❌ Public JSON test crashed:', error);

    return c.json({
        showToast: 'Public JSON test failed. Check terminal logs.',
    });
  }
});

menu.post('/test-comment', async (c) => {
  const body = await c.req.json();

  console.log('🧪 Menu test body:', body);

  const postId =
    body?.post?.id ??
    body?.postId ??
    body?.target?.id ??
    body?.thingId;

  if (!postId) {
    console.log('ThreadScout menu test: No postId found in body.');
    return c.json({
      showToast: 'No post ID found. Check logs.',
    });
  }

  try {
    await reddit.submitComment({
      id: postId as `t3_${string}`,
      text: '🧪 ThreadScout menu test comment.',
    });

    console.log('✅ ThreadScout menu test comment posted.');

    return c.json({
      showToast: 'ThreadScout test comment posted.',
    });
  } catch (error) {
    console.error('❌ ThreadScout menu test comment failed:', error);

    return c.json({
      showToast: 'ThreadScout test comment failed. Check logs.',
    });
  }
});

menu.post('/test-comment-direct', async (c) => {
  const body = await c.req.json();
  const postId = body?.postId;

  if (!postId) {
    return c.json({
      status: 'error',
      message: 'Missing postId',
    }, 400);
  }

  try {
    await reddit.submitComment({
      id: postId as `t3_${string}`,
      text: '🧪 ThreadScout direct endpoint test comment.',
    });

    return c.json({
      status: 'success',
      message: 'Comment posted',
    });
  } catch (error) {
    console.error('❌ Direct comment test failed:', error);

    return c.json({
      status: 'error',
      message: 'Comment failed',
    }, 500);
  }
});

menu.post('/open-dashboard', async (c) => {
  const body = await c.req.json();

  console.log('🧭 ThreadScout dashboard menu body:', body);

  const subredditName =
    body?.subreddit?.name ??
    body?.subredditName ??
    'threadscout_dev';

  const dashboardKey = `threadscout:${subredditName}:dashboardPostId`;

  try {
    const existingPostId = await redis.get(dashboardKey);

    if (existingPostId) {
      const cleanPostId = existingPostId.replace('t3_', '');

      console.log('♻️ Reusing existing dashboard:', existingPostId);

      return c.json({
        showToast: 'Opening ThreadScout Dashboard...',
        navigateTo: `https://www.reddit.com/r/${subredditName}/comments/${cleanPostId}`,
      });
    }

    const newPost = await reddit.submitCustomPost({
      subredditName,
      title: 'ThreadScout Dashboard',
      entry: 'default',
    });

    await redis.set(dashboardKey, newPost.id);

    const cleanPostId = newPost.id.replace('t3_', '');

    console.log('🆕 Created new dashboard:', newPost.id);

    return c.json({
      showToast: 'ThreadScout Dashboard created. Opening now...',
      navigateTo: `https://www.reddit.com/r/${subredditName}/comments/${cleanPostId}`,
    });
  } catch (error) {
    console.error('❌ Failed to open/create ThreadScout Dashboard:', error);

    return c.json({
      showToast: 'Could not open ThreadScout Dashboard. Check logs.',
    });
  }
});

menu.post('/view-threadscout-match', async (c) => {
  const body = await c.req.json();

  console.log('🔎 View ThreadScout match body:', body);

  const postId =
    body?.post?.id ??
    body?.postId ??
    body?.target?.id ??
    body?.thingId ??
    body?.targetId;

  if (!postId) {
    return c.json({
      showToast: 'No post ID found. Check logs.',
    });
  }

  console.log('⚡ Checking ThreadScout match for:', postId);

  try {
    let caseId = await redis.get(`threadscout:postCase:${postId}`);
    let match: any = null;

    if (caseId) {
      const rawCase = await redis.get(`threadscout:case:${caseId}`);
      match = rawCase ? JSON.parse(rawCase) : null;
    }

    // Fallback for older cases created before postCase index existed
    if (!match) {
      console.log('🔁 No fast index found. Falling back to case scan.');

      const idsRaw = await redis.get('threadscout:cases');
      const ids = idsRaw ? JSON.parse(idsRaw) : [];

      const cases = await Promise.all(
        ids.map(async (id: string) => {
          const raw = await redis.get(`threadscout:case:${id}`);
          return raw ? JSON.parse(raw) : null;
        })
      );

      match = cases.find(
        (caseData: any) =>
          caseData &&
          (caseData.duplicatePostId === postId ||
            caseData.originalPostId === postId)
      );

      // Backfill index so next click is fast
      if (match) {
        await redis.set(`threadscout:postCase:${match.duplicatePostId}`, match.id);
        await redis.set(`threadscout:postCase:${match.originalPostId}`, match.id);

        console.log('🧠 Backfilled postCase index for:', match.id);
      }
    }

    if (!match) {
      return c.json({
        showToast: 'No duplicate match found.',
      });
    }

    console.log('🎯 Match found:', match);

    return c.json({
      showToast: `Match found: ${match.similarityScore}% — view dashboard for details`,
    });
  } catch (error) {
    console.error('❌ ThreadScout match lookup failed:', error);

    return c.json({
      showToast: 'Error checking ThreadScout match.',
    });
  }
});

menu.post('/open-threadscout-case', async (c) => {
  const body = await c.req.json();

  console.log('🧭 Open ThreadScout case body:', body);

  const postId =
    body?.post?.id ??
    body?.postId ??
    body?.target?.id ??
    body?.thingId ??
    body?.targetId;

  if (!postId) {
    return c.json({
      showToast: 'No post ID found. Check logs.',
    });
  }

  try {
    let caseId = await redis.get(`threadscout:postCase:${postId}`);
    let match: any = null;

    if (caseId) {
      const rawCase = await redis.get(`threadscout:case:${caseId}`);
      match = rawCase ? JSON.parse(rawCase) : null;
    }

    // Fallback for older cases created before postCase index existed
    if (!match) {
      console.log('🔁 No fast index found. Falling back to case scan.');

      const idsRaw = await redis.get('threadscout:cases');
      const ids = idsRaw ? JSON.parse(idsRaw) : [];

      const cases = await Promise.all(
        ids.map(async (id: string) => {
          const raw = await redis.get(`threadscout:case:${id}`);
          return raw ? JSON.parse(raw) : null;
        })
      );

      match = cases.find(
        (caseData: any) =>
          caseData &&
          (caseData.duplicatePostId === postId ||
            caseData.originalPostId === postId)
      );

      if (match) {
        await redis.set(`threadscout:postCase:${match.duplicatePostId}`, match.id);
        await redis.set(`threadscout:postCase:${match.originalPostId}`, match.id);

        console.log('🧠 Backfilled postCase index for:', match.id);
      }
    }

    if (!match) {
      return c.json({
        showToast: 'No duplicate match found.',
      });
    }

    const subredditName = match.subredditName ?? 'threadscout_dev';
    const dashboardKey = `threadscout:${subredditName}:dashboardPostId`;

    const existingPostId = await redis.get(dashboardKey);

    if (!existingPostId) {
      return c.json({
        showToast: 'No dashboard found yet. Open ThreadScout Dashboard first.',
      });
    }

    const cleanPostId = existingPostId.replace('t3_', '');

    return c.json({
      showToast: `Opening case: ${match.similarityScore}% match`,
      navigateTo: `https://www.reddit.com/r/${subredditName}/comments/${cleanPostId}?caseId=${encodeURIComponent(match.id)}`,
    });
  } catch (error) {
    console.error('❌ Failed to open ThreadScout case:', error);

    return c.json({
      showToast: 'Could not open ThreadScout case. Check logs.',
    });
  }
});
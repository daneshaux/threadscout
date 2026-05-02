import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import {
  getDuplicateCases,
  updateDuplicateCaseStatus,
} from '../core/duplicateCases';

import {
  getThreadScoutSettings,
  saveThreadScoutSettings,
  type ThreadScoutSettings,
} from '../core/settings';

export const api = new Hono();

api.get('/cases', async (c) => {
  console.log('📡 /api/cases route hit');

  const cases = await getDuplicateCases();

  return c.json({
    status: 'success',
    count: cases.length,
    cases,
  });
});

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

api.post('/cases/:id/ignore', async (c) => {
  const id = c.req.param('id');

  const updated = await updateDuplicateCaseStatus(id, 'ignored');

  return c.json({ ok: true, case: updated });
});

api.post('/cases/:id/remove', async (c) => {
  const id = c.req.param('id');

  const cases = await getDuplicateCases();
  const caseData = cases.find((item) => item.id === id);

  if (!caseData) {
    return c.json({ ok: false, error: 'Case not found' }, 404);
  }

  await reddit.remove(caseData.duplicatePostId as `t3_${string}`, false);

  const updated = await updateDuplicateCaseStatus(id, 'removed');

  return c.json({ ok: true, case: updated });
});

api.post('/cases/:id/comment-redirect', async (c) => {
  const id = c.req.param('id');

  const cases = await getDuplicateCases();
  const caseData = cases.find((item) => item.id === id);

  if (!caseData) {
    return c.json({ ok: false, error: 'Case not found' }, 404);
  }

  const link = caseData.originalPermalink
    ? `https://reddit.com${caseData.originalPermalink}`
    : '';

  await reddit.submitComment({
    id: caseData.duplicatePostId as `t3_${string}`,
    text: `✅ Moderator reviewed: this post appears to duplicate an existing discussion.

Please continue the conversation here: ${link}

Thanks for helping keep the community organized 💬`,
  });

  const updated = await updateDuplicateCaseStatus(id, 'redirected');

  return c.json({ ok: true, case: updated });
});

api.get('/settings', async (c) => {
  const settings = await getThreadScoutSettings();

  return c.json({
    status: 'success',
    settings,
  });
});

api.post('/settings', async (c) => {
  const body = await c.req.json<ThreadScoutSettings>();

  const settings: ThreadScoutSettings = {
    sensitivity: body.sensitivity,
    actionMode: body.actionMode,
    lookbackWindow: body.lookbackWindow,
  };

  const saved = await saveThreadScoutSettings(settings);

  return c.json({
    status: 'success',
    settings: saved,
  });
});
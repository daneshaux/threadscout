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
import { requireModerator } from '../auth';

export const api = new Hono();

api.get('/cases', async (c) => {
  console.log('📡 /api/cases route hit');

  const auth = await requireModerator(c);
  if (!auth.ok) {
    return auth.response;
  }

  const cases = await getDuplicateCases();
  const subredditCases = cases.filter(
    (caseData) =>
      caseData.subredditName.toLowerCase() === auth.subredditName.toLowerCase()
  );

  return c.json({
    status: 'success',
    count: subredditCases.length,
    cases: subredditCases,
  });
});

api.get('/test-reddit', async (c) => {
  try {
    const subredditName = 'threadscout_dev';
    const auth = await requireModerator(c, { subredditName });
    if (!auth.ok) {
      return auth.response;
    }

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

  const cases = await getDuplicateCases();
  const caseData = cases.find((item) => item.id === id);

  if (!caseData) {
    return c.json({ ok: false, error: 'Case not found' }, 404);
  }

  const auth = await requireModerator(c, {
    subredditName: caseData.subredditName,
  });
  if (!auth.ok) {
    return auth.response;
  }

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

  const auth = await requireModerator(c, {
    subredditName: caseData.subredditName,
  });
  if (!auth.ok) {
    return auth.response;
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

  const auth = await requireModerator(c, {
    subredditName: caseData.subredditName,
  });
  if (!auth.ok) {
    return auth.response;
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
  const auth = await requireModerator(c);
  if (!auth.ok) {
    return auth.response;
  }

  const settings = await getThreadScoutSettings();

  return c.json({
    status: 'success',
    settings,
  });
});

api.post('/settings', async (c) => {
  const body = await c.req.json<ThreadScoutSettings>();
  const auth = await requireModerator(c, { body });
  if (!auth.ok) {
    return auth.response;
  }

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

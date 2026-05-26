import type { Context } from 'hono';
import { context as devvitContext, reddit } from '@devvit/web/server';

type ModeratorCheck =
  | {
      ok: true;
      subredditName: string;
      username: string;
    }
  | {
      ok: false;
      response: Response;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNestedString(
  value: unknown,
  firstKey: string,
  secondKey: string
): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const child = value[firstKey];
  if (!isRecord(child)) {
    return undefined;
  }

  return getString(child[secondKey]);
}

function getBodySubredditName(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  return (
    getNestedString(body, 'subreddit', 'name') ??
    getString(body.subredditName) ??
    getNestedString(body, 'post', 'subredditName') ??
    getNestedString(body, 'target', 'subredditName')
  );
}

function normalizeSubredditName(subredditName: string): string {
  return subredditName.replace(/^r\//i, '');
}

export async function requireModerator(
  c: Context,
  options: {
    body?: unknown;
    subredditName?: string;
  } = {}
): Promise<ModeratorCheck> {
  const rawSubredditName =
    options.subredditName ??
    getBodySubredditName(options.body) ??
    getString(c.req.query('subredditName')) ??
    getString(devvitContext.subredditName);
  const currentUsername =
    getString(devvitContext.username) ?? (await reddit.getCurrentUsername());

  if (!rawSubredditName || !currentUsername) {
    return {
      ok: false,
      response: c.json(
        {
          status: 'error',
          message:
            'ThreadScout dashboard is only available to moderators of this subreddit.',
        },
        403
      ),
    };
  }

  const subredditName = normalizeSubredditName(rawSubredditName);

  try {
    const moderators = await reddit
      .getModerators({
        subredditName,
        username: currentUsername,
        limit: 1,
        pageSize: 1,
      })
      .all();

    const isModerator = moderators.some(
      (moderator) =>
        moderator.username.toLowerCase() === currentUsername.toLowerCase()
    );

    if (!isModerator) {
      return {
        ok: false,
        response: c.json(
          {
            status: 'error',
            message:
              'ThreadScout dashboard is only available to moderators of this subreddit.',
          },
          403
        ),
      };
    }

    return {
      ok: true,
      subredditName,
      username: currentUsername,
    };
  } catch (error) {
    console.error('ThreadScout moderator permission check failed:', error);

    return {
      ok: false,
      response: c.json(
        {
          status: 'error',
          message:
            'ThreadScout dashboard is only available to moderators of this subreddit.',
        },
        403
      ),
    };
  }
}

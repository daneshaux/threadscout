import { redis } from '@devvit/web/server';

export type ThreadScoutSettings = {
  sensitivity: 'low' | 'medium' | 'high';
  actionMode: 'comment_only' | 'flag_only';
  lookbackWindow: '24h' | '7d' | '30d';
};

const SETTINGS_KEY = 'threadscout:settings';

export const DEFAULT_SETTINGS: ThreadScoutSettings = {
  sensitivity: 'medium',
  actionMode: 'comment_only',
  lookbackWindow: '7d',
};

export async function getThreadScoutSettings(): Promise<ThreadScoutSettings> {
  const raw = await redis.get(SETTINGS_KEY);

  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...(JSON.parse(raw) as Partial<ThreadScoutSettings>),
  };
}

export async function saveThreadScoutSettings(
  settings: ThreadScoutSettings
): Promise<ThreadScoutSettings> {
  await redis.set(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export function getSimilarityThreshold(
  sensitivity: ThreadScoutSettings['sensitivity']
) {
  if (sensitivity === 'high') return 15;
  if (sensitivity === 'low') return 45;
  return 25;
}

export function getLookbackMs(
  lookbackWindow: ThreadScoutSettings['lookbackWindow']
) {
  if (lookbackWindow === '24h') return 24 * 60 * 60 * 1000;
  if (lookbackWindow === '30d') return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}
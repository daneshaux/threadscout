import { redis } from '@devvit/web/server';
import type { DuplicateCase } from '../../shared/types';

const CASE_KEY = (id: string) => `threadscout:case:${id}`;
const CASE_LIST_KEY = 'threadscout:cases';

export async function saveDuplicateCase(caseData: DuplicateCase) {
  await redis.set(CASE_KEY(caseData.id), JSON.stringify(caseData));

  const existing = await redis.get(CASE_LIST_KEY);
  const ids = existing ? JSON.parse(existing) : [];

  const updated = [caseData.id, ...ids].slice(0, 100);
  await redis.set(CASE_LIST_KEY, JSON.stringify(updated));
}

export async function getDuplicateCases(): Promise<DuplicateCase[]> {
  const idsRaw = await redis.get(CASE_LIST_KEY);
  const ids = idsRaw ? JSON.parse(idsRaw) : [];

  const cases = await Promise.all(
    ids.map(async (id: string) => {
      const data = await redis.get(CASE_KEY(id));
      return data ? (JSON.parse(data) as DuplicateCase) : null;
    })
  );

  return cases.filter(Boolean) as DuplicateCase[];
}

export async function updateDuplicateCaseStatus(
  id: string,
  status: DuplicateCase['status']
): Promise<DuplicateCase | null> {
  const raw = await redis.get(CASE_KEY(id));
  if (!raw) return null;

  const caseData = JSON.parse(raw) as DuplicateCase;

  const updated: DuplicateCase = {
    ...caseData,
    status,
  };

  await redis.set(CASE_KEY(id), JSON.stringify(updated));

  return updated;
}
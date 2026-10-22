// Утренние чек-ины (одна запись на день) и настройки оценки готовности.
import { normalizeReadinessConfig, type ReadinessConfig } from '../domain/readiness.ts';
import type { Checkin } from '../domain/schemas.ts';
import { db } from './db.ts';
import { getSetting, saveEntity, setSetting, type DraftOf } from './repo.ts';

export const READINESS_CONFIG_KEY = 'readinessConfig';

/** Сохраняет чек-ин дня: если за этот день уже есть запись — обновляет её. */
export async function saveCheckin(draft: DraftOf<'checkins'>) {
  const existing = await db.checkins.where('date').equals(draft.date).first();
  return saveEntity('checkins', draft, existing);
}

export async function getReadinessConfig(): Promise<ReadinessConfig> {
  return normalizeReadinessConfig(await getSetting(READINESS_CONFIG_KEY));
}

export async function setReadinessConfig(c: ReadinessConfig): Promise<void> {
  await setSetting(READINESS_CONFIG_KEY, normalizeReadinessConfig(c));
}

export type { Checkin };

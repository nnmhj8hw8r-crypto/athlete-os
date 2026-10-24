// Служебные отметки приложения в таблице settings (v0.10): дата последней резервной копии и согласие
// с правилами использования. Хранятся только на устройстве.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.ts';
import { setSetting } from './repo.ts';

export const LAST_BACKUP_KEY = 'lastBackupAt';
export const CONSENT_KEY = 'consent';
/** Версия правил: если текст правил существенно изменится — увеличить, и согласие спросят снова. */
export const TERMS_VERSION = 1;

export interface Consent {
  version: number;
  acceptedAt: string;
}

export function useLastBackup(): string | null | undefined {
  return useLiveQuery(async () => {
    const v = (await db.settings.get(LAST_BACKUP_KEY))?.value;
    return typeof v === 'string' ? v : null;
  }, []);
}

/** undefined — ещё читается; null — согласия нет. */
export function useConsent(): Consent | null | undefined {
  return useLiveQuery(async () => {
    const v = (await db.settings.get(CONSENT_KEY))?.value as Partial<Consent> | undefined;
    return v && typeof v.acceptedAt === 'string' && v.version === TERMS_VERSION ? (v as Consent) : null;
  }, []);
}

export function acceptTerms(): Promise<void> {
  return setSetting(CONSENT_KEY, { version: TERMS_VERSION, acceptedAt: new Date().toISOString() } satisfies Consent);
}

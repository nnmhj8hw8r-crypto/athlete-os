// Профиль из приветствия и производные от него: режим приложения и адрес формы отзыва.
import { useLiveQuery } from 'dexie-react-hooks';
import { APP_VERSION } from '../../appVersion.ts';
import { FEEDBACK_FORM_URL } from '../../config.ts';
import { db } from '../../data/db.ts';
import { setSetting } from '../../data/repo.ts';
import { feedbackUrl, normalizeProfile, PROFILE_KEY, type AppLevel, type Profile } from '../../domain/profile.ts';

/** undefined — ещё загружается, null — приветствие не пройдено. */
export function useProfile(): Profile | null | undefined {
  const raw = useLiveQuery(async () => (await db.settings.get(PROFILE_KEY)) ?? null, []);
  return raw === undefined ? undefined : normalizeProfile(raw?.value);
}

/** Режим приложения; без профиля (старые установки) — полный. */
export function useLevel(): AppLevel {
  return useProfile()?.level ?? 'full';
}

export function saveProfile(p: Profile): Promise<void> {
  return setSetting(PROFILE_KEY, p);
}

export function useFeedbackUrl(): string {
  return feedbackUrl(FEEDBACK_FORM_URL, APP_VERSION, useProfile()?.scenario);
}

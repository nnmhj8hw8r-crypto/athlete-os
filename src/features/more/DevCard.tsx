// Режим разработчика (v0.9.3): скрытая карточка в «Настройках», включается 7 нажатиями по строке версии
// (как на Android). Хранится в settings.devMode только на этом устройстве. Инструменты для проверки
// того, что видят новые пользователи, — без изменения записей дневника.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db.ts';
import { countAll, deleteSetting, setSetting } from '../../data/repo.ts';
import type { Profile } from '../../domain/profile.ts';
import { Card } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { navigate } from '../../ui/router.ts';
import { saveProfile } from '../onboarding/useProfile.ts';

export const DEV_MODE_KEY = 'devMode';

export function useDevMode(): boolean {
  return useLiveQuery(async () => (await db.settings.get(DEV_MODE_KEY))?.value === true, []) ?? false;
}

export function DevCard({ profile }: { profile: Profile | null | undefined }) {
  const { notify } = useFeedback();
  const records = useLiveQuery(async () => (await countAll()) - (await db.settings.count()), []);
  return (
    <Card title="Режим разработчика">
      <p className="small muted">
        Записей в дневниках: {records ?? '…'} · сценарий: {profile?.scenario ?? 'нет'} · режим: {profile?.level ?? '—'} · пол: {profile?.sex ?? 'не указан'}
      </p>
      <div className="row wrap">
        <button type="button" className="btn small" onClick={() => location.reload()}>
          Показать заставку
        </button>
        <button type="button" className="btn small" onClick={() => navigate('/welcome')}>
          Открыть приветствие
        </button>
        {profile && (
          <button
            type="button"
            className="btn small"
            onClick={() => {
              void saveProfile({ ...profile, hideFeedbackPrompt: false, hideLevelHint: false, completedAt: new Date(Date.now() - 4 * 86_400_000).toISOString() });
              notify('Подсказки и карточка отзыва снова включены (карточка — при 5+ записях)');
            }}
          >
            Вернуть подсказки и отзыв
          </button>
        )}
        <button type="button" className="btn small" onClick={() => void setSetting('dashboardLayout', null).then(() => notify('Главная сброшена'))}>
          Сбросить главную
        </button>
        <button type="button" className="btn small ghost" onClick={() => void deleteSetting(DEV_MODE_KEY)}>
          Выключить режим
        </button>
      </div>
    </Card>
  );
}

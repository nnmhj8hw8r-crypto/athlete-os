// «Правила и разрешения» (v0.10): согласие с правилами использования и доступ к камере, уведомлениям и
// постоянному хранению. Используется в приветствии и на странице «Ещё» → «Правила и разрешения».
import { useEffect, useState, type ReactNode } from 'react';
import { acceptTerms, useConsent } from '../../data/appMeta.ts';
import { formatDateTime } from '../../domain/time.ts';
import { InfoButton, InfoPanel } from '../../ui/components.tsx';
import {
  cameraState,
  isStandalone,
  notificationState,
  PERM_LABEL,
  requestCamera,
  requestNotifications,
  requestStorage,
  storageState,
  type PermState,
} from '../../ui/devicePermissions.ts';
import { Icons } from '../../ui/icons.tsx';

export const TERMS: string[] = [
  'Приложение — личный дневник. Записи хранятся только на этом устройстве. Наружу уходит лишь поисковый запрос или штрихкод, когда вы ищете продукт.',
  'Расчёты и советы — оценки по вашим записям, а не медицинская рекомендация. При боли, травме или плохом самочувствии обращайтесь к врачу.',
  'Это демо-версия: функции меняются, возможны ошибки. Регулярно сохраняйте резервную копию.',
  'Данные о продуктах — из открытых баз (Open Food Facts, USDA): сверяйте с упаковкой.',
];

function Row({ icon, title, text, state, action, info }: { icon: ReactNode; title: string; text: string; state: PermState | null; action?: () => void; info?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="perm-row">
      <span className="more-icon">{icon}</span>
      <span className="grow">
        <span className="title">{title}</span>
        <span className="meta">{text}</span>
        {open && info && <InfoPanel>{info}</InfoPanel>}
      </span>
      <span className="perm-side">
        {state === 'granted' ? (
          <span className="perm-ok">{Icons.check}</span>
        ) : state && state !== 'unsupported' && action ? (
          <button type="button" className="btn small" onClick={action}>
            Разрешить
          </button>
        ) : (
          <span className="small muted">{state ? PERM_LABEL[state] : '…'}</span>
        )}
        {info && <InfoButton open={open} onToggle={() => setOpen((o) => !o)} label={title} />}
      </span>
    </li>
  );
}

export function PermissionsPanel({ showTerms = true }: { showTerms?: boolean }) {
  const consent = useConsent();
  const [camera, setCamera] = useState<PermState | null>(null);
  const [notif, setNotif] = useState<PermState | null>(null);
  const [storage, setStorage] = useState<PermState | null>(null);
  useEffect(() => {
    void cameraState().then(setCamera);
    setNotif(notificationState());
    void storageState().then(setStorage);
  }, []);
  const standalone = isStandalone();

  return (
    <div className="stack">
      {showTerms && (
        <div className="terms">
          <ul className="onb-points">
            {TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {consent ? (
            <p className="small muted">Вы согласились {formatDateTime(consent.acceptedAt)}.</p>
          ) : (
            <button type="button" className="btn primary" onClick={() => void acceptTerms()}>
              {Icons.check} Согласен с правилами
            </button>
          )}
        </div>
      )}
      <ul className="more-list perm-list">
        <Row
          icon={Icons.camera}
          title="Камера"
          text="Для сканера штрихкодов. Снимки никуда не сохраняются."
          state={camera}
          action={() => void requestCamera().then(setCamera)}
          info={
            <p>
              Safari может спрашивать каждый раз. Чтобы не спрашивал: в Safari нажмите «аА» в адресной строке → «Настройки веб-сайта» → «Камера» → «Разрешить».
              В приложении с экрана «Домой» iPhone иногда спрашивает снова после перезапуска — это ограничение iOS.
            </p>
          }
        />
        <Row
          icon={Icons.bell}
          title="Уведомления"
          text="Напоминания о добавках и чек-ине."
          state={notif}
          action={() => void requestNotifications().then(setNotif)}
          info={
            <p>
              На iPhone уведомления работают только у приложения, добавленного на экран «Домой» (iOS 16.4 и новее){standalone ? '' : ' — сейчас вы в браузере'}. Надёжнее
              всего напоминания через «Календарь»: в «Добавках» есть кнопка «Напоминание в календарь».
            </p>
          }
        />
        <Row
          icon={Icons.shield}
          title="Хранить данные постоянно"
          text="Просьба к браузеру не удалять записи, если приложение долго не открывали."
          state={storage}
          action={() => void requestStorage().then(setStorage)}
          info={<p>Это просьба, а не гарантия. Лучшая защита — приложение на экране «Домой» и резервная копия раз в неделю.</p>}
        />
      </ul>
    </div>
  );
}

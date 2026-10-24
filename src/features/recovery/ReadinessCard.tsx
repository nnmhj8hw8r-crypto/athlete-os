// Главный блок «Восстановления» (v0.8, по мотивам Athlytic / Bevel / NOOP): статус, крупное число 0–100
// и полоса, «Что влияет», объяснение, совет на сегодня с действиями. Пока норма не изучена — «Калибровка».
import { adviceLine, COMPONENT_LABEL, describeFactor, explain, readinessBand } from '../../domain/readiness.ts';
import { useState, type ReactNode } from 'react';
import { InfoButton, InfoPanel } from '../../ui/components.tsx';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import type { ReadinessState } from './useReadiness.ts';

export const NOT_MEDICAL = 'Оценка по вашим записям относительно вашей нормы. Не медицинская рекомендация.';

/** Заголовок карточки с кнопкой «i»: подробности — по запросу (v0.10). */
function Head({ label, info }: { label: string; info: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="row-between">
        <span className="hero-label">{label}</span>
        <InfoButton open={open} onToggle={() => setOpen((o) => !o)} label="как считается готовность" />
      </div>
      {open && <InfoPanel>{info}</InfoPanel>}
    </>
  );
}

const HOW = (calibrationDays: number) => (
  <>
    <p>
      Оценка 0–100 — сравнение утреннего чек-ина с вашей личной нормой: медианой последних 28 записей и вашим обычным разбросом. На уровне нормы — 70.
    </p>
    <p>
      Первые {calibrationDays} дней идёт калибровка: приложение изучает, какие значения обычны именно для вас. Отвечайте честно и примерно в одно время — утром, до
      тренировки.
    </p>
    <p className="muted">
      Субъективные оценки самочувствия хорошо отражают реакцию на нагрузку (Saw и соавт., 2016); обзоры мониторинга советуют оценивать изменения
      относительно своей нормы (Bourdon и соавт., 2017). Описания шкал — свои, это не валидированный опросник; учёт разброса и границы статусов
      80 / 60 / 40 — стартовые настройки приложения. {NOT_MEDICAL}
    </p>
  </>
);

export function ReadinessCard({ state, onCheckin, onSettings }: { state: ReadinessState; onCheckin: () => void; onSettings: () => void }) {
  const r = state.result;
  const how = HOW(state.config.calibrationDays);

  if (r.kind === 'no-checkin') {
    return (
      <section className="hero-card readiness">
        <Head label="Готовность сегодня" info={how} />
        <b className="readiness-title">Утренний чек-ин</b>
        <span className="muted">30 секунд: сон, самочувствие, мышцы.</span>
        <button type="button" className="btn primary big" onClick={onCheckin}>
          Пройти чек-ин
        </button>
      </section>
    );
  }

  if (r.kind === 'calibrating') {
    return (
      <section className="hero-card readiness">
        <Head label="Готовность сегодня" info={how} />
        <b className="readiness-title">Калибровка</b>
        <div className="calib-dots" role="progressbar" aria-valuemin={0} aria-valuemax={r.need} aria-valuenow={r.have} aria-label={`Калибровка: ${r.have} из ${r.need} дней`}>
          {Array.from({ length: r.need }, (_, i) => (
            <span key={i} className={i < r.have ? 'on' : undefined} />
          ))}
        </div>
        <span className="muted small">
          {r.have} из {r.need} утренних чек-инов — ещё {r.need - r.have}, и появится оценка.
        </span>
        <div className="row">
          <button type="button" className="btn small" onClick={onCheckin}>
            Изменить чек-ин
          </button>
          <button type="button" className="btn small ghost" onClick={onSettings}>
            Настроить
          </button>
        </div>
      </section>
    );
  }

  if (r.kind === 'insufficient') {
    return (
      <section className="hero-card readiness">
        <Head label="Готовность сегодня" info={how} />
        <b className="readiness-title">Недостаточно данных</b>
        <span className="muted small">Сегодня отмечено то, для чего ваша норма ещё не изучена.</span>
        <button type="button" className="btn small" onClick={onCheckin}>
          Изменить чек-ин
        </button>
      </section>
    );
  }

  const band = readinessBand(r.score);
  const tiles = r.factors.slice(0, 4).map(describeFactor);
  return (
    <section className="hero-card readiness">
      <Head
        label={band.title}
        info={
          <>
            {how}
            {r.missing.length > 0 && (
              <p className="muted">
                Без данных (их вес отдан остальным): {r.missing.map((m) => COMPONENT_LABEL[m].charAt(0).toLowerCase() + COMPONENT_LABEL[m].slice(1)).join(', ')}.
              </p>
            )}
          </>
        }
      />
      <b className="readiness-score num">{r.score}</b>
      <div className={`readiness-bar ${band.level}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.score} aria-label="Готовность">
        <span style={{ width: `${r.score}%` }} />
      </div>

      <h3 className="readiness-sub">Что влияет</h3>
      {tiles.length ? (
        <div className="factor-grid">
          {tiles.map((t) => (
            <div key={t.label} className={`factor${t.better ? ' better' : ''}`}>
              <span className="factor-label">{t.label}</span>
              <b className="num">{t.value}</b>
              <span className="factor-delta">
                <span className="factor-arrow" aria-hidden="true">
                  {t.delta === 'как обычно' ? '•' : t.up ? '↑' : '↓'}
                </span>
                {t.delta}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">Недостаточно данных для сравнения с нормой.</p>
      )}
      <p className="readiness-explain">{explain(r.factors)}</p>

      <div className="advice-card">
        <span className="hero-label">Совет на сегодня</span>
        <b>{adviceLine(r.score, state.recovering)}</b>
        <div className="row">
          <a className="btn small primary" href={href('/training?tab=week')}>
            {Icons.training} К тренировке на сегодня
          </a>
          <button type="button" className="btn small" onClick={onSettings}>
            Настроить
          </button>
        </div>
      </div>
      <div className="row-between">
        <span className="muted small">Не медицинская рекомендация</span>
        <button type="button" className="btn small ghost" onClick={onCheckin}>
          Изменить чек-ин
        </button>
      </div>
    </section>
  );
}

// Главный блок «Восстановления» (v0.8, по мотивам Athlytic / Bevel / NOOP): статус, крупное число 0–100
// и полоса, «Что влияет», объяснение, совет на сегодня с действиями. Пока норма не изучена — «Калибровка».
import { adviceLine, COMPONENT_LABEL, describeFactor, explain, readinessBand } from '../../domain/readiness.ts';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import type { ReadinessState } from './useReadiness.ts';

export const NOT_MEDICAL = 'Оценка по вашим записям относительно вашей нормы. Не медицинская рекомендация.';

export function ReadinessCard({ state, onCheckin, onSettings }: { state: ReadinessState; onCheckin: () => void; onSettings: () => void }) {
  const r = state.result;

  if (r.kind === 'no-checkin') {
    return (
      <section className="hero-card readiness">
        <span className="hero-label">Готовность сегодня</span>
        <b className="readiness-title">Утренний чек-ин</b>
        <span className="muted">Сон, самочувствие и мышцы — до 30 секунд. После этого появится оценка и совет на день.</span>
        <button type="button" className="btn primary big" onClick={onCheckin}>
          Пройти чек-ин
        </button>
      </section>
    );
  }

  if (r.kind === 'calibrating') {
    const pct = Math.round((r.have / r.need) * 100);
    return (
      <section className="hero-card readiness">
        <span className="hero-label">Готовность сегодня</span>
        <b className="readiness-title">Калибровка: {r.have} из {r.need} дней</b>
        <div className="readiness-bar calibrating" role="progressbar" aria-valuemin={0} aria-valuemax={r.need} aria-valuenow={r.have}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="muted small">
          Оценка считается относительно вашей личной нормы. Она появится, когда наберётся {r.need} прошлых чек-инов — ещё{' '}
          {r.need - r.have}.
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
        <span className="hero-label">Готовность сегодня</span>
        <b className="readiness-title">Недостаточно данных</b>
        <span className="muted small">В сегодняшнем чек-ине нет показателей, по которым уже изучена ваша норма.</span>
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
      <span className="hero-label">{band.title}</span>
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
      <p className="muted small">На уровне вашей нормы — 70. Границы статусов (80 / 60 / 40) условные и стартовые.</p>
      {r.missing.length > 0 && <p className="muted small">Без данных (вес распределён на остальные): {r.missing.map((m) => COMPONENT_LABEL[m].charAt(0).toLowerCase() + COMPONENT_LABEL[m].slice(1)).join(', ')}.</p>}

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
        <span className="muted small">Совет, а не запрет: план тренировок не меняется автоматически.</span>
      </div>
      <div className="row-between">
        <span className="muted small">{NOT_MEDICAL}</span>
        <button type="button" className="btn small ghost" onClick={onCheckin}>
          Чек-ин
        </button>
      </div>
    </section>
  );
}

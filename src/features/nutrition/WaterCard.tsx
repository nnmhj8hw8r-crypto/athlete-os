// Вода за день: прогресс к цели и быстрые кнопки «стакан / бутылка / литр / своё».
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { addWater } from '../../data/meals.ts';
import { deleteEntity } from '../../data/repo.ts';
import { parseDecimal } from '../../domain/form.ts';
import { EFSA_TOTAL_WATER_ML, DRINKS_SHARE, waterTargetFor, type NutritionPlan } from '../../domain/plan.ts';
import { formatTime } from '../../domain/time.ts';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';

const PRESETS = [
  { ml: 250, label: 'Стакан 250 мл' },
  { ml: 500, label: 'Бутылка 0,5 л' },
  { ml: 1000, label: 'Литр' },
];

const liters = (ml: number) => `${(Math.round(ml / 10) / 100).toLocaleString('ru-RU')} л`;

export function WaterCard({ date, plan, defaultMl, onOpenPlan }: { date: string; plan?: NutritionPlan; defaultMl?: number; onOpenPlan: () => void }) {
  const { notify } = useFeedback();
  const entries = useLiveQuery(() => db.water.where('date').equals(date).sortBy('createdAt'), [date]);
  const [custom, setCustom] = useState('');
  const [showList, setShowList] = useState(false);
  const total = (entries ?? []).reduce((s, e) => s + e.ml, 0);
  const fallback = defaultMl ?? Math.round(EFSA_TOTAL_WATER_ML.male * DRINKS_SHARE);
  const target = waterTargetFor(plan, date, fallback);
  const pct = target.ml > 0 ? Math.min(100, Math.round((total / target.ml) * 100)) : 0;

  async function add(ml: number) {
    const r = await addWater(date, ml);
    if (!r.ok) return notify(Object.values(r.errors)[0] ?? 'Ошибка', 'error');
    notify(`+${ml} мл воды`);
  }

  return (
    <section className="card water-card" aria-label="Вода">
      <div className="meal-head static">
        <span className="meal-ico water" aria-hidden="true">
          {Icons.drop}
        </span>
        <span className="grow">
          <span className="meal-name">Вода</span>
          <span className="muted small num">
            {liters(total)} из {liters(target.ml)}
            {target.custom ? ' · особая цель на этот день' : plan ? '' : ' · ориентир EFSA'}
          </span>
        </span>
        <b className="num">{pct}%</b>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Выпито от цели">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="chips">
        {PRESETS.map((p) => (
          <button key={p.ml} type="button" className="chip" onClick={() => add(p.ml)}>
            + {p.label}
          </button>
        ))}
        <form
          className="chip-form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = parseDecimal(custom);
            if (v === undefined || !(v > 0) || v > 5000) return notify('Укажите от 1 до 5000 мл', 'error');
            void add(Math.round(v));
            setCustom('');
          }}
        >
          <label className="visually-hidden" htmlFor="water-ml">
            Своё количество, мл
          </label>
          <input id="water-ml" className="input" inputMode="numeric" placeholder="мл" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button type="submit" className="chip" aria-label="Добавить своё количество воды">
            {Icons.plus}
          </button>
        </form>
      </div>
      {(entries?.length ?? 0) > 0 && (
        <button type="button" className="btn ghost small" onClick={() => setShowList((v) => !v)}>
          {showList ? 'Скрыть записи' : `Записи за день (${entries!.length})`}
        </button>
      )}
      {showList && (
        <ul className="meal-items">
          {entries!.map((e) => (
            <li key={e.id} className="meal-item">
              <span className="grow num">
                {formatTime(e.createdAt)} — {e.ml} мл
              </span>
              <button type="button" className="icon-btn" aria-label={`Удалить ${e.ml} мл`} onClick={() => deleteEntity('water', e.id)}>
                {Icons.trash}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!plan && (
        <button type="button" className="btn ghost small" onClick={onOpenPlan}>
          Настроить цель по воде в личном плане
        </button>
      )}
    </section>
  );
}

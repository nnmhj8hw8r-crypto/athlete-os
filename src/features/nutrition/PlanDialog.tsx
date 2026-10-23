// «Составить личный план»: параметры, цель по массе (вручную или по соревнованию), ежедневный вес.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity, saveEntity } from '../../data/repo.ts';
import { numberToField, parseDecimal } from '../../domain/form.ts';
import {
  ACTIVITY_LABEL,
  ACTIVITY_LEVELS,
  computePlan,
  nutritionPlanSchema,
  PLAN_SOURCES,
  ADAPTIVE_WINDOW_DAYS,
  estimateActualBurn,
  type NutritionPlan,
} from '../../domain/plan.ts';
import { formatDateKey, formatDateTime, fromLocalInputValue, getZonedParts, toDateKey, todayKey } from '../../domain/time.ts';
import { SPORT_LABEL } from '../../config.ts';
import { Field, Modal, Tabs } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import { savePlan, usePlanState } from './planData.ts';

type Section = 'plan' | 'weight' | 'water';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function PlanDialog({ onClose, initial = 'plan' }: { onClose: () => void; initial?: Section }) {
  const [section, setSection] = useState<Section>(initial);
  const state = usePlanState();
  return (
    <Modal title="Личный план" onClose={onClose} size="full">
      <Tabs
        label="Раздел плана"
        value={section}
        onChange={setSection}
        options={[
          { value: 'plan', label: 'План' },
          { value: 'weight', label: 'Вес' },
          { value: 'water', label: 'Вода' },
        ]}
      />
      {state.loading ? (
        <p className="muted">Загрузка…</p>
      ) : section === 'plan' ? (
        <PlanForm plan={state.plan} weightKg={state.latestWeight?.weightKg} onGoWeight={() => setSection('weight')} />
      ) : section === 'weight' ? (
        <WeightSection target={state.plan?.goal === 'target' ? state.plan.targetWeightKg : undefined} />
      ) : (
        <WaterSection plan={state.plan} defaultMl={state.targets?.waterMl} />
      )}
    </Modal>
  );
}

const DEFAULTS: NutritionPlan = {
  sex: 'male',
  birthYear: 2000,
  heightCm: 175,
  activity: 'high',
  goal: 'maintain',
  proteinPerKg: 1.8,
  fatPct: 25,
  waterOverrides: {},
};

function PlanForm({ plan, weightKg, onGoWeight }: { plan?: NutritionPlan; weightKg?: number; onGoWeight: () => void }) {
  const { notify } = useFeedback();
  const init = plan ?? DEFAULTS;
  const competitions = useLiveQuery(
    () =>
      db.competitions
        .where('startAt')
        .above(new Date().toISOString())
        .filter((c) => c.status === 'planned' || c.status === 'registered')
        .sortBy('startAt'),
    [],
  );
  const [f, setF] = useState({
    sex: init.sex,
    birthYear: String(init.birthYear),
    heightCm: numberToField(init.heightCm),
    activity: init.activity,
    goal: init.goal,
    targetMode: init.competitionId ? 'competition' : 'manual',
    competitionId: init.competitionId ?? '',
    targetWeightKg: numberToField(init.targetWeightKg),
    targetDate: init.targetDate ?? '',
    proteinPerKg: numberToField(init.proteinPerKg),
    fatPct: numberToField(init.fatPct),
    waterMl: numberToField(init.waterMl),
  });
  const [errors, setErrors] = useState<string[]>([]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const comp = competitions?.find((c) => c.id === f.competitionId);
  const draft = {
    sex: f.sex,
    birthYear: Number(f.birthYear),
    heightCm: parseDecimal(f.heightCm),
    activity: f.activity,
    goal: f.goal,
    competitionId: f.goal === 'target' && f.targetMode === 'competition' ? f.competitionId || undefined : undefined,
    targetWeightKg:
      f.goal !== 'target' ? undefined : f.targetMode === 'competition' ? comp?.targetWeightKg : parseDecimal(f.targetWeightKg),
    targetDate: f.goal !== 'target' ? undefined : f.targetMode === 'competition' ? (comp ? toDateKey(comp.weighInAt) : undefined) : f.targetDate || undefined,
    proteinPerKg: parseDecimal(f.proteinPerKg),
    fatPct: parseDecimal(f.fatPct),
    waterMl: f.waterMl.trim() ? parseDecimal(f.waterMl) : undefined,
    waterOverrides: plan?.waterOverrides ?? {},
  };
  const parsed = nutritionPlanSchema.safeParse(draft);
  const preview = parsed.success && weightKg ? computePlan(parsed.data, weightKg, todayKey(), getZonedParts(new Date()).year) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    if (parsed.data.goal === 'target' && (parsed.data.targetWeightKg === undefined || !parsed.data.targetDate)) {
      setErrors([f.targetMode === 'competition' ? 'У выбранного соревнования нет целевой массы — укажите её во вкладке «Сезон» или задайте цель вручную.' : 'Укажите целевую массу и дату.']);
      return;
    }
    await savePlan(parsed.data);
    setErrors([]);
    notify('Личный план сохранён');
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {!weightKg && (
        <p className="notice warn">
          Для расчёта нужен текущий вес.{' '}
          <button type="button" className="btn small" onClick={onGoWeight}>
            Внести вес
          </button>
        </p>
      )}
      {errors.length > 0 && (
        <div className="notice error" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <div className="fields-2">
        <Field label="Пол">
          {(p) => (
            <select {...p} className="input" value={f.sex} onChange={set('sex')}>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          )}
        </Field>
        <Field label="Год рождения">{(p) => <input {...p} className="input" inputMode="numeric" value={f.birthYear} onChange={set('birthYear')} />}</Field>
        <Field label="Рост, см">{(p) => <input {...p} className="input" inputMode="decimal" value={f.heightCm} onChange={set('heightCm')} />}</Field>
        <Field label="Нагрузка">
          {(p) => (
            <select {...p} className="input" value={f.activity} onChange={set('activity')}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_LABEL[a]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Цель">
        {(p) => (
          <select {...p} className="input" value={f.goal} onChange={set('goal')}>
            <option value="maintain">Поддерживать текущий вес</option>
            <option value="target">Выйти на целевой вес к дате (соревнование или своя цель)</option>
          </select>
        )}
      </Field>

      {f.goal === 'target' && (
        <div className="card stack">
          <Tabs
            label="Источник цели"
            value={f.targetMode as 'competition' | 'manual'}
            onChange={(v) => setF((s) => ({ ...s, targetMode: v }))}
            options={[
              { value: 'competition', label: 'По соревнованию' },
              { value: 'manual', label: 'Своя цель' },
            ]}
          />
          {f.targetMode === 'competition' ? (
            competitions && competitions.length === 0 ? (
              <p className="small muted">Будущих соревнований нет. Добавьте их во вкладке «Сезон» (с целевой массой) или задайте цель вручную.</p>
            ) : (
              <Field label="Соревнование" hint="Цель — целевая масса соревнования, дата — день взвешивания. При изменении старта во вкладке «Сезон» план пересчитается.">
                {(p) => (
                  <select {...p} className="input" value={f.competitionId} onChange={set('competitionId')}>
                    <option value="">— выберите —</option>
                    {(competitions ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${SPORT_LABEL[c.sport]} ${c.weightCategory}: ${c.name}, взвешивание ${formatDateTime(c.weighInAt)}${c.targetWeightKg ? `, цель ${r1(c.targetWeightKg)} кг` : ' — нет целевой массы'}`}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )
          ) : (
            <div className="fields-2">
              <Field label="Целевой вес, кг">{(p) => <input {...p} className="input" inputMode="decimal" value={f.targetWeightKg} onChange={set('targetWeightKg')} />}</Field>
              <Field label="К дате">{(p) => <input {...p} className="input" type="date" value={f.targetDate} onChange={set('targetDate')} />}</Field>
            </div>
          )}
        </div>
      )}

      <div className="fields-2">
        <Field label="Белок, г на кг веса" hint="ISSN: 1,4–2,0 г/кг для тренирующихся">
          {(p) => <input {...p} className="input" inputMode="decimal" value={f.proteinPerKg} onChange={set('proteinPerKg')} />}
        </Field>
        <Field label="Жиры, % калорий" hint="ACSM: 20–35% энергии">
          {(p) => <input {...p} className="input" inputMode="decimal" value={f.fatPct} onChange={set('fatPct')} />}
        </Field>
      </div>
      <Field label="Вода из напитков, мл в день" optional hint="Пусто — ориентир EFSA. Особые дни задаются во вкладке «Вода».">
        {(p) => <input {...p} className="input" inputMode="numeric" value={f.waterMl} onChange={set('waterMl')} />}
      </Field>

      {preview && <PlanSummary t={preview} />}
      {preview && <ActualBurnCard t={preview} />}

      <button type="submit" className="btn primary">
        Сохранить план
      </button>

      <details className="details">
        <summary>Как считается и источники</summary>
        <ul className="small muted sources">
          <li>Основной обмен — формула Миффлина — Сан Жеора, затем × коэффициент нагрузки.</li>
          <li>Темп к цели: разница масс × ≈7700 ккал/кг, распределённая до даты. Это грубая оценка: реальная динамика зависит от воды, гликогена и тренировок.</li>
          <li>Белок — г/кг веса, жиры — доля калорий, углеводы — остаток.</li>
          <li>Приложение не рассчитывает сгонку за счёт обезвоживания и «водную загрузку»: решения о таком режиме принимают тренер и спортивный врач.</li>
          {PLAN_SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </form>
  );
}

export function PlanSummary({ t }: { t: ReturnType<typeof computePlan> }) {
  return (
    <div className="card stack">
      <div className="plan-grid">
        <div>
          <b className="num">{t.kcal.toLocaleString('ru-RU')}</b>
          <span>ккал в день</span>
        </div>
        <div>
          <b className="num">{t.protein}</b>
          <span>белки, г</span>
        </div>
        <div>
          <b className="num">{t.fat}</b>
          <span>жиры, г</span>
        </div>
        <div>
          <b className="num">{t.carbs}</b>
          <span>углев., г ({r1(t.carbsPerKg)} г/кг)</span>
        </div>
      </div>
      <p className="small muted">
        Вес {r1(t.weightKg)} кг · основной обмен ≈ {t.bmr.toLocaleString('ru-RU')} ккал · расход с нагрузкой ≈ {t.tdee.toLocaleString('ru-RU')} ккал · вода из
        напитков ≈ {r1(t.waterMl / 1000)} л
      </p>
      {t.weeklyChangeKg !== null && t.daysLeft !== null && (
        <p className="small">
          До цели {t.daysLeft} дн. · нужный темп {t.weeklyChangeKg > 0 ? '+' : ''}
          {r1(t.weeklyChangeKg)} кг/нед ({t.weeklyChangePct! > 0 ? '+' : ''}
          {r1(t.weeklyChangePct!)}% массы)
        </p>
      )}
      {t.warnings.map((w) => (
        <p key={w} className="notice warn">
          {w}
        </p>
      ))}
    </div>
  );
}

/**
 * Фактический расход по записям за 3 недели: сколько в среднем съедено и как менялась масса. Помогает поправить
 * калорийность, если формула ошиблась для конкретного человека. Только оценка: питание должно быть записано почти всё.
 */
function ActualBurnCard({ t }: { t: ReturnType<typeof computePlan> }) {
  const data = useLiveQuery(async () => {
    const from = toDateKey(new Date(Date.now() - (ADAPTIVE_WINDOW_DAYS + 1) * 86_400_000).toISOString());
    const meals = await db.meals.where('date').aboveOrEqual(from).toArray();
    const weights = await db.bodyWeights.toArray();
    const intake = new Map<string, number>();
    for (const m of meals) intake.set(m.date, (intake.get(m.date) ?? 0) + m.nutrients.kcal);
    return { intake, weights: weights.map((w) => ({ date: toDateKey(w.measuredAt), kg: w.weightKg })) };
  }, []);
  if (!data) return null;
  const est = estimateActualBurn(data.intake, data.weights, todayKey(), t.weeklyChangeKg ?? 0);
  if (!est) {
    return (
      <p className="small muted">
        Через 2–3 недели записей питания и хотя бы 4 взвешиваний здесь появится ваш фактический расход — по тому, сколько вы ели и как
        менялся вес. Он точнее формулы.
      </p>
    );
  }
  const capped = est.suggestedKcal !== null && est.suggestedKcal < t.bmr;
  return (
    <div className="card stack">
      <b>По вашим данным за 3 недели</b>
      <p className="small">
        Съедено в среднем {est.avgIntakeKcal.toLocaleString('ru-RU')} ккал ({est.loggedDays} дн. с записями) · вес {est.weeklyTrendKg > 0 ? '+' : ''}
        {r1(est.weeklyTrendKg)} кг/нед · фактический расход ≈ <b>{est.tdee.toLocaleString('ru-RU')} ккал</b> (по формуле{' '}
        {t.tdee.toLocaleString('ru-RU')}).
      </p>
      {est.suggestedKcal !== null && (
        <p className="small">
          Для нужного темпа — около <b>{Math.max(est.suggestedKcal, t.bmr).toLocaleString('ru-RU')} ккал</b> в день
          {capped ? ' (ограничено основным обменом — темп к дате не получится, пересмотрите цель)' : ''}.
        </p>
      )}
      <p className="small muted">
        Оценка: расход = средний рацион − изменение массы × 7700 ккал/кг. Если часть еды не записана, расход получится заниженным. Меняйте
        калорийность постепенно (на 10–15%) и смотрите на тренд за 2–3 недели, а не на один день.
      </p>
    </div>
  );
}

function WeightSection({ target }: { target?: number }) {
  const { notify } = useFeedback();
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('measuredAt').toArray(), []);
  const [date, setDate] = useState(todayKey());
  const [kg, setKg] = useState('');
  const [error, setError] = useState<string>();

  async function add(e: FormEvent) {
    e.preventDefault();
    const w = parseDecimal(kg);
    const at = fromLocalInputValue(`${date}T08:00`);
    if (w === undefined || !at) return setError('Укажите вес и дату');
    const r = await saveEntity('bodyWeights', { measuredAt: at, weightKg: w });
    if (!r.ok) return setError(Object.values(r.errors)[0]);
    setError(undefined);
    setKg('');
    notify(`Вес ${r1(w)} кг записан`);
  }

  const list = weights ?? [];
  const last = list[list.length - 1];
  const first90 = list.filter((w) => Date.parse(w.measuredAt) >= Date.now() - 90 * 86_400_000);
  const weekAgo = [...list].reverse().find((w) => Date.parse(w.measuredAt) <= Date.now() - 6.5 * 86_400_000);

  return (
    <div className="stack">
      <form className="row" onSubmit={add} noValidate>
        <label className="visually-hidden" htmlFor="w-date">
          Дата
        </label>
        <input id="w-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <label className="visually-hidden" htmlFor="w-kg">
          Вес, кг
        </label>
        <input id="w-kg" className="input" inputMode="decimal" placeholder="Вес, кг" value={kg} onChange={(e) => setKg(e.target.value)} style={{ width: 110 }} />
        <button type="submit" className="btn primary">
          {Icons.scale} Записать
        </button>
      </form>
      {error && <p className="notice error">{error}</p>}
      <p className="small muted">Взвешивайтесь в одинаковых условиях (например, утром натощак) — так динамика честнее. Записи общие с вкладкой «Сезон».</p>

      {last && (
        <div className="plan-grid">
          <div>
            <b className="num">{r1(last.weightKg)}</b>
            <span>кг сейчас</span>
          </div>
          {weekAgo && (
            <div>
              <b className="num">
                {last.weightKg - weekAgo.weightKg > 0 ? '+' : ''}
                {r1(last.weightKg - weekAgo.weightKg)}
              </b>
              <span>кг за неделю</span>
            </div>
          )}
          {target !== undefined && (
            <div>
              <b className="num">{r1(last.weightKg - target)}</b>
              <span>кг до цели {r1(target)}</span>
            </div>
          )}
        </div>
      )}

      <LineChart
        points={first90.map((w) => ({ x: Date.parse(w.measuredAt), y: w.weightKg }))}
        unit="кг"
        label="Вес за 90 дней"
        reference={target !== undefined ? { y: target, label: `цель ${r1(target)} кг` } : undefined}
        formatX={(x) => formatDateKey(toDateKey(new Date(x)))}
      />

      {list.length > 0 && (
        <ul className="meal-items">
          {[...list]
            .reverse()
            .slice(0, 14)
            .map((w) => (
              <li key={w.id} className="meal-item">
                <span className="grow">
                  {formatDateKey(toDateKey(w.measuredAt))} — <b className="num">{r1(w.weightKg)} кг</b>
                </span>
                <button type="button" className="icon-btn" aria-label={`Удалить запись веса ${r1(w.weightKg)} кг`} onClick={() => deleteEntity('bodyWeights', w.id)}>
                  {Icons.trash}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function WaterSection({ plan, defaultMl }: { plan?: NutritionPlan; defaultMl?: number }) {
  const { notify } = useFeedback();
  const [date, setDate] = useState(todayKey());
  const [ml, setMl] = useState('');
  if (!plan) return <p className="muted">Сначала сохраните план во вкладке «План».</p>;
  const overrides = Object.entries(plan.waterOverrides).sort(([a], [b]) => a.localeCompare(b));

  async function save(next: Record<string, number>) {
    await savePlan({ ...plan!, waterOverrides: next });
  }

  return (
    <div className="stack">
      <p>
        Обычная цель: <b>{r1((defaultMl ?? 0) / 1000)} л</b> воды из напитков в день.
      </p>
      <p className="small muted">
        Ориентир EFSA: 2,5 л общей воды в сутки для мужчин (2,0 л для женщин), из них около 20% даёт еда. В дни тренировок
        потребность выше — восполняйте потери с потом. Свою обычную цель можно задать во вкладке «План».
      </p>
      <div className="notice info">
        <b>Особые дни.</b> Если тренер или спортивный врач назначил вам другой режим питья на конкретные дни (например, перед
        соревнованием), внесите его здесь — приложение покажет эту цель в дневнике в эти дни. Сам такой режим приложение не
        рассчитывает: протоколы с ограничением воды перед взвешиванием связаны с риском для здоровья и проводятся только под
        контролем специалиста.
      </div>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          const v = parseDecimal(ml);
          if (v === undefined || v < 0 || v > 15000) return notify('Укажите цель от 0 до 15 000 мл', 'error');
          await save({ ...plan.waterOverrides, [date]: Math.round(v) });
          setMl('');
          notify('Цель на день сохранена');
        }}
      >
        <label className="visually-hidden" htmlFor="wo-date">
          Дата
        </label>
        <input id="wo-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <label className="visually-hidden" htmlFor="wo-ml">
          Цель, мл
        </label>
        <input id="wo-ml" className="input" inputMode="numeric" placeholder="мл" value={ml} onChange={(e) => setMl(e.target.value)} style={{ width: 100 }} />
        <button type="submit" className="btn">
          Сохранить
        </button>
      </form>
      {overrides.length > 0 && (
        <ul className="meal-items">
          {overrides.map(([d, v]) => (
            <li key={d} className="meal-item">
              <span className="grow">
                {formatDateKey(d)} — <b className="num">{r1(v / 1000)} л</b>
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Удалить цель на ${formatDateKey(d)}`}
                onClick={() => {
                  const next = { ...plan.waterOverrides };
                  delete next[d];
                  void save(next);
                }}
              >
                {Icons.trash}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

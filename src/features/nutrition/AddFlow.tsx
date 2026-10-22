// Добавление еды по образцу FatSecret:
// тап по приёму пищи → шторка (поиск, штрихкод, ручной ввод, быстрый ввод, «Моя сохранённая еда»)
// → экран «Завтрак ▾» с вкладками «История / Поиск еды / Рецепты» → порция.
import { useState } from 'react';
import { MealIcon } from './MealIcon.tsx';
import type { Extra } from '../../../shared/catalog.ts';
import { saveMealEntry, saveQuickEntry, type PortionFood } from '../../data/meals.ts';
import { REFERENCE_FOODS } from '../../data/referenceFoods.ts';
import { splitHistoryByMeal, type HistoryItem } from '../../domain/foodHistory.ts';
import { parseDecimal } from '../../domain/form.ts';
import { MEAL_TYPE_LABEL, unitLabel } from '../../domain/nutrition.ts';
import { MEAL_TYPES, type Food, type MealType, type RecipeIngredient } from '../../domain/schemas.ts';
import { Field, Modal, Tabs } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { FoodFormDialog, type FoodPrefill } from './FoodFormDialog.tsx';
import { BarcodeLookup } from './FoodLookup.tsx';
import { DISH_OPTIONS, foodOption, historyOption, KIND_LABEL, useFoodData, useFoodSearch, type FoodOption } from './foodOptions.ts';
import { MealEntryDialog } from './MealEntryDialog.tsx';
import { RecipeDialog, type RecipePrefill } from './RecipeDialog.tsx';


const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

type Tab = 'history' | 'search' | 'recipes';
type Step =
  | { kind: 'sheet' }
  | { kind: 'screen' }
  | { kind: 'barcode' }
  | { kind: 'manual'; prefill: FoodPrefill }
  | { kind: 'quick' }
  | { kind: 'portion'; food: PortionFood }
  | { kind: 'recipe'; prefill?: RecipePrefill; food?: Food };

export type AddStart = 'sheet' | 'search' | 'barcode';

export function optionToPortion(o: FoodOption): PortionFood {
  return {
    foodId: o.foodId,
    refId: o.foodId ? undefined : o.refId,
    name: o.name,
    brand: o.brand,
    basis: o.basis,
    per100: o.per100,
    extra: o.extra,
    sourceUrl: o.sourceUrl,
    lastAmount: o.lastAmount,
  };
}

const foodToPortion = (f: Food): PortionFood => optionToPortion(foodOption(f));

/** Ингредиенты типового блюда для «Изменить под себя»: продукты встроенной базы. */
function dishToRecipe(o: FoodOption): RecipePrefill | undefined {
  const recipe = o.reference?.recipe;
  if (!recipe) return undefined;
  const ingredients: RecipeIngredient[] = recipe.ingredients.map((i) => {
    if (i.id === 'water') {
      const zero = Object.fromEntries(['sugars', 'fiber', 'satFat', 'monoFat', 'polyFat', 'cholesterol', 'sodium'].map((k) => [k, 0])) as Extra;
      return { foodId: 'water', name: 'Вода', basis: 'ml', amount: i.grams, per100: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, extra: { ...zero, water: 100 } };
    }
    const ref = REFERENCE_FOODS.find((r) => r.id === i.id)!;
    return { foodId: ref.id, name: ref.name, basis: 'g', amount: i.grams, per100: ref.per100, extra: ref.extra };
  });
  return { name: `${o.name} (мой вариант)`, ingredients, totalWeightG: recipe.totalWeightG };
}

interface Props {
  mealType: MealType;
  date: string;
  start?: AddStart;
  /** Дневная цель калорий из личного плана — для «РСК %». */
  targetKcal?: number;
  onClose: () => void;
}

export function AddFlow({ mealType, date, start = 'sheet', targetKcal, onClose }: Props) {
  const { notify } = useFeedback();
  const [meal, setMeal] = useState<MealType>(mealType);
  const [step, setStep] = useState<Step>(start === 'barcode' ? { kind: 'barcode' } : start === 'search' ? { kind: 'screen' } : { kind: 'sheet' });
  const [tab, setTab] = useState<Tab>(start === 'search' ? 'search' : 'history');
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const data = useFoodData();
  const results = useFoodSearch(query, data);

  const toScreen = (t: Tab) => {
    setTab(t);
    setStep({ kind: 'screen' });
  };

  async function quickAdd(o: FoodOption) {
    if (!o.lastAmount) return setStep({ kind: 'portion', food: optionToPortion(o) });
    const r = await saveMealEntry({ food: optionToPortion(o), amount: o.lastAmount, mealType: meal, date });
    if (!r.ok) return notify(Object.values(r.errors)[0] ?? 'Не удалось добавить', 'error');
    setAdded((s) => new Set(s).add(o.key));
    notify(`${o.name}: ${r1(o.lastAmount)} ${unitLabel(o.basis)} → «${MEAL_TYPE_LABEL[meal]}»`);
  }

  switch (step.kind) {
    case 'sheet':
      return (
        <Modal
          title={
            <span className="title-with-icon">
              <MealIcon meal={meal} size="sm" /> {MEAL_TYPE_LABEL[meal]}
            </span>
          }
          onClose={onClose}
          size="sheet"
        >
          <button type="button" className="search-fake" onClick={() => toScreen('search')}>
            {Icons.search}
            <span>Поиск продуктов, блюд и рецептов</span>
          </button>
          <div className="add-grid">
            <button type="button" className="add-tile" onClick={() => setStep({ kind: 'barcode' })}>
              {Icons.barcode}
              <span>Сканирование штрихкода</span>
            </button>
            <button type="button" className="add-tile" onClick={() => setStep({ kind: 'manual', prefill: {} })}>
              {Icons.pen}
              <span>Ручной ввод продукта</span>
            </button>
            <button type="button" className="add-tile" onClick={() => setStep({ kind: 'quick' })}>
              {Icons.bolt}
              <span>Быстрый ввод калорий</span>
            </button>
          </div>
          <button type="button" className="add-wide" onClick={() => toScreen('recipes')}>
            {Icons.book}
            <span>
              <b>Моя сохранённая еда</b>
              <small>Рецепты, мои продукты, типовые блюда</small>
            </span>
          </button>
          <button type="button" className="add-wide" onClick={() => toScreen('history')}>
            {Icons.history}
            <span>
              <b>Моя история</b>
              <small>Недавно съеденное — добавить в один тап</small>
            </span>
          </button>
        </Modal>
      );

    case 'barcode':
      return (
        <Modal title={`${MEAL_TYPE_LABEL[meal]}: штрихкод`} onClose={onClose}>
          <BarcodeLookup
            onSelected={(f) => setStep({ kind: 'portion', food: foodToPortion(f) })}
            onManual={(prefill) => setStep({ kind: 'manual', prefill })}
          />
          <button type="button" className="btn ghost" onClick={() => setStep({ kind: 'sheet' })}>
            ← Другие способы добавления
          </button>
        </Modal>
      );

    case 'manual':
      return (
        <FoodFormDialog
          prefill={step.prefill}
          onClose={() => setStep({ kind: 'sheet' })}
          onSaved={(f) => setStep({ kind: 'portion', food: foodToPortion(f) })}
        />
      );

    case 'quick':
      return <QuickEntryDialog meal={meal} date={date} onClose={onClose} onBack={() => setStep({ kind: 'sheet' })} />;

    case 'portion':
      return (
        <MealEntryDialog food={step.food} mealType={meal} date={date} onClose={onClose} onBack={() => setStep({ kind: 'screen' })} />
      );

    case 'recipe':
      return (
        <RecipeDialog
          food={step.food}
          prefill={step.prefill}
          onClose={() => toScreen('recipes')}
          onSaved={(f) => setStep({ kind: 'portion', food: foodToPortion(f) })}
        />
      );

    case 'screen': {
      const { thisMeal, other } = splitHistoryByMeal(data.history, meal);
      return (
        <Modal
          size="full"
          onClose={onClose}
          title={
            <label className="meal-switch">
              <span className="visually-hidden">Приём пищи</span>
              <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_TYPE_LABEL[m]}
                  </option>
                ))}
              </select>
              {Icons.chevronDown}
            </label>
          }
        >
          <div className="search-box">
            {Icons.search}
            <label className="visually-hidden" htmlFor="add-q">
              Поиск еды
            </label>
            <input
              id="add-q"
              type="search"
              autoComplete="off"
              placeholder="Поиск продукта или блюда"
              value={query}
              autoFocus={tab === 'search'}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim()) setTab('search');
              }}
            />
          </div>
          <Tabs
            label="Разделы"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'history', label: 'История' },
              { value: 'search', label: 'Поиск еды' },
              { value: 'recipes', label: 'Рецепты' },
            ]}
          />

          {tab === 'history' && (
            <HistoryTab
              meal={meal}
              thisMeal={thisMeal}
              other={other}
              targetKcal={targetKcal}
              added={added}
              loading={data.loading}
              onPick={(o) => setStep({ kind: 'portion', food: optionToPortion(o) })}
              onQuickAdd={quickAdd}
            />
          )}

          {tab === 'search' && (
            <div className="stack">
              {!query.trim() ? (
                <p className="muted small">
                  Ищите по-простому: «картошка», «пюре», «гречка с курицей», «греческий йогурт». Опечатки и падежи учитываются.
                </p>
              ) : results.length === 0 ? (
                <p className="muted small">Ничего не найдено. Создайте продукт — он сохранится в ваш каталог.</p>
              ) : (
                <ul className="food-list">
                  {results.map((o) => (
                    <FoodRow key={o.key} o={o} targetKcal={targetKcal} added={added.has(o.key)} showKind onPick={() => setStep({ kind: 'portion', food: optionToPortion(o) })} onQuickAdd={() => quickAdd(o)} />
                  ))}
                </ul>
              )}
              <div className="row">
                <button type="button" className="btn" onClick={() => setStep({ kind: 'manual', prefill: { name: query.trim() } })}>
                  + Создать продукт
                </button>
                <button type="button" className="btn ghost" onClick={() => setStep({ kind: 'barcode' })}>
                  {Icons.barcode} Штрихкод
                </button>
              </div>
              <p className="small muted">
                Поиск: ваша история и продукты → встроенная база (продукты USDA и типовые блюда) →
                {data.offline ? ` офлайн-база российских товаров (${data.offline.products.length.toLocaleString('ru-RU')})` : ' офлайн-база товаров (загружается…)'}.
              </p>
            </div>
          )}

          {tab === 'recipes' && (
            <RecipesTab
              foods={data.foods ?? []}
              onPick={(o) => setStep({ kind: 'portion', food: optionToPortion(o) })}
              onNew={() => setStep({ kind: 'recipe' })}
              onEdit={(f) => setStep({ kind: 'recipe', food: f })}
              onCustomize={(o) => setStep({ kind: 'recipe', prefill: dishToRecipe(o) })}
            />
          )}
        </Modal>
      );
    }
  }
}

function FoodRow({
  o,
  targetKcal,
  added,
  showKind,
  onPick,
  onQuickAdd,
}: {
  o: FoodOption;
  targetKcal?: number;
  added?: boolean;
  showKind?: boolean;
  onPick: () => void;
  onQuickAdd: () => void;
}) {
  const unit = unitLabel(o.basis);
  const portionKcal = o.lastAmount ? (o.per100.kcal * o.lastAmount) / 100 : null;
  return (
    <li className="food-row">
      <button type="button" className="food-main" onClick={onPick}>
        <span className="title">
          {o.name}
          {o.brand && <span className="muted"> ({o.brand})</span>}
        </span>
        <span className="meta num">
          {portionKcal !== null ? (
            <>
              <b className="accent">
                {r1(o.lastAmount!)} {unit}
              </b>
              {targetKcal ? ` · РСК ${Math.round((portionKcal / targetKcal) * 100)}%` : ''} · {Math.round(portionKcal)} ккал
            </>
          ) : (
            <>
              {Math.round(o.per100.kcal)} ккал · Б {r1(o.per100.protein)} · Ж {r1(o.per100.fat)} · У {r1(o.per100.carbs)} на 100 {unit}
            </>
          )}
          {showKind && <span className="badge kind">{KIND_LABEL[o.kind]}</span>}
        </span>
      </button>
      <button
        type="button"
        className={`round-add${added ? ' done' : ''}`}
        aria-label={o.lastAmount ? `Добавить ${o.name}: ${r1(o.lastAmount)} ${unit}` : `Выбрать порцию: ${o.name}`}
        onClick={o.lastAmount ? onQuickAdd : onPick}
      >
        {added ? '✓' : Icons.plus}
      </button>
    </li>
  );
}

function HistoryTab({
  meal,
  thisMeal,
  other,
  targetKcal,
  added,
  loading,
  onPick,
  onQuickAdd,
}: {
  meal: MealType;
  thisMeal: HistoryItem[];
  other: HistoryItem[];
  targetKcal?: number;
  added: Set<string>;
  loading: boolean;
  onPick: (o: FoodOption) => void;
  onQuickAdd: (o: FoodOption) => void;
}) {
  const [expandMeal, setExpandMeal] = useState(false);
  const [expandOther, setExpandOther] = useState(false);
  if (loading) return <p className="muted">Загрузка…</p>;
  if (thisMeal.length + other.length === 0) {
    return <p className="muted small">История пока пуста. Добавьте еду через поиск или штрихкод — она появится здесь, и её можно будет добавить в один тап.</p>;
  }
  const row = (h: HistoryItem) => {
    const o = historyOption(h);
    return <FoodRow key={o.key} o={o} targetKcal={targetKcal} added={added.has(o.key)} onPick={() => onPick(o)} onQuickAdd={() => onQuickAdd(o)} />;
  };
  const meals = expandMeal ? thisMeal : thisMeal.slice(0, 5);
  const others = expandOther ? other : other.slice(0, 8);
  return (
    <div className="stack">
      {thisMeal.length > 0 && (
        <section className="stack">
          <p className="search-group">
            Недавно в «{MEAL_TYPE_LABEL[meal]}»
          </p>
          <ul className="food-list">{meals.map(row)}</ul>
          {thisMeal.length > 5 && (
            <button type="button" className="btn ghost small" onClick={() => setExpandMeal((v) => !v)}>
              {expandMeal ? 'Свернуть' : `Развернуть «${MEAL_TYPE_LABEL[meal]}» (${thisMeal.length})`}
            </button>
          )}
        </section>
      )}
      {other.length > 0 && (
        <section className="stack">
          <p className="search-group">Всё остальное</p>
          <ul className="food-list">{others.map(row)}</ul>
          {other.length > 8 && (
            <button type="button" className="btn ghost small" onClick={() => setExpandOther((v) => !v)}>
              {expandOther ? 'Свернуть' : `Показать всё (${other.length})`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function RecipesTab({
  foods,
  onPick,
  onNew,
  onEdit,
  onCustomize,
}: {
  foods: Food[];
  onPick: (o: FoodOption) => void;
  onNew: () => void;
  onEdit: (f: Food) => void;
  onCustomize: (o: FoodOption) => void;
}) {
  const recipes = foods.filter((f) => f.source === 'recipe').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const mine = foods.filter((f) => f.source !== 'recipe').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [showDishes, setShowDishes] = useState(true);
  return (
    <div className="stack">
      <section className="stack">
        <div className="row-between">
          <p className="search-group">Мои рецепты</p>
          <button type="button" className="btn small" onClick={onNew}>
            + Новый рецепт
          </button>
        </div>
        {recipes.length === 0 ? (
          <p className="muted small">Своих рецептов пока нет. Создайте новый или возьмите типовое блюдо и нажмите «Изменить под себя».</p>
        ) : (
          <ul className="food-list">
            {recipes.map((f) => (
              <li key={f.id} className="food-row">
                <button type="button" className="food-main" onClick={() => onPick(foodOption(f))}>
                  <span className="title">{f.name}</span>
                  <span className="meta num">
                    {Math.round(f.per100.kcal)} ккал · Б {r1(f.per100.protein)} · Ж {r1(f.per100.fat)} · У {r1(f.per100.carbs)} на 100 г
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Изменить рецепт: ${f.name}`} onClick={() => onEdit(f)}>
                  {Icons.edit}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <button type="button" className="row-between section-toggle" onClick={() => setShowDishes((v) => !v)} aria-expanded={showDishes}>
          <span className="search-group">Типовые блюда ({DISH_OPTIONS.length})</span>
          {Icons.chevronDown}
        </button>
        {showDishes && (
          <>
            <p className="small muted">Расчёт по типовому рецепту из продуктов USDA — оценка. «Изменить под себя» создаёт ваш рецепт с этими ингредиентами.</p>
            <ul className="food-list">
              {DISH_OPTIONS.map((o) => (
                <li key={o.key} className="food-row">
                  <button type="button" className="food-main" onClick={() => onPick(o)}>
                    <span className="title">{o.name}</span>
                    <span className="meta num">
                      {Math.round(o.per100.kcal)} ккал · Б {r1(o.per100.protein)} · Ж {r1(o.per100.fat)} · У {r1(o.per100.carbs)} на 100 г
                    </span>
                  </button>
                  <button type="button" className="btn small" onClick={() => onCustomize(o)}>
                    Изменить под себя
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="stack">
        <p className="search-group">Мои продукты ({mine.length})</p>
        {mine.length === 0 ? (
          <p className="muted small">Сюда попадают продукты, которые вы создали вручную или сохранили по штрихкоду.</p>
        ) : (
          <ul className="food-list">
            {mine.slice(0, 50).map((f) => {
              const o = foodOption(f);
              return (
                <li key={o.key} className="food-row">
                  <button type="button" className="food-main" onClick={() => onPick(o)}>
                    <span className="title">
                      {f.name}
                      {f.brand && <span className="muted"> ({f.brand})</span>}
                    </span>
                    <span className="meta num">
                      {Math.round(f.per100.kcal)} ккал на 100 {unitLabel(f.basis)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function QuickEntryDialog({ meal, date, onClose, onBack }: { meal: MealType; date: string; onClose: () => void; onBack: () => void }) {
  const { notify } = useFeedback();
  const [f, setF] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const kcal = parseDecimal(f.kcal);
    if (kcal === undefined || !(kcal > 0)) return setError('Укажите калории (больше нуля)');
    const num = (v: string) => {
      const x = parseDecimal(v);
      return x !== undefined && Number.isFinite(x) && x >= 0 ? x : 0;
    };
    const r = await saveQuickEntry({
      name: f.name,
      nutrients: { kcal, protein: num(f.protein), fat: num(f.fat), carbs: num(f.carbs) },
      mealType: meal,
      date,
    });
    if (!r.ok) return setError(Object.values(r.errors)[0] ?? 'Ошибка');
    notify(`Быстрый ввод добавлен в «${MEAL_TYPE_LABEL[meal]}»`);
    onClose();
  }

  return (
    <Modal
      title={`${MEAL_TYPE_LABEL[meal]}: быстрый ввод`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onBack}>
            Назад
          </button>
          <button type="submit" form="quick-form" className="btn primary">
            Добавить
          </button>
        </>
      }
    >
      <form id="quick-form" className="form" onSubmit={submit} noValidate>
        <p className="small muted">Когда нет времени искать продукт: только калории и, по желанию, БЖУ всего приёма пищи. В «Историю» не попадает.</p>
        {error && <p className="notice error">{error}</p>}
        <Field label="Что это было" optional>
          {(p) => <input {...p} className="input" placeholder="Например: обед в столовой" value={f.name} onChange={set('name')} />}
        </Field>
        <div className="fields-4">
          <Field label="Ккал">{(p) => <input {...p} className="input" inputMode="decimal" value={f.kcal} onChange={set('kcal')} autoFocus />}</Field>
          <Field label="Белки, г" optional>{(p) => <input {...p} className="input" inputMode="decimal" value={f.protein} onChange={set('protein')} />}</Field>
          <Field label="Жиры, г" optional>{(p) => <input {...p} className="input" inputMode="decimal" value={f.fat} onChange={set('fat')} />}</Field>
          <Field label="Углеводы, г" optional>{(p) => <input {...p} className="input" inputMode="decimal" value={f.carbs} onChange={set('carbs')} />}</Field>
        </div>
        <p className="small muted">Не указанные БЖУ записываются как 0 и занижают итоги — по возможности укажите их.</p>
      </form>
    </Modal>
  );
}

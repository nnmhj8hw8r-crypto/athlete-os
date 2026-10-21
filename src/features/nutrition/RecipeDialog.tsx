// Рецепт: блюдо из нескольких продуктов каталога. Сохраняется как продукт (на 100 г готового блюда).
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db } from '../../data/db.ts';
import { filterFoods } from '../../data/foods.ts';
import { saveEntity } from '../../data/repo.ts';
import { numberToField, parseDecimal, type FieldErrors } from '../../domain/form.ts';
import { computeRecipe, unitLabel } from '../../domain/nutrition.ts';
import type { Food, RecipeIngredient } from '../../domain/schemas.ts';
import { Field, FormError, Modal } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { MacroGrid } from './MacroGrid.tsx';

interface Row {
  key: string;
  ingredient: Omit<RecipeIngredient, 'amount'>;
  amount: string;
}

let rowKey = 0;

export function RecipeDialog({ food, onClose }: { food?: Food; onClose: () => void }) {
  const { notify } = useFeedback();
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const [name, setName] = useState(food?.name ?? '');
  const [rows, setRows] = useState<Row[]>(
    (food?.recipe?.ingredients ?? []).map((i) => ({
      key: String(rowKey++),
      ingredient: { foodId: i.foodId, name: i.name, basis: i.basis, per100: i.per100 },
      amount: numberToField(i.amount),
    })),
  );
  const [totalWeight, setTotalWeight] = useState(numberToField(food?.recipe?.totalWeightG));
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const ingredients = rows.map((r) => ({ ...r.ingredient, amount: parseDecimal(r.amount) ?? Number.NaN }));
  const validAmounts = ingredients.every((i) => Number.isFinite(i.amount) && i.amount > 0);
  const total = parseDecimal(totalWeight);
  const result = rows.length && validAmounts ? computeRecipe(ingredients, total) : null;

  const candidates = foods && query.trim() ? filterFoods(foods, query).filter((f) => f.id !== food?.id).slice(0, 8) : [];

  function add(f: Food) {
    setRows((r) => [...r, { key: String(rowKey++), ingredient: { foodId: f.id, name: f.name, basis: f.basis, per100: f.per100 }, amount: '' }]);
    setQuery('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validAmounts || rows.length === 0) {
      setErrors({ _form: rows.length === 0 ? 'Добавьте хотя бы один ингредиент' : 'Укажите количество каждого ингредиента (больше нуля)' });
      return;
    }
    if (totalWeight.trim() && !(total !== undefined && total > 0)) {
      setErrors({ _form: 'Итоговая масса должна быть положительным числом' });
      return;
    }
    const computed = computeRecipe(ingredients, total);
    if (!computed.ok) {
      setErrors({ _form: computed.error });
      return;
    }
    const r = await saveEntity(
      'foods',
      {
        name,
        basis: 'g',
        per100: computed.per100,
        source: 'recipe',
        sourceNote: 'Рассчитано по ингредиентам',
        recipe: { ingredients, totalWeightG: total },
      },
      food,
    );
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    notify(food ? 'Рецепт обновлён' : 'Рецепт сохранён в каталог');
    onClose();
  }

  return (
    <Modal
      title={food ? 'Изменить рецепт' : 'Новый рецепт'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="recipe-form" className="btn primary">
            Сохранить
          </button>
        </>
      }
    >
      <form id="recipe-form" className="form" onSubmit={submit} noValidate>
        <FormError errors={errors} />
        <Field label="Название блюда" error={errors.name}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>

        <div className="section">
          <h3>Ингредиенты</h3>
          {rows.length === 0 && <p className="muted small">Найдите продукты своего каталога и добавьте их в рецепт.</p>}
          {rows.map((r, idx) => (
            <div key={r.key} className="row" style={{ flexWrap: 'nowrap' }}>
              <span className="grow" style={{ flex: 1, minWidth: 0 }}>
                {r.ingredient.name}
              </span>
              <label className="visually-hidden" htmlFor={`ing-${r.key}`}>
                Количество {r.ingredient.name}, {unitLabel(r.ingredient.basis)}
              </label>
              <input
                id={`ing-${r.key}`}
                className="input"
                style={{ width: 90 }}
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setRows((list) => list.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))}
              />
              <span className="muted">{unitLabel(r.ingredient.basis)}</span>
              <button type="button" className="icon-btn" aria-label={`Убрать ${r.ingredient.name}`} onClick={() => setRows((list) => list.filter((_, i) => i !== idx))}>
                {Icons.trash}
              </button>
            </div>
          ))}
          <label className="visually-hidden" htmlFor="ing-q">
            Найти ингредиент
          </label>
          <input id="ing-q" className="input" placeholder="Добавить ингредиент: начните вводить название" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query.trim() && candidates.length === 0 && <p className="small muted">В каталоге нет подходящих продуктов. Сначала добавьте продукт в каталог.</p>}
          {candidates.length > 0 && (
            <ul className="list">
              {candidates.map((f) => (
                <li key={f.id}>
                  <button type="button" className="list-item selectable" onClick={() => add(f)}>
                    <span className="grow">
                      <span className="title">{f.name}</span>
                      <span className="meta">
                        {Math.round(f.per100.kcal)} ккал / 100 {unitLabel(f.basis)}
                      </span>
                    </span>
                    {Icons.plus}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field
          label="Итоговая масса готового блюда, г"
          optional
          hint="Если пусто — берётся сумма масс ингредиентов. Обязательно, если есть ингредиенты в мл или блюдо уваривается."
        >
          {(p) => <input {...p} className="input" inputMode="decimal" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} />}
        </Field>

        {result && !result.ok && <p className="notice warn">{result.error}</p>}
        {result && result.ok && (
          <div className="stack">
            <p className="small muted">На 100 г готового блюда (масса {result.totalWeightG} г):</p>
            <MacroGrid n={result.per100} />
          </div>
        )}
      </form>
    </Modal>
  );
}

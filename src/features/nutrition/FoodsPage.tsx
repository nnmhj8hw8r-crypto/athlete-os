// Каталог своих продуктов и рецептов. Хранится локально и доступен без сети.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { filterFoods } from '../../data/foods.ts';
import { deleteEntity } from '../../data/repo.ts';
import { unitLabel } from '../../domain/nutrition.ts';
import type { Food } from '../../domain/schemas.ts';
import { EmptyState, Modal, Page, RowActions, Tabs } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';
import { FoodFormDialog, type FoodPrefill } from './FoodFormDialog.tsx';
import { PROVIDER_ATTRIBUTION } from './catalogProvider.ts';
import { BarcodeLookup, ExternalSearch } from './FoodLookup.tsx';
import { RecipeDialog } from './RecipeDialog.tsx';

const SOURCE_LABEL: Record<Food['source'], string> = { manual: 'вручную', perek: 'Perek.us', off: 'Open Food Facts', recipe: 'рецепт' };
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function FoodsPage() {
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const [query, setQuery] = useState('');
  const [editFood, setEditFood] = useState<{ food?: Food; prefill?: FoodPrefill } | null>(null);
  const [recipe, setRecipe] = useState<{ food?: Food } | null>(null);
  const [lookup, setLookup] = useState<'search' | 'barcode' | null>(null);
  const confirmDelete = useConfirmDelete();

  const list = foods ? filterFoods(foods, query) : [];

  return (
    <Page
      title="Продукты и рецепты"
      subtitle={<a href={href('/nutrition')}>← К дневнику питания</a>}
      actions={
        <>
          <button type="button" className="btn primary" onClick={() => setEditFood({})}>
            + Продукт
          </button>
          <button type="button" className="btn" onClick={() => setRecipe({})}>
            + Рецепт
          </button>
          <button type="button" className="btn" onClick={() => setLookup('barcode')}>
            Найти в базе
          </button>
        </>
      }
    >
      <p className="small muted">
        Изменение продукта влияет только на новые записи: в уже сохранённых приёмах пищи хранится снимок пищевой ценности.
      </p>
      <label className="visually-hidden" htmlFor="foods-q">
        Поиск по каталогу
      </label>
      <input id="foods-q" className="input" placeholder="Поиск по названию или бренду" value={query} onChange={(e) => setQuery(e.target.value)} />

      {foods === undefined ? (
        <p className="muted">Загрузка…</p>
      ) : list.length === 0 ? (
        <EmptyState>{foods.length === 0 ? 'Каталог пуст. Добавьте продукт вручную или найдите по штрихкоду.' : 'Ничего не найдено.'}</EmptyState>
      ) : (
        <ul className="list">
          {list.map((f) => (
            <li key={f.id} className="list-item">
              <div className="grow">
                <div className="title">{f.name}</div>
                <div className="meta">
                  {f.brand ? `${f.brand} · ` : ''}
                  {Math.round(f.per100.kcal)} ккал · Б {r1(f.per100.protein)} · Ж {r1(f.per100.fat)} · У {r1(f.per100.carbs)} на 100 {unitLabel(f.basis)}
                </div>
                <div className="meta">
                  <span className="badge">{SOURCE_LABEL[f.source]}</span>
                  {f.barcode && <span> · штрихкод {f.barcode}</span>}
                  {(f.source === 'perek' || f.source === 'off') && f.sourceUrl && (
                    <>
                      {' · '}
                      <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {PROVIDER_ATTRIBUTION[f.source]}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <RowActions
                label={f.name}
                onEdit={() => (f.source === 'recipe' ? setRecipe({ food: f }) : setEditFood({ food: f }))}
                onDelete={() => confirmDelete(f.name, () => deleteEntity('foods', f.id))}
              />
            </li>
          ))}
        </ul>
      )}

      {editFood && <FoodFormDialog food={editFood.food} prefill={editFood.prefill} onClose={() => setEditFood(null)} />}
      {recipe && <RecipeDialog food={recipe.food} onClose={() => setRecipe(null)} />}
      {lookup && (
        <Modal title="Добавить из базы продуктов" onClose={() => setLookup(null)}>
          <Tabs
            label="Способ поиска"
            value={lookup}
            onChange={setLookup}
            options={[
              { value: 'search', label: 'По названию' },
              { value: 'barcode', label: 'По штрихкоду' },
            ]}
          />
          {lookup === 'search' ? (
            <ExternalSearch
              onSelected={() => setLookup(null)}
              onManual={(prefill) => {
                setLookup(null);
                setEditFood({ prefill });
              }}
            />
          ) : (
            <BarcodeLookup
              onSelected={() => setLookup(null)}
              onManual={(prefill) => {
                setLookup(null);
                setEditFood({ prefill });
              }}
            />
          )}
        </Modal>
      )}
    </Page>
  );
}

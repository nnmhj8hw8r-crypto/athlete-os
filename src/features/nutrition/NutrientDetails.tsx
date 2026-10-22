// Расширенные нутриенты продукта/порции и ссылка на источник данных.
import { EXTRA_KEYS, type Extra } from '../../../shared/catalog.ts';
import { OFF_ATTRIBUTION } from '../../data/offlineBase.ts';
import { formatNutrient, NUTRIENT_GROUPS, NUTRIENT_META, saltFromSodiumMg } from '../../domain/nutrients.ts';

export function NutrientDetails({ extra, title = 'Подробнее о нутриентах' }: { extra?: Extra; title?: string }) {
  const known = EXTRA_KEYS.filter((k) => extra?.[k] !== undefined && k !== 'water');
  return (
    <details className="details">
      <summary>{title}</summary>
      {known.length === 0 ? (
        <p className="small muted">Источник не указывает расширенные нутриенты для этого продукта — нет данных (это не ноль).</p>
      ) : (
        <div className="stack">
          {NUTRIENT_GROUPS.map((g) => {
            const keys = known.filter((k) => NUTRIENT_META[k].group === g.id);
            if (!keys.length) return null;
            return (
              <div key={g.id}>
                <p className="search-group">{g.label}</p>
                <dl className="nutrient-list">
                  {keys.map((k) => (
                    <div key={k}>
                      <dt>{NUTRIENT_META[k].label}</dt>
                      <dd className="num">
                        {formatNutrient(extra![k]!, NUTRIENT_META[k].unit)}
                        {k === 'sodium' && <span className="muted"> (соль ≈ {formatNutrient(saltFromSodiumMg(extra![k]!), 'г')})</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
          <p className="small muted">Не указанные нутриенты — нет данных у источника.</p>
        </div>
      )}
    </details>
  );
}

export function sourceLabel(url: string | undefined, refId?: string): string | null {
  if (refId?.startsWith('dish:')) return 'Расчёт по типовому рецепту (ингредиенты USDA)';
  if (!url) return null;
  if (url.includes('fdc.nal.usda.gov')) return 'Данные: USDA FoodData Central';
  if (url.includes('openfoodfacts.org')) return OFF_ATTRIBUTION;
  if (url.includes('perek.us')) return 'Данные: perek.us';
  return 'Источник';
}

export function SourceLink({ url, refId }: { url?: string; refId?: string }) {
  const label = sourceLabel(url, refId);
  if (!label) return null;
  if (!url) return <span className="small muted">{label}</span>;
  return (
    <a className="small" href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

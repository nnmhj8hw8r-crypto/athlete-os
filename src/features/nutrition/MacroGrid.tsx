import type { Per100 } from '../../../shared/catalog.ts';

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

/** Калории и БЖУ в четыре колонки. */
export function MacroGrid({ n }: { n: Per100 }) {
  return (
    <div className="macros" aria-label="Калории и БЖУ">
      <div>
        <b>{Math.round(n.kcal)}</b>
        <span>ккал</span>
      </div>
      <div>
        <b>{r1(n.protein)}</b>
        <span>белки, г</span>
      </div>
      <div>
        <b>{r1(n.fat)}</b>
        <span>жиры, г</span>
      </div>
      <div>
        <b>{r1(n.carbs)}</b>
        <span>углев., г</span>
      </div>
    </div>
  );
}

// Иконки приёмов пищи (вместо эмодзи): линейный значок в мягком цветном круге, по мотивам FatSecret.
import type { MealType } from '../../domain/schemas.ts';

const PATHS: Record<MealType, string> = {
  // восход: солнце над горизонтом
  breakfast: 'M4 17h16M7 17a5 5 0 0 1 10 0M12 6v2.5M5.6 9.6l1.7 1.7M18.4 9.6l-1.7 1.7M3 13.5h2M19 13.5h2',
  // солнце
  lunch: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  // луна
  dinner: 'M18.5 14.6A7 7 0 0 1 9.4 5.5a7 7 0 1 0 9.1 9.1z',
  // яблоко
  snack: 'M12 8c-1.5-1.2-5.5-1.5-6.5 2.5-.9 3.6 1.6 8.5 4 8.5 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c2.4 0 4.9-4.9 4-8.5C17.5 6.5 13.5 6.8 12 8zM12 8c0-2 .8-3.5 2.5-4',
};

export function MealIcon({ meal, size = 'md' }: { meal: MealType; size?: 'sm' | 'md' }) {
  return (
    <span className={`meal-ico ${meal} ${size}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[meal]} />
      </svg>
    </span>
  );
}

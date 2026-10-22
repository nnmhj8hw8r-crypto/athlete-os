// Связь «Восстановления» с другими вкладками (по мотивам Bevel):
// компактная подсказка готовности в «Тренировках» и мягкое напоминание в «Питании».
import { joinMuscles } from '../../domain/muscles.ts';
import { readinessBand } from '../../domain/readiness.ts';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import { useReadiness } from './useReadiness.ts';

/** Одна строка над разделами «Тренировок»: готовность и группы, которые ещё восстанавливаются. */
export function TrainingReadinessHint() {
  const s = useReadiness();
  if (!s) return null;
  const r = s.result;
  const main =
    r.kind === 'score'
      ? `Готовность ${r.score} · ${readinessBand(r.score).title.toLowerCase()}`
      : r.kind === 'calibrating'
        ? `Готовность: калибровка ${r.have} из ${r.need}`
        : r.kind === 'no-checkin'
          ? 'Утренний чек-ин не пройден'
          : 'Готовность: недостаточно данных';
  const rec = s.recovering.slice(0, 3);
  return (
    <a className="readiness-hint" href={href(r.kind === 'no-checkin' ? '/recovery?checkin=1' : '/recovery')}>
      <span className="readiness-hint-icon" aria-hidden="true">
        {Icons.recovery}
      </span>
      <span className="grow">
        <b>{main}</b>
        <span>{rec.length ? `Восстанавливаются: ${joinMuscles(rec)}` : 'Все группы мышц свежие'}</span>
      </span>
      {Icons.chevronRight}
    </a>
  );
}

/** Мягкая подсветка в «Питании» при сниженной готовности — без цифр и диет. */
export function NutritionReadinessNote() {
  const s = useReadiness();
  if (!s || s.result.kind !== 'score' || s.result.score >= 60) return null;
  return (
    <a className="readiness-note" href={href('/recovery')}>
      <span aria-hidden="true">{Icons.drop}</span>
      <span>Готовность сегодня ниже обычной — не забудьте про воду и белок в приёмах пищи.</span>
    </a>
  );
}

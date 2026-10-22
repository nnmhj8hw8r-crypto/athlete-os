// Подготовка текстовой сводки для ручного переноса в Claude / ChatGPT.
// Ничего никуда не отправляется: функция только собирает текст из выбранных пользователем разделов.
import { APP_TIME_ZONE, SPORT_LABEL } from '../config.ts';
import { COMPETITION_STATUS_LABEL, daysUntil, formatCountdown, nextCompetition } from './competition.ts';
import { MEAL_TYPE_LABEL, sumNutrients, unitLabel } from './nutrition.ts';
import type { BodyWeight, Competition, MealEntry, SleepEntry, Workout } from './schemas.ts';
import { RATING_FIELDS, RATING_META, estimatedSleepMinutes, timeInBedMinutes } from './sleep.ts';
import { type DateKey, formatDateKey, formatDateTime, formatDuration, formatTime, toDateKey } from './time.ts';
import { formatClock, WORKOUT_FORMAT_LABEL, WORKOUT_TYPE_LABEL } from './training.ts';

export const SUMMARY_SECTIONS = ['nutrition', 'training', 'recovery', 'competition'] as const;
export type SummarySection = (typeof SUMMARY_SECTIONS)[number];

export const SUMMARY_SECTION_LABEL: Record<SummarySection, string> = {
  nutrition: 'Питание',
  training: 'Тренировки',
  recovery: 'Сон и восстановление',
  competition: 'Подготовка к соревнованию и масса тела',
};

export interface PromptTemplate {
  id: string;
  title: string;
  /** Разделы, которые шаблон предлагает включить. Пользователь может изменить выбор. */
  suggested: SummarySection[];
  text: string;
}

const COMMON_RULES =
  'Отделяй выводы, которые прямо следуют из данных, от предположений. Если данных недостаточно, ' +
  'так и скажи и уточни, чего не хватает. Не придумывай исследования и ссылки: упоминай только ' +
  'источники, которые можешь назвать точно. Не назначай лекарства, витамины или курсы добавок ' +
  'и не предлагай обезвоживание или резкое ограничение питания ради веса.';

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'training',
    title: 'Анализ тренировки',
    suggested: ['training', 'recovery'],
    text:
      'Я занимаюсь дзюдо и самбо. Проанализируй мои тренировки за указанный период: распределение ' +
      'нагрузки по типам занятий, объём силовой работы, субъективную тяжесть (RPE) и связь с ' +
      'самочувствием. Предложи, на что обратить внимание, но помни, что корреляция в нескольких ' +
      `записях не доказывает причину. ${COMMON_RULES}`,
  },
  {
    id: 'recovery',
    title: 'Недельный обзор восстановления',
    suggested: ['recovery', 'training'],
    text:
      'Сделай обзор моего сна и восстановления за неделю. Опиши тенденции самочувствия, усталости, ' +
      'болезненности мышц и желания тренироваться. Учти: время сна — это промежуток между моими ' +
      'отметками и мои собственные оценки, а не измерения прибора. Не ставь диагнозов и не делай ' +
      `выводов о перетренированности по отдельным записям. ${COMMON_RULES}`,
  },
  {
    id: 'nutrition',
    title: 'Разбор питания',
    suggested: ['nutrition', 'competition'],
    text:
      'Разбери мой дневник питания за указанный период: калорийность и БЖУ по дням, регулярность ' +
      'приёмов пищи, источники белка. Если для оценки нужны мои цели, масса тела или режим ' +
      `тренировок, спроси меня. ${COMMON_RULES}`,
  },
];

export interface SummaryData {
  meals: readonly MealEntry[];
  workouts: readonly Workout[];
  sleep: readonly SleepEntry[];
  competitions: readonly Competition[];
  bodyWeights: readonly BodyWeight[];
}

export interface SummaryOptions {
  sections: readonly SummarySection[];
  from: DateKey;
  to: DateKey;
  templateId?: string;
  now?: Date;
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
const inRange = (key: DateKey, o: SummaryOptions) => key >= o.from && key <= o.to;

function nutritionBlock(meals: readonly MealEntry[], o: SummaryOptions): string[] {
  const list = meals.filter((m) => inRange(m.date, o)).sort((a, b) => a.date.localeCompare(b.date));
  const lines = [`## ${SUMMARY_SECTION_LABEL.nutrition}`];
  if (list.length === 0) return [...lines, 'Записей питания за период нет.'];
  const days = [...new Set(list.map((m) => m.date))];
  for (const day of days) {
    const dayMeals = list.filter((m) => m.date === day);
    const t = sumNutrients(dayMeals.map((m) => m.nutrients));
    lines.push(
      `### ${formatDateKey(day, true)} — ${Math.round(t.kcal)} ккал, Б ${r1(t.protein)} г, Ж ${r1(t.fat)} г, У ${r1(t.carbs)} г`,
    );
    for (const m of dayMeals) {
      lines.push(
        `- ${MEAL_TYPE_LABEL[m.mealType]}: ${m.foodName}${m.brand ? ` (${m.brand})` : ''}, ${r1(m.amount)} ${unitLabel(m.basis)} — ` +
          `${Math.round(m.nutrients.kcal)} ккал, Б ${r1(m.nutrients.protein)}, Ж ${r1(m.nutrients.fat)}, У ${r1(m.nutrients.carbs)}`,
      );
    }
  }
  return lines;
}

function trainingBlock(workouts: readonly Workout[], o: SummaryOptions): string[] {
  const list = workouts
    .filter((w) => inRange(toDateKey(w.startAt), o))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const lines = [`## ${SUMMARY_SECTION_LABEL.training}`];
  if (list.length === 0) return [...lines, 'Тренировок за период нет.'];
  for (const w of list) {
    const meta = [
      WORKOUT_TYPE_LABEL[w.type],
      w.format && w.format !== 'exercises' ? WORKOUT_FORMAT_LABEL[w.format].toLowerCase() : null,
      w.durationMin !== undefined ? formatDuration(w.durationMin) : null,
      w.rpe !== undefined ? `тяжесть ${w.rpe}/10` : null,
    ].filter(Boolean);
    lines.push(`### ${formatDateTime(w.startAt)} — ${w.title} (${meta.join(', ')})`);
    if (w.focus) lines.push(`Над чем работал: ${w.focus}`);
    if (w.notes) lines.push(`Заметки: ${w.notes}`);
    for (const e of w.exercises) {
      const sets = e.sets
        .map((s) => {
          const parts = [
            s.weightKg !== undefined ? `${r1(s.weightKg)} кг` : null,
            s.reps !== undefined ? `×${s.reps}` : null,
            s.distanceKm !== undefined ? `${r1(s.distanceKm)} км` : null,
            s.durationSec !== undefined ? formatClock(s.durationSec) : null,
            s.done && e.metric === 'check' ? 'выполнено' : null,
            s.rpe !== undefined ? `RPE ${s.rpe}` : null,
          ].filter(Boolean);
          return parts.length ? parts.join(' ') : 'подход';
        })
        .join('; ');
      lines.push(`- ${e.name}: ${sets || 'подходы не записаны'}`);
    }
  }
  return lines;
}

function recoveryBlock(sleep: readonly SleepEntry[], o: SummaryOptions): string[] {
  const list = sleep
    .filter((s) => inRange(toDateKey(s.wakeTime), o))
    .sort((a, b) => a.wakeTime.localeCompare(b.wakeTime));
  const lines = [
    `## ${SUMMARY_SECTION_LABEL.recovery}`,
    'Оценки по шкале 1–5 — субъективные. «В постели» — промежуток между отметками, не измеренный сон.',
  ];
  if (list.length === 0) return [...lines, 'Записей за период нет.'];
  for (const s of list) {
    const inBed = timeInBedMinutes(s.bedtime, s.wakeTime);
    const est = estimatedSleepMinutes(s);
    const ratings = RATING_FIELDS.flatMap((f) => (s[f] === undefined ? [] : [`${RATING_META[f].label.toLowerCase()} ${s[f]}/5`]));
    lines.push(
      `- ${formatDateKey(toDateKey(s.wakeTime), true)}: лёг ${formatTime(s.bedtime)}, встал ${formatTime(s.wakeTime)}` +
        (inBed !== null ? `, в постели ${formatDuration(inBed)}` : '') +
        (est !== null ? `, оценка сна по моим данным ${formatDuration(est)}` : '') +
        (ratings.length ? `; ${ratings.join(', ')}` : '') +
        (s.notes ? `. Заметка: ${s.notes}` : ''),
    );
  }
  return lines;
}

function competitionBlock(data: SummaryData, o: SummaryOptions): string[] {
  const now = o.now ?? new Date();
  const lines = [`## ${SUMMARY_SECTION_LABEL.competition}`];
  const next = nextCompetition(data.competitions, now);
  if (next) {
    lines.push(
      `Ближайшее соревнование: ${next.name} (${SPORT_LABEL[next.sport]}, категория ${next.weightCategory} кг), ` +
        `${formatDateTime(next.startAt)} — ${formatCountdown(daysUntil(next.startAt, now))}. ` +
        `Статус: ${COMPETITION_STATUS_LABEL[next.status]}.`,
      `Взвешивание: ${formatDateTime(next.weighInAt)}.`,
    );
    if (next.targetWeightKg !== undefined) lines.push(`Целевая масса: ${r1(next.targetWeightKg)} кг.`);
    if (next.location) lines.push(`Место: ${next.location}.`);
  } else {
    lines.push('Предстоящих соревнований в календаре нет.');
  }
  const weights = data.bodyWeights
    .filter((w) => inRange(toDateKey(w.measuredAt), o))
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  lines.push(weights.length ? 'Масса тела за период:' : 'Записей массы тела за период нет.');
  for (const w of weights) lines.push(`- ${formatDateTime(w.measuredAt)}: ${r1(w.weightKg)} кг`);
  return lines;
}

/** Собирает текст сводки. Невыбранные разделы в текст не попадают. */
export function buildSummary(data: SummaryData, o: SummaryOptions): string {
  const template = PROMPT_TEMPLATES.find((t) => t.id === o.templateId);
  const out: string[] = [];
  if (template) out.push(template.text, '');
  out.push(
    `# Данные за период ${formatDateKey(o.from, true)} — ${formatDateKey(o.to, true)}`,
    `Часовой пояс: ${APP_TIME_ZONE}. Данные введены вручную в личный дневник.`,
  );
  const sections = new Set(o.sections);
  for (const s of SUMMARY_SECTIONS) {
    if (!sections.has(s)) continue;
    out.push('');
    if (s === 'nutrition') out.push(...nutritionBlock(data.meals, o));
    if (s === 'training') out.push(...trainingBlock(data.workouts, o));
    if (s === 'recovery') out.push(...recoveryBlock(data.sleep, o));
    if (s === 'competition') out.push(...competitionBlock(data, o));
  }
  if (sections.size === 0) out.push('', 'Разделы не выбраны.');
  return out.join('\n');
}

// Тестовые черновики записей для всех разделов. Это синтетические значения для проверки кода,
// а не данные спортсмена; в интерфейсе приложения они не используются.
import type { DraftOf, EntityTableName } from '../data/repo.ts';

export const drafts: { [K in EntityTableName]: DraftOf<K> } = {
  foods: {
    name: 'Тестовая крупа',
    basis: 'g',
    per100: { kcal: 343, protein: 12.6, fat: 3.3, carbs: 62.1 },
    source: 'manual',
    sourceNote: 'упаковка',
  },
  meals: {
    date: '2026-10-21',
    mealType: 'breakfast',
    foodName: 'Тестовая крупа',
    basis: 'g',
    amount: 80,
    per100: { kcal: 343, protein: 12.6, fat: 3.3, carbs: 62.1 },
    nutrients: { kcal: 274.4, protein: 10.08, fat: 2.64, carbs: 49.68 },
  },
  workouts: {
    startAt: '2026-10-21T15:00:00.000Z',
    type: 'gym',
    title: 'Тестовая силовая',
    durationMin: 60,
    rpe: 7,
    exercises: [
      {
        exerciseId: 'ex-1',
        name: 'Тестовое упражнение',
        sets: [{ reps: 5, weightKg: 100, restSec: 180, rpe: 8 }, { reps: 5 }],
      },
    ],
  },
  exercises: { name: 'Тестовое упражнение' },
  workoutTemplates: {
    name: 'Тестовый шаблон',
    type: 'gym',
    exercises: [{ exerciseId: 'ex-1', name: 'Тестовое упражнение', plannedSets: 3 }],
  },
  sleep: {
    bedtime: '2026-10-20T20:30:00.000Z',
    wakeTime: '2026-10-21T04:00:00.000Z',
    sleepLatencyMin: 20,
    wellbeing: 4,
    fatigue: 2,
    soreness: 3,
    motivation: 4,
  },
  competitions: {
    sport: 'judo',
    weightCategory: '-73',
    name: 'Тестовый турнир',
    startAt: '2026-11-15T07:00:00.000Z',
    weighInAt: '2026-11-14T15:00:00.000Z',
    status: 'planned',
  },
  bodyWeights: { measuredAt: '2026-10-21T05:00:00.000Z', weightKg: 74.2 },
  supplements: { name: 'Тестовая добавка', dose: 5, doseUnit: 'г', purpose: 'проверка формы' },
  sources: { title: 'Тестовый источник', checkedDate: '2026-10-21', sourceType: 'other' },
};

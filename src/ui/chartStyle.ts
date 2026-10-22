// Вид линий графиков (плавные / прямые) — настройка пользователя, хранится в settings.chartStyle.
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db.ts';
import { setSetting } from '../data/repo.ts';
import type { ChartLineStyle } from '../domain/chartPath.ts';

const KEY = 'chartStyle';

export function useChartStyle(): ChartLineStyle {
  const v = useLiveQuery(async () => (await db.settings.get(KEY))?.value, []);
  return v === 'straight' ? 'straight' : 'smooth';
}

export async function setChartStyle(style: ChartLineStyle): Promise<void> {
  await setSetting(KEY, style);
}

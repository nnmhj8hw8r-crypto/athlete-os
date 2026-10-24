// Вид линий графиков. v0.10: всегда плавные (решение пользователя — без переключателя);
// старая настройка settings.chartStyle больше не читается.
import type { ChartLineStyle } from '../domain/chartPath.ts';

export function useChartStyle(): ChartLineStyle {
  return 'smooth';
}

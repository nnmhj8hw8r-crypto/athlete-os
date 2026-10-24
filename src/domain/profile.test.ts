import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from './dashboard.ts';
import { defaultLevel, emptyLayout, sexFromAnswer, feedbackUrl, bugReportUrl, normalizeProfile, recommendedWidgets, revealFullWidgets, shouldAskFeedback } from './profile.ts';

const visible = (l: { id: string; visible: boolean }[]) => l.filter((w) => w.visible).map((w) => w.id);

describe('профиль из приветствия', () => {
  it('режим по сценарию: обычному пользователю — простой', () => {
    expect(defaultLevel('general')).toBe('basic');
    expect(defaultLevel('wrestler')).toBe('full');
    expect(defaultLevel('gym')).toBe('full');
  });

  it('испорченный профиль → нет профиля, лишние поля отбрасываются', () => {
    expect(normalizeProfile(undefined)).toBeNull();
    expect(normalizeProfile({ scenario: 'boxer' })).toBeNull();
    const p = normalizeProfile({ scenario: 'general', level: 'x', name: '  Аня ', interests: ['Вес тела', 'чужое'], completedAt: '2026-10-22T10:00:00.000Z' });
    expect(p).toEqual({ scenario: 'general', level: 'basic', name: 'Аня', interests: ['Вес тела'], completedAt: '2026-10-22T10:00:00.000Z' });
  });

  it('рекомендации по сценарию: обычному пользователю не предлагается «Ближайший старт»', () => {
    expect(recommendedWidgets({ scenario: 'general' })).not.toContain('competition');
    expect(recommendedWidgets({ scenario: 'wrestler' })).toContain('competition');
    expect(recommendedWidgets({ scenario: 'gym' })).toEqual(['sleepNow', 'readiness', 'weight', 'nutrition', 'trainings', 'muscles']);
  });

  it('интересы обычного пользователя выбирают рекомендации', () => {
    expect(recommendedWidgets({ scenario: 'general', interests: ['Сканер продуктов и КБЖУ'] })).toEqual(['nutrition']);
    expect(recommendedWidgets({ scenario: 'general', interests: ['Вес тела', 'Тренировки для себя'] })).toEqual(['weight', 'trainings', 'muscles']);
  });

  it('главная нового пользователя пуста, полный режим включает скрытые виджеты', () => {
    expect(visible(emptyLayout())).toEqual([]);
    expect(emptyLayout().map((w) => w.id)).toEqual(DEFAULT_LAYOUT.map((w) => w.id));
    expect(visible(revealFullWidgets(emptyLayout()))).toEqual(['competition', 'trainingLoad']);
  });

  it('отзыв просим через 3 дня и 5 записей, если карточку не закрыли', () => {
    const p = { completedAt: '2026-10-20T10:00:00.000Z' };
    expect(shouldAskFeedback(p, new Date('2026-10-22T10:00:00Z'), 50)).toBe(false);
    expect(shouldAskFeedback(p, new Date('2026-10-23T10:00:00Z'), 4)).toBe(false);
    expect(shouldAskFeedback(p, new Date('2026-10-23T10:00:00Z'), 5)).toBe(true);
    expect(shouldAskFeedback({ ...p, hideFeedbackPrompt: true }, new Date('2026-11-23T10:00:00Z'), 99)).toBe(false);
  });

  it('пол: из ответа интервью и из сохранённого профиля', () => {
    expect(sexFromAnswer('Женский')).toBe('female');
    expect(sexFromAnswer('Мужской')).toBe('male');
    expect(sexFromAnswer('')).toBeUndefined();
    expect(normalizeProfile({ scenario: 'gym', sex: 'female' })?.sex).toBe('female');
    expect(normalizeProfile({ scenario: 'gym', sex: 'x' })?.sex).toBeUndefined();
  });

  it('ссылка на отзыв — только версия и сценарий', () => {
    expect(feedbackUrl('https://tally.so/r/q54zM2', '0.9.0', 'gym')).toBe('https://tally.so/r/q54zM2?v=0.9.0&mode=gym');
  });

  it('ссылка «Сообщить об ошибке» — только версия и тип', () => {
    expect(bugReportUrl('https://tally.so/r/jea4E4', '0.11.0')).toBe('https://tally.so/r/jea4E4?v=0.11.0&kind=manual');
  });
});

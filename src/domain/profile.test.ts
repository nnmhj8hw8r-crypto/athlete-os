import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT } from './dashboard.ts';
import { defaultLevel, feedbackUrl, layoutForProfile, normalizeProfile, revealFullWidgets } from './profile.ts';

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

  it('главная по сценарию: у обычного пользователя нет «Ближайшего старта»', () => {
    expect(visible(layoutForProfile({ scenario: 'general' }))).not.toContain('competition');
    expect(visible(layoutForProfile({ scenario: 'wrestler' }))).toContain('competition');
    expect(layoutForProfile({ scenario: 'gym' }).map((w) => w.id)).toEqual(DEFAULT_LAYOUT.map((w) => w.id));
  });

  it('интересы обычного пользователя выбирают виджеты', () => {
    expect(visible(layoutForProfile({ scenario: 'general', interests: ['Сканер продуктов и КБЖУ'] }))).toEqual(['nutrition']);
    expect(visible(layoutForProfile({ scenario: 'general', interests: ['Вес тела', 'Тренировки для себя'] }))).toEqual(['weight', 'trainings', 'muscles']);
  });

  it('полный режим включает скрытые виджеты', () => {
    const l = revealFullWidgets(layoutForProfile({ scenario: 'general' }));
    expect(visible(l)).toEqual(expect.arrayContaining(['competition', 'trainingLoad']));
  });

  it('ссылка на отзыв — только версия и сценарий', () => {
    expect(feedbackUrl('https://tally.so/r/q54zM2', '0.9.0', 'gym')).toBe('https://tally.so/r/q54zM2?v=0.9.0&mode=gym');
  });
});

import { describe, expect, it } from 'vitest';
import { CHANGELOG, compareVersions, releasesToShow, type Release } from './changelog.ts';

const r = (version: string, user: string[] = ['x']): Release => ({ version, date: '2026-10-24', user, dev: [] });

describe('журнал версий', () => {
  it('версии сравниваются по числам, а не по строкам', () => {
    expect(compareVersions('0.10.0', '0.9.5')).toBeGreaterThan(0);
    expect(compareVersions('0.11.0', '0.11')).toBe(0);
  });

  it('окно: ничего, если версия уже видна; версии без пунктов пропускаются; не более трёх', () => {
    const log = [r('0.13.0'), r('0.12.1', []), r('0.12.0'), r('0.11.0'), r('0.10.0'), r('0.9.0')];
    expect(releasesToShow('0.13.0', '0.13.0', log)).toEqual([]);
    expect(releasesToShow('0.11.0', '0.13.0', log).map((x) => x.version)).toEqual(['0.13.0', '0.12.0']);
    expect(releasesToShow('0.5.0', '0.13.0', log).map((x) => x.version)).toEqual(['0.13.0', '0.12.0', '0.11.0']);
    expect(releasesToShow(undefined, '0.13.0', log).map((x) => x.version)).toEqual(['0.13.0']);
    expect(releasesToShow('0.10.0', '0.12.0', log).map((x) => x.version)).toEqual(['0.12.0', '0.11.0']);
  });

  it('журнал отсортирован от новых к старым и версии не повторяются', () => {
    const v = CHANGELOG.map((x) => x.version);
    expect([...v].sort((a, b) => compareVersions(b, a))).toEqual(v);
    expect(new Set(v).size).toBe(v.length);
  });
});

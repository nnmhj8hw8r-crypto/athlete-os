// Каталог упражнений: группы-фильтры, поиск, последний результат справа.
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../../data/db.ts';
import { searchCatalog } from '../../domain/exerciseLibrary.ts';
import type { ExerciseGroup, Workout } from '../../domain/schemas.ts';
import { EXERCISE_GROUP_LABEL, formatSet, isSetFilled } from '../../domain/training.ts';
import { Icons } from '../../ui/icons.tsx';
import { href } from '../../ui/router.ts';
import { ExerciseFormDialog, ExIcon, GROUP_ORDER, GroupChips, useCatalog } from './catalog.tsx';

/** Последний результат каждого упражнения за один проход по журналу: лучший подход последней тренировки. */
export function lastResults(workouts: readonly Workout[]): Map<string, string> {
  const out = new Map<string, string>();
  const sorted = [...workouts].sort((a, b) => b.startAt.localeCompare(a.startAt));
  for (const w of sorted) {
    for (const e of w.exercises) {
      if (out.has(e.exerciseId)) continue;
      const sets = e.sets.filter(isSetFilled);
      if (!sets.length) continue;
      const metric = e.metric ?? 'weight_reps';
      const best = [...sets].sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0) || (b.durationSec ?? 0) - (a.durationSec ?? 0))[0]!;
      out.set(e.exerciseId, formatSet(best, metric));
    }
  }
  return out;
}

export function ExercisesTab() {
  const catalog = useCatalog();
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<ExerciseGroup | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const last = useMemo(() => lastResults(workouts ?? []), [workouts]);

  if (catalog === undefined) return <p className="muted">Загрузка…</p>;
  const found = searchCatalog(catalog, q);
  const groups = GROUP_ORDER.filter((g) => (group === 'all' || g === group) && found.some((e) => e.group === g));

  return (
    <div className="stack">
      <label className="search-box">
        {Icons.search}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск упражнения" aria-label="Поиск упражнения" />
      </label>
      <GroupChips value={group} onChange={setGroup} />
      <button type="button" className="btn" onClick={() => setCreating(true)}>
        {Icons.plus} Своё упражнение
      </button>
      {groups.length === 0 && <p className="muted">Ничего не найдено.</p>}
      {groups.map((g) => (
        <section key={g} className="ex-section">
          <h2 className="ex-section-head">{EXERCISE_GROUP_LABEL[g]}</h2>
          <ul className="ex-list">
            {found
              .filter((e) => e.group === g)
              .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
              .map((e) => (
                <li key={e.id}>
                  <a className="ex-row" href={href(`/training/exercise?id=${encodeURIComponent(e.id)}`)}>
                    <ExIcon ex={e} />
                    <span className="grow">
                      <span className="title">{e.name}</span>
                      {!e.builtIn && <span className="meta">своё</span>}
                    </span>
                    <span className="ex-last num">{last.get(e.id) ?? '––'}</span>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="small muted">
        Иконки — схема мышц: красным основные, светлым вспомогательные. Видео техники появится в следующих версиях;
        пока заметки о технике можно записать на странице упражнения.
      </p>
      {creating && <ExerciseFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

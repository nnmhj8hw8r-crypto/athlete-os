// Страница теста: график, лучший и последний результат, список результатов.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import { bestResult, formatTestValue, lastChange, latestResult } from '../../domain/fitnessTests.ts';
import type { TestResult } from '../../domain/schemas.ts';
import { formatDateKey } from '../../domain/time.ts';
import { EmptyState, RowActions, TopBar } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import { navigate, type Route } from '../../ui/router.ts';
import { ResultDialog, TestDefDialog, useTests } from './MeasureTab.tsx';

export function TestPage({ route }: { route: Route }) {
  const id = route.params.get('id') ?? '';
  const tests = useTests();
  const results = useLiveQuery(() => db.testResults.where('testId').equals(id).toArray(), [id]);
  const def = useLiveQuery(() => db.testDefs.get(id), [id]);
  const [dialog, setDialog] = useState<{ result?: TestResult } | null>(null);
  const [editDef, setEditDef] = useState(false);
  const confirmDelete = useConfirmDelete();

  const test = tests?.find((t) => t.id === id);
  if (tests === undefined || results === undefined) return <p className="muted">Загрузка…</p>;
  if (!test) {
    return (
      <div className="page">
        <TopBar title="Тест" backTo="/training?tab=measure" />
        <EmptyState>Тест не найден.</EmptyState>
      </div>
    );
  }
  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const best = bestResult(test, results);
  const last = latestResult(results);
  const change = lastChange(test, results);
  const chart = [...sorted].reverse().map((r) => ({ x: Date.parse(`${r.date}T12:00:00Z`), y: r.value }));

  return (
    <div className="page has-sticky">
      <TopBar
        title={test.name}
        backTo="/training?tab=measure"
        action={
          def ? (
            <button type="button" className="round-btn" aria-label="Изменить тест" onClick={() => setEditDef(true)}>
              {Icons.edit}
            </button>
          ) : undefined
        }
      />
      {test.hint && <p className="muted">{test.hint}</p>}
      {results.length === 0 ? (
        <EmptyState>Результатов пока нет. Добавьте первый — дальше здесь появится график.</EmptyState>
      ) : (
        <>
          <div className="plan-grid">
            <div>
              <b>{last ? formatTestValue(test, last.value) : '—'}</b>
              <span>последний</span>
            </div>
            <div>
              <b>{best ? formatTestValue(test, best.value) : '—'}</b>
              <span>лучший</span>
            </div>
            {change && (
              <div>
                <b className={change.improved ? 'good' : change.delta === 0 ? '' : 'bad'}>
                  {change.delta > 0 ? '+' : ''}
                  {test.unit === 'sec' && Math.abs(change.delta) >= 60 ? formatTestValue(test, Math.abs(change.delta)) : change.delta.toLocaleString('ru-RU')}
                </b>
                <span>к прошлому</span>
              </div>
            )}
          </div>
          {chart.length > 1 && (
            <div className="card">
              <LineChart label={test.name} unit="" points={chart} formatX={(x) => formatDateKey(new Date(x).toISOString().slice(0, 10))} />
              <p className="small muted">{test.higherIsBetter ? 'Больше — лучше.' : 'Меньше — лучше.'}</p>
            </div>
          )}
          <ul className="list">
            {sorted.map((r) => (
              <li key={r.id} className="list-item">
                <div className="grow">
                  <div className="title">{formatTestValue(test, r.value)}</div>
                  <div className="meta">
                    {formatDateKey(r.date, true)}
                    {r.notes && ` · ${r.notes}`}
                  </div>
                </div>
                <RowActions
                  label={`${test.name} ${formatDateKey(r.date)}`}
                  onEdit={() => setDialog({ result: r })}
                  onDelete={() => confirmDelete(`${test.name}, ${formatDateKey(r.date)}`, () => deleteEntity('testResults', r.id))}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {def && (
        <button
          type="button"
          className="btn danger"
          onClick={() =>
            confirmDelete(def.name, async () => {
              await db.transaction('rw', db.testDefs, db.testResults, async () => {
                await db.testResults.where('testId').equals(def.id).delete();
                await deleteEntity('testDefs', def.id);
              });
              navigate('/training?tab=measure', true);
            })
          }
        >
          Удалить свой тест вместе с результатами
        </button>
      )}
      <div className="sticky-action">
        <button type="button" className="btn primary big" onClick={() => setDialog({})}>
          {Icons.plus} Добавить результат
        </button>
      </div>
      {dialog && <ResultDialog test={test} result={dialog.result} onClose={() => setDialog(null)} />}
      {editDef && def && <TestDefDialog def={def} onClose={() => setEditDef(false)} />}
    </div>
  );
}

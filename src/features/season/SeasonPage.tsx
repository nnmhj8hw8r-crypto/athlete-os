import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { SPORT_LABEL, type Sport } from '../../config.ts';
import { db } from '../../data/db.ts';
import { deleteEntity } from '../../data/repo.ts';
import { COMPETITION_STATUS_LABEL, daysUntil, formatCountdown, nextCompetition } from '../../domain/competition.ts';
import type { BodyWeight, Competition } from '../../domain/schemas.ts';
import { formatDateKey, formatDateTime, toDateKey, todayKey } from '../../domain/time.ts';
import { EmptyState, Page, RowActions, Tabs } from '../../ui/components.tsx';
import { useConfirmDelete } from '../../ui/feedback.tsx';
import { Icons } from '../../ui/icons.tsx';
import { LineChart } from '../../ui/LineChart.tsx';
import { clearParam, type Route } from '../../ui/router.ts';
import { BodyWeightDialog } from './BodyWeightDialog.tsx';
import { CompetitionDialog } from './CompetitionDialog.tsx';

type Tab = 'competitions' | 'weight';
const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

export function SeasonPage({ route }: { route: Route }) {
  const [tab, setTab] = useState<Tab>(route.params.get('tab') === 'weight' ? 'weight' : 'competitions');
  const [compDlg, setCompDlg] = useState<{ competition?: Competition } | null>(null);
  const [weightDlg, setWeightDlg] = useState<{ entry?: BodyWeight } | null>(null);

  useEffect(() => {
    const add = route.params.get('add');
    if (add === 'competition') setCompDlg({});
    if (add === 'weight') {
      setTab('weight');
      setWeightDlg({});
    }
    if (add) clearParam(route, 'add');
  }, [route]);

  return (
    <Page
      title="Сезон"
      actions={
        tab === 'competitions' ? (
          <button type="button" className="btn primary" onClick={() => setCompDlg({})}>
            {Icons.plus} Соревнование
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => setWeightDlg({})}>
            {Icons.plus} Взвешивание
          </button>
        )
      }
    >
      <Tabs
        label="Разделы сезона"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'competitions', label: 'Соревнования' },
          { value: 'weight', label: 'Масса тела' },
        ]}
      />
      {tab === 'competitions' ? (
        <Competitions onEdit={(c) => setCompDlg({ competition: c })} onAdd={() => setCompDlg({})} />
      ) : (
        <Weights onEdit={(w) => setWeightDlg({ entry: w })} onAdd={() => setWeightDlg({})} />
      )}
      {compDlg && <CompetitionDialog competition={compDlg.competition} onClose={() => setCompDlg(null)} />}
      {weightDlg && <BodyWeightDialog entry={weightDlg.entry} onClose={() => setWeightDlg(null)} />}
    </Page>
  );
}

function Competitions({ onEdit, onAdd }: { onEdit: (c: Competition) => void; onAdd: () => void }) {
  const all = useLiveQuery(() => db.competitions.orderBy('startAt').toArray(), []);
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const confirmDelete = useConfirmDelete();
  if (all === undefined) return <p className="muted">Загрузка…</p>;
  if (all.length === 0) {
    return (
      <EmptyState
        action={
          <button type="button" className="btn primary" onClick={onAdd}>
            Добавить соревнование
          </button>
        }
      >
        Календарь пуст. Добавьте старт: дату, взвешивание и категорию.
      </EmptyState>
    );
  }
  const today = todayKey();
  const list = all.filter((c) => sport === 'all' || c.sport === sport);
  const upcoming = list.filter((c) => toDateKey(c.startAt) >= today);
  const past = list.filter((c) => toDateKey(c.startAt) < today).reverse();
  const next = nextCompetition(list);

  const item = (c: Competition) => {
    const days = daysUntil(c.startAt);
    return (
      <li key={c.id} className="list-item">
        <div className="grow">
          <div className="row" style={{ gap: 6 }}>
            <span className={`badge ${c.sport}`}>
              {SPORT_LABEL[c.sport]} {c.weightCategory} кг
            </span>
            <span className={`badge ${c.status === 'registered' ? 'ok' : c.status === 'cancelled' ? 'warn' : ''}`}>{COMPETITION_STATUS_LABEL[c.status]}</span>
            {c.id === next?.id && <span className="badge ok">ближайшее</span>}
          </div>
          <div className="title">{c.name}</div>
          <div className="meta">
            Старт: {formatDateTime(c.startAt)} · {formatCountdown(days)}
          </div>
          <div className="meta">Взвешивание: {formatDateTime(c.weighInAt)}</div>
          {c.location && <div className="meta">Место: {c.location}</div>}
          {c.targetWeightKg !== undefined && <div className="meta">Целевая масса: {r1(c.targetWeightKg)} кг</div>}
          {c.rules && <div className="meta">Регламент: {c.rules}</div>}
          {c.notes && <div className="meta">{c.notes}</div>}
        </div>
        <RowActions label={c.name} onEdit={() => onEdit(c)} onDelete={() => confirmDelete(c.name, () => deleteEntity('competitions', c.id))} />
      </li>
    );
  };

  return (
    <div className="stack">
      <Tabs
        label="Вид спорта"
        value={sport}
        onChange={setSport}
        options={[
          { value: 'all', label: 'Все' },
          { value: 'judo', label: 'Дзюдо' },
          { value: 'sambo', label: 'Самбо' },
        ]}
      />
      <section className="section">
        <h2>Предстоящие</h2>
        {upcoming.length ? <ul className="list">{upcoming.map(item)}</ul> : <p className="muted">Нет предстоящих соревнований.</p>}
      </section>
      {past.length > 0 && (
        <section className="section">
          <h2>Прошедшие</h2>
          <ul className="list">{past.map(item)}</ul>
        </section>
      )}
    </div>
  );
}

function Weights({ onEdit, onAdd }: { onEdit: (w: BodyWeight) => void; onAdd: () => void }) {
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('measuredAt').toArray(), []);
  const competitions = useLiveQuery(() => db.competitions.toArray(), []);
  const confirmDelete = useConfirmDelete();
  if (weights === undefined) return <p className="muted">Загрузка…</p>;
  if (weights.length === 0) {
    return (
      <EmptyState
        action={
          <button type="button" className="btn primary" onClick={onAdd}>
            Записать массу
          </button>
        }
      >
        Записей массы тела пока нет.
      </EmptyState>
    );
  }
  const next = competitions ? nextCompetition(competitions) : undefined;
  const recent = weights.slice(-60);
  const last = weights[weights.length - 1]!;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h2>Динамика</h2>
          <span className="muted small">последние {recent.length}</span>
        </div>
        <LineChart
          label="Масса тела"
          unit="кг"
          points={recent.map((w) => ({ x: Date.parse(w.measuredAt), y: w.weightKg }))}
          reference={next?.targetWeightKg !== undefined ? { y: next.targetWeightKg, label: `цель ${r1(next.targetWeightKg)} кг` } : undefined}
          formatX={(x) => formatDateKey(toDateKey(new Date(x)))}
        />
        {next?.targetWeightKg !== undefined && (
          <p className="small muted">
            Последняя запись: {r1(last.weightKg)} кг. Цель к «{next.name}»: {r1(next.targetWeightKg)} кг (разница {last.weightKg - next.targetWeightKg > 0 ? '+' : ''}
            {r1(last.weightKg - next.targetWeightKg)} кг). Цель меняется только вами в карточке соревнования.
          </p>
        )}
      </div>
      <ul className="list">
        {[...weights].reverse().map((w) => (
          <li key={w.id} className="list-item">
            <div className="grow">
              <div className="title num">{r1(w.weightKg)} кг</div>
              <div className="meta">
                {formatDateTime(w.measuredAt)}
                {w.notes && ` · ${w.notes}`}
              </div>
            </div>
            <RowActions label={`${r1(w.weightKg)} кг`} onEdit={() => onEdit(w)} onDelete={() => confirmDelete(`${r1(w.weightKg)} кг`, () => deleteEntity('bodyWeights', w.id))} />
          </li>
        ))}
      </ul>
    </div>
  );
}

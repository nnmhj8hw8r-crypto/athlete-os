// «Журнал версий» (v0.11): что менялось в каждой версии — структурно, для разработчика. Данные — domain/changelog.ts.
import { CHANGELOG } from '../../domain/changelog.ts';
import { formatDateKey } from '../../domain/time.ts';
import { Card, Page } from '../../ui/components.tsx';
import { href } from '../../ui/router.ts';

export function ChangelogPage() {
  return (
    <Page title="Журнал версий" subtitle={<a href={href('/more/dev')}>← Для разработчика</a>}>
      {CHANGELOG.map((r) => (
        <Card key={r.version} title={`v${r.version}`} aside={<span className="muted small">{formatDateKey(r.date)}</span>}>
          {r.dev.map((s) => (
            <div key={s.title} className="changelog-section">
              <b>{s.title}</b>
              <ul>
                {s.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="muted small">{r.user.length ? 'Есть пункты для окна «Что нового»' : 'Без окна для пользователей'}</p>
        </Card>
      ))}
    </Page>
  );
}

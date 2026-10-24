// Экспорт и импорт резервной копии. Импорт всегда проверяет файл целиком и требует подтверждения.
import { useState, type ChangeEvent } from 'react';
import { LAST_BACKUP_KEY } from '../../data/appMeta.ts';
import { countAll, exportAll, importBackup, setSetting, type ImportMode } from '../../data/repo.ts';
import { backupFileName, parseBackup, type ParseBackupResult } from '../../domain/backup.ts';
import { TABLE_LABELS, TABLE_NAMES } from '../../domain/schemas.ts';
import { formatDateTime } from '../../domain/time.ts';
import { Card, Page } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { href } from '../../ui/router.ts';

export function BackupPage() {
  const { notify, confirm } = useFeedback();
  const [exporting, setExporting] = useState(false);
  const [parsed, setParsed] = useState<(ParseBackupResult & { fileName: string }) | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [importing, setImporting] = useState(false);

  async function doExport() {
    setExporting(true);
    try {
      const backup = await exportAll();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const total = Object.values(backup.data).reduce((s, rows) => s + rows.length, 0);
      await setSetting(LAST_BACKUP_KEY, new Date().toISOString());
      notify(`Резервная копия сохранена: записей — ${total}`);
    } catch (e) {
      notify(`Не удалось создать копию: ${(e as Error).message}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setParsed({ ...parseBackup(text), fileName: file.name });
    } catch {
      setParsed({ ok: false, errors: ['Не удалось прочитать файл'], fileName: file.name });
    }
  }

  async function doImport() {
    if (!parsed?.ok) return;
    const current = await countAll();
    const ok = await confirm({
      title: mode === 'replace' ? 'Заменить все записи?' : 'Восстановить из копии?',
      danger: mode === 'replace',
      confirmLabel: mode === 'replace' ? 'Заменить' : 'Восстановить',
      message: (
        <div className="stack">
          <p>
            Файл «{parsed.fileName}»: записей — <b>{parsed.total}</b>, создан {formatDateTime(parsed.backup.exportedAt)}.
          </p>
          {mode === 'replace' ? (
            <p className="notice error">
              Все текущие записи на этом телефоне ({current}) будут удалены и заменены записями из копии. Сначала лучше сохранить
              свежую копию.
            </p>
          ) : (
            <p>Записи из копии добавятся к текущим. Если запись есть и там и там, останется версия из копии.</p>
          )}
        </div>
      ),
    });
    if (!ok) return;
    setImporting(true);
    try {
      await importBackup(parsed.backup, mode);
      notify('Записи восстановлены');
      setParsed(null);
    } catch (e) {
      notify(`Не получилось восстановить, текущие записи не изменены: ${(e as Error).message}`, 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Page title="Резервная копия" subtitle={<a href={href('/more')}>← Ещё</a>}>
      <p className="notice warn">
        Все записи хранятся только на этом телефоне. Если удалить приложение или очистить данные Safari, они пропадут.
        Раз в неделю-две сохраняйте копию — например, в «Файлы» или iCloud Drive.
      </p>

      <Card title="Сохранить копию">
        <p className="small muted">Все ваши записи — одним файлом. В нём личные данные, не отправляйте его посторонним.</p>
        <p className="small muted">Фото прогресса в копию не входят — они остаются в галерее телефона.</p>
        <button type="button" className="btn primary" onClick={doExport} disabled={exporting}>
          {exporting ? 'Подготовка…' : 'Скачать резервную копию'}
        </button>
      </Card>

      <Card title="Восстановить из копии">
        <p className="small muted">Выберите файл копии. Если он повреждён, ничего не изменится.</p>
        <label className="btn" style={{ alignSelf: 'flex-start' }}>
          Выбрать файл копии…
          <input type="file" accept="application/json,.json" onChange={onFile} className="visually-hidden" />
        </label>

        {parsed && !parsed.ok && (
          <div className="notice error" role="alert">
            <p>
              <b>Файл «{parsed.fileName}» не принят:</b>
            </p>
            <ul>
              {parsed.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed?.ok && (
          <div className="stack">
            <p className="notice ok">
              Копия «{parsed.fileName}» в порядке, сохранена {formatDateTime(parsed.backup.exportedAt)}.
            </p>
            <table className="set-table">
              <tbody>
                {TABLE_NAMES.filter((t) => parsed.counts[t] > 0).map((t) => (
                  <tr key={t}>
                    <td>{TABLE_LABELS[t]}</td>
                    <td className="num">{parsed.counts[t]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ fontWeight: 600 }}>
                Как восстановить
              </legend>
              <label className="row">
                <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Добавить к текущим записям
              </label>
              <label className="row">
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Заменить всё, что сейчас в приложении
              </label>
            </fieldset>
            <div className="row">
              <button type="button" className={mode === 'replace' ? 'btn danger' : 'btn primary'} onClick={doImport} disabled={importing}>
                {importing ? 'Восстановление…' : 'Восстановить'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setParsed(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}

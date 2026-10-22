// Экспорт и импорт резервной копии. Импорт всегда проверяет файл целиком и требует подтверждения.
import { useState, type ChangeEvent } from 'react';
import { countAll, exportAll, importBackup, type ImportMode } from '../../data/repo.ts';
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
      title: mode === 'replace' ? 'Заменить все данные?' : 'Импортировать копию?',
      danger: mode === 'replace',
      confirmLabel: mode === 'replace' ? 'Заменить' : 'Импортировать',
      message: (
        <div className="stack">
          <p>
            Файл «{parsed.fileName}»: записей — <b>{parsed.total}</b>, создан {formatDateTime(parsed.backup.exportedAt)}.
          </p>
          {mode === 'replace' ? (
            <p className="notice error">
              Все текущие данные на этом устройстве (записей — {current}) будут удалены и заменены содержимым файла. Сначала
              рекомендуется сохранить свежую копию.
            </p>
          ) : (
            <p>Записи из файла будут добавлены. Записи с теми же идентификаторами будут перезаписаны версией из файла.</p>
          )}
        </div>
      ),
    });
    if (!ok) return;
    setImporting(true);
    try {
      await importBackup(parsed.backup, mode);
      notify('Импорт завершён');
      setParsed(null);
    } catch (e) {
      notify(`Импорт не выполнен, данные не изменены: ${(e as Error).message}`, 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Page title="Резервная копия" subtitle={<a href={href('/more')}>← Ещё</a>}>
      <p className="notice warn">
        Данные хранятся только в этом браузере на этом устройстве. Кэш приложения — не резервная копия: при очистке данных
        браузера, удалении приложения или нехватке места записи могут пропасть. Регулярно сохраняйте копию в файл и
        храните её вне браузера. Синхронизации между устройствами пока нет.
      </p>

      <Card title="Экспорт">
        <p className="small muted">Все разделы в одном JSON-файле. Файл содержит личные данные о здоровье — не публикуйте его.</p>
        <p className="small muted">
          Фото прогресса и обложки программ в копию не входят (слишком большой файл) — их оригиналы храните в галерее телефона.
        </p>
        <button type="button" className="btn primary" onClick={doExport} disabled={exporting}>
          {exporting ? 'Подготовка…' : 'Скачать резервную копию'}
        </button>
      </Card>

      <Card title="Импорт">
        <p className="small muted">Файл проверяется целиком. Если в нём есть ошибка, ничего не импортируется.</p>
        <label className="btn" style={{ alignSelf: 'flex-start' }}>
          Выбрать файл…
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
              Файл «{parsed.fileName}» прошёл проверку. Создан {formatDateTime(parsed.backup.exportedAt)}, версия приложения{' '}
              {parsed.backup.appVersion}.
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
                Режим импорта
              </legend>
              <label className="row">
                <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Объединить с текущими данными
              </label>
              <label className="row">
                <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Заменить все текущие данные
              </label>
            </fieldset>
            <div className="row">
              <button type="button" className={mode === 'replace' ? 'btn danger' : 'btn primary'} onClick={doImport} disabled={importing}>
                {importing ? 'Импорт…' : 'Импортировать'}
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

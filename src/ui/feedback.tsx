// Уведомления (toast) и подтверждение опасных действий.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from './components.tsx';

type ToastKind = 'info' | 'error';
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  notify: (text: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })),
    [],
  );

  const finish = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      {pending && (
        <Modal
          title={pending.title}
          onClose={() => finish(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => finish(false)}>
                Отмена
              </button>
              <button type="button" className={pending.danger ? 'btn danger solid' : 'btn primary'} onClick={() => finish(true)}>
                {pending.confirmLabel ?? 'Подтвердить'}
              </button>
            </>
          }
        >
          <div>{pending.message}</div>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback вне FeedbackProvider');
  return ctx;
}

/** Удаление записи с подтверждением и уведомлением. */
export function useConfirmDelete() {
  const { confirm, notify } = useFeedback();
  return useCallback(
    async (what: string, action: () => Promise<void>) => {
      const ok = await confirm({
        title: 'Удалить запись?',
        message: `«${what}» будет удалено без возможности восстановления (если нет резервной копии).`,
        confirmLabel: 'Удалить',
        danger: true,
      });
      if (!ok) return;
      try {
        await action();
        notify('Удалено');
      } catch (e) {
        notify(`Не удалось удалить: ${(e as Error).message}`, 'error');
      }
    },
    [confirm, notify],
  );
}

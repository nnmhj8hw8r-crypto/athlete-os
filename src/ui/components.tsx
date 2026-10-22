// Общие элементы интерфейса: страница, карточка, поле формы, диалог, пустое состояние.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icons } from './icons.tsx';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, aside, children }: { title?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || aside) && (
        <div className="card-title">
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Подпись, подсказка и ошибка, связанные с полем ввода через id и aria-атрибуты. */
export function Field({ label, error, hint, optional, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional && <span className="optional">(необязательно)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function FormError({ errors }: { errors: Record<string, string> }) {
  const msg = errors._form;
  if (!msg) return null;
  return (
    <p className="notice error" role="alert">
      {msg}
    </p>
  );
}

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 'full' — на телефоне на весь экран (окно добавления еды), 'sheet' — нижняя шторка по содержимому. */
  size?: 'default' | 'full' | 'sheet';
}

/**
 * Модальное окно на нативном <dialog>: фокус удерживается внутри, Esc закрывает.
 * Компонент монтируется только когда окно открыто.
 */
export function Modal({ title, onClose, children, footer, size = 'default' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dlg.addEventListener('cancel', onCancel);
    return () => {
      dlg.removeEventListener('cancel', onCancel);
      if (dlg.open) dlg.close();
    };
  }, []);

  return (
    <dialog ref={ref} className={size === 'default' ? 'modal' : `modal ${size}`} aria-labelledby={titleId}>
      <div className="modal-inner">
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            {Icons.close}
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </dialog>
  );
}

export function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RatingInput({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  low: string;
  high: string;
}) {
  const name = useId();
  return (
    <div>
      <fieldset className="rating">
        <legend>
          {label} <span className="optional muted">(необязательно)</span>
        </legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              onClick={() => value === n && onChange(undefined)}
            />
            <span>{n}</span>
          </label>
        ))}
      </fieldset>
      <div className="rating-scale" aria-hidden="true">
        <span>1 — {low}</span>
        <span>5 — {high}</span>
      </div>
    </div>
  );
}

export function RowActions({ onEdit, onDelete, label }: { onEdit?: () => void; onDelete?: () => void; label: string }) {
  return (
    <div className="row" style={{ flexWrap: 'nowrap', gap: 0 }}>
      {onEdit && (
        <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Изменить: ${label}`}>
          {Icons.edit}
        </button>
      )}
      {onDelete && (
        <button type="button" className="icon-btn" onClick={onDelete} aria-label={`Удалить: ${label}`}>
          {Icons.trash}
        </button>
      )}
    </div>
  );
}

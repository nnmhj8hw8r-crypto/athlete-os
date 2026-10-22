// Общие элементы интерфейса: страница, карточка, поле формы, диалог, пустое состояние.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icons } from './icons.tsx';
import { registerModal } from './modalStack.ts';
import { navigate } from './router.ts';

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

/** Насколько нужно смахнуть окно вниз (px), чтобы оно закрылось. */
const SWIPE_CLOSE_PX = 90;

/**
 * Модальное окно на нативном <dialog>: фокус удерживается внутри, Esc закрывает.
 * Страница под окном не прокручивается; жест «назад» и смахивание вниз закрывают окно.
 * Компонент монтируется только когда окно открыто.
 */
export function Modal({ title, onClose, children, footer, size = 'default' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    // showModal ставит фокус на первую кнопку; поле с data-autofocus (поиск) получает его вместо неё.
    dlg.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dlg.addEventListener('cancel', onCancel);
    const unregister = registerModal(() => onCloseRef.current());

    // Смахивание вниз: за шапку — всегда, за содержимое — только когда оно прокручено к началу.
    let startY = 0;
    let startX = 0;
    let dy = 0;
    let dragging = false;
    let decided = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, .no-swipe')) return;
      const inBody = bodyRef.current?.contains(target) ?? false;
      if (inBody && (bodyRef.current?.scrollTop ?? 0) > 0) return;
      startY = t.clientY;
      startX = t.clientX;
      dy = 0;
      dragging = true;
      decided = false;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!dragging || !t) return;
      const ddy = t.clientY - startY;
      const ddx = t.clientX - startX;
      if (!decided) {
        if (Math.abs(ddy) < 8 && Math.abs(ddx) < 8) return;
        decided = true;
        // Жест вверх или вбок — обычная прокрутка содержимого.
        if (ddy <= 0 || Math.abs(ddx) > Math.abs(ddy)) {
          dragging = false;
          return;
        }
      }
      e.preventDefault();
      dy = Math.max(0, ddy);
      dlg.style.transition = 'none';
      dlg.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      dlg.style.transition = 'transform 0.2s ease';
      if (dy > SWIPE_CLOSE_PX) {
        dlg.style.transform = 'translateY(100%)';
        onCloseRef.current();
      } else {
        dlg.style.transform = '';
      }
    };
    dlg.addEventListener('touchstart', onStart, { passive: true });
    dlg.addEventListener('touchmove', onMove, { passive: false });
    dlg.addEventListener('touchend', onEnd);
    dlg.addEventListener('touchcancel', onEnd);

    return () => {
      dlg.removeEventListener('cancel', onCancel);
      dlg.removeEventListener('touchstart', onStart);
      dlg.removeEventListener('touchmove', onMove);
      dlg.removeEventListener('touchend', onEnd);
      dlg.removeEventListener('touchcancel', onEnd);
      unregister();
      if (dlg.open) dlg.close();
    };
  }, []);

  return (
    <dialog ref={ref} className={size === 'default' ? 'modal' : `modal ${size}`} aria-labelledby={titleId}>
      <div className="modal-inner">
        <div className="modal-grip" aria-hidden="true" />
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            {Icons.close}
          </button>
        </div>
        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </dialog>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
  compact,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  /** Много вкладок: уже отступы, чтобы на телефоне все поместились. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'tabs compact no-swipe' : 'tabs'} role="tablist" aria-label={label}>
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

/** Верхняя панель внутренних экранов: «назад», заголовок, действие справа. */
export function TopBar({ title, action, onBack, backTo = '/' }: { title: ReactNode; action?: ReactNode; onBack?: () => void; backTo?: string }) {
  const back = onBack ?? (() => (history.length > 1 ? history.back() : navigate(backTo)));
  return (
    <header className="topbar">
      <button type="button" className="round-btn" aria-label="Назад" onClick={back}>
        {Icons.chevronLeft}
      </button>
      <span className="topbar-title">{title}</span>
      {action ?? <span className="round-btn-spacer" />}
    </header>
  );
}

// Сканирование штрихкода камерой (библиотека ZXing, загружается только по запросу).
// Камера в браузере доступна только на HTTPS или localhost; иначе остаётся ручной ввод.
// Вид (v0.9.4) — по образцу FatSecret: полный экран, красная линия-прицел, «Клавиатура» для ввода вручную.
import { useEffect, useRef, useState } from 'react';
import { parseEan } from '../../../shared/ean.ts';
import { Icons } from '../../ui/icons.tsx';

export function cameraSupport(): { ok: true } | { ok: false; message: string } {
  if (typeof window === 'undefined') return { ok: false, message: 'Камера недоступна.' };
  if (!window.isSecureContext) {
    return {
      ok: false,
      message: 'Браузер разрешает камеру только на HTTPS или localhost. Введите цифры штрихкода вручную.',
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, message: 'Этот браузер не поддерживает доступ к камере. Введите цифры вручную.' };
  }
  return { ok: true };
}

interface Props {
  onDetected: (ean: string) => void;
  onCancel: () => void;
}

export function BarcodeScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]]]);
        const reader = new BrowserMultiFormatReader(hints);
        if (stopped || !videoRef.current) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result) => {
            if (!result || stopped) return;
            const ean = parseEan(result.getText());
            if (ean) {
              stopped = true;
              controls?.stop();
              detectedRef.current(ean);
            }
          },
        );
        if (stopped) controls.stop();
        setStarting(false);
      } catch (e) {
        const name = (e as Error).name;
        setStarting(false);
        setError(
          name === 'NotAllowedError'
            ? 'Доступ к камере запрещён. Разрешите его в настройках браузера или введите код вручную.'
            : name === 'NotFoundError'
              ? 'Камера не найдена. Введите код вручную.'
              : 'Не удалось запустить камеру. Введите код вручную.',
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  // Свой полноэкранный <dialog> (верхний слой браузера) — поверх окна добавления, как сканер в FatSecret.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) dlg.showModal();
    const onEsc = (e: Event) => {
      if (e.target !== dlg) return;
      e.preventDefault();
      cancelRef.current();
    };
    dlg?.addEventListener('cancel', onEsc);
    return () => {
      dlg?.removeEventListener('cancel', onEsc);
      if (dlg?.open) dlg.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="scanner-full" aria-label="Сканирование штрихкода">
      <div className="scanner-top">
        <button type="button" className="scanner-round" onClick={onCancel} aria-label="Закрыть сканер">
          {Icons.close}
        </button>
        <button type="button" className="scanner-pill" onClick={onCancel}>
          Клавиатура
        </button>
      </div>
      <div className="scanner-title">
        <b>Сканировать штрихкод</b>
        <span>{error ? 'Камера недоступна' : starting ? 'Запуск камеры…' : 'Поместите красную линию поперёк штрихкода'}</span>
      </div>
      {error ? (
        <p className="notice error scanner-error" role="alert">
          {error}
        </p>
      ) : (
        <div className="scanner-view">
          <video ref={videoRef} muted playsInline aria-label="Изображение с камеры" />
          <span className="scanner-line" aria-hidden="true" />
        </div>
      )}
    </dialog>
  );
}

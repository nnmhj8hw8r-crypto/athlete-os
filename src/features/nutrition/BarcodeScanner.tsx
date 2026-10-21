// Сканирование штрихкода камерой (библиотека ZXing, загружается только по запросу).
// Камера в браузере доступна только на HTTPS или localhost; иначе остаётся ручной ввод.
import { useEffect, useRef, useState } from 'react';
import { parseEan } from '../../../shared/ean.ts';

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

  return (
    <div className="scanner stack">
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <video ref={videoRef} muted playsInline aria-label="Изображение с камеры" />
          <p className="muted small">{starting ? 'Запуск камеры…' : 'Наведите камеру на штрихкод.'}</p>
        </>
      )}
      <button type="button" className="btn" onClick={onCancel}>
        Остановить сканирование
      </button>
    </div>
  );
}

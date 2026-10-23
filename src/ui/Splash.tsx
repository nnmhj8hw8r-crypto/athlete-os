// Заставка при запуске (v0.9.2): знак иконки — кольцо с перемычкой. Кольцо прорисовывается с поворотом,
// перемычка соединяет его края, затем знак «раскрывается» по линии: верхняя половина экрана уходит вверх,
// нижняя — вниз, под ними уже загруженное приложение. ~1,3 с; нажатие пропускает; при «Уменьшении
// движения» заставки нет. Показывается один раз при открытии приложения, не при переходах.
import { useEffect, useState } from 'react';

const OPEN_AT = 900; // мс: начало раскрытия
const OPEN_MS = 480; // мс: длительность раскрытия (как transition в styles.css)

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Знак иконки. Обе половины экрана рисуют его целиком, каждая показывает свою половину. */
function Mark() {
  return (
    <svg className="splash-mark" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="splash-ring" cx="50" cy="50" r="40" pathLength="100" />
    </svg>
  );
}

export function Splash() {
  const [phase, setPhase] = useState<'draw' | 'open' | 'done'>(() => (prefersReducedMotion() ? 'done' : 'draw'));

  useEffect(() => {
    if (phase === 'done') return;
    const t = setTimeout(() => setPhase(phase === 'draw' ? 'open' : 'done'), phase === 'draw' ? OPEN_AT : OPEN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'done') return null;
  return (
    <div className={`splash ${phase}`} role="presentation" onClick={() => setPhase((p) => (p === 'draw' ? 'open' : p))}>
      <div className="splash-half top">
        <Mark />
      </div>
      <div className="splash-half bottom">
        <Mark />
      </div>
      <span className="splash-bar" />
    </div>
  );
}

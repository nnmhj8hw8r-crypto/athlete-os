// Заставка при запуске (v0.9.3): знак иконки — кольцо с перемычкой. Кольцо прорисовывается с поворотом,
// перемычка соединяет его края, затем знак «раскрывается» по линии: верхняя половина экрана уходит вверх,
// нижняя — вниз, под ними уже загруженное приложение. ~1,4 с; нажатие пропускает; при «Уменьшении
// движения» знак просто гаснет. Показывается один раз при открытии приложения, не при переходах.
// v0.10: перед раскрытием знак коротко «щёлкает» (сжатие и отскок), а страница под ним приближается.
//
// Точность: кольцо и перемычка — один рисунок; обе половины — одинаковые полноэкранные слои с одним и тем
// же знаком по центру, каждый обрезан ровно по середине экрана, поэтому половины совпадают до пикселя.
import { useEffect, useState } from 'react';

const OPEN_AT = 900; // мс: начало раскрытия
const OPEN_MS = 480; // мс: длительность раскрытия (как transition в styles.css)
const REDUCED_OPEN_AT = 400;
const REDUCED_OPEN_MS = 200;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Знак иконки в пропорциях иконки: толщина кольца и перемычки одинаковая, перемычка заходит под кольцо. */
function Mark() {
  return (
    <svg className="splash-mark" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="splash-ring" cx="50" cy="50" r="40" pathLength="100" />
      <rect className="splash-bar" x="14" y="45" width="72" height="10" />
    </svg>
  );
}

export function Splash() {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<'draw' | 'open' | 'done'>('draw');

  useEffect(() => {
    if (phase === 'done') return;
    const wait = phase === 'draw' ? (reduced ? REDUCED_OPEN_AT : OPEN_AT) : reduced ? REDUCED_OPEN_MS : OPEN_MS;
    const t = setTimeout(() => setPhase(phase === 'draw' ? 'open' : 'done'), wait);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  // v0.10: при раскрытии страница под заставкой слегка «подъезжает» навстречу — ощущение глубины.
  useEffect(() => {
    if (phase !== 'open' || reduced) return;
    const root = document.documentElement;
    root.classList.add('app-reveal');
    const t = setTimeout(() => root.classList.remove('app-reveal'), 700);
    return () => {
      clearTimeout(t);
      root.classList.remove('app-reveal');
    };
  }, [phase, reduced]);

  if (phase === 'done') return null;
  return (
    <div className={`splash ${phase}`} role="presentation" onClick={() => setPhase((p) => (p === 'draw' ? 'open' : p))}>
      <div className="splash-layer top">
        <Mark />
      </div>
      <div className="splash-layer bottom">
        <Mark />
      </div>
    </div>
  );
}

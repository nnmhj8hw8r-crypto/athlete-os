// «Человечек» с подсвеченными мышцами — иконка упражнения (собственный рисунок, без внешних картинок).
// Основные мышцы — насыщенный красный, вспомогательные — светлый. Вид спереди или сзади выбирается
// по тому, где больше основных мышц; на экране упражнения показываются оба вида.
import { useState } from 'react';
import type { Muscle } from '../domain/schemas.ts';

type View = 'front' | 'back';

const FRONT_MUSCLES: ReadonlySet<Muscle> = new Set(['chest', 'delts', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'adductors', 'calves']);
const BACK_MUSCLES: ReadonlySet<Muscle> = new Set(['traps', 'lats', 'rearDelts', 'triceps', 'lowerBack', 'glutes', 'hamstrings', 'calves', 'forearms']);

/** Контуры мышц: [мышца, вид, svg-элемент]. Координаты в системе 100 × 200, ось симметрии x = 50. */
type Shape = { m: Muscle; d: string } | { m: Muscle; e: [cx: number, cy: number, rx: number, ry: number, rot?: number] };

const mirrorEllipse = (m: Muscle, cx: number, cy: number, rx: number, ry: number, rot = 0): Shape[] => [
  { m, e: [cx, cy, rx, ry, rot] },
  { m, e: [100 - cx, cy, rx, ry, -rot] },
];

const FRONT: Shape[] = [
  ...mirrorEllipse('delts', 29.5, 41, 6, 6.5),
  { m: 'chest', d: 'M49 41 L37 41 Q33 47 36 55 Q43 59 49 56 Z' },
  { m: 'chest', d: 'M51 41 L63 41 Q67 47 64 55 Q57 59 51 56 Z' },
  ...mirrorEllipse('biceps', 24.5, 56, 3.6, 8.5, 12),
  ...mirrorEllipse('forearms', 19, 84, 3.2, 10, 10),
  { m: 'abs', d: 'M44.5 60 h11 v28 q-5.5 4 -11 0 Z' },
  ...mirrorEllipse('obliques', 39, 76, 3.4, 10, -4),
  ...mirrorEllipse('quads', 41.5, 127, 6.2, 17, 3),
  ...mirrorEllipse('adductors', 46.8, 116, 2.2, 9),
  ...mirrorEllipse('calves', 40.5, 166, 3.6, 11),
];

const BACK: Shape[] = [
  { m: 'traps', d: 'M43 30 L57 30 L66 38 L50 52 L34 38 Z' },
  ...mirrorEllipse('rearDelts', 29.5, 41, 6, 6.5),
  { m: 'lats', d: 'M36 45 Q32 60 39 80 L48.5 70 L48.5 52 Z' },
  { m: 'lats', d: 'M64 45 Q68 60 61 80 L51.5 70 L51.5 52 Z' },
  ...mirrorEllipse('triceps', 24.5, 56, 3.6, 8.5, 12),
  ...mirrorEllipse('forearms', 19, 84, 3.2, 10, 10),
  { m: 'lowerBack', d: 'M44 76 h12 v16 h-12 Z' },
  ...mirrorEllipse('glutes', 43.5, 108, 7.5, 8),
  ...mirrorEllipse('hamstrings', 41.5, 133, 5.8, 14, 3),
  ...mirrorEllipse('calves', 40.5, 164, 4.6, 11),
];

/** Силуэт: голова, туловище, руки и ноги — толстые линии с круглыми концами. */
function Silhouette() {
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number) => (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w} />
      <line x1={100 - x1} y1={y1} x2={100 - x2} y2={y2} strokeWidth={w} />
    </>
  );
  return (
    <g className="bf-body" strokeLinecap="round">
      <circle cx="50" cy="16" r="10" />
      <rect x="45" y="24" width="10" height="9" rx="2" />
      <path d="M30 35 Q50 29 70 35 L68 60 Q65 80 64 92 L66 106 L34 106 L36 92 Q35 80 32 60 Z" />
      {limb(27, 39, 22, 69, 9)}
      {limb(21.5, 71, 17, 98, 7.5)}
      {limb(42, 108, 41, 148, 14)}
      {limb(41, 150, 40.5, 186, 10)}
      <circle cx="16" cy="102" r="4" />
      <circle cx="84" cy="102" r="4" />
    </g>
  );
}

function Muscles({ view, primary, secondary }: { view: View; primary: ReadonlySet<Muscle>; secondary: ReadonlySet<Muscle> }) {
  const shapes = view === 'front' ? FRONT : BACK;
  return (
    <g>
      {shapes.map((s, i) => {
        const cls = primary.has(s.m) ? 'bf-primary' : secondary.has(s.m) ? 'bf-secondary' : 'bf-idle';
        if ('d' in s) return <path key={i} className={cls} d={s.d} />;
        const [cx, cy, rx, ry, rot = 0] = s.e;
        return <ellipse key={i} className={cls} cx={cx} cy={cy} rx={rx} ry={ry} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} />;
      })}
    </g>
  );
}

export function pickView(primary: readonly Muscle[], secondary: readonly Muscle[] = []): View {
  const score = (set: ReadonlySet<Muscle>) => primary.filter((m) => set.has(m)).length * 2 + secondary.filter((m) => set.has(m)).length;
  return score(BACK_MUSCLES) > score(FRONT_MUSCLES) ? 'back' : 'front';
}

interface Props {
  primary: readonly Muscle[];
  secondary?: readonly Muscle[];
  view?: View | 'auto' | 'both';
  className?: string;
  title?: string;
}

export function BodyFigure({ primary, secondary = [], view = 'auto', className, title }: Props) {
  const p = new Set(primary);
  const s = new Set(secondary.filter((m) => !p.has(m)));
  const views: View[] = view === 'both' ? ['front', 'back'] : [view === 'auto' ? pickView(primary, secondary) : view];
  const w = 100 * views.length;
  return (
    <svg
      className={`body-figure ${className ?? ''}`}
      viewBox={`0 0 ${w} 200`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {views.map((v, i) => (
        <g key={v} transform={`translate(${i * 100} 0)`}>
          <Silhouette />
          <Muscles view={v} primary={p} secondary={s} />
          {views.length > 1 && (
            <text x="50" y="198" textAnchor="middle" className="bf-caption">
              {v === 'front' ? 'спереди' : 'сзади'}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/**
 * Круглая иконка упражнения: рисунок позы (если есть, src — путь от корня сайта) или «человечек»
 * со схемой мышц. Если рисунок не загрузился, показывается схема.
 */
export function ExerciseIcon({
  muscles,
  secondary,
  size = 'md',
  src,
}: {
  muscles: readonly Muscle[];
  secondary?: readonly Muscle[];
  size?: 'sm' | 'md' | 'lg';
  src?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <span className={`ex-icon ${size}${showImage ? ' pose' : ''}`} aria-hidden="true">
      {showImage ? (
        <img src={`${import.meta.env.BASE_URL}${src}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <BodyFigure primary={muscles} secondary={secondary} />
      )}
    </span>
  );
}

/** Крупный рисунок позы упражнения с подписью об источнике (страница упражнения, «Техника»). */
export function ExercisePose({ src, credit, licenseUrl }: { src: string; credit: string; licenseUrl: string }) {
  return (
    <figure className="ex-pose">
      <img src={`${import.meta.env.BASE_URL}${src}`} alt="Как выполняется упражнение" decoding="async" />
      <figcaption>
        {credit} ·{' '}
        <a href={licenseUrl} target="_blank" rel="noreferrer">
          лицензия
        </a>
      </figcaption>
    </figure>
  );
}

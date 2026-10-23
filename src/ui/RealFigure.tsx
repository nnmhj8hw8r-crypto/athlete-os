// Реалистичная фигура человека (v0.9.4) — мужская или женская, спереди и сзади. Основа — анатомическая
// иллюстрация в сером (как в образце пользователя), нужные мышцы проявляются цветом той же иллюстрации через
// маску с мягкими краями; «болит» — красным, нагрузка — затемнением. Нажатие определяет мышцу по области.
// Иллюстрации предоставлены пользователем (public/anatomy); области мышц размечены вручную в процентах.
import { useId, type MouseEvent } from 'react';
import type { Muscle } from '../domain/schemas.ts';
import type { Sex } from '../domain/profile.ts';

export type FigureView = 'front' | 'back';
/** Ellipse: центр и полуоси в % ширины/высоты рисунка, поворот в градусах. */
type E = [cx: number, cy: number, rx: number, ry: number, rot?: number];
type Areas = Partial<Record<Muscle, E[]>>;

const pair = (cx: number, cy: number, rx: number, ry: number, rot = 0): E[] => [
  [cx, cy, rx, ry, rot],
  [100 - cx, cy, rx, ry, -rot],
];

const AREAS: Record<Sex, Record<FigureView, Areas>> = {
  male: {
    front: {
      chest: pair(38.9, 25, 10.5, 3.3),
      delts: pair(25.5, 23.9, 6, 4.2),
      biceps: pair(22.2, 31.7, 4.4, 4.4),
      forearms: pair(15.3, 41.1, 4.4, 5, 15),
      abs: [[50, 33.3, 8.9, 7.2]],
      obliques: pair(37.5, 35.6, 3.9, 5),
      quads: pair(38.9, 55.6, 8.9, 9.4),
      adductors: pair(45.8, 52.2, 3.3, 5),
      calves: pair(35.6, 75.6, 5, 6.7),
      traps: pair(41.7, 18.9, 5.6, 1.4),
    },
    back: {
      traps: [[50, 21.1, 14.5, 5]],
      rearDelts: pair(21.7, 23.9, 6.4, 2.8),
      delts: pair(20.5, 22.8, 7, 3.6),
      lats: pair(35.4, 32.2, 8.7, 6.1, 10),
      lowerBack: [[50, 35.6, 8.1, 3.3]],
      triceps: pair(15.9, 31.1, 4.6, 4.4),
      forearms: pair(10.1, 41.1, 4, 4.7),
      glutes: pair(39.1, 45.6, 11, 5),
      hamstrings: pair(37.7, 58.9, 8.1, 7.8),
      adductors: pair(46.4, 55.6, 2.6, 4.4),
      calves: pair(35.4, 74.4, 8.1, 6.1),
    },
  },
  female: {
    front: {
      chest: pair(41, 25.8, 8.2, 3.1),
      delts: pair(26.8, 22.8, 4.9, 3.6),
      biceps: pair(25.1, 30.6, 3.3, 4.2),
      forearms: pair(19.7, 41.7, 3.3, 5.6, 15),
      abs: [[50, 34.4, 7.7, 6.1]],
      obliques: pair(38.3, 36.7, 3.3, 4.4),
      quads: pair(38.3, 57.8, 7.7, 8.9),
      adductors: pair(45.1, 54.4, 2.7, 4.4),
      calves: pair(36.1, 76.7, 3.8, 6.1),
      traps: pair(43.2, 18.9, 4.4, 1.2),
    },
    back: {
      traps: [[50, 21.1, 14.8, 5.6]],
      rearDelts: pair(21.5, 23.3, 6.7, 3.1),
      delts: pair(20.5, 22.5, 7.4, 3.6),
      lats: pair(36.3, 32.2, 8.9, 5.6, 10),
      lowerBack: [[50, 35.6, 8.1, 3.1]],
      triceps: pair(14.8, 30, 4.4, 4.4),
      forearms: pair(8.1, 41.1, 3.7, 5),
      glutes: pair(35.2, 45, 12.6, 5),
      hamstrings: pair(35.2, 60, 8.9, 7.8),
      adductors: pair(46.3, 56.7, 2.6, 4.4),
      calves: pair(32.6, 75.6, 8.1, 6.1),
    },
  },
};

/** Пропорции рисунков (ширина / высота) — чтобы фигуры стояли рядом без пустот. */
const ASPECT: Record<Sex, Record<FigureView, number>> = {
  male: { front: 320 / 800, back: 308 / 800 },
  female: { front: 326 / 800, back: 240 / 800 },
};

export const anatomyUrl = (sex: Sex, view: FigureView) => `${import.meta.env.BASE_URL}anatomy/${sex}-${view}.jpg`;

/** Как выделить мышцу: основная/вспомогательная (цветом рисунка), нагрузка 1–3 (затемнением), «болит» (красным). */
export type Tone = 'primary' | 'secondary' | 'lvl-1' | 'lvl-2' | 'lvl-3' | 'sore';

function inside(x: number, y: number, [cx, cy, rx, ry, rot = 0]: E): boolean {
  const a = (-rot * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * Math.cos(a) - dy * Math.sin(a);
  const v = dx * Math.sin(a) + dy * Math.cos(a);
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1.5; // с запасом под палец
}

/** Мышца под точкой (в % рисунка) — для выбора нажатием. */
export function muscleAtPoint(sex: Sex, view: FigureView, x: number, y: number): Muscle | null {
  const areas = AREAS[sex][view];
  for (const m of Object.keys(areas) as Muscle[]) if (areas[m]!.some((e) => inside(x, y, e))) return m;
  return null;
}

/** Есть ли у мышцы область на этой стороне фигуры. */
export function hasArea(sex: Sex, view: FigureView, m: Muscle): boolean {
  return !!AREAS[sex][view][m];
}

const TONES: Tone[] = ['secondary', 'primary', 'lvl-1', 'lvl-2', 'lvl-3', 'sore'];

function OneView({ sex, view, marks, onPick, caption }: { sex: Sex; view: FigureView; marks: Partial<Record<Muscle, Tone[]>>; onPick?: (m: Muscle) => void; caption?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const areas = AREAS[sex][view];
  const src = anatomyUrl(sex, view);
  const byTone = (t: Tone) => (Object.keys(marks) as Muscle[]).filter((m) => marks[m]!.includes(t) && areas[m]);
  function click(e: MouseEvent<HTMLSpanElement>) {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = muscleAtPoint(sex, view, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    if (m) onPick(m);
  }
  return (
    <span className="real-view">
      <span className={`real-canvas${onPick ? ' clickable' : ''}`} style={{ aspectRatio: String(ASPECT[sex][view]) }} onClick={click}>
        <img className="real-base" src={src} alt="" draggable={false} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id={`soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.9" />
            </filter>
            {TONES.map((t) => (
              <mask key={t} id={`m-${t}-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                <g filter={`url(#soft-${uid})`}>
                  {byTone(t).flatMap((m) =>
                    areas[m]!.map(([cx, cy, rx, ry, rot = 0], i) => (
                      <ellipse key={`${m}-${i}`} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill="#fff" />
                    )),
                  )}
                </g>
              </mask>
            ))}
          </defs>
          {/* Цвет исходной иллюстрации — там, где мышца выделена. */}
          <image className="real-tone secondary" href={src} x="0" y="0" width="100" height="100" preserveAspectRatio="none" mask={`url(#m-secondary-${uid})`} />
          <image className="real-tone primary" href={src} x="0" y="0" width="100" height="100" preserveAspectRatio="none" mask={`url(#m-primary-${uid})`} />
          <rect className="real-tone lvl-1" width="100" height="100" mask={`url(#m-lvl-1-${uid})`} />
          <rect className="real-tone lvl-2" width="100" height="100" mask={`url(#m-lvl-2-${uid})`} />
          <rect className="real-tone lvl-3" width="100" height="100" mask={`url(#m-lvl-3-${uid})`} />
          <rect className="real-tone sore" width="100" height="100" mask={`url(#m-sore-${uid})`} />
        </svg>
      </span>
      {caption && <span className="real-caption">{view === 'front' ? 'Спереди' : 'Сзади'}</span>}
    </span>
  );
}

export function RealFigure({
  sex,
  marks,
  views = ['front', 'back'],
  onPick,
  captions = true,
  className,
  title,
}: {
  sex: Sex;
  marks: Partial<Record<Muscle, Tone[]>>;
  views?: FigureView[];
  onPick?: (m: Muscle) => void;
  captions?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`real-figure${className ? ` ${className}` : ''}`} role="img" aria-label={title ?? 'Схема мышц'}>
      {views.map((v) => (
        <OneView key={v} sex={sex} view={v} marks={marks} onPick={onPick} caption={captions} />
      ))}
    </span>
  );
}

/** Отметки для упражнения: основные и вспомогательные мышцы. */
export function exerciseMarks(primary: readonly Muscle[], secondary: readonly Muscle[] = []): Partial<Record<Muscle, Tone[]>> {
  const out: Partial<Record<Muscle, Tone[]>> = {};
  for (const m of secondary) out[m] = ['secondary'];
  for (const m of primary) out[m] = ['primary'];
  return out;
}

// Схема мышц — анатомические рисунки «спереди» и «сзади» (Wikimedia Commons, автор Termininja,
// CC BY-SA 3.0, через проект wger) со слоями мышц: основные — красные, вспомогательные — светлые.
// Файлы — public/muscles/, лицензия — public/muscles/LICENSE.txt.
// Вид выбирается по тому, где больше основных мышц; на странице упражнения показываются оба вида.
import { useState, type ReactNode } from 'react';
import type { Muscle } from '../domain/schemas.ts';

type View = 'front' | 'back';

export const MUSCLE_MAP_CREDIT = 'Схема мышц: Termininja (Wikimedia Commons) / wger, CC BY-SA 3.0';
export const MUSCLE_MAP_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/deed.ru';

/** Номера слоёв wger для каждой нашей мышцы на каждом виде. */
const LAYERS: Record<View, Partial<Record<Muscle, number[]>>> = {
  front: { chest: [4, 3], delts: [2], biceps: [1, 13], abs: [6], obliques: [14], quads: [10], calves: [7] },
  back: { traps: [9], lats: [12], rearDelts: [2], triceps: [5], lowerBack: [16], glutes: [8], hamstrings: [11], calves: [7, 15] },
};

/**
 * Мышцы, для которых в наборе нет слоя (предплечья, приводящие бедра), — свои полупрозрачные контуры
 * в координатах рисунка 200 × 362.
 */
const EXTRA: Record<View, Partial<Record<Muscle, [cx: number, cy: number, rx: number, ry: number, rot: number][]>>> = {
  front: {
    forearms: [
      [31, 160, 5.5, 17, 20],
      [169, 160, 5.5, 17, -20],
    ],
    adductors: [
      [90, 200, 5, 20, -6],
      [110, 200, 5, 20, 6],
    ],
  },
  back: {
    forearms: [
      [31, 160, 5.5, 17, 20],
      [169, 160, 5.5, 17, -20],
    ],
  },
};

const FRONT_SET: ReadonlySet<Muscle> = new Set(['chest', 'delts', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'adductors']);
const BACK_SET: ReadonlySet<Muscle> = new Set(['traps', 'lats', 'rearDelts', 'triceps', 'lowerBack', 'glutes', 'hamstrings', 'calves']);

export function pickView(primary: readonly Muscle[], secondary: readonly Muscle[] = []): View {
  const score = (set: ReadonlySet<Muscle>) => primary.filter((m) => set.has(m)).length * 2 + secondary.filter((m) => set.has(m)).length;
  return score(BACK_SET) > score(FRONT_SET) ? 'back' : 'front';
}

const url = (p: string) => `${import.meta.env.BASE_URL}muscles/${p}`;

function AnatomyView({ view, primary, secondary, caption }: { view: View; primary: readonly Muscle[]; secondary: readonly Muscle[]; caption?: boolean }) {
  const layers = (list: readonly Muscle[]) => [...new Set(list.flatMap((m) => LAYERS[view][m] ?? []))];
  const main = layers(primary);
  const sec = layers(secondary).filter((n) => !main.includes(n));
  const extra = (list: readonly Muscle[], cls: string) =>
    list.flatMap((m) => (EXTRA[view][m] ?? []).map((e, i) => <ellipse key={`${m}-${i}-${cls}`} className={cls} cx={e[0]} cy={e[1]} rx={e[2]} ry={e[3]} transform={`rotate(${e[4]} ${e[0]} ${e[1]})`} />));
  return (
    <span className="anatomy-view">
      <img src={url(`${view}.svg`)} alt="" decoding="async" loading="lazy" />
      {sec.map((n) => (
        <img key={`s${n}`} src={url(`secondary/muscle-${n}.svg`)} alt="" decoding="async" loading="lazy" />
      ))}
      {main.map((n) => (
        <img key={`m${n}`} src={url(`main/muscle-${n}.svg`)} alt="" decoding="async" loading="lazy" />
      ))}
      <svg viewBox="0 0 200 362" aria-hidden="true">
        {extra(secondary.filter((m) => !primary.includes(m)), 'mx-secondary')}
        {extra(primary, 'mx-primary')}
      </svg>
      {caption && <span className="anatomy-caption">{view === 'front' ? 'спереди' : 'сзади'}</span>}
    </span>
  );
}

interface Props {
  primary: readonly Muscle[];
  secondary?: readonly Muscle[];
  view?: View | 'auto' | 'both';
  className?: string;
  title?: string;
}

export function BodyFigure({ primary, secondary = [], view = 'auto', className, title }: Props) {
  const sec = secondary.filter((m) => !primary.includes(m));
  const views: View[] = view === 'both' ? ['front', 'back'] : [view === 'auto' ? pickView(primary, sec) : view];
  return (
    <span className={`body-figure views-${views.length} ${className ?? ''}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {views.map((v) => (
        <AnatomyView key={v} view={v} primary={primary} secondary={sec} caption={views.length > 1} />
      ))}
    </span>
  );
}

/**
 * Круглая иконка упражнения: рисунок позы (src — путь от корня сайта), своя пиктограмма (pictogram)
 * или анатомическая схема мышц. Если рисунок не загрузился, показывается схема.
 */
export function ExerciseIcon({
  muscles,
  secondary,
  size = 'md',
  src,
  pictogram,
}: {
  muscles: readonly Muscle[];
  secondary?: readonly Muscle[];
  size?: 'sm' | 'md' | 'lg';
  src?: string | null;
  pictogram?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  return (
    <span className={`ex-icon ${size}${showImage || pictogram ? ' pose' : ' anatomy'}`} aria-hidden="true">
      {showImage ? (
        <img src={`${import.meta.env.BASE_URL}${src}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : pictogram ? (
        pictogram
      ) : (
        <BodyFigure primary={muscles} secondary={secondary} />
      )}
    </span>
  );
}

/** Крупный рисунок позы упражнения с подписью об источнике (страница упражнения, «Техника»). */
export function ExercisePose({ src, children, credit, licenseUrl }: { src?: string; children?: ReactNode; credit: string; licenseUrl?: string }) {
  return (
    <figure className="ex-pose">
      {src ? <img src={`${import.meta.env.BASE_URL}${src}`} alt="Как выполняется упражнение" decoding="async" /> : <span className="ex-pose-art">{children}</span>}
      <figcaption>
        {credit}
        {licenseUrl && (
          <>
            {' '}
            ·{' '}
            <a href={licenseUrl} target="_blank" rel="noreferrer">
              лицензия
            </a>
          </>
        )}
      </figcaption>
    </figure>
  );
}

/** Подпись под анатомической схемой (страница упражнения, «Техника», форма своего упражнения). */
export function MuscleMapCredit() {
  return (
    <p className="anatomy-credit">
      {MUSCLE_MAP_CREDIT} ·{' '}
      <a href={MUSCLE_MAP_LICENSE_URL} target="_blank" rel="noreferrer">
        лицензия
      </a>
    </p>
  );
}

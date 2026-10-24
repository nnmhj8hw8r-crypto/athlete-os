// Реалистичная фигура человека — мужская или женская, спереди и сзади (иллюстрации предоставлены пользователем,
// public/anatomy). v0.10: вместо приблизительных эллипсов — точная разметка мышц по контурам рисунка
// (public/anatomy/labels, скрипт scripts/anatomy/seg.py). Фигура рисуется на canvas: основа серая, выделенные
// мышцы — цветом иллюстрации или цветом статуса; фон рисунка прозрачный, поэтому фигура стоит на фоне карточки.
// Нажатие определяет мышцу по той же разметке — ровно ту, что видна под пальцем.
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { MUSCLES, type Muscle } from '../domain/schemas.ts';
import type { Sex } from '../domain/profile.ts';

export type FigureView = 'front' | 'back';

/**
 * Как выделить мышцу: основная/вспомогательная (цветом рисунка); нагрузка 1–3 (синие оттенки);
 * усталость — свежая (зелёный), восстанавливается (жёлтый), утомлена (оранжевый); «болит» — красным в полоску.
 */
export type Tone = 'primary' | 'secondary' | 'lvl-1' | 'lvl-2' | 'lvl-3' | 'fresh' | 'recovering' | 'fatigued' | 'sore' | 'selected';

/** Цвет и непрозрачность заливки; те же значения — в легенде (styles.css, .sw). */
export const TONE_RGBA: Record<Exclude<Tone, 'primary' | 'secondary'>, [number, number, number, number]> = {
  'lvl-1': [120, 175, 255, 0.45],
  'lvl-2': [45, 120, 245, 0.62],
  'lvl-3': [20, 60, 190, 0.8],
  fresh: [52, 199, 89, 0.42],
  recovering: [255, 196, 0, 0.7],
  fatigued: [255, 112, 0, 0.85],
  sore: [235, 35, 45, 0.85],
  selected: [10, 132, 255, 0.55],
};

export const anatomyUrl = (sex: Sex, view: FigureView) => `${import.meta.env.BASE_URL}anatomy/${sex}-${view}.jpg`;
const labelsUrl = (sex: Sex, view: FigureView) => `${import.meta.env.BASE_URL}anatomy/labels/${sex}-${view}.png`;

interface Source {
  w: number;
  h: number;
  rgb: Uint8ClampedArray;
  /** Номер мышцы (1…16) в порядке MUSCLES, 0 — не мышца, 254 — кромка фона, 255 — фон. */
  label: Uint8Array;
}

const cache = new Map<string, Promise<Source | null>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray | null {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

export function loadFigure(sex: Sex, view: FigureView): Promise<Source | null> {
  const key = `${sex}-${view}`;
  let p = cache.get(key);
  if (!p) {
    p = Promise.all([loadImage(anatomyUrl(sex, view)), loadImage(labelsUrl(sex, view))])
      .then(([img, lab]) => {
        const w = lab.naturalWidth;
        const h = lab.naturalHeight;
        const rgb = pixels(img, w, h);
        const l = pixels(lab, w, h);
        if (!rgb || !l) return null;
        const label = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const v = l[i * 4]!;
          label[i] = v >= 253 ? 255 : v >= 245 ? 254 : Math.round(v / 15);
        }
        return { w, h, rgb, label };
      })
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/** Мышца в точке (доли 0…1 от ширины/высоты рисунка); рядом с контуром ищет ближайшую в радиусе пальца. */
export function muscleAt(src: Pick<Source, 'w' | 'h' | 'label'>, fx: number, fy: number, radius = 7): Muscle | null {
  const x0 = Math.round(fx * src.w);
  const y0 = Math.round(fy * src.h);
  let best: { m: number; d: number } | null = null;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= src.w || y >= src.h) continue;
      const v = src.label[y * src.w + x]!;
      if (v === 0 || v > MUSCLES.length) continue;
      const d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { m: v, d };
    }
  }
  return best ? MUSCLES[best.m - 1]! : null;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function paint(ctx: CanvasRenderingContext2D, src: Source, marks: Partial<Record<Muscle, Tone[]>>) {
  const { w, h, rgb, label } = src;
  const out = ctx.createImageData(w, h);
  const d = out.data;
  const byIndex: (Tone[] | undefined)[] = MUSCLES.map((m) => marks[m]);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const v = label[i]!;
    if (v === 255) continue; // фон — прозрачный
    const r = rgb[p]!;
    const g = rgb[p + 1]!;
    const b = rgb[p + 2]!;
    // Серая основа (как раньше в CSS: grayscale + мягкий контраст и чуть светлее).
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const gray = Math.min(255, (y - 128) * 0.85 + 128 + 22);
    let R = gray;
    let G = gray;
    let B = gray;
    const tones = v >= 1 && v <= MUSCLES.length ? byIndex[v - 1] : undefined;
    if (tones) {
      if (tones.includes('primary')) {
        R = r;
        G = g;
        B = b;
      } else if (tones.includes('secondary')) {
        R = mix(gray, r, 0.55);
        G = mix(gray, g, 0.55);
        B = mix(gray, b, 0.55);
      }
      // Тень рисунка сохраняется: цвет статуса умножается на светлоту пикселя.
      const shade = Math.min(1.1, 0.45 + y / 255);
      for (const t of tones) {
        if (t === 'primary' || t === 'secondary') continue;
        const [cr, cg, cb, a0] = TONE_RGBA[t];
        let a = a0;
        if (t === 'sore') {
          // «Болит» — полосами, чтобы отличалось от любого статуса и без цвета.
          const x = i % w;
          const row = (i / w) | 0;
          a = (x + row) % 10 < 5 ? a0 : a0 * 0.45;
        }
        R = mix(R, cr * shade, a);
        G = mix(G, cg * shade, a);
        B = mix(B, cb * shade, a);
      }
    }
    d[p] = R;
    d[p + 1] = G;
    d[p + 2] = B;
    d[p + 3] = v === 254 ? 110 : 255;
  }
  ctx.putImageData(out, 0, 0);
}

function OneView({ sex, view, marks, onPick, caption }: { sex: Sex; view: FigureView; marks: Partial<Record<Muscle, Tone[]>>; onPick?: (m: Muscle) => void; caption?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadFigure(sex, view).then((s) => {
      if (!alive) return;
      if (s) setSrc(s);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [sex, view]);
  const key = JSON.stringify(marks);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !src) return;
    c.width = src.w;
    c.height = src.h;
    paint(ctx, src, marks);
    // marks сравниваем по содержимому (key), а не по ссылке.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, key]);

  function click(e: MouseEvent<HTMLCanvasElement>) {
    if (!onPick || !src) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = muscleAt(src, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    if (m) onPick(m);
  }

  const aspect = src ? src.w / src.h : 0.4;
  return (
    <span className="real-view">
      <span className="real-canvas" style={{ aspectRatio: String(aspect) }}>
        {failed ? (
          <img className="real-base" src={anatomyUrl(sex, view)} alt="" draggable={false} />
        ) : (
          <canvas ref={ref} className={onPick ? 'clickable' : undefined} onClick={click} aria-hidden="true" />
        )}
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

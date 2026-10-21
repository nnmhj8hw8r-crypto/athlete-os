// Простые SVG-иконки (обводка currentColor), без внешней библиотеки.
import type { ReactElement } from 'react';

const P = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const Icons: Record<string, ReactElement> = {
  home: P('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  food: P('M7 3v8a2 2 0 0 0 2 2v8M11 3v8M15 3c2 0 3 2 3 5s-1 5-3 5v8M5 3v8'),
  training: P('M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12'),
  recovery: P('M21 13a8 8 0 1 1-10-10 6 6 0 0 0 10 10z'),
  season: P('M4 6h16v14H4zM4 10h16M9 3v4M15 3v4'),
  more: P('M5 12h.01M12 12h.01M19 12h.01'),
  close: P('M6 6l12 12M18 6L6 18'),
  edit: P('M4 20h4L19 9l-4-4L4 16zM14 6l4 4'),
  trash: P('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'),
  plus: P('M12 5v14M5 12h14'),
  chevronLeft: P('M15 6l-6 6 6 6'),
  chevronRight: P('M9 6l6 6-6 6'),
};

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
  chevronDown: P('M6 9l6 6 6-6'),
  barcode: P('M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14'),
  pen: P('M4 20h4L20 8l-4-4L4 16zM13 7l4 4'),
  bolt: P('M13 2L4 14h7l-1 8 9-12h-7z'),
  book: P('M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3'),
  history: P('M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2'),
  search: P('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5'),
  drop: P('M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z'),
  scale: P('M5 7h14l-2 13H7zM9 7a3 3 0 0 1 6 0M12 11v3'),
};

// Простые SVG-иконки (обводка currentColor), без внешней библиотеки.
import type { ReactElement } from 'react';

const P = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Значок из нескольких фигур (нижняя панель): обводка 2 px, скруглённые концы. */
const S = (children: ReactElement | ReactElement[]) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Icons: Record<string, ReactElement> = {
  home: S([
    <rect key="a" x="3.5" y="3.5" width="7" height="7" rx="2" />,
    <rect key="b" x="13.5" y="3.5" width="7" height="7" rx="2" />,
    <rect key="c" x="3.5" y="13.5" width="7" height="7" rx="2" />,
    <rect key="d" x="13.5" y="13.5" width="7" height="7" rx="2" />,
  ]),
  food: S([
    <path key="a" d="M3.5 12h17a8.5 8.5 0 0 1-17 0z" />,
    <path key="b" d="M8 8.5c0-1.2 1.2-1.6 1.2-2.8M12 8.5c0-1.2 1.2-1.6 1.2-2.8M16 8.5c0-1.2 1.2-1.6 1.2-2.8" />,
  ]),
  training: S([
    <rect key="a" x="2.5" y="9.5" width="2.5" height="5" rx="1.2" />,
    <rect key="b" x="5" y="6.5" width="3.2" height="11" rx="1.6" />,
    <rect key="c" x="15.8" y="6.5" width="3.2" height="11" rx="1.6" />,
    <rect key="d" x="19" y="9.5" width="2.5" height="5" rx="1.2" />,
    <path key="e" d="M8.2 12h7.6" />,
  ]),
  recovery: S([<path key="a" d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />, <path key="b" d="M16 3.5v3M14.5 5h3" />]),
  season: S([
    <rect key="a" x="3.5" y="5" width="17" height="15.5" rx="3.5" />,
    <path key="b" d="M3.5 10h17M8 3v4M16 3v4" />,
    <path key="c" d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth="2.6" />,
  ]),
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18.5" cy="12" r="1.9" />
    </svg>
  ),
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
  check: P('M5 12.5l4.5 4.5L19 7.5'),
  timer: P('M12 8v5l3 2M9 2h6M12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'),
  swap: P('M7 4v13M4 7l3-3 3 3M17 20V7M14 17l3 3 3-3'),
  play: P('M7 4.5v15l12-7.5z'),
  next: P('M5 6l6 6-6 6M13 6l6 6-6 6'),
  dots: P('M12 5h.01M12 12h.01M12 19h.01'),
  camera: P('M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'),
  arrowUp: P('M12 19V5M6 11l6-6 6 6'),
  arrowDown: P('M12 5v14M6 13l6 6 6-6'),
  copy: P('M8 8h11v12H8zM5 16V4h11'),
  keyboard: P('M3 7h18v11H3zM7 11h.01M11 11h.01M15 11h.01M8 14.5h8'),
  info: P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01'),
  bell: P('M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0'),
  bug: P('M9 8a3 3 0 0 1 6 0M7 10h10v5a5 5 0 0 1-10 0zM12 10v10M4 13h3M17 13h3M5 8l2 2M19 8l-2 2M5 19l2-2M19 19l-2-2'),
  pill: P('M10.5 4.5a4.95 4.95 0 0 1 7 7l-6 6a4.95 4.95 0 0 1-7-7zM7.5 9.5l7 7'),
  shield: P('M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4'),
  code: P('M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16'),
};

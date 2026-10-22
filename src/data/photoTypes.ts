// Запись фото в IndexedDB. Само изображение хранится как Blob (уменьшенная копия JPEG),
// превью — маленькой строкой data URL для быстрых списков.

export type PhotoKind = 'progress' | 'cover';

export interface PhotoRecord {
  id: string;
  kind: PhotoKind;
  /** День снимка по Москве, YYYY-MM-DD. */
  date: string;
  blob: Blob;
  thumb: string;
  width: number;
  height: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

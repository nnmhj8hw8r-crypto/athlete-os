// Фото прогресса и обложки программ: уменьшение на устройстве и хранение в IndexedDB.
// Фото не попадают в резервную копию JSON (размер), это сказано в интерфейсе.
import { newId } from '../domain/ids.ts';
import { todayKey } from '../domain/time.ts';
import { db } from './db.ts';
import type { PhotoKind, PhotoRecord } from './photoTypes.ts';

const MAX_SIDE = 1600;
const THUMB_SIDE = 320;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение. Попробуйте другой файл (JPEG или PNG).'));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не поддерживает обработку изображений');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сжать изображение'))), 'image/jpeg', quality),
  );
}

/** Уменьшает фото (до 1600 px по большей стороне, JPEG) и сохраняет вместе с превью. */
export async function savePhoto(file: File, kind: PhotoKind, opts: { date?: string; note?: string } = {}): Promise<PhotoRecord> {
  if (!file.type.startsWith('image/')) throw new Error('Выберите файл изображения');
  const img = await loadImage(file);
  const big = draw(img, MAX_SIDE);
  const blob = await toBlob(big, 0.85);
  const thumb = draw(img, THUMB_SIDE).toDataURL('image/jpeg', 0.7);
  const stamp = new Date().toISOString();
  const rec: PhotoRecord = {
    id: newId(),
    kind,
    date: opts.date ?? todayKey(),
    blob,
    thumb,
    width: big.width,
    height: big.height,
    note: opts.note?.trim() || undefined,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.photos.put(rec);
  return rec;
}

export async function updatePhoto(id: string, patch: { date?: string; note?: string }): Promise<void> {
  await db.photos.update(id, { ...patch, note: patch.note?.trim() || undefined, updatedAt: new Date().toISOString() });
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

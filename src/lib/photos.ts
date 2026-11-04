import { db } from './db'
import type { StoredPhoto } from '../types'

/** How long an uploaded photo is kept on the device before it is deleted automatically. */
export const PHOTO_TTL_MS = 48 * 60 * 60 * 1000

/** Keep the original upload so it can be saved to the device later. Returns the photo id. */
export async function storePhoto(file: Blob, thumbnail: string): Promise<number> {
  const id = await db.photos.add({
    createdAt: Date.now(),
    blob: file,
    type: file.type || 'image/jpeg',
    thumbnail,
  })
  return id as number
}

/** Delete photos older than the retention window. Safe to call often. */
export async function purgeExpiredPhotos(): Promise<void> {
  const cutoff = Date.now() - PHOTO_TTL_MS
  await db.photos.where('createdAt').below(cutoff).delete()
}

export function photoExpiresAt(photo: StoredPhoto): number {
  return photo.createdAt + PHOTO_TTL_MS
}

/** Human-readable time left before the photo is deleted, e.g. "47 h left" or "35 min left". */
export function photoTimeLeft(photo: StoredPhoto, now = Date.now()): string {
  const ms = photoExpiresAt(photo) - now
  if (ms <= 0) return 'expired'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `${hours} h left`
  return `${Math.max(1, Math.round(ms / 60_000))} min left`
}

function extensionFor(type: string): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/heic' || type === 'image/heif') return 'heic'
  return 'jpg'
}

function fileName(photo: StoredPhoto): string {
  const d = new Date(photo.createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `meal-${stamp}.${extensionFor(photo.type)}`
}

/**
 * Hand the photo to the device: the share sheet on phones (lets you "Save Image" to the
 * camera roll), a plain download elsewhere. Returns false if the user cancelled the share.
 */
export async function savePhotoToDevice(photo: StoredPhoto): Promise<boolean> {
  const file = new File([photo.blob], fileName(photo), { type: photo.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false
      // Share failed for another reason — fall through to a download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { PHOTO_TTL_MS, photoTimeLeft, purgeExpiredPhotos, savePhotoToDevice } from '../lib/photos'

const TTL_HOURS = Math.round(PHOTO_TTL_MS / 3_600_000)

/** Every photo uploaded in the last 48 h, whether or not its meal was kept. */
export default function RecentPhotos() {
  // Drop anything past the window first (liveQuery itself must stay read-only)
  useEffect(() => {
    purgeExpiredPhotos()
  }, [])
  const photos = useLiveQuery(() => db.photos.orderBy('createdAt').reverse().toArray(), [])

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Recent photos</h3>
      <p className="hint" style={{ marginBottom: photos?.length ? 10 : 0 }}>
        Photos you upload are kept on this device for {TTL_HOURS} hours so you can save them to your camera roll,
        then deleted automatically.
      </p>
      {photos?.length === 0 && (
        <p className="hint" style={{ marginTop: 8 }}>
          No photos in the last {TTL_HOURS} hours.
        </p>
      )}
      {photos?.map((p) => (
        <div className="photo-row" key={p.id}>
          <img src={p.thumbnail} alt="" />
          <div className="info">
            <div className="when">
              {new Date(p.createdAt).toLocaleString([], {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="hint">{photoTimeLeft(p)}</div>
          </div>
          <button type="button" className="icon-btn" aria-label="Save photo" title="Save photo" onClick={() => savePhotoToDevice(p)}>
            ⬇
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label="Delete photo now"
            title="Delete now"
            onClick={() => {
              if (confirm('Delete this photo now?')) db.photos.delete(p.id!)
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

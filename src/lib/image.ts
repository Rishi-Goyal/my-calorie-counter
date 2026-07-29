export interface ProcessedImage {
  base64: string // raw base64 (no data: prefix), for the Gemini API
  thumbnail: string // small data URL for storing in the log
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the image'))
    }
    img.src = url
  })
}

function drawScaled(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function processPhoto(file: Blob): Promise<ProcessedImage> {
  const img = await loadImage(file)
  const full = drawScaled(img, 1024, 0.85)
  const thumbnail = drawScaled(img, 220, 0.7)
  return { base64: full.split(',')[1], thumbnail }
}

export interface ScannerHandle {
  stop: () => void
}

/**
 * Starts the camera on the given <video> element and calls onResult with the
 * first barcode found. Caller must call stop() (also called automatically
 * after a successful read). ZXing is loaded lazily so it doesn't weigh down
 * the initial bundle.
 */
export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onResult: (code: string) => void,
): Promise<ScannerHandle> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()
  const controls = await reader.decodeFromConstraints(
    { video: { facingMode: 'environment' } },
    video,
    (result) => {
      if (result) {
        controls.stop()
        onResult(result.getText())
      }
    },
  )
  return { stop: () => controls.stop() }
}

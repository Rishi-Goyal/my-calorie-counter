# My Calorie Counter

A free, installable web app (PWA) that estimates calories and macros from your phone camera. All data stays on your device.

## Three ways to log a meal

| Method | Accuracy | How it works |
|---|---|---|
| 📷 **Photo** | Honest range (e.g. 410–520 kcal) | Gemini vision identifies foods + portions; you confirm/adjust grams before saving |
| ▐║▌ **Barcode** | Label-exact (±5 kcal) | Looks up packaged foods in Open Food Facts |
| 🔍 **Search** | Database values | Built-in table of ~140 common foods (per 100 g, USDA-derived) |

The **portion confirmation step** after every photo is what keeps estimates tight — adjust the grams sliders and the calories recompute from per-100g values.

## Setup

```bash
npm install
npm run dev
```

### Enable photo analysis (free)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create a free API key (no credit card; free tier allows 250+ photo analyses/day — far more than you'll need).
2. Open the app → **Settings** → paste the key → Save.

The key is stored only in your browser (IndexedDB) and is sent only to Google's Gemini API. Barcode scanning and food search work without any key.

## Install on your phone

The app must be served over HTTPS for the camera and install prompt to work:

1. Push this repo to GitHub and enable **Settings → Pages → Source: GitHub Actions**. The included workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds and deploys on every push to `main`.
2. Open the Pages URL on your phone → browser menu → **Add to Home Screen**.

## Tech

- React + TypeScript + Vite, `vite-plugin-pwa` (offline shell, installable)
- Dexie (IndexedDB) — meals, thumbnails, and settings never leave the device
- Gemini Flash free tier for photo analysis (bring your own key)
- Open Food Facts API for barcodes, ZXing for scanning (lazy-loaded)

## Accuracy expectations

Photo-based estimation is genuinely ~±20–30% even for state-of-the-art models — a photo can't reveal hidden oil, sugar, or depth of a pile. This app is honest about it: photo meals store and display a confidence range, and the confirm step + barcode mode are there to close the gap where possible.

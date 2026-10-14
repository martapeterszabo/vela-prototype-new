# Vela – key screens prototype

Interactive, coded prototype of the Figma section
"Kulcsképernyők – A-01 Home, A-02 Eszközoldal, A-03 Pozíciónyitás" (+ onboarding).

Flow: Onboarding (3) → Home → Bitcoin asset page → Open position (Long/Short) → Success.
Deep links: `#onboarding-1..3`, `#home`, `#asset`, `#trade-long`, `#trade-short`, `#success-long`, `#success-short`.

## Project layout
Every file sits in the repo root (no folders), so the whole project can be uploaded to GitHub through the web UI by selecting all files.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
Either import the folder/repo at vercel.com/new (framework preset: Vite – auto-detected via `vercel.json`),
or from this folder:
```bash
npx vercel        # preview
npx vercel --prod # production
```

## Notes
- Stack: Vite + React + TypeScript + motion. No Tailwind; tokens live in `src/index.css`.
- Hero backgrounds use Figma's "Pattern refraction" shader. Browsers can't run that without WebGPU + the
  experimental HTML-in-Canvas API, so the heroes are 3× raster exports from Figma (`public/assets/heroes`)
  with a slow drift + parallax instead.
- Onboarding illustrations are the original Figma vectors; the Klein-blue lines run on the exact motion data
  (5 s, ease-out, dash 0.12 / 0.08, loop).
- Haptics use `navigator.vibrate` → works on Android Chrome, silently no-op on iOS Safari.
- Prices tick with a small mean-reverting random walk so live PnL flashes are visible.

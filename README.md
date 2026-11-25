# StitchLab

Offline-first embroidery digitizer. Image/text → real machine stitch files (DST, PES),
running entirely in the browser or inside an Android WebView. No server, no account,
no upload.

## Status (P0)

- [x] Stitch command model (`stitch` / `jump` / `trim` / `colorChange` / `end`, 0.1 mm units)
- [x] Tatami fill (rotated scanline, serpentine, no trims) + edge underlay
- [x] Running-stitch paths and outline passes
- [x] DST exporter (512-byte header, ternary 3-byte records, 12.1 mm move splitting)
- [x] PES exporter (v1: `CEmbOne` / `CSewSeg` blocks + embedded PEC stitch block)
- [x] Hoop preview canvas: design / stitch-plan / realistic thread views
- [x] Capacitor Android shell + GitHub Actions debug APK build

Not in P0: image import, auto-digitizing, lettering, satin columns, SVG import.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # typecheck + static bundle in dist/
```

## Android

The Android project is generated at build time, not committed:

```bash
npm run build
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

CI does exactly this (`.github/workflows/build-apk.yml`) and uploads
`app-debug.apk` as a workflow artifact.

## Format notes

| Format | Units | Colour | Max move | Notes |
| --- | --- | --- | --- | --- |
| DST | 0.1 mm | no (stops only) | 12.1 mm | universal, Tajima |
| PES | 0.1 mm | yes (PEC palette) | 204.7 mm | Brother / Babylock |

Writers are a clean TypeScript implementation of the documented formats,
cross-checked against the MIT-licensed `pyembroidery` reference implementation.
No GPL code is used.

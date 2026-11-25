/**
 * Core embroidery model.
 *
 * All coordinates are absolute machine units: 0.1 mm, origin at the top-left
 * of the hoop, y growing downwards (the convention used by DST/PES/PEC).
 * Nothing in here is allowed to depend on React or the DOM.
 */

export const PPMM = 10; // machine units (0.1 mm) per millimetre

/** Convert millimetres to machine units. */
export const mm = (v: number) => v * PPMM;

export type Pt = { x: number; y: number };

export type StitchType = 'stitch' | 'jump' | 'trim' | 'colorChange' | 'end';

export interface Stitch {
  x: number;
  y: number;
  t: StitchType;
}

export interface Thread {
  name: string;
  /** #RRGGBB */
  hex: string;
}

/** A filled area, kept only for the "design" preview. */
export interface Region {
  poly: Pt[];
  hex: string;
}

export interface Design {
  name: string;
  stitches: Stitch[];
  threads: Thread[];
  regions: Region[];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function bounds(design: Design): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of design.stitches) {
    if (s.t === 'end') continue;
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export interface DesignStats {
  stitches: number;
  jumps: number;
  colorChanges: number;
  /** Total thread consumed, in metres. */
  threadMetres: number;
  widthMm: number;
  heightMm: number;
  /** Longest single stitch move, in mm. */
  longestStitchMm: number;
}

export function stats(design: Design): DesignStats {
  let stitches = 0;
  let jumps = 0;
  let colorChanges = 0;
  let threadUnits = 0;
  let longest = 0;
  let prev: Pt | null = null;

  for (const s of design.stitches) {
    if (s.t === 'jump') jumps += 1;
    else if (s.t === 'colorChange') colorChanges += 1;
    else if (s.t === 'end') break;

    if (prev) {
      const d = Math.hypot(s.x - prev.x, s.y - prev.y);
      if (s.t === 'stitch') {
        stitches += 1;
        threadUnits += d;
        if (d > longest) longest = d;
      }
    }
    prev = { x: s.x, y: s.y };
  }

  const b = bounds(design);
  return {
    stitches,
    jumps,
    colorChanges,
    threadMetres: threadUnits / PPMM / 1000,
    widthMm: b.width / PPMM,
    heightMm: b.height / PPMM,
    longestStitchMm: longest / PPMM,
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

import type { Pt } from './types';
import { centroid, rotateAround, scanlineSpans } from './geometry';

export interface FillOptions {
  /** Row spacing in machine units (0.1 mm). 3.5–4.5 = 0.35–0.45 mm. */
  rowSpacing: number;
  /** Stitch length in machine units. 25–40 = 2.5–4 mm. */
  stitchLength: number;
  /** Fill angle in degrees, 0 = horizontal rows. */
  angleDeg: number;
}

/**
 * Tatami (meander) fill: parallel rows of running stitch, connected
 * serpentine-style so the fill is one continuous path with no trims.
 *
 * Rows are rotated by `-angleDeg`, scanline-filled, then rotated back, which
 * is how a real digitizer produces a 45° fill on a straight polygon.
 */
export function tatamiRows(poly: Pt[], o: FillOptions): Pt[][] {
  if (poly.length < 3) return [];
  const spacing = Math.max(2, o.rowSpacing);
  const step = Math.max(8, o.stitchLength);
  const rad = (o.angleDeg * Math.PI) / 180;
  const c = centroid(poly);
  const rotated = poly.map((p) => rotateAround(p, c, -rad));

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of rotated) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rows: Pt[][] = [];
  let rowIndex = 0;
  for (let y = minY + spacing / 2; y < maxY; y += spacing, rowIndex++) {
    const spans = scanlineSpans(rotated, y);
    for (const [x0, x1] of spans) {
      const pts = rowPoints(x0, x1, step, rowIndex % 2 === 1 ? step / 2 : 0);
      if (pts.length < 2) continue;
      let line = pts.map((x) => ({ x, y }));
      if (rowIndex % 2 === 1) line = line.reverse();
      rows.push(line.map((p) => rotateAround(p, c, rad)));
    }
  }
  return rows;
}

function rowPoints(x0: number, x1: number, step: number, stagger: number): number[] {
  const len = x1 - x0;
  if (len <= 0) return [];
  const pts: number[] = [];
  let x = x0 + stagger;
  if (x >= x1 - step * 0.35) x = x0;
  for (; x < x1 - step * 0.35; x += step) pts.push(x);
  pts.push(x1);
  return pts;
}

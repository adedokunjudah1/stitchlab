import type { Pt } from './types';

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function centroid(poly: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function rotateAround(p: Pt, c: Pt, rad: number): Pt {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

export function polylineLength(pts: Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

/**
 * Resample a path so consecutive points are at most `step` apart, always
 * keeping the first and last point. Used for running stitch.
 */
export function resample(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = dist(a, b);
    if (len === 0) continue;
    let travelled = step - carry;
    while (travelled < len - 1e-6) {
      const t = travelled / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      travelled += step;
    }
    carry = len - (travelled - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Even-odd scanline intersections of a polygon at height y.
 * Returns sorted [xStart, xEnd] spans.
 */
export function scanlineSpans(poly: Pt[], y: number): Array<[number, number]> {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const aAbove = a.y <= y;
    const bAbove = b.y <= y;
    if (aAbove === bAbove) continue;
    const t = (y - a.y) / (b.y - a.y);
    xs.push(a.x + (b.x - a.x) * t);
  }
  xs.sort((p, q) => p - q);
  const spans: Array<[number, number]> = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > 1e-3) spans.push([xs[i], xs[i + 1]]);
  }
  return spans;
}

export function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function closedPath(poly: Pt[]): Pt[] {
  return poly.length ? [...poly, poly[0]] : [];
}

export function insetPolygon(poly: Pt[], amount: number): Pt[] {
  // Cheap inward offset along the centroid direction: adequate for previews
  // and underlay, not a true offsetting algorithm.
  const c = centroid(poly);
  return poly.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, 1 - amount / len);
    return { x: c.x + dx * k, y: c.y + dy * k };
  });
}

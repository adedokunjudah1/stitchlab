import type { Pt } from './types';

export type ShapeKind = 'circle' | 'star' | 'badge' | 'heart';

export function shapePolygon(kind: ShapeKind, cx: number, cy: number, r: number): Pt[] {
  switch (kind) {
    case 'circle':
      return circle(cx, cy, r, 144);
    case 'star':
      return star(cx, cy, r, r * 0.46, 5);
    case 'badge':
      return roundedRect(cx, cy, r * 2, r * 1.56, r * 0.34);
    case 'heart':
      return heart(cx, cy, r);
  }
}

export function circle(cx: number, cy: number, r: number, segments = 96): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function star(cx: number, cy: number, outer: number, inner: number, points = 5): Pt[] {
  const pts: Pt[] = [];
  const count = points * 2;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
    const rad = i % 2 === 0 ? outer : inner;
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  return pts;
}

export function roundedRect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  radius: number,
  cornerSegments = 10,
): Pt[] {
  const r = Math.min(radius, w / 2, h / 2);
  const left = cx - w / 2;
  const top = cy - h / 2;
  const right = cx + w / 2;
  const bottom = cy + h / 2;
  const pts: Pt[] = [];
  const corners: Array<[number, number, number]> = [
    [right - r, top + r, -Math.PI / 2],
    [right - r, bottom - r, 0],
    [left + r, bottom - r, Math.PI / 2],
    [left + r, top + r, Math.PI],
  ];
  for (const [x, y, start] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = start + (i / cornerSegments) * (Math.PI / 2);
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
  }
  return pts;
}

/** Classic heart curve, scaled so the shape spans roughly 2r wide. */
export function heart(cx: number, cy: number, r: number, segments = 120): Pt[] {
  const pts: Pt[] = [];
  const s = r / 16;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push({ x: cx + x * s, y: cy - y * s + r * 0.12 });
  }
  return pts;
}

import { DesignBuilder } from './design';
import { tatamiRows } from './fill';
import { closedPath, insetPolygon, resample } from './geometry';
import { shapePolygon, type ShapeKind } from './shapes';
import type { Design, Pt } from './types';
import { mm } from './types';

export type { ShapeKind };

export interface Settings {
  shape: ShapeKind;
  /** Longest side of the shape, mm. */
  sizeMm: number;
  /** Tatami row spacing, mm. */
  rowSpacingMm: number;
  /** Stitch length, mm. */
  stitchLengthMm: number;
  angleDeg: number;
  fillHex: string;
  outlineHex: string;
  underlay: boolean;
}

export interface Hoop {
  key: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const HOOPS: Hoop[] = [
  { key: '100x100', label: '100 × 100 mm', widthMm: 100, heightMm: 100 },
  { key: '130x180', label: '130 × 180 mm', widthMm: 130, heightMm: 180 },
  { key: '160x260', label: '160 × 260 mm', widthMm: 160, heightMm: 260 },
];

export const SHAPES: Array<{ kind: ShapeKind; label: string }> = [
  { kind: 'circle', label: 'Circle' },
  { kind: 'star', label: 'Star' },
  { kind: 'badge', label: 'Badge' },
  { kind: 'heart', label: 'Heart' },
];

export const DEFAULT_SETTINGS: Settings = {
  shape: 'badge',
  sizeMm: 60,
  rowSpacingMm: 0.4,
  stitchLengthMm: 3,
  angleDeg: 45,
  fillHex: '#e0a33c',
  outlineHex: '#1d2b3a',
  underlay: true,
};

export function buildDesign(settings: Settings, hoop: Hoop, name = 'StitchLab sample'): Design {
  const b = new DesignBuilder(name);
  const cx = mm(hoop.widthMm) / 2;
  const cy = mm(hoop.heightMm) / 2;
  const half = mm(settings.sizeMm) / 2;

  const outline = shapePolygon(settings.shape, cx, cy, half);
  const fillArea = insetPolygon(outline, mm(0.6));

  b.region(outline, settings.fillHex);

  // --- fill -------------------------------------------------------------
  b.thread(settings.fillHex, 'Fill');
  if (settings.underlay) {
    const edge = resample(closedPath(insetPolygon(outline, mm(0.3))), mm(3));
    b.path(edge);
  }

  const rows = tatamiRows(fillArea, {
    rowSpacing: mm(settings.rowSpacingMm),
    stitchLength: mm(settings.stitchLengthMm),
    angleDeg: settings.angleDeg,
  });
  for (const row of rows) {
    b.path(row as Pt[]);
  }

  // --- outline ----------------------------------------------------------
  b.thread(settings.outlineHex, 'Outline');
  const outlinePath = closedPath(outline);
  b.path(resample(outlinePath, mm(settings.stitchLengthMm)));
  b.lift();
  b.path(resample(outlinePath.slice().reverse(), mm(settings.stitchLengthMm)));

  b.end();
  return b.build();
}

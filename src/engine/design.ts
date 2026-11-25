import type { Design, Pt, Region, Stitch, Thread } from './types';

/**
 * Builds a stitch list in absolute machine coordinates.
 *
 * The builder owns needle semantics so callers only think in paths:
 *  - `thread()` starts a new colour block (emits COLOR_CHANGE at the needle)
 *  - `lift()` marks the next stitch as needing a JUMP to reach it
 *  - `stitch()` appends a real stitch, inserting the JUMP automatically
 */
export class DesignBuilder {
  readonly name: string;
  readonly stitches: Stitch[] = [];
  readonly threads: Thread[] = [];
  readonly regions: Region[] = [];

  private needle: Pt = { x: 0, y: 0 };
  private hasNeedle = false;
  private lifted = true;

  constructor(name: string) {
    this.name = name;
  }

  thread(hex: string, name = ''): void {
    const last = this.threads[this.threads.length - 1];
    if (last && last.hex.toLowerCase() === hex.toLowerCase()) return;
    if (this.threads.length > 0 && this.hasNeedle) {
      this.stitches.push({ x: this.needle.x, y: this.needle.y, t: 'colorChange' });
      this.lifted = true;
    }
    this.threads.push({ name: name || hex, hex });
  }

  region(poly: Pt[], hex: string): void {
    this.regions.push({ poly: poly.map((p) => ({ ...p })), hex });
  }

  /** Next stitch must travel to its position without sewing. */
  lift(): void {
    this.lifted = true;
  }

  stitch(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.lifted && this.hasNeedle) {
      if (Math.hypot(x - this.needle.x, y - this.needle.y) > 1) {
        this.stitches.push({ x, y, t: 'jump' });
      }
    }
    this.lifted = false;
    const last = this.stitches[this.stitches.length - 1];
    if (last && last.t === 'stitch' && last.x === x && last.y === y) return;
    this.stitches.push({ x, y, t: 'stitch' });
    this.needle = { x, y };
    this.hasNeedle = true;
  }

  /** Stitch a whole path in order. */
  path(points: Pt[]): void {
    for (const p of points) this.stitch(p.x, p.y);
  }

  end(): void {
    if (!this.hasNeedle) return;
    this.stitches.push({ x: this.needle.x, y: this.needle.y, t: 'end' });
  }

  build(): Design {
    return {
      name: this.name,
      stitches: this.stitches,
      threads: this.threads,
      regions: this.regions,
    };
  }
}

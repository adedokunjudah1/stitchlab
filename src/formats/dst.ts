import { bounds, type Design, type StitchType } from '../engine/types';

/**
 * Tajima DST writer.
 *
 * Byte layout follows the DST specification as implemented by pyembroidery
 * (MIT): a 512-byte ASCII header (0x1A terminated, space padded), then one
 * 3-byte ternary-encoded record per stitch, ending with an END record.
 *
 * DST is 0.1 mm, has no thread colours (colour changes are machine stops) and
 * caps a single move at ±121 units (12.1 mm), so long travel is split.
 */

const HEADER_SIZE = 512;
const MAX_MOVE = 121;

type DstFlags = 'stitch' | 'jump' | 'colorChange' | 'end';

function encodeRecord(dx: number, dy: number, flags: DstFlags): [number, number, number] {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let x = dx;
  let y = -dy; // DST stores y upwards

  if (flags === 'jump') b2 |= 1 << 7;

  if (flags === 'stitch' || flags === 'jump') {
    b2 |= 1 << 0;
    b2 |= 1 << 1;
    // x: ±81, ±27, ±9, ±3, ±1
    if (x > 40) {
      b2 |= 1 << 2;
      x -= 81;
    } else if (x < -40) {
      b2 |= 1 << 3;
      x += 81;
    }
    if (x > 13) {
      b1 |= 1 << 2;
      x -= 27;
    } else if (x < -13) {
      b1 |= 1 << 3;
      x += 27;
    }
    if (x > 4) {
      b0 |= 1 << 2;
      x -= 9;
    } else if (x < -4) {
      b0 |= 1 << 3;
      x += 9;
    }
    if (x > 1) {
      b1 |= 1 << 0;
      x -= 3;
    } else if (x < -1) {
      b1 |= 1 << 1;
      x += 3;
    }
    if (x > 0) {
      b0 |= 1 << 0;
      x -= 1;
    } else if (x < 0) {
      b0 |= 1 << 1;
      x += 1;
    }

    // y: ±81, ±27, ±9, ±3, ±1
    if (y > 40) {
      b2 |= 1 << 5;
      y -= 81;
    } else if (y < -40) {
      b2 |= 1 << 4;
      y += 81;
    }
    if (y > 13) {
      b1 |= 1 << 5;
      y -= 27;
    } else if (y < -13) {
      b1 |= 1 << 4;
      y += 27;
    }
    if (y > 4) {
      b0 |= 1 << 5;
      y -= 9;
    } else if (y < -4) {
      b0 |= 1 << 4;
      y += 9;
    }
    if (y > 1) {
      b1 |= 1 << 7;
      y -= 3;
    } else if (y < -1) {
      b1 |= 1 << 6;
      y += 3;
    }
    if (y > 0) {
      b0 |= 1 << 7;
      y -= 1;
    } else if (y < 0) {
      b0 |= 1 << 6;
      y += 1;
    }
  } else if (flags === 'colorChange') {
    b2 = 0b11000011;
  } else {
    b2 = 0b11110011;
  }

  return [b0, b1, b2];
}

function padded(value: number, width: number): string {
  return String(Math.abs(Math.round(value))).padStart(width, ' ');
}

function signed(value: number, width: number): string {
  const n = Math.round(value);
  return (n < 0 ? '-' : '+') + String(Math.abs(n)).padStart(width, ' ');
}

function buildHeader(design: Design): Uint8Array {
  const b = bounds(design);
  const stitchCount = design.stitches.filter((s) => s.t === 'stitch').length;
  const colorCount = Math.max(
    0,
    design.stitches.filter((s) => s.t === 'colorChange').length,
  );
  const last = [...design.stitches].reverse().find((s) => s.t !== 'end');
  const ax = last ? last.x : 0;
  const ay = last ? -last.y : 0;

  let head = '';
  head += `LA:${design.name.slice(0, 16).padEnd(16, ' ')}\r`;
  head += `ST:${padded(stitchCount, 7)}\r`;
  head += `CO:${padded(colorCount, 3)}\r`;
  head += `+X:${padded(b.maxX, 5)}\r`;
  head += `-X:${padded(b.minX, 5)}\r`;
  head += `+Y:${padded(b.maxY, 5)}\r`;
  head += `-Y:${padded(b.minY, 5)}\r`;
  head += `AX:${signed(ax, 5)}\r`;
  head += `AY:${signed(ay, 5)}\r`;
  head += `MX:${signed(0, 5)}\r`;
  head += `MY:${signed(0, 5)}\r`;
  head += `PD:${'*'.repeat(6)}\r`;

  const out = new Uint8Array(HEADER_SIZE);
  for (let i = 0; i < head.length && i < HEADER_SIZE - 1; i++) {
    out[i] = head.charCodeAt(i) & 0xff;
  }
  out[Math.min(head.length, HEADER_SIZE - 1)] = 0x1a;
  for (let i = head.length + 1; i < HEADER_SIZE; i++) out[i] = 0x20;
  return out;
}

export function toDst(design: Design): Uint8Array {
  const header = buildHeader(design);
  const body: number[] = [];

  const emit = (dx: number, dy: number, flags: DstFlags) => {
    const rec = encodeRecord(dx, dy, flags);
    body.push(rec[0], rec[1], rec[2]);
  };

  let px = 0;
  let py = 0;

  const move = (tx: number, ty: number, flags: DstFlags) => {
    let dx = tx - px;
    let dy = ty - py;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_MOVE));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      const isLast = i === steps - 1;
      const stepX = isLast ? tx - px : Math.round(sx);
      const stepY = isLast ? ty - py : Math.round(sy);
      emit(stepX, stepY, flags);
      px += stepX;
      py += stepY;
    }
    dx = 0;
    dy = 0;
  };

  for (const s of design.stitches) {
    const tx = Math.round(s.x);
    const ty = Math.round(s.y);
    const t: StitchType = s.t;

    if (t === 'end') {
      emit(0, 0, 'end');
      break;
    }
    if (t === 'trim') {
      // Three small jumps in place: the standard DST trim idiom.
      emit(2, 2, 'jump');
      emit(-4, -4, 'jump');
      emit(2, 2, 'jump');
      continue;
    }
    if (t === 'colorChange') {
      emit(0, 0, 'colorChange');
      continue;
    }
    move(tx, ty, t === 'jump' ? 'jump' : 'stitch');
  }

  const out = new Uint8Array(header.length + body.length);
  out.set(header, 0);
  out.set(body, header.length);
  return out;
}

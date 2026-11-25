import { bounds, hexToRgb, type Bounds, type Design, type Pt } from '../engine/types';
import { PEC_PALETTE } from './pecPalette';
import { ByteWriter } from './writer';

/**
 * Brother PES v1 writer, following the layout implemented by pyembroidery
 * (MIT): the `#PES0001` signature, a 32-bit pointer to the embedded PEC block,
 * a small v1 header, then `CEmbOne` / `CSewSeg` object blocks carrying the
 * colour-segmented geometry, and finally the PEC block the machine actually
 * sews from (colour table + 12-bit delta stitch stream + thumbnail).
 */

const PEC_ICON_STRIDE = 6; // 48 px / 8
const PEC_ICON_HEIGHT = 38;
const JUMP_CODE = 0x10;
const TRIM_CODE = 0x20;

interface Seg {
  points: Array<[number, number]>;
  code: number;
  flag: number;
}

function nearestCode(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  let best = 1;
  let bestDist = Infinity;
  for (let i = 0; i < PEC_PALETTE.length; i++) {
    const [pr, pg, pb] = PEC_PALETTE[i];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i + 1;
    }
  }
  return best;
}

function buildSegments(design: Design, b: Bounds): Seg[] {
  const adjustX = b.minX;
  const adjustY = b.maxY;
  const codes = design.threads.map((t) => nearestCode(t.hex));
  const codeAt = (i: number) => codes[Math.min(i, Math.max(0, codes.length - 1))] ?? 1;

  const segs: Seg[] = [];
  let run: Array<[number, number]> = [];
  let colorIdx = 0;
  let lastStitch: Pt = { x: 0, y: 0 };
  let pendingJump: Pt | null = null;

  const flush = () => {
    if (run.length >= 2) segs.push({ points: run, code: codeAt(colorIdx), flag: 0 });
    run = [];
  };

  for (const s of design.stitches) {
    if (s.t === 'end') break;

    if (s.t === 'colorChange') {
      flush();
      pendingJump = null;
      colorIdx += 1;
      continue;
    }
    if (s.t === 'trim') {
      flush();
      pendingJump = null;
      continue;
    }
    if (s.t === 'jump') {
      flush();
      pendingJump = { x: s.x, y: s.y };
      continue;
    }

    if (pendingJump) {
      segs.push({
        points: [
          [lastStitch.x - adjustX, lastStitch.y - adjustY],
          [pendingJump.x - adjustX, pendingJump.y - adjustY],
        ],
        code: codeAt(colorIdx),
        flag: 1,
      });
      pendingJump = null;
    }
    run.push([s.x - adjustX, s.y - adjustY]);
    lastStitch = { x: s.x, y: s.y };
  }
  flush();
  return segs;
}

function writeString16(w: ByteWriter, value: string): void {
  w.i16(value.length);
  w.ascii(value);
}

function writeSewSegHeader(w: ByteWriter, b: Bounds, hoopW = 1300, hoopH = 1800): number {
  const width = Math.round(b.width);
  const height = Math.round(b.height);

  for (let i = 0; i < 8; i++) w.i16(0);

  const transX = 350 + hoopW / 2 - width / 2;
  const transY = 100 + height + hoopH / 2 - height / 2;

  w.f32(1);
  w.f32(0);
  w.f32(0);
  w.f32(1);
  w.f32(transX);
  w.f32(transY);

  w.i16(1);
  w.i16(0);
  w.i16(0);
  w.i16(width);
  w.i16(height);
  w.zeros(8);

  const sectionAt = w.pos;
  w.i16(0);
  return sectionAt;
}

function writeSegments(w: ByteWriter, segs: Seg[]): number {
  const colorLog: Array<[number, number]> = [];
  let previousCode = -1;

  segs.forEach((seg, i) => {
    if (i > 0) w.i16(0x8003);
    if (previousCode !== seg.code) {
      colorLog.push([i, seg.code]);
      w.i16(seg.flag);
      previousCode = seg.code;
    }
    w.i16(seg.code);
    w.i16(seg.points.length);
    for (const [x, y] of seg.points) {
      w.i16(x);
      w.i16(y);
    }
  });

  w.i16(colorLog.length);
  for (const [section, code] of colorLog) {
    w.i16(section);
    w.i16(code);
  }
  return segs.length;
}

function writeValue(w: ByteWriter, value: number, long = false, flag = 0): void {
  if (!long && value > -64 && value < 63) {
    w.u8(value & 0x7f);
    return;
  }
  let v = value & 0x0fff;
  v |= 0x8000;
  v |= flag << 8;
  w.u8((v >> 8) & 0xff);
  w.u8(v & 0xff);
}

function writeJump(w: ByteWriter, dx: number, dy: number): void {
  writeValue(w, dx, true, JUMP_CODE);
  writeValue(w, dy, true, JUMP_CODE);
}

function writeTrimJump(w: ByteWriter, dx: number, dy: number): void {
  writeValue(w, dx, true, TRIM_CODE);
  writeValue(w, dy, true, TRIM_CODE);
}

function writeStitch(w: ByteWriter, dx: number, dy: number): void {
  writeValue(w, dx, false);
  writeValue(w, dy, false);
}

function pecEncode(w: ByteWriter, design: Design): void {
  let jumping = true;
  let init = true;
  let colorTwo = true;
  let px = 0;
  let py = 0;

  for (const s of design.stitches) {
    const tx = Math.round(s.x);
    const ty = Math.round(s.y);
    const dx = tx - px;
    const dy = ty - py;

    if (s.t === 'end') {
      w.u8(0xff);
      return;
    }

    if (s.t === 'stitch') {
      if (jumping) {
        if (dx !== 0 && dy !== 0) writeStitch(w, 0, 0);
        jumping = false;
      }
      writeStitch(w, dx, dy);
      px = tx;
      py = ty;
    } else if (s.t === 'jump') {
      jumping = true;
      if (init) writeJump(w, dx, dy);
      else writeTrimJump(w, dx, dy);
      px = tx;
      py = ty;
    } else if (s.t === 'colorChange') {
      if (jumping) {
        writeStitch(w, 0, 0);
        jumping = false;
      }
      w.u8(0xfe);
      w.u8(0xb0);
      w.u8(colorTwo ? 0x02 : 0x01);
      colorTwo = !colorTwo;
    }
    init = false;
  }
  w.u8(0xff);
}

function writePec(w: ByteWriter, design: Design, b: Bounds): void {
  const label = design.name.slice(0, 8).padEnd(16, ' ');
  w.ascii(`LA:${label}\r`);
  w.ascii(' '.repeat(12));
  w.u8(0xff);
  w.u8(0x00);
  w.u8(PEC_ICON_STRIDE);
  w.u8(PEC_ICON_HEIGHT);

  const codes = design.threads.map((t) => nearestCode(t.hex));
  w.ascii(' '.repeat(12));
  w.u8(Math.max(0, codes.length - 1));
  for (const code of codes) w.u8(code);
  const pad = Math.max(0, 463 - codes.length);
  w.ascii(' '.repeat(pad));

  const blockStart = w.pos;
  w.i16(0);
  w.i24(0);
  w.u8(0x31);
  w.u8(0xff);
  w.u8(0xf0);
  w.i16(Math.round(b.width));
  w.i16(Math.round(b.height));
  w.i16(0x1e0);
  w.i16(0x1b0);
  pecEncode(w, design);
  w.patch24(blockStart + 2, w.pos - blockStart);

  // Thumbnails: PEC stores a 1-bit image of the whole design plus one per
  // colour block. Blank frames are valid and keep readers happy.
  w.zeros(PEC_ICON_STRIDE * PEC_ICON_HEIGHT);
  for (let i = 0; i < codes.length; i++) w.zeros(PEC_ICON_STRIDE * PEC_ICON_HEIGHT);
}

export function toPes(design: Design): Uint8Array {
  const w = new ByteWriter();
  const b = bounds(design);

  w.ascii('#PES0001');
  const pecPointerAt = w.pos;
  w.i32(0);

  // PES v1 header
  w.i16(0x01); // scale to fit
  w.i16(0x01); // 130 × 180 hoop
  w.i16(0x01); // distinct block objects
  w.i16(0xffff);
  w.i16(0x0000);

  writeString16(w, 'CEmbOne');
  const sectionAt = writeSewSegHeader(w, b);
  w.i16(0xffff);
  w.i16(0x0000);

  writeString16(w, 'CSewSeg');
  const segs = buildSegments(design, b);
  const sections = writeSegments(w, segs);
  w.patch16(sectionAt, sections);
  w.i16(0x0000);
  w.i16(0x0000);

  w.patch32(pecPointerAt, w.pos);
  writePec(w, design, b);

  return w.bytes();
}

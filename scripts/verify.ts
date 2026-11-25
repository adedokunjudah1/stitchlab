/**
 * Verification harness: builds the sample design, writes DST + PES and prints
 * what was encoded. Bundled with esbuild and read back with pyembroidery
 * (an independent implementation) to prove the files are well formed.
 */
import { writeFileSync } from 'node:fs';
import { buildDesign, DEFAULT_SETTINGS, HOOPS } from '../src/engine/build';
import { stats } from '../src/engine/types';
import { toDst } from '../src/formats/dst';
import { toPes } from '../src/formats/pes';

const design = buildDesign(DEFAULT_SETTINGS, HOOPS[1], 'Verify');
const s = stats(design);

const dst = toDst(design);
const pes = toPes(design);

writeFileSync('/tmp/verify.dst', dst);
writeFileSync('/tmp/verify.pes', pes);

console.log(
  JSON.stringify(
    {
      stitches: s.stitches,
      jumps: s.jumps,
      colorChanges: s.colorChanges,
      threads: design.threads.length,
      widthMm: +s.widthMm.toFixed(2),
      heightMm: +s.heightMm.toFixed(2),
      longestStitchMm: +s.longestStitchMm.toFixed(2),
      dstBytes: dst.length,
      pesBytes: pes.length,
      dstHeader: new TextDecoder('latin1')
        .decode(dst.slice(0, 96))
        .replace(/\r/g, '\\r'),
      pesSignature: new TextDecoder('latin1').decode(pes.slice(0, 8)),
    },
    null,
    2,
  ),
);

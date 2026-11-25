import { useEffect, useRef } from 'react';
import type { Design, Pt } from '../engine/types';
import { PPMM } from '../engine/types';

export type ViewMode = 'design' | 'plan' | 'realistic';

interface Props {
  design: Design;
  hoopW: number;
  hoopH: number;
  mode: ViewMode;
}

interface Stroke {
  hex: string;
  path: Path2D;
}

export default function HoopCanvas({ design, hoopW, hoopH, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width < 2 || height < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Backdrop
      const bg = ctx.createRadialGradient(width / 2, height * 0.35, 40, width / 2, height / 2, Math.max(width, height));
      bg.addColorStop(0, '#141a23');
      bg.addColorStop(1, '#0a0d12');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const pad = 22;
      const hoopUnitsW = hoopW * PPMM;
      const hoopUnitsH = hoopH * PPMM;
      const scale = Math.min((width - pad * 2) / hoopUnitsW, (height - pad * 2) / hoopUnitsH);
      const ox = (width - hoopUnitsW * scale) / 2;
      const oy = (height - hoopUnitsH * scale) / 2;
      const X = (x: number) => ox + x * scale;
      const Y = (y: number) => oy + y * scale;

      // Hoop
      const radius = 10;
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, ox, oy, hoopUnitsW * scale, hoopUnitsH * scale, radius);
      ctx.fillStyle = '#10151d';
      ctx.fill();
      ctx.strokeStyle = '#2b3442';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.clip();

      // 10 mm grid
      ctx.strokeStyle = 'rgba(120, 145, 180, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx <= hoopW; gx += 10) {
        ctx.moveTo(X(gx * PPMM), oy);
        ctx.lineTo(X(gx * PPMM), oy + hoopUnitsH * scale);
      }
      for (let gy = 0; gy <= hoopH; gy += 10) {
        ctx.moveTo(ox, Y(gy * PPMM));
        ctx.lineTo(ox + hoopUnitsW * scale, Y(gy * PPMM));
      }
      ctx.stroke();

      // Centre lines
      ctx.strokeStyle = 'rgba(120, 145, 180, 0.22)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(X(hoopUnitsW / 2), oy);
      ctx.lineTo(X(hoopUnitsW / 2), oy + hoopUnitsH * scale);
      ctx.moveTo(ox, Y(hoopUnitsH / 2));
      ctx.lineTo(ox + hoopUnitsW * scale, Y(hoopUnitsH / 2));
      ctx.stroke();
      ctx.setLineDash([]);

      if (mode === 'design') {
        for (const region of design.regions) {
          ctx.beginPath();
          region.poly.forEach((p, i) => {
            if (i === 0) ctx.moveTo(X(p.x), Y(p.y));
            else ctx.lineTo(X(p.x), Y(p.y));
          });
          ctx.closePath();
          ctx.fillStyle = hexAlpha(region.hex, 0.32);
          ctx.fill();
          ctx.strokeStyle = hexAlpha(region.hex, 0.85);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else {
        const strokes: Stroke[] = [];
        const jumps: Array<[Pt, Pt]> = [];
        let path = new Path2D();
        let colorIndex = 0;
        let hex = design.threads[0]?.hex ?? '#dddddd';
        let prev: Pt | null = null;

        const flush = () => {
          strokes.push({ hex, path });
          path = new Path2D();
        };

        for (const s of design.stitches) {
          if (s.t === 'end') break;
          if (s.t === 'colorChange') {
            flush();
            colorIndex = Math.min(colorIndex + 1, design.threads.length - 1);
            hex = design.threads[colorIndex]?.hex ?? hex;
            prev = null;
            continue;
          }
          if (s.t === 'trim') {
            flush();
            prev = null;
            continue;
          }
          if (s.t === 'jump') {
            if (prev) jumps.push([prev, { x: s.x, y: s.y }]);
            prev = { x: s.x, y: s.y };
            continue;
          }
          if (prev) {
            path.moveTo(X(prev.x), Y(prev.y));
            path.lineTo(X(s.x), Y(s.y));
          }
          prev = { x: s.x, y: s.y };
        }
        flush();

        if (mode === 'realistic') {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const threadWidth = Math.max(1, 4.2 * scale);
          for (const stroke of strokes) {
            ctx.strokeStyle = stroke.hex;
            ctx.lineWidth = threadWidth;
            ctx.stroke(stroke.path);
            ctx.strokeStyle = 'rgba(255,255,255,0.16)';
            ctx.lineWidth = threadWidth * 0.38;
            ctx.stroke(stroke.path);
          }
        } else {
          ctx.strokeStyle = 'rgba(150, 170, 200, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          for (const [a, b] of jumps) {
            ctx.moveTo(X(a.x), Y(a.y));
            ctx.lineTo(X(b.x), Y(b.y));
          }
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.lineCap = 'round';
          for (const stroke of strokes) {
            ctx.strokeStyle = stroke.hex;
            ctx.lineWidth = Math.max(0.8, 1.35 * scale);
            ctx.stroke(stroke.path);
          }
        }
      }

      ctx.restore();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [design, hoopW, hoopH, mode]);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(200,200,200,${alpha})`;
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

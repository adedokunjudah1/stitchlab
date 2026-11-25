import { useMemo, useState } from 'react';
import { buildDesign, DEFAULT_SETTINGS, HOOPS, SHAPES, type Settings } from './engine/build';
import { stats } from './engine/types';
import { toDst } from './formats/dst';
import { toPes } from './formats/pes';
import HoopCanvas, { type ViewMode } from './render/HoopCanvas';

const VIEWS: Array<{ key: ViewMode; label: string }> = [
  { key: 'design', label: 'Design' },
  { key: 'plan', label: 'Stitch plan' },
  { key: 'realistic', label: 'Realistic' },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hoopKey, setHoopKey] = useState('130x180');
  const [mode, setMode] = useState<ViewMode>('realistic');
  const [name, setName] = useState('StitchLab sample');

  const hoop = HOOPS.find((h) => h.key === hoopKey) ?? HOOPS[1];
  const design = useMemo(() => buildDesign(settings, hoop, name), [settings, hoop, name]);
  const s = useMemo(() => stats(design), [design]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (s.widthMm > hoop.widthMm || s.heightMm > hoop.heightMm) {
      list.push(`Design (${s.widthMm.toFixed(1)} × ${s.heightMm.toFixed(1)} mm) is larger than the ${hoop.label} hoop.`);
    }
    if (settings.rowSpacingMm < 0.35) {
      list.push('Row spacing below 0.35 mm is denser than most machines sew cleanly.');
    }
    if (settings.sizeMm > 0 && settings.sizeMm < 20) {
      list.push('Features under ~20 mm lose detail; small text and thin outlines will distort.');
    }
    if (s.stitches > 15000) {
      list.push('Over 15,000 stitches — long sew-out and a large file.');
    }
    return list;
  }, [s, settings, hoop]);

  const save = (data: Uint8Array, ext: string) => {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(name)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>StitchLab</h1>
            <p>Offline digitizer · DST &amp; PES</p>
          </div>
        </div>
        <div className="topbar-right">
          <label className="name-field">
            <span>Name</span>
            <input
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value || 'Untitled')}
              aria-label="Design name"
            />
          </label>
          <button className="btn" onClick={() => save(toDst(design), 'dst')}>
            Export DST
          </button>
          <button className="btn primary" onClick={() => save(toPes(design), 'pes')}>
            Export PES
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="panel">
          <section>
            <h2>Shape</h2>
            <div className="chips">
              {SHAPES.map((shape) => (
                <button
                  key={shape.kind}
                  className={`chip ${settings.shape === shape.kind ? 'on' : ''}`}
                  onClick={() => set('shape', shape.kind)}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Hoop</h2>
            <select
              value={hoopKey}
              onChange={(e) => setHoopKey(e.target.value)}
              aria-label="Hoop size"
            >
              {HOOPS.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.label}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h2>Fill</h2>
            <Slider
              label="Size"
              value={settings.sizeMm}
              min={20}
              max={Math.min(hoop.widthMm, hoop.heightMm) - 10}
              step={1}
              unit=" mm"
              onChange={(v) => set('sizeMm', v)}
            />
            <Slider
              label="Row spacing"
              value={settings.rowSpacingMm}
              min={0.3}
              max={1.0}
              step={0.05}
              unit=" mm"
              onChange={(v) => set('rowSpacingMm', v)}
            />
            <Slider
              label="Stitch length"
              value={settings.stitchLengthMm}
              min={1.5}
              max={6}
              step={0.1}
              unit=" mm"
              onChange={(v) => set('stitchLengthMm', v)}
            />
            <Slider
              label="Angle"
              value={settings.angleDeg}
              min={0}
              max={90}
              step={5}
              unit="°"
              onChange={(v) => set('angleDeg', v)}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={settings.underlay}
                onChange={(e) => set('underlay', e.target.checked)}
              />
              <span>Edge underlay</span>
            </label>
          </section>

          <section>
            <h2>Threads</h2>
            <ColorField
              label="Fill"
              value={settings.fillHex}
              onChange={(v) => set('fillHex', v)}
            />
            <ColorField
              label="Outline"
              value={settings.outlineHex}
              onChange={(v) => set('outlineHex', v)}
            />
          </section>

          <section className="note">
            <h2>Where this is going</h2>
            <p>
              P0 ships the stitch engine and exporters. Image auto-digitizing and text
              lettering plug into the same stitch model next.
            </p>
          </section>
        </aside>

        <main>
          <div className="viewbar">
            <div className="tabs" role="tablist">
              {VIEWS.map((view) => (
                <button
                  key={view.key}
                  role="tab"
                  aria-selected={mode === view.key}
                  className={`tab ${mode === view.key ? 'on' : ''}`}
                  onClick={() => setMode(view.key)}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <div className="hoop-tag">{hoop.label} hoop</div>
          </div>

          <HoopCanvas design={design} hoopW={hoop.widthMm} hoopH={hoop.heightMm} mode={mode} />

          <footer className="statusbar">
            <Stat label="Stitches" value={s.stitches.toLocaleString()} />
            <Stat label="Colours" value={String(design.threads.length)} />
            <Stat label="Size" value={`${s.widthMm.toFixed(1)} × ${s.heightMm.toFixed(1)} mm`} />
            <Stat label="Thread" value={`${s.threadMetres.toFixed(2)} m`} />
            <Stat label="Jumps" value={String(s.jumps)} />
            {warnings.length > 0 && (
              <div className="warnings">
                {warnings.map((w) => (
                  <span key={w} className="warn">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-label">
        {label}
        <em>
          {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(2)}
          {unit}
        </em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <span className="swatch" style={{ background: value }} />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'design'
  );
}

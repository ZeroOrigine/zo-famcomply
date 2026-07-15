'use client';

import { useEffect, useRef, useState } from 'react';

interface Inflight {
  name: string; status: string; station: number; halted: boolean;
  born: string; cost: number; thought: string | null; thoughtBy: string | null;
}
export interface Birthline {
  ok: boolean;
  inflight: Inflight | null;
  lastBirth?: { name: string; created_at: string } | null;
}

function elapsed(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}m ${s % 60}s`;
}

export function useBirthline(): Birthline | null {
  const [d, setD] = useState<Birthline | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/birthline', { cache: 'no-store' });
        const j = (await r.json()) as Birthline;
        if (j?.ok) setD(j);
      } catch { /* keep last known. Never invent activity */ }
    };
    load();
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, []);
  return d;
}

/** The terminal: the machine's actual thoughts, sanitized server-side, unedited. */
export default function MachinePanel({ last }: { last?: { name: string; cost: number } | null }) {
  const d = useBirthline();
  const [lines, setLines] = useState<{ by: string; text: string }[]>([]);
  const [, tick] = useState(0);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const t = d?.inflight?.thought;
    if (t && !seen.current.has(t)) {
      seen.current.add(t);
      setLines((old) => [...old.slice(-6), { by: d?.inflight?.thoughtBy ?? 'a Mind', text: t }]);
    }
  }, [d]);
  useEffect(() => {
    const c = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(c);
  }, []);

  const f = d?.inflight ?? null;

  return (
    <div className="machine">
      <div className="mHead">
        <span className="l"><span className={`dot${f && !f.halted ? '' : ' off'}`}></span>The machine is thinking</span>
        <span className="r">unedited · live</span>
      </div>
      <div className={`stream${f ? '' : ' quiet'}`} aria-live="polite">
        {f ? (
          lines.length ? (
            lines.map((l, i) => (
              <div key={i} className="ln" style={{ animationDelay: `${i * 0.12}s` }}>
                <span className="who">{l.by}:</span> {l.text}
              </div>
            ))
          ) : (
            <div className="ln idle">
              {f.name} is on the line. The Mind at work is emitting source code, not sentences, at
              this exact second. The stage and the money below are real.
            </div>
          )
        ) : (
          <div className="ln idle">
            The line is idle. The factory pulls its next idea when the backlog runs low.
            {d?.lastBirth ? ` Last birth: ${d.lastBirth.name}.` : ''} When a Mind starts thinking,
            its actual thoughts stream here, unedited.
          </div>
        )}
      </div>
      <div className="mFoot">
        {f ? (
          <>
            <div><div className="k">On the line</div><div className="v time">{elapsed(f.born)}</div></div>
            <div><div className="k">Compute spent</div><div className="v money">${f.cost.toFixed(2)}</div></div>
            <div><div className="k">Humans involved</div><div className="v">0</div></div>
          </>
        ) : (
          <>
            <div><div className="k">Last birth</div><div className="v time">{last?.name ?? d?.lastBirth?.name ?? '·'}</div></div>
            <div><div className="k">It cost</div><div className="v money">{last ? `$${last.cost.toFixed(2)}` : '·'}</div></div>
            <div><div className="k">Humans involved</div><div className="v">0</div></div>
          </>
        )}
      </div>
    </div>
  );
}

/** Compact one-line machine status for small screens. Same hook, no new fetches. */
export function LineChip() {
  const d = useBirthline();
  const f = d?.inflight ?? null;
  return (
    <div className="linechip">
      <span className={`dot${f && !f.halted ? '' : ' off'}`}></span>
      {f
        ? `line: building ${f.name} · $${f.cost.toFixed(2)}`
        : `line idle${d?.lastBirth ? ` · last birth ${d.lastBirth.name}` : ''}`}
    </div>
  );
}

const STATIONS = ['Research', 'Evaluation', 'Ethics', 'Builder', 'QA', 'Launch'];

/** The birth rail. Where the current product physically is on the line. */
export function BirthRail() {
  const d = useBirthline();
  const f = d?.inflight ?? null;
  return (
    <div className="rail">
      <div className="stations">
        {STATIONS.map((s, i) => (
          <div key={s} className={`st${f && i < f.station ? ' done' : ''}${f && i === f.station ? (f.halted ? ' halt' : ' here') : ''}`}>
            <div className="node"></div>
            <label>{s}</label>
          </div>
        ))}
      </div>
      <div className="railcap">
        {f ? (
          f.halted ? (
            <><b>{f.name}</b> <span>is halted at {STATIONS[f.station] ?? 'the line'}. Status {f.status}. Shown, not hidden.</span></>
          ) : (
            <><b>{f.name}</b> <span>is being born.</span></>
          )
        ) : (
          <span>The line is idle{d?.lastBirth ? <>. Last birth: <b>{d.lastBirth.name}</b></> : ''}. The next idea starts here.</span>
        )}
      </div>
    </div>
  );
}

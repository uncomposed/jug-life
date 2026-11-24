import type { Phase, Timeline } from '../model/sim'
import { clock, PHASE_LABEL, since } from './derive'

const PHASE_FILL: Record<Phase, string> = {
  lag: 'var(--ph-lag)',
  growth: 'var(--ph-growth)',
  active: 'var(--ph-active)',
  slowing: 'var(--ph-slowing)',
  conditioning: 'var(--ph-cond)',
  stuck: 'var(--accent-warn)',
  crashing: 'var(--ph-crash)',
}

export const SPEEDS = [
  { h: 1, label: '1 h/s' },
  { h: 6, label: '6 h/s' },
  { h: 24, label: '1 day/s' },
]

interface Props {
  tl: Timeline
  t: number
  playing: boolean
  speed: number
  onSeek: (t: number) => void
  onPlay: () => void
  onSpeed: (h: number) => void
}

export function TimeBar({ tl, t, playing, speed, onSeek, onPlay, onSpeed }: Props) {
  const c = clock(t)
  const phase = tl.snapshots[Math.round(t / tl.stepH)].phase
  // phase ribbon segments, only up to "now"
  const segs: { from: number; to: number; phase: Phase }[] = []
  const upto = Math.round(t / tl.stepH)
  for (let i = 0; i <= upto; i++) {
    const s = tl.snapshots[i]
    const last = segs[segs.length - 1]
    if (last && last.phase === s.phase) last.to = s.t
    else segs.push({ from: s.t, to: s.t, phase: s.phase })
  }
  const pct = (h: number) => `${(h / tl.durationH) * 100}%`
  const marks = tl.events.filter((e) => e.t <= t && (e.kind === 'incident' || e.kind === 'action') && e.t > 0)

  return (
    <div className="timebar">
      <div className="time-row">
        <div className="time-buttons">
          <button className="icon-btn" onClick={() => onSeek(Math.max(0, t - 6))} aria-label="Back 6 hours">
            −6h
          </button>
          <button className="play" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><rect x="4" y="3" width="4" height="14" rx="1" /><rect x="12" y="3" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 3 L17 10 L5 17 Z" /></svg>
            )}
          </button>
          <button className="icon-btn" onClick={() => onSeek(Math.min(tl.durationH, t + 6))} aria-label="Forward 6 hours">
            +6h
          </button>
        </div>
        <div className="time-readout">
          <div className="time-main">{c.label}</div>
          <div className="time-sub">
            {since(t)} · <span className={`phase-chip ph-${phase}`}>{PHASE_LABEL[phase]}</span>
          </div>
        </div>
        <div className="speed" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s.h} aria-pressed={speed === s.h} onClick={() => onSpeed(s.h)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="scrub">
        <div className="ribbon" aria-hidden="true">
          {segs.map((s, i) => (
            <span key={i} style={{ left: pct(s.from), width: pct(Math.max(tl.stepH, s.to - s.from + tl.stepH)), background: PHASE_FILL[s.phase] }} />
          ))}
          {marks.map((e, i) => (
            <button
              key={i}
              className={`mark ${e.kind === 'incident' ? 'mark-warn' : 'mark-act'}`}
              style={{ left: pct(e.t) }}
              title={`${clock(e.t).label}: ${e.title}`}
              aria-label={`Jump to ${clock(e.t).label}: ${e.title}`}
              onClick={() => onSeek(e.t)}
            >
              {e.kind === 'incident' ? '▲' : '●'}
            </button>
          ))}
        </div>
        <input
          id="scrubber"
          type="range"
          min={0}
          max={tl.durationH}
          step={tl.stepH}
          value={t}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Time since pitching"
        />
        <div className="days" aria-hidden="true">
          {[0, 7, 14, 21].map((d) => (
            <span key={d} style={{ left: pct(d * 24) }}>
              {d === 0 ? 'pitch' : `week ${d / 7}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

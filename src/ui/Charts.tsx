import { useEffect, useRef, useState } from 'react'
import type { Snapshot, Timeline } from '../model/sim'
import { readBubbler, readProbe, readStrip, samplesUpTo, type SensorId } from '../model/sensors'

interface Series {
  name: string
  color: string
  dash?: string
  values: (number | null)[]
  step?: boolean
}

interface PanelSpec {
  title: string
  unit: string
  series: Series[]
  points?: { t: number; v: number; label: string }[]
  refLine?: { v: number; label: string }
  min?: number
  max?: number
  fmt?: (v: number) => string
  minSpan?: number
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((e) => setW(Math.max(200, e[0].contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function Panel({ spec, ts, tNow, duration, width }: { spec: PanelSpec; ts: number[]; tNow: number; duration: number; width: number }) {
  const H = 96
  const padL = 40
  const padR = 64
  const padT = 8
  const padB = 18
  const W = width
  const all = spec.series.flatMap((s) => s.values.filter((v): v is number => v !== null)).concat(spec.points?.map((p) => p.v) ?? [])
  if (spec.refLine) all.push(spec.refLine.v)
  let lo = spec.min ?? Math.min(...all)
  let hi = spec.max ?? Math.max(...all)
  if (!isFinite(lo) || !isFinite(hi)) {
    lo = 0
    hi = 1
  }
  const minSpan = spec.minSpan ?? 1e-6
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2
    lo = spec.min !== undefined ? lo : mid - minSpan / 2
    hi = lo + Math.max(minSpan, hi - lo)
  }
  const tickLo = lo
  const tickHi = hi
  const span = hi - lo
  if (spec.min === undefined) lo -= span * 0.06
  hi += span * 0.06
  const x = (t: number) => padL + (t / duration) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const fmt = spec.fmt ?? ((v: number) => (span >= 4 || Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)))
  const xNow = x(tNow)
  // end-of-line labels, nudged apart so they never overlap
  const labelY: (number | undefined)[] = spec.series.map(() => undefined)
  const wanted = spec.series
    .map((s, i) => ({ i, v: [...s.values].reverse().find((v) => v !== null) }))
    .filter((o): o is { i: number; v: number } => o.v !== undefined && o.v !== null)
    .map((o) => ({ i: o.i, y: y(o.v) }))
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < wanted.length; k++) if (wanted[k].y - wanted[k - 1].y < 12) wanted[k].y = wanted[k - 1].y + 12
  wanted.forEach((o) => (labelY[o.i] = o.y))
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">{spec.title}</span>
        <span className="panel-unit">{spec.unit}</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${spec.title} over time`}>
        {[0, 0.5, 1].map((f) => {
          const v = tickLo + (tickHi - tickLo) * f
          return (
            <g key={f}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" className="axis">
                {fmt(v)}
              </text>
            </g>
          )
        })}
        {[0, 3, 6, 9, 12, 15, 18, 21].map((d) => (
          <text key={d} x={x(d * 24)} y={H - 4} textAnchor="middle" className="axis">
            {d === 0 ? 'day 0' : d}
          </text>
        ))}
        <rect x={xNow} y={padT} width={Math.max(0, W - padR - xNow)} height={H - padT - padB} fill="var(--future)" />
        {spec.refLine && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(spec.refLine.v)} y2={y(spec.refLine.v)} stroke="var(--ink-soft)" strokeDasharray="2 4" />
            <text x={padL + 4} y={y(spec.refLine.v) - 4} className="axis">
              {spec.refLine.label}
            </text>
          </g>
        )}
        {spec.series.map((s, si) => {
          let d = ''
          let pen = false
          let last: [number, number] | null = null
          s.values.forEach((v, i) => {
            if (v === null) {
              pen = false
              return
            }
            const px = x(ts[i])
            const py = y(v)
            if (!pen) d += `M${px.toFixed(1)} ${py.toFixed(1)}`
            else if (s.step && last) d += `H${px.toFixed(1)}V${py.toFixed(1)}`
            else d += `L${px.toFixed(1)} ${py.toFixed(1)}`
            pen = true
            last = [px, py]
          })
          const lastV = [...s.values].reverse().find((v) => v !== null)
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" />
              {last && lastV !== undefined && lastV !== null && (
                <>
                  <circle cx={(last as [number, number])[0]} cy={(last as [number, number])[1]} r="3" fill={s.color} />
                  <text x={W - padR + 4} y={(labelY[si] ?? y(lastV)) + 3.5} className="series-label" fill={s.color}>
                    {s.name}
                  </text>
                </>
              )}
            </g>
          )
        })}
        {spec.points?.map((p, i) => (
          <g key={i}>
            <rect x={x(p.t) - 4} y={y(p.v) - 4} width="8" height="8" fill="var(--panel)" stroke="var(--ink)" strokeWidth="1.6" transform={`rotate(45 ${x(p.t)} ${y(p.v)})`} />
            <text x={x(p.t)} y={y(p.v) - 8} textAnchor="middle" className="axis strong">
              {p.label}
            </text>
          </g>
        ))}
        <line x1={xNow} x2={xNow} y1={padT} y2={H - padB} stroke="var(--ink)" strokeWidth="1.2" />
      </svg>
    </div>
  )
}

export function Charts({ tl, t, view, sensors }: { tl: Timeline; t: number; view: 'sensors' | 'curtain'; sensors: Set<SensorId> }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const every = 4 // one point per hour
  const upto = Math.round(t / tl.stepH)
  const snaps: Snapshot[] = []
  for (let i = 0; i <= upto; i += every) snaps.push(tl.snapshots[i])
  if (snaps[snaps.length - 1] !== tl.snapshots[upto]) snaps.push(tl.snapshots[upto])
  const ts = snaps.map((s) => s.t)
  const panels: PanelSpec[] = []

  if (view === 'sensors') {
    const temp: Series[] = []
    if (sensors.has('strip')) temp.push({ name: 'strip', color: 'var(--ink-soft)', step: true, values: snaps.map((s) => { const r = readStrip(tl, s); return r.lit.length ? r.lit.reduce((a, b) => a + b, 0) / r.lit.length : null }) })
    if (sensors.has('probe')) temp.push({ name: 'probe', color: 'var(--c-temp)', values: snaps.map((s) => readProbe(tl, s)) })
    if (temp.length) panels.push({ title: 'Temperature', unit: '°C', series: temp, minSpan: 4 })
    if (sensors.has('bubbler')) panels.push({ title: 'Bubbles', unit: 'per minute', series: [{ name: 'counter', color: 'var(--c-co2)', values: snaps.map((s) => readBubbler(tl, s)) }], min: 0 })
    const samples = samplesUpTo(tl, t)
    panels.push({
      title: 'Gravity samples',
      unit: 'by hand',
      series: [],
      points: samples.map((s) => ({ t: s.t, v: s.sg, label: s.sg.toFixed(3) })),
      refLine: { v: tl.expectedFG, label: 'target' },
      min: tl.expectedFG - 0.004,
      max: tl.og + 0.002,
      fmt: (v) => v.toFixed(3),
    })
  } else {
    panels.push({
      title: 'Yeast',
      unit: 'million cells/mL',
      min: 0,
      series: [
        { name: 'floating', color: 'var(--c-yeast)', values: snaps.map((s) => s.yeast) },
        { name: 'settled', color: 'var(--c-yeast)', dash: '5 4', values: snaps.map((s) => s.settled) },
      ],
    })
    panels.push({
      title: 'Sugar and alcohol',
      unit: 'g per litre',
      min: 0,
      series: [
        { name: 'sugar', color: 'var(--c-sugar)', values: snaps.map((s) => s.sugar) },
        { name: 'alcohol', color: 'var(--c-alcohol)', dash: '7 3', values: snaps.map((s) => s.ethanol) },
      ],
    })
    panels.push({
      title: 'Temperature',
      unit: '°C',
      series: [
        { name: 'beer', color: 'var(--c-temp)', values: snaps.map((s) => s.beerC) },
        { name: 'room', color: 'var(--ink-soft)', dash: '3 3', values: snaps.map((s) => s.roomC) },
      ],
      minSpan: 4,
    })
    panels.push({
      title: 'True gravity',
      unit: 'SG',
      series: [{ name: 'gravity', color: 'var(--ink)', values: snaps.map((s) => s.sg) }],
      refLine: { v: tl.expectedFG, label: 'target' },
      min: Math.min(tl.expectedFG - 0.004, ...snaps.map((s) => s.sg)),
      max: tl.og + 0.002,
      fmt: (v) => v.toFixed(3),
    })
    if (snaps.some((s) => s.wild > 0.5))
      panels.push({
        title: 'Wild microbes',
        unit: 'log₁₀ per mL',
        min: 0,
        series: [{ name: 'wild', color: 'var(--c-wild)', dash: '2 2', values: snaps.map((s) => (s.wild > 0 ? Math.log10(Math.max(1, s.wild)) : null)) }],
      })
  }

  return (
    <div className="charts" ref={ref}>
      {view === 'sensors' && !sensors.has('strip') && !sensors.has('probe') && !sensors.has('bubbler') && (
        <p className="muted small">No instruments on the jug. Add some under Sensors to see readings over time.</p>
      )}
      {panels.map((p) => (
        <Panel key={p.title} spec={p} ts={ts} tNow={t} duration={tl.durationH} width={width} />
      ))}
    </div>
  )
}

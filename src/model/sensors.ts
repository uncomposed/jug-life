// What each instrument would show, given the true state.
// Noise is deterministic (seeded by batch and time) so scrubbing back and forth
// always shows the same reading at the same moment.

import { hash01, type Snapshot, type Timeline } from './sim'
import { abvFromGravity, brixFromSG, platoToSG, terrillFG } from './physics'

export type SensorId = 'strip' | 'probe' | 'bubbler' | 'floater'

export interface SensorInfo {
  id: SensorId
  tag: string
  name: string
  cost: string
  blurb: string
  manual?: boolean
  fits: boolean
}

export const SENSORS: SensorInfo[] = [
  { id: 'strip', tag: 'TI-101', name: 'Stick-on thermometer strip', cost: '≈ $5', blurb: 'Reads the glass, not the beer, in 2 °C steps.', fits: true },
  { id: 'probe', tag: 'TT-102', name: 'Digital probe thermometer', cost: '≈ $15', blurb: 'Taped to the jug under a bit of foam. About ±0.5 °C.', fits: true },
  { id: 'bubbler', tag: 'FQ-103', name: 'Airlock bubble counter', cost: '≈ $30 DIY', blurb: 'Counts bubbles. Shows activity, not progress. Lies when the stopper leaks.', fits: true },
  { id: 'floater', tag: 'DT-104', name: 'Floating hydrometer (Tilt, iSpindel)', cost: '≈ $60–135', blurb: 'Streams gravity, but it is too wide for a 1-gallon jug neck.', fits: false },
]

function gauss(seed: number, i: number, ch: number): number {
  const u1 = Math.max(1e-9, hash01(seed + i * 7919, ch))
  const u2 = hash01(seed + i * 104729, ch + 1)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export interface StripReading {
  /** Lit segments, e.g. [20] or [20, 22] when between two. */
  lit: number[]
  text: string
}

export function readStrip(tl: Timeline, snap: Snapshot): StripReading {
  // The strip reads the outside of the glass: mostly beer, partly room, and lagging.
  const glass = 0.75 * snap.beerC + 0.25 * snap.roomC
  const segs = [14, 16, 18, 20, 22, 24, 26, 28, 30]
  if (glass < 13) return { lit: [], text: 'below 14 °C (nothing lit)' }
  if (glass > 31) return { lit: [], text: 'above 30 °C (nothing lit)' }
  const nearest = segs.reduce((a, b) => (Math.abs(b - glass) < Math.abs(a - glass) ? b : a))
  const frac = glass - nearest
  void tl
  if (Math.abs(frac) > 0.7) {
    const other = nearest + (frac > 0 ? 2 : -2)
    const pair = [nearest, other].sort((a, b) => a - b)
    return { lit: pair, text: `${pair[0]}–${pair[1]} °C` }
  }
  return { lit: [nearest], text: `${nearest} °C` }
}

export function readProbe(tl: Timeline, snap: Snapshot): number {
  const i = Math.round(snap.t / tl.stepH)
  const bias = (hash01(tl.setup.seed, 501) - 0.5) * 0.6
  return Math.round((snap.beerC + bias + 0.08 * gauss(tl.setup.seed, i, 11)) * 10) / 10
}

/** Bubbles per minute the counter would display (averaged over 15 minutes). */
export function readBubbler(tl: Timeline, snap: Snapshot): number {
  const i = Math.round(snap.t / tl.stepH)
  const expected = snap.bubbleRate * 900
  // Poisson-ish noise around the true count
  const n = Math.max(0, Math.round(expected + Math.sqrt(expected + 0.25) * gauss(tl.setup.seed, i, 21)))
  return (n / 900) * 60
}

export interface SampleReading {
  instrument: 'hydrometer' | 'refractometer'
  t: number
  /** What you'd write down, e.g. "1.031" or "7.8 °Bx". */
  raw: string
  /** Specific gravity you'd conclude. */
  sg: number
  abv: number
  note: string
}

export function readSample(tl: Timeline, t: number, instrument: 'hydrometer' | 'refractometer'): SampleReading {
  const i = Math.round(t / tl.stepH)
  const snap = tl.snapshots[Math.min(i, tl.snapshots.length - 1)]
  if (instrument === 'hydrometer') {
    const sg = Math.round((snap.sg + 0.0005 * gauss(tl.setup.seed, i, 31)) * 1000) / 1000
    return {
      instrument,
      t,
      raw: sg.toFixed(3),
      sg,
      abv: abvFromGravity(tl.og, sg),
      note: 'Read at the bottom of the curve. Good to about ±0.001.',
    }
  }
  // Refractometer: work out the raw Brix the glass would show, then apply the
  // standard correction, which is where the error creeps in.
  const obr = brixFromSG(tl.og) / 1.04
  let lo = 0
  let hi = obr
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    if (terrillFG(obr, mid) > snap.sg) hi = mid
    else lo = mid
  }
  const trueFbr = (lo + hi) / 2
  const rawBrix = Math.round((trueFbr * 1.04 + 0.2 * gauss(tl.setup.seed, i, 41)) * 10) / 10
  const sg = terrillFG(obr, rawBrix / 1.04)
  const sgR = Math.round(sg * 1000) / 1000
  return {
    instrument,
    t,
    raw: `${rawBrix.toFixed(1)} °Bx`,
    sg: sgR,
    abv: abvFromGravity(tl.og, sgR),
    note: 'Corrected for alcohol with the Terrill formula. Expect ±0.003.',
  }
}

export function samplesUpTo(tl: Timeline, t: number): SampleReading[] {
  return tl.actions
    .filter((a): a is Extract<typeof a, { type: 'sample' }> => a.type === 'sample' && a.t <= t + 1e-6)
    .map((a) => readSample(tl, a.t, a.instrument))
}

export { platoToSG }

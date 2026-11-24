// The whole simulation is one deterministic function:
//   runTimeline(setup, actions) → every state from pitch to day 21.
// Rewinding is just looking at an earlier snapshot. Changing the past means
// re-running with a different action list, which takes a few milliseconds.

import {
  LOCATIONS,
  PHYS,
  RECIPES,
  YEASTS,
  type LocationId,
  type RecipeId,
  type YeastId,
} from './params'
import {
  apparentPlato,
  clamp,
  co2SolubilityGL,
  ctmi,
  gramsPerLToPlato,
  platoToGramsPerL,
  platoToSG,
  sgToPlato,
  smoothstep,
} from './physics'

export type PitchAmount = 'quarter' | 'half' | 'full'
export type Closure = 'airlock' | 'blowoff'

export interface Setup {
  name: string
  recipeId: RecipeId
  yeastId: YeastId
  clarityFerm: boolean
  volumeL: number
  pitch: PitchAmount
  pitchTempC: number
  locationId: LocationId
  airlockFill: 'sanitizer' | 'water'
  sanitation: 'thorough' | 'quick'
  closure: Closure
  stopperFit: 'snug' | 'loose'
  seed: number
}

export type Action =
  | { t: number; type: 'move'; locationId: LocationId }
  | { t: number; type: 'nutrient' }
  | { t: number; type: 'rouse' }
  | { t: number; type: 'closure'; closure: Closure }
  | { t: number; type: 'service' }
  | { t: number; type: 'sample'; instrument: 'hydrometer' | 'refractometer' }

export type Phase = 'lag' | 'growth' | 'active' | 'slowing' | 'conditioning' | 'stuck' | 'crashing'

export interface Snapshot {
  t: number
  roomC: number
  beerC: number
  /** Yeast in suspension, million cells/mL. */
  yeast: number
  settled: number
  dead: number
  sugar: number
  dextrin: number
  ethanol: number
  fan: number
  co2Diss: number
  co2OutL: number
  bubbles: number
  bubbleRate: number
  /** Sugar being fermented right now, g/L per hour. */
  rate: number
  growth: number
  heatW: number
  krausenCm: number
  headspaceCm: number
  pressureKPa: number
  clogged: boolean
  stopperOut: boolean
  airlockDry: boolean
  closure: Closure
  locationId: LocationId
  volumeL: number
  wild: number
  acid: number
  esters: number
  fusels: number
  oxidation: number
  sg: number
  abv: number
  attenuation: number
  lagDone: number
  phase: Phase
}

export interface SimEvent {
  t: number
  kind: 'phase' | 'incident' | 'action' | 'milestone'
  severity: 'info' | 'warn'
  title: string
  /** What a brewer would notice from outside. */
  notice: string
  /** What is actually going on inside. */
  reality: string
}

export interface Timeline {
  setup: Setup
  actions: Action[]
  snapshots: Snapshot[]
  events: SimEvent[]
  stepH: number
  durationH: number
  og: number
  expectedFG: number
  sugar0: number
}

export const DURATION_H = 21 * 24
export const SNAPSHOT_H = 0.25
const DT = 1 / 60
const STEPS_PER_SNAP = Math.round(SNAPSHOT_H / DT)
/** Clock time of pitching: 6 pm on day 0. */
export const PITCH_HOUR = 18

export const PITCH_FRACTION: Record<PitchAmount, number> = { quarter: 0.25, half: 0.5, full: 1 }

export function roomTemp(locationId: LocationId, t: number): number {
  const loc = LOCATIONS[locationId]
  const hour = (PITCH_HOUR + t) % 24
  return loc.baseC + loc.swingC * Math.cos((2 * Math.PI * (hour - 16)) / 24)
}

export function headspaceCm(volumeL: number): number {
  return 3.5 + (3.8 - volumeL) * 8.1
}

export function pitchCellsPerML(setup: Setup): number {
  return (PITCH_FRACTION[setup.pitch] * PHYS.sachetCellsB * 1000) / (setup.volumeL * 1000)
}

export function defaultSetup(): Setup {
  return {
    name: 'Batch 1',
    recipeId: 'sorghum',
    yeastId: 'clean-ale',
    clarityFerm: false,
    volumeL: 3.4,
    pitch: 'half',
    pitchTempC: 21,
    locationId: 'closet',
    airlockFill: 'sanitizer',
    sanitation: 'thorough',
    closure: 'airlock',
    stopperFit: 'snug',
    seed: 7,
  }
}

const PHASE_TEXT: Record<Phase, { title: string; notice: string; reality: string }> = {
  lag: {
    title: 'Lag: yeast waking up',
    notice: 'Nothing visible. No bubbles, no foam.',
    reality:
      'The yeast are rehydrating, soaking up nutrients and building up reserves before they divide. 12 to 24 hours of this is normal. It is the most common moment for a new brewer to panic.',
  },
  growth: {
    title: 'Growth: yeast multiplying',
    notice: 'The first slow bubbles. Maybe a thin film of foam.',
    reality:
      'Cells are dividing every several hours, using nitrogen (FAN) from the wort to build new cells. Sugar is only just starting to fall.',
  },
  active: {
    title: 'Active fermentation',
    notice: 'Steady bubbling and a foam cap (krausen) on top.',
    reality:
      'Peak population. Every cell is turning sugar into alcohol and CO₂ as fast as the temperature allows, and the jug is making a little of its own heat.',
  },
  slowing: {
    title: 'Slowing down',
    notice: 'Bubbling slows. The foam starts to fall back.',
    reality:
      'Alcohol is building up and the easy sugar is gone. Yeast are slowing and starting to clump and settle.',
  },
  conditioning: {
    title: 'Conditioning and clearing',
    notice: 'Very few bubbles. The beer clears from the top down.',
    reality:
      'Most yeast have settled into a creamy layer at the bottom. The few still floating are cleaning up by-products. Waiting here makes better beer.',
  },
  stuck: {
    title: 'Stuck fermentation?',
    notice: 'Bubbling has stopped. A gravity reading would be higher than the recipe expects.',
    reality: 'The yeast quit with sugar left over.',
  },
  crashing: {
    title: 'Cold crash',
    notice: 'The beer clears quickly. No bubbles.',
    reality:
      'Cold makes the yeast clump together and drop. Fermentation is paused, not finished: anything left over stays sweet.',
  },
}

interface MutableState {
  t: number
  X: number
  Xs: number
  Xd: number
  lag: number
  S: number
  D: number
  E: number
  N: number
  T: number
  Cd: number
  co2OutL: number
  bubbles: number
  krausen: number
  P: number
  clogged: boolean
  stopperOut: boolean
  airlockDry: boolean
  reserve: number
  closure: Closure
  locationId: LocationId
  V: number
  W: number
  acid: number
  esters: number
  fusels: number
  oxidation: number
}

export function runTimeline(setup: Setup, actionsIn: Action[]): Timeline {
  const actions = [...actionsIn].sort((a, b) => a.t - b.t)
  const recipe = RECIPES[setup.recipeId]
  const yeast = YEASTS[setup.yeastId]
  const ogP = sgToPlato(recipe.og)
  const extract0 = platoToGramsPerL(ogP)
  const S0 = extract0 * recipe.fermentableFrac
  const D0 = extract0 - S0
  const expectedFG = platoToSG(apparentPlato(gramsPerLToPlato(D0), ogP))
  const fRef = ctmi(20, yeast.tMin, yeast.tOpt, yeast.tMax)
  const wRef = ctmi(20, 5, 35, 45)

  const events: SimEvent[] = []
  const snapshots: Snapshot[] = []
  const once = new Set<string>()
  const emit = (e: SimEvent, key?: string) => {
    if (key) {
      if (once.has(key)) return
      once.add(key)
    }
    events.push(e)
  }

  let X0 = pitchCellsPerML(setup)
  const pitchT = setup.pitchTempC
  if (pitchT > 32) {
    const survival = clamp(1 - (pitchT - 32) * 0.15, 0.03, 1)
    X0 *= survival
    emit({
      t: 0,
      kind: 'incident',
      severity: 'warn',
      title: 'Pitched into hot wort',
      notice: 'Nothing looks different yet.',
      reality: `At ${pitchT.toFixed(0)} °C, about ${Math.round((1 - survival) * 100)}% of the yeast died on contact. Expect a long lag.`,
    })
  }

  const s: MutableState = {
    t: 0,
    X: X0,
    Xs: 0,
    Xd: 0,
    lag: 0,
    S: S0,
    D: D0,
    E: 0,
    N: recipe.fanMgL,
    T: pitchT,
    Cd: 0,
    co2OutL: 0,
    bubbles: 0,
    krausen: 0,
    P: 0,
    clogged: false,
    stopperOut: false,
    airlockDry: false,
    reserve: setup.closure === 'blowoff' ? PHYS.blowoffReserveML : PHYS.airlockReserveML,
    closure: setup.closure,
    locationId: setup.locationId,
    V: setup.volumeL,
    W: setup.sanitation === 'quick' && hash01(setup.seed, 991) < 0.55 ? 30 : 0,
    acid: 0,
    esters: 0,
    fusels: 0,
    oxidation: 0,
  }

  const pitchRate = X0 / ogP
  emit({
    t: 0,
    kind: 'action',
    severity: 'info',
    title: 'Yeast pitched',
    notice: `${recipe.name}, ${setup.volumeL.toFixed(1)} L, ${setup.pitch} sachet at ${pitchT.toFixed(0)} °C.`,
    reality: `${X0.toFixed(0)} million cells per mL, which is ${pitchRate.toFixed(1)} M/mL per °Plato. The usual ale target is about 0.75. ${
      pitchRate > 2 ? 'This is a big overpitch: fast start, little growth, fewer fruity esters.' : pitchRate < 0.5 ? 'This is an underpitch: slow start, lots of growth, more esters.' : ''
    }`,
  })

  let actionIdx = 0
  let lastBubbles = 0
  let officialPhase: Phase = 'lag'
  let candidate: Phase = 'lag'
  let candidateCount = 0
  let peakDelta = 0
  const lastPhaseEvent: Partial<Record<Phase, number>> = {}
  let halfDone = false
  let rate = 0
  let growth = 0
  let heatW = 0
  const totalSteps = Math.round(DURATION_H / DT)

  for (let step = 0; step <= totalSteps; step++) {
    const t = step * DT
    s.t = t

    // --- apply user actions that are due ---
    while (actionIdx < actions.length && actions[actionIdx].t <= t + 1e-9) {
      applyAction(actions[actionIdx], s, setup, emit, recipe.foam)
      actionIdx++
    }

    // --- snapshot ---
    if (step % STEPS_PER_SNAP === 0) {
      const realP = gramsPerLToPlato(s.S + s.D)
      const sg = platoToSG(apparentPlato(realP, ogP))
      const attenuation = ((recipe.og - sg) / (recipe.og - 1)) * 100
      const room = roomTemp(s.locationId, t)
      const phaseNow = classify(s, rate, S0, attenuation, expectedFG, recipe.og, officialPhase)
      if (phaseNow === candidate) candidateCount++
      else {
        candidate = phaseNow
        candidateCount = 1
      }
      if (candidate !== officialPhase && candidateCount >= 8) {
        if (officialPhase === 'active' && peakDelta > 0.2) {
          emit({
            t,
            kind: 'milestone',
            severity: 'info',
            title: `Peak self-heating: +${peakDelta.toFixed(1)} °C`,
            notice: 'A probe would have shown the beer warmer than the room.',
            reality:
              'Fermentation gives off heat. A 1-gallon jug sheds it fast, so it only runs a little above room temperature. A 5-gallon batch can run several degrees hotter.',
          }, 'peak')
        }
        officialPhase = candidate
        const txt = PHASE_TEXT[officialPhase]
        let reality = txt.reality
        if (officialPhase === 'stuck') {
          const cause =
            s.T < 15
              ? 'it is too cold for them'
              : s.N < 2
                ? 'they ran out of nitrogen (FAN), common with sorghum'
                : 'they settled out early'
          reality = `${txt.reality} Most likely because ${cause}. Warming the jug, rousing the yeast or adding nutrient can restart it.`
        }
        const last = lastPhaseEvent[officialPhase]
        if (last === undefined || t - last > 36) {
          emit({ t, kind: 'phase', severity: officialPhase === 'stuck' ? 'warn' : 'info', title: txt.title, notice: txt.notice, reality })
        }
        lastPhaseEvent[officialPhase] = t
      }
      peakDelta = Math.max(peakDelta, heatW / (PHYS.uaWperK * LOCATIONS[s.locationId].uaMult))
      if (!halfDone && s.S < S0 / 2) {
        halfDone = true
        emit({
          t,
          kind: 'milestone',
          severity: 'info',
          title: 'Half the sugar is gone',
          notice: 'Still bubbling hard.',
          reality: `${(s.E / 7.89).toFixed(1)}% alcohol so far. The yeast will slow down from here as alcohol builds and sugar runs low.`,
        })
      }

      snapshots.push({
        t,
        roomC: room,
        beerC: s.T,
        yeast: s.X,
        settled: s.Xs,
        dead: s.Xd,
        sugar: s.S,
        dextrin: s.D,
        ethanol: s.E,
        fan: s.N,
        co2Diss: s.Cd,
        co2OutL: s.co2OutL,
        bubbles: s.bubbles,
        bubbleRate: step === 0 ? 0 : (s.bubbles - lastBubbles) / (SNAPSHOT_H * 3600),
        rate,
        growth,
        heatW,
        krausenCm: s.krausen,
        headspaceCm: headspaceCm(s.V),
        pressureKPa: s.P,
        clogged: s.clogged,
        stopperOut: s.stopperOut,
        airlockDry: s.airlockDry,
        closure: s.closure,
        locationId: s.locationId,
        volumeL: s.V,
        wild: s.W,
        acid: s.acid,
        esters: s.esters,
        fusels: s.fusels,
        oxidation: s.oxidation,
        sg,
        abv: s.E / 7.89,
        attenuation,
        lagDone: smoothstep(s.lag),
        phase: officialPhase,
      })
      lastBubbles = s.bubbles
    }
    if (step === totalSteps) break

    // --- yeast ---
    const fT = ctmi(s.T, yeast.tMin, yeast.tOpt, yeast.tMax) / fRef
    s.lag += (DT * fT) / yeast.lagH
    const act = smoothstep(s.lag)
    const ei = Math.max(0, 1 - s.E / yeast.eMax)
    const nLim = s.N / (8 + s.N)
    const roomForGrowth = Math.max(0, 1 - (s.X + s.Xs) / 95)
    const mu = yeast.muMax * fT * act * nLim * ei * (s.S / (2 + s.S)) * roomForGrowth
    const dX = mu * s.X * DT
    s.X += dX
    s.N = Math.max(0, s.N - PHYS.yFan * dX)
    growth = mu

    const vitality = 0.4 + 0.6 * (s.N / (s.N + 3))
    rate = Math.min(s.S / DT, yeast.q * fT * act * s.X * (s.S / (4 + s.S)) * ei * vitality)
    s.S -= rate * DT
    s.E += PHYS.yEthanol * rate * DT

    const cold = s.T < 12 ? (0.03 * (12 - s.T)) / 8 : 0
    const kf = yeast.flocBase + yeast.flocLate * (4 / (4 + s.S)) + cold + (s.N < 1 ? 0.003 : 0)
    const settle = kf * s.X * DT
    const kd = 0.0004 + (s.T > 36 ? 0.08 * (s.T - 36) : 0)
    const die = kd * s.X * DT
    s.X -= settle + die
    s.Xs += settle
    s.Xd += die + 0.004 * s.Xs * DT
    s.Xs -= 0.004 * s.Xs * DT

    // flavor by-products
    s.esters += dX * yeast.ester * Math.exp(0.12 * (s.T - 18)) * 0.02
    s.fusels += dX * Math.max(0, s.T - 23) * 0.05

    // --- wild microbes (only if something got in) ---
    if (s.W > 0) {
      const fw = ctmi(s.T, 5, 35, 45) / wRef
      const sub = (s.S + s.D) / (5 + s.S + s.D)
      const gw = 0.07 * fw * (1 / (1 + s.X / 15)) * Math.max(0, 1 - s.E / 60) * sub * (1 - s.W / 3e7)
      s.W += gw * s.W * DT
      const cw = Math.min((s.S + s.D) * 0.5, 9e-11 * s.W * sub * fw * DT)
      if (cw > 0) {
        const fromD = cw * (s.D / (s.S + s.D))
        s.D -= fromD
        s.S -= cw - fromD
        s.acid += cw * 0.9
      }
    }

    // --- heat ---
    const room = roomTemp(s.locationId, t)
    const loc = LOCATIONS[s.locationId]
    heatW = (rate * s.V * PHYS.heatJperG) / 3600
    const C = s.V * 4180 + PHYS.glassJperK
    const UA = PHYS.uaWperK * loc.uaMult
    const Tprev = s.T
    s.T += (DT * 3600 * (heatW - UA * (s.T - room))) / C

    // --- CO2 and gas ---
    s.Cd += PHYS.yCO2 * rate * DT
    const csat = co2SolubilityGL(s.T)
    let outG = 0
    if (s.Cd > csat * 1.05) outG = (s.Cd - csat * 1.05) * Math.min(1, 6 * DT)
    else if (s.Cd < csat * 0.98 && s.co2OutL > 1) outG = -(csat - s.Cd) * 0.01 * DT
    s.Cd -= outG
    const vhML = (PHYS.jugTotalL - s.V) * 1000
    const flow = outG * s.V * PHYS.co2mLperG + (vhML * (s.T - Tprev)) / (Tprev + 273.15)
    if (flow > 0) s.co2OutL += flow / 1000

    // --- foam ---
    const H = headspaceCm(s.V)
    const target = 4.2 * recipe.foam * Math.min(rate, 2.5)
    s.krausen += ((target - s.krausen) * DT) / (target > s.krausen ? 3 : 10)
    s.krausen = Math.max(0, s.krausen)

    // --- airlock, stopper, blow-off ---
    const vented = s.stopperOut || s.airlockDry
    const leak = setup.stopperFit === 'loose' ? PHYS.leakLoose : PHYS.leakSnug
    if (vented) {
      const exposure = s.stopperOut ? 0.4 : 0.06
      s.W += exposure * DT
      if (flow * (1 / DT) < 300) s.oxidation += DT * (s.stopperOut ? 0.03 : 0.008)
    } else if (s.closure === 'blowoff') {
      if (s.krausen > H - 0.5) {
        s.V -= (s.krausen - (H - 0.5)) * 0.004 * DT
        s.krausen = H - 0.5
        emit(
          {
            t,
            kind: 'incident',
            severity: 'info',
            title: 'Foam going out the blow-off tube',
            notice: 'Foam is climbing the tube into the jar of sanitizer.',
            reality: 'Exactly what the tube is for. You lose a few spoonfuls of beer and keep the stopper in.',
          },
          'blowoff-foam',
        )
      }
      if (flow > 0) {
        const take = Math.min(PHYS.blowoffReserveML - s.reserve, flow * (1 - leak))
        s.reserve += take
        s.bubbles += (flow * (1 - leak) - take) / 5
      } else if (flow < 0) suck(flow, s, setup, t, emit, PHYS.blowoffReserveML)
    } else {
      if (!s.clogged && s.krausen >= H - 0.5) {
        s.clogged = true
        emit({
          t,
          kind: 'incident',
          severity: 'warn',
          title: 'Foam has clogged the airlock',
          notice: 'Foam is pressed against the stopper and oozing out of the airlock. No clean bubbles.',
          reality: 'Gas cannot get out, so pressure is building in the headspace. Swap to a blow-off tube before something gives.',
        })
      }
      if (s.clogged && s.krausen < H - 2) {
        s.clogged = false
        s.P = 0
      }
      if (flow > 0) {
        if (s.clogged) {
          // most gas still oozes out through the foam; a little is trapped
          s.P += ((flow * (1 - leak) * 0.015) / Math.max(50, vhML)) * 101.3
          if (setup.stopperFit === 'loose') s.P *= 1 - 0.5 * DT
          const pop = setup.stopperFit === 'loose' ? PHYS.popKPaLoose : PHYS.popKPaSnug
          if (s.P >= pop) {
            s.stopperOut = true
            s.clogged = false
            s.P = 0
            s.V -= 0.12
            s.krausen = Math.max(0, s.krausen - 2)
            emit({
              t,
              kind: 'incident',
              severity: 'warn',
              title: 'The stopper popped',
              notice: 'Stopper on the floor, foam down the side of the jug.',
              reality:
                'Pressure pushed the stopper out and about 120 mL of foamy beer with it. The beer is now open to air, dust and fruit flies. Clean up and reseat it with a blow-off tube.',
            })
          }
        } else {
          const take = Math.min(PHYS.airlockReserveML - s.reserve, flow * (1 - leak))
          s.reserve += take
          s.bubbles += (flow * (1 - leak) - take) / PHYS.bubbleML
        }
      } else if (flow < 0) {
        if (setup.stopperFit === 'loose') {
          s.W += 0.02 * DT
        } else suck(flow, s, setup, t, emit, PHYS.airlockReserveML)
      }
    }

    // incidents that depend on conditions
    if (s.T > 24 && rate > 0.3)
      emit(
        {
          t,
          kind: 'incident',
          severity: 'warn',
          title: 'Fermenting hot',
          notice: `The beer is above 24 °C during peak activity.`,
          reality: 'Stressed yeast make fusel alcohols (hot, solvent-like) and lots of fruity esters. Cooler is cleaner.',
        },
        'hot',
      )
    if (s.T < 14 && s.S > 0.3 * S0 && act > 0.5)
      emit(
        {
          t,
          kind: 'incident',
          severity: 'warn',
          title: 'Too cold for the yeast',
          notice: 'Bubbling has slowed right down.',
          reality: `At ${s.T.toFixed(0)} °C ale yeast barely work, and below about 12 °C they start to drop out. Sugar is still waiting.`,
        },
        'cold',
      )
    if (s.W > 1e7)
      emit(
        {
          t,
          kind: 'incident',
          severity: 'warn',
          title: 'A film is forming on top',
          notice: 'A white, wrinkly or bubbly skin (pellicle) on the beer.',
          reality: 'Wild yeast or bacteria have taken hold. They will keep eating sugars regular yeast leave behind, so the gravity creeps lower and the beer turns sour or funky.',
        },
        'pellicle',
      )
    if (s.acid > 1)
      emit(
        {
          t,
          kind: 'incident',
          severity: 'warn',
          title: 'Turning sour',
          notice: 'Nothing you can see. A taste would be tart.',
          reality: 'Bacteria have made over 1 g/L of lactic acid. That is the point where most people taste sourness.',
        },
        'sour',
      )
  }

  return {
    setup,
    actions,
    snapshots,
    events: events.sort((a, b) => a.t - b.t),
    stepH: SNAPSHOT_H,
    durationH: DURATION_H,
    og: recipe.og,
    expectedFG,
    sugar0: S0,
  }
}

function suck(
  flow: number,
  s: MutableState,
  setup: Setup,
  t: number,
  emit: (e: SimEvent, key?: string) => void,
  cap: number,
) {
  s.reserve += flow
  if (s.reserve >= 0) return
  s.reserve = 0
  s.airlockDry = true
  const water = setup.airlockFill === 'water'
  if (water) s.W += s.closure === 'blowoff' ? 60 : 20
  void cap
  emit({
    t,
    kind: 'incident',
    severity: 'warn',
    title: 'Suck-back!',
    notice: `The ${s.closure === 'blowoff' ? 'blow-off tube' : 'airlock'} liquid got pulled into the beer.`,
    reality: `The beer cooled and stopped making gas, so the gas in the headspace shrank and pulled liquid backwards. ${
      water ? 'It was tap water, so a few wild microbes went in with it.' : 'It was sanitizer, so no harm done.'
    } The airlock is now empty and air can get in until you refill it.`,
  })
}

function applyAction(
  a: Action,
  s: MutableState,
  setup: Setup,
  emit: (e: SimEvent, key?: string) => void,
  foam: number,
) {
  const base = { t: a.t, kind: 'action' as const, severity: 'info' as const }
  switch (a.type) {
    case 'move': {
      s.locationId = a.locationId
      const loc = LOCATIONS[a.locationId]
      emit({ ...base, title: `Moved to: ${loc.name}`, notice: loc.blurb, reality: 'The beer will drift toward the new temperature over several hours. A big jug of liquid changes temperature slowly.' })
      break
    }
    case 'nutrient': {
      s.N += 40
      const fizzy = s.Cd > co2SolubilityGL(s.T) * 0.95
      if (fizzy) s.krausen += 3.5 * foam + 1
      emit({
        ...base,
        title: 'Added yeast nutrient',
        notice: fizzy ? 'Whoosh: a sudden foam-up as the powder hit the beer.' : 'Powder dissolves.',
        reality: `About +40 mg/L of nitrogen (FAN) for the yeast to build healthy cells. ${
          fizzy ? 'The beer was full of dissolved CO₂, and the powder gave it millions of spots to form bubbles. Add nutrient early, or dissolve it in a little water first.' : ''
        }`,
      })
      break
    }
    case 'rouse': {
      const back = s.Xs * 0.6
      s.X += back
      s.Xs -= back
      s.krausen += 0.8
      emit({
        ...base,
        title: 'Swirled the jug',
        notice: 'A cloud of yeast lifts off the bottom. A burst of bubbles.',
        reality: `About ${back.toFixed(0)} million cells/mL went back into suspension, and the swirl knocked loose some dissolved CO₂.`,
      })
      break
    }
    case 'closure': {
      s.closure = a.closure
      s.clogged = false
      s.P = 0
      s.airlockDry = false
      s.reserve = a.closure === 'blowoff' ? PHYS.blowoffReserveML : PHYS.airlockReserveML
      emit({
        ...base,
        title: a.closure === 'blowoff' ? 'Swapped to a blow-off tube' : 'Swapped back to the airlock',
        notice: a.closure === 'blowoff' ? 'A wide tube runs from the stopper into a jar of sanitizer.' : 'S-airlock back in the stopper.',
        reality: a.closure === 'blowoff' ? 'Foam can now escape without clogging anything. Swap back once the foam has fallen.' : 'Fine once the foam has dropped.',
      })
      break
    }
    case 'service': {
      const wasOut = s.stopperOut
      s.stopperOut = false
      s.airlockDry = false
      s.clogged = false
      s.P = 0
      s.reserve = s.closure === 'blowoff' ? PHYS.blowoffReserveML : PHYS.airlockReserveML
      emit({
        ...base,
        title: wasOut ? 'Cleaned up and reseated the stopper' : 'Refilled the airlock',
        notice: 'Sealed again.',
        reality: 'Air and microbes can no longer get in. Anything that got in while it was open is still in there.',
      })
      break
    }
    case 'sample': {
      if (a.instrument === 'hydrometer') {
        s.V -= PHYS.hydrometerSampleL
        s.W += setup.sanitation === 'quick' ? 3 : 0
      } else s.V -= 0.002
      emit({
        ...base,
        title: a.instrument === 'hydrometer' ? 'Took a hydrometer reading' : 'Took a refractometer reading',
        notice: a.instrument === 'hydrometer' ? 'Pulled about 100 mL into a test tube.' : 'A couple of drops on the glass.',
        reality:
          a.instrument === 'hydrometer'
            ? 'Accurate, but in a 1-gallon batch every sample costs you most of a glass of beer.'
            : 'Tiny sample, but once alcohol is present the raw reading needs a correction formula, and that adds error.',
      })
      break
    }
  }
}

function classify(
  s: MutableState,
  rate: number,
  S0: number,
  attenuation: number,
  expectedFG: number,
  og: number,
  prev: Phase,
): Phase {
  const expectedAtten = ((og - expectedFG) / (og - 1)) * 100
  const early = prev === 'lag' || prev === 'growth'
  if (prev === 'lag' && smoothstep(s.lag) < 0.5 && s.S > 0.95 * S0) return 'lag'
  if (s.locationId === 'fridge' && rate < 0.3) return 'crashing'
  // hysteresis: harder to enter "active" than to stay in it
  if (rate > 0.35 || (prev === 'active' && rate > 0.25)) return 'active'
  if (early && s.S > 0.85 * S0) return 'growth'
  if (rate > 0.06 || (prev === 'slowing' && rate > 0.04)) return prev === 'stuck' && rate < 0.12 ? 'stuck' : 'slowing'
  if (s.S > 8 && attenuation < expectedAtten - 8) return 'stuck'
  return 'conditioning'
}

/** Deterministic pseudo-random number in [0, 1) from a seed and a channel. */
export function hash01(seed: number, channel: number): number {
  let h = (seed * 374761393 + channel * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function snapshotAt(tl: Timeline, t: number): Snapshot {
  const i = clamp(Math.round(t / tl.stepH), 0, tl.snapshots.length - 1)
  return tl.snapshots[i]
}

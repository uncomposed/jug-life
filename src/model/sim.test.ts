import { describe, expect, it } from 'vitest'
import { defaultSetup, runTimeline, snapshotAt, type Setup } from './sim'
import { platoToSG, sgToPlato, terrillFG } from './physics'
import { readSample, readStrip } from './sensors'

const day = (d: number) => d * 24
const has = (tl: ReturnType<typeof runTimeline>, title: string) => tl.events.some((e) => e.title.includes(title))

describe('conversions', () => {
  it('round-trips gravity and Plato', () => {
    expect(platoToSG(sgToPlato(1.05))).toBeCloseTo(1.05, 4)
    expect(sgToPlato(1.04)).toBeCloseTo(10, 0)
  })
  it('Terrill gives a plausible final gravity for a fermented beer', () => {
    const fg = terrillFG(sgToPlato(1.05), 6.5)
    expect(fg).toBeGreaterThan(1.005)
    expect(fg).toBeLessThan(1.02)
  })
})

describe('default sorghum batch', () => {
  const tl = runTimeline(defaultSetup(), [])
  it('finishes near the expected final gravity in two weeks', () => {
    const end = snapshotAt(tl, day(14))
    expect(Math.abs(end.sg - tl.expectedFG)).toBeLessThan(0.002)
    expect(end.abv).toBeGreaterThan(4)
    expect(end.abv).toBeLessThan(5.5)
  })
  it('conserves mass: alcohol tracks sugar eaten', () => {
    const end = snapshotAt(tl, day(14))
    expect(end.ethanol).toBeCloseTo(0.47 * (tl.sugar0 - end.sugar), 1)
  })
  it('shows a lag before visible bubbling', () => {
    expect(snapshotAt(tl, 6).bubbleRate).toBe(0)
    expect(snapshotAt(tl, day(1)).bubbleRate).toBeGreaterThan(0.05)
  })
  it('self-heats only about a degree in a gallon', () => {
    const peak = Math.max(...tl.snapshots.map((s) => s.heatW)) / 0.75
    expect(peak).toBeGreaterThan(0.4)
    expect(peak).toBeLessThan(2)
  })
  it('has no mishaps when everything is done right', () => {
    expect(tl.events.filter((e) => e.kind === 'incident')).toEqual([])
  })
  it('makes roughly 30–50 thousand bubbles', () => {
    const b = snapshotAt(tl, day(21)).bubbles
    expect(b).toBeGreaterThan(25000)
    expect(b).toBeLessThan(55000)
  })
})

describe('mishaps', () => {
  const base = defaultSetup()
  it('a brim-full barley jug clogs the airlock and pops the stopper', () => {
    const tl = runTimeline({ ...base, recipeId: 'barley', volumeL: 3.8 }, [])
    expect(has(tl, 'clogged')).toBe(true)
    expect(has(tl, 'stopper popped')).toBe(true)
  })
  it('a blow-off tube prevents the pop', () => {
    const tl = runTimeline({ ...base, recipeId: 'barley', volumeL: 3.8, closure: 'blowoff' }, [])
    expect(has(tl, 'stopper popped')).toBe(false)
    expect(has(tl, 'blow-off tube')).toBe(true)
  })
  it('a cold crash sucks back the airlock; tap water lets far more microbes in than sanitizer', () => {
    const crash = [{ t: day(10), type: 'move' as const, locationId: 'fridge' as const }]
    const san = runTimeline(base, crash)
    const water = runTimeline({ ...base, airlockFill: 'water' }, crash)
    expect(has(san, 'Suck-back')).toBe(true)
    expect(snapshotAt(san, day(11)).wild).toBeLessThan(5)
    expect(snapshotAt(water, day(11)).wild).toBeGreaterThan(15)
  })
  it('low-nitrogen wort in a cold garage gets stuck, and warming plus nutrient rescues it', () => {
    const cold: Setup = { ...base, recipeId: 'sorghum-rice', locationId: 'garage' }
    const stuck = runTimeline(cold, [])
    const rescued = runTimeline(cold, [
      { t: day(4), type: 'move', locationId: 'closet' },
      { t: day(4), type: 'nutrient' },
      { t: day(5), type: 'rouse' },
    ])
    expect(snapshotAt(stuck, day(21)).sg - stuck.expectedFG).toBeGreaterThan(0.01)
    expect(snapshotAt(rescued, day(21)).sg).toBeLessThan(snapshotAt(stuck, day(21)).sg - 0.008)
  })
  it('adding nutrient to fizzy beer foams up', () => {
    const tl = runTimeline(base, [{ t: day(1.5), type: 'nutrient' }])
    expect(snapshotAt(tl, day(1.5) + 0.25).krausenCm).toBeGreaterThan(snapshotAt(runTimeline(base, []), day(1.5) + 0.25).krausenCm + 1)
  })
})

describe('time travel', () => {
  it('is deterministic', () => {
    const a = runTimeline(defaultSetup(), [{ t: 50, type: 'rouse' }])
    const b = runTimeline(defaultSetup(), [{ t: 50, type: 'rouse' }])
    expect(a.snapshots).toEqual(b.snapshots)
  })
  it('an action never changes the past', () => {
    const a = runTimeline(defaultSetup(), [])
    const b = runTimeline(defaultSetup(), [{ t: 60, type: 'move', locationId: 'fridge-top' }])
    expect(b.snapshots.slice(0, 60 / a.stepH)).toEqual(a.snapshots.slice(0, 60 / a.stepH))
    expect(snapshotAt(b, 72).beerC).toBeGreaterThan(snapshotAt(a, 72).beerC + 2)
  })
})

describe('sensors', () => {
  const tl = runTimeline(defaultSetup(), [{ t: 48, type: 'sample', instrument: 'hydrometer' }, { t: 49, type: 'sample', instrument: 'refractometer' }])
  it('hydrometer is close to the truth', () => {
    const r = readSample(tl, 48, 'hydrometer')
    expect(Math.abs(r.sg - snapshotAt(tl, 48).sg)).toBeLessThan(0.002)
  })
  it('refractometer is roughly right but looser', () => {
    const r = readSample(tl, 49, 'refractometer')
    expect(Math.abs(r.sg - snapshotAt(tl, 49).sg)).toBeLessThan(0.006)
  })
  it('strip reads in 2 °C steps', () => {
    const r = readStrip(tl, snapshotAt(tl, 30))
    expect(r.lit.every((v) => v % 2 === 0)).toBe(true)
  })
  it('a hydrometer sample costs 100 mL', () => {
    expect(snapshotAt(tl, 47).volumeL - snapshotAt(tl, 48.25).volumeL).toBeCloseTo(0.1, 2)
  })
})

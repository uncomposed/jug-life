import { LOCATIONS } from '../model/params'
import { PITCH_HOUR, type Phase, type Snapshot } from '../model/sim'
import type { SensorId } from '../model/sensors'

export function clock(t: number): { day: number; time: string; label: string } {
  const abs = PITCH_HOUR + t
  const day = Math.floor(abs / 24)
  const h = Math.floor(abs % 24)
  const m = Math.floor(((abs % 24) - h) * 60 / 15) * 15
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { day, time, label: `Day ${day}, ${time}` }
}

export function since(t: number): string {
  const d = Math.floor(t / 24)
  const h = Math.floor(t % 24)
  return d > 0 ? `${d} d ${h} h after pitching` : `${h} h after pitching`
}

export const PHASE_LABEL: Record<Phase, string> = {
  lag: 'Lag',
  growth: 'Growth',
  active: 'Active',
  slowing: 'Slowing',
  conditioning: 'Conditioning',
  stuck: 'Stuck?',
  crashing: 'Cold crash',
}

export interface Alert {
  id: string
  title: string
  detail: string
}

/** Things a brewer could notice from outside, given the instruments they have. */
export function visibleAlerts(s: Snapshot, sensors: Set<SensorId>): Alert[] {
  const a: Alert[] = []
  if (s.stopperOut) a.push({ id: 'pop', title: 'Stopper is out', detail: 'Beer is open to the air. Clean up and reseat it.' })
  if (s.airlockDry && !s.stopperOut) a.push({ id: 'dry', title: 'Airlock is empty', detail: 'Air can get in. Refill it.' })
  if (s.clogged) a.push({ id: 'clog', title: 'Foam in the airlock', detail: 'Pressure is building. Swap to a blow-off tube.' })
  else if (s.closure === 'airlock' && !s.stopperOut && s.krausenCm > s.headspaceCm - 2 && s.krausenCm > 0.5)
    a.push({ id: 'foam', title: 'Foam near the stopper', detail: s.headspaceCm - s.krausenCm > 0 ? `${(s.headspaceCm - s.krausenCm).toFixed(1)} cm to go. Blow-off risk.` : 'Foam is up in the neck, pushing into the airlock.' })
  const hasTemp = sensors.has('strip') || sensors.has('probe')
  if (hasTemp && s.beerC > 24) a.push({ id: 'hot', title: 'Running warm', detail: 'Above 24 °C makes harsh flavors. Find a cooler spot.' })
  if (hasTemp && s.beerC < 15 && s.phase !== 'crashing') a.push({ id: 'cold', title: 'Running cold', detail: 'Below 15 °C ale yeast slow down or stall.' })
  if (s.wild > 1e7) a.push({ id: 'film', title: 'Film on the beer', detail: 'A pellicle: wild microbes have taken hold.' })
  return a
}

/** Extra warnings only the curtain view knows about. */
export function hiddenAlerts(s: Snapshot): Alert[] {
  const a: Alert[] = []
  if (s.pressureKPa > 0.5) a.push({ id: 'p', title: `Pressure ${s.pressureKPa.toFixed(1)} kPa`, detail: 'Trapped gas is pushing on the stopper.' })
  if (s.fan < 2 && s.sugar > 10 && s.phase !== 'lag') a.push({ id: 'fan', title: 'Yeast out of nitrogen', detail: 'They slow down without it. Nutrient would help.' })
  if (s.wild > 0.5 && s.wild <= 1e7) a.push({ id: 'wild', title: `${fmtCount(s.wild)} wild microbes/mL`, detail: 'Invisible for now. They grow once the yeast settle.' })
  return a
}

export function eyeball(s: Snapshot): { foam: string; clarity: string; airlock: string } {
  const foam = s.krausenCm < 0.3 ? 'No foam' : s.krausenCm < 1.5 ? 'Thin patchy foam' : `Foam cap about ${s.krausenCm.toFixed(0)} cm thick`
  const clarity = s.yeast > 40 ? 'Cloudy, churning' : s.yeast > 12 ? 'Hazy' : s.yeast > 3 ? 'Clearing from the top' : 'Clear, yeast layer on the bottom'
  let airlock = 'Still'
  if (s.stopperOut) airlock = 'Stopper is out!'
  else if (s.airlockDry) airlock = 'Empty'
  else if (s.clogged) airlock = 'Clogged with foam'
  else if (s.bubbleRate > 0.25) airlock = 'Bubbling steadily'
  else if (s.bubbleRate > 0.04) airlock = 'Bubbling now and then'
  else if (s.bubbleRate > 0.003) airlock = 'An occasional bubble'
  return { foam, clarity, airlock }
}

export function fmtCount(n: number): string {
  if (n < 1000) return n.toFixed(0)
  if (n < 1e6) return `${(n / 1000).toFixed(0)} thousand`
  return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} million`
}

export function locName(id: Snapshot['locationId']): string {
  return LOCATIONS[id].name
}

import { useState } from 'react'
import { LOCATIONS, type LocationId } from '../model/params'
import type { Snapshot, Timeline } from '../model/sim'
import { readBubbler, readProbe, readStrip, type SampleReading, type SensorId } from '../model/sensors'
import type { NewAction } from './Actions'
import { Term } from './Info'
import { eyeball } from './derive'

export type Part = 'airlock' | 'stopper' | 'bubbler' | 'strip' | 'probe' | 'sample' | 'beer'

export const PART_TITLE: Record<Part, string> = {
  airlock: 'Top of the stopper',
  stopper: 'Rubber stopper',
  bubbler: 'Bubble counter (FQ-103)',
  strip: 'Strip thermometer (TI-101)',
  probe: 'Probe thermometer (TT-102)',
  sample: 'Gravity reading (DI-105)',
  beer: 'The beer',
}

interface Props {
  part: Part
  tl: Timeline
  snap: Snapshot
  sensors: Set<SensorId>
  lastSample?: SampleReading
  onAct: (a: NewAction) => void
  onToggleSensor: (id: SensorId) => void
  onTaste: () => void
  view: 'sensors' | 'curtain'
}

function SensorSwitch({ id, on, onToggle, children }: { id: SensorId; on: boolean; onToggle: (id: SensorId) => void; children: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={on} onChange={() => onToggle(id)} />
      <span className="switch-track" aria-hidden="true" />
      <span>
        {children} <strong>{on ? 'on' : 'off'}</strong>
      </span>
    </label>
  )
}

const stopperNote = 'Reseat the stopper first.'

/** Pick what sits on top of the stopper. Shows both options and marks the one in use. */
export function ClosurePicker({ snap, onAct }: { snap: Snapshot; onAct: (a: NewAction) => void }) {
  const current = snap.closure
  const opts = [
    { v: 'airlock' as const, name: 'S-airlock', note: 'Small and tidy. Foam can clog it, and cooling can suck its liquid back.' },
    { v: 'blowoff' as const, name: 'Blow-off tube', note: 'Wide hose into a jar of sanitizer. Foam just flows out, so it never clogs.' },
  ]
  return (
    <div className="pick" role="radiogroup" aria-label="What is on top of the stopper">
      {opts.map((o) => {
        const on = current === o.v
        return (
          <button
            key={o.v}
            role="radio"
            aria-checked={on}
            disabled={snap.stopperOut && !on}
            onClick={() => !on && onAct({ type: 'closure', closure: o.v })}
          >
            <span className="pick-top">
              <strong>{o.name}</strong>
              {on && <span className="in-use">✓ In use</span>}
            </span>
            <small>{o.note}</small>
          </button>
        )
      })}
    </div>
  )
}

export function PartMenu({ part, tl, snap, sensors, lastSample, onAct, onToggleSensor, onTaste, view }: Props) {
  const [loc, setLoc] = useState<LocationId>(snap.locationId === 'closet' ? 'kitchen' : 'closet')
  const out = snap.stopperOut

  if (part === 'airlock') {
    const blowoff = snap.closure === 'blowoff'
    const state = out
      ? 'Nothing is attached: the stopper has popped out.'
      : blowoff
        ? 'A blow-off tube runs into a jar of sanitizer.'
        : snap.clogged
          ? 'S-airlock, clogged with foam. Pressure is building.'
          : snap.airlockDry
            ? 'S-airlock, but it is dry. Air can get in.'
            : `S-airlock, filled with ${tl.setup.airlockFill === 'water' ? 'tap water' : 'sanitizer'}.`
    return (
      <>
        <p className="pop-state">{state}</p>
        <ClosurePicker snap={snap} onAct={onAct} />
        {out && <p className="small muted">{stopperNote}</p>}
        {!out && (snap.clogged || snap.airlockDry) && (
          <button className="btn btn-attn wide" onClick={() => onAct({ type: 'service' })}>
            {snap.clogged ? 'Clean out and refill the airlock' : 'Refill the airlock'}
          </button>
        )}
        {!blowoff && <SensorSwitch id="bubbler" on={sensors.has('bubbler')} onToggle={onToggleSensor}>Bubble counter</SensorSwitch>}
        <p className="pop-learn">
          Learn: <Term id="airlock">S-airlock</Term> · <Term id="blowoff">blow-off tube</Term> · <Term id="suckback">suck-back</Term>
        </p>
      </>
    )
  }

  if (part === 'stopper') {
    return (
      <>
        <p className="pop-state">
          {out
            ? 'The stopper has popped out. The beer is open to the air.'
            : `Seated, ${tl.setup.stopperFit === 'snug' ? 'a snug fit' : 'a bit loose'}.${snap.pressureKPa > 0.1 ? ` Pressure inside: ${snap.pressureKPa.toFixed(1)} kPa.` : ''}`}
        </p>
        {out ? (
          <button className="btn btn-attn wide" onClick={() => onAct({ type: 'service' })}>
            Clean up and reseat it
          </button>
        ) : (
          <p className="small muted">Nothing to do. If foam reaches it, pressure can push it out.</p>
        )}
        <p className="pop-learn">
          Learn: <Term id="headspace">headspace</Term> · <Term id="krausen">foam</Term> · <Term id="oxidation">oxidation</Term>
        </p>
      </>
    )
  }

  if (part === 'bubbler') {
    return (
      <>
        <p className="pop-state">
          {sensors.has('bubbler') ? `Reading ${readBubbler(tl, snap).toFixed(1)} bubbles a minute.` : 'Clips onto the airlock and counts bubbles.'}
        </p>
        <SensorSwitch id="bubbler" on={sensors.has('bubbler')} onToggle={onToggleSensor}>Bubble counter</SensorSwitch>
        <p className="small muted">Bubbles show activity, not how finished the beer is. Only gravity tells you that.</p>
        <p className="pop-learn">
          Learn: <Term id="co2">CO₂</Term> · <Term id="gravity">gravity</Term>
        </p>
      </>
    )
  }

  if (part === 'strip' || part === 'probe') {
    const id: SensorId = part
    return (
      <>
        <p className="pop-state">
          {sensors.has(id)
            ? `Reading ${part === 'strip' ? readStrip(tl, snap).text : `${readProbe(tl, snap).toFixed(1)} °C`}.`
            : part === 'strip'
              ? 'A sticker that shows the glass temperature.'
              : 'A probe taped to the side, read to a tenth of a degree.'}
        </p>
        <SensorSwitch id={id} on={sensors.has(id)} onToggle={onToggleSensor}>{part === 'strip' ? 'Strip thermometer' : 'Probe'}</SensorSwitch>
        <p className="pop-learn">
          Learn: <Term id="strip">strip thermometer</Term> · <Term id="heat">self-heating</Term>
        </p>
      </>
    )
  }

  if (part === 'sample') {
    return (
      <>
        <p className="pop-state">{lastSample ? `Last reading ${lastSample.sg.toFixed(3)}.` : 'No reading yet. This is the only real way to know how far along it is.'}</p>
        <div className="pop-actions">
          <button className="btn" disabled={out} onClick={() => onAct({ type: 'sample', instrument: 'hydrometer' })}>
            Hydrometer
            <small>{out ? stopperNote : 'Accurate. Uses 100 mL.'}</small>
          </button>
          <button className="btn" disabled={out} onClick={() => onAct({ type: 'sample', instrument: 'refractometer' })}>
            Refractometer
            <small>{out ? stopperNote : 'Two drops. Rougher.'}</small>
          </button>
        </div>
        <p className="pop-learn">
          Learn: <Term id="gravity">gravity</Term> · <Term id="hydrometer">hydrometer</Term> · <Term id="refractometer">refractometer</Term>
        </p>
      </>
    )
  }

  // beer
  return (
    <>
      <p className="pop-state">
        {view === 'curtain'
          ? `${snap.yeast.toFixed(0)} million yeast per mL floating, ${snap.sugar.toFixed(0)} g/L sugar left, ${snap.beerC.toFixed(1)} °C.`
          : `It looks ${eyeball(snap).clarity.toLowerCase()}. ${eyeball(snap).foam}.`}
      </p>
      <div className="pop-actions">
        <button className="btn" onClick={() => onAct({ type: 'nutrient' })}>
          Add yeast nutrient
          <small>Food for growing yeast</small>
        </button>
        <button className="btn" onClick={() => onAct({ type: 'rouse' })}>
          Swirl the jug
          <small>Lifts settled yeast</small>
        </button>
      </div>
      <div className="row">
        <label className="sr-only" htmlFor="pop-move">
          Move the jug to
        </label>
        <select id="pop-move" value={loc} onChange={(e) => setLoc(e.target.value as LocationId)}>
          {Object.values(LOCATIONS).map((l) => (
            <option key={l.id} value={l.id} disabled={l.id === snap.locationId}>
              {l.name}
            </option>
          ))}
        </select>
        <button className="btn" disabled={loc === snap.locationId} onClick={() => onAct({ type: 'move', locationId: loc })}>
          Move
        </button>
      </div>
      <button className="btn btn-primary wide" onClick={onTaste}>
        Taste it now
      </button>
      <p className="pop-learn">
        Learn: <Term id="yeast">yeast</Term> · <Term id="fan">nitrogen</Term> · <Term id="settled">settling</Term>
      </p>
    </>
  )
}

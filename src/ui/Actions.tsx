import { useState } from 'react'
import { LOCATIONS, type LocationId } from '../model/params'
import type { Action, Snapshot } from '../model/sim'

type NewAction = Action extends infer A ? (A extends Action ? Omit<A, 't'> : never) : never

interface Props {
  snap: Snapshot
  onAct: (a: NewAction) => void
  onTaste: () => void
  futureCount: number
}

export function Actions({ snap, onAct, onTaste, futureCount }: Props) {
  const [loc, setLoc] = useState<LocationId>(snap.locationId === 'closet' ? 'kitchen' : 'closet')
  const sealed = !snap.stopperOut && !snap.airlockDry
  return (
    <div className="actions">
      {futureCount > 0 && (
        <p className="warnline">
          You are in the past. Doing something here erases {futureCount} later action{futureCount > 1 ? 's' : ''} and rewrites the future.
        </p>
      )}
      <section>
        <h3>Temperature</h3>
        <div className="row">
          <label className="sr-only" htmlFor="move-to">
            Move the jug to
          </label>
          <select id="move-to" value={loc} onChange={(e) => setLoc(e.target.value as LocationId)}>
            {Object.values(LOCATIONS).map((l) => (
              <option key={l.id} value={l.id} disabled={l.id === snap.locationId}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="btn" disabled={loc === snap.locationId} onClick={() => onAct({ type: 'move', locationId: loc })}>
            Move it
          </button>
        </div>
        <p className="hint">{LOCATIONS[loc].blurb}</p>
      </section>
      <section>
        <h3>Yeast</h3>
        <div className="btn-grid">
          <button className="btn" onClick={() => onAct({ type: 'nutrient' })}>
            Add yeast nutrient
            <small>Extra nitrogen. Sorghum and rice wort are short on it</small>
          </button>
          <button className="btn" onClick={() => onAct({ type: 'rouse' })}>
            Swirl the jug
            <small>Lifts settled yeast back up</small>
          </button>
        </div>
      </section>
      <section>
        <h3>Hardware</h3>
        <div className="btn-grid">
          {snap.closure === 'airlock' ? (
            <button className="btn" disabled={snap.stopperOut} onClick={() => onAct({ type: 'closure', closure: 'blowoff' })}>
              Fit a blow-off tube
              <small>{snap.stopperOut ? 'Reseat the stopper first' : 'Lets foam escape safely'}</small>
            </button>
          ) : (
            <button className="btn" disabled={snap.stopperOut} onClick={() => onAct({ type: 'closure', closure: 'airlock' })}>
              Back to the airlock
              <small>{snap.stopperOut ? 'Reseat the stopper first' : 'Once the foam has dropped'}</small>
            </button>
          )}
          <button className={`btn ${!sealed ? 'btn-attn' : ''}`} disabled={sealed} onClick={() => onAct({ type: 'service' })}>
            {snap.stopperOut ? 'Clean up, reseat stopper' : 'Refill the airlock'}
            <small>{sealed ? 'Nothing to fix right now' : 'Seal it back up'}</small>
          </button>
        </div>
      </section>
      <section>
        <h3>Measure</h3>
        <div className="btn-grid">
          <button className="btn" disabled={snap.stopperOut} onClick={() => onAct({ type: 'sample', instrument: 'hydrometer' })}>
            Hydrometer sample
            <small>{snap.stopperOut ? 'Reseat the stopper first' : 'Accurate. Costs 100 mL of beer.'}</small>
          </button>
          <button className="btn" disabled={snap.stopperOut} onClick={() => onAct({ type: 'sample', instrument: 'refractometer' })}>
            Refractometer reading
            <small>{snap.stopperOut ? 'Reseat the stopper first' : 'Two drops. Less accurate once there’s alcohol.'}</small>
          </button>
        </div>
      </section>
      <section>
        <h3>Finish</h3>
        <button className="btn btn-primary" onClick={onTaste}>
          Taste it now
          <small>See how it would turn out if you bottled here</small>
        </button>
      </section>
    </div>
  )
}

export type { NewAction }

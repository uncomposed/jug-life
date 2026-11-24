import type { Snapshot, Timeline } from '../model/sim'
import { readBubbler, readProbe, readStrip, SENSORS, type SampleReading, type SensorId } from '../model/sensors'
import { clock, eyeball, fmtCount, locName } from './derive'

function Card({ tag, label, value, sub, dashed }: { tag?: string; label: string; value: string; sub?: string; dashed?: boolean }) {
  return (
    <div className={`card ${dashed ? 'card-manual' : ''}`}>
      <div className="card-top">
        <span className="card-label">{label}</span>
        {tag && <span className="card-tag">{tag}</span>}
      </div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}

function Gauge({ label, value, max, text, color, dash }: { label: string; value: number; max: number; text: string; color: string; dash?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span>{label}</span>
        <span className="mono">{text}</span>
      </div>
      <div className="gauge-track">
        <div className={`gauge-fill ${dash ? 'striped' : ''}`} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function SensorReadouts({ tl, snap, sensors, lastSample }: { tl: Timeline; snap: Snapshot; sensors: Set<SensorId>; lastSample?: SampleReading }) {
  const eye = eyeball(snap)
  const tag = (id: SensorId) => SENSORS.find((s) => s.id === id)!.tag
  return (
    <div className="cards">
      {sensors.has('strip') && <Card tag={tag('strip')} label="Strip thermometer" value={readStrip(tl, snap).text} sub="Reads the glass" />}
      {sensors.has('probe') && <Card tag={tag('probe')} label="Probe" value={`${readProbe(tl, snap).toFixed(1)} °C`} sub="Taped to the side" />}
      {sensors.has('bubbler') && (
        <Card tag={tag('bubbler')} label="Bubble counter" value={`${readBubbler(tl, snap).toFixed(1)} /min`} sub={snap.closure === 'blowoff' ? 'Not on the blow-off tube' : 'Last 15 minutes'} />
      )}
      <Card
        tag="DI-105"
        label="Gravity"
        dashed
        value={lastSample ? lastSample.sg.toFixed(3) : '—'}
        sub={lastSample ? `${lastSample.instrument === 'hydrometer' ? 'Hydrometer' : 'Refractometer'}, ${clock(lastSample.t).label}` : 'Take a sample under Do something'}
      />
      <Card label="Your eyes: airlock" value={eye.airlock} />
      <Card label="Your eyes: foam" value={eye.foam} />
      <Card label="Your eyes: beer" value={eye.clarity} />
      <Card label="Where it is" value={locName(snap.locationId)} sub={`${snap.volumeL.toFixed(2)} L in the jug`} />
    </div>
  )
}

export function TruthReadouts({ tl, snap }: { tl: Timeline; snap: Snapshot }) {
  const fermentedPct = ((tl.sugar0 - snap.sugar) / tl.sugar0) * 100
  return (
    <div className="truth">
      <div className="gauges">
        <Gauge label="Sugar left" value={snap.sugar} max={tl.sugar0} text={`${snap.sugar.toFixed(0)} of ${tl.sugar0.toFixed(0)} g/L`} color="var(--c-sugar)" />
        <Gauge label="Alcohol" value={snap.abv} max={6} text={`${snap.abv.toFixed(1)} % ABV`} color="var(--c-alcohol)" dash />
        <Gauge label="Yeast floating" value={snap.yeast} max={100} text={`${snap.yeast.toFixed(0)} M cells/mL`} color="var(--c-yeast)" />
        <Gauge label="Yeast nitrogen (FAN)" value={snap.fan} max={160} text={`${snap.fan.toFixed(0)} mg/L`} color="var(--ink-soft)" />
      </div>
      <div className="cards">
        <Card label="Beer vs room" value={`${snap.beerC.toFixed(1)} °C`} sub={`Room ${snap.roomC.toFixed(1)} °C · yeast heat ${snap.heatW.toFixed(2)} W`} />
        <Card label="Fermenting now" value={`${snap.rate.toFixed(2)} g/L/h`} sub={`${fermentedPct.toFixed(0)}% of the eatable sugar gone`} />
        <Card label="True gravity" value={snap.sg.toFixed(3)} sub={`Target ${tl.expectedFG.toFixed(3)} · ${Math.max(0, Math.min(100, ((tl.og - snap.sg) / (tl.og - tl.expectedFG)) * 100)).toFixed(0)}% of the way there`} />
        <Card label="CO₂" value={`${snap.co2OutL.toFixed(0)} L out`} sub={`${fmtCount(snap.bubbles)} bubbles · ${snap.co2Diss.toFixed(1)} g/L dissolved`} />
        <Card label="Yeast settled" value={`${(snap.settled + snap.dead).toFixed(0)} M/mL`} sub={`${snap.dead.toFixed(0)} of those are dead`} />
        <Card label="Wild microbes" value={snap.wild < 0.5 ? 'None' : `${fmtCount(snap.wild)}/mL`} sub={snap.acid > 0.05 ? `${snap.acid.toFixed(2)} g/L lactic acid` : 'No sourness'} />
        <Card label="Headspace" value={`${snap.headspaceCm.toFixed(1)} cm`} sub={`Foam ${snap.krausenCm.toFixed(1)} cm${snap.pressureKPa > 0.1 ? ` · ${snap.pressureKPa.toFixed(1)} kPa` : ''}`} />
        <Card label="Flavor so far" value={snap.fusels > 1 ? 'Harsh' : snap.esters > 1.3 ? 'Fruity' : 'Clean'} sub={`esters ${snap.esters.toFixed(2)} · fusels ${snap.fusels.toFixed(2)}`} />
      </div>
    </div>
  )
}

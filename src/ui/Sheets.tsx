import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LOCATIONS, PARAM_NOTES, RECIPES, YEASTS, type LocationId, type RecipeId, type YeastId } from '../model/params'
import { headspaceCm, pitchCellsPerML, type PitchAmount, type Setup, type Timeline } from '../model/sim'
import { SENSORS, type SensorId } from '../model/sensors'
import { sgToPlato } from '../model/physics'
import { taste } from '../model/tasting'
import { clock } from './derive'
import { Linkify, Term } from './Info'

const NOTE_TERM: Record<string, string> = {
  Sweet: 'body',
  Body: 'body',
  'Sorghum tang': 'tang',
  Fruity: 'esters',
  Clean: 'esters',
  Hot: 'fusels',
  Warming: 'fusels',
  Sour: 'wild',
  Tart: 'wild',
  Funky: 'wild',
  Stale: 'oxidation',
  Cloudy: 'conditioning',
}

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // a pop-up on top gets Escape first
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.popover') && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} ref={ref} tabIndex={-1}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

function Choice<T extends string | number>({ id, label, value, options, onChange, hint }: { id: string; label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; hint?: string }) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="seg" role="radiogroup">
        {options.map((o) => (
          <label key={String(o.v)} className={value === o.v ? 'on' : ''}>
            <input type="radio" name={id} id={`${id}-${o.v}`} checked={value === o.v} onChange={() => onChange(o.v)} />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  )
}

export function SetupSheet({ initial, onClose, onPitch }: { initial: Setup; onClose: () => void; onPitch: (s: Setup) => void }) {
  const [s, setS] = useState<Setup>(initial)
  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setS((p) => ({ ...p, [k]: v }))
  const recipe = RECIPES[s.recipeId]
  const cells = pitchCellsPerML(s)
  const rate = cells / sgToPlato(recipe.og)
  const hs = headspaceCm(s.volumeL)
  return (
    <Sheet
      title="Brew day: new batch"
      onClose={onClose}
      footer={
        <button className="btn btn-primary wide" onClick={() => onPitch({ ...s, seed: Math.floor(Math.random() * 1e6) })}>
          Pitch the yeast
        </button>
      }
    >
      <p className="muted">Pick your recipe and setup, then pitch. You can change things during fermentation too.</p>
      <Choice<RecipeId>
        id="recipe"
        label="Recipe"
        value={s.recipeId}
        onChange={(v) => set('recipeId', v)}
        options={Object.values(RECIPES).map((r) => ({ v: r.id, label: r.name }))}
        hint={`${recipe.blurb} Starting gravity ${recipe.og.toFixed(3)}. ${recipe.glutenFree ? 'Gluten-free by ingredients.' : 'Contains gluten.'}`}
      />
      {!recipe.glutenFree && (
        <label className="check">
          <input type="checkbox" id="clarity" checked={s.clarityFerm} onChange={(e) => set('clarityFerm', e.target.checked)} />
          Add Clarity-Ferm (makes it “gluten-reduced”, which is not the same as gluten-free)
        </label>
      )}
      <Choice<YeastId> id="yeast" label="Yeast" value={s.yeastId} onChange={(v) => set('yeastId', v)} options={Object.values(YEASTS).map((y) => ({ v: y.id, label: y.name }))} hint={YEASTS[s.yeastId].blurb} />
      <Choice<PitchAmount>
        id="pitch"
        label="How much of the 11.5 g sachet"
        value={s.pitch}
        onChange={(v) => set('pitch', v)}
        options={[
          { v: 'quarter', label: 'A quarter' },
          { v: 'half', label: 'Half' },
          { v: 'full', label: 'The whole thing' },
        ]}
        hint={`${cells.toFixed(0)} million cells per mL, ${rate.toFixed(1)} per °Plato. The usual target is about 0.75, so a whole sachet in a gallon is a big overpitch.`}
      />
      <Choice<number>
        id="volume"
        label="How full"
        value={s.volumeL}
        onChange={(v) => set('volumeL', v)}
        options={[
          { v: 3.0, label: '3.0 L' },
          { v: 3.4, label: '3.4 L (shoulder)' },
          { v: 3.8, label: '3.8 L (brim)' },
        ]}
        hint={`Leaves ${hs.toFixed(1)} cm of headspace for foam.`}
      />
      <Choice<number>
        id="pitchtemp"
        label="Wort temperature when you pitch"
        value={s.pitchTempC}
        onChange={(v) => set('pitchTempC', v)}
        options={[
          { v: 18, label: '18 °C' },
          { v: 21, label: '21 °C' },
          { v: 26, label: '26 °C' },
          { v: 35, label: '35 °C (impatient)' },
        ]}
      />
      <fieldset className="choice">
        <legend>Where the jug lives</legend>
        <select id="location" value={s.locationId} onChange={(e) => set('locationId', e.target.value as LocationId)}>
          {Object.values(LOCATIONS)
            .filter((l) => l.id !== 'fridge')
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
        <p className="hint">{LOCATIONS[s.locationId].blurb}</p>
      </fieldset>
      <Choice id="closure" label="On top of the stopper" value={s.closure} onChange={(v) => set('closure', v)} options={[{ v: 'airlock', label: 'S-airlock' }, { v: 'blowoff', label: 'Blow-off tube' }]} />
      <Choice id="fill" label="Airlock filled with" value={s.airlockFill} onChange={(v) => set('airlockFill', v)} options={[{ v: 'sanitizer', label: 'Sanitizer or vodka' }, { v: 'water', label: 'Tap water' }]} />
      <Choice
        id="sanitation"
        label="Sanitizing"
        value={s.sanitation}
        onChange={(v) => set('sanitation', v)}
        options={[
          { v: 'thorough', label: 'Everything, properly' },
          { v: 'quick', label: 'A quick rinse' },
        ]}
        hint={s.sanitation === 'quick' ? 'Sometimes you get away with it. The dice are rolled when you pitch.' : undefined}
      />
      <Choice id="fit" label="Stopper fit" value={s.stopperFit} onChange={(v) => set('stopperFit', v)} options={[{ v: 'snug', label: 'Snug' }, { v: 'loose', label: 'A bit loose' }]} />
    </Sheet>
  )
}

export function SensorSheet({ sensors, onToggle, onClose }: { sensors: Set<SensorId>; onToggle: (id: SensorId) => void; onClose: () => void }) {
  return (
    <Sheet title="Sensors" onClose={onClose}>
      <p className="muted">His real jug has none of these yet. Try them here before buying anything. Each one changes what the sensor view can tell you.</p>
      <ul className="sensor-list">
        {SENSORS.map((s) => (
          <li key={s.id}>
            <label className={`check ${!s.fits ? 'disabled' : ''}`}>
              <input type="checkbox" id={`sensor-${s.id}`} checked={sensors.has(s.id)} disabled={!s.fits} onChange={() => onToggle(s.id)} />
              <span>
                <strong>{s.name}</strong> <span className="card-tag">{s.tag}</span> <span className="muted">{s.cost}</span>
                <br />
                <span className="small">{s.blurb}</span>
              </span>
            </label>
          </li>
        ))}
        <li>
          <p className="small">
            <strong>Hydrometer and refractometer</strong> are always available as manual samples under Do something. They are the only real way to know how far along it is.
          </p>
        </li>
      </ul>
    </Sheet>
  )
}

export function TastingSheet({ tl, t, onClose }: { tl: Timeline; t: number; onClose: () => void }) {
  const r = taste(tl, t)
  return (
    <Sheet title={`Tasting: ${clock(t).label}`} onClose={onClose}>
      <p className="verdict">{r.verdict}</p>
      <div className="cards">
        <div className="card">
          <div className="card-label">Alcohol</div>
          <div className="card-value">{r.abv.toFixed(1)} %</div>
        </div>
        <div className="card">
          <div className="card-label">Gravity</div>
          <div className="card-value">{r.fg.toFixed(3)}</div>
        </div>
      </div>
      <p className={`ready ${r.ready ? '' : 'not'}`}>
        <span aria-hidden="true">{r.ready ? '✓' : '▲'}</span> {r.readyText}
      </p>
      <ul className="notes">
        {r.notes.map((n) => (
          <li key={n.label} className={`note tone-${n.tone}`}>
            <strong>
              <span aria-hidden="true">{n.tone === 'bad' ? '▲ ' : n.tone === 'good' ? '✓ ' : '• '}</span>
              {NOTE_TERM[n.label] ? <Term id={NOTE_TERM[n.label]}>{n.label}</Term> : n.label}
            </strong>{' '}
            <Linkify text={n.text} />
          </li>
        ))}
      </ul>
      <p className="small muted">
        <Linkify text={r.gluten} />
      </p>
      <p className="small muted">Tap an underlined word to see what causes it and how to change it.</p>
    </Sheet>
  )
}

export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="About this simulator" onClose={onClose}>
      <p>
        <strong>Simulated, not connected to a real jug.</strong> It runs a small fermentation model: yeast grow on sugar and nitrogen, slow down as alcohol builds, give off heat and CO₂, and settle out. The equations are cut down from published beer models (Gee and Ramirez 1988, de Andrés-Toro 1998).
      </p>
      <p>
        <strong>Not validated yet.</strong> The constants were tuned by eye so the curves look like typical homebrew logs. The first real test is comparing it against an actual batch.
      </p>
      <h3>The numbers behind it</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>What</th>
              <th>Value</th>
              <th>How sure</th>
            </tr>
          </thead>
          <tbody>
            {PARAM_NOTES.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="mono">{p.value}</td>
                <td>
                  <span className={`conf conf-${p.confidence}`}>{p.confidence === 'sourced' ? 'sourced' : p.confidence === 'textbook' ? 'textbook' : 'estimate'}</span>
                  <div className="small muted">{p.note}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Reading the schematic</h3>
      <p className="small">
        Sensor tags follow the standard instrument naming (ISA-5.1): first letter is what is measured (T temperature, D density, F flow), the rest is what the device does (I indicates, T transmits, Q counts). A dashed circle is a reading you take by hand.
      </p>
    </Sheet>
  )
}

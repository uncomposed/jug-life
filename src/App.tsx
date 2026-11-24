import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RECIPES } from './model/params'
import { defaultSetup, runTimeline, type Action, type Setup } from './model/sim'
import { samplesUpTo, type SensorId } from './model/sensors'
import { Jug } from './ui/Jug'
import { TimeBar } from './ui/TimeBar'
import { Charts } from './ui/Charts'
import { SensorReadouts, TruthReadouts } from './ui/Readouts'
import { Actions, type NewAction } from './ui/Actions'
import { Log } from './ui/Log'
import { AboutSheet, SensorSheet, SetupSheet, TastingSheet } from './ui/Sheets'
import { hiddenAlerts, visibleAlerts } from './ui/derive'
import { Tour } from './ui/Tour'

type View = 'sensors' | 'curtain'
type Tab = 'charts' | 'actions' | 'log'
type SheetName = 'setup' | 'sensors' | 'taste' | 'about' | null

interface Saved {
  v: 1
  setup: Setup
  actions: Action[]
  t: number
  sensors: SensorId[]
  view: View
}

const KEY = 'jug-twin:v1'
const TOUR_KEY = 'jug-twin:toured'

function firstVisit(): boolean {
  try {
    return !localStorage.getItem(TOUR_KEY)
  } catch {
    return false
  }
}
const DEFAULT: Saved = {
  v: 1,
  setup: defaultSetup(),
  actions: [{ t: 26, type: 'sample', instrument: 'hydrometer' }],
  t: 40,
  sensors: ['strip', 'bubbler'],
  view: 'sensors',
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Saved
      if (s.v === 1 && s.setup && Array.isArray(s.actions)) return s
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return DEFAULT
}

export default function App() {
  const initial = useMemo(load, [])
  const [setup, setSetup] = useState<Setup>(initial.setup)
  const [actions, setActions] = useState<Action[]>(initial.actions)
  const [t, setT] = useState(initial.t)
  const [sensors, setSensors] = useState<Set<SensorId>>(new Set(initial.sensors))
  const [view, setView] = useState<View>(initial.view)
  const [tab, setTab] = useState<Tab>('charts')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(6)
  const [sheet, setSheet] = useState<SheetName>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [touring, setTouring] = useState(firstVisit)

  const tl = useMemo(() => runTimeline(setup, actions), [setup, actions])
  const idx = Math.min(tl.snapshots.length - 1, Math.round(t / tl.stepH))
  const snap = tl.snapshots[idx]
  const samples = samplesUpTo(tl, t)
  const lastSample = samples[samples.length - 1]
  const futureCount = actions.filter((a) => a.t > t + 1e-6).length
  const recipe = RECIPES[setup.recipeId]

  // persist
  useEffect(() => {
    try {
      const s: Saved = { v: 1, setup, actions, t, sensors: [...sensors], view }
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [setup, actions, t, sensors, view])

  // playback
  const raf = useRef<number>()
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((prev) => {
        const next = prev + dt * speed
        if (next >= tl.durationH) {
          setPlaying(false)
          return tl.durationH
        }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current!)
  }, [playing, speed, tl.durationH])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const seek = useCallback((nt: number) => {
    setPlaying(false)
    setT(Math.max(0, nt))
  }, [])

  const act = (a: NewAction) => {
    const at = Math.round(t / tl.stepH) * tl.stepH
    const kept = actions.filter((x) => x.t <= at + 1e-6)
    const dropped = actions.length - kept.length
    setActions([...kept, { ...a, t: at } as Action])
    setT(at)
    if (dropped > 0) setToast(`Changed the past. ${dropped} later action${dropped > 1 ? 's were' : ' was'} erased.`)
  }

  const alerts = view === 'sensors' ? visibleAlerts(snap, sensors) : [...visibleAlerts(snap, new Set(['probe'])), ...hiddenAlerts(snap)]

  return (
    <div className={`app view-${view}`}>
      <header className="top">
        <div className="brand">
          <h1>Jug Twin</h1>
          <span className="batch">
            {setup.name} · {recipe.name} · {recipe.glutenFree ? 'gluten-free' : setup.clarityFerm ? 'gluten-reduced' : 'contains gluten'}
          </span>
        </div>
        <nav className="top-actions">
          <button
            className="btn ghost"
            onClick={() => {
              setPlaying(false)
              setSheet(null)
              setTouring(true)
            }}
          >
            Tour
          </button>
          <button className="btn ghost" onClick={() => setSheet('sensors')}>
            Sensors
          </button>
          <button className="btn ghost" onClick={() => setSheet('about')}>
            About
          </button>
          <button className="btn" onClick={() => setSheet('setup')}>
            New batch
          </button>
        </nav>
      </header>

      <div className="viewswitch" role="group" aria-label="View">
        <button aria-pressed={view === 'sensors'} onClick={() => setView('sensors')}>
          <span className="vs-title">Sensor view</span>
          <span className="vs-sub">what a brewer sees</span>
        </button>
        <button aria-pressed={view === 'curtain'} onClick={() => setView('curtain')}>
          <span className="vs-title">Behind the curtain</span>
          <span className="vs-sub">what’s really happening</span>
        </button>
      </div>

      <main className="grid">
        <section className="stage" aria-label="Schematic">
          {alerts.length > 0 && (
            <ul className="alerts" aria-live="polite">
              {alerts.map((a) => (
                <li key={a.id}>
                  <strong>▲ {a.title}</strong> <span>{a.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <Jug tl={tl} snap={snap} view={view} sensors={sensors} lastSample={lastSample} />
          <p className="honesty">Simulated · not connected to a real jug · numbers are estimates</p>
        </section>

        <section className="readings" aria-label="Readings">
          {view === 'sensors' ? <SensorReadouts tl={tl} snap={snap} sensors={sensors} lastSample={lastSample} /> : <TruthReadouts tl={tl} snap={snap} />}
        </section>

        <section className="tabs-area">
          <div className="tabs" role="tablist">
            {(
              [
                ['charts', 'Charts'],
                ['actions', 'Do something'],
                ['log', 'Log'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
                {id === 'log' && <span className="count">{tl.events.filter((e) => e.t <= t).length}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="tabpanel">
            {tab === 'charts' && <Charts tl={tl} t={t} view={view} sensors={sensors} />}
            {tab === 'actions' && <Actions snap={snap} onAct={act} onTaste={() => setSheet('taste')} futureCount={futureCount} />}
            {tab === 'log' && <Log events={tl.events} t={t} view={view} onSeek={seek} />}
          </div>
        </section>
      </main>

      <div className="timedock">
        <TimeBar tl={tl} t={t} playing={playing} speed={speed} onSeek={seek} onPlay={() => (t >= tl.durationH ? (setT(0), setPlaying(true)) : setPlaying((p) => !p))} onSpeed={setSpeed} />
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {sheet === 'setup' && (
        <SetupSheet
          initial={setup}
          onClose={() => setSheet(null)}
          onPitch={(s) => {
            const n = Number(setup.name.replace(/\D/g, '')) || 1
            setSetup({ ...s, name: `Batch ${n + 1}` })
            setActions([])
            setT(0)
            setSheet(null)
            setPlaying(true)
          }}
        />
      )}
      {sheet === 'sensors' && (
        <SensorSheet
          sensors={sensors}
          onClose={() => setSheet(null)}
          onToggle={(id) =>
            setSensors((prev) => {
              const n = new Set(prev)
              if (n.has(id)) n.delete(id)
              else n.add(id)
              return n
            })
          }
        />
      )}
      {sheet === 'taste' && <TastingSheet tl={tl} t={t} onClose={() => setSheet(null)} />}
      {sheet === 'about' && <AboutSheet onClose={() => setSheet(null)} />}
      {touring && (
        <Tour
          onView={setView}
          onTab={setTab}
          onClose={() => {
            setTouring(false)
            try {
              localStorage.setItem(TOUR_KEY, '1')
            } catch {
              /* ignore */
            }
          }}
        />
      )}
    </div>
  )
}

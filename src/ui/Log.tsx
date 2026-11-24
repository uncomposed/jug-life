import type { SimEvent } from '../model/sim'
import { clock } from './derive'
import { Linkify } from './Info'

export function Log({ events, t, view, onSeek }: { events: SimEvent[]; t: number; view: 'sensors' | 'curtain'; onSeek: (t: number) => void }) {
  const past = events.filter((e) => e.t <= t + 1e-6).reverse()
  if (!past.length) return <p className="muted small">Nothing has happened yet.</p>
  return (
    <ol className="log">
      {past.map((e, i) => (
        <li key={`${e.t}-${i}`} className={`log-item k-${e.kind} ${e.severity === 'warn' ? 'warn' : ''}`}>
          <button className="log-time" onClick={() => onSeek(e.t)} aria-label={`Jump to ${clock(e.t).label}`}>
            {clock(e.t).label}
          </button>
          <div className="log-title">
            <span className="log-icon" aria-hidden="true">
              {e.severity === 'warn' ? '▲' : e.kind === 'action' ? '●' : e.kind === 'phase' ? '◆' : '★'}
            </span>
            {e.title}
          </div>
          {view === 'sensors' ? (
            <>
              <p className="log-notice">
                <Linkify text={e.notice} />
              </p>
              <details>
                <summary>What’s really happening</summary>
                <p>
                  <Linkify text={e.reality} />
                </p>
              </details>
            </>
          ) : (
            <>
              <p className="log-reality">
                <Linkify text={e.reality} />
              </p>
              <p className="log-notice small">From outside: {e.notice}</p>
            </>
          )}
        </li>
      ))}
    </ol>
  )
}

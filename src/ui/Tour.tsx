import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type TourView = 'sensors' | 'curtain'
export type TourTab = 'charts' | 'actions' | 'log'

interface Step {
  /** CSS selector to spotlight. No target means a centered card. */
  target?: string
  view?: TourView
  tab?: TourTab
  title: string
  body: string
}

export const TOUR_STEPS: Step[] = [
  {
    title: 'Welcome to Jug Twin',
    body: 'This is a pretend 1-gallon jug of beer, fermenting over three weeks. It is not connected to a real jug. This tour takes about a minute.',
  },
  {
    target: '.jug',
    view: 'sensors',
    title: 'The jug',
    body: 'Here is the jug, stopper and airlock. The circles with letters are sensors: TI-101 is a stick-on thermometer strip, FQ-103 counts airlock bubbles. Tap any part, like the airlock, a sensor or the beer, to change it.',
  },
  {
    target: '.viewswitch',
    view: 'sensors',
    title: 'Two ways to look',
    body: 'Sensor view shows only what you could really see or measure. Behind the curtain shows what is actually happening inside.',
  },
  {
    target: '.jug',
    view: 'curtain',
    title: 'Behind the curtain',
    body: 'Each blue dot is about a million yeast cells in every millilitre. Watch them multiply, then sink to the bottom. Problems show up in boxes marked with a triangle.',
  },
  {
    target: '.readings',
    view: 'curtain',
    title: 'The real numbers',
    body: 'These cards show what is hidden from a brewer: true temperature, sugar, alcohol, wild microbes. Tap the round i next to any of them to see what drives it and how to change it.',
  },
  {
    target: '.time-row',
    view: 'sensors',
    title: 'Play with time',
    body: 'Press play to watch the batch ferment. Use −6h and +6h to step, and pick a speed. One day per second gets through the whole batch in 21 seconds.',
  },
  {
    target: '.scrub',
    title: 'Jump anywhere',
    body: 'Drag the slider to go forward or back. The coloured band shows each stage so far. Triangles mark problems and dots mark things you did. Tap one to jump there.',
  },
  {
    target: '.tabs-area',
    tab: 'charts',
    title: 'Charts',
    body: 'The story so far as graphs. The shaded part on the right is the future, which has not happened yet.',
  },
  {
    target: '.tabs-area',
    tab: 'actions',
    title: 'Do something',
    body: 'Move the jug, add yeast food, fit a blow-off tube, take a gravity reading, or taste it. Actions happen at the current time. If you go back and act earlier, anything you did later is erased.',
  },
  {
    target: '.tabs-area',
    tab: 'log',
    title: 'The log',
    body: 'Everything that happened, newest first. In sensor view, open “What’s really happening” to see the hidden cause. Underlined words explain themselves when tapped.',
  },
  {
    target: '.top-actions',
    tab: 'charts',
    title: 'Start over, add gadgets',
    body: 'New batch lets you pick a recipe, yeast, spot in the house, and mistakes to try. Sensors adds or removes gadgets. About explains the science and how sure it is.',
  },
  {
    title: 'Try this first',
    body: 'Press play at 1 day per second and watch the bubbles. Then start a new batch with the barley recipe, filled to the brim, and see what happens to the stopper. The Tour button brings this back any time.',
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6

export function Tour({ onClose, onView, onTab }: { onClose: () => void; onView: (v: TourView) => void; onTab: (t: TourTab) => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardAt, setCardAt] = useState<{ top?: number; bottom?: number }>({})
  const cardRef = useRef<HTMLDivElement>(null)
  const step = TOUR_STEPS[i]
  const last = i === TOUR_STEPS.length - 1

  const measure = useCallback(() => {
    const vh = window.innerHeight
    // a fixed bottom dock (phones) covers part of the screen
    const dock = document.querySelector('.timedock') as HTMLElement | null
    const dockFixed = dock && getComputedStyle(dock).position === 'fixed'
    const dockTop = dockFixed ? dock.getBoundingClientRect().top : vh
    const cardH = cardRef.current?.offsetHeight ?? 200
    if (!step.target) {
      setRect(null)
      setCardAt({ top: Math.max(16, (vh - cardH) / 2) })
      return
    }
    const el = document.querySelector(step.target) as HTMLElement | null
    if (!el) {
      setRect(null)
      setCardAt({ top: 16 })
      return
    }
    const r = el.getBoundingClientRect()
    const insideDock = !!dockFixed && dock.contains(el)
    // stop the highlight at the fixed dock so the dock stays dimmed
    const bottom = Math.min(r.bottom + PAD, insideDock ? vh : dockTop - 4)
    const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(0, bottom - (r.top - PAD)) }
    setRect(box)
    const spaceAbove = box.top - 16
    const spaceBelow = (insideDock ? vh : dockTop) - (box.top + box.height) - 16
    if (insideDock || spaceAbove > spaceBelow) setCardAt({ top: 16 })
    else setCardAt({ bottom: vh - dockTop + 12 })
  }, [step.target])

  // switch view/tab for the step, bring the target into view, then measure
  useLayoutEffect(() => {
    if (step.view) onView(step.view)
    if (step.tab) onTab(step.tab)
    const place = () => {
      const el = step.target ? (document.querySelector(step.target) as HTMLElement | null) : null
      const dock = document.querySelector('.timedock') as HTMLElement | null
      if (el && !dock?.contains(el)) {
        const dockFixed = dock && getComputedStyle(dock).position === 'fixed'
        const usable = dockFixed ? dock.getBoundingClientRect().top : window.innerHeight
        const cardH = cardRef.current?.offsetHeight ?? 220
        const r = el.getBoundingClientRect()
        if (r.height + cardH + 2 * PAD + 40 > usable) {
          // too tall to sit beside the card: start it just below the card
          window.scrollBy({ top: r.top - (cardH + 32 + PAD), behavior: 'instant' as ScrollBehavior })
        } else {
          el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
        }
      }
      measure()
      requestAnimationFrame(measure)
    }
    // animation frames pause in hidden tabs, so a timer backs them up
    const raf = requestAnimationFrame(place)
    const timer = setTimeout(place, 80)
    cardRef.current?.focus()
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  const next = () => (last ? onClose() : setI((n) => n + 1))
  const back = () => setI((n) => Math.max(0, n - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? <div className="tour-spot" style={rect} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <div className="tour-card" ref={cardRef} tabIndex={-1} style={cardAt}>
        <div className="tour-count">
          Step {i + 1} of {TOUR_STEPS.length}
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p aria-live="polite">{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />
          ))}
        </div>
        <div className="tour-buttons">
          <button className="btn ghost" onClick={onClose}>
            {last ? 'Close' : 'Skip tour'}
          </button>
          <span className="spacer" />
          {i > 0 && (
            <button className="btn" onClick={back}>
              Back
            </button>
          )}
          <button className="btn btn-primary" onClick={next} autoFocus>
            {i === 0 ? 'Start the tour' : last ? 'Start brewing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { createContext, Fragment, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ALIAS_RE, aliasToId, GLOSSARY } from './glossary'

/** Opens the glossary pop-up for an entry, anchored to the element that was tapped. */
export const InfoContext = createContext<(id: string, el: Element) => void>(() => {})

export function InfoButton({ id, label }: { id: string; label?: string }) {
  const open = useContext(InfoContext)
  const e = GLOSSARY[id]
  if (!e) return null
  return (
    <button
      type="button"
      className="info-btn"
      aria-label={`What is ${label ?? e.title}?`}
      onClick={(ev) => {
        ev.stopPropagation()
        open(id, ev.currentTarget)
      }}
    >
      i
    </button>
  )
}

/** A word you can tap to learn what it means. */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const open = useContext(InfoContext)
  return (
    <button
      type="button"
      className="term"
      onClick={(ev) => {
        ev.stopPropagation()
        open(id, ev.currentTarget)
      }}
    >
      {children}
    </button>
  )
}

/** Turns known brewing words in a sentence into tappable terms (first mention of each only). */
export function Linkify({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const seen = new Set<string>()
  let last = 0
  for (const m of text.matchAll(ALIAS_RE)) {
    const id = aliasToId(m[0])
    if (!id || seen.has(id) || m.index === undefined) continue
    seen.add(id)
    parts.push(text.slice(last, m.index))
    parts.push(
      <Term key={m.index} id={id}>
        {m[0]}
      </Term>,
    )
    last = m.index + m[0].length
  }
  parts.push(text.slice(last))
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  )
}

/** A small card pinned next to the element that opened it. */
export function Popover({ anchor, onClose, title, children }: { anchor: Element; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  // the thing it points at went away (e.g. a sensor was switched off)
  useLayoutEffect(() => {
    if (!anchor.isConnected) onClose()
  })

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected) return onClose()
      const r = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const dock = document.querySelector('.timedock') as HTMLElement | null
      const floor = dock && getComputedStyle(dock).position === 'fixed' ? dock.getBoundingClientRect().top : vh
      const width = Math.min(340, vw - 24)
      const h = ref.current?.offsetHeight ?? 200
      const left = Math.max(12, Math.min(vw - width - 12, r.left + r.width / 2 - width / 2))
      let top = r.bottom + 8
      if (top + h > floor - 8) top = r.top - h - 8
      top = Math.max(8, Math.min(top, floor - h - 8))
      setPos({ top, left, width })
    }
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const outside = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', key)
    ref.current?.focus()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', key)
    }
  }, [anchor, onClose, title])

  return (
    <div
      ref={ref}
      className="popover"
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden', top: 0, left: 0 }}
    >
      <div className="pop-head">
        <h3>{title}</h3>
        <button className="icon-btn small" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="pop-body">{children}</div>
    </div>
  )
}

export function GlossaryBody({ id }: { id: string }) {
  const e = GLOSSARY[id]
  return (
    <>
      <p>{e.what}</p>
      <h4>How it works</h4>
      <p>{e.how}</p>
      <h4>Try this</h4>
      <p>{e.change}</p>
    </>
  )
}

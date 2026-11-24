import { useMemo } from 'react'
import type { Snapshot, Timeline } from '../model/sim'
import { readBubbler, readProbe, readStrip, type SampleReading, type SensorId } from '../model/sensors'

const STOP_Y = 66
const BOTTOM = 410
const JUG_PATH =
  'M158 66 V110 C158 140 88 150 88 200 V394 Q88 410 104 410 H256 Q272 410 272 394 V200 C272 150 202 140 202 110 V66 Z'

/** Liquid volume (L) → y coordinate of the surface. Matches the jug drawing's shape. */
function volumeToY(v: number): number {
  if (v <= 3.3) return BOTTOM - v * 63.6
  if (v <= 3.95) return 200 - (v - 3.3) * 138
  return 110 - (v - 3.95) * 293
}

function seeded(n: number, seed: number) {
  let x = seed * 9301 + 49297
  const out: { x: number; y: number; p: number }[] = []
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280
    const a = x / 233280
    x = (x * 9301 + 49297) % 233280
    const b = x / 233280
    x = (x * 9301 + 49297) % 233280
    out.push({ x: 96 + a * 168, y: b, p: (x / 233280) * Math.PI * 2 })
  }
  return out
}

interface Props {
  tl: Timeline
  snap: Snapshot
  view: 'sensors' | 'curtain'
  sensors: Set<SensorId>
  lastSample?: SampleReading
}

export function Jug({ tl, snap, view, sensors, lastSample }: Props) {
  const dots = useMemo(() => seeded(160, 3), [])
  const bubbleSeeds = useMemo(() => seeded(28, 11), [])
  const curtain = view === 'curtain'
  const surfaceY = volumeToY(snap.volumeL)
  const foamTop = Math.max(STOP_Y + 1, surfaceY - (snap.krausenCm / snap.headspaceCm) * (surfaceY - STOP_Y))
  const trubH = Math.min(36, (snap.settled + snap.dead) * 0.28)
  const haze = Math.min(0.5, snap.yeast / 110)
  const beer = tl.setup.recipeId === 'barley' ? 'var(--beer-dark)' : 'var(--beer)'
  const nDots = Math.min(160, Math.round(snap.yeast))
  const nBubbles = curtain ? Math.min(28, Math.round(snap.rate * 12)) : 0
  const liquidTop = surfaceY + 6
  const liquidSpan = BOTTOM - 8 - trubH - liquidTop
  const bubbling = !snap.stopperOut && !snap.airlockDry && !snap.clogged && snap.bubbleRate > 0.003
  const pulse = Math.max(0.5, Math.min(4, 0.6 / Math.max(snap.bubbleRate, 0.01) / 6))
  const pellicle = snap.wild > 3e6 ? Math.min(1, 0.35 + Math.log10(snap.wild / 3e6) / 1.2) : 0
  const blowoff = snap.closure === 'blowoff'
  const strip = readStrip(tl, snap)

  return (
    <svg className="jug" viewBox="0 0 360 430" role="img" aria-label={curtain ? 'Inside the jug: yeast, bubbles and foam' : 'The jug as a brewer sees it, with sensor tags'}>
      <defs>
        <clipPath id="inside">
          <path d={JUG_PATH} />
        </clipPath>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="var(--c-temp)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--c-temp)" stopOpacity="0" />
        </radialGradient>
        <pattern id="foamdots" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="var(--foam)" />
          <circle cx="2" cy="3" r="1.6" fill="var(--foam-shade)" />
          <circle cx="6" cy="6.5" r="1.1" fill="var(--foam-shade)" />
        </pattern>
      </defs>

      {curtain && snap.heatW > 0.05 && (
        <ellipse cx="180" cy="300" rx="150" ry="150" fill="url(#glow)" opacity={Math.min(1, snap.heatW / 1.2)} />
      )}

      {/* contents */}
      <g clipPath="url(#inside)">
        <rect x="80" y="40" width="200" height="380" fill="var(--glass-in)" />
        <rect x="80" y={surfaceY} width="200" height={BOTTOM - surfaceY + 10} fill={beer} />
        <rect x="80" y={surfaceY} width="200" height={BOTTOM - surfaceY + 10} fill="var(--haze)" opacity={haze} />
        <rect x="80" y={BOTTOM - trubH} width="200" height={trubH + 10} fill="var(--trub)" />
        {snap.krausenCm > 0.2 && (
          <path
            d={`M80 ${surfaceY + 2} V${foamTop + 3} ${Array.from({ length: 13 }, (_, i) => `q8 ${i % 2 ? 4 : -4} 16 0`).join(' ')} V${surfaceY + 2} Z`}
            fill="url(#foamdots)"
          />
        )}
        {pellicle > 0 && (
          <path d={`M80 ${surfaceY} ${Array.from({ length: 20 }, (_, i) => `q5 ${i % 2 ? 3 : -3} 10 0`).join(' ')} v4 H80 Z`} fill="var(--pellicle)" opacity={pellicle} />
        )}
        {curtain &&
          dots.slice(0, nDots).map((d, i) => {
            const x = d.x + 3 * Math.sin(snap.t * 0.9 + d.p)
            const y = liquidTop + d.y * liquidSpan + 3 * Math.cos(snap.t * 0.7 + d.p * 1.3)
            return <circle key={i} cx={x} cy={y} r="2.6" fill="var(--c-yeast)" />
          })}
        {curtain &&
          bubbleSeeds.slice(0, nBubbles).map((b, i) => (
            <circle
              key={`b${i}`}
              className="rise"
              cx={b.x}
              cy={BOTTOM - 20 - b.y * 60}
              r={1.8 + (i % 3) * 0.7}
              fill="none"
              stroke="var(--c-co2)"
              strokeWidth="1.4"
              style={{ animationDelay: `${(b.p / 6.28) * 2.4}s`, ['--rise' as string]: `${-(BOTTOM - 30 - surfaceY)}px` }}
            />
          ))}
      </g>

      {/* glass */}
      <path d={JUG_PATH} fill="none" stroke="var(--glass)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M202 74 C232 74 236 104 206 112" fill="none" stroke="var(--glass)" strokeWidth="5" />
      <path d="M100 220 V380" stroke="var(--glass-shine)" strokeWidth="4" strokeLinecap="round" />

      {/* stopper */}
      {snap.stopperOut ? (
        <g>
          <path d="M40 30 l50 8 -6 20 -40 -6z" fill="var(--stopper)" />
          <path d="M202 70 q6 30 -2 60 q-4 20 4 40" fill="none" stroke="var(--foam)" strokeWidth="6" strokeLinecap="round" />
          <path d="M158 70 q-10 20 -6 40" fill="none" stroke="var(--foam)" strokeWidth="5" strokeLinecap="round" />
        </g>
      ) : (
        <path d="M152 44 H208 L204 68 H156 Z" fill="var(--stopper)" />
      )}

      {/* airlock or blow-off */}
      {!snap.stopperOut && !blowoff && (
        <g>
          <path d="M180 44 V34" stroke="var(--glass)" strokeWidth="5" />
          <path d="M166 4 V28 A14 14 0 0 0 194 28 V4" fill="none" stroke="var(--glass)" strokeWidth="5" />
          <circle cx="166" cy="16" r="6" fill="none" stroke="var(--glass)" strokeWidth="3" />
          <circle cx="194" cy="16" r="6" fill="none" stroke="var(--glass)" strokeWidth="3" />
          {!snap.airlockDry && (
            <path d="M166 24 V28 A14 14 0 0 0 194 28 V24" fill="none" stroke={snap.clogged ? 'var(--trub)' : 'var(--airlock-liquid)'} strokeWidth="4" />
          )}
          {bubbling && (
            <circle className="airbub" cx="194" cy="34" r="3" fill="var(--airlock-liquid)" stroke="var(--glass)" style={{ animationDuration: `${pulse}s` }} />
          )}
        </g>
      )}
      {!snap.stopperOut && blowoff && (
        <g>
          <path d="M180 44 C180 6 318 6 318 360" fill="none" stroke="var(--glass)" strokeWidth="6" />
          <rect x="294" y="340" width="50" height="70" rx="6" fill="var(--glass-in)" stroke="var(--glass)" strokeWidth="3" />
          <rect x="297" y="364" width="44" height="43" rx="4" fill="var(--airlock-liquid)" opacity="0.6" />
          {bubbling && <circle className="airbub jar" cx="318" cy="396" r="3.5" fill="none" stroke="var(--glass)" style={{ animationDuration: `${pulse}s` }} />}
        </g>
      )}

      {/* sensor layer */}
      {!curtain && (
        <g className="tags">
          {sensors.has('strip') && (
            <g>
              <rect x="234" y="246" width="20" height="94" rx="3" fill="var(--panel)" stroke="var(--ink-soft)" />
              {[30, 28, 26, 24, 22, 20, 18, 16, 14].map((v, i) => {
                const on = strip.lit.includes(v)
                return (
                  <g key={v}>
                    <rect x="236" y={248 + i * 10} width="16" height="9" fill={on ? 'var(--accent)' : 'transparent'} />
                    <text x="244" y={255.5 + i * 10} textAnchor="middle" fontSize="7" fill={on ? 'var(--on-accent)' : 'var(--ink-soft)'} fontFamily="var(--mono)">
                      {v}
                    </text>
                  </g>
                )
              })}
              <Tag x={318} y={232} code="TI" num="101" label="Strip" value={strip.text} lineTo={[254, 270]} />
            </g>
          )}
          {sensors.has('probe') && (
            <g>
              <circle cx="104" cy="330" r="4" fill="var(--ink)" />
              <Tag x={40} y={330} code="TT" num="102" label="Probe" value={`${readProbe(tl, snap).toFixed(1)} °C`} lineTo={[100, 330]} />
            </g>
          )}
          {sensors.has('bubbler') && !blowoff && !snap.stopperOut && (
            <g>
              <rect x="198" y="0" width="14" height="10" rx="2" fill="var(--ink-soft)" />
              <Tag x={292} y={36} code="FQ" num="103" label="Bubbles" value={`${readBubbler(tl, snap).toFixed(1)}/min`} lineTo={[212, 6]} />
            </g>
          )}
          {lastSample && (
            <Tag x={40} y={236} code="DI" num="105" label="Last sample" value={lastSample.sg.toFixed(3)} dashed lineTo={[92, 236]} />
          )}
        </g>
      )}

      {curtain && (
        <g fontFamily="var(--body)" fontSize="11" fill="var(--ink-soft)">
          <circle cx="16" cy="420" r="2.6" fill="var(--c-yeast)" />
          <text x="24" y="424">= 1 million yeast cells per mL</text>
          <circle cx="226" cy="420" r="3" fill="none" stroke="var(--c-co2)" strokeWidth="1.4" />
          <text x="234" y="424">CO₂ coming out</text>
        </g>
      )}
    </svg>
  )
}

function Tag({
  x,
  y,
  code,
  num,
  label,
  value,
  dashed,
  lineTo,
}: {
  x: number
  y: number
  code: string
  num: string
  label: string
  value: string
  dashed?: boolean
  lineTo: [number, number]
}) {
  return (
    <g>
      <line x1={lineTo[0]} y1={lineTo[1]} x2={x} y2={y} stroke="var(--ink-soft)" strokeDasharray="3 3" />
      <circle cx={x} cy={y} r="19" fill="var(--panel)" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray={dashed ? '5 3' : undefined} />
      <text x={x} y={y - 2} textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill="var(--ink)">
        {code}
      </text>
      <text x={x} y={y + 10} textAnchor="middle" fontSize="9" fontFamily="var(--mono)" fill="var(--ink-soft)">
        {num}
      </text>
      <text x={x} y={y + 32} textAnchor="middle" fontSize="10.5" fontFamily="var(--body)" fill="var(--ink-soft)">
        {label}
      </text>
      <text x={x} y={y + 45} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="var(--mono)" fill="var(--ink)">
        {value}
      </text>
    </g>
  )
}

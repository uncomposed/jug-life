// Small, well-known conversions. Pure functions, no state.

export function platoToSG(p: number): number {
  return 1 + p / (258.6 - (p / 258.2) * 227.1)
}

export function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg
}

/** Grams of extract per litre → degrees Plato (iterates on density). */
export function gramsPerLToPlato(gL: number): number {
  let sg = 1 + gL / 2600
  for (let i = 0; i < 4; i++) {
    const p = gL / (10 * sg)
    sg = platoToSG(p)
  }
  return gL / (10 * sg)
}

/** Degrees Plato → grams of extract per litre. */
export function platoToGramsPerL(p: number): number {
  return p * 10 * platoToSG(p)
}

/**
 * Apparent extract via the Balling relation RE = 0.1808·OE + 0.8192·AE.
 * This is what a hydrometer "sees" once alcohol is present.
 */
export function apparentPlato(realExtractP: number, originalP: number): number {
  return (realExtractP - 0.1808 * originalP) / 0.8192
}

export function abvFromGravity(og: number, fg: number): number {
  return (og - fg) * 131.25
}

/**
 * Cardinal temperature model with inflection (Rosso et al. 1993).
 * Returns 0 outside (tMin, tMax) and 1 at tOpt.
 */
export function ctmi(t: number, tMin: number, tOpt: number, tMax: number): number {
  if (t <= tMin || t >= tMax) return 0
  const num = (t - tMax) * (t - tMin) ** 2
  const den = (tOpt - tMin) * ((tOpt - tMin) * (t - tOpt) - (tOpt - tMax) * (tOpt + tMin - 2 * t))
  return Math.max(0, num / den)
}

/** CO2 that stays dissolved at 1 atm, g/L. */
export function co2SolubilityGL(tC: number): number {
  return 3.35 * Math.exp(-0.0345 * tC)
}

/** Terrill cubic: refractometer Brix readings (already ÷ wort factor) → final gravity. */
export function terrillFG(obr: number, fbr: number): number {
  return (
    1 -
    0.0044993 * obr +
    0.011774 * fbr +
    0.00027581 * obr * obr -
    0.0012717 * fbr * fbr -
    0.00000728 * obr ** 3 +
    0.000063293 * fbr ** 3
  )
}

export function brixFromSG(sg: number): number {
  return sgToPlato(sg)
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function smoothstep(x: number): number {
  const c = clamp(x, 0, 1)
  return c * c * (3 - 2 * c)
}

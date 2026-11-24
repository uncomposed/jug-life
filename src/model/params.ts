// Every tunable number lives here, with where it came from and how much to trust it.
// "est" = estimate from background knowledge, tuned so curves look like typical homebrew logs.
// None of this is validated against a real batch yet.

export type Confidence = 'sourced' | 'textbook' | 'est'

export interface ParamNote {
  name: string
  value: string
  confidence: Confidence
  note: string
}

export type RecipeId = 'sorghum' | 'sorghum-rice' | 'barley'

export interface Recipe {
  id: RecipeId
  name: string
  blurb: string
  og: number
  /** Share of the extract that ale yeast can ferment (real fermentability). */
  fermentableFrac: number
  /** Free amino nitrogen: the nitrogen yeast need to grow, mg/L. */
  fanMgL: number
  /** How tall the foam (krausen) gets, relative to barley = 1. */
  foam: number
  /** Sorghum's sour-ish tang, 0..1. */
  tang: number
  glutenFree: boolean
}

export const RECIPES: Record<RecipeId, Recipe> = {
  sorghum: {
    id: 'sorghum',
    name: 'Sorghum pale ale',
    blurb: 'Sorghum syrup, a few hops. The classic gluten-free starter kit.',
    og: 1.05,
    fermentableFrac: 0.6,
    fanMgL: 70,
    foam: 0.6,
    tang: 0.6,
    glutenFree: true,
  },
  'sorghum-rice': {
    id: 'sorghum-rice',
    name: 'Sorghum + rice syrup',
    blurb: 'Lighter and drier. Rice adds sugar but no yeast nutrient.',
    og: 1.048,
    fermentableFrac: 0.68,
    fanMgL: 45,
    foam: 0.5,
    tang: 0.35,
    glutenFree: true,
  },
  barley: {
    id: 'barley',
    name: 'Barley malt pale ale',
    blurb: 'Ordinary malt extract, for comparison. Contains gluten.',
    og: 1.05,
    fermentableFrac: 0.63,
    fanMgL: 150,
    foam: 1.0,
    tang: 0,
    glutenFree: false,
  },
}

export type YeastId = 'clean-ale' | 'english-ale'

export interface Yeast {
  id: YeastId
  name: string
  blurb: string
  /** Max growth rate at 20 °C, per hour. */
  muMax: number
  /** Sugar uptake per million cells/mL at 20 °C, g/L per hour. */
  q: number
  /** Hours of lag at 20 °C after rehydrated dry yeast is pitched. */
  lagH: number
  /** Ethanol at which the yeast stop entirely, g/L. */
  eMax: number
  /** Settling rate while sugar is plentiful, per hour. */
  flocBase: number
  /** Extra settling as sugar runs out, per hour. */
  flocLate: number
  /** Fruity ester tendency, relative. */
  ester: number
  tMin: number
  tOpt: number
  tMax: number
}

export const YEASTS: Record<YeastId, Yeast> = {
  'clean-ale': {
    id: 'clean-ale',
    name: 'Clean American ale (US-05 style)',
    blurb: 'Neutral, ferments dry, slow to settle.',
    muMax: 0.12,
    q: 0.026,
    lagH: 18,
    eMax: 110,
    flocBase: 0.0015,
    flocLate: 0.025,
    ester: 0.8,
    tMin: 4,
    tOpt: 31,
    tMax: 40,
  },
  'english-ale': {
    id: 'english-ale',
    name: 'English ale (S-04 style)',
    blurb: 'Fast, fruity, drops clear quickly. Finishes a bit sweeter.',
    muMax: 0.13,
    q: 0.03,
    lagH: 14,
    eMax: 95,
    flocBase: 0.002,
    flocLate: 0.06,
    ester: 1.3,
    tMin: 5,
    tOpt: 30,
    tMax: 39,
  },
}

export type LocationId = 'closet' | 'kitchen' | 'fridge-top' | 'garage' | 'swamp' | 'fridge'

export interface Location {
  id: LocationId
  name: string
  blurb: string
  /** Average room temperature, °C. */
  baseC: number
  /** Half the day-night swing, °C. */
  swingC: number
  /** Multiplier on how fast the jug trades heat with its surroundings. */
  uaMult: number
}

export const LOCATIONS: Record<LocationId, Location> = {
  closet: { id: 'closet', name: 'Hall closet', blurb: 'Dark and steady, about 19.5 °C.', baseC: 19.5, swingC: 0.5, uaMult: 1 },
  kitchen: { id: 'kitchen', name: 'Kitchen counter', blurb: 'Warm days, cool nights. About 21 °C, swings ±2.5.', baseC: 21, swingC: 2.5, uaMult: 1.3 },
  'fridge-top': { id: 'fridge-top', name: 'Top of the fridge', blurb: 'Cozy. About 25 °C.', baseC: 25, swingC: 1, uaMult: 1 },
  garage: { id: 'garage', name: 'Garage in autumn', blurb: 'Cold, about 13 °C, swings ±4.', baseC: 13, swingC: 4, uaMult: 1.5 },
  swamp: { id: 'swamp', name: 'Water bath + wet towel', blurb: 'A tub of water. Holds about 17 °C and soaks up heat.', baseC: 17, swingC: 0.4, uaMult: 4 },
  fridge: { id: 'fridge', name: 'Fridge (cold crash)', blurb: '2 °C. Drops the yeast out and clears the beer.', baseC: 2, swingC: 0.3, uaMult: 1.6 },
}

export const PHYS = {
  /** Total inside volume of a 1-gallon jug to the bottom of the stopper, L. */
  jugTotalL: 4.1,
  /** Cells in one 11.5 g sachet of dry yeast, billions. */
  sachetCellsB: 200,
  /** Ethanol made per g sugar fermented (practical), g/g. */
  yEthanol: 0.47,
  /** CO2 made per g sugar fermented, g/g. */
  yCO2: 0.46,
  /** Heat given off per g sugar fermented, J/g. Sources disagree by ~3x. */
  heatJperG: 550,
  /** Heat-loss conductance of a bare 1-gal glass jug, W/K. */
  uaWperK: 0.75,
  /** Glass jug heat capacity, J/K. */
  glassJperK: 1300,
  /** FAN used per million cells/mL of new growth, mg/L. */
  yFan: 1.3,
  /** CO2 gas volume per gram at room temperature, mL/g. */
  co2mLperG: 546,
  /** Gas volume of one S-airlock bubble, mL. */
  bubbleML: 2,
  /** Liquid an S-airlock can give up before it is sucked into the beer, mL. */
  airlockReserveML: 8,
  blowoffReserveML: 25,
  /** Pressure at which foam-clogged gas pops the stopper, kPa. */
  popKPaSnug: 8,
  popKPaLoose: 2.5,
  /** Share of gas that escapes round a loose stopper instead of the airlock. */
  leakLoose: 0.85,
  leakSnug: 0.03,
  /** Hydrometer sample size, L. */
  hydrometerSampleL: 0.1,
}

export const PARAM_NOTES: ParamNote[] = [
  { name: 'Gluten-free threshold', value: 'under 20 ppm', confidence: 'sourced', note: 'US FDA rule; TTB Ruling 2020-2 for beer.' },
  { name: 'Ethanol yield', value: '0.47 g per g sugar', confidence: 'textbook', note: 'Theory is 0.511; some sugar becomes yeast and by-products.' },
  { name: 'CO₂ yield', value: '0.46 g per g sugar', confidence: 'textbook', note: 'Glucose → 2 ethanol + 2 CO₂.' },
  { name: 'Heat of fermentation', value: '550 J per g sugar', confidence: 'est', note: 'Sources range from about 410 to 1,200 J/g. Middle value.' },
  { name: 'Jug heat loss', value: '0.75 W per °C', confidence: 'est', note: 'Gives a cooling time constant of about 6 hours.' },
  { name: 'Yeast in a sachet', value: '200 billion cells', confidence: 'est', note: 'Typical claim for 11.5 g dry ale yeast.' },
  { name: 'Pitch rate target', value: '0.75 M cells/mL/°P', confidence: 'textbook', note: 'Common ale guideline; ~9 M/mL at 1.050.' },
  { name: 'Yeast temperature curve', value: 'min 4, best 31, max 40 °C', confidence: 'est', note: 'Cardinal-temperature model (Rosso 1993 form).' },
  { name: 'Nitrogen per new cell', value: '1.3 mg/L FAN per M/mL', confidence: 'est', note: 'Tuned so 150 mg/L FAN supports ~100 M/mL.' },
  { name: 'Sorghum FAN', value: '45–70 mg/L', confidence: 'est', note: 'Sorghum worts are known to be low in FAN; exact values vary.' },
  { name: 'Airlock bubble size', value: '2 mL', confidence: 'est', note: 'Low confidence; real bubbles vary 1–3 mL.' },
  { name: 'CO₂ solubility', value: '1.7 g/L at 20 °C', confidence: 'textbook', note: 'Henry’s law; about 3.3 g/L at 0 °C.' },
  { name: 'Gravity ↔ Plato', value: 'ASBC polynomial', confidence: 'textbook', note: 'Apparent extract via the Balling relation.' },
  { name: 'Refractometer correction', value: 'Terrill cubic, ÷1.04 wort factor', confidence: 'textbook', note: 'Errors of ±0.003 SG are normal.' },
  { name: 'Kinetic model', value: 'Monod + ethanol inhibition', confidence: 'est', note: 'Cut down from Gee & Ramirez (1988) and de Andrés-Toro (1998). Constants tuned by eye, not fitted.' },
]

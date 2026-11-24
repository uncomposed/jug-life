import { RECIPES } from './params'
import { snapshotAt, type Timeline } from './sim'

export interface TastingNote {
  label: string
  text: string
  tone: 'good' | 'neutral' | 'bad'
}

export interface Tasting {
  ready: boolean
  readyText: string
  abv: number
  fg: number
  gluten: string
  notes: TastingNote[]
  verdict: string
}

export function taste(tl: Timeline, t: number): Tasting {
  const s = snapshotAt(tl, t)
  const earlier = snapshotAt(tl, Math.max(0, t - 72))
  const recipe = RECIPES[tl.setup.recipeId]
  const stable = Math.abs(earlier.sg - s.sg) < 0.001 && t >= 72
  const notes: TastingNote[] = []
  let bad = 0

  if (s.sugar > 8) {
    notes.push({ label: 'Sweet', text: 'Noticeably sweet and unfinished. There is sugar the yeast never got to.', tone: 'bad' })
    bad++
  } else if (s.sg > 1.015) {
    notes.push({ label: 'Body', text: 'Soft and slightly sweet. Typical for sorghum, which leaves more unfermentable sugar.', tone: 'neutral' })
  } else {
    notes.push({ label: 'Body', text: 'Dry and light.', tone: 'neutral' })
  }

  if (recipe.tang > 0.3) notes.push({ label: 'Sorghum tang', text: 'A tart, slightly sour edge. Normal for sorghum beers, and it mellows with a few weeks in the bottle.', tone: 'neutral' })

  if (s.esters > 1.3) notes.push({ label: 'Fruity', text: 'Pear and banana esters, from yeast growing warm or underpitched.', tone: 'neutral' })
  else if (s.esters < 0.7) notes.push({ label: 'Clean', text: 'Very little fruitiness: lots of yeast, little growth.', tone: 'good' })
  else notes.push({ label: 'Clean', text: 'Balanced, faint fruitiness.', tone: 'good' })

  if (s.fusels > 1) {
    notes.push({ label: 'Hot', text: 'A harsh, solvent-like alcohol burn (fusel alcohols) from fermenting too warm. It does not age out.', tone: 'bad' })
    bad++
  } else if (s.fusels > 0.3) notes.push({ label: 'Warming', text: 'A slight boozy warmth from a warm patch during fermentation.', tone: 'neutral' })

  if (s.acid > 1) {
    notes.push({ label: 'Sour', text: 'Properly sour. Bacteria got in and made lactic acid.', tone: 'bad' })
    bad++
  } else if (s.acid > 0.3) notes.push({ label: 'Tart', text: 'A little sharper than it should be. Something wild is starting.', tone: 'bad' })

  if (s.wild > 1e6) {
    notes.push({ label: 'Funky', text: 'Wild microbes are still eating sugars regular yeast leave behind. Bottling now risks over-carbonated bottles.', tone: 'bad' })
    bad++
  }
  if (s.oxidation > 0.3) {
    notes.push({ label: 'Stale', text: 'Papery, cardboard notes from oxygen getting in while the jug was open.', tone: 'bad' })
    bad++
  }
  if (s.yeast > 10) notes.push({ label: 'Cloudy', text: 'Hazy and yeasty ("green beer"). Give it time to settle.', tone: 'neutral' })

  const gluten = recipe.glutenFree
    ? 'Gluten-free by ingredients: sorghum, no barley. (US labels need under 20 ppm.)'
    : tl.setup.clarityFerm
      ? 'Gluten-reduced: barley treated with an enzyme (Clarity-Ferm). In the US it cannot be called gluten-free, and most celiac guidance says avoid it.'
      : 'Contains gluten (barley).'

  const verdict =
    bad === 0 && stable
      ? 'Ready to bottle. A clean, honest batch.'
      : bad === 0
        ? 'Tastes fine, but it is not finished yet.'
        : bad === 1
          ? 'Drinkable, with one flaw worth learning from.'
          : 'A learning batch. Rewind and try a different path.'

  return {
    ready: stable && s.yeast < 10,
    readyText: stable
      ? 'Gravity has held steady for 3 days. Safe to bottle.'
      : 'Gravity is still moving (or you have not waited 3 days). Bottling now risks exploding bottles.',
    abv: s.abv,
    fg: s.sg,
    gluten,
    notes,
    verdict,
  }
}

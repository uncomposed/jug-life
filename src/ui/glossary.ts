// Plain-language explanations for words and numbers in the app.
// Each entry says what it is, the cause-and-effect behind it (as this model
// simulates it), and what you can try. The model is a simplification; where
// real brewing is messier, the text says so.

export interface GlossaryEntry {
  id: string
  title: string
  what: string
  how: string
  change: string
  /** Lower-case phrases that link to this entry when they appear in text. */
  aliases: string[]
}

export const GLOSSARY: Record<string, GlossaryEntry> = {}

const add = (e: GlossaryEntry) => (GLOSSARY[e.id] = e)

add({
  id: 'pitch',
  title: 'Pitch rate',
  what: '“Pitching” is adding the yeast. Pitch rate is how many yeast cells you add for how sugary the wort is. Underpitched means too few; overpitched means too many.',
  how: 'Too few cells → they have to multiply a lot before the sugar runs out → more growth means more fruity esters and a slower start. Too many → fast start, little growth, a very clean taste.',
  change: 'In New batch, change “How much of the sachet”. A quarter is an underpitch, the whole sachet is a big overpitch for one gallon.',
  aliases: ['underpitched', 'underpitch', 'overpitched', 'overpitch', 'pitch rate', 'pitched'],
})
add({
  id: 'esters',
  title: 'Esters (fruity flavors)',
  what: 'Fruity-smelling compounds yeast make while they grow: pear, banana, apple.',
  how: 'Made in proportion to new yeast growth, and much faster when warm. Warm + underpitched = lots of esters. Cool + lots of yeast = very few.',
  change: 'Pitch cooler (18 °C), keep the jug somewhere steady, or pitch more yeast. English ale yeast makes more than the clean American one.',
  aliases: ['esters', 'ester', 'fruity', 'fruitiness', 'pear and banana'],
})
add({
  id: 'fusels',
  title: 'Fusel alcohols (hot, harsh)',
  what: 'Heavier alcohols that taste like solvent or a burning, boozy edge.',
  how: 'In this model, yeast that grow above about 23 °C make fusels, more the hotter it gets. Unlike some flavors, they do not fade with time.',
  change: 'Avoid pitching hot and avoid the top of the fridge or a hot kitchen during the first few days, when the yeast grow most.',
  aliases: ['fusel alcohols', 'fusels', 'fusel', 'solvent-like', 'harsh'],
})
add({
  id: 'body',
  title: 'Body: dry, light or sweet',
  what: 'How full or thin the beer feels. “Dry and light” means little sugar is left.',
  how: 'Yeast eat the simple sugars and leave the complex ones. The more they finish, the drier and thinner the beer. Sorghum leaves more unfermentable sugar than barley, so it often feels softer.',
  change: 'Recipe matters most. A stuck or cold batch leaves sugar behind and tastes sweet; warming it and swirling can let the yeast finish.',
  aliases: ['dry and light', 'body', 'unfermentable sugar', 'unfinished'],
})
add({
  id: 'sugar',
  title: 'Sugar left',
  what: 'The fermentable sugar still dissolved in the beer, in grams per litre.',
  how: 'Yeast eat sugar → roughly half becomes alcohol and half becomes CO₂ gas, plus a little heat. When it reaches near zero, fermentation is done.',
  change: 'Warmer, healthy, well-fed yeast eat it faster. Cold, out-of-nitrogen or settled yeast slow down.',
  aliases: ['sugar left', 'eatable sugar', 'easy sugar'],
})
add({
  id: 'alcohol',
  title: 'Alcohol (ABV)',
  what: 'Alcohol by volume: the percent of the beer that is alcohol.',
  how: 'Made from sugar. As it builds up it also poisons the yeast, which is one reason fermentation slows near the end.',
  change: 'Set mostly by the recipe’s starting sugar. Leftover sugar from a stuck batch means less alcohol.',
  aliases: ['abv', 'alcohol is building'],
})
add({
  id: 'yeast',
  title: 'Yeast floating',
  what: 'Live yeast cells suspended in the beer, in millions per millilitre. These are the ones doing the work.',
  how: 'They grow while there is sugar and nitrogen → peak → then clump and sink as food runs out. Growth speed depends on temperature; too cold or too hot slows them.',
  change: 'Pitch more for a faster start. Swirl the jug to lift settled yeast back up. Keep them near 18–21 °C.',
  aliases: ['yeast floating', 'yeast are slowing'],
})
add({
  id: 'settled',
  title: 'Settling (flocculation)',
  what: 'Yeast clumping together and sinking into a creamy layer at the bottom (called trub, said “troob”).',
  how: 'Yeast settle faster once sugar runs low, when it gets cold, or when they run out of nitrogen. Settled yeast stop eating, which can stall a batch that is not finished.',
  change: 'Swirl to stir them back up. English ale yeast settles faster (clearer beer, but more likely to quit early).',
  aliases: ['settled', 'settle', 'flocculation', 'creamy layer', 'trub'],
})
add({
  id: 'fan',
  title: 'Yeast nitrogen (FAN)',
  what: 'Free amino nitrogen: the protein building blocks yeast need to grow new cells.',
  how: 'Every new yeast cell uses some up. Barley wort has plenty; sorghum and rice syrups have much less, so yeast there can run out early → growth stops → fermentation drags or sticks.',
  change: 'Add yeast nutrient under Do something, or tap the beer on the schematic. It helps most early on.',
  aliases: ['fan', 'nitrogen', 'yeast nutrient', 'nutrient'],
})
add({
  id: 'gravity',
  title: 'Gravity (SG)',
  what: 'How dense the beer is compared with water (1.000). Sugar makes it heavier, alcohol makes it lighter.',
  how: 'As yeast turn sugar into alcohol, gravity falls. When it stops falling for a few days, the beer is done.',
  change: 'You can only know it by measuring: take a hydrometer sample or a refractometer reading.',
  aliases: ['gravity', 'true gravity'],
})
add({
  id: 'target',
  title: 'Target (final gravity)',
  what: 'Where the gravity should end up if the yeast eat everything they can.',
  how: 'Set by how much of the recipe’s sugar is fermentable. Sorghum and rice finish higher than barley.',
  change: 'If you are well above the target and it has stopped moving, the batch is stuck: warm it, swirl it, or add nutrient.',
  aliases: ['target', 'final gravity'],
})
add({
  id: 'hydrometer',
  title: 'Hydrometer',
  what: 'A weighted glass float. The deeper it sinks, the lower the gravity.',
  how: 'Accurate to about ±0.0005, but you have to pour out about 100 mL of beer to float it. With sloppy sanitizing, each sample is a chance for microbes to get in.',
  change: 'Under Do something, or tap the gravity tag on the schematic.',
  aliases: ['hydrometer'],
})
add({
  id: 'refractometer',
  title: 'Refractometer',
  what: 'A small tool that reads sugar from how much two drops of beer bend light.',
  how: 'Alcohol bends light too, so once fermentation starts the raw reading is wrong and needs a correction formula. Even corrected, expect ±0.003.',
  change: 'Cheap on beer, but less accurate. Use a hydrometer to confirm the beer is finished.',
  aliases: ['refractometer'],
})
add({
  id: 'lag',
  title: 'Lag phase',
  what: 'The quiet first hours after pitching, before any bubbles.',
  how: 'Yeast are soaking up oxygen and nutrients and getting ready to multiply. Cold, too little yeast, or yeast shocked by hot wort make it longer.',
  change: 'Pitch at a sensible temperature (18–21 °C) and enough yeast.',
  aliases: ['lag phase', 'long lag', 'lag'],
})
add({
  id: 'heat',
  title: 'Self-heating',
  what: 'Fermentation gives off heat, so the beer runs warmer than the room.',
  how: 'Fast fermentation → more heat. A 1-gallon jug loses heat quickly, so it stays within about a degree of the room. Big 5-gallon batches can run several degrees hot.',
  change: 'Mostly a lesson for scaling up. Pick a cooler spot if you want the beer itself at a target temperature.',
  aliases: ['self-heating', 'yeast heat', 'beer vs room'],
})
add({
  id: 'co2',
  title: 'CO₂ (carbon dioxide)',
  what: 'The gas yeast make alongside alcohol. Some stays dissolved in the beer; the rest pushes out through the airlock as bubbles.',
  how: 'Cold beer holds more dissolved CO₂. When the beer cools, gas in the headspace shrinks too, which can pull airlock liquid backwards.',
  change: 'Watch the bubble rate to see how active it is, but remember bubbles are not a measurement of how done it is.',
  aliases: ['co₂', 'co2', 'dissolved'],
})
add({
  id: 'headspace',
  title: 'Headspace',
  what: 'The empty space between the beer and the stopper.',
  how: 'Foam needs somewhere to go. Less headspace → foam reaches the stopper sooner → clogs the airlock or pops the stopper.',
  change: 'Fill to the shoulder (3.4 L) instead of the brim, or fit a blow-off tube for the first few days.',
  aliases: ['headspace'],
})
add({
  id: 'krausen',
  title: 'Foam (krausen)',
  what: 'The rocky foam cap on top during active fermentation. Said “KROY-zen”.',
  how: 'Rises with how fast the yeast are fermenting and with how foamy the recipe is (barley is foamier than sorghum). It falls back as fermentation slows.',
  change: 'Cooler, slower fermentation makes less foam. A blow-off tube lets it escape safely.',
  aliases: ['krausen', 'foam cap', 'foam'],
})
add({
  id: 'airlock',
  title: 'S-airlock',
  what: 'The little S-shaped tube with liquid in it. Gas can bubble out, but air cannot get in.',
  how: 'It only works with liquid in it. Foam can clog it, and a sudden cool-down can suck the liquid back into the beer, which is why sanitizer beats tap water as the fill.',
  change: 'Swap to a blow-off tube during the foamy days, and swap back once foam drops. Refill it if it goes dry.',
  aliases: ['s-airlock', 'airlock'],
})
add({
  id: 'blowoff',
  title: 'Blow-off tube',
  what: 'A wide hose from the stopper down into a jar of sanitizer.',
  how: 'Wide enough that foam can push through without clogging, so pressure never builds up. You lose a little beer as foam, but the stopper stays put.',
  change: 'Fit it for the first 2–4 days, especially with a full jug or a foamy recipe, then go back to the airlock.',
  aliases: ['blow-off tube', 'blow-off', 'blowoff'],
})
add({
  id: 'suckback',
  title: 'Suck-back',
  what: 'Airlock liquid getting pulled backwards into the beer.',
  how: 'Cooling the jug shrinks the gas inside → pressure drops below the room → the airlock liquid gets pulled in. If it was tap water, microbes come with it.',
  change: 'Fill the airlock with sanitizer or vodka. Cool slowly, or move to the fridge only after fermentation is done.',
  aliases: ['suck-back', 'sucked back', 'cold crash', 'cold-crash'],
})
add({
  id: 'wild',
  title: 'Wild microbes',
  what: 'Bacteria and wild yeast that are not the brewing yeast. Invisible at first.',
  how: 'They get in through poor sanitizing, an open jug or suck-back. They grow slowly while healthy yeast crowd them out, then take off once the yeast settle, eating sugars brewing yeast leave behind and making lactic acid (sourness).',
  change: 'Sanitize everything properly, use sanitizer in the airlock, and reseat a popped stopper quickly.',
  aliases: ['wild microbes', 'wild', 'bacteria', 'infection', 'pellicle', 'lactic acid', 'sourness', 'funky'],
})
add({
  id: 'oxidation',
  title: 'Oxidation (stale, papery)',
  what: 'Oxygen getting into finished or slowing beer, giving cardboard or papery flavors.',
  how: 'While fermentation is strong, outgoing CO₂ protects the beer. With the stopper out or the airlock dry and little gas flowing, air gets in.',
  change: 'Keep the jug sealed, especially late in fermentation, and reseat a popped stopper quickly.',
  aliases: ['oxidation', 'oxygen', 'stale', 'papery', 'cardboard'],
})
add({
  id: 'conditioning',
  title: 'Conditioning',
  what: 'The quiet end stage after the bubbling stops. The beer clears and the flavor smooths out.',
  how: 'Most yeast settle, and the few still floating clean up some off-flavors. Cloudy “green beer” turns clear.',
  change: 'Wait. A few extra days here usually make better beer.',
  aliases: ['conditioning', 'green beer', 'clearing'],
})
add({
  id: 'strip',
  title: 'Strip thermometer',
  what: 'A sticker on the outside of the jug that lights up at the temperature of the glass.',
  how: 'It reads in 2-degree steps and shows the glass, which is close to the beer in a small jug but lags behind fast changes.',
  change: 'Turn it on or off under Sensors, or tap it on the schematic.',
  aliases: ['strip thermometer'],
})
add({
  id: 'gluten',
  title: 'Gluten-free vs gluten-reduced',
  what: 'Gluten-free beer is made without barley, wheat or rye (for example sorghum). Gluten-reduced is barley beer treated with an enzyme such as Clarity-Ferm.',
  how: 'The enzyme breaks gluten into pieces that standard tests cannot measure well, so in the US gluten-reduced beer cannot be labelled gluten-free, and most celiac guidance says to avoid it.',
  change: 'Choose a sorghum recipe in New batch.',
  aliases: ['gluten-free', 'gluten-reduced', 'clarity-ferm'],
})
add({
  id: 'tang',
  title: 'Sorghum tang',
  what: 'A tart, slightly sour edge typical of sorghum beers.',
  how: 'It comes from the sorghum syrup itself, not from an infection. It mellows with a few weeks in the bottle.',
  change: 'Blending in rice syrup softens it.',
  aliases: ['sorghum tang'],
})

// Longest phrases first so "dry and light" wins over "dry".
const ALIAS_LIST = Object.values(GLOSSARY)
  .flatMap((e) => e.aliases.map((a) => ({ a, id: e.id })))
  .sort((x, y) => y.a.length - x.a.length)

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const ALIAS_RE = new RegExp(`(?<![\\w-])(${ALIAS_LIST.map((x) => escape(x.a)).join('|')})(?![\\w-])`, 'gi')
export const aliasToId = (phrase: string) => ALIAS_LIST.find((x) => x.a === phrase.toLowerCase())?.id

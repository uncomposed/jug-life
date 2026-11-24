# Jug Twin

A fermentation simulator for a 1-gallon glass jug with a rubber stopper and an S-shaped airlock. It runs in a phone or desktop browser, with nothing to install.

**It is a simulation.** It is not connected to a real jug, and the model has not been checked against a real batch yet. Treat the numbers as plausible, not true.

## What you can do

- **A guided tour.** It opens on the first visit and walks through each part of the screen in 12 short steps. The Tour button brings it back.
- **Two views of the same jug.** The sensor view shows only what a brewer could actually see or measure: a stick-on strip thermometer, bubbles through the airlock, foam, haze and hand-taken gravity samples. Behind the curtain shows what is really going on: yeast multiplying and settling, sugar turning into alcohol and CO₂, self-heating, wild microbes.
- **Move time forward and back.** Scrub over three weeks. Every moment is precomputed, so rewinding is instant. If you go back and do something different, later actions are erased and the future re-runs.
- **Tap the jug.** Tap the airlock, stopper, a sensor, the gravity tag or the beer for a small pop-up with what you can change there.
- **Learn why.** Every hidden number has an ⓘ button, and underlined words in the tasting notes and log open a short explanation: what it is, what causes it, and what to try.
- **Do things to it.** Move the jug somewhere warmer or colder, add yeast nutrient, swirl it, fit a blow-off tube, refill the airlock, take a hydrometer or refractometer reading, and taste it.
- **Make mistakes safely.** Overfill it and the foam pops the stopper. Cold-crash it with a water-filled airlock and it sucks back. Skip sanitizing and it may sour. Each mishap is explained in plain language.
- **Gluten-free first.** The default recipe is a sorghum pale ale. A barley recipe is included for comparison, with the option of Clarity-Ferm, which makes beer "gluten-reduced", which is not the same as gluten-free.

## How it works

The model is a cut-down version of published beer fermentation models (Gee and Ramirez 1988, de Andrés-Toro 1998): yeast growth limited by sugar and nitrogen, slowed by alcohol and by temperature, plus a heat balance for the jug, CO₂ dissolving and venting through the airlock, foam height, and simple flavor indicators. It steps once a minute and saves a snapshot every 15 minutes.

Every constant lives in `src/model/params.ts` with a note on where it came from and how much to trust it. The same table is in the app under About.

Sensor tags on the schematic follow ISA-5.1 instrument naming (for example TI-101 for the strip thermometer). The plain grey scene with color reserved for alerts follows ISA-101 display practice. Colors avoid relying on red against green.

## What it does not show

- It is not validated. The constants were tuned so the curves look like typical homebrew logs. The first real test is logging an actual batch and comparing.
- Flavor is a rough indicator, not a prediction.
- The 20 ppm gluten-free threshold applies to ingredients and testing in the real world. The simulator only tracks which ingredients were used.

## Run it locally

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## Deploy

Pushing to `main` builds, tests and publishes the site to GitHub Pages through `.github/workflows/deploy.yml`. In the repository settings, set Pages to deploy from GitHub Actions.

# Wunder scale catalogue — research notes

Collected by web search (the wunder.it sites are blocked from the build environment). Sizes marked `est` are estimates. 
The shortlist below is the source of truth for the 30 models built in `src/scales/`.

# Wunder WebGL showroom: final model shortlist (critic pass)

**How this was checked.** This pass confirmed six items by web search: R2020, PL-VEGA, SUPERBABY, TPX-C, the Tarsie terracotta line (R150 Tarsie Cromata) and WBA300. The search budget then ran out (200/200), so I could not re-check SMART, HT, NHB, JSD DUAL, WP4-U, CX, WJ or the rest. For those I rely on the researchers' search results, and I mark each one.

**Conventions used in the recipes**
- Units are cm, with Y pointing up.
- "Head end" means the side with the column or display. The user steps on from the opposite end.
- On a floor piece, height is measured from the floor. On a pedestal piece, it is measured from the pedestal top.
- **No text anywhere.** LCDs are drawn as 7-segment digits built from small emissive quads. Logos are graphic marks, not text.

---

## 0. Changes and flags made against the research

| # | Issue | Action |
|---|---|---|
| 1 | **HT** was listed as industriale, but its only confirmed page is `medicale.wunder.it/it/laboratorio/1025-ht.html` | **Moved to MEDICALE** (it becomes the lab piece on a pedestal) |
| 2 | **R150A** (medicale) is the same body as the design R150. The design researcher said not to duplicate it | **Dropped from medicale** and kept as an alternate |
| 3 | Industriale lost a slot because of #1 | **Added NHB**. Its URL `industriale.wunder.it/it/precisione/110-nhb.html` and size (20×25×8, pan 14×15) come from the researchers' notes and were not re-checked. Fallbacks: WJ-6000, BILL, ECO, VT2 INOX |
| 4 | "**WXC**" indicator: the name appears in no URL. Every page slug says `indicatore-wx-con-piattaforma-…` | **Renamed to WX** |
| 5 | "**960 Tarsie**": the Tarsie terracotta platforms are confirmed for the R150/960 family. The only confirmed name is "R150 Tarsie Cromata" (WellStore). No design.wunder.it product page was found for either Tarsie item | Kept with a **descriptive label**. Its logo links to the design home page. Swap for **960 Nera** (sold by resellers) if a strict product name is needed |
| 6 | 960 Gold URL was found only under `/de/` | The `/it/` path is assumed to use the same slug. Check it |
| 7 | The design line has **no table-top models**. The earlier guess of kitchen, letter or luggage scales was made up. The kitchen scales on Wunder sites are Tanita products (KD321, KD400SV), which Wunder distributes but does not make | All 10 design pieces go on the floor. Use low floor pads (2 cm), **not** the vertical pedestal, which follows the user's rule |
| 8 | Some sizes are estimates: R2020 (all), WP4-U footprint, WPA, WX head, CX body, SMART/JPP bodies, RW2.0-SEDIA seat and rail heights. TPX-C forks are borrowed from its sibling TPS | Keep them, but tag them `est` in code |
| 9 | JSD vs JSB: the brand documents mention "JSB" (a bench counting scale). The researcher found the JSD DUAL page | Keep JSD DUAL. JSB is a possible alternate name to check |
| 10 | Brand flags: | |
| | • The "Golden Spider" award belongs to a different, Turkish company called Wunder | Do not use it |
| | • The placeholder SVGs in the user's old repos are not the official logo | Do not use them as the logo |
| | • Navy #1E3A5F comes from the ACS indicators and is not confirmed for WX | Leave it out unless the user confirms |
| | • Orange vs red: the brand documents contradict each other | Use red for the logo |
| 11 | Dial colours (white face, black ticks, red pointer) are assumptions | Keep them. A grey pointer is an acceptable alternative for the grey world |

---

## 1. Shared primitives (build these once)

- **VISORE** (the standard Wunder display head)
  - Rounded box 21.5 W × 4 H × 18 D, corner radius 2, tilted 20° toward the user. ABS off-white `#eeeeea`.
  - Main LCD window 12×3.5 (7-segment, emissive), plus a secondary window 8×2.
  - Used by R2020, DE20, RW2.0-SEDIA and BABY02-1.
- **WX head**
  - Rounded box 28×18×9 (`est`), tilted 15–18°.
  - Emissive LCD strip 22×7 and a keypad grid of 20–22 small boxes (1.6×0.3×1.4).
- **DIAL** (mechanical scales)
  - Housing: cylinder Ø20 × 5.5–7. Bezel: torus R10, tube 0.7.
  - Face: disc Ø18, `#f4f4f0`. Ticks: 50 thin boxes, every 5th one longer.
  - Pointer: box 7.5×0.25×0.1. Dome: sphere scaled to 0.15 in Y, transparent.
- **CASTER**: cylinder Ø7.5 × 3, plus a fork box 3×5×4.
- **STEEL / RUBBER materials**
  - Stainless: `#b8bcc0`, metalness 1, roughness 0.3.
  - Rubber mat: `#1e1e1e`, roughness 0.9.
  - Metals need an environment map (PMREM from RoomEnvironment) or chrome will look black.
- **PEDESTAL** ("vertical rectangle" for table pieces)
  - Box: top = the scale's footprint + 10 cm on each side. Height 85 cm (baby and retail) or 95 cm (lab and precision).
  - Colour `#d9d9d9`, with a Ø12 logo disc on the front face near the top.
- **LOGO_DISC**: see section 5.
- **ARROW SIGN**: a small plate carrying 4 keycap tiles (an up/left/down/right cluster), each with a chevron built from 2 thin boxes. No letters.

---

## 2. MEDICALE: 10 models (6 floor, 4 pedestal). Division tag `#009ADE`

| # | Model | Place | Geometry recipe (cm) |
|---|---|---|---|
| 1 | **R2020**: digital column with the stadiometer built into the column (weight, height, BMI). Verified | floor | Platform box 36×6×40 (`est`) with mat 32×0.8×34. 2 rear wheels, cylinders Ø5×2. Column box 6×205×4 at the head end. Stadiometer slider box 8×4×6 at y=175, plus a headpiece paddle 25×1×5 projecting over the platform. VISORE at y≈108 with 2 LCDs. Grab bar: tube Ø2.5, 30 wide, at y=118. Light grey. |
| 2 | **C202**: mechanical steelyard column with telescopic stadiometer | floor | Overall 45×150×60. Base box 27.5×11.5×53 with black rubber top 25×1×45. 4 feet, cylinders Ø3×1.5. 2 wheels Ø5 at the head end. Column box 8×120×6. Head box 12×12×10 at y=132–144. Beam box 45×1.5×3, running side to side at y≈140. Poises: boxes 4×3×4 and 2.5×2×3. Pointer housing 3×6×3 with a blade 0.3×4×0.5. Telescopic rod: 3 nested bars 2×60×1 behind the column, reaching up to 190. Headpiece arm 20×1.5×3. White, with an aluminium-grey beam. |
| 3 | **DE20**: electronic chair scale | floor | Overall 59×96×104. Base frame: tubes Ø3 forming a 55×70 rectangle at y=12. 4 CASTERs. Seat box 55×6×40 at y=50. Backrest 50×40×5, reclined 8°, from y=56 to 96. 2 armrest pads 40×4×6 at y=70 on posts (tube Ø2.5). Footrest plate 40×1.5×20 at y=10, 25 cm forward on 2 tube brackets. Push-handle tube Ø3, 50 long, at y=96. VISORE on top of the backrest, facing the operator. Grey upholstery (red is optional as a single accent). |
| 4 | **RW2.0-SEDIA**: wheelchair platform with handrail and fold-down seat | floor | Overall 84×95×116. Platform box 74×6.5×90 with dark top 72×0.5×88. 2 wedge ramps (ExtrudeGeometry triangle), 74 wide × 13 deep × 6 high, one at the front and one at the back. Handrail on one long side: 2 posts (tube Ø3, 90 tall), 80 apart; top rail tube Ø3 at y=92 with quarter-torus bends. Seat box 40×3×35 at y=48, folded down over the platform. VISORE on the front post. 4 swivel wheels Ø5. Grey platform, white rails. |
| 5 | **PL-VEGA**: bed scale. Verified: 222 × 100.5–102 × 40–83.5 H, 4 sections, 4 load cells | floor, wide bay (≥300×180) | Chassis tubes 5×5 forming a 190×80 frame at y=15, with 4 casters Ø10. Lift: 2 X-shaped pairs of struts (box 8×60×5) near the ends. Deck at y≈58, made of 4 mattress boxes 90 wide × 7.5 thick: head 60 long raised 30°, back 45, seat 30, legs 65. Headboard and footboard panels 100×40×3. Side rails: tubes Ø3 at deck +30 on posts Ø2. Controller box 20×12×6 at the foot end. White frame, mattress `#6e6e6e`. |
| 6 | **WBA300**: column BIA analyzer with printer. Verified: painted aluminium base, 4 stainless electrodes, ABS head | floor | Overall 45×88×55. Base box 45×8.5×34, corner radius 3. 4 electrodes, boxes 8×0.3×12, bright steel (metalness 1, roughness 0.2), at x=±10 and z=±8. Column foot box 14×3×21. Column 10×75×5. Head box 30×6×20 tilted 25°, with LCDs 14×4 and 12×6 and a 4×5 key grid. Printer box 10×5×8 on top, with a dark slit 6×0.3. |
| 7 | **BABY02-1**: baby scale with column display (Milk-Intake) | pedestal (top 76×65) | Overall 56×46×45. Base: rounded box 56×5×45 on 4 feet Ø2×1. Tray: half-ellipsoid (sphere with bottom-half theta range) scaled to (28, 9, 14.5), double-sided, top at y=14. 2 anti-tip torus arcs (R12, tube 0.5) at the tray ends. Column 4×41×4 at the rear centre. VISORE on top. White ABS. |
| 8 | **SUPERBABY**: mechanical steelyard baby scale. Verified: painted metal case, ABS convex tray, double poise (kg/g) | pedestal (top 67×51) | Body box 47×5.5×25.5, white. Tray: half-ellipsoid scaled to (28, 7, 15.5), i.e. 56×31, top at y≈14, on a stem 4×6×4. Beam box 45×2×1 along the front edge at y=4, with a darker tick strip. Poises: boxes 3×2.5×2 (kg) and 1.5³ (g). Pointer housing 4×5×3 at the right end, with a blade 0.2×4×0.5. |
| 9 | **BABY02-2**: compact baby scale, display in the front (Peso-Milk) | pedestal (top 76×65) | Overall 56×14.5×45. Base: rounded box 56×6×45. Tray: half-ellipsoid scaled to (28, 8, 14.5) over the rear two-thirds. Display panel 21.5×18, sloped 20°, at the front centre, with a 5-digit LCD 14×3.5, a small LCD 6×2 and 4 button caps (cylinders Ø1.5×0.4). |
| 10 | **HT**: analytical balance 220 g / 0.1 mg with glass draft shield (medicale laboratorio). **Moved from industriale** | pedestal (top 48×40, height 95) | Overall 27.5×31.4×20. Base box 27.5×7×20. Front slope with an 8-digit LCD 12×2.5 and 7 keys. Rear tower 27.5×31×5. Draft shield: glass box 25×22×15 in MeshPhysical (transmission 0.9, roughness 0.05); fallback is opacity 0.2. 12 grey edge bars 0.5×0.5. Door panes offset 0.3. Pan cylinder Ø8×0.3 on a spindle Ø0.6×3. Splash ring: torus R5, tube 0.2. |

**Medicale alternates** (real models): R150A (only if the design R150 is dropped), RB COLONNA, RE300, RW-XL, RW3.0, Fasciatoio Baby02 (floor), HR1, WHT (pedestal).

---

## 3. INDUSTRIALE: 10 models (5 floor, 5 pedestal). Division tag `#FFB300`

| # | Model | Place | Geometry recipe (cm) |
|---|---|---|---|
| 1 | **WP4 1212 + WX indicator** (`/piattaforme-con-indicatore/…indicatore-wx-con-piattaforma-wp4`) | floor | Slab box 120×8×120 with a 1 cm chamfer. Knurled top: procedural diamond-pattern CanvasTexture used as a normal map. 4 feet Ø6×5, inset 5, so the top sits at 13. Junction box 10×4×6 on the side. Optional ramp wedge 120 wide × 45 deep × 8 high. Indicator 30 cm beside the slab: base plate Ø35×1.5, stainless tube Ø4 × 100, WX head on top. Floor cable: TubeGeometry Ø0.6. Epoxy `#4a4a4a`. |
| 2 | **WP4-U**: U-shaped pallet platform | floor | 2 arms 22×8×125 plus a rear crossbar 105×8×22, giving an outer footprint of 105×125 (`est`) and a 61 cm opening. 4 feet Ø5×5, so the top sits at 13. Handle on the crossbar: TubeGeometry U shape, 40 wide × 15 high, tube radius 1.5. 2 wheels Ø8×3 on the rear face. Optional small WX head on a 58 cm column. |
| 3 | **TPX-C**: pallet-truck scale with piece counting. Verified: 3 fields, green/yellow/red bar, 4 cells | floor | Forks: 2 boxes 16×8.7×115, outer width 55 (TPS data). Chamfered tips. Load rollers Ø8×6 under the tips. Rear chassis 55×20×25. Pump cylinder Ø8×28. 2 steering wheels Ø18×5 `#2b2b2b`. Tiller: tube Ø3 × 115, leaning back 15°, ending in a rounded-rectangle loop 30×20 (TubeGeometry). Indicator box 32×18×10 facing the operator, with a 3-field LCD 24×7 and a colour bar 24×1.5 (green/yellow/red emissive). Paint `#7a7a7a`. |
| 4 | **Indicatore WX con piattaforma WPA** | floor | WPA base 40×9×50 (`est`), vertical edges rounded r3, light grey. Stainless plate 40×1.2×50 with a 0.2 shadow gap. 4 feet Ø5×3. Bracket 8×6×6 at the rear centre. Column Ø4.5 × 100. WX head tilted 18°. Total height about 115. |
| 5 | **DINAMOMETRO CX**: crane scale 3/5/10 t, hung from a display gantry (the gantry is scenery, not a product) | floor | Gantry: 2 posts 8×230×8, 180 apart; beam 190×10×10; foot plates 40×2×30. CX body: rounded box 22×28×12 (`est`), grey aluminium. Window 17×6 with red emissive 7-segment digits `#ff2a1a`. Keypad strip 17×2. Shackle: half-torus R6, tube 1.25, plus a pin Ø2.5×14. Swivel cylinder Ø4×4. Hook: torus arc (R5, tube 1.2, 1.4π) plus a latch 0.5×6×1. Display centre at y=160. |
| 6 | **JSD DUAL**: counting scale with a remote WPE platform. Body 31×33×12 confirmed | pedestal (top 80×50) | Body 31×12×33, front 10 cm sloped 20°. 3 LCDs 8.5×2.5, each with its own emissive colour (R/G/Y). 4×5 keypad. Pan 29×1×22 on a 1.5 cm spider. WPE: base 25×7×27, pan 23×0.8×23, 4 feet. Cable: tube Ø0.5. |
| 7 | **SMART**: retail price scale for 4 operators | pedestal (top 55×56) | Body 34×11×36 (`est`), sides tapered slightly. Sloped LCD 26×5. 6×8 alphanumeric key grid, plus 4 larger operator keys 2.2×0.3×1.2 on the left. Pan 34×1×24. Column Ø3.5 × 40 at the rear. Two-sided head 30×8×6 with LCDs on the front and back. |
| 8 | **JPP**: retail scale with built-in printer. Pan 37×24 and column 48 confirmed | pedestal (top 58×58) | Body 38×12×38 (`est`). Pan 37×1×24. Printer housing 12×8×14 at the front-right, with a slot 6×0.3 and a paper-label plane 5×4. PLU keypad 8×4 sloped 15°. Column Ø3.5 × 48. Two-sided head 32×8×7. About 62 tall. |
| 9 | **WJ 600**: precision balance. Body 20×22.5×8 and pan Ø11.5 confirmed | pedestal, shared with NHB (top 70×45, height 95) | Body 20×8×22.5, front slope 15°. LCD 10×3. 6 keys 1.8×0.3×1. Pan: cylinder Ø11.5×0.4 on a spindle Ø1×1.5. 4 feet Ø1.5×0.5. Bubble-level disc Ø1.5. |
| 10 | **NHB**: precision balance (**replaces HT**) | same pedestal as WJ | Body 20×8×25. Rectangular pan 14×0.4×15 on a 1 cm spider. LCD 10×3, 5 keys, 4 feet. |

**Industriale alternates**: WJ-6000, BILL (red LED on both faces), ECO, VT2 INOX (floor), WBX, TPS, TPR, DINAMOMETRO CS (16×26.5×8.5), JSC.

---

## 4. DESIGN: 10 pieces, all floor. Division tag `#116374`

**The design catalogue has only 2 real body shapes.** Each of the 10 pieces is one of those two bodies with a different finish.

**`build960(finish, platform)`**: overall 27×20×40
- Base: rounded box 27×5×31, corner radius 3, on 4 feet Ø2×0.5.
- Platform insert 26×1.2×30, top at 6.2.
- Neck at the head end: an extruded trapezoid, 14 wide at the bottom and 10 at the top, 9 deep, 6 tall.
- DIAL: housing cylinder Ø20×5.5, **tilted 45°** so the face points up and back toward the user. Centre at y≈13, top at 20.

**`buildR150(finish, platform)`**: overall 27×90×40
- Base: rounded box 27×8×40, with the mat 26×1.2×30 over the user end.
- Collar at the head-end centre: truncated cone Ø10 to Ø5, 6 tall.
- Column: cylinder Ø5 × 72.
- DIAL: housing Ø20×7, **tilted back 15–20°**, centre at y≈80, top at 90.

**Finishes**
- Chrome: `#e8e8e8`, metalness 1, roughness 0.15.
- Gold: `#c9a55a`, metalness 1, roughness 0.25. This is the only warm object in the room.
- Bianca: `#f2f2f0`, metalness 0, roughness 0.6.
- Glass platform: MeshPhysical, transmission 0.9, ior 1.5, attenuation colour `#cfe6e3`.
- Tarsie platform: CanvasTexture of tiles in `#b5553c #d2a25a #e8dcc4 #6b6f73 #2e2e2e` (stripe or tessera pattern), roughness 0.5, platform thickness 1.8.
- Rubber mat: `#1e1e1e`.

| # | Model | URL (design.wunder.it) | Build |
|---|---|---|---|
| 1 | 960 Bianca | `/it/960/1-960-bianca.html` | 960, white, rubber mat |
| 2 | 960 Chrome | `/it/960/3-960-chrome.html` | 960, chrome, rubber mat |
| 3 | 960 Glass | `/it/960/4-960-glass.html` | 960, chrome, clear glass plate |
| 4 | 960 Gold | `/de/960/6-960-gold.html` (the `/it/` path is assumed) | 960, gold, rubber mat |
| 5 | 960 with Tarsie platform (**flagged name**; alternate: 960 Nera) | design home page | 960, chrome, Tarsie texture |
| 6 | R150 Bianca | `/it/r150-classiche/7-r150-bianca.html` | R150, white, rubber mat |
| 7 | R150 Chrome | `/it/r150-classiche/8-r150-chrome.html` | R150, chrome, rubber mat |
| 8 | R150 Glass | `/it/r150-classiche/9-r150-glass.html` | R150, chrome, glass plate |
| 9 | R150 Gold | `/it/r150-classiche/10-r150-gold.html` | R150, gold. Put it at the centre of the gallery |
| 10 | R150 Tarsie Cromata (verified at WellStore: chrome with terracotta inlay, 150 kg / 500 g) | design home page | R150, chrome, Tarsie texture |

**Gallery layout**: 2 rows of 5 (a 960 row and an R150 row). Each piece sits on a 60×60×2 floor pad with its own spotlight.

---

## 5. Brand identity

**Colours** (from the user's own brand documents)
- Wunder Red `#D90000`: the main logo and corporate colour.
- Division colours: Medicale `#009ADE`, Industriale `#FFB300`, Design `#116374` (dark teal). Corporate has no division colour.
- Arancio `#E86100` is a secondary colour only, because the documents conflict about it.
- Do **not** use ESA elements: orange `#FF5F1F`, Montserrat, Bebas Neue, Roboto. The brand rules call mixing ESA and Wunder a blocker.

**Logo**
- Confirmed:
  - The monogram is a white "W" on a red circle.
  - The logo system is the red main logo plus a coloured division tag.
  - The official masters are SVG and PNG files held by the Wunder graphics office.
  - Brand rule: logos are never stretched, recoloured or rebuilt.
- Not confirmed: the wordmark's case and typeface, and whether it has arcs or a swoosh.
- Recommended build: ask the user for the official SVGs, then load them with `SVGLoader` → `createShapes` → a thin `ExtrudeGeometry` (0.2–2 cm).
- Placeholder until the SVGs arrive:
  - Red disc with a white "W" made of 4 slanted bars, each 0.16R wide × 0.9R tall. Outer bars lean ±18°, inner bars ±12°.
  - Division version: add a rounded bar 0.9R × 0.18R underneath, in the division colour.
  - Leave out the wordmark and tagline ("Inspired by precision"), because the user wants no text.

**Where the logos go (all clickable)**
- Entrance totem and reception wall → corporate site.
- Framed wall "paintings" in each wing → that wing's line home page.
- A small disc on every scale (on the display head or base) → that scale's product page.
- A disc on every pedestal front → the product page.

**Click handling**: tag each logo mesh with `userData.url`. On pointerup, raycast and call `window.open(url, '_blank', 'noopener')`.

**URLs** (remove the `?_ga=` part the user pasted)
- Corporate: `https://www.wunder.it/` (EN: `/en/`)
- Medicale: `https://medicale.wunder.it/it/` (EN: `/gb/`)
- Industriale: `https://industriale.wunder.it/it/`
- Design: `https://design.wunder.it/it/`

**Company**: Wunder Sa.Bi. Srl, Trezzo sull'Adda (MI). It has made scales in Italy for more than 50 years.

---

Sources:
- [R2020 – medicale.wunder.it](https://medicale.wunder.it/it/pesapersone-digitali/1478-r2020.html)
- [R2020 – wunder.it news](https://www.wunder.it/r2020-peso-e-altezza-in-un-solo-dispositivo/)
- [PL-VEGA – medicale.wunder.it](https://medicale.wunder.it/it/letti-bilancia/1018-pl-vega.html)
- [PL-VEGA – SIVA](https://portale.siva.it/it-IT/databases/products/detail/id-20935)
- [SUPERBABY – medicale.wunder.it](https://medicale.wunder.it/it/pesaneonati/1021-superbaby.html)
- [SUPERBABY – medisanshop](https://www.medisanshop.com/bilancia-pesaneonati-a-stadera-meccanica-wunder-superbaby.html)
- [TPX-C – industriale.wunder.it](https://industriale.wunder.it/it/transpallet-pesatori/1396-tpx-c.html)
- [TPX-C – sinergica](https://www.sinergica-soluzioni.it/transpallet-bilancia-con-contapezzi-tpx-c.html)
- [R150 Tarsie Cromata – WellStore](https://www.wellstore.it/Misurazione-Bilance-pesa-persona/1224/Wunder-R-150-Tarsie-Cromata.html)
- [R150A/960A catalogue – medicalexpo](https://pdf.medicalexpo.it/pdf/wunder/r150-960/70564-162372.html)
- [WBA300 – Gima](https://www.gimaitaly.com/Prodotti/scales-and-measures/medical-adult-scales/digital-stand-scales/wunder-wba300-body-composition-analyser-with-printer-300-kg-class-iii-25015)
- [WBA300 – securlab](https://www.securlab.it/bilance-digitali/17946-wunder-wba300-analizzatore-di-composizione-corporea-con-stampante.html)


---

## Raw research per line


### MEDICALE (medicale.wunder.it)


#### R2020 — floor (medium)

- category: Digital column scale for people, with the stadiometer built into the column (weight, height and BMI)
- url: https://medicale.wunder.it/it/pesapersone-digitali/1478-r2020.html

The published specs do not give overall dimensions, so these are estimated from the category and look. PLATFORM: a low rectangular box about 36 W x 40 D x 6 H cm with a dark-grey rubber non-slip mat inset (removable), and 2 small rear transport wheels (optional, cylinders about 5 cm diameter) at the back edge. COLUMN: a slim rectangular upright rising from the rear edge of the platform, about 6 x 4 cm in section and about 200-210 cm tall, because the stadiometer is part of the column (range up to about 210 cm). STADIOMETER HEADPIECE: a thin horizontal paddle about 25 x 5 x 1 cm on a small slider block that sits on the column's front face, parked at about 175 cm. DISPLAY: the standard Wunder rounded display head, 21.5 W x 18 D cm, 3-4 cm thick and tilted about 20 deg toward the user, on the column at about 105-110 cm, with 2 LCD windows (a large weight window above a smaller one for height/BMI). HANDLE: a small ergonomic grab bar just above the display. COLORS: white/light-grey body, dark-grey mat, dark display glass.


#### C202 — floor (high)

- category: Mechanical steelyard (beam) column scale for people, with telescopic stadiometer
- url: https://medicale.wunder.it/it/pesapersone/1003-c202.html

Overall 45 W x 60 D x 150 H cm. BASE/PLATFORM: box 27.5 W x 53 D x 11.5 H cm with a black/dark-grey rubber top, 2 small transport wheels at the rear, and 4 adjustable feet. COLUMN: rectangular sheet-metal upright about 8 x 6 cm in section, 120 cm tall, rising from the rear of the base. HEAD: at the top of the column, a small housing box about 12 x 10 x 12 cm with a horizontal steelyard beam (bar about 45 cm long, 3 x 1.5 cm section) running sideways across it. It has 2 slider weights (small boxes, a large kg poise and a small fine poise) and a balance pointer at one end. STADIOMETER: a telescopic rod (2-3 nested thin rectangular bars about 2 x 1 cm) on the back of the column, reaching about 150 cm when retracted and up to 212 cm extended, topped by a hinged horizontal headpiece arm about 20 cm long. COLORS: white epoxy-painted metal, zinc/aluminium-grey beam, black rubber platform.


#### R150A — floor (high)

- category: Mechanical column scale for people, with a round dial
- url: https://medicale.wunder.it/it/pesapersone/1000-r150a.html

Overall 31 W x 50 D x 100 H cm. BASE: a slightly trapezoidal box 24 cm wide at the rear and 31 cm at the front, 39 cm deep and 11 cm high, with a platform inset of about 26 x 30 x 8.5 cm (metal with a black rubber insert). COLUMN: a round tube 6 cm in diameter and 90 cm tall, rising from the rear of the base. DIAL: a round clock-type dial 18 cm in diameter (a cylinder 18 cm across and about 5 cm deep) on top of the column, facing the user and tilted about 15-20 deg upward, with a thin glass disc, a white face and a red needle. COLORS: white (standard), with Glass/black and Gold finish variants. The structure is epoxy-painted aluminium and the rubber is black. Very distinctive 'lollipop' outline.


#### DE20 — floor (high)

- category: Electronic chair scale for people (disabled/obese patients)
- url: https://medicale.wunder.it/it/ausili/1477-de-20.html

Overall 59 W x 104 D x 96 H cm, seat area 55 W x 40 D cm. FRAME: painted metal tube (tube diameter about 2.5-3 cm) forming a wheeled chair chassis with 4 swivel casters (about 7.5 cm diameter) at the corners of a low rectangular base frame about 55 x 70 cm. SEAT: a padded cushion box 55 x 40 x 6 cm at about 50 cm height. BACKREST: a padded panel 50 W x 40 H x 5 cm, slightly reclined. ARMRESTS: 2 tubular armrests with pads (about 40 x 6 x 4 cm) at about 70 cm height, able to fold up 90 deg. FOOTREST: a small plate about 40 x 20 cm on a tube bracket, projecting forward about 25 cm at about 10 cm height (this makes the 104 cm depth). PUSH HANDLE: a padded horizontal bar across the top-back at about 96 cm. DISPLAY: the WU150 rounded ABS display head (about 21.5 x 18 cm) on an adjustable bracket at the top of the backrest/handle, facing the operator. COLORS: the seat and backrest upholstery is red as standard (grey, black and white are also offered); the frame is light grey/white. In a grey world, use grey upholstery or keep a single red accent.


#### RW2.0-SEDIA — floor (medium)

- category: Wheelchair platform scale (pesacarrozzine) with handrail and a fold-down seat
- url: https://medicale.wunder.it/it/bilance-con-corrimano/1386-rw20-sedia.html

Overall about 84 W x 116 D x 95 H cm, taken from RW02/RW2.0-family data. PLATFORM: a flat plate 74 W x 90 D cm, about 6-7 cm tall, with tubular metal ribs underneath. RAMPS: 2 wedge ramps (wedge solids 74 W x about 13 D x 6 H cm), one at the front and one at the back (double entry/exit). HANDRAIL: a tubular U-frame (tube diameter about 3 cm) along one long side of the platform: 2 vertical posts about 90 cm tall joined by a horizontal rail at about 90-95 cm. SEAT: a hinged fold-down seat panel about 40 x 35 x 3 cm, mounted on the handrail at about 48 cm height, shown folded down and facing the platform. DISPLAY: the standard ABS display head (21.5 x 18 cm) on an adjustable support at the top of one handrail post. WHEELS: 4 small 360-deg swivel wheels at the handrail-side corners. COLORS: grey-painted metal platform with a dark-grey non-slip surface and white/grey rails (RW02 is also sold in a red platform version).


#### PL-VEGA — floor (medium)

- category: Bed scale for therapy, blood draws, dialysis/nephrology and bariatric patients
- url: https://medicale.wunder.it/it/letti-bilancia/1018-pl-vega.html

Overall 222 L x 100.5-102 W x 40-83.5 H cm (height adjusts). BASE: a low steel-tube rectangular chassis about 190 x 80 cm, 15 cm high, with 4 casters (about 10 cm diameter). LIFT: 2 motorized folding/pivoting arms (angled beams about 8 x 5 cm in section) linking the base to the deck, like a pair of X or A struts, one near each end. DECK: a mattress platform about 200 x 90 cm made of 4 hinged sections (head, back, seat, legs). Model the head section raised about 30 deg and the rest flat, each a padded box 7-8 cm thick, at about 60 cm height. RAILS: optional side rails (thin tubular horizontal bars about 3 cm diameter at about +30 cm above the deck) along both long sides. Headboard and footboard panels about 100 W x 40 H x 3 cm. A small display/controller box hangs at the foot end. COLORS: painted steel tube frame (light grey/white, anti-bacterial BIOMASTER finish) and a mid/dark-grey mattress. This is the largest and most dramatic floor piece, so give it a wide spot.


#### WBA300 (WBA body composition) — floor (high)

- category: Column body composition analyzer (BIA), foot-to-foot, with built-in printer
- url: https://medicale.wunder.it/it/pesapersone/1004-wba.html

Overall 45 W x 55 D x 88 H cm. BASE: a painted aluminium platform 45 W x 34 D x 8.5 H cm with 4 stainless-steel foot electrodes on top: 4 thin metal plates about 8 x 12 x 0.3 cm arranged as 2 heel and 2 toe pads, left and right, in a bright metallic finish. COLUMN: a rectangular painted-aluminium upright 10 W x 5 D x 75 H cm, rising from the rear of the base (the base plus the rear column foot gives the 55 cm depth). HEAD: an ABS display/keypad housing about 30 W x 20 D x 6 H cm, tilted about 25 deg, with 2 LCD windows (a large weight window and a smaller multiline window) and a 20-key pad. It has a thermal printer slot on top (a small box about 10 x 8 x 5 cm with a paper slit). COLORS: white/light-grey body, silver electrodes, dark display.


#### BABY02-1 — table (high)

- category: Electronic baby scale (pesaneonati) with a column display and double display (Milk-Intake function)
- url: https://medicale.wunder.it/it/pesaneonati/1019-baby-02-1.html

Overall 56 W x 45 D x 46 H cm, weight 4.8 kg. BASE: a flat rounded-rectangle ABS slab 56 x 45 x 5 cm on 4 adjustable feet. TRAY: a curved bathtub-style weighing tray 56 L x 29 W cm, 8-10 cm deep, with rounded raised ends (a stretched half-capsule/shallow U section), sitting on the front part of the base at about 8-15 cm height. SAFETY BARS: 2 thin anti-tipping bars (tubular arcs about 1 cm diameter) at the tray ends. COLUMN: a slim post about 4 x 4 cm rising behind the tray from the rear of the base to 46 cm. DISPLAY: the rounded display head (21.5 W x 18 D x 4 cm), tilted toward the operator, on top of the column, with a 20 mm weight LCD and a 12 mm secondary LCD. COLORS: white ABS tray and base, dark display window.


#### SUPERBABY — table (medium)

- category: Mechanical steelyard (beam) baby scale
- url: https://medicale.wunder.it/it/pesaneonati/1021-superbaby.html

Body 47 L x 25.5 D x 5.5 H cm. The weighing tray is listed as 56 x 31 cm and weighs 1.8 kg. BODY: a flat painted-metal box 47 x 25.5 x 5.5 cm. TRAY: a convex/concave curved ABS tray 56 L x 31 W cm, about 6-8 cm deep with raised rounded ends, sitting on the body (tray top at about 14 cm). BEAM: along the front long edge of the body, a horizontal steelyard bar about 45 cm long and 2 x 1 cm in section (galvanized aluminium with printed scale) carrying 2 slider weights: a large kg poise block about 3 x 2 x 2.5 cm and a smaller gram poise. INDICATOR: at one end, a small pointer/counter-pointer housing about 4 x 3 x 5 cm. COLORS: white painted body, white tray, silver beam, dark sliders. The classic look is a clear contrast to the digital baby scales.


#### BABY02-2 — table (high)

- category: Compact electronic baby scale (display integrated in the front, Peso-Milk function)
- url: https://medicale.wunder.it/it/pesaneonati/1020-baby-02-2.html

Overall 56 W x 45 D x 14.5 H cm. BASE: a low rounded-rectangle ABS body 56 x 45 x 6 cm. TRAY: a curved bathtub-style tray 56 L x 29 W cm, 8 cm deep with rounded raised ends, on the rear two-thirds of the base (top at about 14.5 cm). DISPLAY: a rounded display area 21.5 W x 18 D cm, set as a sloped panel (about 20 deg) at the centre front edge of the base in front of the tray, with a 25 mm 5-digit weight LCD and a second small LCD for Peso-Milk. A few flat button caps sit beside it. COLORS: white latex-free ABS, dark display window. This low, compact outline complements the tall-column BABY02-1.


Notes: SOURCES AND ACCESS: WebFetch and curl were blocked for every domain I tried, not just wunder.it. This included medisanshop, doctorshop, gimaitaly, medicalexpo, SIVA, gardhenbilance and amazon.it. All data comes from WebSearch result snippets, drawn from the product pages listed plus reseller listings (medisanshop, doctorshop, ivymedicalshop, gbmedicali, fitmax, cfs, bilanceblasi, securlab). All model names are real Wunder medical models found on medicale.wunder.it URLs.

CONFIDENCE ON DIMENSIONS:
- Published and reliable: C202 (45x60x150, base 27.5x53x11.5, column 120, stadiometer 60-212 cm), R150A (31x50x100, column diameter 60 mm x 900, dial diameter 180), DE20 (59x104x96, seat 55x40), WBA300 (45x55x88, column 10x5x75, base 45x34x8.5), BABY02-1 (56x45x46, tray 56x29), BABY02-2 (56x45x14.5), PL-VEGA (222 x 100.5 x 40-83.5), and the RW family platform 74x90 cm with overall 84x116x95 (RW02/RW2.0).
- Estimated: R2020 overall and platform dimensions were NOT found in any snippet; only the capacity (150/200 kg) and display size (215x180) are published. Model the column at about 2.1 m because the stadiometer is part of the column. SUPERBABY dimensions conflict between snippets (body 470x255x55 vs tray 560x310), so use the body plus a larger tray. Seat and handrail heights for RW2.0-SEDIA are estimates.
- Wunder's shared 'visore' (display head) is ABS, about 21.5 x 18 cm, with a 20 mm weight LCD and a 12 mm multiline LCD. It can be reused as one shared primitive across R2020, RW2.0, DE20, BABY02 and RB.

COLORS: most medical items are white or light grey with black/dark-grey rubber mats, which suits the grey world. DE20 upholstery is red as standard (grey, black and white also exist), and RW02 is sold in red. Those are good single accent pieces or can simply be greyed.

ALTERNATES (real models, if a swap is needed):
- RB COLONNA: slim digital column, 27.5x56x82 cm, column diameter 6 x 75 cm.
- RE300: economical column, platform 31x31, overall 31x44x97.
- RW02: platform with handrail and ramps, the red version.
- RW2.0-MOVE and RW3.0: folding platform, RW3.0 with a reclining seat.
- RW-XL: low-profile bed/stretcher platform with ramp.
- Fasciatoio Baby02: baby changing cabinet with built-in scale, 93x75x133 cm, grey/black, floor.
- HR1: portable stadiometer, floor base 36x52 cm, rod to 201.5 cm.
- WH200: stadiometer rod, 3.5x5.5x94 cm.
- WHT: folding infant length board, 110x28x7.5 cm, table.
- C201: steelyard column scale related to C202.
- The TANITA BC613/BC601 BIA products are distributed by Wunder but are Tanita models, not Wunder-designed.


### INDUSTRIALE (industriale.wunder.it)


#### WP4 (4-cell floor platform, e.g. WP4 1212) with WXC indicator on stainless column — floor (high)

- category: 4-cell floor platform (piattaforme 4 celle) + weight indicator
- url: https://industriale.wunder.it/it/piattaforme-4-celle/154-wp4.html

Platform: square slab 120 x 120 cm (the WP4 1212 size; the WP4 1215 is 120 x 150), 8 cm thick (confirmed 'ultra-flat 80 mm'). The top is knurled/non-slip, so use a faint diamond grid in a normal or procedural texture. Chamfer the top edge about 1 cm. 4 hinged adjustable stainless feet (cylinders about 6 cm diameter x 5 cm) at the corners, inset 5 cm, for a total height of 13 cm (confirmed 130 mm with feet). A small steel junction box (10x6x4 cm) sits on one side edge. Optional access ramp (the RAMPA WP4 120cm accessory exists): a wedge 120 cm wide x about 45 cm deep, rising from 0 to 8 cm and butting against one edge. Indicator: the WXC is an ABS box of about 26 W x 17 H x 9 D cm (estimate) with the front face tilted 15 deg. It has a wide 3-colour backlit LCD window of about 20x6 cm (display it with an emissive strip) and a 22-key membrane pad (a grid of tiny raised boxes). Mount it on a stainless column (tube about 4 cm diameter, 100 cm; the 'COLONNA ACCIAIO INOX (H)100cm' accessory exists) standing on a round base plate (35 cm diameter x 1.5 cm) about 30 cm beside the platform, with a thin cable (tube 0.6 cm diameter) running along the floor to the junction box. Colors: dark grey epoxy platform, satin stainless column/feet, light grey ABS indicator. Combined product page: https://industriale.wunder.it/gb/platforms-with-indicator/1288-indicatore-wx-con-piattaforma-wp4.html


#### WP4-U — floor (medium)

- category: U-shaped pallet weighing platform (pesapallet a U, 4 load cells)
- url: https://industriale.wunder.it/it/piattaforme-4-celle/155-wp4-u.html

A U-shaped low frame seen from above: two parallel arms, each about 22 cm wide x 125 cm long, joined at the back by a crossbar about 22 cm deep spanning the full outer width of about 105 cm. That leaves an open front slot about 60 cm wide x 103 cm deep, so a pallet truck can drive in (outer footprint dimensions are an estimate based on EUR-pallet use). Frame height: about 8-10 cm (sources say 80-98 mm), or 13 cm with feet. The top is knurled non-slip, dark grey epoxy paint. 4 small stainless feet (cylinders 5 cm diameter) at the arm ends and rear corners. On the back crossbar: a carrying handle (a torus-segment or bent tube loop 40 cm wide, rising 15 cm) plus 2 small transport wheels (cylinders 8 cm diameter x 3 cm) on the rear face. Place a small indicator on a short stand beside it, or reuse the WXC-on-column from the WP4 build. A strongly readable silhouette next to the solid WP4 slab.


#### TPX-C — floor (high)

- category: Pallet-truck scale with piece counting (transpallet pesatore contapezzi)
- url: https://industriale.wunder.it/it/transpallet-pesatori/1396-tpx-c.html

Classic manual pallet truck. Forks: two box beams 115 cm long x 16 cm wide x 8.7 cm high, outer width across both forks 55 cm, gap between forks about 23 cm (1150x550x87 mm comes from the sibling TPS; TPX-C assumed the same chassis). Fork tips are chamfered, with small load rollers (cylinders 8 cm diameter) under the tips. Rear chassis: a block about 55 W x 25 D x 20 H cm joining the forks. On it sits a vertical hydraulic pump cylinder (8 cm diameter x 28 cm) and 2 twin steering wheels (cylinders 18 cm diameter x 5 cm, polyurethane, dark). Tiller: a tube 3 cm diameter x 115 cm leaning back about 15 deg from vertical, ending in a loop handle (a rounded rectangle about 30 x 20 cm, or a torus segment) with a small thumb lever. Weighing head: an indicator box about 32 W x 18 H x 10 D cm mounted on the chassis/tiller base, facing the operator, with a large 3-colour backlit LCD (digits 50 mm; an emissive strip about 24x7 cm) and a 3-state colour bar (green/yellow/red). Render the metal in mid-grey 'oven-painted' steel and the wheels in darker grey. 4 load cells are internal, so no geometry is needed.


#### Indicatore WX con piattaforma WPA (WPA single-cell platform + WX indicator on stainless column) — floor (medium)

- category: Single-cell bench/floor platform with column indicator (piattaforme con indicatore)
- url: https://industriale.wunder.it/it/piattaforme-con-indicatore/233-indicatore-wx-con-piattaforma-wpa.html

WPA platform: die-cast aluminium base (light grey) about 40 W x 50 D x 9 H cm (size is an estimate; WPA comes in several sizes), with rounded vertical edges. On top sits a removable stainless weighing plate 40 x 50 x 1.2 cm, slightly overhanging, with a 2 mm shadow gap. 4 adjustable rubber feet (cylinders 5 cm diameter x 3 cm). Column: a stainless tube 4.5 cm diameter rising 100 cm (the H100cm column accessory exists; a 58 cm column also exists) from a bracket at the rear-centre edge of the platform. Top: the WX indicator, an ergonomic ABS body about 28 W x 18 H x 9 D cm (estimate) with softly rounded corners (a capsule-ish box), tilted 15-20 deg toward the user. It has a large 3-colour backlit LCD (50 mm digits; an emissive window about 22x7 cm) and a 20-key raised membrane keypad below it. Total height about 115 cm. The classic 'column scale' silhouette of the industrial line.


#### DINAMOMETRO CX — floor (medium)

- category: Crane scale / hanging dynamometer (3/5/10 t)
- url: https://industriale.wunder.it/it/dinamometri/161-dinamometro-cx.html

Hanging device, shown suspended from a minimal floor gantry. Gantry: 2 square uprights 8x8 cm x 230 cm, 180 cm apart, a 190 cm crossbeam 10x10 cm, and floor foot plates 40x30x2 cm. CX body: a die-cast aluminium box with rounded corners, about 22 W x 12 D x 28 H cm (estimate; the small sibling DINAMOMETRO CS is 16 W x 8.5 D x 26.5 H cm confirmed). Front: a dark window about 17x6 cm with a big red 5-digit LED readout (40 mm digits; emissive red is the only saturated colour) and a small membrane keypad strip below it. Top: a heavy shackle (a U made of a torus half with 2.5 cm tube radius, about 12 cm tall, plus a horizontal pin cylinder) hooked over the crossbeam or a short chain. Bottom: a 360-deg swivel hook (a short cylinder swivel plus a torus-arc hook about 15 cm tall with a thin safety-latch box). Hang it so the display sits about 160 cm above the floor. Optionally hang a grey cubic test weight 40 cm below. A small wireless remote (8x4x1.5 cm box) can rest on a gantry foot. Grey aluminium body.


#### JSD DUAL (shown as 'JSD con piattaforma WPE' – counting scale + remote platform) — table (high)

- category: Bench counting scale with dual-platform function (contapezzi dual platform)
- url: https://industriale.wunder.it/it/dual-platform/129-jsd-dual.html

On a pedestal. JSD body: ABS, 31 W x 33 D x 12 H cm overall (confirmed 310x330x120 mm), a low box whose front 10 cm is a console sloping about 20 deg. The console holds THREE separate LCD windows side by side (weight / unit weight / pieces), each about 8.5 x 2.5 cm, 19 mm 6-digit digits. Each window has a backlight that can glow red, green or yellow (the HI/OK/LO check), so drive a per-window emissive colour. A membrane keypad (a grid of 4x5 small raised squares) sits under the windows. Stainless pan 29 x 22 x 1 cm (confirmed) on a 1.5 cm hidden spider above the rear part of the body. Remote platform beside it: the WPE is a painted metal base about 25 x 27 x 7 cm with a removable stainless pan 23 x 23 cm (confirmed), 4 small feet. A thin cable (tube 0.5 cm) runs from the WPE to the back of the JSD. Pedestal top needed: about 75 x 45 cm. Also sold alone: JSD con piattaforma WPE https://industriale.wunder.it/it/dual-platform/1398-jsd-con-piattaforma-wpe.html


#### SMART — table (medium)

- category: Retail price-computing scale, 4 simultaneous operators
- url: https://industriale.wunder.it/it/retail/1555-smart.html

On a pedestal (deli-counter scale). ABS body about 34 W x 36 D x 11 H cm (estimate), slightly tapered sides. Front operator face: a sloping strip with a wide backlit LCD window about 26 x 5 cm showing 4 lines (weight/unit-price 20 mm, amount 20 mm, tare 10 mm) above a full alphanumeric membrane keypad (grid of about 6x8 small keys). Four operator keys should be slightly larger at the left edge, a nice detail for '4 operators'. On top: a stainless pan about 34 x 24 x 1 cm on a single-point cell (hidden). Optional 'fruit plate' curved tray (a shallow open box about 36 x 26 x 5 cm with rounded ends) sits on the pan. Two versions exist: customer display on the counter (back face of the body mirrors the LCD) or on a COLUMN. For the showroom use the column: a tube 3.5 cm diameter x about 40 cm at the rear centre, carrying a double-sided display head about 30 W x 8 H x 6 D cm with LCD windows on front and back. Light grey ABS, satin stainless pan.


#### JPP — table (high)

- category: Retail weight-price scale with integrated thermal printer and column display
- url: https://industriale.wunder.it/it/stampante-integrata/126-jpp.html

On a pedestal. ABS body about 38 W x 38 D x 12 H cm (estimate). Stainless pan 37 W x 24 D cm (confirmed), 1 cm thick, on top. Integrated thermal printer: a raised housing about 12 W x 14 D x 8 H cm at one front/side corner of the body, with a thin dark paper-exit slot (0.3 x 6 cm) and a half-extruded paper label. Front: a membrane keypad strip (PLU keys grid) sloping 15 deg. Rear: a display column 48 cm tall (confirmed 480 mm), tube about 3.5 cm diameter, topped by a double-faced display head about 32 W x 8 H x 7 D cm with dual backlit LCDs (20 mm digits) on the operator and customer sides. Optional stainless 'fruit' basket tray 40 x 30 cm (confirmed accessory size). This is the tallest table item (about 62 cm) and pairs well visually with the SMART.


#### WJ (e.g. WJ 600) — table (high)

- category: Precision balance (precisione)
- url: https://industriale.wunder.it/it/precisione/108-wj.html

On a pedestal. A compact ABS body 20 W x 22.5 D x 8 H cm (confirmed for WJ 600), with a front section sloping about 15 deg. The slope carries a 20 mm backlit LCD window about 10 x 3 cm and a row of 5-6 raised membrane keys. Round stainless pan 11.5 cm diameter (confirmed), 0.4 cm thick, on a short 1.5 cm spindle, centred on the rear two-thirds of the top. 4 small levelling feet and a tiny circular bubble level (a 1.5 cm diameter disc) at the rear corner. Very small, so scale the pedestal down (e.g. 35 x 35 cm top) or group it with the HT on one pedestal. The sibling WJ-6000 (6 kg, rectangular stainless pan) is also on the industriale site: https://industriale.wunder.it/it/precisione/107-wj-6000.html


#### HT — table (medium)

- category: Analytical balance 220 g / 0.1 mg with glass draft shield (analitiche / laboratorio)
- url: https://medicale.wunder.it/it/laboratorio/1025-ht.html

On a pedestal. Overall 27.5 W x 20 D x 31.4 H cm including the draft shield (confirmed). Base: a die-cast aluminium/ABS box 27.5 x 20 x 7 cm. The front edge has a sloping strip with a 17 mm 8-digit backlit LCD (window about 12 x 2.5 cm) and 7 raised keys. The rear 5 cm of the base rises as a tower block about 27.5 x 5 x 31 cm housing the electronics (tuning-fork cell). Draft shield: a transparent glass box about 25 W x 15 D x 22 H cm on top of the base in front of the tower. It has thin grey frame edges (0.5 cm boxes) and visible sliding side doors and a top door (extra thin glass panes offset 3 mm). Inside: a round stainless pan 8 cm diameter (confirmed) on a thin spindle, plus a small splash-guard ring. Use a physically-based transparent material (transmission or low opacity) for the glass. This is the most 'lab-museum' looking object in the line.


Notes: How I got the data: WebFetch was blocked by egress policy (403) for every domain I tried. That covers industriale/medicale/www.wunder.it and also resellers (sinergica-soluzioni, agritechstore, bilanceblasi, zoicobilance, centroarredo, gam-bg, medicalexpo and its pdf subdomain, doctorpoint); docplayer.it failed on DNS instead. So every spec comes from WebSearch result snippets, drawn from the official industriale.wunder.it product pages and the resellers above. All model names and URLs above appeared in search results as real industriale.wunder.it pages. The one exception is HT, whose confirmed page is medicale.wunder.it/it/laboratorio. The industriale site has an 'ANALITICHE' menu category, but I could not confirm an HT page under that domain. If the MEDICALE researcher also picks HT, swap it for WJ-6000 or NHB (https://industriale.wunder.it/it/precisione/110-nhb.html; 200x250x80 mm, 140x150 pan).

Confirmed dimensions: WP4 height 80 mm (130 mm with feet), sizes 1212 and 1215. WP4-U height 80-98 mm (130 mm with feet). TPS forks 1150x550x87 mm, applied to TPX-C by assumption. TPX-C LCD digits 50 mm, 3 colours. JSD 310x330x120 mm, pan 290x220 mm. WPE pan 230x230 mm. JPP pan 370x240 mm, column 480 mm. WJ 600: 200x225x80 mm, pan diameter 115 mm. HT: 275x200x314 mm, pan diameter 80 mm. CS dynamometer: 160x85x265 mm. Column accessories 25, 58 and 100 cm exist.
Estimated dimensions: WP4-U outer footprint, WPA plate size, WX/WXC indicator bodies, CX body, SMART body/column, JPP body.

Good alternatives if the developer wants swaps (all real industriale pages):
- VT2 INOX: flat 900x500 mm stainless floor platform with handle and wheels, indicator on a 2 m cable, 25 mm LCD. https://industriale.wunder.it/it/piattaforme-standard/140-vt2-inox.html
- WBX: portable multi-use scale, 50 mm 3-colour LCD, optional 30 cm bench column. https://industriale.wunder.it/it/piattaforme-standard/143-wbx.html
- BILL: retail scale, pan 285x220 mm, red LED displays on both sides. https://industriale.wunder.it/it/retail/120-bill.html
- ECO: compact retail scale, 245x300x100 mm, pan 250x215 mm, front and back LCDs. https://industriale.wunder.it/it/senza-stampante/119-eco.html
- TPS and TPR pallet trucks: https://industriale.wunder.it/it/transpallet-pesatori/164-tps.html and https://industriale.wunder.it/it/transpallet-pesatori/163-tpr.html
- DINAMOMETRO CS: https://industriale.wunder.it/it/dinamometri/160-cs.html
- IP5000: 150x170x50 mm, pan 150x120 mm.
- JSC counting scale: 310x330x120 mm.
- WP: thin portable single-cell platform, pan 295x275 mm.
- WPS INOX: stainless single-cell platform.

Colours: renders should stay greyscale per the user brief. The real products are light-grey ABS, satin stainless and grey epoxy-painted steel, which fits naturally. The only accent colours are emissive display content: the red LED on CX, and the red/green/yellow check backlights on JSD, TPX-C and WX/WXC.


### DESIGN (design.wunder.it)


#### 960 Chrome — floor (high)

- category: Mechanical bathroom scale with dial, low 'neck' version (Classiche / 960 family)
- url: https://design.wunder.it/it/960/3-960-chrome.html

Overall 27 W x 40 D x 20 H cm, about 5.2 kg. BASE: a die-cast rounded-rectangle slab 27 x 31 x 5 cm (corner radius about 3 cm) on 4 small rubber feet (Ø2 x 0.5 cm). PLATFORM: black non-slip rubber mat 26 x 30 x 1.2 cm sitting on top, inset about 0.5 cm, top surface at about 6 cm. Optionally add a fine ribbed normal-map or stripes. HEAD, at the front (toe) end: a short tapered neck (trapezoid box, 14 cm wide at the bottom and 10 cm at the top, 9 cm deep, about 6 cm tall) that carries a round dial housing: a cylinder Ø20 x 5.5 cm with a chrome torus bezel (tube r about 0.7 cm). The housing is tilted about 45 deg so the face points up and back toward the user's eyes. Its lower edge sits at about 6 cm and its top at 20 cm. The dial face is Ø18: white disc, black tick ring, thin red pointer (dial colours assumed, not confirmed). It has a domed glass cover, which can be a flattened transparent half-sphere, scale y = 0.15. MATERIAL: polished chrome on the whole body, neck and bezel (light grey metal, metalness 1, roughness 0.15) with a black rubber mat. Capacity 120/150 kg, 500 g division.


#### 960 Glass — floor (high)

- category: Mechanical bathroom scale with dial, low version, glass platform
- url: https://design.wunder.it/it/960/4-960-glass.html

Same body as the 960 Chrome: 27 W x 40 D x 20 H cm, with a chrome base slab 27 x 31 x 5 cm, a front neck, and a tilted (about 45 deg) Ø20 x 5.5 cm dial housing with an Ø18 face and domed glass. The difference is the PLATFORM: a clear tempered-glass plate 26 x 30 x 1 cm with slightly bevelled polished edges instead of the rubber mat. Use a transparent MeshPhysical/Phong material (opacity 0.35, slight blue-green tint #cfe6e3 for the glass edge) so the chrome base below shows through. A frosted variant, 'glass satinata', is sold by retailers: raise the roughness and opacity to about 0.7.


#### 960 Gold — floor (high)

- category: Mechanical bathroom scale with dial, low version, gold finish
- url: https://design.wunder.it/de/960/6-960-gold.html

Same geometry as the 960: 27 x 40 x 20 cm, base slab 27 x 31 x 5, rubber mat 26 x 30 x 1.2, front neck, and a dial housing Ø20 x 5.5 tilted about 45 deg with an Ø18 face. The whole metal body, neck and bezel are gold-plated (colour #c9a55a, metalness 1, roughness 0.25) with a black rubber mat. This is a good accent piece in a grey world: it is the only warm-coloured object.


#### 960 Bianca — floor (high)

- category: Mechanical bathroom scale with dial, low version, white painted
- url: https://design.wunder.it/it/960/1-960-bianca.html

Same 960 geometry. The design site lists it as W 24-26 x L 40 x H 20 cm with a 24-26 x 30 cm platform and an Ø18 dial. The body and dial housing are white epoxy-painted die-cast aluminium (#f2f2f0, roughness 0.6, non-metal). The mat is black/dark-grey rubber. The bezel can stay white or light chrome. A black-painted sibling, '960 Nera', is sold by Fitmax and dasfeinebad: the same mesh with body #1c1c1c.


#### 960 Tarsie — floor (medium)

- category: Mechanical bathroom scale with dial, low version, platform in inlaid polychrome terracotta ('Tarsie' design line)
- url: https://pdf.medicalexpo.com/pdf/wunder/catalogue-wunder-tarsie-design/70564-114601.html

960 body (27 x 40 x 20 cm, front neck, tilted Ø20 dial housing), made in gold, chrome or painted metal. The PLATFORM is a hand-made inlaid terracotta tile slab about 26 x 30 x 1.8 cm (slightly thicker than the mat), with a waxed satin surface (roughness 0.5). Build its decoration as a procedural CanvasTexture from coloured clay tiles: terracotta red #b5553c, ochre #d2a25a, cream #e8dcc4, slate #6b6f73, charcoal. The documented pattern names are Romana Imperiale, Etrusca, Firenze, Bizantina, Iris, Acqua, Millerighe and Mosaico. For example, Millerighe = parallel thin stripes, Mosaico = small square tesserae, Iris = a central floral rosette. Capacity 120 or 150 kg, 500 g division.


#### R150 Chrome — floor (high)

- category: Mechanical column bathroom scale with dial ('Langhals', long neck; R150 Classiche family)
- url: https://design.wunder.it/it/r150-classiche/8-r150-chrome.html

Overall 27 W x 40 D x 90 H cm, about 7 kg. BASE: a rounded-rectangle die-cast slab 27 x 40 cm, about 8 cm high (one spec quotes a base unit of 270 x 400 x 110 mm), on 4 small rubber feet. PLATFORM: black rubber mat 26 x 30 x 1.2 cm over the rear 3/4 of the base. COLUMN: a slender round tube Ø5 cm (the medical R150A quotes Ø6 cm) rising vertically from the front-centre of the base. It starts from a small flared cast collar (a truncated cone Ø10 to Ø5, 6 cm tall) and goes up to about 80 cm. HEAD: a round dial housing, cylinder Ø20 x 7 cm, centred at about 80 cm with its top at 90 cm. It is tilted back 15-20 deg from vertical so the face looks at a standing user. It has an Ø18 white face, black ticks, thin red pointer (colours assumed), a domed glass cover and a chrome torus bezel. All metal is polished chrome (metalness 1, roughness 0.15). A matt chrome/nickel version is sold by dasfeinebad: raise the roughness to 0.45.


#### R150 Glass — floor (high)

- category: Mechanical column bathroom scale with dial, glass platform
- url: https://design.wunder.it/it/r150-classiche/9-r150-glass.html

Same as the R150 Chrome: 27 x 40 x 90 cm, chrome base about 8 cm high, Ø5 cm chrome column to about 80 cm, Ø20 x 7 cm dial head tilted 15-20 deg with an Ø18 face and domed glass. The PLATFORM is a clear tempered-glass (crystal) plate 26 x 30 x 1 cm with polished edges (transparent, opacity about 0.35, greenish edge tint) instead of the rubber mat. Retailers also sell a frosted 'glass satinata' version.


#### R150 Gold — floor (high)

- category: Mechanical column bathroom scale with dial, gold finish
- url: https://design.wunder.it/it/r150-classiche/10-r150-gold.html

R150 geometry: 27 x 40 x 90 cm, base slab about 8 cm, rubber mat 26 x 30 x 1.2, Ø5 cm column rising from a flared collar at the front-centre to about 80 cm, and an Ø20 x 7 cm dial head tilted 15-20 deg (Ø18 face, domed glass). The base, column, collar and bezel are gold-plated (#c9a55a, metalness 1, roughness 0.25) with a black mat. The tallest and most eye-catching design piece: a good choice for the entrance or the centre of the gallery.


#### R150 Bianca — floor (high)

- category: Mechanical column bathroom scale with dial, white painted
- url: https://design.wunder.it/it/r150-classiche/7-r150-bianca.html

R150 geometry: 27 x 40 x 90 cm, base 24-26 wide x 40 deep, about 8 cm high, platform 24-26 x 30, Ø5 cm column to about 80 cm, and an Ø20 x 7 cm dial head tilted 15-20 deg with an Ø18 face. The base, column and dial housing are white epoxy-painted (#f2f2f0, roughness 0.6), with a black/dark-grey rubber mat and optionally a chrome bezel ring. A black 'R150 Nera/Schwarz' sibling is sold by dasfeinebad: the same mesh with body #1c1c1c.


#### R150 Tarsie Cromata — floor (medium)

- category: Mechanical column bathroom scale with dial, chrome body with an inlaid polychrome terracotta platform ('Tarsie' line)
- url: https://www.wellstore.it/Misurazione-Bilance-pesa-persona/1224/Wunder-R-150-Tarsie-Cromata.html

R150 Chrome geometry: 27 x 40 x 90 cm, chrome base about 8 cm, Ø5 cm chrome column to about 80 cm, and an Ø20 x 7 cm dial head tilted 15-20 deg with an Ø18 face. The platform is a terracotta inlay slab about 26 x 30 x 1.8 cm with a procedural polychrome pattern, the same palette and pattern set as the 960 Tarsie (Romana Imperiale / Etrusca / Firenze / Bizantina / Iris / Acqua / Millerighe / Mosaico). 150 kg, 500 g division. The model name comes from a reseller listing; the Tarsie catalogue says the terracotta platform is also offered on the R150 line.


Notes: The design line has only 2 real shapes. Every other difference is the finish. The whole Wunder design catalogue is two mechanical bathroom scales: the low '960' (27x40x20 cm, a tilted dial on a short front neck) and the tall column 'R150' (27x40x90 cm, a dial on a thin post). Both have an Ø18 cm dial, 120/150 kg capacity and 500 g division. On design.wunder.it they come in these finishes: 960 Bianca (product id 1), 960 Chrome (3), 960 Glass (4), 960 Gold (6), R150 Bianca (7), R150 Chrome (8), R150 Glass (9) and R150 Gold (10). The site's categories are 15 'Classiche', 18 '960' and 19 'R150 classiche'. Product ids 2 and 5 are probably 960 Nera and a frosted-glass version, but I could not confirm that. Other real options: Nera/Black and 'glass satinata' (frosted) from resellers; matt chrome/nickel on the R150 (dasfeinebad); a wooden platform on the '960 CLASSIC (960CR)' (old wunder.it design catalogue and bilanceblasi); 'cherry' (Dyke & Dean); and the 'Tarsie' line with inlaid terracotta platforms. Recommendation: write two builders, build960(finish, platformType) and buildR150(finish, platformType), and pass a material set: chrome, matt chrome, gold, white, black, clear glass, frosted glass, wood, or a terracotta Tarsie texture. The gallery then gets 10 pieces from very little code. The medical line's 960A and R150A are the same bodies in painted, certified (class IIII) versions, so avoid duplicating them in the medical pick.

NO TABLE-TOP MODELS WERE FOUND IN THE DESIGN LINE. The task text guessed that the design line has kitchen, letter and luggage scales. I found no Wunder design-line kitchen, letter or luggage scale. The only kitchen scales on Wunder sites are Tanita-branded KD321 and KD400SV (in the medicale.wunder.it 'Cucina' category, distributed rather than made by Wunder) and professional food/retail scales, which belong to the industrial line. Two possible 'museum' table or plinth pieces: (1) a vintage Wunder 'family automatic scales' kitchen scale, 12 kg, round pan, eBay collectible only, not in the current catalogue, low confidence on shape; (2) 'Bilancia Wunder San A 150', a mid-20th-century column scale with a telescopic stadiometer, listed in the Lombardia Beni Culturali heritage database. Neither is a current design-line product.

Uncertainties: the dial face colours (white face, black numerals, red pointer) and the exact dial tilt angles are my own estimates. The tilt comes from geometry: a 20 cm-tall body with an Ø19-20 dial means about 45 deg tilt on the 960. Height of the R150 base unit: specs disagree (15 mm plate vs 110 mm base), so use about 8 cm. Column diameter: Ø6 cm on the medical R150A; the design R150 looks thinner (about 5 cm). The 'Golden Spider award' that searches attach to 'Wunder design' belongs to a different, Turkish e-commerce 'Wunder' built by the agency Designneuro. It is NOT Wunder Sa.Bi.; do not use it.

Sources (all direct Wunder domains and most resellers were blocked for WebFetch, so this is from search snippets): design.wunder.it product URLs above; dasfeinebad.de (960 and R150 dimensions, 5.2 kg and 7 kg, 'Langhals', glass-covered dial on a neck); fitmax.it; miasanitaria.it; medisanshop.com; bilanceblasi.com (960 low version with wooden platform, R150 crystal platform); ebody.solutions (R150T 270x400x900, base 240-260x300x15 mm); tecno-sistemi.it (Tarsie decoration names); pdf.medicalexpo.com Tarsie catalogue; dykeanddean.com (domed glass, cherry finish).


### Brand identity

```
WUNDER BRAND IDENTITY FOR THE WEBGL SHOWROOM

SOURCES AND HOW RELIABLE THEY ARE
- WebFetch and curl are both blocked for every *.wunder.it host, and also for web.archive.org, brandfetch, clearbit, google favicons, medicalexpo, healthmanagement, blisshub, sinergica-soluzioni and portale.siva. WebSearch only returns text, so I could not look at the logo artwork.
- The most reliable source I found is the user's own synced Wunder brand documents, written by the company's graphics staff (Katia, grafica@wunder.it):
  /root/.claude/skills/synced/817003a2-12cc-4b7f-82af-00a859b71125_246ae97f-e4b1-4cb3-b2fd-22a8b2d694b7/indesign/bible/06-wunder-rules.md
  .../ind/references/industrial-design-dfm.md (section 6)
  .../wmedisign/references/avalonia-design.md
- Two of the user's earlier public repos, WunderScalesBarcodeLabelTools (public/brand/wunder-logo.svg) and WunderOnlineTerminal (public/brand/logo.svg), only contain PLACEHOLDER "WUNDER" text logos. Comments in both files say the official logo was not available. Do not reuse them as the real logo.

COLORS (from the user's brand documents; these replace the guessed values)
- Wunder Red #D90000 (RGB 217,0,0). This is the master color of the main logo ("logo madre") and the corporate color. The guess of #D40000 was wrong.
- Medicale Azzurro #009ADE (RGB 0,154,222). The guess of #039BE5 was wrong.
- Giallo Industriale #FFB300. The guess of #FDC811 was wrong.
- Design Petrol #116374. It is a dark teal, NOT grey.
- Corporate has no division color.
- Arancio Wunder #E86100 (Pantone 166 C). One document calls it the "colore di marca ufficiale", which contradicts red being the logo color. Use red for the logo and treat orange as a secondary accent. Ask the user if orange matters.
- Wunder Navy #1E3A5F is the background of the industrial indicator faceplates (ACS, ACS-M, ACS-T, ACL). It suits the indicator heads on the industrial scale models.
- Swatches are officially stored in ASE files (Wunder_Mascherine_RGB/CMYK/Pantone.ase). The values above come from the user's documents, which quote those files.
- Do NOT use these: orange #FF5F1F and the fonts Montserrat ExtraBold/Black, Bebas Neue and Roboto. They belong to ESA, a separate retail brand. The brand rules call mixing ESA and Wunder elements a BLOCKER.

HOW THE LOGO IS BUILT (confirmed in the documents)
- Brand structure ("Opzione A"): the red main logo plus a colored division tag (Medicale blue, Industriale yellow, Design petrol, none for Corporate).
- Monogram: a white "W" on a red circle.
- Separate monograms exist for Corporate, Medicale, Industriale and Design. The official masters are SVG files (plus PNG at 512/1024/2048). They are not public; Katia's graphics office has them.
- Brand rule: logos must never be stretched, recolored or rebuilt.
- Tagline: "Inspired by precision". The site title is "Wunder - Inspired by precision"; internal documents write "Inspired by Precision". The user wants no text in the world, so show the tagline only if it is part of the official logo artwork.
- Philosophy: precision. The company has made scales for more than 50 years, in Italy.

NOT VERIFIED (do not invent these)
- The exact wordmark: lowercase "wunder" or uppercase "WUNDER", which typeface, and weight.
- Whether there are arcs or a swoosh above the wordmark.
- No source I could reach describes these details. The arcs in the task description are unconfirmed.

RECOMMENDATION FOR BUILDING THE LOGO
- Best option: ask the user for the official SVG masters (corporate plus the 3 division monograms). Load them with three.js SVGLoader, then SVGLoader.createShapes, then ShapeGeometry or a thin ExtrudeGeometry. Keep the original proportions and colors. This is still rendered 100% in WebGL and follows the "never rebuild" rule.
- Placeholder until the SVGs arrive: a red disc (#D90000, CircleGeometry or a cylinder 2 mm thick) with a white W made of 4 slanted bars. Each bar is about 0.16R wide and 0.9R tall; the outer bars lean ±18°, the inner bars ±12°, and the W is centered.
  - Division version: the same disc with a small rounded bar underneath (about 0.9R wide, 0.18R tall) in the division color.
  - Leave the wordmark out until it is confirmed, or mark it clearly as a placeholder.
- Clickable logos: raycast on pointerdown or click, then window.open(url, '_blank', 'noopener'). Tag each logo mesh with userData.url.

DESTINATION URLS (confirmed by search results)
- Strip the ?_ga=... part from the URLs the user pasted. It is an expired Google Analytics tracking parameter.
- Corporate (WordPress, Goodlayers "Infinite" theme): https://www.wunder.it/ (IT), https://www.wunder.it/en/ (EN)
  - Company page: https://www.wunder.it/en/company/
  - Catalogs: https://www.wunder.it/download-cataloghi/ (IT), https://www.wunder.it/en/download-catalogs/ (EN)
  - Contact: https://www.wunder.it/en/contact-us/
- Medicale (PrestaShop): https://medicale.wunder.it/it/ (IT), https://medicale.wunder.it/gb/ (EN; English uses /gb/, not /en/)
- Industriale: https://industriale.wunder.it/it/ (IT), https://industriale.wunder.it/gb/ (EN)
- Design: https://design.wunder.it/it/ (IT), https://design.wunder.it/gb/ (EN)
- Social pages (if needed): https://www.facebook.com/WunderSaBisrl/ , https://www.linkedin.com/company/wunder-sa.bi.-s.r.l./ , https://www.youtube.com/@wundersabisrl
- Company details: Wunder Sa.Bi. Srl, Via Vecchia per Monza 20, Trezzo sull'Adda (MI); wunder@wunder.it; +39 02 90964566; VAT number 01786290161.

WARNING FOR THE PRODUCT-CATALOG AGENTS
- wunder.it also distributes Tanita scales for home, sport and kitchen use (for example the Tanita KD400SV kitchen scale in the CUCINA category on medicale.wunder.it). Tanita models are NOT Wunder models and should not fill the "design" line.
- Known Wunder names from the user's documents and search results include: R150A, 960A, R150, RA column, RB-L, RL bed scale, RW2.0-SEDIA, DE20 and DE5 chair scales, RE300, RE310, PR7500, BC718, HW, IP5000, AWS, WBX, VT2 INOX, SMART (retail scale), JSB (bench counting scale), WU 150 indicator.

I created no files. Read-only shallow clones of the public repos are in the scratchpad (/tmp/claude-0/-home-user-WunderScalesVirtualWorld/e0ffb908-1d3e-57b6-a634-96737fc873ea/scratchpad).
```

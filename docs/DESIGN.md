# Editorial storefront redesign

The supplied Belo.Fur references guide the white canvas, beige outer frame, dark ink, studio furniture imagery, restrained navigation, generous section spacing, and three-column collections. The store retains the Ruang Teduh identity and Indonesian copy.

- Palette: paper `#ffffff`, frame `#e8d5c4`, ink `#12212a`, muted text `#62696b`.
- Typeface: locally served Outfit Variable via `@fontsource-variable/outfit`.
- Homepage: `apps/web/src/home.tsx`; shared storefront styling: `apps/web/src/storefront.css`.
- Product cards: `apps/web/src/product-card.tsx`. Prices, availability, and product links come from the existing API.
- Room curation supports mouse and keyboard activation. Its horizontal accordion becomes vertical on small screens.
- GSAP provides entrance movement, scroll-linked word emphasis, and a pinned material caption on desktop. Reduced motion disables those effects and the marquee. The marquee also has a pause control.
- Scroll text starts at 0.65 opacity to retain readable contrast, a deliberate accessibility adjustment to the skill's 0.1 opacity suggestion.
- Original demo image paths are mapped to the studio assets by `product-image.ts`. Custom merchant image paths are passed through unchanged. There is no database image migration.

## Generated assets

Created with the built-in ImageGen tool, then encoded as JPEG at quality 90 without changing their composition. All five assets are 1254 × 1254 and stored in `apps/web/public/images/studio/`. These are demo product visualizations, not photographs of verified merchandise. The original SVGs remain available.

### Prompt set: coffee, chair, sofa

Shared prompt:

> Use case: product-mockup. Create one premium photorealistic furniture catalog image for the Indonesian furniture store Ruang Teduh. [SUBJECT] Seamless very light warm gray studio background (#f5f4f1), soft natural light from upper left, delicate realistic contact shadow, understated Nordic furniture photography like a high end design magazine. Square composition, entire furniture fully visible, centered with generous 18% empty margins. Precise material texture and realistic construction. No people, no text, no logos, no frames, no collage, no room. Output one square image.

Subjects:

- `coffee.jpg`: A single oval low oak coffee table, 100 cm long, 55 cm deep, 38 cm high, four thick cylindrical wooden legs, beautifully rounded edges, natural pale honey oak grain. Two minimal ivory ceramic cups rest on the tabletop.
- `chair.jpg`: A single Scandinavian lounge armchair, natural solid oak frame, thick oatmeal woven linen seat and back cushions, elegant curved wooden armrests, generous proportions. Three quarter view from the front.
- `sofa.jpg`: A single contemporary three seat sofa, warm sand beige woven fabric, low minimal form, soft rectangular cushions, subtly rounded arms, short natural oak feet. Three quarter view from the front.

### Prompt set: mattress, pillow

Shared prompt:

> Use case: product-mockup. One premium photorealistic furniture catalog image for Ruang Teduh. [SUBJECT] Seamless very light warm gray studio backdrop (#f5f4f1). Soft natural lighting, realistic contact shadows, calm Scandinavian product photography. Square image with centered product occupying 70% of the frame. No text, logos, people, labels, frame or collage.

Subjects:

- `mattress.jpg`: A single thick white knitted fabric foam mattress with subtle horizontal stitched side panels, perfectly rectangular, 160 by 200 centimeters, no bed frame, no pillows, front three-quarter view, entirely visible with generous empty space around it.
- `pillow.jpg`: Two fluffy ivory cotton bed pillows, one lying flat, one casually leaning on it. Crisp yet soft textile folds, no pattern, no decoration. Entire objects visible with generous empty space around them.

## Local preview

During this redesign, port 27017 was already occupied by a standalone MongoDB instance. An isolated Docker container named `ruang-teduh-design-preview` was started on port 27018 with replica set `rs0`. Only that container's `ruang_teduh_preview` database was seeded and used for preview checks.

To reuse this preview database in PowerShell:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27018/ruang_teduh_preview?replicaSet=rs0&directConnection=true'
npm run dev:demo
```

The preview is at `http://localhost:5173`. Payments in this mode are simulated. The standard README startup instructions still apply when port 27017 is available.

## Verification

All eight Playwright tests passed using the installed Chrome browser. Checks cover the simulated checkout, catalog filter restoration, 1440/390/320-pixel layouts and image loading, automated WCAG A/AA checks on the main public pages, keyboard room selection, mobile navigation, and reduced motion. Desktop and mobile homepage screenshots were also visually reviewed. Automated accessibility checks do not constitute a complete accessibility certification.

`npm run build` builds the API and frontend. Screenshots and test reports remain in the ignored `test-results/` and `playwright-report/` directories.

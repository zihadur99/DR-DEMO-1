# Dr. Mariam Nasrallah — Family Medicine website

A one-page, cinematic website with a dark, champagne-gold premium look. The screen stays put while scrolling (or swiping) moves through ten chapters: copy slides in from alternating sides, and a 3D particle sculpture morphs into a new medical shape for each chapter. On the first and last chapter the doctor's portrait is revealed by a scan line and the beating heart rests on her open palm.

No frameworks, no build step, no npm. Upload the folder and it works.

## Files

```
index.html            All page content (text, links, phone number)
404.html              "Page not found" page
site.webmanifest      Name, colours and icons for phones
robots.txt            Search-engine rules
sitemap.xml           Page list for Google
assets/
  css/style.css       All styling (colours, fonts, layout, animation)
  js/scene.js         The WebGL 3D particle sculpture and its 10 shapes
  js/main.js          Chapter engine: wheel, touch, keyboard, nav, text reveals
  img/favicon.svg     Browser-tab icon
  img/apple-touch-icon.png   Home-screen icon (iPhone)
  img/og-image.jpg    Preview image shown when the link is shared (1200×630)
  img/dr-mariam-960.webp / -600.webp   Portrait cutout (transparent background)
  img/avatar.webp     Small round face used in the hero
```

## Chapters

| # | Chapter | Copy side | 3D shape |
|---|---------|-----------|----------|
| 1 | Welcome | left | Heart resting on her palm |
| 2 | About | right | DNA helix |
| 3 | Roots | left | Capsule |
| 4 | Training | right | Medical cross |
| 5 | Off the chart | left | Family of three orbs |
| 6 | Care | right | Knot |
| 7 | Preventative Medicine | left | Shield with check |
| 8 | Chronic Condition Management | right | 3D ECG trace |
| 9 | Women's Health | left | Bloom |
| 10 | Book | left | Heart returns to her palm |

## Common edits

- **Text**: edit `index.html`. Each chapter is a `<section class="ch">`. Change `data-side="left|right|center"` to move a chapter's copy.
- **Portrait**: replace `assets/img/dr-mariam-960.webp` and `-600.webp` with a new cutout (transparent background, same 1520×2220 proportions). If the hand moves, adjust `.palm{left:…;top:…}` in `style.css` so the heart sits above the palm.
- **Phone number**: search `313-914-3666` and `+13139143666` in `index.html` and `assets/js/main.js`.
- **Colours**: the `:root` block at the top of `assets/css/style.css`. The palette is obsidian (`--bg`), ivory (`--ink`), champagne gold (`--gold`, `--gold-hi`, `--gold-grad`), with blush (`--rose`) and sage (`--sage`) as accents. The particle colours are the `sage`, `blush` and `gold` values in the shader in `assets/js/scene.js`.
- **Fonts**: Inter Tight (headings), Cormorant Garamond italic (accents), Inter (body), Geist Mono (labels), loaded from Google Fonts in `index.html` and `404.html`.
- **3D shapes**: the `CHAPTERS` list near the middle of `assets/js/scene.js` (shape, spin, size, brightness per chapter).

## Before going live

1. Replace `YOUR-DOMAIN` in `robots.txt` and `sitemap.xml`.
2. In `index.html`, change `og:image` and `twitter:image` to the full URL, e.g. `https://YOUR-DOMAIN/assets/img/og-image.jpg` (Facebook and WhatsApp need a full URL).
3. Add the clinic address and opening hours if you have them. Google uses them for local search.

## Deploy

- **Netlify**: drag the whole folder onto app.netlify.com/drop.
- **Vercel**: `vercel` in this folder, or import it from GitHub.
- **cPanel / shared hosting**: upload the folder's contents into `public_html`. Most hosts serve `404.html` automatically; if not, add `ErrorDocument 404 /404.html` to `.htaccess`.

## Premium touches

- Short preloader: an ECG line draws in gold, then the curtain lifts (at most about 1.2 s; it hides itself after 4 s if JavaScript fails).
- Headings rise word by word and come into focus from a blur.
- Gold buttons have a foil gradient and a glint that sweeps across every few seconds. All buttons lean toward the mouse (magnetic hover).
- Custom cursor on desktop: a gold dot plus a ring that grows over links and buttons.
- Slowly drifting aurora light in the background, glass cards with fine gold edges, and a thin gallery-style frame around the screen.

## Controls

Mouse wheel or trackpad, touch swipe, arrow keys / Page Up / Page Down / Space / Home / End, the top nav, and the chapter dots on the right (desktop). Deep links work: `#about`, `#care`, `#contact`.

## Performance

- Total size of the site's own code is about 60 KB. The only external files are Google Fonts.
- Text animations are CSS transitions on transform and opacity only, so they run on the GPU and nothing is recalculated per frame.
- Only the first shape is built at load; the rest are built in idle time. Phones get fewer particles.
- If a device can't hold about 50 fps, the 3D canvas automatically lowers its resolution, then its particle count.
- The portrait is a 64 KB WebP, preloaded with high priority.
- Animation pauses when the tab is hidden. Visitors with "reduce motion" turned on get fades without movement.

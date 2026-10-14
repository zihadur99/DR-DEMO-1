# Dr. Mariam Nasrallah — Family Medicine website

A single-page scrollytelling site. One vertical page, top to bottom:

| Section | Anchor | What it holds |
|---------|--------|---------------|
| Hero | `#home` | DNA clip that plays as you scroll, then the welcome headline and booking buttons |
| About | `#about` | Background, a four-step timeline (Dearborn → U of M → U of M Medical School → Beaumont Wayne) and three personal facts |
| Services | `#services` | "Every stage of life" ruler and three service cards |
| Doctor | `#doctor` | Profile card: portrait, quote, credentials, booking button |
| Contact | `#contact` | Booking card with the phone number, call and copy buttons, Instagram |

No frameworks, no build step, no npm. Upload the folder and it works.

## Files

```
index.html                 The whole site (text, links, phone number)
assets/css/style.css       All styling (colours, fonts, layout, animation)
assets/js/sequence.js      Hero DNA sequence: frame loading, decoding, canvas drawing, pin
assets/js/main.js          Smooth scroll (Lenis), reveals, nav, odometer, cursor
assets/vendor/             GSAP 3.12.5 + ScrollTrigger, Lenis 1.3.26 (self-hosted, no CDN)
assets/seq/dna-v1/lg/      240 frames, 1280×720 (desktop), ~8.6 MB in total
assets/seq/dna-v1/sm/      120 frames, 854×480 (phones and Save-Data), ~2.9 MB in total
assets/img/                Portrait, avatar, favicon, share image
tools/extract-frames.sh    Rebuilds the frames from a video with ffmpeg
_headers, vercel.json, .htaccess   Cache headers for Netlify, Vercel and Apache/cPanel
site.webmanifest, robots.txt, sitemap.xml
```

## How the scrolling works

- **Momentum.** [Lenis](https://github.com/darkroomengineering/lenis) smooths the mouse wheel and trackpad: when the wheel stops, the page keeps gliding and eases to a stop. The softness is `lerp` in `main.js` (`0.085`; lower is longer and softer). Phones keep their own native momentum.
- **One clock.** Lenis, GSAP ScrollTrigger and the hero canvas all run on `gsap.ticker`, which is a single `requestAnimationFrame` loop. Nothing else runs per frame.
- **Hero length matches the clip.** The hero is pinned for exactly `frames × perFrame × screen height` of scroll (`data-sets` on `#seqCanvas`). Desktop: 240 frames × 0.65% ≈ 1.4 screens. Phones: 120 frames × 1.1% ≈ 1.3 screens. The last frame lands exactly when the pin releases and About comes straight up behind it, so there is no empty scrolling. A shorter clip automatically gets a shorter hero.
- **Copy over the clip.** Two short lines fade through, then the welcome headline and booking buttons appear and stay as the hero scrolls away. They are the three `.beat` blocks in `index.html`.
- **Reveals.** Headings rise word by word and blocks fade up as they enter the screen. They reset while off screen, so they play again every time you scroll back to them (the phone number rolls again too). These are CSS transitions on `transform` and `opacity`, so they run on the GPU.
- **Reduced motion.** Visitors with "reduce motion" get native scrolling, a still hero (first DNA frame plus the headline) and no reveals.

## How the hero stays at 60 fps

- Only the first frame is fetched at high priority (`<link rel=preload>`). The other frames download after the page has loaded, coarse to fine (every 32nd frame, then 16th … then every frame), a few at a time. Scrubbing works from the start; a frame that is not ready yet is replaced by the nearest one that is.
- Frames are decoded off the main thread (`createImageBitmap`). Only a window around the current frame stays decoded (about 150 MB desktop, 60 MB phones). Keeping all 240 decoded would take about 880 MB.
- The canvas is drawn only while the hero is on screen, and only when the picture changes.
- No stepping: the shown position glides toward the scroll position and the two frames around it are cross-faded. No shaking: while a frame is still decoding, the fallback is the closest ready frame behind the playhead, never ahead.
- No animation repaints every frame: the cyan text gradient is static, and the "Now booking" pulse is a scaled dot, not a box-shadow.
- Nothing reads layout during scroll: the canvas size comes from a `ResizeObserver`, and the `object-fit: cover` crop is calculated once per resize. The canvas never holds more pixels than the frame has.
- The pinned layer and the canvas have their own GPU layers (`will-change: transform; transform: translateZ(0)`).
- No `backdrop-filter` or blend modes on anything that scrolls (only the fixed nav blurs, once it turns solid).

## Common edits

- **Text**: edit `index.html`. Each section is a `<section class="sec">` with an `id`.
- **Another doctor**: copy the `<article class="doctor-card">` block in the Doctor section.
- **Portrait**: replace `assets/img/dr-mariam-960.webp` and `-600.webp` (transparent background).
- **Phone number**: search `313-914-3666` and `+13139143666` in `index.html` and `assets/js/main.js`.
- **Colours**: the `:root` block at the top of `assets/css/style.css`. The palette is sampled from the hero DNA clip: teal-black background (`--bg`), ice-white type (`--ink`), holographic cyan accent (`--accent`, `--accent-hi`, `--accent-grad`, `--btn-grad` for buttons), plus teal (`--teal`) and sky blue (`--sky`) on the service cards. If the clip changes colour, sample its frames and update these.
- **Fonts**: Inter Tight (headings), Cormorant Garamond italic (accents), Inter (body), Geist Mono (labels), from Google Fonts in `index.html`.
- **Scroll feel**: `lerp` and `wheelMultiplier` in `main.js`. The hero length per frame is `perFrame` in `data-sets` in `index.html`.

## Changing the hero clip

1. Run `tools/extract-frames.sh new-video.mp4 v2`. It prints the frame counts.
2. In `index.html`, change `dna-v1` to `dna-v2` (in the canvas `data-src` and the two preload links) and put the new counts in `data-sets`.

The hero's scroll length follows the frame count by itself. The new folder name is what lets browsers cache frames forever.

## Caching

`_headers` (Netlify, Cloudflare Pages), `vercel.json` (Vercel) and `.htaccess` (Apache/cPanel) set the same rules: frames and vendored libraries are cached for a year as immutable, images for 30 days, CSS/JS for a day, and HTML is always revalidated. On nginx, add `location /assets/seq/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`. GitHub Pages cannot set headers (it caches for 10 minutes).

## Before going live

1. Replace `YOUR-DOMAIN` in `robots.txt` and `sitemap.xml`.
2. In `index.html`, change `og:image` and `twitter:image` to the full URL, e.g. `https://YOUR-DOMAIN/assets/img/og-image.jpg` (Facebook and WhatsApp need a full URL).
3. Add the clinic address and opening hours if you have them. Google uses them for local search.

## Deploy

- **Netlify**: drag the whole folder onto app.netlify.com/drop.
- **Vercel**: `vercel` in this folder, or import it from GitHub.
- **cPanel / shared hosting**: upload the folder's contents into `public_html`.

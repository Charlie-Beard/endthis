# EndThis

A simple web application. Single-page, no build step, no framework.

## Architecture

**Files:**
- `index.html` — HTML skeleton and meta
- `style.css` — all styles
- `script.js` — all application logic (IIFE)

**Key concepts:**
- Pure HTML/CSS/JavaScript — no dependencies
- Responsive design with CSS
- Module pattern (IIFE) for script organization

## CSP

The `Content-Security-Policy` meta tag in `index.html` is strict. Any new external resource (CDN, font, image domain) requires an explicit addition there.

## Performance

Keep JS and CSS minimal. No runtime dependencies. Avoid adding new CDN scripts to the initial page load.

## Deployment

GitHub Pages via Actions (`.github/workflows/deploy.yml`). Push to `main` → auto-deploy.

## Development

Run locally with:
```
python3 -m http.server
# or
npx serve .
```

Then open `http://localhost:8000`.

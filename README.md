# EndThis

A simple web application.

## Features

- (Add features here)

## Architecture

Single-page app — no build step, no runtime dependencies.

| File | Purpose |
|------|---------|
| `index.html` | HTML skeleton, meta tags, CSP |
| `style.css` | All styles |
| `script.js` | All application logic (IIFE) |

## Running locally

No build step required. Just serve the files:

```sh
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:8000` (or whichever port).

## Deployment

Pushes to `main` can be auto-deployed via GitHub Pages + Actions.

## How to extend

**Add styles** — update `style.css` for new UI elements.

**Add functionality** — add logic to the IIFE in `script.js`.

**Add external resources** — update the `Content-Security-Policy` meta tag in `index.html`.

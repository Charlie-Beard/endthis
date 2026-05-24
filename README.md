# EndThis

Anonymous meeting end-vote tool. An organizer shares a link; participants click once to signal they want to wrap up. The organizer sees a live count and gets an alert when ≥50% are ready to leave — no one has to say it out loud.

Live at **[endthis.online](https://endthis.online)**

---

## How it works

| Who | URL | What they see |
|-----|-----|---------------|
| Organizer | `endthis.online` | Creates a room, gets a host link |
| Organizer | `/?room=X&h=TOKEN` | Live counter, share link, threshold alert |
| Participant | `/?room=X` | Single vote button, anonymous |

Votes are anonymous — the organizer only sees the count, never who voted. Participants see "X others feel the same" once at least one other person has voted.

---

## Stack

- Pure HTML/CSS/JS — no framework, no build step
- [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) for live state (free tier)
- Firebase Anonymous Authentication for per-user presence/vote tracking
- Jekyll 4 + GitHub Actions for GitHub Pages deployment

---

## Firebase setup (required)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** (us-central1)
3. Enable **Anonymous Authentication** (Authentication → Sign-in method)
4. Set database rules (Realtime Database → Rules tab):

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": "auth != null && !data.exists()",
        "ended": { ".write": "auth != null" },
        "presence": {
          "$uid": { ".write": "auth != null && auth.uid === $uid" }
        },
        "votes": {
          "$uid": { ".write": "auth != null && auth.uid === $uid" }
        }
      }
    }
  }
}
```

5. Paste your Firebase config into `script.js` (clearly marked at the top of the file)

---

## Running locally

```sh
bundle exec jekyll serve --port 5500
```

Then open `http://127.0.0.1:5500/`.

Requires Ruby + Bundler. Run `bundle install` first if needed.

---

## Generating image assets

Open `generate-assets.html` in a browser and download:
- `favicon-32.png` — 32×32 favicon
- `apple-touch-icon.png` — 180×180 iOS icon
- `og-image.png` — 1200×630 social sharing image

Place all three files in the project root alongside `favicon.svg`.

---

## Deployment

Push to `main` → GitHub Actions builds with Jekyll and deploys to GitHub Pages automatically.

Configure your custom domain in repository Settings → Pages.

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION  ←  paste your Firebase project config here
//  console.firebase.google.com → Project Settings → Your apps → SDK setup
// ─────────────────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAbYx-Rd4WMZZjqWaQpMIcmnB-S6oiLRN0',
  authDomain:        'endthis-56e16.firebaseapp.com',
  databaseURL:       'https://endthis-56e16-default-rtdb.firebaseio.com',
  projectId:         'endthis-56e16',
  storageBucket:     'endthis-56e16.firebasestorage.app',
  messagingSenderId: '876389014993',
  appId:             '1:876389014993:web:3311b4cbc46f27c9ced4f0',
};
// ─────────────────────────────────────────────────────────────────────────────
//
//  Firebase Realtime Database security rules to paste in your console:
//
//  {
//    "rules": {
//      "rooms": {
//        "$roomId": {
//          ".read": true,
//          ".write": "auth != null && !data.exists()",
//          "ended": {
//            ".write": "auth != null"
//          },
//          "presence": {
//            "$uid": { ".write": "auth != null && auth.uid === $uid" }
//          },
//          "votes": {
//            "$uid": { ".write": "auth != null && auth.uid === $uid" }
//          }
//        }
//      }
//    }
//  }
//
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp }                                    from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged }   from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import { getDatabase, ref, set, get, onValue, remove, onDisconnect as fbOnDisconnect }
  from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js';

const VOTE_THRESHOLD  = 0.5;
const ROOM_ID_CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike chars
const ROOM_ID_LEN     = 6;
const TOKEN_CHARS     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LEN       = 20;

// ── Utilities ────────────────────────────────────────────────────────────────

function randomStr(chars, len) {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join('');
}

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

function parseParams() {
  const p      = new URLSearchParams(location.search);
  const roomId = p.get('room');
  const VALID  = /^[A-Z2-9]{6}$/;
  return {
    roomId:    roomId && VALID.test(roomId) ? roomId : null,
    hostToken: p.get('h'),
  };
}

function participantUrl(roomId) {
  return `${location.origin}${location.pathname}?room=${roomId}`;
}

// ── View management ──────────────────────────────────────────────────────────

const VIEW_IDS = ['loading-view', 'landing-view', 'host-view', 'participant-view', 'ended-view'];

function showView(id) {
  VIEW_IDS.forEach(v => document.getElementById(v).classList.toggle('active', v === id));
}

function showEnded(title, sub) {
  document.getElementById('ended-title').textContent = title;
  document.getElementById('ended-sub').textContent   = sub;
  showView('ended-view');
}

// ── Copy to clipboard ────────────────────────────────────────────────────────

function copyToClipboard(text, btn, original, done = '✓ Copied') {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = done;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2200);
  });
}

// ── Landing ──────────────────────────────────────────────────────────────────

function initLanding(db) {
  showView('landing-view');

  document.getElementById('start-meeting-btn').addEventListener('click', async () => {
    const btn = document.getElementById('start-meeting-btn');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    const roomId        = randomStr(ROOM_ID_CHARS, ROOM_ID_LEN);
    const hostToken     = randomStr(TOKEN_CHARS, TOKEN_LEN);
    const hostTokenHash = await sha256hex(hostToken);

    try {
      await set(ref(db, `rooms/${roomId}`), {
        created: Date.now(),
        host:    hostTokenHash,
        ended:   false,
      });
      location.href = `${location.pathname}?room=${roomId}&h=${hostToken}`;
    } catch {
      btn.disabled = false;
      btn.textContent = 'Start a meeting';
    }
  });
}

// ── Host view ────────────────────────────────────────────────────────────────

async function initHostView(db, roomId, hostToken, uid) {
  // Verify host token: compare SHA-256(urlToken) against stored hash
  const [hostSnap, tokenHash] = await Promise.all([
    get(ref(db, `rooms/${roomId}/host`)),
    sha256hex(hostToken),
  ]);
  if (!hostSnap.exists() || hostSnap.val() !== tokenHash) {
    initParticipantView(db, roomId, uid);
    return;
  }

  showView('host-view');

  const pUrl = participantUrl(roomId);
  document.getElementById('room-badge').textContent      = roomId;
  document.getElementById('share-link-full').textContent = pUrl;
  document.getElementById('share-link-mini').textContent = pUrl;

  const hostViewEl  = document.getElementById('host-view');
  const mainCopyBtn = document.getElementById('copy-btn-main');
  const miniCopyBtn = document.getElementById('copy-btn-mini');

  mainCopyBtn.addEventListener('click', () => {
    copyToClipboard(pUrl, mainCopyBtn, 'Copy link', '✓ Copied!');
    hostViewEl.classList.add('shared');
  });

  miniCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(pUrl).then(() => {
      miniCopyBtn.textContent = '✓ Copied';
      setTimeout(() => { miniCopyBtn.textContent = 'Copy again'; }, 2200);
    });
  });

  document.getElementById('close-session-btn').addEventListener('click', () => {
    if (confirm('Close this session? Participants will see the meeting has ended.')) {
      set(ref(db, `rooms/${roomId}/ended`), true);
    }
  });

  // Watch for the session being closed
  onValue(ref(db, `rooms/${roomId}/ended`), snap => {
    if (snap.val() === true) {
      showEnded('Session closed', 'You have closed this meeting session.');
    }
  });

  // Live counters
  let presenceCount = 0;
  let voteCount     = 0;

  function renderCounter() {
    const waiting  = document.getElementById('counter-waiting');
    const live     = document.getElementById('counter-live');
    const fill     = document.getElementById('progress-fill');
    const alert    = document.getElementById('threshold-alert');

    if (presenceCount === 0) {
      waiting.style.display = '';
      live.style.display    = 'none';
      alert.classList.remove('visible');
      return;
    }

    waiting.style.display = 'none';
    live.style.display    = '';

    document.getElementById('vote-count').textContent        = voteCount;
    document.getElementById('participant-count').textContent = presenceCount;

    const pct = (voteCount / presenceCount) * 100;
    fill.style.width = `${pct}%`;
    fill.classList.toggle('at-threshold', voteCount / presenceCount >= VOTE_THRESHOLD);
    alert.classList.toggle('visible', voteCount / presenceCount >= VOTE_THRESHOLD);
  }

  onValue(ref(db, `rooms/${roomId}/presence`), snap => {
    presenceCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    renderCounter();
  });

  onValue(ref(db, `rooms/${roomId}/votes`), snap => {
    voteCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    renderCounter();
  });
}

// ── Participant view ──────────────────────────────────────────────────────────

async function initParticipantView(db, roomId, uid) {
  const roomSnap = await get(ref(db, `rooms/${roomId}`));

  if (!roomSnap.exists() || roomSnap.val().ended === true) {
    showEnded('This meeting has ended', 'The organizer has closed this session.');
    return;
  }

  showView('participant-view');

  const presenceRef = ref(db, `rooms/${roomId}/presence/${uid}`);
  const voteRef     = ref(db, `rooms/${roomId}/votes/${uid}`);

  // Register presence; auto-remove when tab closes
  await set(presenceRef, true);
  fbOnDisconnect(presenceRef).remove();

  onValue(ref(db, `rooms/${roomId}/ended`), snap => {
    if (snap.val() === true) {
      remove(presenceRef);
      showEnded('This meeting has ended', 'The organizer has wrapped up the session.');
    }
  });

  const voteBtn     = document.getElementById('vote-btn');
  const voteConfirm = document.getElementById('vote-confirm');
  const othersVoted = document.getElementById('others-voted');
  let hasVoted      = false;

  voteBtn.addEventListener('click', () => {
    hasVoted = !hasVoted;
    if (hasVoted) {
      set(voteRef, true);
      voteBtn.textContent = 'I changed my mind';
      voteBtn.classList.add('voted');
      voteConfirm.classList.add('visible');
    } else {
      remove(voteRef);
      voteBtn.textContent = 'I want to end this meeting';
      voteBtn.classList.remove('voted');
      voteConfirm.classList.remove('visible');
    }
  });

  // Show "X others feel the same" (only when ≥1 other has voted)
  onValue(ref(db, `rooms/${roomId}/votes`), snap => {
    const allVotes    = snap.exists() ? Object.keys(snap.val()) : [];
    const othersCount = allVotes.filter(id => id !== uid).length;
    if (othersCount >= 1) {
      const p = othersCount === 1 ? 'person feels' : 'people feel';
      othersVoted.textContent = `${othersCount} other ${p} the same.`;
      othersVoted.classList.add('visible');
    } else {
      othersVoted.classList.remove('visible');
    }
  });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

function showConfigError() {
  document.getElementById('loading-view').innerHTML = `
    <div style="max-width:420px;padding:2rem;text-align:center;font-family:inherit">
      <div style="font-size:1.25rem;font-weight:650;margin-bottom:.75rem;color:#1A1814">
        Firebase not configured
      </div>
      <div style="font-size:.9375rem;color:#7B7267;line-height:1.6">
        Open <code style="font-family:monospace;background:#F3F0EB;padding:.1em .4em;border-radius:4px">script.js</code>
        and fill in your Firebase project config at the top of the file.
      </div>
    </div>`;
}

function boot() {
  if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
    showConfigError();
    return;
  }

  const app  = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db   = getDatabase(app);

  // Use onAuthStateChanged so a returning tab reuses the same anonymous identity
  const unsubscribe = onAuthStateChanged(auth, user => {
    if (user) {
      unsubscribe();
      const { roomId, hostToken } = parseParams();
      if (!roomId) {
        initLanding(db);
      } else if (hostToken) {
        initHostView(db, roomId, hostToken, user.uid);
      } else {
        initParticipantView(db, roomId, user.uid);
      }
    }
  });

  signInAnonymously(auth).catch(() => {
    showEnded('Connection error', 'Could not connect. Please refresh and try again.');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

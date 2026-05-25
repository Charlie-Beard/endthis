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
//      "meetings": {
//        "$meetingId": {
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
const MEETING_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike chars
const MEETING_ID_LEN   = 6;
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
  const p         = new URLSearchParams(location.search);
  const meetingId = p.get('meeting');
  const VALID     = /^[A-Z2-9]{6}$/;
  return {
    meetingId: meetingId && VALID.test(meetingId) ? meetingId : null,
    hostToken: p.get('h'),
  };
}

function participantUrl(meetingId) {
  return `${location.origin}${location.pathname}?meeting=${meetingId}`;
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

// ── Confetti ─────────────────────────────────────────────────────────────────

function launchConfetti() {
  const container = document.getElementById('confetti');
  if (!container) return;
  const colors = ['#D97757', '#F59E0B', '#86EFAC', '#93C5FD', '#FDA4AF', '#E5E1DA'];
  for (let i = 0; i < 90; i++) {
    const el  = document.createElement('div');
    el.className = 'confetti-piece';
    const size = 6 + Math.random() * 7;
    el.style.cssText = [
      `left:${Math.random() * 100}%`,
      `width:${size}px`, `height:${size}px`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-duration:${1.4 + Math.random() * 1.8}s`,
      `animation-delay:${Math.random() * 0.6}s`,
    ].join(';');
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Animated count ────────────────────────────────────────────────────────────

function animateCount(el, to, duration = 280) {
  const from  = parseInt(el.textContent) || 0;
  if (from === to) return;
  const start = performance.now();
  const tick  = now => {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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

    const meetingId     = randomStr(MEETING_ID_CHARS, MEETING_ID_LEN);
    const hostToken     = randomStr(TOKEN_CHARS, TOKEN_LEN);
    const hostTokenHash = await sha256hex(hostToken);

    try {
      await set(ref(db, `meetings/${meetingId}`), {
        created: Date.now(),
        host:    hostTokenHash,
        ended:   false,
      });
      location.href = `${location.pathname}?meeting=${meetingId}&h=${hostToken}`;
    } catch {
      btn.disabled = false;
      btn.textContent = 'Start a meeting';
    }
  });
}

// ── Host view ────────────────────────────────────────────────────────────────

async function initHostView(db, meetingId, hostToken, uid) {
  // Verify host token: compare SHA-256(urlToken) against stored hash
  const [hostSnap, tokenHash] = await Promise.all([
    get(ref(db, `meetings/${meetingId}/host`)),
    sha256hex(hostToken),
  ]);
  if (!hostSnap.exists() || hostSnap.val() !== tokenHash) {
    initParticipantView(db, meetingId, uid);
    return;
  }

  showView('host-view');

  const pUrl = participantUrl(meetingId);
  document.getElementById('meeting-badge').textContent    = `Meeting ID: ${meetingId}`;
  document.getElementById('share-link-full').textContent = pUrl;
  document.getElementById('share-link-mini').textContent = pUrl;

  const hostViewEl  = document.getElementById('host-view');
  const mainCopyBtn = document.getElementById('copy-btn-main');
  const miniCopyBtn = document.getElementById('copy-btn-mini');
  const qrBtn       = document.getElementById('qr-btn');
  const qrContainer = document.getElementById('qr-container');

  // Native share on mobile; clipboard copy on desktop
  if (navigator.share) {
    mainCopyBtn.textContent = 'Share link';
    mainCopyBtn.addEventListener('click', () => {
      navigator.share({ title: 'EndThis meeting', url: pUrl }).catch(() => {});
      hostViewEl.classList.add('shared');
    });
  } else {
    mainCopyBtn.addEventListener('click', () => {
      copyToClipboard(pUrl, mainCopyBtn, 'Copy link', '✓ Copied!');
      hostViewEl.classList.add('shared');
    });
  }

  miniCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(pUrl).then(() => {
      miniCopyBtn.textContent = '✓ Copied';
      setTimeout(() => { miniCopyBtn.textContent = 'Copy again'; }, 2200);
    });
  });

  // QR code toggle
  let qrLoaded = false;
  qrBtn.addEventListener('click', () => {
    if (!qrLoaded) {
      const img = document.createElement('img');
      img.src    = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pUrl)}`;
      img.width  = 180; img.height = 180;
      img.alt    = 'QR code for meeting link';
      qrContainer.appendChild(img);
      qrLoaded = true;
    }
    const visible = qrContainer.classList.toggle('visible');
    qrBtn.textContent = visible ? 'Hide QR code' : 'Show QR code';
  });

  document.getElementById('close-session-btn').addEventListener('click', () => {
    if (confirm('Close this session? Participants will see the meeting has ended.')) {
      set(ref(db, `meetings/${meetingId}/ended`), true);
    }
  });

  // Watch for the session being closed
  onValue(ref(db, `meetings/${meetingId}/ended`), snap => {
    if (snap.val() === true) {
      showEnded('Session closed', 'You have closed this meeting session.');
    }
  });

  // Live counters
  let presenceCount       = 0;
  let voteCount           = 0;
  let thresholdCelebrated = false;

  function renderCounter() {
    const waiting    = document.getElementById('counter-waiting');
    const live       = document.getElementById('counter-live');
    const fill       = document.getElementById('progress-fill');
    const alert      = document.getElementById('threshold-alert');
    const descriptor = document.getElementById('counter-descriptor');

    if (presenceCount === 0) {
      waiting.style.display = '';
      live.style.display    = 'none';
      alert.classList.remove('visible');
      document.title = 'EndThis';
      return;
    }

    waiting.style.display = 'none';
    live.style.display    = '';

    animateCount(document.getElementById('vote-count'), voteCount);
    animateCount(document.getElementById('participant-count'), presenceCount);

    const ratio = voteCount / presenceCount;
    const pct   = ratio * 100;
    fill.style.width = `${pct}%`;

    const atThreshold = ratio >= VOTE_THRESHOLD;
    fill.classList.toggle('at-threshold', atThreshold);
    alert.classList.toggle('visible', atThreshold);

    // Dynamic descriptor copy
    if (atThreshold) {
      descriptor.textContent = 'have had enough — time to go';
    } else if (ratio >= 0.34) {
      descriptor.textContent = 'are ready to wrap up';
    } else {
      descriptor.textContent = 'want to end this meeting';
    }

    // Tab title badge
    document.title = `(${voteCount}/${presenceCount}) EndThis`;

    // Confetti on first threshold crossing
    if (atThreshold && voteCount > 0 && !thresholdCelebrated) {
      thresholdCelebrated = true;
      launchConfetti();
    }
    if (!atThreshold) thresholdCelebrated = false;
  }

  onValue(ref(db, `meetings/${meetingId}/presence`), snap => {
    presenceCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    renderCounter();
  });

  onValue(ref(db, `meetings/${meetingId}/votes`), snap => {
    voteCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    renderCounter();
  });
}

// ── Participant view ──────────────────────────────────────────────────────────

async function initParticipantView(db, meetingId, uid) {
  const meetingSnap = await get(ref(db, `meetings/${meetingId}`));

  if (!meetingSnap.exists() || meetingSnap.val().ended === true) {
    showEnded('This meeting has ended', 'The organizer has closed this session.');
    return;
  }

  showView('participant-view');

  const presenceRef = ref(db, `meetings/${meetingId}/presence/${uid}`);
  const voteRef     = ref(db, `meetings/${meetingId}/votes/${uid}`);

  // Register presence; auto-remove when tab closes
  await set(presenceRef, true);
  fbOnDisconnect(presenceRef).remove();

  onValue(ref(db, `meetings/${meetingId}/ended`), snap => {
    if (snap.val() === true) {
      remove(presenceRef);
      showEnded('This meeting has ended', 'The organizer has wrapped up the session.');
    }
  });

  const voteBtn       = document.getElementById('vote-btn');
  const voteConfirm   = document.getElementById('vote-confirm');
  const othersVoted   = document.getElementById('others-voted');
  const firstVoterMsg = document.getElementById('first-voter-msg');
  let hasVoted        = false;

  voteBtn.addEventListener('click', () => {
    hasVoted = !hasVoted;
    if (navigator.vibrate) navigator.vibrate(10);
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
      firstVoterMsg.classList.remove('visible');
    }
  });

  // Show "X others feel the same" and first-voter encouragement
  onValue(ref(db, `meetings/${meetingId}/votes`), snap => {
    const allVotes    = snap.exists() ? Object.keys(snap.val()) : [];
    const othersCount = allVotes.filter(id => id !== uid).length;

    if (hasVoted && othersCount === 0) {
      firstVoterMsg.classList.add('visible');
    } else {
      firstVoterMsg.classList.remove('visible');
    }

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
      const { meetingId, hostToken } = parseParams();
      if (!meetingId) {
        initLanding(db);
      } else if (hostToken) {
        initHostView(db, meetingId, hostToken, user.uid);
      } else {
        initParticipantView(db, meetingId, user.uid);
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

import { Platform } from 'react-native';
import { showAlert } from './alertUtils';

// The web build is a PWA. A PWA installed on the iOS home screen is NOT
// reloaded when the user reopens it from the app switcher — the old
// JavaScript simply stays in memory for days, so new deploys never show up
// (the server, the headers and the service worker are all fine: the live site
// can be on the new version while the phone still runs the old one).
//
// Every deploy gets a new hashed entry bundle, referenced from the HTML. This
// compares the bundle the page is running with the one the server serves now:
//  - at startup, a mismatch means the HTML itself was stale -> reload once;
//  - when the app comes back to the foreground (or every few minutes), a
//    mismatch means a deploy happened while it was open -> ask before
//    reloading, so nobody loses a half-filled form.

const ENTRY_RE = /\/_expo\/static\/js\/web\/entry-[A-Za-z0-9]+\.js/;
const RELOAD_GUARD_KEY = 'tcfit_version_reload_for';
const RECHECK_MS = 10 * 60 * 1000;

export function extractEntryPath(html) {
  const m = typeof html === 'string' ? html.match(ENTRY_RE) : null;
  return m ? m[0] : null;
}

function loadedEntryPath() {
  const el = document.querySelector('script[src*="/_expo/static/js/web/entry-"]');
  return extractEntryPath(el ? el.getAttribute('src') : '');
}

async function fetchLatestEntryPath() {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return null;
  return extractEntryPath(await res.text());
}

function readGuard() {
  try { return window.sessionStorage.getItem(RELOAD_GUARD_KEY); } catch (e) { return null; }
}

function writeGuard(value) {
  try { window.sessionStorage.setItem(RELOAD_GUARD_KEY, value); } catch (e) { /* storage unavailable: the guard just won't persist */ }
}

export function installVersionWatcher() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};

  let promptedFor = null;
  let checking = false;

  const check = async (atStartup) => {
    if (checking) return;
    checking = true;
    try {
      const current = loadedEntryPath();
      if (!current) return; // dev server / unexpected markup: nothing to compare
      const latest = await fetchLatestEntryPath();
      if (!latest || latest === current) return;

      if (atStartup) {
        // One silent reload per new build; if the reload somehow still lands on
        // the old HTML, stop instead of looping.
        if (readGuard() === latest) return;
        writeGuard(latest);
        window.location.reload();
        return;
      }

      if (promptedFor === latest) return;
      promptedFor = latest;
      showAlert(
        'Nova versão do TcFit',
        'Tem uma atualização disponível. Atualize pra ver as novidades.',
        [
          { text: 'Atualizar agora', onPress: () => window.location.reload() },
          { text: 'Depois', style: 'cancel' },
        ]
      );
    } catch (e) {
      // offline / fetch blocked: try again next time, never surface an error for this
    } finally {
      checking = false;
    }
  };

  const onVisibility = () => { if (document.visibilityState === 'visible') check(false); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onVisibility);
  const timer = setInterval(() => { if (document.visibilityState === 'visible') check(false); }, RECHECK_MS);
  check(true);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onVisibility);
    clearInterval(timer);
  };
}

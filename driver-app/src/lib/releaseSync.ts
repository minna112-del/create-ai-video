const STORAGE_KEY = 'golapi_driver_active_release';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let checking = false;

function canReloadSafely() {
  const activeDelivery = document.getElementById('btn-complete-step') || document.getElementById('btn-accept-order');
  const editing = document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');
  return !activeDelivery && !editing;
}

async function checkRelease() {
  if (checking || !navigator.onLine) return;
  checking = true;
  try {
    const response = await fetch(`/app-version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const data = await response.json() as { release?: string };
    if (!data.release) return;
    const active = localStorage.getItem(STORAGE_KEY);
    if (!active) {
      localStorage.setItem(STORAGE_KEY, data.release);
    } else if (active !== data.release) {
      if (!canReloadSafely()) return;
      localStorage.setItem(STORAGE_KEY, data.release);
      window.location.reload();
    }
  } catch {
    // Offline and transient deployment checks are retried automatically.
  } finally {
    checking = false;
  }
}

export function startReleaseSync() {
  void checkRelease();
  window.setInterval(() => void checkRelease(), CHECK_INTERVAL_MS);
  window.addEventListener('online', () => void checkRelease());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkRelease();
  });
}

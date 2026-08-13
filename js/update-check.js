/* update-check.js — zero-touch website/app release synchronization.
   Customer and Driver Android shells load the deployed HTTPS applications, so
   a website deployment is the app update. This module notices a new immutable
   release id and refreshes the visible app without asking the user to install
   another APK. Native Android permission/engine changes still require a newly
   signed APK because Android does not allow ordinary apps to silently replace
   their own package. */
(function createReleaseSync(global) {
  'use strict';

  const STORAGE_KEY = 'golapi_active_release';
  const CHECK_INTERVAL_MS = 5 * 60 * 1000;
  let checking = false;

  function canReloadSafely() {
    const protectedPages = new Set(['checkout', 'custom-bazar', 'admin-dash', 'company-os']);
    const currentPage = global.Router?.current;
    const editing = document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');
    const staffWorkspace = global.AppRegistry?.isStaff?.(currentPage);
    return !editing && !protectedPages.has(currentPage) && !staffWorkspace;
  }

  async function fetchRelease() {
    const response = await fetch(`/app-version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`release check failed (${response.status})`);
    const data = await response.json();
    if (!data?.release) throw new Error('release id is missing');
    return String(data.release);
  }

  async function check() {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      const release = await fetchRelease();
      const activeRelease = localStorage.getItem(STORAGE_KEY);
      if (!activeRelease) {
        localStorage.setItem(STORAGE_KEY, release);
        return;
      }
      if (activeRelease !== release) {
        if (!canReloadSafely()) return;
        localStorage.setItem(STORAGE_KEY, release);
        const registration = await navigator.serviceWorker?.getRegistration?.();
        await registration?.update?.().catch(() => {});
        global.location.reload();
      }
    } catch (error) {
      if (global.isDev) console.warn('[release-sync]', error);
    } finally {
      checking = false;
    }
  }

  function init() {
    check();
    global.setInterval(check, CHECK_INTERVAL_MS);
    global.addEventListener('online', check);
    global.addEventListener('popstate', check);
    global.addEventListener('url-changed', check);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }

  global.UpdateCheck = Object.freeze({ init, check });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);

/* business-os-runtime.js — persistent Company OS session and Screen Wake Lock */
(function createBusinessOSRuntime(global) {
  'use strict';

  const SESSION_KEY = 'golapi_business_os_active';
  const subscribers = new Set();
  let wakeLock = null;
  let heartbeatTimer = null;
  let bound = false;
  let active = sessionStorage.getItem(SESSION_KEY) === '1';
  let status = 'idle';

  function translate(bn, en) {
    return global.I18n ? global.I18n.t(bn, en) : bn;
  }

  function updateStatus(nextStatus) {
    status = nextStatus;
    const button = document.getElementById('companyOsWakeLock');
    if (!button) return;
    const copy = {
      active: ['● ডিসপ্লে সচল', '● Display awake'],
      waiting: ['◐ ডিসপ্লে সচল রাখুন', '◐ Keep display awake'],
      unsupported: ['○ এই ব্রাউজারে সমর্থিত নয়', '○ Not supported in this browser'],
      error: ['○ পুনরায় চালু করুন', '○ Enable again'],
      idle: ['○ ডিসপ্লে সচল রাখুন', '○ Keep display awake']
    }[nextStatus] || ['○ ডিসপ্লে সচল রাখুন', '○ Keep display awake'];
    button.textContent = translate(copy[0], copy[1]);
    button.dataset.state = nextStatus;
    button.setAttribute('aria-pressed', String(nextStatus === 'active'));
  }

  function tick() {
    if (!active) return;
    subscribers.forEach(callback => {
      try { callback(Date.now()); } catch (error) { console.error('[business-os-runtime]', error); }
    });
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(tick, 1000 - (Date.now() % 1000));
  }

  async function requestWakeLock() {
    if (!active) return false;
    if (!('wakeLock' in navigator)) {
      updateStatus('unsupported');
      return false;
    }
    if (document.visibilityState !== 'visible') {
      updateStatus('waiting');
      return false;
    }
    if (wakeLock && !wakeLock.released) {
      updateStatus('active');
      return true;
    }
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      updateStatus('active');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        if (active) updateStatus(document.visibilityState === 'visible' ? 'error' : 'waiting');
      }, { once: true });
      return true;
    } catch (error) {
      updateStatus('error');
      return false;
    }
  }

  function bindLifecycle() {
    if (bound) return;
    bound = true;
    document.addEventListener('visibilitychange', () => {
      if (!active) return;
      tick();
      if (document.visibilityState === 'visible') requestWakeLock();
      else updateStatus('waiting');
    });
    document.addEventListener('languagechange', () => updateStatus(status));
    window.addEventListener('online', tick);
    window.addEventListener('offline', tick);
    window.addEventListener('pagehide', deactivate, { once: true });
  }

  function activate() {
    active = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    bindLifecycle();
    tick();
    requestWakeLock();
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    subscribers.add(callback);
    if (active) callback(Date.now());
    return () => subscribers.delete(callback);
  }

  async function deactivate() {
    active = false;
    sessionStorage.removeItem(SESSION_KEY);
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
    if (wakeLock && !wakeLock.released) {
      try { await wakeLock.release(); } catch (_) {}
    }
    wakeLock = null;
    updateStatus('idle');
  }

  global.BusinessOSRuntime = Object.freeze({
    activate,
    deactivate,
    requestWakeLock,
    subscribe,
    isActive: () => active,
    status: () => status
  });

  if (active) {
    bindLifecycle();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
    else activate();
  }
})(window);

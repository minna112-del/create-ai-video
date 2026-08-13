/* page-loader.js — reusable, promise-based fragment loader */
(function createPageLoader(global) {
  'use strict';

  const blockingPartials = [
    ['pages/topbar.html', 'slot-topbar'],
    ['pages/header.html', 'slot-header'],
    ['pages/cart-drawer.html', 'slot-cart-drawer'],
    ['pages/mobnav.html', 'slot-mobnav'],
    ['pages/chat-widget.html', 'slot-chat'],
    ['pages/toast.html', 'slot-toast'],
    ['pages/modals.html', 'slot-modals']
  ];
  const deferredPartials = [['pages/footer.html', 'slot-footer']];
  const container = document.getElementById('pageContainer');
  const requests = new Map();
  let ready = false;
  let readyTimeout = null;

  global.__lazyPages = global.AppRegistry.lazyPages();
  global.__loadedLazyPages = Object.create(null);

  function isSafeFragment(text) {
    return typeof text === 'string' && !/<!doctype\s+html|<html[\s>]/i.test(text);
  }

  async function fetchFragment(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await response.text();
      if (!isSafeFragment(text)) throw new Error('SPA fallback is not a valid fragment');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  function translate(root) {
    if (global.I18n) global.I18n.apply(root);
  }

  async function loadPartial(url, slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return false;
    try {
      slot.innerHTML = await fetchFragment(url);
      translate(slot);
      return true;
    } catch (error) {
      console.warn('[page-loader] partial load failed:', url, error.message);
      return false;
    }
  }

  async function ensurePage(name) {
    if (document.getElementById(`page-${name}`)) {
      global.__loadedLazyPages[name] = true;
      return true;
    }
    if (!global.AppRegistry.definition(name)) return false;
    if (requests.has(name)) return requests.get(name);

    const request = (async () => {
      try {
        const html = await fetchFragment(`pages/${name}.html`);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const fragment = document.createDocumentFragment();
        while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
        container.appendChild(fragment);
        const page = document.getElementById(`page-${name}`);
        if (!page) throw new Error(`Missing #page-${name}`);
        global.__loadedLazyPages[name] = true;
        translate(page);
        return true;
      } catch (error) {
        // A transient network failure must not poison this page for the rest
        // of the SPA session. Remove the rejected/resolved-false request so a
        // later navigation can retry the fragment.
        requests.delete(name);
        console.warn('[page-loader] page load failed:', name, error.message);
        return false;
      }
    })();
    requests.set(name, request);
    return request;
  }

  function dispatchReady() {
    if (ready) return;
    ready = true;
    clearTimeout(readyTimeout);
    const loader = document.getElementById('pageLoader');
    if (loader) { loader.hidden = true; loader.style.display = 'none'; }
    document.dispatchEvent(new Event('pages-ready'));
  }

  function loadDeferredPartials() {
    const run = () => deferredPartials.forEach(([url, slot]) => loadPartial(url, slot));
    if ('requestIdleCallback' in global) global.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1000);
  }

  global.PageLoader = Object.freeze({ ensurePage, loadPartial, fetchFragment });
  global.__ensureLazyPage = function ensureLazyPage(name, callback) {
    ensurePage(name).then(() => callback?.());
  };

  Promise.allSettled([
    ...blockingPartials.map(([url, slot]) => loadPartial(url, slot)),
    ...global.AppRegistry.initialPages().map(ensurePage)
  ]).then(() => {
    dispatchReady();
    loadDeferredPartials();
  });

  readyTimeout = setTimeout(dispatchReady, 15000);
})(window);

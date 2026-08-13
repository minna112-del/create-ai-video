/* ═══════════════════════════════════════════════════════════════
   Deep Link Routing — For Driver & Zone Manager Apps + SEO URLs
   ═══════════════════════════════════════════════════════════════
   
   This script enhances the website to handle deep links from
   the Android apps AND real, crawlable customer-facing URLs
   (SEO-এর জন্য — /product/:id, /category/:cat ইত্যাদি)।
   
   How it works:
   1. Customer app opens → https://www.golapishop.online/ → home
   2. Driver app opens → https://www.golapishop.online/driver → driver portal
   3. Manager app opens → https://www.golapishop.online/manager → zone manager
   4. Product shared link → https://www.golapishop.online/product/abc123 → সরাসরি সেই প্রোডাক্ট
   5. Category link → https://www.golapishop.online/category/medicine → সেই ক্যাটাগরির লিস্টিং
   
   Add to index.html BEFORE </body>:
   <script src="./js/deep-links.js"></script>
   ═══════════════════════════════════════════════════════════════ */

const DeepLinkHandler = {
  init() {
    if (document.getElementById('page-home')) {
      this.handleCurrentUrl();
    } else {
      document.addEventListener('pages-ready', () => this.handleCurrentUrl(), { once: true });
    }

    // Listen for URL changes (TWA navigation, back/forward)
    window.addEventListener('popstate', () => this.handleCurrentUrl());

    // Listen for pushState/replaceState (SPA navigation) — router.js নিজেও pushState করে (SEO URL-এর জন্য),
    // তাই এখানে duplicate-navigation এড়াতে handleCurrentUrl()-এর ভেতরেই Router.current চেক করা আছে।
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function(...args) {
      origPush.apply(this, args);
      window.dispatchEvent(new Event('url-changed'));
    };
    history.replaceState = function(...args) {
      origReplace.apply(this, args);
      window.dispatchEvent(new Event('url-changed'));
    };

    window.addEventListener('url-changed', () => this.handleCurrentUrl());
  },

  handleCurrentUrl() {
    const path = window.location.pathname.toLowerCase();
    const search = new URLSearchParams(window.location.search);

    // Check role param (legacy support: ?role=driver)
    const role = search.get('role');
    if (role === 'driver') return this.navigate('driver');
    if (role === 'zone-manager' || role === 'manager') return this.navigate('zone-manager');

    // Public, staff, alias ও dynamic URL একই registry থেকে resolve হয়।
    if (typeof Router !== 'undefined') {
      const target = Router.resolvePath(path);
      if (target) return this.navigate(target.page, target.params);
    }

    // Check hash-based routing (পুরনো #লিংক-এর ব্যাকওয়ার্ড কম্প্যাটিবিলিটি)
    const hash = window.location.hash.replace('#', '');
    if (hash && (document.getElementById('page-' + hash) || (window.__lazyPages || []).includes(hash))) {
      return this.navigate(hash);
    }

    return false;
  },

  navigate(page, params = {}) {
    // Only navigate if Router is available and page/params actually changed
    if (typeof Router === 'undefined') return false;
    const sameParams = JSON.stringify(Router.params||{}) === JSON.stringify(params);
    if (Router.current === page && sameParams) return true;
    if (typeof isDev !== 'undefined' && isDev) console.log(`DeepLink: Navigating to ${page}`, params);
    Router.go(page, params, { skipHistory: true }); // URL ইতিমধ্যেই সঠিক, তাই router আবার pushState করবে না
    return true;
  },

  // Helper: Build shareable deep link URLs (Share বাটন/কপি-লিংক ফিচারের জন্য ব্যবহার করা যায়)
  buildUrl(page, params = {}) {
    const pathMap = Object.assign({
      home: '/', 'zone-manager': '/zone-manager', 'custom-bazar': '/custom-bazar',
      medical: '/medical', myorders: '/myorders', 'about-app': '/about',
      contact: '/contact', terms: '/terms', 'privacy-info': '/privacy'
    }, typeof Router !== 'undefined' ? Router.staffPaths : {});
    let path = pathMap[page] || '/';
    if (page === 'product' && params.id) path = `/product/${params.id}`;
    if (page === 'listing' && params.cat) path = `/category/${params.cat}`;
    return `https://www.golapishop.online${path}`;
  }
};

// Initialize after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DeepLinkHandler.init());
} else {
  DeepLinkHandler.init();
}

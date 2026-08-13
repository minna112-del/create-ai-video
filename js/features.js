/* features.js — AddressService + OrderTracker + NotifHelper */

/* ═══════════════════════════════════════════
   AddressService — Saved Addresses Management
   ═══════════════════════════════════════════ */
const AddressService = {
  cache: [],

  async loadAddresses() {
    if (!FB) return this.getLocal();
    const user = Auth.currentUser;
    if (!user) return this.getLocal();
    try {
      const snap = await FB.getDocs(FB.query(
        FB.collection(FB.db, 'addresses'),
        FB.where('userId', '==', user.uid)
      ));
      const addrs = [];
      snap.forEach(d => addrs.push({ id: d.id, ...d.data() }));
      addrs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      this.cache = addrs;
      localStorage.setItem('golapi_addresses', JSON.stringify(addrs));
      return addrs;
    } catch (e) {
      devWarn('AddressService load:', e.message);
      return this.getLocal();
    }
  },

  getLocal() {
    try { this.cache = JSON.parse(localStorage.getItem('golapi_addresses') || '[]'); }
    catch (e) { this.cache = []; }
    return this.cache;
  },

  async saveAddress(addr) {
    if (!addr.label || !addr.address) { toast('লেবেল ও ঠিকানা দিন', 'error'); return false; }
    if (FB && Auth.currentUser) {
      try {
        const docRef = await FB.addDoc(FB.collection(FB.db, 'addresses'), {
          userId: Auth.currentUser.uid,
          label: addr.label,
          upazila: addr.upazila || '',
          union: addr.union || '',
          village: addr.village || '',
          address: addr.address,
          phone: addr.phone || Auth.currentUser.phoneNumber || '',
          createdAt: FB.serverTimestamp()
        });
        this.cache.unshift({ id: docRef.id, ...addr });
        toast('✓ ঠিকানা সেভ হয়েছে', 'success');
        return true;
      } catch (e) {
        toast('সেভ ব্যর্থ: ' + e.message, 'error');
        return false;
      }
    }
    /* Fallback: localStorage */
    const id = 'local_' + Date.now();
    this.cache.unshift({ id, ...addr });
    localStorage.setItem('golapi_addresses', JSON.stringify(this.cache));
    toast('✓ ঠিকানা সেভ হয়েছে', 'success');
    return true;
  },

  async deleteAddress(id) {
    if (FB && Auth.currentUser && !id.startsWith('local_')) {
      try { await FB.deleteDoc(FB.doc(FB.db, 'addresses', id)); }
      catch (e) { devWarn('Delete addr:', e.message); }
    }
    this.cache = this.cache.filter(a => a.id !== id);
    localStorage.setItem('golapi_addresses', JSON.stringify(this.cache));
    toast('ঠিকানা মুছে ফেলা হয়েছে');
    this.renderAddresses();
  },

  renderAddresses() {
    const el = document.getElementById('addressList');
    if (!el) return;
    if (!this.cache.length) {
      el.innerHTML = `<div class="empty-state" style="padding:20px"><div class="em">📍</div><h3>কোনো ঠিকানা নেই</h3><p>চেকআউট দ্রুত করতে ঠিকানা সেভ করুন</p></div>`;
      return;
    }
    el.innerHTML = this.cache.map(a => `
      <div class="card" style="padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div style="flex:1">
            <div style="font-weight:600;color:#fff;font-size:14px;margin-bottom:4px">📍 ${esc(a.label)}</div>
            <div style="font-size:12.5px;color:var(--ink-muted);line-height:1.5">
              ${a.village ? esc(a.village) + ', ' : ''}${a.union ? esc(a.union) + ', ' : ''}${esc(a.upazila) || ''}<br>
              ${esc(a.address)}<br>
              ${a.phone ? '📞 ' + esc(a.phone) : ''}
            </div>
          </div>
          <button onclick="AddressService.deleteAddress('${a.id}')" style="background:none;border:none;color:#e91e63;font-size:18px;cursor:pointer;padding:4px">🗑️</button>
        </div>
        <button class="btn btn-outline" style="font-size:12px;margin-top:8px;width:100%" onclick="AddressService.useAddress('${a.id}')">চেকআউটে ব্যবহার করুন →</button>
      </div>
    `).join('');
  },

  useAddress(id) {
    const a = this.cache.find(x => x.id === id);
    if (!a) return;
    /* Fill checkout fields */
    const set = (elId, val) => { const e = document.getElementById(elId); if (e && val) e.value = val; };
    set('ckName', Auth.currentUser?.displayName || '');
    set('ckPhone', a.phone || '');
    set('ckDistrict', a.upazila);
    if (a.upazila) { onUpazilaChange('ck'); setTimeout(() => set('ckZone', a.union), 200); }
    set('ckVillage', a.village);
    set('ckAddress', a.address);
    Router.go('checkout');
    toast('✓ ঠিকানা বসানো হয়েছে', 'success');
  },

  openModal(prefill = {}) {
    const m = document.getElementById('addressModal');
    if (!m) return;
    m.classList.add('show');
    const set = (id, val) => { const e = document.getElementById(id); if (e && val) e.value = val; };
    set('addrLabel', prefill.label || '');
    set('addrUpazila', prefill.upazila || '');
    set('addrVillage', prefill.village || '');
    set('addrAddress', prefill.address || '');
  },

  closeModal() {
    const m = document.getElementById('addressModal');
    if (m) m.classList.remove('show');
  },

  async submitModal() {
    const label = document.getElementById('addrLabel')?.value.trim() || '';
    const upazila = document.getElementById('addrUpazila')?.value || '';
    const union = document.getElementById('addrUnion')?.value || '';
    const village = document.getElementById('addrVillage')?.value.trim() || '';
    const address = document.getElementById('addrAddress')?.value.trim() || '';
    if (!label || !address) { toast('লেবেল ও ঠিকানা আবশ্যক', 'error'); return; }
    const ok = await this.saveAddress({ label, upazila, union, village, address });
    if (ok) { this.closeModal(); this.renderAddresses(); }
  }
};

/* ═══════════════════════════════════════════
   OrderTracker — Real-time Order Status
   ═══════════════════════════════════════════ */
const OrderTracker = {
  unsub: null,

  STATUS_MAP: {
    'pending': { label: 'অর্ডার গৃহীত', icon: '📝', color: '#facc15' },
    'confirmed': { label: 'নিশ্চিত হয়েছে', icon: '✅', color: '#4ade80' },
    'assigned': { label: 'ড্রাইভার বরাদ্দ', icon: '🛵', color: '#60a5fa' },
    'picked': { label: 'পিকআপ হয়েছে', icon: '📦', color: '#60a5fa' },
    'transit': { label: 'পথিমধ্যে', icon: '🛵', color: '#60a5fa' },
    'delivered': { label: 'ডেলিভারি সম্পন্ন', icon: '🎉', color: '#4ade80' },
    'cancelled': { label: 'বাতিল হয়েছে', icon: '❌', color: '#f87171' }
  },

  STATUS_ORDER: ['pending', 'confirmed', 'assigned', 'picked', 'transit', 'delivered'],

  async trackOrder(orderId) {
    if (!FB) { toast('সংযোগ সমস্যা', 'error'); return; }
    /* Stop previous listener */
    if (this.unsub) { this.unsub(); this.unsub = null; }
    try {
      this.unsub = FB.onSnapshot(FB.doc(FB.db, 'orders', orderId), (doc) => {
        if (!doc.exists()) {
          toast('অর্ডার পাওয়া যায়নি', 'error');
          return;
        }
        const order = { id: doc.id, ...doc.data() };
        this.renderTracking(order);
      });
    } catch (e) {
      devWarn('Track error:', e.message);
      /* Fallback: one-time fetch */
      try {
        const snap = await FB.getDoc(FB.doc(FB.db, 'orders', orderId));
        if (snap.exists()) this.renderTracking({ id: snap.id, ...snap.data() });
      } catch (e2) { toast('ট্র্যাকিং ব্যর্থ', 'error'); }
    }
  },

  renderTracking(order) {
    const el = document.getElementById('orderTrackBox');
    if (!el) return;
    const currentStatus = order.status || 'pending';
    const currentIdx = this.STATUS_ORDER.indexOf(currentStatus);
    const isCancelled = currentStatus === 'cancelled';

    if (isCancelled) {
      el.innerHTML = `
        <div class="track-cancelled" style="text-align:center;padding:20px">
          <div style="font-size:48px;margin-bottom:10px">❌</div>
          <h3 style="color:#f87171;margin-bottom:8px">অর্ডার বাতিল হয়েছে</h3>
          <p style="color:var(--ink-muted);font-size:13px">অর্ডার নাম্বার: ${order.id.substring(0,8).toUpperCase()}</p>
        </div>`;
      return;
    }

    const steps = this.STATUS_ORDER.map((status, idx) => {
      const info = this.STATUS_MAP[status];
      const isDone = idx <= currentIdx;
      const isCurrent = idx === currentIdx;
      return `
        <div class="track-step" style="display:flex;align-items:center;gap:12px;padding:10px 0;position:relative">
          <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;
            background:${isDone ? info.color : 'rgba(255,255,255,0.05)'};color:${isDone ? '#000' : 'var(--ink-muted)'};
            ${isCurrent ? 'box-shadow:0 0 0 4px ' + info.color + '33;' : ''}">
            ${isDone ? info.icon : '○'}
          </div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:${isCurrent ? '700' : '400'};color:${isDone ? '#fff' : 'var(--ink-muted)'}">${info.label}</div>
            ${isCurrent ? '<div style="font-size:11px;color:' + info.color + ';margin-top:2px">● বর্তমান স্ট্যাটাস</div>' : ''}
          </div>
          ${idx < this.STATUS_ORDER.length - 1 ? '<div style="position:absolute;left:17px;top:46px;width:2px;height:20px;background:' + (idx < currentIdx ? info.color : 'rgba(255,255,255,0.1)') + '"></div>' : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="track-header" style="margin-bottom:14px">
        <div style="font-size:13px;color:var(--ink-muted)">অর্ডার নাম্বার</div>
        <div style="font-size:16px;font-weight:700;color:var(--gold);font-family:Poppins">${order.id.substring(0,8).toUpperCase()}</div>
      </div>
      ${steps}
      ${order.driverName ? `
        <div class="card" style="margin-top:14px;padding:12px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">🛵</span>
            <div>
              <div style="font-size:12px;color:var(--ink-muted)">ডেলিভারি ড্রাইভার</div>
              <div style="font-size:14px;color:#fff;font-weight:600">${esc(order.driverName)}</div>
            </div>
          </div>
        </div>` : ''}
    `;
  },

  stopTracking() {
    if (this.unsub) { this.unsub(); this.unsub = null; }
  }
};

/* ═══════════════════════════════════════════
   NotifHelper — Push Notification Registration
   ═══════════════════════════════════════════ */
const NotifHelper = {
  async requestPermission() {
    if (!('Notification' in window)) { toast('এই ডিভাইসে নোটিফিকেশন সাপোর্ট নেই', 'error'); return false; }
    if (Notification.permission === 'granted') { toast('✓ নোটিফিকেশন চালু আছে', 'success'); return true; }
    if (Notification.permission === 'denied') { toast('নোটিফিকেশন ব্লক করা হয়েছে। ব্রাউজার সেটিংস থেকে অনুমতি দিন', 'error'); return false; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast('✓ নোটিফিকেশন চালু হয়েছে', 'success');
      this.saveToken();
      return true;
    }
    toast('নোটিফিকেশন অনুমতি দেওয়া হয়নি', 'error');
    return false;
  },

  async saveToken() {
    if (!FB || !Auth.currentUser || !FB.registerPushToken) return;
    try {
      await FB.registerPushToken(Auth.currentUser.uid);
      devLog('Push token saved');
    } catch (e) { devWarn('Token save:', e.message); }
  },

  showLocal(title, body) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icons/head_logo.webp',
        badge: '/icons/head_logo.webp',
        tag: 'golapi-' + Date.now()
      });
    }
  }
};
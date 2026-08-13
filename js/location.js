/* ============================================================
   js/location.js — Premium Location System (Google Maps ভিত্তিক)
   ============================================================
   কভার করে: লোকেশন সার্চ, ম্যাপে পিন সিলেকশন, দূরত্ব/ETA/চার্জ
   ক্রস-প্ল্যাটফর্ম: শুধু browser-standard Geolocation + Google Maps
   JS API ব্যবহার করে — কোনো platform-specific কোড নেই, তাই এখন
   PWA-তে যেমন কাজ করে, TWA বা native WebView-তেও একই কোড হুবহু
   কাজ করবে (আলাদা করে rewrite লাগবে না)।
   ============================================================ */

const LocationPicker = {
  map: null,
  marker: null,
  autocomplete: null,
  geocoder: null,
  distanceService: null,
  selected: { lat: null, lng: null, address: '', branchZone: null, distanceKm: null, etaMin: null },
  onConfirmCallback: null,
  _apiLoaded: false,
  _apiLoadingPromise: null,

  /* Google Maps JS API লেজি-লোড করে — শুধু যখন প্রথম দরকার হয় তখনই লোড হয়,
     পুরো সাইট প্রথম লোডে ভারী হয় না */
  loadApi(){
    if(this._apiLoaded) return Promise.resolve();
    if(this._apiLoadingPromise) return this._apiLoadingPromise;
    this._apiLoadingPromise = new Promise((resolve, reject)=>{
      if(window.google && window.google.maps){ this._apiLoaded = true; resolve(); return; }
      const key = window.GOOGLE_MAPS_API_KEY || '';
      if(!key){
        toast('⚠ Google Maps API key সেট করা হয়নি — index.html-এ GOOGLE_MAPS_API_KEY বসান', 'error');
        reject(new Error('Missing Google Maps API key'));
        return;
      }
      /* Google Maps auth ব্যর্থ হলে (ভুল key, billing বন্ধ, referrer restriction, API enable না থাকা)
         Google নিজেই এই গ্লোবাল কলব্যাক ডাকে — iPhone-এ console না থাকায় এটাই একমাত্র উপায়
         আসল কারণ ধরার। এখানে ধরে সরাসরি toast-এ দেখানো হচ্ছে, যাতে console ছাড়াই বোঝা যায়। */
      window.gm_authFailure = () => {
        toast('⚠ Google Maps authentication ব্যর্থ — সম্ভাব্য কারণ: API key ভুল/মুছে গেছে, billing বন্ধ, website restriction ভুল, বা API enable হয়নি', 'error');
        reject(new Error('gm_authFailure'));
      };
      window.__onGMapsLoaded = () => { this._apiLoaded = true; resolve(); };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__onGMapsLoaded&language=bn&region=BD`;
      script.async = true;
      script.onerror = () => reject(new Error('Google Maps লোড করা যায়নি'));
      document.head.appendChild(script);
    });
    return this._apiLoadingPromise;
  },

  /* ---------- মডাল খোলা ---------- */
  async open(onConfirm){
    this.onConfirmCallback = onConfirm;
    const modal = document.getElementById('locationPickerModal');
    if(!modal) return;
    modal.classList.add('show');
    const body = document.getElementById('lpBody');
    body.innerHTML = `<div style="padding:60px 20px;text-align:center;color:var(--ink-muted)">
      <div style="width:34px;height:34px;border:3px solid var(--line-l);border-top-color:var(--rose);border-radius:50%;margin:0 auto 14px;animation:spin 1s linear infinite"></div>
      ম্যাপ লোড হচ্ছে...
    </div>`;
    try{
      await this.loadApi();
      this.render();
      this.tryUseCurrentLocation();
    }catch(e){
      body.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--ink-muted)">
        <p style="margin-bottom:12px">ম্যাপ লোড করা যায়নি। ম্যানুয়ালি ঠিকানা লিখে চালিয়ে যান।</p>
        <button class="btn btn-outline btn-block" onclick="LocationPicker.close()">বন্ধ করুন</button>
      </div>`;
    }
  },
  close(){
    document.getElementById('locationPickerModal')?.classList.remove('show');
  },

  /* ---------- ম্যাপ + সার্চ বক্স রেন্ডার ---------- */
  render(){
    const body = document.getElementById('lpBody');
    body.innerHTML = `
      <div class="field" style="margin-bottom:10px">
        <input type="text" id="lpSearchInput" placeholder="এলাকা, রোড বা ল্যান্ডমার্কের নাম লিখুন..." style="width:100%">
      </div>
      <button class="btn btn-outline btn-block" style="margin-bottom:12px;font-size:12.5px" onclick="LocationPicker.tryUseCurrentLocation()">
        <span class="ic ic-pin" style="width:14px;height:14px"></span> বর্তমান লোকেশন ব্যবহার করুন
      </button>
      <div id="lpMapDiv" style="width:100%;height:280px;border-radius:14px;overflow:hidden;border:1px solid var(--line);margin-bottom:12px"></div>
      <div id="lpInfoBox" style="display:none;background:rgba(240,53,107,.05);border:1px solid var(--gold-line);border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="font-size:13px;color:var(--ink);margin-bottom:8px" id="lpAddressText"></div>
        <div id="lpZoneText" style="font-size:12.5px;margin-bottom:8px"></div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink-muted)">
          <span id="lpDistanceText"></span>
          <span id="lpEtaText"></span>
          <span id="lpFeeText" style="color:var(--rose);font-weight:700"></span>
        </div>
      </div>
      <button class="btn btn-gold btn-block" id="lpConfirmBtn" disabled onclick="LocationPicker.confirm()">এই লোকেশন কনফার্ম করুন</button>
    `;

    // ব্র্যান্ড থিমের সাথে মিলিয়ে সদর ব্রাঞ্চ থেকে শুরু (ডিফল্ট ভিউ)
    const center = { lat: BRANCH_INFO.noakhali_sadar.lat, lng: BRANCH_INFO.noakhali_sadar.lng };
    this.map = new google.maps.Map(document.getElementById('lpMapDiv'), {
      center, zoom: 13, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy',
      styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
    });
    this.geocoder = new google.maps.Geocoder();
    this.distanceService = new google.maps.DistanceMatrixService();

    this.marker = new google.maps.Marker({
      map: this.map, position: center, draggable: true,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#F0356B', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }
    });
    this.marker.addListener('dragend', () => {
      const pos = this.marker.getPosition();
      this.onPinMoved(pos.lat(), pos.lng());
    });
    this.map.addListener('click', (e) => {
      this.marker.setPosition(e.latLng);
      this.onPinMoved(e.latLng.lat(), e.latLng.lng());
    });

    // Places Autocomplete — লোকেশন সার্চ (বাংলাদেশে সীমাবদ্ধ)
    const input = document.getElementById('lpSearchInput');
    this.autocomplete = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'bd' },
      fields: ['geometry', 'formatted_address', 'name']
    });
    this.autocomplete.addListener('place_changed', () => {
      const place = this.autocomplete.getPlace();
      if(!place.geometry) return;
      const loc = place.geometry.location;
      this.map.panTo(loc);
      this.map.setZoom(16);
      this.marker.setPosition(loc);
      this.onPinMoved(loc.lat(), loc.lng(), place.formatted_address);
    });
  },

  /* ---------- বর্তমান লোকেশন (browser standard Geolocation — সব প্ল্যাটফর্মে কাজ করে) ---------- */
  tryUseCurrentLocation(){
    if(!navigator.geolocation){ toast('আপনার ব্রাউজারে লোকেশন সাপোর্ট নেই', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if(this.map){
          this.map.panTo({ lat: latitude, lng: longitude });
          this.map.setZoom(16);
          this.marker.setPosition({ lat: latitude, lng: longitude });
        }
        this.onPinMoved(latitude, longitude);
      },
      () => { /* পারমিশন না দিলে চুপচাপ থামা — জোর করার দরকার নেই */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  },

  /* ---------- পিন সরলে: reverse-geocode + দূরত্ব/ETA/চার্জ হিসাব ---------- */
  async onPinMoved(lat, lng, knownAddress){
    this.selected.lat = lat; this.selected.lng = lng;
    const infoBox = document.getElementById('lpInfoBox');
    const addrText = document.getElementById('lpAddressText');
    const confirmBtn = document.getElementById('lpConfirmBtn');
    infoBox.style.display = 'block';
    addrText.textContent = knownAddress || 'ঠিকানা খোঁজা হচ্ছে...';
    confirmBtn.disabled = true;

    if(!knownAddress){
      try{
        const result = await new Promise((resolve, reject)=>{
          this.geocoder.geocode({ location: { lat, lng } }, (results, status)=>{
            if(status === 'OK' && results[0]) resolve(results[0].formatted_address);
            else reject(status);
          });
        });
        this.selected.address = result;
        addrText.textContent = result;
      }catch(e){
        addrText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        this.selected.address = addrText.textContent;
      }
    } else {
      this.selected.address = knownAddress;
    }

    // নিকটতম শাখা বের করা (Haversine — geocoding লাগে না, তাই এটা সবসময় কাজ করে)
    const branches = Object.entries(BRANCH_INFO).map(([id, b]) => ({
      id, ...b, distanceKm: haversineKm(lat, lng, b.lat, b.lng)
    })).sort((a, b) => a.distanceKm - b.distanceKm);
    const nearest = branches[0];
    this.selected.branchZone = nearest.id;
    this.selected.distanceKm = nearest.distanceKm;

    document.getElementById('lpDistanceText').innerHTML = `📏 ${nearest.label} শাখা থেকে <strong>${nearest.distanceKm.toFixed(1)} কিমি</strong>`;

    // ── Zone সিস্টেম: কোন zone-এ পড়ছে বের করা, এর বাইরে হলে ব্লক ──
    const zone = findDeliveryZone(nearest.id, lat, lng);
    this.selected.zone = zone;
    const zoneBox = document.getElementById('lpZoneText');
    if(zoneBox){
      zoneBox.innerHTML = zone
        ? `🗺️ <strong style="color:var(--rose)">${zone.label}</strong>`
        : `<span style="color:#DC2626">⚠️ আমাদের ডেলিভারি জোনের বাইরে — অর্ডার করা যাবে না</span>`;
    }
    if(!zone){
      this.selected.deliveryFee = null;
      document.getElementById('lpFeeText').textContent = '';
      document.getElementById('lpEtaText').textContent = '';
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'জোনের বাইরে — কনফার্ম করা যাবে না';
      return; // zone-এর বাইরে হলে ETA/fee হিসাব করারও দরকার নেই
    }
    confirmBtn.textContent = 'এই লোকেশন কনফার্ম করুন';

    // ETA: Distance Matrix (রাস্তার ভিত্তিতে, ট্রাফিক-সচেতন) — ব্যর্থ হলে সরল distanceKm-ভিত্তিক আনুমানিক সময়ে fallback
    this.distanceService.getDistanceMatrix({
      origins: [{ lat: nearest.lat, lng: nearest.lng }],
      destinations: [{ lat, lng }],
      travelMode: 'DRIVING',
      drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' }
    }, (res, status)=>{
      let etaMin;
      if(status === 'OK' && res.rows[0]?.elements[0]?.status === 'OK'){
        etaMin = Math.round(res.rows[0].elements[0].duration.value / 60);
      } else {
        etaMin = Math.round(nearest.distanceKm * 3.5 + 10); // fallback আনুমানিক
      }
      this.selected.etaMin = etaMin;
      document.getElementById('lpEtaText').innerHTML = `⏱️ আনুমানিক <strong>${etaMin} মিনিট</strong>`;
      const itemCount = (typeof Cart !== 'undefined') ? Cart.totalCount() : 1;
      const subtotal = (typeof Cart !== 'undefined') ? Cart.totalPrice() : 0;
      // zone-ভিত্তিক ফ্ল্যাট ফি প্রাধান্য পায়; subtotal ফ্রি-ডেলিভারি থ্রেশহোল্ড ছাড়ালে zone fee-ও মাফ
      const fee = (subtotal >= DELIVERY_SETTINGS.freeAboveSubtotal) ? 0 : zone.fee;
      this.selected.deliveryFee = fee;
      document.getElementById('lpFeeText').textContent = fee === 0 ? '💰 ফ্রি ডেলিভারি' : `💰 ডেলিভারি চার্জ ৳${fee} (${zone.label})`;
      confirmBtn.disabled = false;
    });
  },

  confirm(){
    if(this.selected.lat === null) return;
    if(!this.selected.zone){ toast('⚠ এই লোকেশন ডেলিভারি জোনের বাইরে','error'); return; }
    if(typeof this.onConfirmCallback === 'function') this.onConfirmCallback({ ...this.selected });
    this.close();
  }
};

/* Haversine ফর্মুলা — দুই GPS পয়েন্টের মধ্যে সরলরেখা দূরত্ব (কিমি)।
   কোনো API কল লাগে না, তাই instant এবং offline-এও কাজ করে। */
function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ---------- ড্রাইভার নেভিগেশন — এক-ট্যাপে Google Maps ওপেন করে ---------- */
function openDriverNavigation(destLat, destLng, destLabel){
  if(!destLat || !destLng){ toast('গন্তব্যের লোকেশন পাওয়া যায়নি','error'); return; }
  // universal deep-link: mobile-এ Google Maps অ্যাপ খুলবে, না থাকলে ব্রাউজারে খুলবে — Android/iOS/Web সবখানে কাজ করে
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
  window.open(url, '_blank');
}
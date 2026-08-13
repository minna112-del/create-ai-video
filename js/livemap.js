/* livemap.js — Golapi Shop Online: এম্বেডেড লাইভ ম্যাপ, বাইক আইকন হেডিং অনুযায়ী ঘোরে */
const LiveMap = {
  instances: {}, /* orderId -> {map, marker, unsub, lastPos} */
  _leafletLoadPromise: null,

  /* Leaflet CSS/JS প্রথমবার দরকার হলেই লোড করা হয় (lazy) — প্রতিটা পেজে আগে থেকে
     লোড করে রাখলে সাধারণ browsing-এর গতি অকারণে কমে যেতো, যেহেতু বেশিরভাগ ভিজিটর
     কখনো লাইভ ট্র্যাকিং ম্যাপ খোলেই না। */
  _ensureLeaflet(){
    if(window.L) return Promise.resolve();
    if(this._leafletLoadPromise) return this._leafletLoadPromise;
    this._leafletLoadPromise = new Promise((resolve, reject)=>{
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(cssLink);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Leaflet লোড করা যায়নি'));
      document.head.appendChild(script);
    });
    return this._leafletLoadPromise;
  },

  bearing(lat1, lng1, lat2, lng2){
    const toRad = d => d * Math.PI/180;
    const toDeg = r => r * 180/Math.PI;
    const dLng = toRad(lng2-lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLng);
    return (toDeg(Math.atan2(y,x)) + 360) % 360;
  },

  bikeIcon(rotation=0){
    return L.divIcon({
      className: 'golapi-bike-marker',
      html: `<div style="transform:rotate(${rotation}deg);transition:transform .6s ease;font-size:26px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))">🛵</div>`,
      iconSize: [34,34], iconAnchor: [17,17]
    });
  },

  async init(orderId, containerId, lat, lng){
    try{ await this._ensureLeaflet(); }catch(e){ devWarn?.('Leaflet load failed', e.message); return; }
    const el = document.getElementById(containerId);
    if(!el) return;
    this.destroy(orderId);

    const map = L.map(containerId, { zoomControl:false, attributionControl:false }).setView([lat,lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

    /* ডার্ক গোল্ড-নেভি থিমের সাথে মেলাতে ম্যাপ টাইলে ডার্ক ফিল্টার */
    const paneEl = map.getPane('tilePane');
    if(paneEl) paneEl.style.filter = 'invert(92%) hue-rotate(180deg) brightness(0.92) contrast(1.05) saturate(0.7)';

    const marker = L.marker([lat,lng], { icon: this.bikeIcon(0) }).addTo(map);

    this.instances[orderId] = { map, marker, lastPos: {lat,lng} };

    if(window.__fb){
      const unsub = FB.onSnapshot(FB.doc(FB.db,'orders',orderId), snap=>{
        if(!snap.exists()) return;
        const d = snap.data();
        if(d.driverLat==null || d.driverLng==null) return;
        this.updatePosition(orderId, d.driverLat, d.driverLng);
      });
      this.instances[orderId].unsub = unsub;
    }

    setTimeout(()=>map.invalidateSize(), 200);
  },

  updatePosition(orderId, lat, lng){
    const inst = this.instances[orderId];
    if(!inst) return;
    const prev = inst.lastPos;
    const heading = (prev.lat!==lat || prev.lng!==lng) ? this.bearing(prev.lat, prev.lng, lat, lng) : (inst.lastHeading||0);
    inst.marker.setIcon(this.bikeIcon(heading));
    inst.marker.setLatLng([lat,lng]);
    inst.map.panTo([lat,lng], { animate:true });
    inst.lastPos = {lat,lng};
    inst.lastHeading = heading;
  },

  destroy(orderId){
    const inst = this.instances[orderId];
    if(!inst) return;
    if(inst.unsub) inst.unsub();
    if(inst.map) inst.map.remove();
    delete this.instances[orderId];
  },

  destroyAll(){
    Object.keys(this.instances).forEach(id=>this.destroy(id));
  }
};
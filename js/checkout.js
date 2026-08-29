/* checkout.js — Checkout page logic (lazy-loaded, শুধু checkout পেজে গেলে লোড হয়) */
const Checkout = {
  pay:'cod', currentStep:1, walletAvailable:0, couponCode:null, couponData:null, isPlacingOrder:false,
  locationData:null, // LocationPicker থেকে আসা {lat,lng,address,branchZone,distanceKm,etaMin,deliveryFee}
  async init(){
    const d=document.getElementById('ckDistrict'); if(d) d.value='';
    const z=document.getElementById('ckZone'); if(z) z.innerHTML=`<option value="">${currentLang==='bn'?'প্রথমে ডেলিভারি জোন বেছে নিন':'Select delivery zone first'}</option>`;
    const v=document.getElementById('ckVillage'); if(v) v.value='';
    this.locationData = null;
    const ls=document.getElementById('ckLocationSummary'); if(ls){ ls.hidden=true; ls.innerHTML=''; }
    this.walletAvailable = 0;
    this.pay = 'cod'; this.isPlacingOrder = false;
    document.querySelectorAll('#ckStep2 .radio-card').forEach((el,i)=>{ el.classList.toggle('selected',i===0); el.setAttribute('aria-checked',i===0?'true':'false'); const radio=el.querySelector('input'); if(radio) radio.checked=i===0; });
    const payInfo=document.getElementById('ckPayInfo'); if(payInfo){ payInfo.hidden=true; payInfo.innerHTML=''; delete payInfo.dataset.method; }
    this.setPlaceOrderLoading(false);
    this.couponCode = null; this.couponData = null;
    const cc=document.getElementById('ckCouponCode'); if(cc) cc.value='';
    const cm=document.getElementById('ckCouponMsg'); if(cm) cm.textContent='';
    const useWalletEl=document.getElementById('ckUseWallet'); if(useWalletEl) useWalletEl.checked=false;
    // কার্টে ঔষধ ক্যাটাগরির প্রোডাক্ট থাকলে প্রেসক্রিপশন-আপলোড বক্স দেখানো হয়
    const hasMedicine = Object.keys(Cart.items).some(id=>ALL_PRODUCTS.find(p=>p.id===id)?.category==='medicine');
    const presBox = document.getElementById('ckPrescriptionBox');
    if(presBox) presBox.hidden = !hasMedicine;
    const presFile = document.getElementById('ckPrescriptionFile'); if(presFile) presFile.value='';
    if(Auth.currentUser && FB){
      try{
        const snap = await FB.getDoc(FB.doc(FB.db,'users',Auth.currentUser.uid));
        if(snap.exists()) this.walletAvailable = Number(snap.data().walletBalance||0);
      }catch(e){ devWarn('wallet fetch failed', e.message); }
    }
    this.goStep(1);
  },
  openLocationPicker(){
    LocationPicker.open((data)=>{
      this.locationData = data;
      // ম্যাপ থেকে পাওয়া নিকটতম শাখা অনুযায়ী ডেলিভারি জোন ড্রপডাউন auto-select করে দেয়
      const d = document.getElementById('ckDistrict');
      if(d && data.branchZone){ d.value = data.branchZone; onDeliveryZoneChange('ck'); }
      const summary = document.getElementById('ckLocationSummary');
      if(summary){
        summary.hidden=false;
        summary.innerHTML = currentLang==='bn'
          ? `<strong style="color:var(--ink)">📍 ${esc(data.address)}</strong><br>${data.zone?data.zone.label+' · ':''}দূরত্ব: ${data.distanceKm.toFixed(1)} কিমি · ETA: ~${data.etaMin} মিনিট · ডেলিভারি চার্জ: ${data.deliveryFee===0?'ফ্রি':'৳'+data.deliveryFee}`
          : `<strong style="color:var(--ink)">📍 ${esc(data.address)}</strong><br>${data.zone?data.zone.label+' · ':''}Distance: ${data.distanceKm.toFixed(1)} km · ETA: ~${data.etaMin} min · Delivery Fee: ${data.deliveryFee===0?'Free':'৳'+data.deliveryFee}`;
      }
      this.renderSummary();
      toast(currentLang==='bn'?'✓ লোকেশন সেভ হয়েছে':'✓ Location saved','success');
    });
  },
  selectPay(el,method){
    el.parentElement.querySelectorAll('.radio-card').forEach(c=>{c.classList.remove('selected');c.querySelector('input').checked=false;});
    el.classList.add('selected'); el.querySelector('input').checked=true; el.parentElement.querySelectorAll('.radio-card').forEach(c=>c.setAttribute('aria-checked', c===el?'true':'false')); this.pay=method;
    this.selectPayByMethod(method);
  },
  selectPayByMethod(method){
    const box = document.getElementById('ckPayInfo');
    if(!box) return;
    box.dataset.method = method;
    const zone = document.getElementById('ckDistrict')?.value;
    const info = BRANCH_INFO[zone];
    if((method==='bkash'||method==='nagad') && info){
      const num = method==='bkash'?info.bkashNumber:info.nagadNumber;
      box.hidden=false;
      box.innerHTML = currentLang==='bn'
        ? `<div><strong>${method==='bkash'?'bKash':'Nagad'} পেমেন্ট নম্বর — ${info.label}</strong><br><b>${num}</b><br>অর্ডার নিশ্চিত করার পর Send Money নির্দেশনা ও ট্রানজেকশন ID জমা দেওয়ার অপশন দেখানো হবে।</div>`
        : `<div><strong>${method==='bkash'?'bKash':'Nagad'} Payment Number — ${info.label}</strong><br><b>${num}</b><br>After confirming the order, you'll get an option to submit the Send Money instructions and Transaction ID.</div>`;

    } else { box.hidden=true; box.innerHTML=''; }
  },
  goStep(n){
    if(n>1 && this.currentStep===1 && !this.isStep1Valid()){ toast(currentLang==='bn'?'ঠিকানা ও ডেলিভারি নির্দেশনা সঠিকভাবে পূরণ করুন':'Please fill in the address and delivery instructions correctly','error'); return; }
    if(n===2 && typeof dataLayer!=='undefined'){
      dataLayer.push({event:'begin_checkout', currency:'BDT', value: Cart.totalPrice()});
    }
    this.currentStep = n;
    [1,2,3].forEach(i=>{
      const step=document.getElementById('ckStep'+i);
      if(step) step.hidden = i!==n;
      const el = document.querySelector(`.step-item[data-s="${i}"]`);
      if(el){ el.classList.remove('active','done'); if(i<n) el.classList.add('done'); if(i===n) el.classList.add('active'); }
    });
    if(n===3) this.renderSummary();
  },
  isStep1Valid(){
    this.clearFieldErrors();
    const name = document.getElementById('ckName')?.value.trim()||'';
    const phone = document.getElementById('ckPhone')?.value.trim().replace(/[\s-]/g,'')||'';
    const addr = document.getElementById('ckAddress')?.value.trim()||'';
    const deliveryZone = document.getElementById('ckDistrict')?.value||'';
    const zone = document.getElementById('ckZone')?.value||'';
    const village = document.getElementById('ckVillage')?.value.trim()||'';
    const instructions = document.getElementById('ckInstructions')?.value.trim()||'';
    const nid = document.getElementById('ckNid')?.value.trim().replace(/\s/g,'')||'';
    const phoneRe = /^(?:\+880|880|0)1[3-9]\d{8}$/;
    const nidRe = /^\d{10}$|^\d{13}$/;
    const nidOk = nid.length===0 || nidRe.test(nid);
    const checks = [
      ['ckName', name.length>0, currentLang==='bn'?'নাম লিখুন':'Enter your name'],
      ['ckPhone', phoneRe.test(phone), currentLang==='bn'?'সঠিক মোবাইল নম্বর লিখুন':'Enter a valid mobile number'],
      ['ckDistrict', !!deliveryZone, currentLang==='bn'?'ডেলিভারি জোন বেছে নিন':'Select a delivery zone'],
      ['ckZone', !!zone, currentLang==='bn'?'এলাকা বেছে নিন':'Select an area'],
      ['ckVillage', village.length>0, currentLang==='bn'?'গ্রাম বা এলাকার নাম লিখুন':'Enter village or area'],
      ['ckAddress', addr.length>=5, currentLang==='bn'?'বাড়ি, রোড বা ল্যান্ডমার্ক একটু বিস্তারিত লিখুন':'Enter house, road, or landmark details'],
      ['ckInstructions', instructions.length>0, currentLang==='bn'?'ডেলিভারি নির্দেশনা লিখুন':'Enter delivery instructions'],
      ['ckNid', nidOk, currentLang==='bn'?'NID ১০ বা ১৩ সংখ্যার হতে হবে':'NID must be 10 or 13 digits']
    ];
    const failed = checks.find(([,ok])=>!ok);
    if(failed){ this.markFieldError(failed[0], failed[2]); return false; }
    if(!this.locationData){ this.markLocationError(currentLang==='bn'?'ম্যাপে সঠিক লোকেশন পিন করুন। এটা ছাড়া অর্ডার করা যাবে না।':'Pin your exact location on the map. Orders cannot be placed without it.'); return false; }
    if(!this.locationData.zone){
      this.markLocationError(currentLang==='bn'?'দুঃখিত, আপনার লোকেশন আমাদের ডেলিভারি জোনের বাইরে।':'Sorry, your location is outside our delivery zone.');
      return false;
    }
    return true;
  },
  clearFieldErrors(){
    document.querySelectorAll('.checkout-field-error').forEach(el=>el.remove());
    document.querySelectorAll('.checkout-card .is-invalid').forEach(el=>el.classList.remove('is-invalid'));
    document.querySelector('.checkout-location-btn')?.classList.remove('is-invalid');
  },
  markFieldError(id, message){
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.add('is-invalid');
    const field=el.closest('.field');
    if(field && !field.querySelector('.checkout-field-error')){
      const msg=document.createElement('p');
      msg.className='checkout-field-error';
      msg.textContent=message;
      field.appendChild(msg);
    }
    el.focus?.();
  },
  markLocationError(message){
    const btn=document.querySelector('.checkout-location-btn');
    btn?.classList.add('is-invalid');
    toast(message,'error');
    btn?.focus?.();
  },
  getWalletUsed(sub, ship){
    const useWallet = document.getElementById('ckUseWallet')?.checked;
    if(!useWallet || this.walletAvailable<=0) return 0;
    // ⚠️ আগে এখানে কুপন ছাড় বাদ দেওয়ার আগেই (sub+ship) থেকে wallet কেটে নেওয়া
    // হিসাব হতো — ফলে coupon+wallet একসাথে ব্যবহার করলে wallet থেকে কুপনের
    // ছাড়ের সমান অতিরিক্ত টাকা কেটে যেতো (customer-এর real financial loss)।
    // এখন আগে কুপন ছাড় বাদ দিয়ে, তারপর যেটুকু আসলে payable সেটুকুর জন্যই
    // wallet ব্যবহার হয়।
    const couponDiscount = this.getCouponDiscount(sub);
    const payable = Math.max(0, sub + ship - couponDiscount);
    return Math.min(this.walletAvailable, payable);
  },
  rejectCoupon(msgEl, message){
    this.couponCode=null;
    this.couponData=null;
    msgEl.textContent=message;
    msgEl.style.color='#f87171';
    this.renderSummary();
  },
  async applyCoupon(){
    const codeEl = document.getElementById('ckCouponCode');
    const msgEl = document.getElementById('ckCouponMsg');
    const code = (codeEl?.value||'').trim().toUpperCase();
    if(!code){ msgEl.textContent=''; return; }
    if(!FB){ msgEl.textContent=currentLang==='bn'?'সংযোগ সমস্যা':'Connection issue'; msgEl.style.color='#f87171'; return; }
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'coupons'), FB.where('code','==',code)));
      if(snap.empty){ this.rejectCoupon(msgEl,currentLang==='bn'?'❌ এই কুপন কোডটি সঠিক নয়':'❌ This coupon code is not valid'); return; }
      const c = { id:snap.docs[0].id, ...snap.docs[0].data() };
      if(c.active===false){ this.rejectCoupon(msgEl,currentLang==='bn'?'❌ এই কুপনটি বন্ধ আছে':'❌ This coupon is inactive'); return; }
      if(this.couponExpired(c.expiresAt)){ this.rejectCoupon(msgEl,currentLang==='bn'?'❌ কুপনের মেয়াদ শেষ হয়ে গেছে':'❌ This coupon has expired'); return; }
      if(c.usageLimit && (c.usedCount||0) >= c.usageLimit){ this.rejectCoupon(msgEl,currentLang==='bn'?'❌ কুপনের ব্যবহারসীমা শেষ':'❌ Coupon usage limit reached'); return; }
      const sub = Cart.totalPrice();
      if(c.minOrder && sub < c.minOrder){ this.rejectCoupon(msgEl,currentLang==='bn'?`❌ ন্যূনতম ${money(c.minOrder)} অর্ডারে এই কুপন কার্যকর`:`❌ This coupon applies to orders of ${money(c.minOrder)} or more`); return; }
      this.couponCode = code; this.couponData = c;
      msgEl.textContent = currentLang==='bn'?'✓ কুপন প্রয়োগ হয়েছে!':'✓ Coupon applied!'; msgEl.style.color='#22c55e';
      this.renderSummary();
    }catch(e){ this.rejectCoupon(msgEl,currentLang==='bn'?'সমস্যা হয়েছে':'Something went wrong'); }
  },
  getCouponDiscount(sub){
    return this.couponDiscountFor(this.couponData, sub);
  },
  couponDiscountFor(c, sub){
    if(!c) return 0;
    let disc = c.type==='percent' ? Math.round(sub * c.value/100) : c.value;
    if(c.maxDiscount) disc = Math.min(disc, c.maxDiscount);
    return Math.min(disc, sub);
  },
  couponExpired(value){
    if(!value) return false;
    const date = typeof value.toDate==='function' ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) && date < new Date();
  },
  renderSummary(){
    const entries = Object.entries(Cart.items);
    let itemCount = 0;
    const sumEl=document.getElementById('ckSummary');
    if(sumEl) sumEl.innerHTML = entries.map(([id,q])=>{
      const p = ALL_PRODUCTS.find(x=>x.id===id); if(!p) return '';
      itemCount += q;
      return `<div class="row-between"><span>${esc(p.name)} × ${bn(q)}</span><span>${money(p.salePrice*q)}</span></div>`;
    }).join('');
    const sub = Cart.totalPrice();
    const ship = (this.locationData?.deliveryFee != null) ? this.locationData.deliveryFee : calcDeliveryCharge(itemCount, sub, this.locationData?.distanceKm ?? null);
    const couponDiscount = this.getCouponDiscount(sub);
    const couponRow=document.getElementById('ckCouponRow');
    if(couponRow) couponRow.hidden = couponDiscount<=0;
    const couponLabelEl=document.getElementById('ckCouponLabel'); if(couponLabelEl) couponLabelEl.textContent = `কুপন (${this.couponCode||''}) ছাড়`;
    const couponDiscEl=document.getElementById('ckCouponDiscount'); if(couponDiscEl) couponDiscEl.textContent = '−'+money(couponDiscount);
    const walletBox=document.getElementById('ckWalletBox');
    if(walletBox) walletBox.hidden = this.walletAvailable<=0;
    const availEl=document.getElementById('ckWalletAvail'); if(availEl) availEl.textContent = money(this.walletAvailable);
    const walletUsed = this.getWalletUsed(sub, ship);
    const walletRow=document.getElementById('ckWalletRow');
    if(walletRow) walletRow.hidden = walletUsed<=0;
    const walletDiscEl=document.getElementById('ckWalletDiscount'); if(walletDiscEl) walletDiscEl.textContent = '−'+money(walletUsed);
    const subEl=document.getElementById('ckSub'); if(subEl) subEl.textContent = money(sub);
    const shipEl=document.getElementById('ckShip'); if(shipEl) shipEl.textContent = ship===0?'ফ্রি':money(ship);
    const totEl=document.getElementById('ckTotal'); if(totEl) totEl.textContent = money(Math.max(0, sub+ship-walletUsed-couponDiscount));
  },
  setPlaceOrderLoading(loading){
    this.isPlacingOrder = loading;
    const btn=document.getElementById('ckPlaceOrderBtn');
    if(!btn) return;
    btn.disabled=loading;
    btn.setAttribute('aria-busy', loading?'true':'false');
    const label=btn.querySelector('.ck-btn-label'); if(label) label.hidden=loading;
    const loader=btn.querySelector('.ck-btn-loader'); if(loader) loader.hidden=!loading;
  },
  validateCartForOrder(){
    const entries=Object.entries(Cart.items);
    if(!entries.length){ toast(currentLang==='bn'?'কার্টে কোনো পণ্য নেই':'Your cart is empty','error'); Router.go('home'); return false; }
    for(const [id,qty] of entries){
      const p=ALL_PRODUCTS.find(x=>x.id===id);
      if(!p){ toast(currentLang==='bn'?'কার্টের একটি পণ্য আর উপলভ্য নেই। কার্ট আপডেট করুন।':'One item in your cart is no longer available. Please update your cart.','error'); return false; }
      const stock=Number(p.stock||0);
      if(stock<=0 || Number(qty)>stock){ toast(currentLang==='bn'?`${p.name} পণ্যের পর্যাপ্ত স্টক নেই। কার্ট আপডেট করুন।`:`Not enough stock for ${p.name}. Please update your cart.`,'error'); return false; }
    }
    return true;
  },
  async placeOrder(){
    if(this.isPlacingOrder) return;
    if(!this.validateCartForOrder()) return;
    if(!this.locationData){ toast(currentLang==='bn'?'⚠ লোকেশন নির্বাচন করা হয়নি — "ম্যাপে সঠিক লোকেশন পিন করুন" বাটনে ট্যাপ করুন':'⚠ No location selected — tap "Pin Exact Location on Map"','error'); this.goStep(1); return; }
    if(!this.locationData.zone){ toast(currentLang==='bn'?'⚠ এই লোকেশন ডেলিভারি জোনের বাইরে':'⚠ This location is outside the delivery zone','error'); this.goStep(1); return; }
    const name=document.getElementById('ckName').value.trim();
    const phone=document.getElementById('ckPhone').value.trim();
    const addr=document.getElementById('ckAddress').value.trim();
    const deliveryZone=document.getElementById('ckDistrict').value;
    const zone=document.getElementById('ckZone').value;
    const village=document.getElementById('ckVillage').value.trim();
    const instructions=document.getElementById('ckInstructions').value.trim();
    const nid = document.getElementById('ckNid').value.trim().replace(/\s/g,'');
    const phoneRe = /^(?:\+880|880|0)1[3-9]\d{8}$/;
    const nidRe = /^\d{10}$|^\d{13}$/;
    const nidOk = nid.length===0 || nidRe.test(nid);
    if(!name||!phoneRe.test(phone.replace(/[\s-]/g,''))||!nidOk||addr.length<5||!deliveryZone||!zone||!village||!instructions){ toast(currentLang==='bn'?'⚠ সব প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন':'⚠ Please fill in all required information correctly','error'); this.goStep(1); return; }
    if(!document.getElementById('ckTerms').checked){ toast(currentLang==='bn'?'⚠ শর্তাবলীতে সম্মত হতে হবে':'⚠ You must agree to the Terms & Conditions','error'); return; }
    if(!FB){ toast(currentLang==='bn'?'⚠ সংযোগ সমস্যা — আবার চেষ্টা করুন':'⚠ Connection issue — please try again','error'); return; }
    this.setPlaceOrderLoading(true);
    const itemCount = Object.values(Cart.items).reduce((a,b)=>a+b,0);
    const wantsWallet = !!document.getElementById('ckUseWallet')?.checked && !!Auth.currentUser;
    // প্রেসক্রিপশন ছবি (থাকলে) আগে আপলোড করে নেওয়া হয়, যাতে অর্ডার ডকুমেন্টে সাথে সাথে URL যুক্ত করা যায়
    let prescriptionUrl = null;
    const presFile = document.getElementById('ckPrescriptionFile')?.files[0];
    if(presFile){
      try{
        const fileRef = FB.storageRef(FB.storage, `prescriptions/${Date.now()}_${presFile.name}`);
        await FB.uploadBytes(fileRef, presFile);
        prescriptionUrl = await FB.getDownloadURL(fileRef);
      }catch(e){ devWarn('prescription upload failed', e.message); }
    }
    const cartEntries = Object.entries(Cart.items);
    let committedOrder;
    try{
      // ⚠️ MT Studio audit fix: আগে এখানে order তৈরি ও দাম/শিপিং/কুপন/wallet
      // হিসাব — পুরোটাই client-run Firestore transaction-এ হতো। Transaction
      // লাইভ product ডেটা পড়ত ঠিকই, কিন্তু হিসাবটা ছিল client-side
      // JavaScript-এ, আর firestore.rules সেই total/paymentStatus কিছুই যাচাই
      // করত না — browser console থেকে সরাসরি Firestore SDK কল করে ভুয়া
      // total/paymentStatus দিয়ে অর্ডার তৈরি করা সংভব ছিল। এখন পুরো order
      // creation createOrderSecure Cloud Function-এ (Admin SDK দিয়ে) হয় —
      // client শুধু productId+qty ও ঠিকানা/পেয়মেন্ট-পদ্ধতি পাঠায়, দাম/ছাড়/
      // শিপিং/wallet সবকিছু server-side, live Firestore ডেটা থেকে
      // recalculate হয়। stock verify + decrement + order create এখনো একই
      // atomic transaction-এ (এখন server-side) হচ্ছে।
      const createOrder = FB.httpsCallable(FB.functions, 'createOrderSecure');
      const res = await createOrder({
        items: cartEntries.map(([id,qty])=>({productId:id, qty:Number(qty)})),
        customerName:name, customerPhone:phone, customerNid:nid, address:addr, village,
        branchZone:deliveryZone, district:AREA_LABELS[deliveryZone]||'', zone,
        customerLat: this.locationData?.lat ?? null, customerLng: this.locationData?.lng ?? null,
        deliveryZoneId: this.locationData?.zone?.id ?? null, deliveryZoneLabel: this.locationData?.zone?.label ?? null,
        distanceKm: this.locationData?.distanceKm ?? null, etaMinutes: this.locationData?.etaMin ?? null,
        prescriptionUrl,
        instructions, paymentMethod:this.pay,
        couponCode: this.couponCode || null,
        useWallet: wantsWallet
      });
      committedOrder = res.data;
    }catch(e){
      devWarn('order creation failed', e.message);
      this.setPlaceOrderLoading(false);
      toast('❌ ' + (e.message || (currentLang==='bn'?'অর্ডার সম্পন্ন হয়নি, আবার চেষ্টা করুন':'Order could not be placed, please try again')), 'error');
      return;
    }
    try{
      const {orderId,orderNumber:orderNo,subtotal:sub,shippingCost:ship,walletUsed,couponDiscount,total,guestAccessToken} = committedOrder;
      const appliedCouponCode = this.couponCode;
      if(this.couponData){
        this.couponCode=null; this.couponData=null;
      }
      if(typeof dataLayer!=='undefined'){
        dataLayer.push({event:'purchase',
          transaction_id: orderNo, currency:'BDT',
          value: total, shipping: ship,
          coupon: appliedCouponCode||undefined,
          items: Object.entries(Cart.items).map(([id,qty])=>{ const p=ALL_PRODUCTS.find(x=>x.id===id); return {item_id:id, item_name:p?.name||'', quantity:qty, price:p?.salePrice||0}; })
        });
      }
      OrderSuccess.save({
        orderId,
        orderNumber:orderNo,
        total,
        itemCount,
        paymentMethod:this.pay,
        deliveryArea:this.locationData?.zone?.label || AREA_LABELS[deliveryZone] || deliveryZone,
        guestAccessToken: guestAccessToken || null
      });
      Cart.items={}; Cart.save();
      if(this.pay==='bkash' || this.pay==='nagad'){
        // ⚠️ bug #1 fix: online payment modal-এর ঠিক আগে order-টা localStorage-এ
        // "pending payment" হিসেবে রেকর্ড করা হচ্ছে। কাস্টমার মাঝপথে ব্রাউজার
        // বন্ধ করে দিলে বা modal বাতিল করে অন্য পেজে চলে গেলেও, পরের বার সাইটে
        // ফিরলে PaymentGateway.checkPendingPayment() এই তথ্য দেখে recovery
        // banner দেখাবে — order হারিয়ে গেছে ভাবার সুযোগ থাকবে না।
        try{
          localStorage.setItem('golapi_pending_payment', JSON.stringify({
            orderId, method:this.pay, amount:total, zone, orderNo,
            guestAccessToken: guestAccessToken || null,
            at: Date.now()
          }));
        }catch(e){}
        PaymentGateway.showPaymentModal(this.pay, total, orderId, deliveryZone);
      } else {
        Router.go('order-success');
      }
    }catch(e){
      // The transaction has already committed at this point. Never tell the
      // customer to retry and accidentally create a duplicate order because a
      // local analytics/payment UI step failed afterwards.
      devWarn('post-order UI failed', e.message);
      this.setPlaceOrderLoading(false);
      Cart.items={}; Cart.save();
      toast(currentLang==='bn'?'✓ অর্ডার তৈরি হয়েছে। অর্ডার তালিকা থেকে অবস্থা দেখুন।':'✓ Your order was created. Check My Orders for its status.','success');
      Router.go('myorders');
    }
  }
};
window.Checkout=Checkout;

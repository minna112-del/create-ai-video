/* services.js — OrdersService, DriverManage, ReviewService, RefundService */
const OrdersService = {
  cache:[],
  _cachedAt:0,
  _inflight:null,
  // ⚠️ আগে এখানে গোটা 'orders' collection কোনো limit/date-range ছাড়াই fetch হতো,
  // আর Admin, Zone Manager ও Finance — তিনটা dashboard-ই আলাদাভাবে loadAll() কল
  // করত। ফলে অর্ডার সংখ্যা বাড়ার সাথে সাথে প্রতিটা dashboard open-এ পুরো collection
  // নামত, আর একই session-এ dashboard বদলালে একই ডেটা বারবার re-download হতো।
  // এখন query-তেই সর্বোচ্চ সাম্প্রতিক MAX_ORDERS সার্ভার-সাইড limit+sort করা হয়,
  // আর ৩০ সেকেন্ডের মধ্যে দ্বিতীয় কল এলে/ইতিমধ্যে একটা load চলমান থাকলে নতুন করে
  // network request না পাঠিয়ে একই cache/promise শেয়ার করা হয়।
  MAX_ORDERS: 500,
  CACHE_MS: 30000,
  async loadAll({force=false}={}){
    if(!FB) return [];
    const fresh = !force && this.cache.length && (Date.now()-this._cachedAt) < this.CACHE_MS;
    if(fresh) return this.cache;
    if(this._inflight) return this._inflight;
    this._inflight = (async()=>{
      try{
        const snap = await FB.getDocs(FB.query(
          FB.collection(FB.db,'orders'),
          FB.orderBy('createdAt','desc'),
          FB.limit(this.MAX_ORDERS)
        ));
        const orders=[]; snap.forEach(d=>orders.push({id:d.id,...d.data()}));
        this.cache=orders; this._cachedAt=Date.now();
        return orders;
      }catch(e){ devWarn(e.message); return []; }
      finally{ this._inflight=null; }
    })();
    return this._inflight;
  },
  async assignDriver(orderId, driverId, driverName) {
    if (!FB) return false;
    try {
      await FB.updateDoc(FB.doc(FB.db, 'orders', orderId), {
        driverId, driverName, status: 'assigned', assignedAt: FB.serverTimestamp()
      });
      const order = this.cache.find(o => o.id === orderId) || { id: orderId };
      const driver = await FB.getDoc(FB.doc(FB.db, 'drivers', driverId)).catch(() => null);
      const dPhone = driver?.data()?.phone || '';
      SMSGateway.onDriverAssigned(order, driverName, dPhone);
      return true;
    } catch (e) { toast('ড্রাইভার অ্যাসাইন ব্যর্থ: ' + e.message, 'error'); return false; }
  },
  async updateStatus(orderId, status) {
    if (!FB) return false;
    try {
      await FB.updateDoc(FB.doc(FB.db, 'orders', orderId), { status });
      const order = this.cache.find(o => o.id === orderId) || { id: orderId };
      if (status === 'delivered') {
        SMSGateway.onDelivered(order);
        this.giveReferralBonusIfEligible(order);
      }
      if (status === 'cancelled') SMSGateway.onCancelled(order);
      return true;
    } catch (e) { toast('স্ট্যাটাস আপডেট ব্যর্থ', 'error'); return false; }
  },
  async giveReferralBonusIfEligible(order){
    if(!FB || !order.userId) return;
    try{
      const userRef = FB.doc(FB.db,'users',order.userId);
      const userSnap = await FB.getDoc(userRef);
      if(!userSnap.exists()) return;
      const u = userSnap.data();
      if(!u.referredBy || u.referralBonusGiven) return;
      const BONUS = 20;
      await FB.updateDoc(userRef, { walletBalance: FB.increment(BONUS), referralBonusGiven: true });
      const referrerRef = FB.doc(FB.db,'users',u.referredBy);
      await FB.updateDoc(referrerRef, { walletBalance: FB.increment(BONUS) }).catch(()=>{});
      devWarn('referral bonus given', order.userId);
    }catch(e){ devWarn('referral bonus failed', e.message); }
  },
  async cancelOrder(orderId){
    if(!FB) return false;
    try{ await FB.updateDoc(FB.doc(FB.db,'orders',orderId),{status:'cancelled',cancelledAt:FB.serverTimestamp()}); return true; }
    catch(e){ toast('অর্ডার বাতিল ব্যর্থ','error'); return false; }
  }
};

const DriverManage = {
  drivers:[], presetZone:null,
  async loadDrivers(){
    if(!FB) return [];
    try{ const snap=await FB.getDocs(FB.collection(FB.db,'drivers')); const list=[]; snap.forEach(d=>list.push({id:d.id,...d.data()})); this.drivers=list; return list; }
    catch(e){ devWarn(e.message); return []; }
  },
  async renderTable(zoneFilter=null){
    await this.loadDrivers();
    const tbody = document.getElementById(zoneFilter?'zmDriverManageTable':'driverManageTable');
    if(!tbody) return;
    const list = zoneFilter? this.drivers.filter(d=>d.branchZone===zoneFilter) : this.drivers;
    if(!list.length){ tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;color:var(--ink-muted);padding:20px">এখনো কোনো ড্রাইভার নেই</td></tr>`; return; }
    tbody.innerHTML = list.map(d=> zoneFilter
      ? `<tr><td>${esc(d.name)}</td><td>${esc(d.phone)}</td><td><span class="status-pill delivered">সক্রিয়</span></td></tr>`
      : `<tr><td>${esc(d.name)}</td><td>${AREA_LABELS[d.branchZone]||'—'}</td><td>${esc(d.phone)}</td><td><span class="status-pill delivered">সক্রিয়</span></td></tr>`
    ).join('');
  },
  openAdd(presetZone=null){
    this.presetZone=presetZone;
    document.getElementById('dfName').value=''; document.getElementById('dfPhone').value='';
    const sel=document.getElementById('dfZone');
    if(presetZone){ sel.value=presetZone; sel.disabled=true; } else sel.disabled=false;
    document.getElementById('dfMsg').className='form-msg';
    document.getElementById('driverModal').classList.add('show');
  },
  close(){ document.getElementById('driverModal').classList.remove('show'); },
  async submit(){
    const name=document.getElementById('dfName').value.trim();
    const branchZone=document.getElementById('dfZone').value;
    const phone=document.getElementById('dfPhone').value.trim();
    const msgEl=document.getElementById('dfMsg');
    const phoneRe=/^(?:\+880|880|0)1[3-9]\d{8}$/;
    if(!name||!phoneRe.test(phone.replace(/[\s-]/g,''))){ msgEl.textContent='সব তথ্য সঠিকভাবে দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      await FB.addDoc(FB.collection(FB.db,'drivers'),{name,phone,branchZone,active:true,createdAt:FB.serverTimestamp()});
      msgEl.textContent='✓ ড্রাইভার যুক্ত হয়েছে — এখন Firebase Console-এ গিয়ে এই ড্রাইভারের জন্য একটা ইমেইল/পাসওয়ার্ড অ্যাকাউন্ট বানাও'; msgEl.className='form-msg ok';
      await this.renderTable(this.presetZone);
      if(ZoneManagerDash.currentZone) await ZoneManagerDash.render(); else AdminDash.render();
      setTimeout(()=>this.close(),1800);
    }catch(e){ msgEl.textContent='সমস্যা: '+e.message; msgEl.className='form-msg err'; }
  }
};

const ReviewService = {
  async loadReviews(productId){
    if(!FB) return [];
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'reviews'), FB.where('productId','==',productId)));
      const reviews=[]; snap.forEach(d=>reviews.push({id:d.id,...d.data()}));
      reviews.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      return reviews;
    }catch(e){ devWarn(e.message); return []; }
  },

  /* কাস্টমার এই প্রোডাক্টটা সত্যিই ডেলিভারি নিয়েছে কিনা চেক করে */
  async checkVerifiedPurchase(productId, userId){
    if(!FB || !userId) return null;
    try{
      const snap = await FB.getDocs(FB.query(
        FB.collection(FB.db,'orders'),
        FB.where('userId','==',userId),
        FB.where('status','==','delivered')
      ));
      let matchedOrderId = null;
      snap.forEach(d=>{
        const items = d.data().items || [];
        if(!matchedOrderId && items.some(it=>it.productId===productId)) matchedOrderId = d.id;
      });
      return matchedOrderId; // এখন orderId (বা null) রিটার্ন হয় — শুধু true/false না, কারণ Firestore rule-এ
                              // verified:true দাবি যাচাই করতে ঠিক কোন orderId-এর বিপরীতে সেটা লাগবে
    }catch(e){ devWarn('verified purchase check failed', e.message); return null; }
  },

  async submitReview(productId, rating, text, userName, photoFile){
    if(!FB){ toast('সংযোগ সমস্যা','error'); return false; }
    if(!rating || !text.trim()){ toast('রেটিং ও মন্তব্য দিন','error'); return false; }
    try{
      const userId = Auth.currentUser?.uid || null;
      const matchedOrderId = await this.checkVerifiedPurchase(productId, userId);
      const verified = !!matchedOrderId;
      let photoUrl = null;
      if(photoFile){
        const fileRef = FB.storageRef(FB.storage, `review_photos/${productId}_${Date.now()}_${photoFile.name}`);
        await FB.uploadBytes(fileRef, photoFile);
        photoUrl = await FB.getDownloadURL(fileRef);
      }
      const reviewDoc = {
        productId, rating:Number(rating), text:text.trim(), userName:userName||'গ্রাহক',
        userId, verified, photoUrl, createdAt:FB.serverTimestamp()
      };
      if(verified) reviewDoc.orderId = matchedOrderId; // rule এই orderId খুলে সত্যিই delivered+এই ইউজারের কিনা যাচাই করে
      await FB.addDoc(FB.collection(FB.db,'reviews'), reviewDoc);
      toast(verified ? '✓ যাচাইকৃত মতামত জমা হয়েছে' : '✓ মতামত জমা হয়েছে','success');
      return true;
    }catch(e){ toast('মতামত জমা ব্যর্থ: '+e.message,'error'); return false; }
  },

  async renderReviews(productId, containerId){
    const el = document.getElementById(containerId);
    if(!el) return;
    const reviews = await this.loadReviews(productId);
    if(!reviews.length){
      el.innerHTML = `<p style="color:var(--ink-muted);font-size:13px;text-align:center;padding:14px">এখনো কোনো মতামত নেই। আপনিই প্রথম মতামত দিন!</p>`;
      return;
    }
    reviews.sort((a,b)=>(b.verified===true)-(a.verified===true));
    el.innerHTML = reviews.map(r=>{
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5-r.rating);
      const date = r.createdAt?.seconds ? new Date(r.createdAt.seconds*1000).toLocaleDateString('bn-BD') : '';
      return `<div style="padding:12px 0;border-bottom:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <strong style="font-size:13px;color:var(--ink)">${esc(r.userName)||'গ্রাহক'} ${r.verified?'<span style="font-size:10.5px;color:#22c55e;font-weight:600;background:rgba(34,197,94,.1);padding:2px 7px;border-radius:8px;margin-left:6px">✓ যাচাইকৃত ক্রয়</span>':''}</strong>
          <span style="color:var(--gold);font-size:13px">${stars}</span>
        </div>
        <p style="font-size:12.5px;color:var(--ink-soft);line-height:1.6">${esc(r.text)}</p>
        <!-- MT Studio audit fix: photoUrl আগে esc() ছাড়াই raw HTML attribute-এ বসতো (stored XSS
             ভেক্টর, rules-level fix-এর পরও defense-in-depth) — এখন domain whitelist + esc() দুটোই -->
        ${(typeof r.photoUrl==='string' && /^https:\/\/firebasestorage\.googleapis\.com\//.test(r.photoUrl))?`<img src="${esc(r.photoUrl)}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;margin-top:8px;border:1px solid var(--line);cursor:pointer" onclick="window.open('${esc(r.photoUrl)}','_blank')">`:''}
        <span style="font-size:10.5px;color:var(--ink-dim);display:block;margin-top:6px">${date}</span>
      </div>`;
    }).join('');
  }
};

const RefundService = {
  async requestRefund(orderId, reason){
    if(!FB){ toast('সংযোগ সমস্যা','error'); return false; }
    if(!reason.trim()){ toast('রিফান্ডের কারণ লিখুন','error'); return false; }
    try{
      await FB.updateDoc(FB.doc(FB.db,'orders',orderId),{refundRequested:true, refundReason:reason.trim(), refundStatus:'pending', refundRequestedAt:FB.serverTimestamp()});
      toast('✓ রিফান্ড রিকোয়েস্ট সাবমিট হয়েছে','success');
      return true;
    }catch(e){ toast('রিকোয়েস্ট ব্যর্থ: '+e.message,'error'); return false; }
  },
  async approveRefund(orderId, status){
    if(!FB) return false;
    try{ await FB.updateDoc(FB.doc(FB.db,'orders',orderId),{refundStatus:status, refundProcessedAt:FB.serverTimestamp()}); toast(`✓ রিফান্ড ${status==='approved'?'অনুমোদিত':'বাতিল'} হয়েছে`,'success'); return true; }
    catch(e){ toast('আপডেট ব্যর্থ','error'); return false; }
  }
};
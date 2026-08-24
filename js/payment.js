/* payment.js — bKash/Nagad Payment Gateway Integration (Zone-aware) */
const PaymentGateway = {

  /* জোন অনুযায়ী merchant নম্বর — একক সোর্স utils.js এর BRANCH_INFO */
  getMerchantNumber(method, zone) {
    const info = (typeof BRANCH_INFO !== 'undefined') ? BRANCH_INFO[zone] : null;
    if (!info) return null;
    return method === 'bkash' ? info.bkashNumber : info.nagadNumber;
  },

  accountType: 'personal', // দুই জোনের নম্বরই personal অ্যাকাউন্ট

  /* Generate payment instructions for customer */
  generateBkashInstructions(amount, orderId, zone) {
    const number = this.getMerchantNumber('bkash', zone) || 'শাখা নির্বাচন করুন';
    return {
      number,
      amount: amount,
      reference: orderId.substring(0, 8).toUpperCase(),
      instructions: [
        `*247# ডায়াল করুন অথবা bKash App খুলুন`,
        `Send Money নির্বাচন করুন`,
        `নম্বর: ${number}`,
        `টাকা: ${amount}৳`,
        `রেফারেন্স: ${orderId.substring(0,8).toUpperCase()}`,
        `PIN দিয়ে নিশ্চিত করুন`,
        `ট্রানজেকশন ID কপি করে নিচে পেস্ট করুন`
      ]
    };
  },

  generateNagadInstructions(amount, orderId, zone) {
    const number = this.getMerchantNumber('nagad', zone) || 'শাখা নির্বাচন করুন';
    return {
      number,
      amount: amount,
      reference: orderId.substring(0, 8).toUpperCase(),
      instructions: [
        `Nagad App খুলুন`,
        `Send Money নির্বাচন করুন`,
        `নম্বর: ${number}`,
        `টাকা: ${amount}৳`,
        `রেফারেন্স: ${orderId.substring(0,8).toUpperCase()}`,
        `PIN দিয়ে নিশ্চিত করুন`,
        `ট্রানজেকশন ID কপি করে নিচে পেস্ট করুন`
      ]
    };
  },

  /* Verify payment transaction ID format */
  validateTrxId(trxId, method) {
    if (!trxId || trxId.trim().length < 8) return false;
    if (method === 'bkash') return /^[A-Z0-9]{8,}$/.test(trxId.trim().toUpperCase());
    if (method === 'nagad') return /^[A-Z0-9]{8,}$/.test(trxId.trim().toUpperCase());
    return true;
  },

  /* Show payment modal with instructions */
  showPaymentModal(method, amount, orderId, zone) {
    const isBkash = method === 'bkash';
    const info = isBkash
      ? this.generateBkashInstructions(amount, orderId, zone)
      : this.generateNagadInstructions(amount, orderId, zone);
    const logo = isBkash ? '📱 bKash' : '📱 Nagad';
    const color = isBkash ? '#E2136E' : '#EC1C24';

    const existing = document.getElementById('paymentModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'paymentModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
      <div style="background:#0d1117;border:1px solid ${color}33;border-radius:18px;max-width:400px;width:100%;overflow:hidden">
        <div style="background:${color};padding:16px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:#fff">${logo}</div>
          <div style="font-size:28px;font-weight:800;color:#fff;margin-top:4px">${money(amount)}৳</div>
        </div>
        <div style="padding:16px">
          <div style="background:rgba(${isBkash?'226,19,110':'236,28,36'},0.08);border:1px solid ${color}33;border-radius:12px;padding:12px;margin-bottom:14px;text-align:center">
            <div style="font-size:11px;color:var(--ink-muted);margin-bottom:4px">পেমেন্ট নম্বর</div>
            <div style="font-size:22px;font-weight:700;color:${color};letter-spacing:1px;font-family:Poppins">${info.number}</div>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:4px">রেফারেন্স: ${info.reference}</div>
          </div>
          <div style="margin-bottom:14px">
            <div style="font-size:13px;color:#fff;margin-bottom:8px;font-weight:600">📋 নিয়মাবলী:</div>
            ${info.instructions.map((s,i) => `<div style="font-size:12px;color:var(--ink-muted);margin-bottom:4px;display:flex;gap:6px"><span style="color:${color};font-weight:700">${i+1}.</span><span>${s}</span></div>`).join('')}
          </div>
          <div style="margin-bottom:14px">
            <label style="font-size:12px;color:#fff;display:block;margin-bottom:6px">ট্রানজেকশন ID লিখুন *</label>
            <input id="trxIdInput" type="text" placeholder="যেমন: 8N7K4M2X" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--line);border-radius:10px;color:#fff;font-size:15px;font-family:Poppins" oninput="this.value=this.value.toUpperCase()">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline" style="flex:1" onclick="PaymentGateway.showCancelOptions('${orderId}','${method}',${amount},'${zone}')">বাতিল</button>
            <button class="btn" style="flex:1;background:${color};border:none;color:#fff" onclick="PaymentGateway.confirmPayment('${method}', '${orderId}', ${amount})">হয়ে গেছে ✅</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  /* ⚠️ bug #1 fix: আগে "বাতিল" বাটনে চাপলে সরাসরি modal সরিয়ে দেওয়া হতো —
     Firestore-এ order pending_submission অবস্থায় থেকেই যেতো, cart ইতিমধ্যে
     খালি হয়ে গেছে, customer-এর কাছে মনে হতো order হারিয়ে গেছে। এখন "বাতিল"
     চাপলে বাস্তব বিকল্প দেখানো হয়, কোনো অবস্থাতেই চুপচাপ orphan order রেখে
     modal বন্ধ হয়ে যায় না। */
  showCancelOptions(orderId, method, amount, zone){
    const overlay = document.getElementById('paymentModalOverlay');
    if(!overlay) return;
    const box = overlay.querySelector('div');
    if(!box) return;
    box.innerHTML = `
      <div style="padding:20px">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:6px">পেমেন্ট বাতিল করবেন?</div>
        <p style="font-size:12.5px;color:var(--ink-muted);margin-bottom:16px">আপনার অর্ডারটি এখনো সংরক্ষিত আছে — হারিয়ে যায়নি। নিচের একটি অপশন বেছে নিন।</p>
        <div style="display:grid;gap:8px">
          <button class="btn btn-outline btn-block" onclick="PaymentGateway.reopenModal('${method}',${amount},'${orderId}','${zone}')">↩ পেমেন্ট মোডালে ফিরে যান</button>
          <button class="btn btn-outline btn-block" onclick="PaymentGateway.payLater('${orderId}')">⏳ পরে পেমেন্ট করুন</button>
          <button class="btn btn-outline btn-block" onclick="PaymentGateway.switchToCOD('${orderId}')">💵 Cash on Delivery-তে পরিবর্তন করুন</button>
          <button class="btn btn-block" style="background:#dc2626;border:none;color:#fff" onclick="PaymentGateway.cancelOrder('${orderId}')">✕ অর্ডার সম্পূর্ণ বাতিল করুন</button>
        </div>
      </div>
    `;
  },

  reopenModal(method, amount, orderId, zone){
    this.showPaymentModal(method, amount, orderId, zone);
  },

  /* অর্ডার pending_submission অবস্থায় থেকে যাবে — কাস্টমার My Orders থেকে
     পরে গিয়ে আবার পেমেন্ট সাবমিট করতে পারবেন। localStorage marker থেকে যাওয়ায়
     পরের ভিজিটে recovery banner-ও দেখাবে। */
  payLater(orderId){
    this.closeModal();
    toast('অর্ডার সংরক্ষিত আছে — "আমার অর্ডার" থেকে পরে পেমেন্ট সম্পন্ন করতে পারবেন', 'info');
    Router.go('order-success');
  },

  async switchToCOD(orderId){
    if(!FB) return;
    try{
      const updatePayment = FB.httpsCallable(FB.functions, 'updateOrderPaymentSecure');
      await updatePayment({
        orderId,
        action: 'cod',
        guestAccessToken: this.getGuestAccessToken(orderId)
      });
      try{ localStorage.removeItem('golapi_pending_payment'); }catch(e){}
      this.closeModal();
      toast('✓ Cash on Delivery-তে পরিবর্তন হয়েছে — ডেলিভারির সময় মূল্য পরিশোধ করুন', 'success');
      Router.go('order-success');
    }catch(e){
      toast('পরিবর্তন ব্যর্থ: ' + e.message, 'error');
    }
  },

  getGuestAccessToken(orderId){
    try{
      const pending = JSON.parse(localStorage.getItem('golapi_pending_payment') || '{}');
      if(pending && pending.orderId === orderId && pending.guestAccessToken) return pending.guestAccessToken;
    }catch(e){}
    try{
      const success = JSON.parse(sessionStorage.getItem('golapiLastOrderConfirmation') || '{}');
      if(success && success.orderId === orderId && success.guestAccessToken) return success.guestAccessToken;
    }catch(e){}
    return null;
  },

  async cancelOrder(orderId){
    if(!FB) return;
    try{
      const snap = await FB.getDoc(FB.doc(FB.db,'orders',orderId));
      if(!snap.exists()){ this.closeModal(); Router.go('home'); return; }
      const order = snap.data();

      // ⚠️ আগে এখানে wallet refund, coupon usedCount কমানো এবং stock ফেরত —
      // এই তিনটাই client থেকে সরাসরি Firestore-এ লেখার চেষ্টা হতো। কিন্তু
      // security rules নিজের walletBalance client-side বদলাতে দেয় না (শুধু
      // staff/backend পারে) — তাই wallet refund .catch(()=>{}) দিয়ে চুপচাপ fail
      // হয়ে যেত, কাস্টমার "বাতিল হয়েছে" দেখতো কিন্তু টাকা ফেরত পেতো না।
      // এখন পুরো refund (wallet + coupon + stock + status) একটাই server-side
      // Cloud Function transaction-এ atomic ভাবে হয় — এখানে fail হলে সত্যিকারের
      // error দেখানো হয়, চুপচাপ গেলা হয় না।
      const cancel = FB.httpsCallable(FB.functions, 'cancelOrderSecure');
      await cancel({ orderId });

      if(Array.isArray(order.items)){
        order.items.forEach(it=>{ Cart.items[it.productId] = (Cart.items[it.productId]||0) + it.qty; });
        Cart.save();
      }

      try{ localStorage.removeItem('golapi_pending_payment'); }catch(e){}
      this.closeModal();
      toast('✓ অর্ডার বাতিল হয়েছে, পণ্য আবার কার্টে ফিরিয়ে দেওয়া হয়েছে', 'success');
      Router.go('home');
      setTimeout(() => Cart.open(), 0);
    }catch(e){
      toast('বাতিল ব্যর্থ: ' + (e.message || 'আবার চেষ্টা করুন'), 'error');
    }
  },

  closeModal() {
    const el = document.getElementById('paymentModalOverlay');
    if (el) el.remove();
  },

  async confirmPayment(method, orderId, amount) {
    const trxId = document.getElementById('trxIdInput')?.value.trim() || '';
    if (!this.validateTrxId(trxId, method)) {
      toast('সঠিক ট্রানজেকশন ID লিখুন', 'error');
      return;
    }
    if (FB) {
      try {
        const updatePayment = FB.httpsCallable(FB.functions, 'updateOrderPaymentSecure');
        await updatePayment({
          orderId,
          action: 'submit',
          method,
          trxId,
          guestAccessToken: this.getGuestAccessToken(orderId)
        });
        try{ localStorage.removeItem('golapi_pending_payment'); }catch(e){}
        this.closeModal();
        toast('✓ পেমেন্ট তথ্য পাঠানো হয়েছে! মিলিয়ে দেখার পর অর্ডার নিশ্চিত হবে', 'success');
        setTimeout(() => Router.go('order-success'), 1500);
      } catch (e) {
        toast('সাবমিট ব্যর্থ: ' + e.message, 'error');
      }
    }
  }
};

/* auth.js — Firebase Auth + login/register modal + Account page + Order editing + Wishlist page + Refund */
const Auth = {
  currentUser:null,
  init(){
    FB.onAuthStateChanged(FB.auth, user=>{
      this.currentUser = user;
      const accountButton = document.getElementById('loginBtn');
      if(accountButton) accountButton.setAttribute('aria-label', user ? I18n.t('আমার অ্যাকাউন্ট খুলুন','Open my account') : I18n.t('লগইন বা অ্যাকাউন্ট খুলুন','Sign in or open account'));
    });
  }
};
const AuthUI = {
  open(){
    document.getElementById('authModal').classList.add('show');
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const refInput = document.getElementById('regReferralCode');
    if(ref && refInput) refInput.value = ref.toUpperCase();
  },
  close(){ document.getElementById('authModal').classList.remove('show'); this.clearMsg(); },
  switchTab(tab){
    ['phone','login','register'].forEach(t=>{
      const btn = document.getElementById('tab'+t.charAt(0).toUpperCase()+t.slice(1));
      if(btn){ btn.style.color = t===tab?'var(--gold)':'var(--ink-muted)'; btn.style.borderColor = t===tab?'var(--gold)':'transparent'; }
    });
    document.getElementById('phoneForm').style.display = tab==='phone'?'block':'none';
    document.getElementById('loginForm').style.display = tab==='login'?'block':'none';
    document.getElementById('registerForm').style.display = tab==='register'?'block':'none';
    this.clearMsg();
  },
  showMsg(msg,type){ const el=document.getElementById('authMsg'); el.textContent=msg; el.className='form-msg '+type; },
  clearMsg(){ document.getElementById('authMsg').className='form-msg'; },
  async login(){
    const email=document.getElementById('loginEmail').value.trim();
    const pass=document.getElementById('loginPass').value;
    if(!email||!pass){ this.showMsg('ইমেইল ও পাসওয়ার্ড দিন','err'); return; }
    // ⚠️ আগে FB রেডি না থাকলে সাথে সাথেই "সংযোগ সমস্যা" দেখিয়ে দিতো — পেজ খুলেই তাড়াতাড়ি
    // লগইন করলে এটা ঘটতো, যদিও Firebase আসলে ১-২ সেকেন্ডের মধ্যেই রেডি হয়ে যেতো।
    // এখন সাথে সাথে ব্যর্থ না হয়ে, সংক্ষিপ্ত সময় অপেক্ষা করে আবার চেষ্টা করে।
    if(!FB){
      this.showMsg('সংযোগ স্থাপন হচ্ছে, একটু অপেক্ষা করুন...','info');
      for(let i=0; i<10 && !FB; i++){ await new Promise(r=>setTimeout(r,300)); }
      if(!FB){ this.showMsg('সংযোগ সমস্যা — ইন্টারনেট চেক করে আবার চেষ্টা করুন','err'); return; }
    }
    try{ await FB.signInWithEmailAndPassword(FB.auth,email,pass); this.showMsg('✓ লগইন সফল','ok'); setTimeout(()=>this.close(),700); }
    catch(e){ this.showMsg('লগইন ব্যর্থ: '+e.message,'err'); }
  },
  async register(){
    const name=document.getElementById('regName').value.trim();
    const email=document.getElementById('regEmail').value.trim();
    const phone=document.getElementById('regPhone').value.trim();
    const pass=document.getElementById('regPass').value;
    const referralCodeInput = (document.getElementById('regReferralCode')?.value||'').trim().toUpperCase();
    if(!name||!email||!phone||!pass){ this.showMsg('সব তথ্য পূরণ করুন','err'); return; }
    const phoneRe=/^(?:\+880|880|0)1[3-9]\d{8}$/;
    if(!phoneRe.test(phone.replace(/[\s-]/g,''))){ this.showMsg('সঠিক মোবাইল নম্বর দিন','err'); return; }
    if(!FB){ this.showMsg('সংযোগ সমস্যা','err'); return; }
    try{
      const cred = await FB.createUserWithEmailAndPassword(FB.auth,email,pass);
      await FB.updateProfile(cred.user,{displayName:name});
      const myReferralCode = cred.user.uid.slice(0,6).toUpperCase();

      let referredBy = null;
      if(referralCodeInput){
        try{
          const q = FB.query(FB.collection(FB.db,'users'), FB.where('referralCode','==',referralCodeInput), FB.limit(1));
          const snap = await FB.getDocs(q);
          if(!snap.empty){ referredBy = snap.docs[0].id; }
        }catch(e){ devWarn('referral lookup failed', e.message); }
      }

      await FB.setDoc(FB.doc(FB.db,'users',cred.user.uid),{
        name, email, phone, role:'customer', createdAt:FB.serverTimestamp(),
        referralCode: myReferralCode, referredBy, referralBonusGiven:false, walletBalance:0
      });
      if(typeof dataLayer!=='undefined') dataLayer.push({event:'sign_up', method:'email'});
      this.showMsg('✓ রেজিস্ট্রেশন সফল','ok'); setTimeout(()=>this.close(),700);
    }catch(e){ this.showMsg('রেজিস্ট্রেশন ব্যর্থ: '+e.message,'err'); }
  }
};

/* ---------- Account / Profile page ---------- */
const AccountPage = {
  profileData:null,
  openOrLogin(){ Auth.currentUser ? Router.go('account') : AuthUI.open(); },
  async render(){
    const u = Auth.currentUser;
    const guest = document.getElementById('accountGuestState');
    const member = document.getElementById('accountMemberContent');
    const actions = document.getElementById('accountHeroActions');
    const editor = document.getElementById('accountEditor');

    if(!u){
      this.profileData = null;
      if(guest) guest.hidden = false;
      if(member) member.hidden = true;
      if(actions) actions.hidden = true;
      if(editor) editor.hidden = true;
      this.setIdentity('অতিথি','','');
      return;
    }

    if(guest) guest.hidden = true;
    if(member) member.hidden = false;
    if(actions) actions.hidden = false;

    let data = {name:u.displayName||'কাস্টমার', email:u.email||'', phone:u.phoneNumber||''};
    if(FB){
      try{
        const snap = await FB.getDoc(FB.doc(FB.db,'users',u.uid));
        if(snap.exists()) data = {...data,...snap.data()};
      }catch(e){ devWarn('profile load failed', e.message); }
    }
    this.profileData = data;
    this.setIdentity(data.name||u.displayName||'কাস্টমার', data.email||u.email||'', data.phone||u.phoneNumber||'');
    this.fillEditor();
    this.renderLoyalty(data);
  },
  setIdentity(name,email,phone){
    const safeName = String(name||'কাস্টমার').trim()||'কাস্টমার';
    const nameEl=document.getElementById('accName'); if(nameEl) nameEl.textContent=safeName;
    const emailEl=document.getElementById('accEmail'); if(emailEl) emailEl.textContent=email||'';
    const phoneEl=document.getElementById('accPhone'); if(phoneEl) phoneEl.textContent=phone||'';
    const avatarEl=document.getElementById('accAvatar');
    if(avatarEl) avatarEl.textContent = safeName==='অতিথি' ? '👤' : safeName.charAt(0).toUpperCase();
  },
  fillEditor(){
    const u=Auth.currentUser, d=this.profileData||{};
    const name=document.getElementById('profileName'); if(name) name.value=d.name||u?.displayName||'';
    const phone=document.getElementById('profilePhone'); if(phone) phone.value=d.phone||u?.phoneNumber||'';
    const email=document.getElementById('profileEmail'); if(email) email.value=d.email||u?.email||'';
  },
  toggleEditor(show){
    if(!Auth.currentUser){ AuthUI.open(); return; }
    const editor=document.getElementById('accountEditor');
    if(!editor) return;
    editor.hidden=!show;
    if(show){
      this.fillEditor();
      const msg=document.getElementById('profileMsg'); if(msg){ msg.textContent=''; msg.className='form-msg'; }
      requestAnimationFrame(()=>{ editor.scrollIntoView({behavior:'smooth',block:'start'}); document.getElementById('profileName')?.focus(); });
    }
  },
  async saveProfile(){
    const u=Auth.currentUser, msg=document.getElementById('profileMsg'), btn=document.getElementById('profileSaveBtn');
    if(!u || !FB){ if(msg){ msg.textContent='সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।'; msg.className='form-msg err'; } return; }
    const name=(document.getElementById('profileName')?.value||'').trim();
    const phone=(document.getElementById('profilePhone')?.value||'').trim().replace(/[\s-]/g,'');
    const phoneRe=/^(?:\+880|880|0)1[3-9]\d{8}$/;
    if(name.length<2){ msg.textContent='কমপক্ষে ২ অক্ষরের নাম দিন।'; msg.className='form-msg err'; return; }
    if(phone && !phoneRe.test(phone)){ msg.textContent='সঠিক বাংলাদেশি মোবাইল নম্বর দিন।'; msg.className='form-msg err'; return; }
    if(btn){ btn.disabled=true; btn.textContent='সংরক্ষণ হচ্ছে…'; }
    try{
      if(u.displayName!==name) await FB.updateProfile(u,{displayName:name});
      await FB.setDoc(FB.doc(FB.db,'users',u.uid),{name,phone,email:u.email||this.profileData?.email||'',updatedAt:FB.serverTimestamp()},{merge:true});
      this.profileData={...(this.profileData||{}),name,phone,email:u.email||''};
      this.setIdentity(name,u.email||'',phone);
      msg.textContent='✓ প্রোফাইল সফলভাবে আপডেট হয়েছে।'; msg.className='form-msg ok';
      toast('✓ প্রোফাইল আপডেট হয়েছে','success');
      setTimeout(()=>this.toggleEditor(false),700);
    }catch(e){ msg.textContent='প্রোফাইল সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।'; msg.className='form-msg err'; devWarn('profile save failed',e.message); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='পরিবর্তন সংরক্ষণ'; } }
  },
  async renderLoyalty(prefetched){
    const box=document.getElementById('loyaltyBox');
    if(!box) return;
    if(!Auth.currentUser || !FB){ box.style.display='none'; return; }
    try{
      let data=prefetched;
      if(!data){ const snap=await FB.getDoc(FB.doc(FB.db,'users',Auth.currentUser.uid)); data=snap.exists()?snap.data():null; }
      if(!data){ box.style.display='none'; return; }
      box.style.display='block';
      const codeEl=document.getElementById('loyaltyCode'); if(codeEl) codeEl.textContent=data.referralCode||'—';
      const balEl=document.getElementById('loyaltyBalance'); if(balEl) balEl.textContent=money(Number(data.walletBalance)||0);
    }catch(e){ box.style.display='none'; }
  },
  shareReferral(){
    const code=document.getElementById('loyaltyCode')?.textContent||'';
    if(!code || code==='—') return;
    const link=`https://www.golapishop.online/?ref=${encodeURIComponent(code)}`;
    const text=`Golapi Shop Online-এ রেজিস্ট্রেশনের সময় আমার রেফারেল কোড ব্যবহার করুন: ${code}`;
    if(navigator.share){ navigator.share({title:'Golapi Shop Online',text,url:link}).catch(()=>{}); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(link).then(()=>toast('✓ রেফারেল লিংক কপি হয়েছে','success')).catch(()=>toast('লিংক কপি করা যায়নি','error')); }
  },
  requestNotifications(){
    if(!('Notification' in window)){ toast('এই ব্রাউজারে নোটিফিকেশন সাপোর্ট নেই','error'); return; }
    Notification.requestPermission().then(p=>toast(p==='granted'?'✓ নোটিফিকেশন চালু হয়েছে':'নোটিফিকেশনের অনুমতি দেওয়া হয়নি',p==='granted'?'success':'error'));
  },
  async signOut(){
    if(!FB) return;
    try{ await FB.signOut(FB.auth); this.profileData=null; toast('✓ লগআউট হয়েছে','success'); Router.go('home'); }
    catch(e){ toast('লগআউট ব্যর্থ','error'); }
  },
  async renderAddresses(){
    const list=document.getElementById('addressList');
    if(!list) return;
    if(!Auth.currentUser){ list.innerHTML=`<div class="empty-state"><div class="em">🔒</div><h3>লগইন করুন</h3><button class="btn btn-gold" onclick="AuthUI.open()">লগইন করুন</button></div>`; return; }
    if(!FB){ list.innerHTML=`<p style="color:var(--ink-muted)">সংযোগ সমস্যা</p>`; return; }
    list.innerHTML=`<p style="color:var(--ink-muted);padding:10px 0">লোড হচ্ছে...</p>`;
    try{
      const snap=await FB.getDoc(FB.doc(FB.db,'users',Auth.currentUser.uid));
      const addrs=snap.exists()?(snap.data().addresses||[]):[];
      if(!addrs.length){ list.innerHTML=`<div class="empty-state"><div class="em">📍</div><h3>কোনো ঠিকানা সংরক্ষিত নেই</h3></div>`; return; }
      list.innerHTML=addrs.map((a,i)=>`<div class="card-box"><div style="display:flex;justify-content:space-between"><strong style="color:var(--ink)">${esc(a.label||'ঠিকানা')}</strong><button onclick="AccountPage.deleteAddress(${i})" style="color:var(--danger,#dc2626);font-size:12px">মুছুন</button></div><div style="font-size:12.5px;color:var(--ink-muted);margin-top:4px">${esc(a.village?a.village+', ':'')}${esc(AREA_LABELS[a.district]||'')} — ${esc(a.address||'')}</div></div>`).join('');
    }catch(e){ list.innerHTML=`<p style="color:var(--ink-muted)">লোড করা যায়নি</p>`; }
  },
  openAddAddress(){
    ['addrLabel','addrVillage','addrFull'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    const district=document.getElementById('addrDistrict'); if(district) district.value='';
    const zone=document.getElementById('addrZone'); if(zone) zone.innerHTML='<option value="">প্রথমে উপজেলা বেছে নিন</option>';
    const msg=document.getElementById('addressMsg'); if(msg) msg.className='form-msg';
    document.getElementById('addressModal')?.classList.add('show');
  },
  closeAddAddress(){ document.getElementById('addressModal')?.classList.remove('show'); },
  async saveAddress(){
    const msgEl=document.getElementById('addressMsg');
    if(!Auth.currentUser){ msgEl.textContent='লগইন করুন'; msgEl.className='form-msg err'; return; }
    const addr={label:document.getElementById('addrLabel').value.trim()||'ঠিকানা',district:document.getElementById('addrDistrict').value,zone:document.getElementById('addrZone').value,village:document.getElementById('addrVillage').value.trim(),address:document.getElementById('addrFull').value.trim()};
    if(!addr.district||!addr.address){ msgEl.textContent='উপজেলা ও ঠিকানা দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{ const ref=FB.doc(FB.db,'users',Auth.currentUser.uid); const snap=await FB.getDoc(ref); const addrs=snap.exists()?(snap.data().addresses||[]):[]; addrs.push(addr); await FB.setDoc(ref,{addresses:addrs},{merge:true}); toast('✓ ঠিকানা সংরক্ষণ করা হয়েছে','success'); this.closeAddAddress(); this.renderAddresses(); }
    catch(e){ msgEl.textContent='ঠিকানা সংরক্ষণ করা যায়নি'; msgEl.className='form-msg err'; }
  },
  async deleteAddress(idx){
    if(!FB||!Auth.currentUser||!Number.isInteger(idx)) return;
    try{ const ref=FB.doc(FB.db,'users',Auth.currentUser.uid); const snap=await FB.getDoc(ref); const addrs=snap.exists()?(snap.data().addresses||[]):[]; if(idx<0||idx>=addrs.length) return; addrs.splice(idx,1); await FB.setDoc(ref,{addresses:addrs},{merge:true}); this.renderAddresses(); }
    catch(e){ toast('মুছা যায়নি','error'); }
  }
};

/* ---------- Order editing — allowed only before driver pickup ---------- */
const OrderEdit = {
  orderId:null,
  isEditable(status){ return ['pending','confirmed','packed','assigned'].includes(status); },
  open(orderId, o){
    this.orderId = orderId;
    document.getElementById('eoVillage').value = o.village||'';
    document.getElementById('eoAddress').value = o.address||'';
    document.getElementById('eoInstructions').value = o.instructions||'';
    document.getElementById('editOrderMsg').className='form-msg';
    document.getElementById('editOrderModal').classList.add('show');
  },
  close(){ document.getElementById('editOrderModal').classList.remove('show'); },
  async save(){
    const msgEl = document.getElementById('editOrderMsg');
    const village = document.getElementById('eoVillage').value.trim();
    const address = document.getElementById('eoAddress').value.trim();
    const instructions = document.getElementById('eoInstructions').value.trim();
    if(!address || !instructions){ msgEl.textContent='ঠিকানা ও নির্দেশনা দুটোই দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      await FB.updateDoc(FB.doc(FB.db,'orders',this.orderId), {village, address, instructions});
      toast('✓ অর্ডার তথ্য আপডেট হয়েছে','success');
      this.close(); MyOrders.render();
    }catch(e){ msgEl.textContent='সমস্যা: '+e.message; msgEl.className='form-msg err'; }
  }
};

/* ---------- Cancel Order ---------- */
const CancelOrder = {
  orderId:null,
  open(orderId){
    this.orderId = orderId;
    document.getElementById('cancelReason').value='';
    document.getElementById('cancelOrderMsg').className='form-msg';
    document.getElementById('cancelOrderModal').classList.add('show');
  },
  close(){ document.getElementById('cancelOrderModal').classList.remove('show'); },
  async confirm(){
    const msgEl = document.getElementById('cancelOrderMsg');
    const reason = document.getElementById('cancelReason').value.trim();
    if(!reason){ msgEl.textContent='বাতিলের কারণ লিখুন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      // ⚠️ আগে এখানে সরাসরি orders doc-এ status+cancelReason+cancelledAt লেখা হতো,
      // কিন্তু security rule শুধু status/cancelledAt/paymentMethod/paymentStatus
      // field-এর পরিবর্তন অনুমোদন করে — cancelReason সেই তালিকায় না থাকায় পুরো
      // update-ই permission-denied দিয়ে ব্যর্থ হতো (কাস্টমার COD অর্ডার বাতিলই
      // করতে পারতো না)। এই flow-তে wallet/coupon/stock refund-ও কখনো হতো না।
      // এখন payment.js-এর cancel flow-এর মতোই একই secure Cloud Function ব্যবহার
      // করা হচ্ছে — status, reason এবং refund সবকিছু একসাথে, সঠিকভাবে।
      const cancel = FB.httpsCallable(FB.functions, 'cancelOrderSecure');
      await cancel({ orderId:this.orderId, reason });
      toast('✓ অর্ডার বাতিল করা হয়েছে','success');
      this.close(); MyOrders.render();
    }catch(e){ msgEl.textContent='বাতিল ব্যর্থ: '+(e.message||'আবার চেষ্টা করুন'); msgEl.className='form-msg err'; }
  }
};

/* ---------- Refund Request ---------- */
const RefundRequest = {
  orderId:null,
  open(orderId){
    this.orderId = orderId;
    document.getElementById('refundReason').value='';
    document.getElementById('refundMsg').className='form-msg';
    document.getElementById('refundModal').classList.add('show');
  },
  close(){ document.getElementById('refundModal').classList.remove('show'); },
  async submit(){
    const msgEl = document.getElementById('refundMsg');
    const reason = document.getElementById('refundReason').value.trim();
    if(!reason){ msgEl.textContent='রিফান্ডের কারণ লিখুন'; msgEl.className='form-msg err'; return; }
    const ok = await RefundService.requestRefund(this.orderId, reason);
    if(ok){ this.close(); MyOrders.render(); }
  }
};
/* ---------- Phone OTP Authentication ---------- */
const PhoneAuth = {
  confirmationResult:null, recaptchaVerifier:null,

  ensureRecaptcha(){
    if(!FB || this.recaptchaVerifier) return;
    this.recaptchaVerifier = new FB.RecaptchaVerifier(FB.auth, 'recaptcha-container', {
      size:'invisible'
    });
  },

  async sendOtp(){
    const raw = document.getElementById('phoneNumber').value.trim();
    const msgEl = document.getElementById('authMsg');
    const phoneRe = /^(?:\+880|880|0)1[3-9]\d{8}$/;
    if(!phoneRe.test(raw.replace(/[\s-]/g,''))){ AuthUI.showMsg('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)','err'); return; }
    if(!FB){ AuthUI.showMsg('সংযোগ সমস্যা','err'); return; }
    let digits = raw.replace(/[\s-]/g,'');
    if(digits.startsWith('0')) digits = digits.slice(1);
    if(digits.startsWith('880')) digits = digits.slice(3);
    const e164 = '+880' + digits;

    const btn = document.getElementById('sendOtpBtn');
    const orig = btn.textContent; btn.textContent = 'পাঠানো হচ্ছে...'; btn.disabled = true;
    try{
      this.ensureRecaptcha();
      this.confirmationResult = await FB.signInWithPhoneNumber(FB.auth, e164, this.recaptchaVerifier);
      document.getElementById('otpSentTo').textContent = raw;
      document.getElementById('phoneStep1').style.display='none';
      document.getElementById('phoneStep2').style.display='block';
      AuthUI.showMsg('✓ OTP পাঠানো হয়েছে','ok');
    }catch(e){
      devWarn('OTP send failed', e.message);
      AuthUI.showMsg('OTP পাঠানো ব্যর্থ: '+ (e.code==='auth/too-many-requests' ? 'অনেকবার চেষ্টা হয়েছে, একটু পর আবার চেষ্টা করুন' : e.message), 'err');
      if(this.recaptchaVerifier){ this.recaptchaVerifier.clear(); this.recaptchaVerifier = null; }
    }finally{ btn.textContent = orig; btn.disabled = false; }
  },

  async verifyOtp(){
    const code = document.getElementById('otpCode').value.trim();
    if(!code || code.length!==6){ AuthUI.showMsg('৬ সংখ্যার সঠিক OTP দিন','err'); return; }
    if(!this.confirmationResult){ AuthUI.showMsg('আগে OTP পাঠান','err'); return; }
    try{
      const cred = await this.confirmationResult.confirm(code);
      const uid = cred.user.uid;
      const userRef = FB.doc(FB.db,'users',uid);
      const snap = await FB.getDoc(userRef);
      if(!snap.exists()){
        await FB.setDoc(userRef, {
          phone: cred.user.phoneNumber, name:'গ্রাহক', role:'customer',
          createdAt:FB.serverTimestamp(), referralCode: uid.slice(0,6).toUpperCase(),
          referredBy:null, referralBonusGiven:false, walletBalance:0
        });
        if(typeof dataLayer!=='undefined') dataLayer.push({event:'sign_up', method:'phone'});
      }
      AuthUI.showMsg('✓ লগইন সফল','ok');
      setTimeout(()=>AuthUI.close(),700);
    }catch(e){
      devWarn('OTP verify failed', e.message);
      AuthUI.showMsg(e.code==='auth/invalid-verification-code' ? '❌ ভুল OTP কোড' : 'ভেরিফিকেশন ব্যর্থ','err');
    }
  },
  
  resetPhoneStep(){
    document.getElementById('phoneStep1').style.display='block';
    document.getElementById('phoneStep2').style.display='none';
    document.getElementById('phoneNumber').value='';
    document.getElementById('otpCode').value='';
    this.confirmationResult=null;
    if(this.recaptchaVerifier){ this.recaptchaVerifier.clear(); this.recaptchaVerifier=null; }
  }
};
window.Auth=Auth;window.AuthUI=AuthUI;window.AccountPage=AccountPage;window.OrderEdit=OrderEdit;window.CancelOrder=CancelOrder;window.RefundRequest=RefundRequest;window.PhoneAuth=PhoneAuth;

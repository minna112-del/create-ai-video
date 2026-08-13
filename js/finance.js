/* finance.js — FinanceDash (Firebase Auth secured, zone-manager.js প্যাটার্ন অনুসরণ করে) */
const FinanceDash = {
  currentUid: null, currentName: null,
  _orders: [], _refunds: [], _payouts: [],

  orderTotal(o){ return Number(o?.total ?? o?.grandTotal ?? o?.payableTotal ?? o?.subtotal ?? 0) || 0; },

  async login(){
    const email = document.getElementById('finEmail').value.trim();
    const pass = document.getElementById('finPassword').value;
    const msgEl = document.getElementById('finLoginMsg');
    if(!email || !pass){ msgEl.textContent='ইমেইল ও পাসওয়ার্ড দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      const cred = await FB.signInWithEmailAndPassword(FB.auth, email, pass);
      const staffSnap = await FB.getDoc(FB.doc(FB.db,'staff',cred.user.uid));
      if(!staffSnap.exists() || staffSnap.data().role!=='finance'){
        await FB.signOut(FB.auth).catch(()=>{});
        msgEl.textContent='এই অ্যাকাউন্ট ফাইন্যান্স টিম হিসেবে অনুমোদিত নয়'; msgEl.className='form-msg err'; return;
      }
      this.currentUid = cred.user.uid;
      this.currentName = staffSnap.data().name || 'ফাইন্যান্স টিম';
      if(typeof StaffChat !== 'undefined') StaffChat.init(this.currentUid, this.currentName, 'finance');
      document.getElementById('finLoginBox').style.display='none';
      document.getElementById('finDashBox').style.display='block';
    if(typeof EmployeeWorkspace!=='undefined') await EmployeeWorkspace.mountCurrent('finEmployeeWorkspace');
      const ml=document.getElementById('finUserLabel'); if(ml) ml.textContent='পরিচালনায়: '+this.currentName;
      await this.render();
    }catch(e){ msgEl.textContent='লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড সঠিক নয়'; msgEl.className='form-msg err'; }
  },

  async logout(){
    if(FB) await FB.signOut(FB.auth).catch(()=>{});
    this.currentUid=null; this.currentName=null;
    document.getElementById('finLoginBox').style.display='block';
    document.getElementById('finDashBox').style.display='none';
  },

  async _restoreSession(){
    if(this.currentUid || !FB || !FB.auth.currentUser) return;
    try{
      const staffSnap = await FB.getDoc(FB.doc(FB.db,'staff',FB.auth.currentUser.uid));
      if(staffSnap.exists() && staffSnap.data().role==='finance'){
        this.currentUid = FB.auth.currentUser.uid;
        this.currentName = staffSnap.data().name || 'ফাইন্যান্স টিম';
        if(typeof StaffChat !== 'undefined') StaffChat.init(this.currentUid, this.currentName, 'finance');
      }
    }catch(e){ devWarn('finance session restore failed', e.message); }
  },

  async render(){
    await this._restoreSession();
    if(!this.currentUid){
      document.getElementById('finLoginBox').style.display='block';
      document.getElementById('finDashBox').style.display='none';
      return;
    }
    document.getElementById('finLoginBox').style.display='none';
    document.getElementById('finDashBox').style.display='block';
    const ml=document.getElementById('finUserLabel'); if(ml) ml.textContent='পরিচালনায়: '+this.currentName;

    this._orders = await OrdersService.loadAll({force:this._forceNextLoad});
    this._forceNextLoad = false;
    await this.loadRefunds();
    await this.loadPayouts();

    this.renderOverview();
    this.renderRefunds();
    this.renderPayouts();
    this.renderZoneBreakdown();
    this.renderCodByZone();
    this.renderLedger();
  },

  async refresh(){ this._forceNextLoad = true; await this.render(); toast('✓ আপডেট হয়েছে','success'); },

  tab(btn,name){
    ['overview','refunds','payouts','zones','cod','ledger'].forEach(t=>{
      const el=document.getElementById('fin'+t.charAt(0).toUpperCase()+t.slice(1)+'Pane');
      if(el) el.style.display=t===name?'block':'none';
    });
    document.querySelectorAll('#page-finance-dash .zm-tabs button').forEach(a=>a.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(name==='refunds') this.renderRefunds();
    if(name==='payouts') this.renderPayouts();
    if(name==='zones') this.renderZoneBreakdown();
    if(name==='cod') this.renderCodByZone();
    if(name==='ledger') this.renderLedger();
  },

  // ---------- Overview ----------
  renderOverview(){
    const orders = this._orders;
    const active = orders.filter(o=>o.status!=='cancelled');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSales = active.filter(o=>new Date(o.createdAt?.seconds*1000||0)>=monthStart).reduce((s,o)=>s+this.orderTotal(o),0);

    const codOrders = active.filter(o=>o.paymentMethod==='cod' && o.status==='delivered');
    const codCollected = codOrders.reduce((s,o)=>s+this.orderTotal(o),0);
    const codDeposited = codOrders.filter(o=>o.codDeposited).reduce((s,o)=>s+this.orderTotal(o),0);
    const codPending = codCollected - codDeposited;
    const online = active.filter(o=>o.paymentMethod!=='cod').reduce((s,o)=>s+this.orderTotal(o),0);
    const refundPending = this._refunds.filter(r=>r.status==='pending').length;
    const payoutPending = this._payouts.filter(p=>p.status==='processing').length;

    const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    set('finMonthSales', money(monthSales));
    set('finCodPending', money(codPending));
    set('finOnlineTotal', money(online));
    set('finRefundPendingCount', bn(refundPending));
    set('finPayoutPendingCount', bn(payoutPending));

    this.renderRevenueChart(active);
    this.renderPayBreakdown(active);
    this.renderFinanceCommand(active);
  },

  renderFinanceCommand(active){
    const now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const today=active.filter(o=>new Date(o.createdAt?.seconds*1000||o.createdAt||0)>=start);
    const gross=active.reduce((s,o)=>s+this.orderTotal(o),0);
    const todayRevenue=today.reduce((s,o)=>s+this.orderTotal(o),0);
    const deliveredCod=active.filter(o=>o.paymentMethod==='cod'&&o.status==='delivered');
    const codCollected=deliveredCod.reduce((s,o)=>s+this.orderTotal(o),0);
    const codDeposited=deliveredCod.filter(o=>o.codDeposited).reduce((s,o)=>s+this.orderTotal(o),0);
    const codReceivable=Math.max(0,codCollected-codDeposited);
    const online=active.filter(o=>o.paymentMethod!=='cod').reduce((s,o)=>s+this.orderTotal(o),0);
    const pendingRefunds=this._refunds.filter(r=>r.status==='pending');
    const refundLiability=pendingRefunds.reduce((s,r)=>s+(Number(r.amount)||0),0);
    const approvedRefunds=this._refunds.filter(r=>r.status==='approved').reduce((s,r)=>s+(Number(r.amount)||0),0);
    const netCash=Math.max(0,online+codDeposited-approvedRefunds);
    const avgOrder=active.length?gross/active.length:0;
    const onlineShare=gross?Math.round((online/gross)*100):0;
    const cancelled=this._orders.filter(o=>o.status==='cancelled').length;
    const cancelRate=this._orders.length?Math.round(cancelled/this._orders.length*100):0;

    let score=100;
    if(codReceivable>0) score-=Math.min(30,Math.round(codReceivable/1000)*3);
    score-=Math.min(25,pendingRefunds.length*5);
    score-=Math.min(20,cancelRate);
    const health=score>=80?['নিয়ন্ত্রিত','good']:score>=60?['মনোযোগ প্রয়োজন','watch']:['ঝুঁকিপূর্ণ','danger'];
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('finHealthScore',bn(Math.max(0,score))+'%'); set('finHealthLabel',health[0]);
    const h=document.getElementById('finHealthScore'); if(h) h.dataset.state=health[1];
    set('finTodayRevenue',money(todayRevenue)); set('finNetCash',money(netCash));
    set('finReceivableCod',money(codReceivable)); set('finRefundLiability',money(refundLiability));
    set('finAvgOrder',money(avgOrder)); set('finOnlineShare',bn(onlineShare)+'%');

    const actions=[];
    if(codReceivable>0) actions.push({level:'danger',icon:'💵',title:'COD আদায় বাকি',note:`${money(codReceivable)} শাখা থেকে জমা নেওয়া দরকার`,tab:'cod',label:'রিকনসাইল'});
    if(pendingRefunds.length) actions.push({level:'watch',icon:'↩️',title:'রিফান্ড অনুমোদন বাকি',note:`${bn(pendingRefunds.length)}টি অনুরোধ, মোট ${money(refundLiability)}`,tab:'refunds',label:'রিভিউ'});
    if(cancelRate>=10) actions.push({level:'watch',icon:'⚠️',title:'ক্যানসেলেশন বেশি',note:`মোট অর্ডারের ${bn(cancelRate)}% বাতিল হয়েছে`,tab:'ledger',label:'লেজার দেখুন'});
    if(!actions.length) actions.push({level:'good',icon:'✓',title:'কোনো জরুরি আর্থিক ঝুঁকি নেই',note:'আজকের আর্থিক কার্যক্রম নিয়ন্ত্রণে আছে',tab:'overview',label:'ঠিক আছে'});
    set('finActionCount',bn(actions.length)+'টি');
    const list=document.getElementById('finActionList');
    if(list) list.innerHTML=actions.map(a=>`<article class="finance-action-item ${a.level}"><span>${a.icon}</span><div><strong>${a.title}</strong><p>${a.note}</p></div><button onclick="FinanceDash.openTab('${a.tab}')">${a.label}</button></article>`).join('');
    this.renderCashFlow(active);
  },

  openTab(name){
    const btn=[...document.querySelectorAll('#page-finance-dash .zm-tabs button')].find(b=>b.getAttribute('onclick')?.includes(`'${name}'`));
    if(btn) this.tab(btn,name);
  },

  renderCashFlow(orders){
    const days=[]; const now=new Date();
    for(let i=6;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i); const ds=d.toDateString();
      const day=orders.filter(o=>new Date(o.createdAt?.seconds*1000||o.createdAt||0).toDateString()===ds);
      const inflow=day.reduce((s,o)=>s+this.orderTotal(o),0);
      const refunds=this._refunds.filter(r=>new Date(r.createdAt?.seconds*1000||r.createdAt||0).toDateString()===ds&&r.status==='approved').reduce((s,r)=>s+(Number(r.amount)||0),0);
      days.push({label:['রবি','সোম','মঙ্গ','বুধ','বৃহ','শুক্র','শনি'][d.getDay()],net:inflow-refunds});
    }
    const max=Math.max(...days.map(d=>Math.abs(d.net)),1);
    const total=days.reduce((s,d)=>s+d.net,0); const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('finCashFlowTotal',money(total));
    const el=document.getElementById('finCashFlowBars');
    if(el) el.innerHTML=days.map(d=>`<div><span>${money(d.net)}</span><i style="height:${Math.max(8,Math.abs(d.net)/max*100)}%" class="${d.net<0?'negative':''}"></i><small>${d.label}</small></div>`).join('');
  },

  renderLedger(){
    const tbody=document.getElementById('finLedgerTable'); if(!tbody) return;
    const method=document.getElementById('finLedgerMethod')?.value||'';
    const status=document.getElementById('finLedgerStatus')?.value||'';
    let rows=this._orders.slice().filter(o=>(!method||o.paymentMethod===method)&&(!status||o.status===status));
    rows.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    const labels={cod:'COD',bkash:'bKash',nagad:'Nagad'};
    tbody.innerHTML=rows.slice(0,200).map(o=>`<tr><td>${formatTime(o.createdAt)}</td><td>${esc(o.orderNumber||o.id?.slice(-6)||'—')}</td><td>${esc(BRANCH_INFO[o.branchZone]?.label||o.branchZone||'—')}</td><td>${labels[o.paymentMethod]||o.paymentMethod||'COD'}</td><td style="font-weight:700;color:var(--rose)">${money(this.orderTotal(o))}</td><td>${o.paymentMethod==='cod'?(o.codDeposited?'<span style="color:#16a34a">জমা</span>':'<span style="color:#dc2626">বাকি</span>'):'—'}</td><td>${esc(ORDER_STATUS[o.status]?.label||o.status||'—')}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--ink-muted)">কোনো লেনদেন পাওয়া যায়নি</td></tr>';
  },

  exportFinanceReport(){
    const active=this._orders.filter(o=>o.status!=='cancelled');
    const rows=[['Order','Date','Branch','Payment','Status','Amount','COD Deposited']];
    active.forEach(o=>rows.push([o.orderNumber||o.id||'',formatTime(o.createdAt),BRANCH_INFO[o.branchZone]?.label||o.branchZone||'',o.paymentMethod||'cod',o.status||'',this.orderTotal(o),o.codDeposited?'yes':'no']));
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`golapi-finance-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  },

  renderRevenueChart(orders){
    const chartEl = document.getElementById('finRevenueChart');
    const labelsEl = document.getElementById('finChartLabels');
    if(!chartEl) return;
    const now = new Date();
    const days = [];
    for(let i=6;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const ds=d.toDateString();
      const rev = orders.filter(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===ds).reduce((s,o)=>s+this.orderTotal(o),0);
      days.push({rev, label:['রবি','সোম','মঙ্গ','বুধ','বৃহ','শুক্র','শনি'][d.getDay()], isToday:i===0});
    }
    const max = Math.max(...days.map(d=>d.rev),1);
    chartEl.innerHTML = days.map(d=>{
      const pct = Math.max((d.rev/max)*100, d.rev>0?8:2);
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;height:${pct}%;border-radius:4px 4px 0 0;background:${d.isToday?'var(--rose)':'rgba(240,53,107,.25)'};min-height:3px"></div>
      </div>`;
    }).join('');
    if(labelsEl) labelsEl.innerHTML = days.map(d=>`<div style="flex:1;text-align:center;font-size:9.5px;color:${d.isToday?'var(--rose)':'var(--ink-muted)'}">${d.label}</div>`).join('');
  },

  renderPayBreakdown(orders){
    const el = document.getElementById('finPayBreakdown');
    if(!el) return;
    const total = orders.reduce((s,o)=>s+this.orderTotal(o),0);
    const methods = {};
    orders.forEach(o=>{ const pm=o.paymentMethod||'cod'; methods[pm]=(methods[pm]||0)+this.orderTotal(o); });
    const labels = { cod:'💰 COD', bkash:'📱 bKash', nagad:'📱 Nagad' };
    el.innerHTML = Object.entries(methods).map(([m,v])=>{
      const pct = total>0 ? Math.round(v/total*100) : 0;
      return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>${labels[m]||m}</span><span style="color:var(--rose);font-weight:600">${money(v)} (${pct}%)</span></div>
      <div style="height:6px;border-radius:3px;background:rgba(0,0,0,.06)"><div style="height:100%;width:${pct}%;border-radius:3px;background:var(--rose)"></div></div></div>`;
    }).join('') || '<p style="font-size:12px;color:var(--ink-muted)">কোনো ডেটা নেই</p>';
  },

  // ---------- Refunds ----------
  async loadRefunds(){
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'refund_requests'), FB.orderBy('createdAt','desc'), FB.limit(100)));
      this._refunds = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }catch(e){ this._refunds = []; }
  },

  renderRefunds(){
    const pending = this._refunds.filter(r=>r.status==='pending');
    const tag = document.getElementById('finRefundPendingTag');
    if(tag) tag.textContent = pending.length ? `⏳ ${bn(pending.length)}টি পেন্ডিং` : 'কোনো পেন্ডিং নেই ✓';

    const tbody = document.getElementById('finRefundTable');
    if(!tbody) return;
    tbody.innerHTML = this._refunds.map(r=>`
      <tr>
        <td style="font-size:11.5px">${esc(r.orderNumber||r.orderId||'—')}</td>
        <td>${esc(r.customerName||'—')}</td>
        <td style="color:var(--rose);font-weight:600">${money(r.amount||0)}</td>
        <td style="font-size:11.5px;max-width:180px">${esc(r.reason||'—')}</td>
        <td style="font-size:11px;color:var(--ink-muted)">${formatTime(r.createdAt)}</td>
        <td><span style="font-size:12px;font-weight:600;color:${r.status==='pending'?'#d4930c':r.status==='approved'?'#22c55e':'#f87171'}">${r.status==='pending'?'⏳ পেন্ডিং':r.status==='approved'?'✅ অনুমোদিত':'❌ বাতিল'}</span></td>
        <td>${r.status==='pending' ? `
          <div style="display:flex;gap:6px">
            <button class="btn btn-gold" style="padding:5px 10px;font-size:11px" onclick="FinanceDash.resolveRefund('${r.id}','approved')">অনুমোদন</button>
            <button class="btn btn-outline" style="padding:5px 10px;font-size:11px" onclick="FinanceDash.resolveRefund('${r.id}','rejected')">বাতিল</button>
          </div>` : '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো রিফান্ড রিকোয়েস্ট নেই</td></tr>';
  },

  async resolveRefund(id, status){
    if(!FB) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'refund_requests',id), {
        status, resolvedBy:this.currentName, resolvedByUid:this.currentUid, resolvedAt:FB.serverTimestamp()
      });
      const r = this._refunds.find(x=>x.id===id); if(r) r.status=status;
      toast(status==='approved' ? '✓ রিফান্ড অনুমোদিত হয়েছে' : '✓ রিফান্ড বাতিল করা হয়েছে','success');
      this.renderRefunds();
      this.renderOverview();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  // ---------- Driver Payouts (cash-out approval) ----------
  async loadPayouts(){
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'payoutRequests'), FB.orderBy('createdAt','desc'), FB.limit(100)));
      this._payouts = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }catch(e){ this._payouts = []; }
  },

  renderPayouts(){
    const pending = this._payouts.filter(p=>p.status==='processing');
    const tag = document.getElementById('finPayoutPendingTag');
    if(tag) tag.textContent = pending.length ? `⏳ ${bn(pending.length)}টি পেন্ডিং` : 'কোনো পেন্ডিং নেই ✓';

    const METHOD_LABEL = {bkash:'বিকাশ', nagad:'নগদ', rocket:'রকেট', bank:'ব্যাংক'};
    const tbody = document.getElementById('finPayoutTable');
    if(!tbody) return;
    tbody.innerHTML = this._payouts.map(p=>`
      <tr>
        <td>${esc(p.driverName||p.driverId||'—')}</td>
        <td style="color:var(--rose);font-weight:600">${money(p.amount||0)}</td>
        <td style="font-size:11.5px">${esc(METHOD_LABEL[p.method]||p.method||'—')}</td>
        <td style="font-size:11.5px">${esc(p.accountNumber||'—')}</td>
        <td style="font-size:11px;color:var(--ink-muted)">${formatTime(p.createdAt)}</td>
        <td><span style="font-size:12px;font-weight:600;color:${p.status==='processing'?'#d4930c':p.status==='completed'?'#22c55e':'#f87171'}">${p.status==='processing'?'⏳ পেন্ডিং':p.status==='completed'?'✅ পরিশোধিত':'❌ বাতিল'}</span></td>
        <td>${p.status==='processing' ? `
          <div style="display:flex;gap:6px">
            <button class="btn btn-gold" style="padding:5px 10px;font-size:11px" onclick="FinanceDash.resolvePayout('${p.id}','completed')">পরিশোধ সম্পন্ন</button>
            <button class="btn btn-outline" style="padding:5px 10px;font-size:11px" onclick="FinanceDash.resolvePayout('${p.id}','rejected')">বাতিল</button>
          </div>` : '—'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো পে-আউট রিকোয়েস্ট নেই</td></tr>';
  },

  async resolvePayout(id, status){
    if(!FB) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'payoutRequests',id), {
        status, resolvedBy:this.currentName, resolvedByUid:this.currentUid, resolvedAt:FB.serverTimestamp()
      });
      const p = this._payouts.find(x=>x.id===id); if(p) p.status=status;
      toast(status==='completed' ? '✓ পে-আউট পরিশোধিত হিসেবে চিহ্নিত হয়েছে' : '✓ পে-আউট বাতিল করা হয়েছে','success');
      this.renderPayouts();
      this.renderOverview();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  // ---------- Zone Breakdown ----------
  renderZoneBreakdown(){
    const tbody = document.getElementById('finZoneTable');
    if(!tbody) return;
    const active = this._orders.filter(o=>o.status!=='cancelled');
    const zones = Object.keys(BRANCH_INFO);
    tbody.innerHTML = zones.map(z=>{
      const zo = active.filter(o=>o.branchZone===z);
      const revenue = zo.reduce((s,o)=>s+this.orderTotal(o),0);
      const cod = zo.filter(o=>o.paymentMethod==='cod').reduce((s,o)=>s+this.orderTotal(o),0);
      const online = revenue - cod;
      const refundPending = this._refunds.filter(r=>r.zone===z && r.status==='pending').length;
      return `<tr>
        <td>${esc(BRANCH_INFO[z].label)}</td>
        <td style="color:var(--rose);font-weight:600">${money(revenue)}</td>
        <td>${money(cod)}</td>
        <td>${money(online)}</td>
        <td style="color:${refundPending>0?'#f87171':'inherit'}">${bn(refundPending)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো শাখা নেই</td></tr>';
  },

  // ---------- COD by Zone ----------
  renderCodByZone(){
    const tbody = document.getElementById('finCodTable');
    if(!tbody) return;
    const zones = Object.keys(BRANCH_INFO);
    tbody.innerHTML = zones.map(z=>{
      const zo = this._orders.filter(o=>o.branchZone===z && o.paymentMethod==='cod' && o.status==='delivered');
      const collected = zo.reduce((s,o)=>s+this.orderTotal(o),0);
      const deposited = zo.filter(o=>o.codDeposited).reduce((s,o)=>s+this.orderTotal(o),0);
      const pending = collected - deposited;
      const complete = pending<=0 && collected>0;
      return `<tr>
        <td>${esc(BRANCH_INFO[z].label)}</td>
        <td>${money(collected)}</td>
        <td style="color:#22c55e">${money(deposited)}</td>
        <td style="color:${pending>0?'#f87171':'inherit'}">${money(pending)}</td>
        <td>${complete ? '<span style="color:#22c55e;font-weight:600">✅ সম্পূর্ণ</span>' : '<span style="color:#d4930c;font-weight:600">⏳ বাকি আছে</span>'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো শাখা নেই</td></tr>';
  }
};window.FinanceDash=FinanceDash;

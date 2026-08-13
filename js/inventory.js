/* inventory.js — InventoryDash (Firebase Auth secured, zone-manager.js প্যাটার্ন অনুসরণ করে) */
const InventoryDash = {
  currentUid: null, currentName: null,
  _products: [], _movementLogs: [], _restockRequests: [],

  async login(){
    const email = document.getElementById('invEmail').value.trim();
    const pass = document.getElementById('invPassword').value;
    const msgEl = document.getElementById('invLoginMsg');
    if(!email || !pass){ msgEl.textContent='ইমেইল ও পাসওয়ার্ড দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      const cred = await FB.signInWithEmailAndPassword(FB.auth, email, pass);
      const staffSnap = await FB.getDoc(FB.doc(FB.db,'staff',cred.user.uid));
      if(!staffSnap.exists() || staffSnap.data().role!=='inventory_manager'){
        await FB.signOut(FB.auth).catch(()=>{});
        msgEl.textContent='এই অ্যাকাউন্ট ইনভেন্টরি ম্যানেজার হিসেবে অনুমোদিত নয়'; msgEl.className='form-msg err'; return;
      }
      const data = staffSnap.data();
      this.currentUid = cred.user.uid;
      this.currentName = data.name || 'ইনভেন্টরি ম্যানেজার';
      if(typeof StaffChat !== 'undefined') StaffChat.init(this.currentUid, this.currentName, 'inventory_manager');
      document.getElementById('invLoginBox').style.display='none';
      document.getElementById('invDashBox').style.display='block';
    if(typeof EmployeeWorkspace!=='undefined') await EmployeeWorkspace.mountCurrent('invEmployeeWorkspace');
      const ml = document.getElementById('invManagerLabel'); if(ml) ml.textContent = 'পরিচালনায়: '+this.currentName;
      await this.render();
    }catch(e){ msgEl.textContent='লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড সঠিক নয়'; msgEl.className='form-msg err'; }
  },

  async logout(){
    if(FB) await FB.signOut(FB.auth).catch(()=>{});
    this.currentUid=null; this.currentName=null;
    document.getElementById('invLoginBox').style.display='block';
    document.getElementById('invDashBox').style.display='none';
  },

  async _restoreSession(){
    if(this.currentUid || !FB || !FB.auth.currentUser) return;
    try{
      const staffSnap = await FB.getDoc(FB.doc(FB.db,'staff',FB.auth.currentUser.uid));
      if(staffSnap.exists() && staffSnap.data().role==='inventory_manager'){
        this.currentUid = FB.auth.currentUser.uid;
        this.currentName = staffSnap.data().name || 'ইনভেন্টরি ম্যানেজার';
        if(typeof StaffChat !== 'undefined') StaffChat.init(this.currentUid, this.currentName, 'inventory_manager');
      }
    }catch(e){ devWarn('inventory session restore failed', e.message); }
  },

  async render(){
    await this._restoreSession();
    if(!this.currentUid){
      document.getElementById('invLoginBox').style.display='block';
      document.getElementById('invDashBox').style.display='none';
      return;
    }
    document.getElementById('invLoginBox').style.display='none';
    document.getElementById('invDashBox').style.display='block';
    const ml = document.getElementById('invManagerLabel'); if(ml) ml.textContent = 'পরিচালনায়: '+this.currentName;

    this._products = ALL_PRODUCTS || [];
    this.populateZoneFilter();
    await this.loadMovementLogs();
    await this.loadRestockRequests();

    this.renderOverview();
    this.renderStockTable();
    this.renderMovementTable();
    this.renderRestockTable();
  },

  async refresh(){ await this.render(); toast('✓ আপডেট হয়েছে','success'); },

  populateZoneFilter(){
    const sel = document.getElementById('invZoneFilter');
    if(!sel || typeof BRANCH_INFO==='undefined') return;
    const current = sel.value;
    sel.innerHTML = '<option value="">সব শাখা</option>' + Object.entries(BRANCH_INFO).map(([id,info])=>`<option value="${id}">${esc(info.label)}</option>`).join('');
    if(current) sel.value = current;
  },

  tab(btn,name){
    ['overview','stock','movement','restock'].forEach(t=>{
      const el=document.getElementById('inv'+t.charAt(0).toUpperCase()+t.slice(1)+'Pane');
      if(el) el.style.display=t===name?'block':'none';
    });
    document.querySelectorAll('#page-inventory-dash .zm-tabs button').forEach(a=>a.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(name==='stock') this.renderStockTable();
    if(name==='movement') this.renderMovementTable();
    if(name==='restock') this.renderRestockTable();
  },

  // ---------- Overview ----------
  renderOverview(){
    const products = this._products;
    const low = products.filter(p=>p.stock>0 && p.stock<=5);
    const out = products.filter(p=>p.stock<=0);
    const todayStr = new Date().toDateString();
    const updatedToday = this._movementLogs.filter(l=>{
      const d = l.createdAt?.seconds ? new Date(l.createdAt.seconds*1000) : null;
      return d && d.toDateString()===todayStr;
    }).length;

    const active = products.filter(p=>p.status!=='inactive');
    const inactive = products.filter(p=>p.status==='inactive');
    const unitsOnHand = products.reduce((sum,p)=>sum + Math.max(0, Number(p.stock)||0), 0);
    const pendingRestock = this._restockRequests.filter(r=>r.status==='pending');
    const riskPoints = (out.length*8) + (low.length*3) + (inactive.length*1.5);
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - ((riskPoints / Math.max(products.length,1))*5))));
    const healthLabel = healthScore>=85?'স্বাস্থ্যকর':healthScore>=65?'মনোযোগ প্রয়োজন':healthScore>=40?'উচ্চ ঝুঁকি':'সংকটজনক';

    const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    set('invStatTotal', bn(products.length));
    set('invStatLow', bn(low.length));
    set('invStatOut', bn(out.length));
    set('invStatUpdatedToday', bn(updatedToday));

    set('invUnitsOnHand', bn(unitsOnHand));
    set('invActiveSku', bn(active.length));
    set('invInactiveSku', bn(inactive.length));
    set('invPendingRestock', bn(pendingRestock.length));
    set('invHealthScore', bn(healthScore));
    set('invHealthLabel', healthLabel);
    const summary = document.getElementById('invHealthSummary');
    if(summary) summary.textContent = out.length ? `${bn(out.length)}টি পণ্য স্টক আউট এবং ${bn(low.length)}টি লো স্টকে আছে। আজই সাপ্লাই সিদ্ধান্ত প্রয়োজন।` : low.length ? `${bn(low.length)}টি পণ্য লো স্টকে আছে; আগাম রিস্টক করলে অর্ডার ব্যর্থতা কমবে।` : 'সব শাখার গুরুত্বপূর্ণ পণ্য বর্তমানে নিরাপদ স্টক সীমায় আছে।';
    this.renderPriorityActions({low,out,inactive,pendingRestock,healthScore});

    const alertBox = document.getElementById('invLowStockAlerts');
    const alertList = document.getElementById('invLowStockList');
    const lowAndOut = [...out, ...low];
    if(lowAndOut.length && alertBox && alertList){
      alertBox.style.display='block';
      alertList.innerHTML = lowAndOut.slice(0,10).map(p=>`
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid rgba(251,191,36,.1)">
          <span style="color:#fff">${esc(p.name)} <small style="color:var(--ink-muted)">(${zoneLabel(p.zone)})</small></span>
          <span style="color:${p.stock<=0?'#f87171':'#fbbf24'};font-weight:600">${p.stock<=0?'স্টক আউট':p.stock+' টি বাকি'}</span>
        </div>`).join('');
    } else if(alertBox){ alertBox.style.display='none'; }

    const zones = [...new Set(products.map(p=>p.zone).filter(Boolean))];
    this.renderBranchRisk(zones, products);
    const zoneTable = document.getElementById('invZoneStockTable');
    if(zoneTable){
      zoneTable.innerHTML = zones.map(z=>{
        const zp = products.filter(p=>p.zone===z);
        const zLow = zp.filter(p=>p.stock>0 && p.stock<=5).length;
        const zOut = zp.filter(p=>p.stock<=0).length;
        return `<tr><td>${zoneLabel(z)}</td><td style="text-align:center">${bn(zp.length)}</td>
          <td style="text-align:center;color:${zLow>0?'#fbbf24':'inherit'}">${bn(zLow)}</td>
          <td style="text-align:center;color:${zOut>0?'#f87171':'inherit'}">${bn(zOut)}</td></tr>`;
      }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--ink-muted)">কোনো শাখা নেই</td></tr>';
    }

    const recentEl = document.getElementById('invRecentMovement');
    if(recentEl){
      recentEl.innerHTML = this._movementLogs.slice(0,6).map(l=>`
        <tr><td>${esc(l.productName||'—')}</td><td>${bn(l.oldStock ?? 0)}</td><td>${bn(l.newStock ?? 0)}</td>
        <td style="font-size:11.5px;color:var(--ink-muted)">${formatTime(l.createdAt)}</td></tr>`).join('')
        || '<tr><td colspan="4" style="text-align:center;color:var(--ink-muted)">এখনো কোনো পরিবর্তন নেই</td></tr>';
    }
  },

  renderPriorityActions({low,out,inactive,pendingRestock,healthScore}){
    const el=document.getElementById('invPriorityActions'); if(!el) return;
    const actions=[];
    if(out.length) actions.push({level:'critical',title:`${bn(out.length)}টি পণ্য স্টক আউট`,text:'অর্ডার হারানো ঠেকাতে জরুরি রিস্টক রিকোয়েস্ট তৈরি করুন।',action:'InventoryDash.createCriticalRestockRequests()',label:'রিস্টক তৈরি'});
    if(low.length) actions.push({level:'warning',title:`${bn(low.length)}টি পণ্য লো স্টকে`,text:'পরবর্তী বিক্রয়চক্রের আগে সরবরাহ নিশ্চিত করুন।',action:"InventoryDash.openStockFilter('low')",label:'তালিকা দেখুন'});
    if(pendingRestock.length) actions.push({level:'info',title:`${bn(pendingRestock.length)}টি রিস্টক সিদ্ধান্ত অপেক্ষমাণ`,text:'Owner/Procurement অনুমোদনের অবস্থা অনুসরণ করুন।',action:"InventoryDash.openRestockPane()",label:'রিকোয়েস্ট দেখুন'});
    if(inactive.length) actions.push({level:'neutral',title:`${bn(inactive.length)}টি SKU নিষ্ক্রিয়`,text:'অপ্রয়োজনীয়, মৌসুমি বা ভুলভাবে নিষ্ক্রিয় পণ্য যাচাই করুন।',action:"InventoryDash.openStockFilter('inactive')",label:'পর্যালোচনা'});
    if(!actions.length) actions.push({level:'success',title:'আজ কোনো জরুরি স্টক ঝুঁকি নেই',text:`ইনভেন্টরি হেলথ স্কোর ${bn(healthScore)}/১০০। নিয়মিত পর্যবেক্ষণ চালিয়ে যান।`,action:"InventoryDash.openStockFilter('healthy')",label:'স্বাস্থ্যকর স্টক'});
    el.innerHTML=actions.slice(0,4).map(a=>`<article class="inv-priority inv-priority--${a.level}"><div><strong>${a.title}</strong><p>${a.text}</p></div><button type="button" onclick="${a.action}">${a.label}</button></article>`).join('');
  },

  renderBranchRisk(zones, products){
    const el=document.getElementById('invBranchRiskGrid'); if(!el) return;
    el.innerHTML=zones.map(z=>{
      const list=products.filter(p=>p.zone===z), out=list.filter(p=>p.stock<=0).length, low=list.filter(p=>p.stock>0&&p.stock<=5).length;
      const score=Math.max(0,Math.round(100-((out*9+low*3)/Math.max(list.length,1))*5));
      const tone=score>=80?'good':score>=55?'warn':'danger';
      return `<article class="inv-branch-risk inv-branch-risk--${tone}"><div><span>${esc(zoneLabel(z))}</span><strong>${bn(score)}/১০০</strong></div><p>${bn(list.length)} SKU · ${bn(low)} লো · ${bn(out)} আউট</p><div><i style="width:${score}%"></i></div></article>`;
    }).join('');
  },

  openStockFilter(value){
    const btn=[...document.querySelectorAll('#page-inventory-dash .zm-tabs button')].find(b=>b.textContent.includes('স্টক ম্যানেজমেন্ট'));
    this.tab(btn,'stock'); const sel=document.getElementById('invStockFilter'); if(sel) sel.value=value; this.renderStockTable();
  },

  openRestockPane(){
    const btn=[...document.querySelectorAll('#page-inventory-dash .zm-tabs button')].find(b=>b.textContent.includes('রিস্টক'));
    this.tab(btn,'restock');
  },

  async createCriticalRestockRequests(){
    const critical=this._products.filter(p=>Number(p.stock)<=5);
    const pendingIds=new Set(this._restockRequests.filter(r=>r.status==='pending').map(r=>r.productId));
    const targets=critical.filter(p=>!pendingIds.has(p.id));
    if(!targets.length){ toast('সব জরুরি পণ্যের রিস্টক রিকোয়েস্ট ইতিমধ্যে আছে','info'); return; }
    if(!confirm(`${targets.length}টি জরুরি পণ্যের রিস্টক রিকোয়েস্ট তৈরি করবেন?`)) return;
    try{
      for(const product of targets){
        await FB.addDoc(FB.collection(FB.db,'restock_requests'), {productId:product.id,productName:product.name||'—',zone:product.zone||'',stockAtRequest:Number(product.stock)||0,status:'pending',priority:Number(product.stock)<=0?'critical':'high',requestedByUid:this.currentUid,requestedByName:this.currentName,createdAt:FB.serverTimestamp()});
      }
      await this.loadRestockRequests(); this.renderOverview(); this.renderRestockTable();
      toast(`✓ ${targets.length}টি রিস্টক রিকোয়েস্ট তৈরি হয়েছে`,'success');
    }catch(e){ toast('রিস্টক তৈরি ব্যর্থ: '+e.message,'error'); }
  },

  exportStockCsv(){
    const rows=[['Product ID','Product','Branch','Stock','Status','Risk']];
    this._products.forEach(p=>rows.push([p.id,p.name||'',zoneLabel(p.zone),Number(p.stock)||0,p.status||'active',Number(p.stock)<=0?'OUT':Number(p.stock)<=5?'LOW':'HEALTHY']));
    const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`golapi-inventory-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  },

  // ---------- Stock Management ----------
  renderStockTable(){
    const q = (document.getElementById('invProductSearch')?.value || '').toLowerCase();
    const zone = document.getElementById('invZoneFilter')?.value || '';
    const stockFilter = document.getElementById('invStockFilter')?.value || '';

    let list = this._products.filter(p=>{
      if(q && !(p.name||'').toLowerCase().includes(q)) return false;
      if(zone && p.zone!==zone) return false;
      if(stockFilter==='low' && !(p.stock>0 && p.stock<=5)) return false;
      if(stockFilter==='out' && !(p.stock<=0)) return false;
      if(stockFilter==='healthy' && !(p.stock>5 && p.status!=='inactive')) return false;
      if(stockFilter==='inactive' && p.status!=='inactive') return false;
      return true;
    });

    const tbody = document.getElementById('invStockTable');
    if(!tbody) return;
    tbody.innerHTML = list.map(p=>`
      <tr>
        <td><div style="width:34px;height:34px;border-radius:7px;overflow:hidden;background:var(--elevated)"><img src="${safeImgSrc(p.img)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" decoding="async" width="34" height="34"></div></td>
        <td><div style="font-size:12px;color:#fff">${esc(p.name)}</div></td>
        <td style="font-size:12px">${zoneLabel(p.zone)}</td>
        <td style="text-align:center;font-weight:600;color:${p.stock<=0?'#f87171':(p.stock<=5?'#fbbf24':'#fff')}">${bn(p.stock ?? 0)}</td>
        <td><input type="number" min="0" value="${p.stock ?? 0}" id="invNewStock_${p.id}" style="width:65px;padding:4px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:#fff;font-size:12px;text-align:center"></td>
        <td>
          <select id="invAvail_${p.id}" style="padding:4px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:#fff;font-size:11.5px">
            <option value="active" ${p.status==='active'?'selected':''}>সক্রিয়</option>
            <option value="inactive" ${p.status==='inactive'?'selected':''}>নিষ্ক্রিয়</option>
          </select>
        </td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-gold" style="padding:5px 10px;font-size:11.5px" onclick="InventoryDash.updateStock('${p.id}')">সংরক্ষণ</button>
          <button class="btn btn-outline" style="padding:5px 10px;font-size:11.5px" onclick="InventoryDash.requestRestock('${p.id}')">🛒 রিস্টক</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো প্রোডাক্ট পাওয়া যায়নি</td></tr>';
  },

  filterStock(){ this.renderStockTable(); },

  async updateStock(productId){
    const product = this._products.find(p=>p.id===productId);
    if(!product) return;
    const newStock = Number(document.getElementById('invNewStock_'+productId)?.value ?? product.stock);
    const newStatus = document.getElementById('invAvail_'+productId)?.value || product.status;
    const oldStock = product.stock ?? 0;

    if(!Number.isFinite(newStock) || newStock < 0){ toast('সঠিক স্টক সংখ্যা দিন','error'); return; }

    try{
      await FB.updateDoc(FB.doc(FB.db,'products',productId), { stock:newStock, status:newStatus, updatedAt:FB.serverTimestamp() });

      if(newStock !== oldStock){
        await FB.addDoc(FB.collection(FB.db,'stock_logs'), {
          productId, productName:product.name||'—', zone:product.zone||'',
          oldStock, newStock, updatedByUid:this.currentUid, updatedByName:this.currentName,
          createdAt:FB.serverTimestamp()
        });
      }
      product.stock=newStock; product.status=newStatus;
      toast('✓ স্টক আপডেট হয়েছে','success');
      await this.loadMovementLogs();
      this.renderOverview(); this.renderStockTable();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async requestRestock(productId){
    const product = this._products.find(p=>p.id===productId);
    if(!product) return;
    try{
      await FB.addDoc(FB.collection(FB.db,'restock_requests'), {
        productId, productName:product.name||'—', zone:product.zone||'',
        stockAtRequest:product.stock ?? 0, status:'pending',
        requestedByUid:this.currentUid, requestedByName:this.currentName,
        createdAt:FB.serverTimestamp()
      });
      toast('✓ রিস্টক রিকোয়েস্ট Owner-কে পাঠানো হয়েছে','success');
      await this.loadRestockRequests(); this.renderRestockTable();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  // ---------- Movement Log ----------
  async loadMovementLogs(){
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'stock_logs'), FB.orderBy('createdAt','desc'), FB.limit(100)));
      this._movementLogs = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }catch(e){ this._movementLogs = []; }
  },

  renderMovementTable(){
    const dateFilter = document.getElementById('invMovementDate')?.value || '';
    let list = this._movementLogs;
    if(dateFilter){
      list = list.filter(l=>{
        const d = l.createdAt?.seconds ? new Date(l.createdAt.seconds*1000) : null;
        return d && d.toISOString().slice(0,10) === dateFilter;
      });
    }
    const tbody = document.getElementById('invMovementTable');
    if(!tbody) return;
    tbody.innerHTML = list.map(l=>`
      <tr><td>${esc(l.productName||'—')}</td><td>${zoneLabel(l.zone)}</td><td>${bn(l.oldStock ?? 0)}</td><td>${bn(l.newStock ?? 0)}</td>
      <td>${esc(l.updatedByName||'—')}</td><td style="font-size:11.5px;color:var(--ink-muted)">${formatTime(l.createdAt)}</td></tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো রেকর্ড নেই</td></tr>';
  },

  filterMovement(){ this.renderMovementTable(); },

  // ---------- Restock Requests ----------
  async loadRestockRequests(){
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'restock_requests'), FB.orderBy('createdAt','desc'), FB.limit(50)));
      this._restockRequests = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }catch(e){ this._restockRequests = []; }
  },

  renderRestockTable(){
    const pending = this._restockRequests.filter(r=>r.status==='pending');
    const countEl = document.getElementById('invRestockPendingCount');
    if(countEl) countEl.textContent = pending.length ? `⏳ ${bn(pending.length)}টি পেন্ডিং` : '';

    const tbody = document.getElementById('invRestockTable');
    if(!tbody) return;
    tbody.innerHTML = this._restockRequests.map(r=>`
      <tr><td>${esc(r.productName||'—')}</td><td>${zoneLabel(r.zone)}</td><td>${bn(r.stockAtRequest ?? 0)}</td>
      <td style="font-size:11.5px;color:var(--ink-muted)">${formatTime(r.createdAt)}</td>
      <td><span style="color:${r.status==='pending'?'#fbbf24':'#22c55e'};font-weight:600;font-size:12px">${r.status==='pending'?'⏳ পেন্ডিং':'✅ সম্পন্ন'}</span></td></tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো রিকোয়েস্ট নেই</td></tr>';
  }
};

// ---------- Local fallback helper (main.js-এ zoneLabel না থাকলে ব্যবহার হবে) ----------
if(typeof zoneLabel === 'undefined'){
  function zoneLabel(zone){
    if(typeof BRANCH_INFO!=='undefined' && BRANCH_INFO[zone]) return BRANCH_INFO[zone].label;
    return zone || '—';
  }
}
if(typeof formatTime === 'undefined'){
  function formatTime(ts){
    if(!ts?.seconds) return '—';
    return new Date(ts.seconds*1000).toLocaleString('bn-BD',{ day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  }
}
document.addEventListener('branches-updated', ()=>{ InventoryDash.populateZoneFilter(); InventoryDash.renderStockTable(); InventoryDash.renderOverview(); });window.InventoryDash=InventoryDash;

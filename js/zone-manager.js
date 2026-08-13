/* zone-manager.js — ZoneManagerDash (Firebase Auth secured) */
const ZoneManagerDash = {
  currentZone: null, currentUid: null, _orders: [],
  orderTotal(o){ return Number(o?.total ?? o?.grandTotal ?? o?.payableTotal ?? o?.subtotal ?? 0) || 0; },
  applyHeader(zone){
    const info = BRANCH_INFO[zone] || {label: zone || 'নির্ধারিত জোন', managerName:'—'};
    const zl=document.getElementById('zmZoneLabel'); if(zl) zl.textContent = info.label;
    const ml=document.getElementById('zmManagerLabel'); if(ml) ml.textContent = 'ম্যানেজার: '+info.managerName;
  },
  async login(){
    const email=document.getElementById('zmEmail').value.trim();
    const pass=document.getElementById('zmPassword').value;
    const msgEl=document.getElementById('zmLoginMsg');
    if(!email||!pass){ msgEl.textContent='ইমেইল ও পাসওয়ার্ড দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      const cred = await FB.signInWithEmailAndPassword(FB.auth, email, pass);
      const staffSnap = await FB.getDoc(FB.doc(FB.db,'staff',cred.user.uid));
      if(!staffSnap.exists() || staffSnap.data().role!=='zone_manager'){
        await FB.signOut(FB.auth).catch(()=>{});
        msgEl.textContent='এই অ্যাকাউন্ট জোন ম্যানেজার হিসেবে অনুমোদিত নয়'; msgEl.className='form-msg err'; return;
      }
      const data = staffSnap.data();
      this.currentUid = cred.user.uid;
      this.currentZone = data.branchZone;
      this.currentName = data.name || (BRANCH_INFO[data.branchZone]?.managerName) || 'জোন ম্যানেজার';
      if(typeof StaffChat !== 'undefined') StaffChat.init(this.currentUid, this.currentName, 'zone_manager');
      document.getElementById('zmLoginBox').style.display='none';
      document.getElementById('zmDashBox').style.display='block';
      this.applyHeader(this.currentZone);
      await this.render();
    }catch(e){ msgEl.textContent='লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড সঠিক নয়'; msgEl.className='form-msg err'; }
  },
  async logout(){
    if(FB) await FB.signOut(FB.auth).catch(()=>{});
    this.currentZone=null; this.currentUid=null;
    document.getElementById('zmLoginBox').style.display='block';
    document.getElementById('zmDashBox').style.display='none';
  },
  async _restoreSession(){
    if(this.currentZone || !FB || !FB.auth.currentUser) return;
    try{
      const staffSnap = await FB.getDoc(FB.doc(FB.db,'staff',FB.auth.currentUser.uid));
      if(staffSnap.exists() && staffSnap.data().role==='zone_manager'){
        this.currentUid = FB.auth.currentUser.uid;
        this.currentZone = staffSnap.data().branchZone;
        this.currentName = staffSnap.data().name || (BRANCH_INFO[this.currentZone]?.managerName) || 'জোন ম্যানেজার';
        if(typeof StaffChat !== 'undefined') StaffChat.init(this.currentUid, this.currentName, 'zone_manager');
      }
    }catch(e){ devWarn('zone-manager session restore failed', e.message); }
  },
  async render(){
    await this._restoreSession();
    if(!this.currentZone){ document.getElementById('zmLoginBox').style.display='block'; document.getElementById('zmDashBox').style.display='none'; return; }
    document.getElementById('zmLoginBox').style.display='none';
    document.getElementById('zmDashBox').style.display='block';
    this.applyHeader(this.currentZone);
    if(typeof EmployeeWorkspace!=='undefined') await EmployeeWorkspace.mountCurrent('zmEmployeeWorkspace');
    const allOrders = await OrdersService.loadAll();
    const orders = allOrders.filter(o=>o.branchZone===this.currentZone);
    this._orders = orders;
    const products = ALL_PRODUCTS.filter(p=>p.zone===this.currentZone);
    await DriverManage.loadDrivers();

    const now = new Date();
    const todayStr = now.toDateString();
    const active = orders.filter(o=>o.status!=='cancelled');
    const sales = active.reduce((sum,o)=>sum+this.orderTotal(o),0);
    const todaySales = active.filter(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===todayStr).reduce((sum,o)=>sum+this.orderTotal(o),0);
    const pending = orders.filter(o=>['pending','confirmed'].includes(o.status)).length;

    const st1=document.getElementById('zmStatToday'); if(st1) st1.textContent = money(todaySales);
    const st2=document.getElementById('zmStatSales'); if(st2) st2.textContent = money(sales);
    const st3=document.getElementById('zmStatOrders'); if(st3) st3.textContent = bn(orders.length);
    const st4=document.getElementById('zmStatPending'); if(st4) st4.textContent = bn(pending);
    const st5=document.getElementById('zmStatProducts'); if(st5) st5.textContent = bn(products.length);

    this.renderCodSummary(orders);
    this.renderEscalations();

    this.renderInventoryAlerts(products);
    this.renderRevenueChart(orders);
    this.renderRecentOrders(orders.slice(0,6));
    this.renderProducts(products);
    this.renderOrders(orders);
    this.renderAnalytics(orders);
    DriverManage.renderTable(this.currentZone);
  },
  async renderCodSummary(orders){
    const codOrders = orders.filter(o=>o.paymentMethod==='cod' && o.status==='delivered');
    const collected = codOrders.reduce((s,o)=>s+this.orderTotal(o),0);
    const deposited = codOrders.filter(o=>o.codDeposited).reduce((s,o)=>s+this.orderTotal(o),0);
    const pending = collected - deposited;
    const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    set('zmCodCollected', money(collected));
    set('zmCodDeposited', money(deposited));
    set('zmCodPending', money(pending));
    const bar = document.getElementById('zmCodBar');
    if(bar) bar.style.width = collected>0 ? Math.round(deposited/collected*100)+'%' : '0%';
  },

  async markCodDeposited(orderId){
    if(!FB) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'orders',orderId), { codDeposited:true, codDepositedAt: FB.serverTimestamp() });
      const o = this._orders.find(x=>x.id===orderId); if(o) o.codDeposited=true;
      toast('✓ জমা হিসেবে চিহ্নিত হয়েছে','success');
      this.renderCodSummary(this._orders);
      this.renderOrders(this._orders);
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async escalateOrder(orderId){
    const o = this._orders.find(x=>x.id===orderId); if(!o || !FB) return;
    const note = prompt('সমস্যার সংক্ষিপ্ত বিবরণ লিখুন (Owner/Support-কে পাঠানো হবে):');
    if(note===null) return;
    try{
      await FB.addDoc(FB.collection(FB.db,'escalations'), {
        orderId, orderNumber: o.orderNumber||orderId.slice(-6), zone:this.currentZone,
        customerName:o.customerName||'—', customerPhone:o.customerPhone||'—',
        note: note.trim() || 'বিস্তারিত দেওয়া হয়নি', status:'open',
        raisedBy:'zone_manager', raisedByUid:this.currentUid,
        createdAt: FB.serverTimestamp()
      });
      toast('✓ সমস্যাটি Owner/Support-কে জানানো হয়েছে','success');
      await this.renderEscalations();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async renderEscalations(){
    const box = document.getElementById('zmEscalationList');
    if(!box || !FB) return;
    try{
      const snap = await FB.getDocs(FB.query(
        FB.collection(FB.db,'escalations'),
        FB.where('zone','==',this.currentZone),
        FB.where('status','==','open'),
        FB.orderBy('createdAt','desc'),
        FB.limit(10)
      ));
      const list = snap.docs.map(d=>({id:d.id, ...d.data()}));
      const wrap = document.getElementById('zmEscalationCard');
      if(!list.length){ if(wrap) wrap.style.display='none'; return; }
      if(wrap) wrap.style.display='block';
      box.innerHTML = list.map(e=>`
        <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px">
          <div><span style="color:#fff">${esc(e.orderNumber)}</span> — ${esc(e.note)}</div>
          <span style="color:#fbbf24;font-weight:600;white-space:nowrap">⏳ পেন্ডিং</span>
        </div>`).join('');
    }catch(e){ devWarn('escalations load failed', e.message); }
  },

  renderInventoryAlerts(products){
    const low = products.filter(p=>p.stock>=0&&p.stock<=5);
    const el = document.getElementById('zmInventoryAlerts');
    const listEl = document.getElementById('zmInventoryAlertList');
    if(!low.length||!el){ if(el) el.style.display='none'; return; }
    el.style.display='block';
    listEl.innerHTML = low.map(p=>`<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid rgba(251,191,36,.1)">
      <span style="color:#fff">${esc(p.name)}</span>
      <span style="color:${p.stock===0?'#f87171':'#fbbf24'};font-weight:600">${p.stock===0?'স্টক আউট':p.stock+' টি বাকি'}</span>
    </div>`).join('');
  },
  renderRevenueChart(orders){
    const chartEl = document.getElementById('zmRevenueChart');
    const labelsEl = document.getElementById('zmChartLabels');
    if(!chartEl) return;
    const now = new Date();
    const days = [];
    for(let i=6;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const ds=d.toDateString();
      const rev = orders.filter(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===ds&&o.status!=='cancelled').reduce((sum,o)=>sum+this.orderTotal(o),0);
      days.push({rev, label:['রবি','সোম','মঙ্গ','বুধ','বৃহ','শুক্র','শনি'][d.getDay()], isToday:i===0});
    }
    const max = Math.max(...days.map(d=>d.rev),1);
    chartEl.innerHTML = days.map(d=>{
      const pct = Math.max((d.rev/max)*100,d.rev>0?8:2);
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;height:${pct}%;border-radius:4px 4px 0 0;background:${d.isToday?'var(--gold)':'rgba(212,175,55,.3)'};min-height:3px"></div>
      </div>`;
    }).join('');
    if(labelsEl) labelsEl.innerHTML = days.map(d=>`<div style="flex:1;text-align:center;font-size:9.5px;color:${d.isToday?'var(--gold)':'var(--ink-muted)'}">${d.label}</div>`).join('');
  },
  renderRecentOrders(orders){
    const tbody = document.getElementById('zmRecentOrders');
    if(!tbody) return;
    tbody.innerHTML = orders.map(o=>{
      const s=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
      return `<tr>
        <td style="font-size:11px">${o.orderNumber||o.id.slice(-6)}</td>
        <td>${esc(o.customerName)||'—'}</td>
        <td style="color:var(--gold)">${money(this.orderTotal(o))}</td>
        <td><span class="status-pill ${s.cls}">${s.label}</span></td>
        <td><a href="#" onclick="event.preventDefault();OrderDetail.open(${JSON.stringify(o).replace(/"/g,'&quot;')})" style="color:var(--gold);font-size:12px">বিস্তারিত</a></td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো অর্ডার নেই</td></tr>';
  },
  renderProducts(list){
    const tbody = document.getElementById('zmProductsTable');
    if(!tbody) return;
    const search = document.getElementById('zmProductSearch')?.value.toLowerCase()||'';
    const filtered = search ? list.filter(p=>p.name.toLowerCase().includes(search)) : list;
    tbody.innerHTML = filtered.map(p=>`<tr>
      <td><div style="width:34px;height:34px;border-radius:7px;overflow:hidden;background:var(--elevated)"><img src="${safeImgSrc(p.img)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" decoding="async" width="34" height="34"></div></td>
      <td><div style="font-size:12px;color:#fff">${esc(p.name)}</div><div style="font-size:10px;color:var(--ink-muted)">${CATEGORIES.find(c=>c.id===p.category)?.label||''}</div></td>
      <td style="color:var(--gold)">${money(p.salePrice)}</td>
      <td><input type="number" value="${p.stock}" min="0" onchange="ZoneManagerDash.quickStock('${p.id}',this.value)" style="width:55px;padding:3px 5px;border-radius:6px;background:var(--bg2);border:1px solid ${p.stock<=5?'rgba(239,68,68,.4)':'var(--line)'};color:${p.stock===0?'#f87171':p.stock<=5?'#fbbf24':'#fff'};font-size:12px;text-align:center"></td>
      <td><span class="status-pill ${p.stock>0?'delivered':'cancelled'}">${p.stock>0?'লাইভ':'আউট'}</span></td>
      <td><a href="#" onclick="event.preventDefault();ProductForm.openEdit('${p.id}')" style="color:var(--gold);font-size:12px">এডিট</a></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো প্রোডাক্ট নেই</td></tr>';
  },
  filterProducts(){ this.renderProducts(ALL_PRODUCTS.filter(p=>p.zone===this.currentZone)); },
  async quickStock(id,val){
    if(!FB) return;
    try{ await FB.updateDoc(FB.doc(FB.db,'products',id),{stock:Number(val),updatedAt:FB.serverTimestamp()}); const p=ALL_PRODUCTS.find(x=>x.id===id); if(p) p.stock=Number(val); toast('✓ স্টক আপডেট','success'); }
    catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },
  renderOrders(orders){
    const tbody = document.getElementById('zmOrdersTable');
    if(!tbody) return;
    const f = document.getElementById('zmOrderStatusFilter')?.value||'';
    const list = f ? orders.filter(o=>o.status===f) : orders;
    const zoneDrivers = DriverManage.drivers.filter(d=>d.branchZone===this.currentZone);
    tbody.innerHTML = list.map(o=>{
      const s=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
      const opts = zoneDrivers.map(d=>`<option value="${d.id}" ${o.driverId===d.id?'selected':''}>${d.name}</option>`).join('');
      return `<tr>
        <td style="font-size:11px">${o.orderNumber||o.id.slice(-6)}</td>
        <td>${esc(o.customerName)||'—'}</td>
        <td>${esc(o.customerPhone)||'—'}</td>
        <td style="color:var(--gold)">${money(this.orderTotal(o))}</td>
        <td><select onchange="ZoneManagerDash.assignDriver('${o.id}',this.value)" style="padding:3px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:#fff;font-size:11px;max-width:110px">
          <option value="">বেছে নিন</option>${opts}
        </select></td>
        <td>
          <select onchange="ZoneManagerDash.quickStatus('${o.id}',this.value)" style="padding:3px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:#fff;font-size:11px">
            ${Object.entries(ORDER_STATUS).map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </td>
        <td><a href="#" onclick="event.preventDefault();OrderDetail.open(${JSON.stringify(o).replace(/"/g,'&quot;')})" style="color:var(--gold);font-size:12px;display:block;margin-bottom:3px">বিস্তারিত</a>
          <a href="#" onclick="event.preventDefault();ZoneManagerDash.escalateOrder('${o.id}')" style="color:#f87171;font-size:11px;display:block;margin-bottom:3px">⚠️ এস্কেলেট</a>
          ${o.paymentMethod==='cod'&&o.status==='delivered'&&!o.codDeposited?`<a href="#" onclick="event.preventDefault();ZoneManagerDash.markCodDeposited('${o.id}')" style="color:#22c55e;font-size:11px;display:block">💰 COD জমা দিন</a>`:''}
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো অর্ডার নেই</td></tr>';
  },
  filterOrders(){ this.renderOrders(this._orders); },
  renderAnalytics(orders){
    const active=orders.filter(o=>o.status!=='cancelled');
    const now=new Date();
    const todayStr=now.toDateString();
    const weekAgo=new Date(now-7*24*60*60*1000);
    const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
    const get=(fn)=>active.filter(fn).reduce((sum,o)=>sum+this.orderTotal(o),0);
    const t=get(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===todayStr);
    const w=get(o=>new Date(o.createdAt?.seconds*1000||0)>=weekAgo);
    const m=get(o=>new Date(o.createdAt?.seconds*1000||0)>=monthStart);
    ['zmAnToday','zmAnWeek','zmAnMonth'].forEach((id,i)=>{ const el=document.getElementById(id); if(el) el.textContent=money([t,w,m][i]); });
    const pbEl=document.getElementById('zmPayBreakdown');
    if(pbEl){
      const total=active.reduce((sum,o)=>sum+this.orderTotal(o),0);
      const methods={};
      active.forEach(o=>{const pm=o.paymentMethod||'cod';methods[pm]=(methods[pm]||0)+this.orderTotal(o);});
      const labels={cod:'💰 COD',bkash:'📱 bKash',nagad:'📱 Nagad'};
      pbEl.innerHTML=Object.entries(methods).map(([m,v])=>{
        const pct=total>0?Math.round(v/total*100):0;
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${labels[m]||m}</span><span style="color:var(--gold)">${money(v)} (${pct}%)</span></div>
        <div style="height:5px;border-radius:3px;background:rgba(255,255,255,.06)"><div style="height:100%;width:${pct}%;border-radius:3px;background:var(--gold)"></div></div></div>`;
      }).join('');
    }
  },
  async assignDriver(orderId,driverId){
    if(!driverId) return;
    const d=DriverManage.drivers.find(x=>x.id===driverId); if(!d) return;
    const ok=await OrdersService.assignDriver(orderId,driverId,d.name);
    if(ok){ toast(`✓ ${d.name}-কে অ্যাসাইন করা হয়েছে`,'success'); await this.render(); }
  },
  async quickStatus(orderId,status){
    if(!status) return;
    const ok=await OrdersService.updateStatus(orderId,status);
    if(ok){ toast('✓ স্ট্যাটাস আপডেট','success'); await this.render(); }
  },
  tab(btn,name){
    ['overview','products','orders','analytics','drivers'].forEach(t=>{
      const el=document.getElementById('zm'+t.charAt(0).toUpperCase()+t.slice(1)+'Pane');
      if(el) el.style.display=t===name?'block':'none';
    });
    document.querySelectorAll('#page-zone-manager .zm-tabs button').forEach(a=>a.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(name==='products') this.renderProducts(ALL_PRODUCTS.filter(p=>p.zone===this.currentZone));
    if(name==='analytics') this.renderAnalytics(this._orders);
  },
  openAddProduct(){
    ProductForm.openAdd();
    ProductForm.renderZoneCheckboxes(this.currentZone, true);
  }
};window.ZoneManagerDash=ZoneManagerDash;

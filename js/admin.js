/* admin.js — AdminDash, ProductForm, OrderDetail, CouponManage (complete) */

const AdminDash = {
  _orders: [], _allOrders: [],

  orderTotal(order){
    const value = Number(order?.total ?? order?.payableTotal ?? order?.subtotal ?? 0);
    return Number.isFinite(value) ? value : 0;
  },

  async render({force=false}={}){
    const timeEl=document.getElementById('adminLastUpdated');
    if(timeEl) timeEl.textContent = '🕐 ' + new Date().toLocaleTimeString('bn-BD');
    const orders = await OrdersService.loadAll({force});
    this._orders = orders; this._allOrders = orders;
    await DriverManage.loadDrivers();

    const now = new Date();
    const todayStr = now.toDateString();
    const active = orders.filter(o=>o.status!=='cancelled');
    const sales = active.reduce((s,o)=>s+this.orderTotal(o),0);
    const todaySales = active.filter(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===todayStr).reduce((s,o)=>s+this.orderTotal(o),0);
    const pending = orders.filter(o=>['pending','confirmed'].includes(o.status)).length;
    const customers = [...new Set(orders.map(o=>o.customerPhone).filter(Boolean))];

    const st1=document.getElementById('aStatToday'); if(st1) st1.textContent = money(todaySales);
    const st2=document.getElementById('aStatGmv'); if(st2) st2.textContent = money(sales);
    const st3=document.getElementById('aStatOrders'); if(st3) st3.textContent = bn(orders.length);
    const st4=document.getElementById('aStatPending'); if(st4) st4.textContent = bn(pending);
    const st5=document.getElementById('aStatProducts'); if(st5) st5.textContent = bn(ALL_PRODUCTS.length);
    const st6=document.getElementById('aStatCustomers'); if(st6) st6.textContent = bn(customers.length);

    const cod = orders.filter(o=>o.paymentMethod==='cod'&&!['delivered','cancelled'].includes(o.status)).reduce((s,o)=>s+this.orderTotal(o),0);
    const online = orders.filter(o=>o.paymentMethod!=='cod').reduce((s,o)=>s+this.orderTotal(o),0);
    const fm=document.getElementById('fMonth'); if(fm) fm.textContent = money(sales);
    const fc=document.getElementById('fCod'); if(fc) fc.textContent = money(cod);
    const fo=document.getElementById('fOnline'); if(fo) fo.textContent = money(online);

    this.populateZoneFilters();
    this.renderBranches();
    if(!this._branchListenerBound){
      this._branchListenerBound = true;
      document.addEventListener('branches-updated', ()=>{
        this.populateZoneFilters();
        this.renderBranches();
        ProductForm.renderZoneCheckboxes();
      });
    }
    this.renderInventoryAlerts();
    this.renderRevenueChart(orders);
    this.renderRecentOrders(orders.slice(0,8));
    this.renderProducts();
    this.renderOrdersTable(orders);
    this.renderAnalytics(orders);
    this.renderCustomers(orders);
    DriverManage.renderTable();
    this.loadZmPins();
    this.renderDriverPerformance(orders);
    this.loadStoreSettings();
    this.startRealtimeListener();
  },

  async refresh(){ await this.render({force:true}); toast('✓ আপডেট হয়েছে','success'); },

  populateZoneFilters(){
    ['productZoneFilter','orderZoneFilter'].forEach(id=>{
      const sel = document.getElementById(id);
      if(!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">সব শাখা</option>' + Object.entries(BRANCH_INFO).map(([zid,info])=>`<option value="${zid}">${esc(info.label)}</option>`).join('');
      if(current && BRANCH_INFO[current]) sel.value = current;
    });
  },

  renderInventoryAlerts(){
    const low = ALL_PRODUCTS.filter(p=>p.stock >= 0 && p.stock <= 5);
    const alertEl = document.getElementById('inventoryAlerts');
    const listEl = document.getElementById('inventoryAlertList');
    const bannerEl = document.getElementById('lowStockBanner');
    if(!low.length){ if(alertEl) alertEl.style.display='none'; if(bannerEl) bannerEl.style.display='none'; return; }
    if(alertEl) alertEl.style.display='block';
    if(listEl) listEl.innerHTML = low.map(p=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(251,191,36,.1);font-size:12.5px">
        <span style="color:var(--ink)">${esc(p.name)}</span>
        <span style="${p.stock===0?'color:#f87171':'color:#fbbf24'};font-weight:600">${p.stock===0?'স্টক আউট':p.stock+' টি বাকি'}
          <a href="#" onclick="event.preventDefault();ProductForm.openEdit('${p.id}')" style="margin-left:8px;font-size:11px;color:var(--gold)">আপডেট করুন</a>
        </span>
      </div>`).join('');
    if(bannerEl){ bannerEl.style.display='block'; bannerEl.textContent = `⚠️ ${low.length}টি পণ্যের স্টক কম — স্টক আপডেট করুন`; }
  },

  renderRevenueChart(orders){
    const chartEl = document.getElementById('aRevenueChart');
    const labelsEl = document.getElementById('aRevenueChartLabels');
    if(!chartEl) return;
    const days = [];
    const now = new Date();
    for(let i=6;i>=0;i--){
      const d = new Date(now); d.setDate(d.getDate()-i);
      const ds = d.toDateString();
      const dayOrders = orders.filter(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===ds && o.status!=='cancelled');
      const revenue = dayOrders.reduce((s,o)=>s+this.orderTotal(o),0);
      const label = ['রবি','সোম','মঙ্গ','বুধ','বৃহ','শুক্র','শনি'][d.getDay()];
      days.push({revenue, label, isToday: i===0});
    }
    const max = Math.max(...days.map(d=>d.revenue), 1);
    const total = days.reduce((s,d)=>s+d.revenue,0);
    const tt=document.getElementById('aChart7Total'); if(tt) tt.textContent = 'মোট: '+money(total);
    chartEl.innerHTML = days.map(d=>{
      const pct = Math.max((d.revenue/max)*100, d.revenue>0?8:2);
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <span style="font-size:9px;color:var(--ink-muted)">${d.revenue>0?money(d.revenue):''}</span>
        <div style="width:100%;height:${pct}%;border-radius:4px 4px 0 0;background:${d.isToday?'var(--gold)':'rgba(212,175,55,.35)'};min-height:4px;transition:.3s"></div>
      </div>`;
    }).join('');
    if(labelsEl) labelsEl.innerHTML = days.map(d=>`<div style="flex:1;text-align:center;font-size:9.5px;color:${d.isToday?'var(--gold)':'var(--ink-muted)'}">${d.label}</div>`).join('');
  },

  renderRecentOrders(orders){
    const tbody = document.getElementById('aRecentOrders');
    if(!tbody) return;
    if(!orders.length){ tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:20px">কোনো অর্ডার নেই</td></tr>`; return; }
    tbody.innerHTML = orders.map(o=>{
      const s = ORDER_STATUS[o.status]||ORDER_STATUS.pending;
      return `<tr>
        <td style="font-size:11px">${o.orderNumber||o.id.slice(-6)}</td>
        <td>${esc(o.customerName)||'—'}<br><span style="font-size:10.5px;color:var(--ink-muted)">${esc(o.customerPhone)}</span></td>
        <td style="color:var(--gold)">${money(this.orderTotal(o))}</td>
        <td><span class="status-pill ${s.cls}">${s.label}</span></td>
        <td><a href="#" onclick="event.preventDefault();AdminDash.openOrderDetail('${o.id}')" style="color:var(--gold);font-size:11px;display:block;margin-bottom:4px">বিস্তারিত</a>
          <select onchange="AdminDash.quickStatus('${o.id}',this.value)" style="padding:3px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);font-size:11px">
            ${Object.entries(ORDER_STATUS).map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </td>
      </tr>`;
    }).join('');
  },

  renderProducts(){
    const tbody = document.getElementById('aProductsTable');
    if(!tbody) return;
    const search = document.getElementById('productSearch')?.value.toLowerCase()||'';
    const zoneFilter = document.getElementById('productZoneFilter')?.value||'';
    let list = search ? ALL_PRODUCTS.filter(p=>p.name.toLowerCase().includes(search)) : ALL_PRODUCTS.slice();
    if(zoneFilter) list = list.filter(p=>p.zone===zoneFilter);
    if(!list.length){ tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--ink-muted);padding:20px">কোনো প্রোডাক্ট নেই</td></tr>`; return; }

    // ⚠️ আগে ALL_PRODUCTS যে ক্রমে Firestore থেকে আসতো (মূলত এলোমেলো/insertion
    // order-এ) ঠিক সেভাবেই টেবিলে দেখানো হতো — একই ক্যাটাগরির পণ্য ছড়িয়ে-ছিটিয়ে
    // থাকতো। এখন প্রথমে ক্যাটাগরির বাংলা label অনুযায়ী, তারপর নাম অনুযায়ী sort করা
    // হচ্ছে — একই ক্যাটাগরির পণ্য সবসময় একসাথে গ্রুপ হয়ে দেখাবে।
    const catLabel = id => CATEGORIES.find(c=>c.id===id)?.label || id || '';
    list.sort((a,b)=>{
      const ca = catLabel(a.category), cb = catLabel(b.category);
      if(ca !== cb) return ca.localeCompare(cb, 'bn');
      return (a.name||'').localeCompare(b.name||'', 'bn');
    });

    let rows = '';
    let lastCat = null;
    for(const p of list){
      const cat = catLabel(p.category);
      if(cat !== lastCat){
        rows += `<tr class="admin-table-group-row"><td colspan="8" style="padding:10px 12px;font-weight:700;font-size:12px;color:var(--brand-700,var(--gold));background:var(--brand-50,rgba(179,25,91,.05))">${esc(cat)} <span style="font-weight:500;color:var(--ink-muted);font-size:11px">— ${bn(list.filter(x=>catLabel(x.category)===cat).length)}টি পণ্য</span></td></tr>`;
        lastCat = cat;
      }
      rows += `<tr style="${p.stock===0?'opacity:.6':''}">
      <td><input type="checkbox" class="prodCheck" value="${p.id}" ${this.selectedProducts.has(p.id)?'checked':''} onchange="AdminDash.toggleProductSelect('${p.id}',this.checked)" aria-label="${esc(p.name)} নির্বাচন"></td>
      <td><div style="width:38px;height:38px;border-radius:8px;overflow:hidden;background:var(--elevated)"><img src="${safeImgSrc(p.imageUrl||p.img)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" decoding="async" width="38" height="38"></div></td>
      <td><div style="font-size:12.5px;color:var(--ink);max-width:160px">${esc(p.name)}</div></td>
      <td>${AREA_LABELS[p.zone]||'—'}</td>
      <td><div style="color:var(--gold);font-weight:600">${money(p.salePrice)}</div>${p.price>p.salePrice?`<div style="font-size:10px;color:var(--ink-dim);text-decoration:line-through">${money(p.price)}</div>`:''}</td>
      <td><input type="number" value="${p.stock}" min="0" onchange="AdminDash.quickStockUpdate('${p.id}',this.value)" style="width:60px;padding:4px 6px;border-radius:6px;background:var(--bg2);border:1px solid ${p.stock<=5?'rgba(239,68,68,.4)':'var(--line)'};color:${p.stock===0?'#f87171':p.stock<=5?'#fbbf24':'var(--ink)'};font-size:12px;text-align:center"></td>
      <td><span class="status-pill ${p.stock>0?'delivered':'cancelled'}">${p.stock>0?'লাইভ':'স্টক আউট'}</span></td>
      <td style="display:flex;gap:6px">
        <a href="#" onclick="event.preventDefault();ProductForm.openEdit('${p.id}')" style="color:var(--gold);font-size:12px">এডিট</a>
        <a href="#" onclick="event.preventDefault();AdminDash.toggleProductStatus('${p.id}')" style="color:${p.status==='inactive'?'#22c55e':'#f87171'};font-size:12px">${p.status==='inactive'?'চালু':'বন্ধ'}</a>
      </td>
    </tr>`;
    }
    tbody.innerHTML = rows;
  },

  filterProducts(){ this.renderProducts(); },

  toggleSelectAllProducts(cb){
    const visible = [...document.querySelectorAll('.prodCheck')];
    visible.forEach(input=>{
      input.checked = cb.checked;
      if(cb.checked) this.selectedProducts.add(input.value);
      else this.selectedProducts.delete(input.value);
    });
    const bar = document.getElementById('productBulkBar');
    const count = document.getElementById('productBulkCount');
    if(this.selectedProducts.size){
      if(bar) bar.style.display='flex';
      if(count) count.textContent = `${this.selectedProducts.size}টি প্রোডাক্ট সিলেক্ট`;
    }else if(bar){
      bar.style.display='none';
    }
  },

  async quickStockUpdate(id, val){
    if(!FB) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'products',id), {stock: Number(val), updatedAt: FB.serverTimestamp()});
      const p = ALL_PRODUCTS.find(x=>x.id===id);
      if(p){ p.stock = Number(val); }
      this.renderInventoryAlerts();
      toast('✓ স্টক আপডেট হয়েছে','success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async toggleProductStatus(id){
    if(!FB) return;
    const p = ALL_PRODUCTS.find(x=>x.id===id); if(!p) return;
    const newStatus = p.status==='inactive' ? 'active' : 'inactive';
    try{
      await FB.updateDoc(FB.doc(FB.db,'products',id), {status:newStatus, updatedAt:FB.serverTimestamp()});
      p.status = newStatus;
      this.renderProducts();
      toast(`✓ প্রোডাক্ট ${newStatus==='active'?'সক্রিয়':'নিষ্ক্রিয়'} করা হয়েছে`,'success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  renderOrdersTable(orders){
    const tbody = document.getElementById('aOrdersTable');
    if(!tbody) return;
    const statusFilter = document.getElementById('orderStatusFilter')?.value||'';
    const zoneFilter = document.getElementById('orderZoneFilter')?.value||'';
    let list = orders;
    if(statusFilter) list = list.filter(o=>o.status===statusFilter);
    if(zoneFilter) list = list.filter(o=>o.branchZone===zoneFilter);
    if(!list.length){ tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;color:var(--ink-muted);padding:20px">কোনো অর্ডার নেই</td></tr>`; return; }
    tbody.innerHTML = list.map(o=>{
      const s = ORDER_STATUS[o.status]||ORDER_STATUS.pending;
      const zoneDrivers = DriverManage.drivers.filter(d=>d.branchZone===o.branchZone);
      const opts = zoneDrivers.map(d=>`<option value="${d.id}" ${o.driverId===d.id?'selected':''}>${d.name}</option>`).join('');
      const date = o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleDateString('bn-BD') : '—';
      return `<tr>
        <td><input type="checkbox" class="orderCheck" value="${o.id}" onchange="AdminDash.onCheckChange()"></td>
        <td style="font-size:11px;white-space:normal">${o.orderNumber||o.id.slice(-6)}</td>
        <td style="font-size:11px">${date}</td>
        <td>${esc(o.customerName)||'—'}</td>
        <td>${esc(o.customerPhone)||'—'}</td>
        <td style="color:var(--gold)">${money(this.orderTotal(o))}</td>
        <td><select onchange="AdminDash.assignDriver('${o.id}',this.value)" style="padding:3px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);font-size:11px;max-width:120px"><option value="">বেছে নিন</option>${opts}</select></td>
        <td><span class="status-pill ${s.cls}">${s.label}</span></td>
        <td><a href="#" onclick="event.preventDefault();AdminDash.openOrderDetail('${o.id}')" style="color:var(--gold);font-size:11px;display:block;margin-bottom:4px">বিস্তারিত</a>
          <select onchange="AdminDash.quickStatus('${o.id}',this.value)" style="padding:3px 6px;border-radius:6px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);font-size:11px">
            ${Object.entries(ORDER_STATUS).map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </td>
      </tr>`;
    }).join('');
    const sa=document.getElementById('selectAllOrders'); if(sa) sa.checked = false;
  },

  filterOrders(){
    const search = document.getElementById('orderSearch')?.value.toLowerCase()||'';
    let list = this._allOrders;
    if(search) list = list.filter(o=>
      (o.orderNumber||'').toLowerCase().includes(search) ||
      (o.customerName||'').toLowerCase().includes(search) ||
      (o.customerPhone||'').includes(search)
    );
    this.renderOrdersTable(list);
  },

  onCheckChange(){
    const checked = document.querySelectorAll('.orderCheck:checked');
    const bar = document.getElementById('bulkActionsBar');
    if(checked.length > 0){
      if(bar) bar.style.display='flex';
      const bc=document.getElementById('bulkCount'); if(bc) bc.textContent = `${checked.length}টি অর্ডার সিলেক্ট করা হয়েছে`;
    } else { if(bar) bar.style.display='none'; }
  },

  toggleSelectAll(cb){
    document.querySelectorAll('.orderCheck').forEach(c=>c.checked=cb.checked);
    this.onCheckChange();
  },

  async bulkUpdateStatus(){
    const status = document.getElementById('bulkStatusSelect').value;
    if(!status){ toast('স্ট্যাটাস বেছে নিন','error'); return; }
    const ids = [...document.querySelectorAll('.orderCheck:checked')].map(c=>c.value);
    if(!ids.length){ toast('কোনো অর্ডার সিলেক্ট নেই','error'); return; }
    let done = 0;
    for(const id of ids){
      const ok = await OrdersService.updateStatus(id, status);
      if(ok) done++;
    }
    toast(`✓ ${done}টি অর্ডার আপডেট হয়েছে`,'success');
    await this.render();
  },

  async exportOrders(){
    const ids = [...document.querySelectorAll('.orderCheck:checked')].map(c=>c.value);
    const list = ids.length > 0 ? this._allOrders.filter(o=>ids.includes(o.id)) : this._allOrders;
    toast('এক্সপোর্ট প্রস্তুত হচ্ছে…','info');
    // ⚠️ MT Studio audit fix (NID exposure): customerNid এখন আর মূল order
    // ডকুমেন্টে (this._allOrders-এ) থাকে না — orders/{id}/private/contact
    // subcollection-এ থাকে (শুধু admin/finance পড়তে পারে)। CSV export-এর
    // জন্য এখানে আলাদাভাবে fetch করা হচ্ছে — admin-চালিত, একবারের bulk
    // অ্যাকশন বলে এই খরচ গ্রহণযোগ্য।
    const nidByOrder = {};
    await Promise.all(list.map(async o=>{
      try{
        const snap = await FB.getDoc(FB.doc(FB.db,'orders',o.id,'private','contact'));
        nidByOrder[o.id] = snap.exists() ? (snap.data()?.nid||'') : '';
      }catch(e){ nidByOrder[o.id]=''; }
    }));
    const rows = [['অর্ডার ID','কাস্টমার','ফোন','NID','ঠিকানা','মোট','স্ট্যাটাস','তারিখ']];
    list.forEach(o=>{
      const date = o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleDateString('bn-BD') : '';
      rows.push([o.orderNumber||o.id,o.customerName||'',o.customerPhone||'',maskNid(nidByOrder[o.id]),o.address||'',this.orderTotal(o),ORDER_STATUS[o.status]?.label||'',date]);
    });
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `golapi-orders-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast(`✓ ${list.length}টি অর্ডার export হয়েছে`,'success');
  },

  async quickStatus(orderId, status){
    if(!status) return;
    const ok = await OrdersService.updateStatus(orderId, status);
    if(ok){ toast(`✓ স্ট্যাটাস আপডেট হয়েছে`,'success'); await this.render(); }
  },

  async assignDriver(orderId,driverId){
    if(!driverId) return;
    const d = DriverManage.drivers.find(x=>x.id===driverId); if(!d) return;
    const ok = await OrdersService.assignDriver(orderId,driverId,d.name);
    if(ok){ toast(`✓ ${d.name}-কে অ্যাসাইন করা হয়েছে`,'success'); await this.render(); }
  },

  renderAnalytics(orders){
    const active = orders.filter(o=>o.status!=='cancelled');
    const now = new Date();
    const todayStr = now.toDateString();
    const weekAgo = new Date(now-7*24*60*60*1000);
    const monthStart = new Date(now.getFullYear(),now.getMonth(),1);

    const todayRev = active.filter(o=>new Date(o.createdAt?.seconds*1000||0).toDateString()===todayStr).reduce((s,o)=>s+this.orderTotal(o),0);
    const weekRev = active.filter(o=>new Date(o.createdAt?.seconds*1000||0)>=weekAgo).reduce((s,o)=>s+this.orderTotal(o),0);
    const monthRev = active.filter(o=>new Date(o.createdAt?.seconds*1000||0)>=monthStart).reduce((s,o)=>s+this.orderTotal(o),0);
    const total = active.reduce((s,o)=>s+this.orderTotal(o),0);

    ['anToday','anWeek','anMonth','anTotal'].forEach((id,i)=>{
      const el=document.getElementById(id);
      if(el) el.textContent=money([todayRev,weekRev,monthRev,total][i]);
    });

    const pbEl = document.getElementById('paymentBreakdown');
    if(pbEl){
      const methods = {};
      active.forEach(o=>{ const m=o.paymentMethod||'cod'; methods[m]=(methods[m]||0)+this.orderTotal(o); });
      const labels = {cod:'💰 COD',bkash:'📱 bKash',nagad:'📱 Nagad'};
      pbEl.innerHTML = Object.entries(methods).map(([m,v])=>{
        const pct = total>0?Math.round(v/total*100):0;
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>${labels[m]||m}</span><span style="color:var(--gold)">${money(v)} (${pct}%)</span></div><div style="height:6px;border-radius:3px;background:rgba(255,255,255,.06)"><div style="height:100%;width:${pct}%;border-radius:3px;background:var(--gold);transition:.5s"></div></div></div>`;
      }).join('');
    }

    const zbEl = document.getElementById('zoneBreakdown');
    if(zbEl){
      const zones = {};
      active.forEach(o=>{ const z=o.branchZone||'unknown'; zones[z]=(zones[z]||0)+this.orderTotal(o); });
      zbEl.innerHTML = Object.entries(zones).map(([z,v])=>{
        const pct = total>0?Math.round(v/total*100):0;
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>${AREA_LABELS[z]||z}</span><span style="color:var(--rose)">${money(v)} (${pct}%)</span></div><div style="height:6px;border-radius:3px;background:rgba(255,255,255,.06)"><div style="height:100%;width:${pct}%;border-radius:3px;background:var(--rose);transition:.5s"></div></div></div>`;
      }).join('');
    }

    const tpEl = document.getElementById('topProducts');
    if(tpEl){
      const productSales = {};
      active.forEach(o=>(o.items||[]).forEach(item=>{
        productSales[item.productId]=(productSales[item.productId]||0)+item.qty;
      }));
      const sorted = Object.entries(productSales).sort((a,b)=>b[1]-a[1]).slice(0,5);
      tpEl.innerHTML = sorted.length ? sorted.map(([id,qty],i)=>{
        const p = ALL_PRODUCTS.find(x=>x.id===id);
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)"><span style="width:20px;text-align:center;font-weight:700;color:var(--gold);font-size:13px">${i+1}</span><div style="width:32px;height:32px;border-radius:6px;overflow:hidden"><img src="${safeImgSrc(p?.imageUrl||p?.img)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" decoding="async" width="32" height="32"></div><div style="flex:1;min-width:0"><div style="font-size:12.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p?.name)||id}</div></div><span style="font-size:12px;color:var(--ink-muted)">${qty} বিক্রি</span></div>`;
      }).join('') : '<p style="color:var(--ink-muted);font-size:13px">তথ্য নেই</p>';
    }
  },

  renderCustomers(orders){
    const tbody = document.getElementById('aCustomersTable');
    if(!tbody) return;
    const customers = {};
    orders.forEach(o=>{
      const phone = o.customerPhone||'';
      if(!phone) return;
      if(!customers[phone]){
        customers[phone] = {name:o.customerName||'—', phone, orders:[], total:0, lastDate:null};
      }
      customers[phone].orders.push(o);
      customers[phone].total += this.orderTotal(o);
      const d = o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000) : null;
      if(d && (!customers[phone].lastDate || d > customers[phone].lastDate)) customers[phone].lastDate = d;
    });

    const search = document.getElementById('customerSearch')?.value.toLowerCase()||'';
    let list = Object.values(customers);
    if(search) list = list.filter(c=>c.name.toLowerCase().includes(search)||c.phone.includes(search));
    list.sort((a,b)=>b.total-a.total);

    if(!list.length){ tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:20px">কোনো কাস্টমার নেই</td></tr>`; return; }
    // ⚠️ MT Studio audit fix (NID exposure): customerNid এখন আর মূল order
    // ডকুমেন্টে থাকে না, তাই এখানে bulk-এ কোনো NID লোড/দেখানো হয় না। প্রতিটি
    // সারিতে শুধু একটা "দেখুন" বাটন থাকে — ক্লিক করলে toggleCustomerNid()
    // সেই নির্দিষ্ট কাস্টমারের NID শুধু তখনই admin/finance-only
    // orders/{id}/private/contact subcollection থেকে fetch করে।
    tbody.innerHTML = list.map(c=>`<tr>
      <td>${c.name}</td>
      <td>${esc(c.phone)}</td>
      <td class="nid-cell" style="font-size:11.5px;cursor:pointer" data-phone="${esc(c.phone)}" onclick="AdminDash.toggleCustomerNid(this)" title="ক্লিক করে NID দেখুন/লুকান">NID দেখুন</td>
      <td style="text-align:center">${c.orders.length}</td>
      <td style="color:var(--gold)">${money(c.total)}</td>
      <td style="font-size:11px">${c.lastDate?c.lastDate.toLocaleDateString('bn-BD'):'—'}</td>
      <td><a href="#" onclick="event.preventDefault();AdminDash.showCustomerOrders('${c.phone}')" style="color:var(--gold);font-size:12px">অর্ডার দেখুন</a></td>
    </tr>`).join('');
  },

  filterCustomers(){ this.renderCustomers(this._allOrders); },

  // ⚠️ MT Studio audit fix (NID exposure): লেজি-লোড + টগল — প্রথম ক্লিকে
  // Firestore থেকে fetch করে আসল NID দেখায়, দ্বিতীয় ক্লিকে আবার মাস্ক করে।
  // পরের ক্লিকগুলোতে আর নতুন করে fetch করে না (dataset-এ cache থাকে)।
  async toggleCustomerNid(el){
    if(el.dataset.revealed==='1'){ el.textContent = el.dataset.masked||'NID দেখুন'; el.dataset.revealed='0'; return; }
    if(el.dataset.nid===undefined){
      el.textContent = 'লোড হচ্ছে…';
      const phone = el.dataset.phone;
      const orders = (this._allOrders||[]).filter(o=>o.customerPhone===phone);
      let nid = null;
      for(const o of orders){
        try{
          const snap = await FB.getDoc(FB.doc(FB.db,'orders',o.id,'private','contact'));
          if(snap.exists() && snap.data()?.nid){ nid = snap.data().nid; break; }
        }catch(e){}
      }
      el.dataset.nid = nid || '';
      el.dataset.masked = nid ? maskNid(nid) : '—';
    }
    if(!el.dataset.nid){ el.textContent = el.dataset.masked; return; }
    el.textContent = el.dataset.nid;
    el.dataset.revealed = '1';
  },

  async showCustomerOrders(phone){
    const orders = this._allOrders.filter(o=>o.customerPhone===phone);
    if(!orders.length) return;
    const c = orders[0];
    const cn=document.getElementById('coCustomerName'); if(cn) cn.textContent = c.customerName||'—';
    const cp=document.getElementById('coCustomerPhone');
    if(cp) cp.textContent = `📞 ${phone} | NID: লোড হচ্ছে… | মোট: ${money(orders.reduce((s,o)=>s+this.orderTotal(o),0))}`;
    const listEl = document.getElementById('coOrdersList');
    if(listEl) listEl.innerHTML = orders.map(o=>{
      const s=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
      const date=o.createdAt?.seconds?new Date(o.createdAt.seconds*1000).toLocaleDateString('bn-BD'):'—';
      return `<div style="padding:12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--gold)">${o.orderNumber||o.id.slice(-6)}</span><span class="status-pill ${s.cls}">${s.label}</span></div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-muted)"><span>${date}</span><span style="color:var(--gold);font-weight:600">${money(this.orderTotal(o))}</span></div><div style="margin-top:6px"><a href="#" onclick="event.preventDefault();document.getElementById('customerOrdersModal').classList.remove('show');OrderDetail.open(${JSON.stringify(o).replace(/"/g,'&quot;')})" style="font-size:12px;color:var(--gold)">বিস্তারিত দেখুন →</a></div></div>`;
    }).join('');
    document.getElementById('customerOrdersModal').classList.add('show');
    // ⚠️ MT Studio audit fix (NID exposure): admin/finance-only subcollection
    // থেকে lazy-fetch করে সামারি লাইনে বসানো হচ্ছে — মূল order ডকুমেন্টে NID নেই।
    let nid = null;
    for(const o of orders){
      try{
        const snap = await FB.getDoc(FB.doc(FB.db,'orders',o.id,'private','contact'));
        if(snap.exists() && snap.data()?.nid){ nid = snap.data().nid; break; }
      }catch(e){}
    }
    if(cp) cp.textContent = `📞 ${phone} | NID: ${maskNid(nid)} | মোট: ${money(orders.reduce((s,o)=>s+this.orderTotal(o),0))}`;
  },

  openOrderDetail(orderId){
    const o = this._allOrders.find(x=>x.id===orderId); if(o) OrderDetail.open(o);
  },

  _listener:null,
  startRealtimeListener(){
    if(!FB || this._listener) return;
    let initialized = false;
    this._listener = FB.onSnapshot(
      FB.query(FB.collection(FB.db,'orders'), FB.orderBy('createdAt','desc'), FB.limit(1)),
      (snap) => {
        if(!initialized){ initialized=true; return; }
        snap.docChanges().forEach(change=>{
          if(change.type==='added'){
            const o = {id:change.doc.id,...change.doc.data()};
            AdminDash.showNewOrderAlert(o);
            AdminDash.render();
          }
        });
      }
    );
  },

  showNewOrderAlert(order){
    const bell = document.getElementById('adminNotifBell');
    if(bell){
      const count = parseInt(bell.dataset.count||0)+1;
      bell.dataset.count = count;
      bell.textContent = `🔔 ${count}`;
      bell.style.display='inline-block';
    }
    toast(`🚨 নতুন অর্ডার! ${order.customerName||'কাস্টমার'} — ${money(this.orderTotal(order))}`,'success');
    try{
      const ctx = new(window.AudioContext||window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880,ctx.currentTime);
      osc.frequency.setValueAtTime(660,ctx.currentTime+0.1);
      gain.gain.setValueAtTime(0.3,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.3);
    }catch(e){}
  },

  renderDriverPerformance(orders){
    const el = document.getElementById('driverPerformanceTable');
    if(!el) return;
    const stats = {};
    orders.forEach(o=>{
      if(!o.driverId) return;
      if(!stats[o.driverId]) stats[o.driverId] = {name:o.driverName||'—',total:0,delivered:0,cancelled:0,revenue:0};
      stats[o.driverId].total++;
      if(o.status==='delivered'){ stats[o.driverId].delivered++; stats[o.driverId].revenue+=this.orderTotal(o); }
      if(o.status==='cancelled') stats[o.driverId].cancelled++;
    });
    const list = Object.values(stats).sort((a,b)=>b.delivered-a.delivered);
    if(!list.length){ el.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:16px">তথ্য নেই</td></tr>'; return; }
    el.innerHTML = list.map(d=>{
      const rate = d.total>0?Math.round(d.delivered/d.total*100):0;
      return `<tr><td style="color:var(--ink);font-weight:600">${d.name}</td><td style="text-align:center">${d.total}</td><td style="text-align:center;color:#22c55e">${d.delivered}</td><td style="text-align:center"><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.06)"><div style="height:100%;width:${rate}%;border-radius:3px;background:${rate>=80?'#22c55e':rate>=50?'#fbbf24':'#f87171'}"></div></div><span style="font-size:11px;color:var(--ink-muted)">${rate}%</span></div></td><td style="color:var(--gold)">${money(d.revenue)}</td></tr>`;
    }).join('');
  },

  selectedProducts: new Set(),

  toggleProductSelect(id, checked){
    checked ? this.selectedProducts.add(id) : this.selectedProducts.delete(id);
    const visible = [...document.querySelectorAll('.prodCheck')];
    const selectAll = document.getElementById('selectAllProducts');
    if(selectAll){
      selectAll.checked = visible.length > 0 && visible.every(input=>input.checked);
      selectAll.indeterminate = visible.some(input=>input.checked) && !selectAll.checked;
    }
    const bar = document.getElementById('productBulkBar');
    const count = document.getElementById('productBulkCount');
    if(this.selectedProducts.size > 0){ if(bar) bar.style.display='flex'; if(count) count.textContent = `${this.selectedProducts.size}টি প্রোডাক্ট সিলেক্ট`; }
    else { if(bar) bar.style.display='none'; }
  },

  async bulkDeleteProducts(){
    if(!this.selectedProducts.size){ toast('কোনো প্রোডাক্ট সিলেক্ট নেই','error'); return; }
    if(!confirm(`${this.selectedProducts.size}টি প্রোডাক্ট মুছে ফেলবেন?`)) return;
    if(!FB) return;
    let done=0;
    for(const id of this.selectedProducts){
      try{ await FB.deleteDoc(FB.doc(FB.db,'products',id)); done++; }catch(e){ devWarn(e.message); }
    }
    this.selectedProducts.clear();
    await ProductStore.refreshAndRerender();
    this.renderProducts();
    const bar=document.getElementById('productBulkBar'); if(bar) bar.style.display='none';
    toast(`✓ ${done}টি প্রোডাক্ট মুছে ফেলা হয়েছে`,'success');
  },

  async bulkUpdatePrice(){
    const pct = parseFloat(prompt('মূল্য কত % পরিবর্তন করবেন? (+ বাড়াতে, - কমাতে, যেমন: 10 বা -5)'));
    if(isNaN(pct)) return;
    if(!FB) return;
    let done=0;
    for(const id of this.selectedProducts){
      const p = ALL_PRODUCTS.find(x=>x.id===id); if(!p) continue;
      const newPrice = Math.round(p.salePrice*(1+pct/100));
      try{
        await FB.updateDoc(FB.doc(FB.db,'products',id),{salePrice:newPrice,updatedAt:FB.serverTimestamp()});
        p.salePrice=newPrice; done++;
      }catch(e){ devWarn(e.message); }
    }
    this.selectedProducts.clear();
    this.renderProducts();
    const bar=document.getElementById('productBulkBar'); if(bar) bar.style.display='none';
    toast(`✓ ${done}টি প্রোডাক্টের মূল্য ${pct>0?'+':''}${pct}% আপডেট হয়েছে`,'success');
  },

  renderAnalyticsWithDateRange(){
    const from = document.getElementById('anDateFrom')?.value;
    const to = document.getElementById('anDateTo')?.value;
    let orders = this._allOrders;
    if(from) orders = orders.filter(o=>new Date(o.createdAt?.seconds*1000||0)>=new Date(from));
    if(to) orders = orders.filter(o=>new Date(o.createdAt?.seconds*1000||0)<=new Date(to+'T23:59:59'));
    this.renderAnalytics(orders);
    if(from && to){
      const fromD=new Date(from), toD=new Date(to+'T23:59:59');
      const diff=toD-fromD;
      const prevFrom=new Date(fromD-diff), prevTo=new Date(fromD-1);
      const prevOrders=this._allOrders.filter(o=>{
        const d=new Date(o.createdAt?.seconds*1000||0);
        return d>=prevFrom && d<=prevTo && o.status!=='cancelled';
      });
      const currRev=orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+this.orderTotal(o),0);
      const prevRev=prevOrders.reduce((s,o)=>s+this.orderTotal(o),0);
      const trendEl=document.getElementById('anTrend');
      if(trendEl && prevRev>0){
        const pct=Math.round((currRev-prevRev)/prevRev*100);
        trendEl.innerHTML=`আগের সময়ের তুলনায়: <strong style="color:${pct>=0?'#22c55e':'#f87171'}">${pct>=0?'↑':'↓'} ${Math.abs(pct)}%</strong>`;
      }
    }
  },

  async saveOrderNote(orderId){
    const note = document.getElementById('odNoteInput')?.value.trim();
    if(!note||!FB) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'orders',orderId),{adminNote:note,noteUpdatedAt:FB.serverTimestamp()});
      toast('✓ নোট সংরক্ষণ হয়েছে','success');
      const ns=document.getElementById('odNoteStatus'); if(ns) ns.textContent='✓ সংরক্ষিত';
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async loadStoreSettings(){
    if(!FB) return;
    try{
      const snap=await FB.getDoc(FB.doc(FB.db,'setting','store'));
      const d=snap.exists()?snap.data():{};
      const fields=['storeAnnouncement','storeHours','deliveryMin','deliveryMax','expressCharge'];
      fields.forEach(f=>{ const el=document.getElementById('ss_'+f); if(el) el.value=d[f]||''; });
    }catch(e){ devWarn(e.message); }
  },

  async saveStoreSettings(){
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }
    try{
      const data={};
      ['storeAnnouncement','storeHours','deliveryMin','deliveryMax','expressCharge'].forEach(f=>{
        const el=document.getElementById('ss_'+f); if(el) data[f]=el.value.trim();
      });
      await FB.setDoc(FB.doc(FB.db,'setting','store'),{...data,updatedAt:FB.serverTimestamp()});
      toast('✓ স্টোর সেটিংস সংরক্ষণ হয়েছে','success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async loadZmPins(){
    if(!FB) return;
    try{
      const snap = await FB.getDoc(FB.doc(FB.db,'setting','zone_manager_pins'));
      const pins = snap.exists()? snap.data() : {};
      const s = document.getElementById('zmPinSadar'); if(s) s.value=pins.noakhali_sadar||'';
      const b = document.getElementById('zmPinBegumganj'); if(b) b.value=pins.begumganj||'';
      const c = document.getElementById('zmPinZoneC'); if(c) c.value=pins.zone_c||'';
    }catch(e){ devWarn(e.message); }
  },

  async loadDeliverySettings(){
    if(!FB) return;
    try{
      const snap = await FB.getDoc(FB.doc(FB.db,'setting','delivery'));
      const d = snap.exists() ? snap.data() : DELIVERY_SETTINGS;
      const map = {ds_baseFee:'baseFee', ds_perKmFee:'perKmFee', ds_perItemFee:'perItemFee', ds_freeAboveSubtotal:'freeAboveSubtotal', ds_deliveryRadiusKm:'deliveryRadiusKm', ds_maxDistanceKm:'maxDistanceKm'};
      Object.entries(map).forEach(([elId,key])=>{ const el=document.getElementById(elId); if(el) el.value = d[key] ?? DELIVERY_SETTINGS[key] ?? ''; });
    }catch(e){ devWarn('delivery settings load failed', e.message); }
  },

  async saveDeliverySettings(){
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }
    try{
      const map = {ds_baseFee:'baseFee', ds_perKmFee:'perKmFee', ds_perItemFee:'perItemFee', ds_freeAboveSubtotal:'freeAboveSubtotal', ds_deliveryRadiusKm:'deliveryRadiusKm', ds_maxDistanceKm:'maxDistanceKm'};
      const data = {};
      Object.entries(map).forEach(([elId,key])=>{ const el=document.getElementById(elId); if(el) data[key]=Number(el.value)||0; });
      await FB.setDoc(FB.doc(FB.db,'setting','delivery'), {...data, updatedAt:FB.serverTimestamp()});
      // লাইভ অ্যাপ্লাই করা — পেজ রিফ্রেশ ছাড়াই এখন থেকে নতুন মূল্য ব্যবহার হবে
      Object.assign(DELIVERY_SETTINGS, data);
      toast('✓ ডেলিভারি প্রাইসিং সংরক্ষণ ও সাথে সাথে চালু হয়েছে','success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  loadDeliveryZonesEditor(){
    const box = document.getElementById('zoneEditorBox');
    if(!box) return;
    box.innerHTML = Object.entries(DELIVERY_ZONES).map(([branchId, zones])=>{
      const branchLabel = BRANCH_INFO[branchId]?.label || branchId;
      return `<div style="margin-bottom:14px">
        <div style="font-size:12.5px;font-weight:700;color:var(--gold);margin-bottom:8px">${branchLabel}</div>
        ${zones.map(z=>`
          <div style="display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:8px;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;color:var(--ink-soft)">${z.label}</span>
            <input type="number" id="zn_${z.id}_radius" value="${z.radiusKm}" min="0" step="0.5" placeholder="কিমি" style="padding:7px 9px;border-radius:8px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);font-size:12px">
            <input type="number" id="zn_${z.id}_fee" value="${z.fee}" min="0" placeholder="৳ চার্জ" style="padding:7px 9px;border-radius:8px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);font-size:12px">
          </div>`).join('')}
      </div>`;
    }).join('') + `<div style="font-size:10.5px;color:var(--ink-dim);display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:8px;margin-top:-4px"><span></span><span>radius (কিমি)</span><span>চার্জ (৳)</span></div>`;
  },

  async saveDeliveryZones(){
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }
    try{
      const updated = {};
      Object.entries(DELIVERY_ZONES).forEach(([branchId, zones])=>{
        updated[branchId] = zones.map(z=>{
          const radiusEl = document.getElementById(`zn_${z.id}_radius`);
          const feeEl = document.getElementById(`zn_${z.id}_fee`);
          return { ...z, radiusKm: Number(radiusEl?.value)||z.radiusKm, fee: Number(feeEl?.value)||z.fee };
        });
      });
      await FB.setDoc(FB.doc(FB.db,'setting','delivery_zones'), { zones: updated, updatedAt: FB.serverTimestamp() });
      Object.assign(DELIVERY_ZONES, updated);
      toast('✓ ডেলিভারি জোন সংরক্ষণ ও সাথে সাথে চালু হয়েছে','success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  /* ⚠️ generateImageVariants() নতুন আপলোডের সময়ই শুধু কাজ করতো, আগে থেকে
     থাকা প্রোডাক্টের ছবি কখনো ছোঁয়া হতো না। এই ফাংশন সব পুরনো প্রোডাক্ট
     একে একে (rate-limit এড়াতে ছোট বিরতি দিয়ে) reprocess করে — একই ছোট
     সাইজ + blur placeholder logic ব্যবহার করে, শুধু ইনপুট আসে existing
     imageUrl থেকে fetch করে (নতুন ফাইল আপলোড ছাড়াই)। */
  async reprocessAllProductImages(){
    const btn = document.getElementById('reprocessImagesBtn');
    const progressEl = document.getElementById('reprocessProgress');
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }
    if(!confirm('এতে কয়েক মিনিট সময় লাগতে পারে এবং প্রতিটা প্রোডাক্টের জন্য নতুন ছবি Storage-এ আপলোড হবে। এগোতে চাও?')) return;

    btn.disabled = true; btn.textContent = 'শুরু হচ্ছে...';
    progressEl.style.display = 'block';

    try{
      const snap = await FB.getDocs(FB.collection(FB.db, 'products'));
      const targets = [];
      snap.forEach(d => {
        const data = d.data();
        if(data.imageUrl && (!data.imageUrlSmall || !data.imageBlurDataUrl)) targets.push({ id: d.id, data });
      });

      if(targets.length === 0){
        progressEl.textContent = '✓ সব প্রোডাক্টের ছবি ইতিমধ্যেই আপডেটেড আছে।';
        btn.disabled = false; btn.textContent = 'সব পুরনো প্রোডাক্টের ছবি আপডেট করুন';
        return;
      }

      let done = 0, failed = 0;
      for(const t of targets){
        progressEl.textContent = `প্রসেস হচ্ছে... (${done + failed + 1}/${targets.length}) — ${esc(t.data.name || t.id)}`;
        try{
          // CORS-নিরাপদভাবে ছবি fetch করে Blob বানানো (canvas taint সমস্যা এড়াতে <img> এর বদলে fetch ব্যবহার)
          const resp = await fetch(t.data.imageUrl);
          if(!resp.ok) throw new Error('ছবি fetch ব্যর্থ');
          const originalBlob = await resp.blob();

          const variants = await this.generateImageVariants(originalBlob);
          const updates = {};
          if(variants.smallBlob){
            const ext1 = variants.smallBlob.type === 'image/avif' ? 'avif' : 'webp';
            const smallRef = FB.storageRef(FB.storage, `products/${t.id}_${Date.now()}_small.${ext1}`);
            await FB.uploadBytes(smallRef, variants.smallBlob);
            updates.imageUrlSmall = await FB.getDownloadURL(smallRef);
          }
          if(variants.blurDataUrl) updates.imageBlurDataUrl = variants.blurDataUrl;

          if(Object.keys(updates).length > 0){
            await FB.updateDoc(FB.doc(FB.db, 'products', t.id), updates);
          }
          done++;
        }catch(e){
          devWarn('reprocess failed for', t.id, e.message);
          failed++;
        }
        await new Promise(r => setTimeout(r, 400)); // Firebase-এ চাপ কমাতে ছোট বিরতি
      }

      progressEl.textContent = `✓ শেষ হয়েছে — ${done}টা সফল, ${failed}টা ব্যর্থ (মোট ${targets.length}টার মধ্যে)।`;
      toast(`✓ ছবি reprocess সম্পন্ন — ${done}/${targets.length}`, 'success');
    }catch(e){
      progressEl.textContent = '⚠ ব্যর্থ: ' + e.message;
      toast('⚠ সমস্যা হয়েছে: ' + e.message, 'error');
    }finally{
      btn.disabled = false; btn.textContent = 'সব পুরনো প্রোডাক্টের ছবি আপডেট করুন';
    }
  },

  async fillMissingDescriptions(){
    const btn = document.getElementById('fillDescBtn');
    const progressEl = document.getElementById('fillDescProgress');
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }

    btn.disabled = true; btn.textContent = 'শুরু হচ্ছে...';
    progressEl.style.display = 'block';

    try{
      const snap = await FB.getDocs(FB.collection(FB.db, 'products'));
      const targets = [];
      snap.forEach(d => {
        const data = d.data();
        if(!data.description || !data.description.trim()) targets.push({ id: d.id, data });
      });

      if(targets.length === 0){
        progressEl.textContent = '✓ সব প্রোডাক্টেই ইতিমধ্যে বিবরণ আছে।';
        btn.disabled = false; btn.textContent = 'খালি বিবরণগুলো পূরণ করুন';
        return;
      }

      let done = 0, failed = 0;
      for(const t of targets){
        progressEl.textContent = `প্রসেস হচ্ছে... (${done + failed + 1}/${targets.length}) — ${esc(t.data.name || t.id)}`;
        try{
          const catObj = (typeof CATEGORIES !== 'undefined') ? CATEGORIES.find(c=>c.id===t.data.category) : null;
          const catLabel = catObj ? catObj.label : (t.data.category || '');
          const userMsg = `তুমি একটি বাংলাদেশি ই-কমার্স দোকানের জন্য পণ্যের বিবরণ লিখবে। পণ্যের নাম: "${t.data.name || 'পণ্য'}", ক্যাটাগরি: "${catLabel}". সংক্ষিপ্ত, আকর্ষণীয় বাংলা বিবরণ লিখো (৩-৫ লাইন)। শুধু বিবরণের টেক্সট-টুকুই ফেরত দাও — কোনো ভূমিকা, ব্যাখ্যা, quotation mark, বা markdown formatting (** বা #) ছাড়া।`;
          const res = await fetch(ChatWidget.workerUrl,{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({model:'claude-sonnet-4-6', max_tokens:300, messages:[{role:'user', content:userMsg}]})
          });
          const data = await res.json();
          let text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
          text = text
            .replace(/^\s*(এখানে|নিশ্চয়ই|অবশ্যই)[^:।\n]{0,40}[:।]\s*/i, '')
            .replace(/\*\*/g, '')
            .replace(/^["'"]+|["'"]+$/g, '')
            .trim();
          if(text){
            await FB.updateDoc(FB.doc(FB.db, 'products', t.id), { description: text });
            done++;
          } else {
            failed++;
          }
        }catch(e){
          devWarn('description fill failed for', t.id, e.message);
          failed++;
        }
        await new Promise(r => setTimeout(r, 600)); // AI/Firebase-এ চাপ কমাতে ছোট বিরতি
      }

      progressEl.textContent = `✓ শেষ হয়েছে — ${done}টা সফল, ${failed}টা ব্যর্থ (মোট ${targets.length}টার মধ্যে)।`;
      toast(`✓ বিবরণ পূরণ সম্পন্ন — ${done}/${targets.length}`, 'success');
    }catch(e){
      progressEl.textContent = '⚠ ব্যর্থ: ' + e.message;
      toast('⚠ সমস্যা হয়েছে: ' + e.message, 'error');
    }finally{
      btn.disabled = false; btn.textContent = 'খালি বিবরণগুলো পূরণ করুন';
    }
  },

  generateSitemap(){
    const BASE = 'https://www.golapishop.online';
    const today = new Date().toISOString().split('T')[0];
    const urls = [];
    // স্ট্যাটিক পাবলিক পেজ
    const staticPaths = ['/', '/medical', '/custom-bazar', '/contact', '/about', '/terms', '/privacy'];
    staticPaths.forEach(p => urls.push({ loc: BASE+p, priority: p==='/' ? '1.0' : '0.7' }));
    // ক্যাটাগরি পেজ
    CATEGORIES.forEach(c => urls.push({ loc: `${BASE}/category/${c.id}`, priority: '0.6' }));
    // লাইভ প্রোডাক্ট (Firestore থেকে যা এখন ব্রাউজারে লোড আছে)
    if(!ALL_PRODUCTS.length){
      toast('⚠ প্রোডাক্ট এখনো লোড হয়নি — একটু পর আবার চেষ্টা করো','error');
      return;
    }
    ALL_PRODUCTS.forEach(p => urls.push({ loc: `${BASE}/product/${p.id}`, priority: '0.8' }));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
      `\n</urlset>`;

    const box = document.getElementById('sitemapOutput');
    box.value = xml;
    box.style.display = 'block';
    document.getElementById('sitemapCopyBtn').style.display = 'block';
    toast(`✓ ${urls.length}টা URL সহ sitemap তৈরি হয়েছে — এখন কপি করে GitHub-এ আপলোড করো`, 'success');
  },
  copySitemap(){
    const box = document.getElementById('sitemapOutput');
    box.select();
    document.execCommand('copy');
    toast('✓ কপি হয়েছে — এখন GitHub-এ sitemap.xml ফাইলে পেস্ট করো','success');
  },

  async saveZmPins(){
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }
    try{
      await FB.setDoc(FB.doc(FB.db,'setting','zone_manager_pins'),{
        noakhali_sadar: document.getElementById('zmPinSadar').value.trim(),
        begumganj: document.getElementById('zmPinBegumganj').value.trim(),
        zone_c: document.getElementById('zmPinZoneC')?.value.trim() || ''
      });
      toast('✓ পিন সংরক্ষণ করা হয়েছে','success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },
  
  tab(btn,name){
    ['overview','products','orders','analytics','customers','coupons','payments','settings','finance','employees','branches'].forEach(t=>{
      const el = document.getElementById('admin'+t.charAt(0).toUpperCase()+t.slice(1)+'Pane');
      if(el) el.style.display = t===name?'block':'none';
    });
    document.querySelectorAll('#page-admin-dash .dash-side a').forEach(a=>a.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(name==='products') this.renderProducts();
    if(name==='analytics') this.renderAnalytics(this._allOrders);
    if(name==='customers') this.renderCustomers(this._allOrders);
    if(name==='coupons') CouponManage.render();
    if(name==='payments') PaymentVerify.render();
    if(name==='employees' && typeof EmployeeManagement!=='undefined') EmployeeManagement.load();
    if(name==='branches') this.renderBranches();
    if(name==='settings'){ this.loadStoreSettings(); this.loadZmPins(); this.loadDeliverySettings(); this.loadDeliveryZonesEditor(); }
  },

  /* ---------- Branch/Zone Management — নতুন শাখা যোগ হলে সাথে সাথে
     পুরো সাইটে (product form, filter dropdown, delivery zone editor) reflect হয়,
     কোনো কোড পরিবর্তন বা ডিপ্লয় লাগে না */
  _branchEditId: null,

  renderBranches(){
    const tbody = document.getElementById('aBranchesTable');
    if(!tbody) return;
    const entries = Object.entries(BRANCH_INFO);
    tbody.innerHTML = entries.map(([id,info])=>`<tr>
      <td>${esc(info.label)}</td>
      <td style="font-size:11.5px;color:var(--ink-muted)">${esc(info.address||'—')}</td>
      <td>${esc(info.managerName||'—')}</td>
      <td style="font-size:11.5px">${esc(info.managerPhone||'—')}</td>
      <td style="display:flex;gap:10px">
        <a href="#" onclick="event.preventDefault();AdminDash.editBranchStart('${id}')" style="color:var(--gold);font-size:12px">এডিট</a>
        <a href="#" onclick="event.preventDefault();AdminDash.deleteBranch('${id}')" style="color:#f87171;font-size:12px">মুছুন</a>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink-muted);padding:16px">কোনো শাখা নেই</td></tr>';
  },

  openAddBranch(){
    this._branchEditId = null;
    const t=document.getElementById('brFormTitle'); if(t) t.textContent='🆕 নতুন শাখা যোগ করুন';
    ['brId','brLabel','brAddress','brManagerName','brManagerPhone','brBkash','brNagad','brLat','brLng'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    const idEl=document.getElementById('brId'); if(idEl) idEl.disabled=false;
    const m=document.getElementById('brMsg'); if(m) m.className='form-msg';
  },

  editBranchStart(id){
    const info = BRANCH_INFO[id]; if(!info) return;
    this._branchEditId = id;
    const t=document.getElementById('brFormTitle'); if(t) t.textContent='✏️ শাখা সম্পাদনা করুন — '+info.label;
    const set=(elId,val)=>{const el=document.getElementById(elId); if(el) el.value=val??'';};
    set('brId', id); const idEl=document.getElementById('brId'); if(idEl) idEl.disabled=true;
    set('brLabel', info.label); set('brAddress', info.address); set('brManagerName', info.managerName);
    set('brManagerPhone', info.managerPhone); set('brBkash', info.bkashNumber); set('brNagad', info.nagadNumber);
    set('brLat', info.lat); set('brLng', info.lng);
    const m=document.getElementById('brMsg'); if(m) m.className='form-msg';
    window.scrollTo({top:0,behavior:'smooth'});
  },

  async saveBranch(){
    const msgEl=document.getElementById('brMsg');
    const rawId = document.getElementById('brId')?.value.trim()||'';
    const label = document.getElementById('brLabel')?.value.trim()||'';
    if(!rawId || !label){ msgEl.textContent='শাখা আইডি ও নাম আবশ্যক'; msgEl.className='form-msg err'; return; }
    const branchId = this._branchEditId || rawId.toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');
    if(!branchId){ msgEl.textContent='সঠিক শাখা আইডি দিন (শুধু ইংরেজি অক্ষর/সংখ্যা/আন্ডারস্কোর)'; msgEl.className='form-msg err'; return; }
    if(!this._branchEditId && BRANCH_INFO[branchId]){ msgEl.textContent='এই আইডি আগে থেকেই আছে, অন্য আইডি দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    const data = {
      label,
      address: document.getElementById('brAddress')?.value.trim()||'',
      managerName: document.getElementById('brManagerName')?.value.trim()||'',
      managerPhone: document.getElementById('brManagerPhone')?.value.trim()||'',
      bkashNumber: document.getElementById('brBkash')?.value.trim()||'',
      nagadNumber: document.getElementById('brNagad')?.value.trim()||'',
      lat: Number(document.getElementById('brLat')?.value)||0,
      lng: Number(document.getElementById('brLng')?.value)||0
    };
    try{
      const snap = await FB.getDoc(FB.doc(FB.db,'setting','branches'));
      const branches = snap.exists() ? {...snap.data().branches} : {};
      branches[branchId] = data;
      await FB.setDoc(FB.doc(FB.db,'setting','branches'), {branches, updatedAt:FB.serverTimestamp()}, {merge:true});
      BRANCH_INFO[branchId] = data;
      AREA_LABELS[branchId] = data.label;

      // নতুন শাখায় ডিফল্ট Zone A/B/C — আগে থেকে না থাকলেই যোগ হবে, existing branch edit-এ ছোঁয়া হয় না
      if(!DELIVERY_ZONES[branchId]){
        DELIVERY_ZONES[branchId] = [
          { id:`${branchId}_a`, label:'Zone A — কাছাকাছি এলাকা', radiusKm:3, fee:30 },
          { id:`${branchId}_b`, label:'Zone B — মাঝারি দূরত্ব', radiusKm:7, fee:50 },
          { id:`${branchId}_c`, label:'Zone C — দূরবর্তী এলাকা', radiusKm:12, fee:80 }
        ];
        const dzSnap = await FB.getDoc(FB.doc(FB.db,'setting','delivery_zones'));
        const dzData = dzSnap.exists() ? {...dzSnap.data().zones} : {};
        dzData[branchId] = DELIVERY_ZONES[branchId];
        await FB.setDoc(FB.doc(FB.db,'setting','delivery_zones'), {zones:dzData, updatedAt:FB.serverTimestamp()}, {merge:true});
      }

      msgEl.textContent='✓ শাখা সংরক্ষণ হয়েছে এবং সাথে সাথে সাইটে চালু হয়েছে'; msgEl.className='form-msg ok';
      this.renderBranches();
      this.populateZoneFilters();
      this.loadDeliveryZonesEditor();
      ProductForm.renderZoneCheckboxes();
      document.dispatchEvent(new Event('branches-updated'));
    }catch(e){ msgEl.textContent='সমস্যা: '+e.message; msgEl.className='form-msg err'; }
  },

  async deleteBranch(id){
    const info = BRANCH_INFO[id]; if(!info) return;
    if(!confirm(`"${info.label}" শাখা মুছে ফেলতে চান? এই শাখার আগের প্রোডাক্ট/অর্ডার ডিলিট হবে না, কিন্তু নতুন ড্রপডাউন/ফর্মে আর দেখাবে না।`)) return;
    if(!FB) return;
    try{
      const remaining = {...BRANCH_INFO}; delete remaining[id];
      await FB.setDoc(FB.doc(FB.db,'setting','branches'), {branches:remaining, updatedAt:FB.serverTimestamp()}, {merge:true});
      delete BRANCH_INFO[id]; delete AREA_LABELS[id];
      toast('✓ শাখা মুছে ফেলা হয়েছে','success');
      this.renderBranches();
      this.populateZoneFilters();
      ProductForm.renderZoneCheckboxes();
      document.dispatchEvent(new Event('branches-updated'));
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  }
};

/* ---------- Product Form ---------- */
const ProductForm = {
  mode:'add', editId:null, imgBase64:null,
  processedBlob: null,

  /* ---------- Auto Category Detection ---------- */
  categoryTouched: false,

  CATEGORY_KEYWORDS: {
    medicine: ['প্যারাসিটামল','নাপা','এন্টাসিড','ট্যাবলেট','ক্যাপসুল','সিরাপ','ইনজেকশন','মলম','ওরস্যালাইন','ঔষধ','মেডিসিন','এন্টিবায়োটিক','ফ্লাজিল','এলাট্রল','ভিটামিন','ব্যান্ডেজ','থার্মোমিটার','মাস্ক','স্যাভলন','ডেটল'],
    rice_pulses: ['চাল','মিনিকেট','নাজিরশাইল','বাসমতি','আটাশ','স্বর্ণা','ডাল','মসুর','মুগ','ছোলা','মাসকলাই','বুটের ডাল'],
    spices: ['মরিচের গুঁড়া','হলুদ','জিরা','ধনিয়া','এলাচ','দারুচিনি','লবঙ্গ','গরম মসলা','মসলা','আদা','রসুন','তেজপাতা','মেথি'],
    edible_oil: ['সয়াবিন তেল','সরিষার তেল','ভোজ্য তেল','রাইস ব্রান','অলিভ অয়েল','ঘি','নারিকেল তেল'],
    fish_meat: ['ইলিশ','রুই','কাতলা','চিংড়ি','মুরগি','গরুর মাংস','খাসির মাংস','মাংস','ব্রয়লার','পাঙ্গাস','তেলাপিয়া','মাছ'],
    vegetables: ['আলু','পেঁয়াজ','টমেটো','বেগুন','শসা','কাঁচা মরিচ','লাউ','কুমড়া','ফুলকপি','বাঁধাকপি','লেবু','আম','কলা','আপেল','কমলা','পেয়ারা','সবজি','ফল'],
    dairy_bakery: ['দুধ','ডানো','মার্কস','পাউডার দুধ','দই','পনির','মাখন','পাউরুটি','কেক','ব্রেড'],
    frozen_food: ['ফ্রোজেন','নাগেট','পরোটা','সমুচা','আইসক্রিম'],
    snacks: ['চিপস','চানাচুর','মুড়ি','বিস্কুট','নুডুলস','প্রাণ চানাচুর'],
    beverages: ['জুস','কোমল পানীয়','কোল্ড ড্রিংক','মিনারেল ওয়াটার','চা পাতা','কফি','ড্রিংক','হরলিক্স'],
    confectionery: ['চকলেট','চকোলেট','ক্যান্ডি','লজেন্স','টফি'],
    stationery: ['কলম','খাতা','পেন্সিল','রাবার','স্কেল','নোটবুক','মার্কার'],
    gas: ['গ্যাস সিলিন্ডার','সিলিন্ডার','এলপিজি','বসুন্ধরা গ্যাস','যমুনা গ্যাস'],
    mobile: ['মোবাইল চার্জার','ইয়ারফোন','হেডফোন','পাওয়ার ব্যাংক','স্ক্রিন প্রটেক্টর','মোবাইল কভার','সিম','মেমোরি কার্ড'],
    electronics: ['ইলেকট্রনিক্স','ফ্যান','লাইট','বাল্ব','মাল্টিপ্লাগ','এক্সটেনশন','চার্জার লাইট','আয়রন'],
    watch: ['ঘড়ি','সেল ব্যাটারি','wristwatch'],
    personal_care: ['শ্যাম্পু','সাবান','পারফিউম','বডি স্প্রে','টুথপেস্ট','টুথব্রাশ','ক্রিম','লোশন','শেভিং','স্যানিটারি ন্যাপকিন','স্যানিটারি প্যাড','ন্যাপকিন','সেনোরা','হুইস্পার','ফ্রেশ ন্যাপকিন','চুলের তেল','হেয়ার অয়েল'],
    cosmetics: ['লিপস্টিক','ফাউন্ডেশন','মেকআপ','কাজল','কসমেটিক্স','নেইল পলিশ'],
    clothing: ['শাড়ি','পাঞ্জাবি','শার্ট','প্যান্ট','থ্রি পিস','জামা','লুঙ্গি','গেঞ্জি'],
    footwear: ['জুতা','স্যান্ডেল','স্লিপার','সু'],
    jewelry: ['গহনা','চুড়ি','কানের দুল','নেকলেস','রিং','গলার হার'],
    furniture: ['চেয়ার','টেবিল','সোফা','খাট','আলমারি','ফার্নিচার'],
    kitchen_tools: ['হাঁড়ি','পাতিল','প্লেট','গ্লাস','চামচ','কড়াই','রান্নাঘর'],
    toys: ['খেলনা','পুতুল','খেলনা গাড়ি'],
    baby_care: ['ডায়াপার','বেবি','ফিডার','শিশুর'],
    home_care: ['ডিটারজেন্ট','সাবান পাউডার','ব্লিচ','ফিনাইল','ক্লিনার','হারপিক'],
    pet_care: ['পোষা প্রাণী','ক্যাট ফুড','ডগ ফুড'],
    sports_fitness: ['জিম','ফিটনেস','ফুটবল','ক্রিকেট ব্যাট'],
    books_gifts: ['বই','উপহার','গিফট'],
    religious: ['টুপি','জায়নামাজ','তসবিহ','আতর'],
    automobile: ['হেলমেট','মোটরসাইকেল','বাইক পার্টস'],
    garden: ['গাছের চারা','সার','বীজ','টব'],
    grocery: ['মুদি','লবণ','চিনি']
  },

  guessCategory(name){
    if(!name || !name.trim()) return null;
    const n = name.trim().toLowerCase();
    // ⚠️ আগে যে category dictionary-তে আগে ছিল (object-এর insertion order) সেটার
    // যেকোনো keyword match পেলেই সাথে সাথে সেটাই রিটার্ন হতো — ফলে একটা ছোট/সাধারণ
    // keyword অন্য কোনো কম-প্রাসঙ্গিক category-তে আগে থেকে থাকলে ভুল category
    // বেছে নিতো। এখন সব category/keyword-এর মধ্যে থেকে সবচেয়ে লম্বা (সবচেয়ে
    // নির্দিষ্ট/specific) matching keyword-টাই জেতে, কোন category আগে declare
    // হয়েছে সেটা আর গুরুত্বপূর্ণ না।
    let best = null, bestLen = 0;
    for(const [catId, keywords] of Object.entries(this.CATEGORY_KEYWORDS)){
      for(const kw of keywords){
        const kwLower = kw.toLowerCase();
        if(n.includes(kwLower) && kwLower.length > bestLen){
          best = catId; bestLen = kwLower.length;
        }
      }
    }
    return best;
  },

  autoDetectCategory(name){
    if(this.categoryTouched) return;
    const guess = this.guessCategory(name);
    if(guess){
      const sel = document.getElementById('pfCategory');
      if(sel && sel.value !== guess){
        sel.value = guess;
        sel.style.transition = 'background .4s';
        sel.style.background = 'rgba(212,175,55,.15)';
        setTimeout(()=>{ sel.style.background = ''; }, 500);
      }
    }
  },

  /* ছবির ভেতরেই Golapi Shop সিল বসিয়ে দেয় (Canvas দিয়ে), আসল ফাইলেই স্থায়ীভাবে থাকবে */
  compositeSeal(file){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = ()=>{
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = ()=>{
          const sealSize = Math.round(canvas.width * 0.14);
          const margin = Math.round(canvas.width * 0.03);
          const cx = canvas.width - margin - sealSize/2;
          const cy = canvas.height - margin - sealSize/2;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, sealSize/2 + 3, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(5,8,16,0.55)';
          ctx.fill();
          ctx.lineWidth = Math.max(2, sealSize*0.05);
          ctx.strokeStyle = '#D4AF37';
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, sealSize/2, 0, Math.PI*2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(logo, cx-sealSize/2, cy-sealSize/2, sealSize, sealSize);
          ctx.restore();

          URL.revokeObjectURL(url);
          canvas.toBlob(blob=>resolve(blob), 'image/webp', 0.9);
        };
        logo.onerror = ()=>{ URL.revokeObjectURL(url); canvas.toBlob(blob=>resolve(blob), 'image/webp', 0.9); };
        logo.src = 'icons/head_logo.webp';
      };
      img.onerror = reject;
      img.src = url;
    });
  },

  /* ⚠️ আগে সব কাস্টমার সবসময় original-size ছবিই ডাউনলোড করতো, ছোট মোবাইল স্ক্রিনেও।
     এখন main ছবি থেকেই canvas দিয়ে (কোনো বাইরের সার্ভিস ছাড়াই) দুটো অতিরিক্ত ভার্সন
     বানানো হয়: (১) ছোট 400px সংস্করণ (srcset-এ ব্যবহারের জন্য), (২) একটা ২৪px
     "blur placeholder" (base64 data URI, ছবি লোড হওয়ার আগে ঝাপসা প্রিভিউ দেখাতে,
     স্লো নেটওয়ার্কে ফাঁকা বক্সের বদলে)। */
  async generateImageVariants(mainBlob){
    const img = new Image();
    const url = URL.createObjectURL(mainBlob);
    try{
      await new Promise((resolve, reject)=>{ img.onload = resolve; img.onerror = reject; img.src = url; });

      /* ⚠️ AVIF, WebP-এর চেয়েও ছোট ফাইল দেয় — যেসব ব্রাউজার/ডিভাইস থেকে এই
         অ্যাডমিন প্যানেল ব্যবহার হচ্ছে সেখানে canvas AVIF এনকোডিং সাপোর্ট করলে
         সেটাই ব্যবহার হবে। কিন্তু canvas.toBlob() না-সাপোর্টেড format-এর জন্য
         চুপচাপ PNG ফেরত দেয় (স্পেসিফিকেশন অনুযায়ী) — তাই blob.type চেক করে
         নিশ্চিত হওয়া হচ্ছে সত্যিই AVIF হয়েছে কিনা, নইলে WebP-তে ফিরে যাওয়া হয়। */
      const makeVariant = (size, quality) => new Promise(resolve => {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        c.toBlob(async avifBlob => {
          if(avifBlob && avifBlob.type === 'image/avif'){ resolve(avifBlob); return; }
          c.toBlob(webpBlob => resolve(webpBlob), 'image/webp', quality);
        }, 'image/avif', quality);
      });

      const smallBlob = await makeVariant(400, 0.82);

      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = 24; blurCanvas.height = 24;
      blurCanvas.getContext('2d').drawImage(img, 0, 0, 24, 24);
      const blurDataUrl = blurCanvas.toDataURL('image/jpeg', 0.5);

      return { smallBlob, blurDataUrl };
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  async onImageSelect(input){
    const file = input.files[0]; if(!file) return;
    const prev=document.getElementById('pfImgPreview');
    const thumb=document.getElementById('pfImgThumb');
    if(thumb) thumb.style.opacity='.4';
    try{
      // ⚠️ আগে এখানে this.compositeSeal(file) দিয়ে ছবির ভেতরেই স্থায়ীভাবে
      // Golapi Shop-এর গোল লোগো/সিল বসিয়ে দেওয়া হতো (canvas দিয়ে pixel-এ বার্ন করা,
      // পরে আর সরানো যেতো না)। এখন request অনুযায়ী সেটা বাদ দেওয়া হলো — মূল ছবিই
      // (কোনো ওয়াটারমার্ক ছাড়া) আপলোড হবে।
      this.processedBlob = file;
      const previewUrl = URL.createObjectURL(file);
      if(thumb){ thumb.src = previewUrl; thumb.style.opacity='1'; }
      if(prev) prev.style.display = 'block';
      const ai=document.getElementById('pfDescAiBtn'); if(ai) ai.style.display = 'inline-block';
      const name = document.getElementById('pfName')?.value.trim();
      if(name) this.generateDesc();
    }catch(e){
      devWarn('image select failed', e.message);
      this.processedBlob = file;
      const reader = new FileReader();
      reader.onload = ev => { if(thumb){ thumb.src = ev.target.result; thumb.style.opacity='1'; } if(prev) prev.style.display='block'; };
      reader.readAsDataURL(file);
    }
  },
  maybeAutoGenerate(){
    const name = document.getElementById('pfName')?.value.trim();
    const hasImg = document.getElementById('pfImgFile')?.files.length > 0;
    const descEmpty = !document.getElementById('pfDescription')?.value.trim();
    if(name && hasImg && descEmpty) this.generateDesc();
  },
  async generateDesc(){
    const name = document.getElementById('pfName').value.trim();
    const catId = document.getElementById('pfCategory').value;
    // ⚠️ আগে raw category ID (যেমন 'rice_pulses', 'gas', 'watch') সরাসরি AI
    // prompt-এ পাঠানো হতো — এটা মানুষের ভাষায় না হওয়ায় AI মাঝেমধ্যে ভুল/অপ্রাসঙ্গিক
    // প্রসঙ্গ ধরে নিতো। এখন CATEGORIES তালিকা থেকে আসল বাংলা label বের করে পাঠানো হয়।
    const catObj = (typeof CATEGORIES !== 'undefined') ? CATEGORIES.find(c=>c.id===catId) : null;
    const cat = catObj ? catObj.label : catId;
    const loadEl = document.getElementById('pfDescLoading');
    const descEl = document.getElementById('pfDescription');
    if(loadEl) loadEl.style.display = 'block';
    const aiBtn=document.getElementById('pfDescAiBtn'); if(aiBtn) aiBtn.style.display = 'none';
    try{
      const userMsg = `তুমি একটি বাংলাদেশি ই-কমার্স দোকানের জন্য পণ্যের বিবরণ লিখবে। পণ্যের নাম: "${name || 'পণ্য'}", ক্যাটাগরি: "${cat}". সংক্ষিপ্ত, আকর্ষণীয় বাংলা বিবরণ লিখো (৩-৫ লাইন)। শুধু বিবরণের টেক্সট-টুকুই ফেরত দাও — কোনো ভূমিকা, ব্যাখ্যা, quotation mark, বা markdown formatting (** বা #) ছাড়া।`;
      /* ⚠️ Anthropic API browser থেকে সরাসরি কল করা যায় না (CORS + API key ব্রাউজারে expose হয়ে যায়) —
         তাই ChatWidget-এর মতোই একই Cloudflare Worker proxy ব্যবহার করা হচ্ছে, যেটা ইতিমধ্যে কাজ করছে */
      const res = await fetch(ChatWidget.workerUrl,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-6', max_tokens:300, messages:[{role:'user', content:userMsg}]})
      });
      const data = await res.json();
      let text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      // ⚠️ আগে AI-এর raw output হুবহু বসিয়ে দেওয়া হতো — কখনো কখনো তার শুরুতে
      // "এখানে বিবরণ:" জাতীয় ভূমিকা, বা **markdown** bold, বা চারপাশে quotation
      // mark থেকে যেতো। এখন সেগুলো ছেঁটে ফেলা হয়, শুধু আসল বিবরণটুকু সেভ হয়।
      text = text
        .replace(/^\s*(এখানে|নিশ্চয়ই|অবশ্যই)[^:।\n]{0,40}[:।]\s*/i, '')
        .replace(/\*\*/g, '')
        .replace(/^["'"]+|["'"]+$/g, '')
        .trim();
      if(text && descEl) descEl.value = text;
      else toast('বিবরণ তৈরি হয়নি','error');
    }catch(e){ toast('AI সংযোগ সমস্যা','error'); devWarn('generateDesc failed', e.message); }
    finally{ if(loadEl) loadEl.style.display='none'; if(aiBtn) aiBtn.style.display='inline-block'; }
  },
  openAdd(){
    this.mode='add'; this.editId=null; this.imgBase64=null;
    this.categoryTouched = false;
    const t=document.getElementById('pfTitle'); if(t) t.textContent='নতুন প্রোডাক্ট যুক্ত করুন';
    const b=document.getElementById('pfSubmitBtn'); if(b) b.textContent='প্রোডাক্ট সংরক্ষণ করুন';
    ['pfName','pfPrice','pfSalePrice','pfStock','pfDescription','pfCostPrice'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    const f=document.getElementById('pfImgFile'); if(f) f.value='';
    this.processedBlob = null;
    const p=document.getElementById('pfImgPreview'); if(p) p.style.display='none';
    const ai=document.getElementById('pfDescAiBtn'); if(ai) ai.style.display='none';
    const ec=document.getElementById('pfExtraCost'); if(ec) ec.value='0';
    const dp=document.getElementById('pfDeliveryPercent'); if(dp) dp.value='0';
    const pp=document.getElementById('pfProfitPercent'); if(pp) pp.value='5';
    const bd=document.getElementById('pfBreakdown'); if(bd) bd.textContent='৳0';
    this.renderZoneCheckboxes();
    const c=document.getElementById('pfCategory'); if(c) c.value='grocery';
    const u=document.getElementById('pfUnit'); if(u) u.value='পিস';
    const cd=document.getElementById('pfCod'); if(cd) cd.checked=false;
    const fl=document.getElementById('pfFlash'); if(fl) fl.checked=false;
    const ft=document.getElementById('pfFeatured'); if(ft) ft.checked=false;
    const m=document.getElementById('pfMsg'); if(m) m.className='form-msg';
    document.getElementById('productModal').classList.add('show');
  },
  renderZoneCheckboxes(selectedZone, allDisabled){
    const box = document.getElementById('pfZoneCheckboxes');
    if(!box) return;
    box.innerHTML = Object.entries(BRANCH_INFO).map(([id,info])=>{
      const checked = selectedZone ? (id===selectedZone) : true;
      return `<label class="filter-opt"><input type="checkbox" class="pfZoneCb" value="${id}" ${checked?'checked':''} ${allDisabled?'disabled':''}> ${esc(info.label)}</label>`;
    }).join('') || '<span style="font-size:12px;color:var(--ink-muted)">কোনো শাখা নেই — আগে "🏢 শাখা ব্যবস্থাপনা" থেকে একটা শাখা যোগ করুন</span>';
  },
  recalc(){
    const cost=Number(bnDigitsToEn(document.getElementById('pfCostPrice')?.value))||0;
    const extra=Number(bnDigitsToEn(document.getElementById('pfExtraCost')?.value))||0;
    const profp=Number(bnDigitsToEn(document.getElementById('pfProfitPercent')?.value))||0;
    const base=cost+extra;
    // ⚠️ আগে এখানে deliveryPercent-ও যোগ হতো, ফলে প্রোডাক্টের দামের ভেতরেই
    // ডেলিভারি খরচ ঢুকে যেতো — অথচ checkout-এ ডেলিভারি চার্জ আলাদাভাবে নেওয়া
    // হয়, তাই কাস্টমার কার্যত দুইবার ডেলিভারি চার্জ দিতো। এখন শুধু cost+extra
    // -এর উপর profit % যোগ হয়ে দাম হিসাব হয়।
    const final = Math.round(base + base*profp/100);
    const bd=document.getElementById('pfBreakdown'); if(bd) bd.textContent = `৳${cost}+৳${extra} → +${profp}% লাভ = ৳${final}`;
    if(cost>0){
      const sp=document.getElementById('pfSalePrice'); if(sp) sp.value = final;
      const pf=document.getElementById('pfPrice'); if(pf && !pf.value) pf.value = Math.round(final*1.1);
    }
  },
  openEdit(id){
    const p = ALL_PRODUCTS.find(x=>x.id===id); if(!p){ toast('প্রোডাক্ট পাওয়া যায়নি','error'); return; }
    this.mode='edit'; this.editId=id;
    this.categoryTouched = true;
    const t=document.getElementById('pfTitle'); if(t) t.textContent='প্রোডাক্ট সম্পাদনা করুন';
    const b=document.getElementById('pfSubmitBtn'); if(b) b.textContent='পরিবর্তন সংরক্ষণ করুন';
    const n=document.getElementById('pfName'); if(n) n.value=p.name;
    this.renderZoneCheckboxes(p.zone, true);
    const c=document.getElementById('pfCategory'); if(c) c.value=p.category;
    const u=document.getElementById('pfUnit'); if(u) u.value=p.unit;
    const pr=document.getElementById('pfPrice'); if(pr) pr.value=p.price;
    const sp=document.getElementById('pfSalePrice'); if(sp) sp.value=p.salePrice;
    const s=document.getElementById('pfStock'); if(s) s.value=p.stock;
    const cp=document.getElementById('pfCostPrice'); if(cp) cp.value=p.costPrice||'';
    const ec=document.getElementById('pfExtraCost'); if(ec) ec.value=p.extraCost||0;
    const dp=document.getElementById('pfDeliveryPercent'); if(dp) dp.value=p.deliveryPercent||0; // hidden legacy field, no longer editable/shown
    const pp=document.getElementById('pfProfitPercent'); if(pp) pp.value=p.profitPercent||5;
    const bd=document.getElementById('pfBreakdown');
    if(bd) bd.textContent = p.costPrice ? `৳${p.costPrice}+৳${p.extraCost||0} → +${p.profitPercent||5}% লাভ = ৳${p.salePrice}` : '৳0';
    const d=document.getElementById('pfDescription'); if(d) d.value=p.description||'';
    const cd=document.getElementById('pfCod'); if(cd) cd.checked=!!p.cod;
    const fl=document.getElementById('pfFlash'); if(fl) fl.checked=!!p.isFlash;
    const ft=document.getElementById('pfFeatured'); if(ft) ft.checked=!!p.isFeatured;
    const m=document.getElementById('pfMsg'); if(m) m.className='form-msg';
    document.getElementById('productModal').classList.add('show');
  },
  close(){ document.getElementById('productModal').classList.remove('show'); },
  async submit(){
    const msgEl=document.getElementById('pfMsg');
    const name=document.getElementById('pfName').value.trim();
    const selZones=[...document.querySelectorAll('.pfZoneCb:checked')].map(cb=>cb.value);
    const category=document.getElementById('pfCategory').value, unit=document.getElementById('pfUnit').value;
    const price=Number(bnDigitsToEn(document.getElementById('pfPrice').value)), salePrice=Number(bnDigitsToEn(document.getElementById('pfSalePrice').value)), stock=Number(bnDigitsToEn(document.getElementById('pfStock').value));
    const description=document.getElementById('pfDescription').value.trim();
    const cod=document.getElementById('pfCod').checked, isFlash=document.getElementById('pfFlash').checked, isFeatured=document.getElementById('pfFeatured').checked;
    const costPrice=Number(bnDigitsToEn(document.getElementById('pfCostPrice').value))||0, extraCost=Number(bnDigitsToEn(document.getElementById('pfExtraCost').value))||0;
    const deliveryPercent=Number(bnDigitsToEn(document.getElementById('pfDeliveryPercent').value))||0, profitPercent=Number(bnDigitsToEn(document.getElementById('pfProfitPercent').value))||0;
    if(!name||!salePrice||stock===''){ msgEl.textContent='সব প্রয়োজনীয় তথ্য পূরণ করুন'; msgEl.className='form-msg err'; return; }
    if(!selZones.length){ msgEl.textContent='অন্তত একটা শাখা বেছে নিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা — Firebase কনফিগার নেই'; msgEl.className='form-msg err'; return; }
    const btn=document.getElementById('pfSubmitBtn'); const orig=btn.textContent; btn.textContent='সংরক্ষণ হচ্ছে...'; btn.disabled=true;
    try{
      let imageUrl = null, imageUrlSmall = null, imageBlurDataUrl = null;
      const imgFile = document.getElementById('pfImgFile').files[0];
      if(imgFile){
        const uploadBlob = this.processedBlob || imgFile;
        const fileRef = FB.storageRef(FB.storage, `products/${Date.now()}_sealed.webp`);
        await FB.uploadBytes(fileRef, uploadBlob);
        imageUrl = await FB.getDownloadURL(fileRef);

        // ছোট সংস্করণ + blur placeholder — ব্যর্থ হলেও মূল ছবি সেভ হওয়া আটকাবে না
        try{
          const variants = await this.generateImageVariants(uploadBlob);
          if(variants.smallBlob){
            const ext2 = variants.smallBlob.type === 'image/avif' ? 'avif' : 'webp';
          const smallRef = FB.storageRef(FB.storage, `products/${Date.now()}_small.${ext2}`);
            await FB.uploadBytes(smallRef, variants.smallBlob);
            imageUrlSmall = await FB.getDownloadURL(smallRef);
          }
          imageBlurDataUrl = variants.blurDataUrl || null;
        }catch(e){ devWarn('image variant generation failed', e.message); }
      }
      const base = {name,category,unit,price:price||salePrice,salePrice,stock,description,costPrice,extraCost,deliveryPercent,profitPercent,cod,isFlash,isFeatured,status:'active',updatedAt:FB.serverTimestamp()};
      if(imageUrl) base.imageUrl = imageUrl;
      if(imageUrlSmall) base.imageUrlSmall = imageUrlSmall;
      if(imageBlurDataUrl) base.imageBlurDataUrl = imageBlurDataUrl;
      if(this.mode==='add'){
        const groupId = selZones.length>1 ? `${Date.now()}` : null;
        for(const zone of selZones){
          const data = {...base, zone, createdAt:FB.serverTimestamp(), rating:'৫.০', reviews:0, sold:0, fastDelivery:true};
          if(groupId) data.groupId = groupId;
          await FB.addDoc(FB.collection(FB.db,'products'), data);
        }
        msgEl.textContent = selZones.length>1 ? '✓ দুই শাখাতেই যুক্ত হয়েছে' : '✓ প্রোডাক্ট যুক্ত হয়েছে'; msgEl.className='form-msg ok';
      }else{
        await FB.updateDoc(FB.doc(FB.db,'products',this.editId), {...base, zone:selZones[0]});
        msgEl.textContent='✓ প্রোডাক্ট আপডেট হয়েছে'; msgEl.className='form-msg ok';
      }
      await ProductStore.refreshAndRerender();
      // ⚠️ আগে সরাসরি "ZoneManagerDash.currentZone" চেক করা হতো — কিন্তু Owner
      // Dashboard পেজে zone-manager.js লোডই হয় না, তাই ওই variable অস্তিত্বহীন
      // থাকায় "Can't find variable: ZoneManagerDash" এরর দিয়ে পুরো save/refresh
      // ধাপ ভেঙে যেতো (যদিও প্রোডাক্ট আসলে সফলভাবে সেভ হয়ে গিয়েছিল)। এখন
      // typeof দিয়ে নিরাপদে চেক করা হচ্ছে।
      if(typeof ZoneManagerDash !== 'undefined' && ZoneManagerDash.currentZone){
        ZoneManagerDash.render();
      }else{
        AdminDash.renderProducts();
        const sp=document.getElementById('aStatProducts'); if(sp) sp.textContent=bn(ALL_PRODUCTS.length);
      }
      setTimeout(()=>this.close(),900);
    }catch(e){ msgEl.textContent='সমস্যা হয়েছে: '+e.message; msgEl.className='form-msg err'; }
    finally{ btn.textContent=orig; btn.disabled=false; }
  }
};

/* ---------- Order Detail ---------- */
const OrderDetail = {
  current: null,
  open(order){
    this.current = order;
    const s = ORDER_STATUS[order.status]||ORDER_STATUS.pending;
    document.getElementById('odOrderNum').textContent = order.orderNumber||order.id;
    document.getElementById('odDate').textContent = order.createdAt?.seconds ? new Date(order.createdAt.seconds*1000).toLocaleString('bn-BD') : '—';
    const statusEl = document.getElementById('odStatus');
    statusEl.textContent = s.label; statusEl.className = 'status-pill '+s.cls;
    document.getElementById('odName').textContent = order.customerName||'—';
    document.getElementById('odPhone').textContent = order.customerPhone||'—';
    const odNidEl = document.getElementById('odNid');
    if(odNidEl){
      // ⚠️ MT Studio audit fix (NID exposure): customerNid এখন আর মূল order
      // ডকুমেন্টে থাকে না — orders/{id}/private/contact subcollection-এ,
      // শুধু admin/finance পড়তে পারে (rules)। অন্য staff role (support,
      // zone_manager ইত্যাদি) এই মডাল খুললে permission-denied পাবে, যেটা
      // এখানে চুপচাপ ধরে "দেখা যাচ্ছে না" দেখানো হয় — error throw হয় না।
      odNidEl.textContent = 'লোড হচ্ছে…';
      odNidEl.style.cursor = 'default';
      odNidEl.title = '';
      odNidEl.onclick = null;
      FB.getDoc(FB.doc(FB.db,'orders',order.id,'private','contact')).then(snap=>{
        if(this.current!==order) return; // ইতিমধ্যে অন্য অর্ডার খোলা হয়েছে
        const nid = snap.exists() ? snap.data()?.nid : null;
        odNidEl.textContent = nid ? maskNid(nid) : 'দেওয়া হয়নি';
        odNidEl.style.cursor = nid ? 'pointer' : 'default';
        odNidEl.title = nid ? 'ক্লিক করে সম্পূর্ণ NID দেখুন/লুকান' : '';
        odNidEl.onclick = nid ? function(){ this.textContent = this.textContent.includes('•') ? nid : maskNid(nid); } : null;
      }).catch(()=>{ odNidEl.textContent = 'দেখার অনুমতি নেই'; odNidEl.style.cursor='default'; odNidEl.title=''; odNidEl.onclick=null; });
    }
    document.getElementById('odPayment').textContent = {cod:'💰 COD',bkash:'📱 bKash',nagad:'📱 Nagad'}[order.paymentMethod]||order.paymentMethod||'COD';
    document.getElementById('odAddress').innerHTML = `<strong style="color:var(--ink)">${esc(order.village)||''}</strong>${order.village?', ':''}<br>${esc(AREA_LABELS[order.branchZone])||''} — ${esc(order.address)||''}`;
    document.getElementById('odInstructions').textContent = '💬 ' + (order.instructions||'কোনো বিশেষ নির্দেশনা নেই');
    const itemsEl = document.getElementById('odItems');
    const items = order.items||[];
    itemsEl.innerHTML = items.map(item=>{
      const p = ALL_PRODUCTS.find(x=>x.id===item.productId);
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)"><div style="width:36px;height:36px;border-radius:7px;overflow:hidden;background:var(--elevated);flex-shrink:0"><img src="${safeImgSrc(p?.imageUrl||p?.img)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" decoding="async" width="36" height="36"></div><div style="flex:1;min-width:0"><div style="font-size:12.5px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p?.name)||item.productId}</div><div style="font-size:11px;color:var(--ink-muted)">${money(p?.salePrice||0)} × ${item.qty}</div></div><span style="color:var(--gold);font-weight:600;font-size:13px">${money((p?.salePrice||0)*item.qty)}</span></div>`;
    }).join('') || '<p style="color:var(--ink-muted);font-size:13px">আইটেম তথ্য নেই</p>';
    const ship = order.shippingCost||0;
    const sub = Number(order?.total ?? order?.payableTotal ?? order?.subtotal ?? 0) - ship;
    document.getElementById('odSubtotal').textContent = money(sub>0?sub:order.subtotal||0);
    document.getElementById('odShipping').textContent = ship>0?money(ship):'ফ্রি';
    document.getElementById('odTotal').textContent = moneyNumber(order?.total ?? order?.payableTotal ?? order?.subtotal ?? 0);
    const dbox = document.getElementById('odDriverBox');
    const dEl = document.getElementById('odDriver');
    if(order.driverName){ dbox.style.display='block'; dEl.textContent = `${order.driverName} — ${order.customerPhone||''}`; }
    else { dbox.style.display='none'; }

    const rbox = document.getElementById('odRefundBox');
    if(order.refundRequested){
      rbox.style.display='block';
      document.getElementById('odRefundReason').textContent = '📝 কারণ: ' + (order.refundReason||'উল্লেখ নেই');
      const statusEl = document.getElementById('odRefundStatus');
      const actionsEl = document.getElementById('odRefundActions');
      const rs = order.refundStatus || 'pending';
      const rsMap = { pending:{label:'⏳ পেন্ডিং',cls:'pending'}, approved:{label:'✓ অনুমোদিত',cls:'delivered'}, rejected:{label:'✕ বাতিল',cls:'cancelled'} };
      const rInfo = rsMap[rs] || rsMap.pending;
      statusEl.textContent = rInfo.label; statusEl.className = 'status-pill ' + rInfo.cls;
      actionsEl.style.display = rs==='pending' ? 'flex' : 'none';
    } else {
      rbox.style.display='none';
    }
    const noteInput = document.getElementById('odNoteInput');
    const noteStatus = document.getElementById('odNoteStatus');
    if(noteInput) noteInput.value = order.adminNote||'';
    if(noteStatus) noteStatus.textContent = order.adminNote?'✓ নোট আছে':'';
    document.getElementById('orderDetailModal').classList.add('show');
  },
  close(){ document.getElementById('orderDetailModal').classList.remove('show'); },
  async handleRefund(status){
    if(!this.current) return;
    const ok = await RefundService.approveRefund(this.current.id, status);
    if(ok){
      this.current.refundStatus = status;
      this.open(this.current);
      await AdminDash.render();
    }
  },
  print(){
    const o = this.current; if(!o) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${o.orderNumber||o.id}</title><style>body{font-family:sans-serif;padding:30px;max-width:600px;margin:0 auto}h1{color:#C2185B}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}table{width:100%;margin-top:14px}.tot{font-size:18px;font-weight:700;margin-top:14px}</style></head><body><h1>Golapi Shop Online</h1><p>অর্ডার: ${o.orderNumber||o.id}</p><p>তারিখ: ${o.createdAt?.seconds?new Date(o.createdAt.seconds*1000).toLocaleString('bn-BD'):'—'}</p><hr><h3>কাস্টমার</h3><p>${esc(o.customerName)}<br>${esc(o.customerPhone)}<br>${esc(o.village)}, ${esc(AREA_LABELS[o.branchZone])}<br>${esc(o.address)}</p><h3>আইটেম</h3><table><tr><th>পণ্য</th><th>মোট</th></tr>${(o.items||[]).map(it=>{const p=ALL_PRODUCTS.find(x=>x.id===it.productId);return `<tr><td>${esc(p?.name||it.productId)} × ${it.qty}</td><td>${money((p?.salePrice||0)*it.qty)}</td></tr>`}).join('')}</table><div class="tot"><div class="row"><span>মোট</span><span>${moneyNumber(o?.total ?? o?.payableTotal ?? o?.subtotal ?? 0)}</span></div></div><p style="margin-top:20px;font-size:12px;color:#888">Golapi Shop Online — নোয়াখালী</p></body></html>`);
    w.document.close(); w.print();
  }
};

/* ---------- Coupon Management ---------- */
const CouponManage = {
  coupons:[], mode:'add', editId:null,
  async load(){
    if(!FB) return [];
    try{
      const snap = await FB.getDocs(FB.collection(FB.db,'coupons'));
      const list=[]; snap.forEach(d=>list.push({id:d.id,...d.data()}));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      this.coupons = list;
      return list;
    }catch(e){ devWarn('coupon load failed', e.message); return []; }
  },
  async render(){
    await this.load();
    const tbody = document.getElementById('aCouponsTable');
    if(!tbody) return;
    if(!this.coupons.length){ tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-muted);padding:20px">কোনো কুপন নেই</td></tr>`; return; }
    const today = new Date();
    tbody.innerHTML = this.coupons.map(c=>{
      const expired = c.expiresAt && new Date(c.expiresAt) < today;
      const usedUp = c.usageLimit && (c.usedCount||0) >= c.usageLimit;
      const isLive = c.active!==false && !expired && !usedUp;
      return `<tr>
        <td style="font-weight:700;color:var(--gold)">${c.code}</td>
        <td>${c.type==='percent'?'শতাংশ':'ফ্ল্যাট'}</td>
        <td>${c.type==='percent'?c.value+'%':money(c.value)}</td>
        <td>${money(c.minOrder||0)}</td>
        <td>${bn(c.usedCount||0)}${c.usageLimit?' / '+bn(c.usageLimit):''}</td>
        <td style="font-size:11px">${c.expiresAt||'সীমাহীন'}</td>
        <td><span class="status-pill ${isLive?'delivered':'cancelled'}">${isLive?'সক্রিয়':expired?'মেয়াদ শেষ':usedUp?'শেষ':'বন্ধ'}</span></td>
        <td style="display:flex;gap:6px">
          <a href="#" onclick="event.preventDefault();CouponManage.openEdit('${c.id}')" style="color:var(--gold);font-size:12px">এডিট</a>
          <a href="#" onclick="event.preventDefault();CouponManage.toggleActive('${c.id}')" style="color:${c.active===false?'#22c55e':'#f87171'};font-size:12px">${c.active===false?'চালু':'বন্ধ'}</a>
        </td>
      </tr>`;
    }).join('');
  },
  openAdd(){
    this.mode='add'; this.editId=null;
    document.getElementById('cpTitle').textContent='নতুন কুপন তৈরি করুন';
    document.getElementById('cpSubmitBtn').textContent='কুপন তৈরি করুন';
    ['cpCode','cpValue','cpMaxDiscount','cpUsageLimit','cpExpiry'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    document.getElementById('cpType').value='percent';
    document.getElementById('cpMinOrder').value='0';
    document.getElementById('cpMsg').className='form-msg';
    document.getElementById('couponModal').classList.add('show');
  },
  openEdit(id){
    const c = this.coupons.find(x=>x.id===id); if(!c) return;
    this.mode='edit'; this.editId=id;
    document.getElementById('cpTitle').textContent='কুপন সম্পাদনা করুন';
    document.getElementById('cpSubmitBtn').textContent='পরিবর্তন সংরক্ষণ করুন';
    document.getElementById('cpCode').value=c.code;
    document.getElementById('cpType').value=c.type;
    document.getElementById('cpValue').value=c.value;
    document.getElementById('cpMaxDiscount').value=c.maxDiscount||'';
    document.getElementById('cpMinOrder').value=c.minOrder||0;
    document.getElementById('cpUsageLimit').value=c.usageLimit||'';
    document.getElementById('cpExpiry').value=c.expiresAt||'';
    document.getElementById('cpMsg').className='form-msg';
    document.getElementById('couponModal').classList.add('show');
  },
  close(){ document.getElementById('couponModal').classList.remove('show'); },
  async submit(){
    const msgEl=document.getElementById('cpMsg');
    const code = document.getElementById('cpCode').value.trim().toUpperCase();
    const type = document.getElementById('cpType').value;
    const value = Number(document.getElementById('cpValue').value);
    const maxDiscount = Number(document.getElementById('cpMaxDiscount').value)||null;
    const minOrder = Number(document.getElementById('cpMinOrder').value)||0;
    const usageLimit = Number(document.getElementById('cpUsageLimit').value)||null;
    const expiresAt = document.getElementById('cpExpiry').value||null;
    if(!code || !value){ msgEl.textContent='কোড ও ছাড়ের পরিমাণ দিন'; msgEl.className='form-msg err'; return; }
    if(!FB){ msgEl.textContent='সংযোগ সমস্যা'; msgEl.className='form-msg err'; return; }
    try{
      if(this.mode==='add'){
        const dupe = this.coupons.find(c=>c.code===code);
        if(dupe){ msgEl.textContent='এই কোড ইতিমধ্যে আছে'; msgEl.className='form-msg err'; return; }
        await FB.addDoc(FB.collection(FB.db,'coupons'), {code,type,value,maxDiscount,minOrder,usageLimit,expiresAt,usedCount:0,active:true,createdAt:FB.serverTimestamp()});
        msgEl.textContent='✓ কুপন তৈরি হয়েছে'; msgEl.className='form-msg ok';
      } else {
        await FB.updateDoc(FB.doc(FB.db,'coupons',this.editId), {code,type,value,maxDiscount,minOrder,usageLimit,expiresAt});
        msgEl.textContent='✓ কুপন আপডেট হয়েছে'; msgEl.className='form-msg ok';
      }
      await this.render();
      setTimeout(()=>this.close(),800);
    }catch(e){ msgEl.textContent='সমস্যা: '+e.message; msgEl.className='form-msg err'; }
  },
  async toggleActive(id){
    const c = this.coupons.find(x=>x.id===id); if(!c || !FB) return;
    try{ await FB.updateDoc(FB.doc(FB.db,'coupons',id), {active: c.active===false}); this.render(); }
    catch(e){ toast('সমস্যা: '+e.message,'error'); }
  }
};

/* ---------- Payment Verification ---------- */
const PaymentVerify = {
  async render(){
    if(!FB) return;
    const tbody = document.getElementById('aPaymentsTable');
    const countEl = document.getElementById('paymentPendingCount');
    const dupWarnEl = document.getElementById('paymentDuplicateWarning');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:20px">লোড হচ্ছে...</td></tr>`;
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'orders'), FB.where('paymentStatus','==','paid_pending_verification')));
      const list=[]; snap.forEach(d=>list.push({id:d.id,...d.data()}));
      list.sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));

      if(countEl) countEl.textContent = `${list.length}টি পেমেন্ট যাচাইয়ের অপেক্ষায়`;

      const trxCounts = {};
      list.forEach(o=>{ const t=o.paymentTrxId; if(t) trxCounts[t]=(trxCounts[t]||0)+1; });
      const dupes = Object.entries(trxCounts).filter(([t,c])=>c>1).map(([t])=>t);
      if(dupes.length){
        dupWarnEl.style.display='block';
        dupWarnEl.textContent = `⚠️ একই ট্রানজেকশন ID একাধিক অর্ডারে ব্যবহার হয়েছে: ${dupes.join(', ')} — সাবধানে যাচাই করুন`;
      } else { dupWarnEl.style.display='none'; }

      if(!list.length){ tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:20px">যাচাইয়ের অপেক্ষায় কোনো পেমেন্ট নেই ✓</td></tr>`; return; }

      const now = Date.now();
      tbody.innerHTML = list.map(o=>{
        const isDupe = o.paymentTrxId && trxCounts[o.paymentTrxId] > 1;
        const submittedAt = o.createdAt?.seconds ? o.createdAt.seconds*1000 : now;
        const hoursWaiting = (now - submittedAt) / (1000*60*60);
        const isOverdue = hoursWaiting > 2;
        return `<tr style="${isDupe?'background:rgba(239,68,68,.05)':''}">
          <td style="font-size:11px">${o.orderNumber||o.id.slice(-6)}</td>
          <td>${esc(o.customerName)||'—'}<br><span style="font-size:10.5px;color:var(--ink-muted)">${esc(o.customerPhone)}</span></td>
          <td>${o.paymentMethod==='bkash'?'📱 bKash':'📱 Nagad'}</td>
          <td style="color:var(--gold);font-weight:600">${moneyNumber(o?.total ?? o?.payableTotal ?? o?.subtotal ?? 0)}</td>
          <td style="font-family:monospace;font-size:12px;${isDupe?'color:#f87171;font-weight:700':''}">${o.paymentTrxId||'—'}${isDupe?' ⚠️':''}</td>
          <td style="font-size:11px;${isOverdue?'color:#fbbf24':''}">${o.createdAt?.seconds?new Date(o.createdAt.seconds*1000).toLocaleString('bn-BD'):'—'}${isOverdue?' <br>⏰ '+Math.floor(hoursWaiting)+' ঘণ্টা+':''}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button onclick="PaymentVerify.verify('${o.id}')" style="padding:5px 10px;border-radius:7px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:#22c55e;font-size:11.5px">✓ ভেরিফাই</button>
            <button onclick="PaymentVerify.markMismatch('${o.id}')" style="padding:5px 10px;border-radius:7px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;font-size:11.5px">✕ মিসম্যাচ</button>
          </td>
        </tr>`;
      }).join('');
    }catch(e){ devWarn('payment verify load failed', e.message); tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink-muted);padding:20px">লোড করা যায়নি</td></tr>`; }
  },

  async verify(orderId){
    if(!FB) return;
    if(!confirm('এই পেমেন্টটা ভেরিফাই করা নিশ্চিত করছেন?')) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'orders',orderId), {
        paymentStatus:'verified', paymentVerifiedAt: FB.serverTimestamp(), status:'confirmed'
      });
      toast('✓ পেমেন্ট ভেরিফাই হয়েছে, অর্ডার কনফার্ম করা হলো','success');
      await this.render();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },

  async markMismatch(orderId){
    const reason = prompt('মিসম্যাচের কারণ লিখুন (কাস্টমারকে জানানো হবে):', 'ট্রানজেকশন ID মিলছে না, সঠিক ID দিয়ে আবার সাবমিট করুন');
    if(!reason || !FB) return;
    try{
      await FB.updateDoc(FB.doc(FB.db,'orders',orderId), {
        paymentStatus:'mismatch', paymentMismatchReason: reason
      });
      const orderSnap = await FB.getDoc(FB.doc(FB.db,'orders',orderId));
      if(orderSnap.exists()){
        const o = orderSnap.data();
        await SMSGateway.send(o.customerPhone, `Golapi Shop: আপনার অর্ডার #${(o.orderNumber||orderId).slice(0,8).toUpperCase()}-এর পেমেন্ট যাচাই করা যায়নি। কারণ: ${reason}। যোগাযোগ: 01612-057371`);
      }
      toast('✓ মিসম্যাচ মার্ক করা হয়েছে, কাস্টমারকে SMS পাঠানো হয়েছে','success');
      await this.render();
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  }
};
window.AdminDash=AdminDash;window.ProductForm=ProductForm;window.OrderDetail=OrderDetail;window.CouponManage=CouponManage;window.PaymentVerify=PaymentVerify;

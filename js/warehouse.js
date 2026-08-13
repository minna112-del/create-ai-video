/* warehouse.js — Warehouse Control Room */
const WarehouseDash = {
  currentUid:null,currentName:null,_orders:[],_products:[],_purchaseOrders:[],_receipts:[],_cycleCounts:[],
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  n(v){return Number(v||0)||0;},
  date(v){try{const d=v?.toDate?v.toDate():new Date(v);return isNaN(d)?'—':d.toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'});}catch(e){return '—';}},
  async login(){
    const email=document.getElementById('whEmail').value.trim(),pass=document.getElementById('whPassword').value,msg=document.getElementById('whLoginMsg');
    if(!email||!pass){msg.textContent='ইমেইল ও পাসওয়ার্ড দিন';msg.className='form-msg err';return;}
    try{
      const cred=await FB.signInWithEmailAndPassword(FB.auth,email,pass);const snap=await FB.getDoc(FB.doc(FB.db,'staff',cred.user.uid));
      if(!snap.exists()||!['warehouse_manager','admin'].includes(snap.data().role)){await FB.signOut(FB.auth).catch(()=>{});msg.textContent='এই অ্যাকাউন্ট Warehouse Control Room-এর জন্য অনুমোদিত নয়';msg.className='form-msg err';return;}
      this.currentUid=cred.user.uid;this.currentName=snap.data().name||'Warehouse Manager';
      if(typeof StaffChat!=='undefined')StaffChat.init(this.currentUid,this.currentName,snap.data().role);
      await this.render();
    }catch(e){msg.textContent='লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড সঠিক নয়';msg.className='form-msg err';}
  },
  async _restoreSession(){
    if(this.currentUid||!window.FB||!FB.auth.currentUser)return;
    try{const snap=await FB.getDoc(FB.doc(FB.db,'staff',FB.auth.currentUser.uid));if(snap.exists()&&['warehouse_manager','admin'].includes(snap.data().role)){this.currentUid=FB.auth.currentUser.uid;this.currentName=snap.data().name||'Warehouse Manager';}}catch(e){if(typeof devWarn==='function')devWarn('warehouse restore failed',e.message);}
  },
  async logout(){if(window.FB)await FB.signOut(FB.auth).catch(()=>{});this.currentUid=null;this.currentName=null;document.getElementById('whLoginBox').style.display='block';document.getElementById('whDashBox').style.display='none';},
  async render(){
    await this._restoreSession();
    if(!this.currentUid){document.getElementById('whLoginBox').style.display='block';document.getElementById('whDashBox').style.display='none';return;}
    document.getElementById('whLoginBox').style.display='none';document.getElementById('whDashBox').style.display='block';
    document.getElementById('whManagerLabel').textContent='পরিচালনায়: '+this.currentName;
    if(typeof EmployeeWorkspace!=='undefined')await EmployeeWorkspace.mountCurrent('whEmployeeWorkspace');
    await this.loadData();this.populateControls();this.renderOverview();this.renderReceiving();this.renderFulfilment();this.renderCycleCounts();
  },
  async refresh(){await this.render();toast('✓ Warehouse data আপডেট হয়েছে','success');},
  async loadData(){
    const read=async(name)=>{try{const s=await FB.getDocs(FB.collection(FB.db,name));const a=[];s.forEach(d=>a.push({id:d.id,...d.data()}));return a;}catch(e){return [];}};
    const results=await Promise.all([read('orders'),read('products'),read('purchase_orders'),read('goods_receipts'),read('warehouse_cycle_counts')]);
    this._orders=results[0];this._products=results[1].length?results[1]:(window.ALL_PRODUCTS||[]);this._purchaseOrders=results[2];this._receipts=results[3];this._cycleCounts=results[4].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  },
  populateControls(){
    const branches=new Map();Object.entries(window.BRANCH_INFO||{}).forEach(([id,b])=>branches.set(id,b.label||id));
    this._orders.forEach(o=>{const id=o.branchZone||o.zone||o.branchId||'';if(id)branches.set(id,o.branchName||branches.get(id)||id);});
    const bf=document.getElementById('whBranchFilter');if(bf){const keep=bf.value;bf.innerHTML='<option value="">সব শাখা</option>'+[...branches].map(([id,l])=>`<option value="${this.esc(id)}">${this.esc(l)}</option>`).join('');bf.value=keep;}
    const ps=document.getElementById('whCycleProduct');if(ps){ps.innerHTML='<option value="">প্রোডাক্ট নির্বাচন করুন</option>'+this._products.map(p=>`<option value="${this.esc(p.id)}">${this.esc(p.name||p.title||p.id)} — Stock ${this.n(p.stock)}</option>`).join('');ps.onchange=()=>{const p=this._products.find(x=>x.id===ps.value);document.getElementById('whCycleSystem').value=p?this.n(p.stock):'';};}
  },
  orderStatus(o){return String(o.status||o.orderStatus||'pending').toLowerCase();},
  isToday(v){try{const d=v?.toDate?v.toDate():new Date(v);const n=new Date();return d.toDateString()===n.toDateString();}catch(e){return false;}},
  renderOverview(){
    const receiving=this._purchaseOrders.filter(p=>!['received','cancelled','closed'].includes(String(p.status||'').toLowerCase())).length;
    const pick=this._orders.filter(o=>['confirmed','processing','ready_to_pack'].includes(this.orderStatus(o))).length;
    const packed=this._orders.filter(o=>this.orderStatus(o)==='packed'&&this.isToday(o.updatedAt||o.packedAt||o.createdAt)).length;
    const variance=this._cycleCounts.filter(c=>this.n(c.variance)!==0).length;
    const score=Math.max(0,100-Math.min(40,pick*3)-Math.min(25,receiving*2)-Math.min(35,variance*5));
    const put=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=typeof bn==='function'?bn(v):v;};put('whStatReceiving',receiving);put('whStatPick',pick);put('whStatPacked',packed);put('whStatVariance',variance);put('whHealthScore',score);
    const bar=document.getElementById('whHealthBar');if(bar)bar.style.width=score+'%';document.getElementById('whHealthText').textContent=score>=85?'অপারেশন স্থিতিশীল ও নিয়ন্ত্রিত।':score>=65?'কিছু Queue ও Variance দ্রুত সমাধান প্রয়োজন।':'Warehouse operation-এ তাৎক্ষণিক ব্যবস্থাপনা প্রয়োজন।';
    const priorities=[];if(pick)priorities.push({level:'urgent',title:`${pick}টি অর্ডার Pick Queue-তে আছে`,text:'Pick list প্রস্তুত করে packing desk-এ পাঠান।'});if(receiving)priorities.push({level:'warning',title:`${receiving}টি inbound shipment অপেক্ষমাণ`,text:'PO যাচাই করে goods receiving সম্পন্ন করুন।'});if(variance)priorities.push({level:'danger',title:`${variance}টি stock variance শনাক্ত`,text:'Cycle count review করে Inventory Office-এ escalation দিন।'});if(!priorities.length)priorities.push({level:'ok',title:'কোনো জরুরি Warehouse action নেই',text:'নিয়মিত cycle count ও dispatch readiness বজায় রাখুন।'});
    document.getElementById('whPriorityList').innerHTML=priorities.map(x=>`<div class="warehouse-priority ${x.level}"><strong>${this.esc(x.title)}</strong><span>${this.esc(x.text)}</span></div>`).join('');
    const groups={};this._orders.forEach(o=>{const id=o.branchZone||o.zone||o.branchId||'unassigned';groups[id]??={name:o.branchName||(window.BRANCH_INFO?.[id]?.label)||id,pick:0,packed:0};const s=this.orderStatus(o);if(['confirmed','processing','ready_to_pack'].includes(s))groups[id].pick++;if(s==='packed')groups[id].packed++;});
    const rows=Object.values(groups);document.getElementById('whBranchTable').innerHTML=rows.length?rows.map(g=>{const risk=g.pick>10?'High':g.pick>4?'Medium':'Low';return `<tr><td>${this.esc(g.name)}</td><td>${g.pick}</td><td>${g.packed}</td><td><span class="warehouse-risk ${risk.toLowerCase()}">${risk}</span></td></tr>`;}).join(''):'<tr><td colspan="4">কোনো শাখা ডেটা নেই</td></tr>';
  },
  renderReceiving(){
    const host=document.getElementById('whReceivingTable');if(!host)return;
    host.innerHTML=this._purchaseOrders.length?this._purchaseOrders.map(po=>{const status=String(po.status||'pending');return `<tr><td><b>${this.esc(po.poNumber||po.id)}</b></td><td>${this.esc(po.supplierName||po.supplier||'—')}</td><td>${this.esc(po.branchName||po.branchZone||'Head Office')}</td><td>${this.date(po.expectedAt||po.expectedDate||po.createdAt)}</td><td>${this.esc(status)}</td><td>${['received','cancelled','closed'].includes(status.toLowerCase())?'—':`<button class="warehouse-action" onclick="WarehouseDash.receivePurchaseOrder('${this.esc(po.id)}')">Receive</button>`}</td></tr>`;}).join(''):'<tr><td colspan="6">কোনো Purchase Order পাওয়া যায়নি</td></tr>';
  },
  async receivePurchaseOrder(id){
    const po=this._purchaseOrders.find(x=>x.id===id);if(!po)return;if(!confirm('এই shipment গ্রহণ সম্পন্ন করবেন?'))return;
    try{await FB.updateDoc(FB.doc(FB.db,'purchase_orders',id),{status:'received',receivedAt:FB.serverTimestamp(),receivedBy:this.currentUid,receivedByName:this.currentName});await FB.addDoc(FB.collection(FB.db,'goods_receipts'),{purchaseOrderId:id,poNumber:po.poNumber||id,supplierName:po.supplierName||'',branchZone:po.branchZone||'',branchName:po.branchName||'',items:po.items||[],receivedBy:this.currentUid,receivedByName:this.currentName,createdAt:FB.serverTimestamp()});toast('Goods receiving সম্পন্ন হয়েছে','success');await this.refresh();}catch(e){toast('Receiving update ব্যর্থ: '+e.message,'error');}
  },
  renderFulfilment(){
    const q=(document.getElementById('whOrderSearch')?.value||'').trim().toLowerCase(),branch=document.getElementById('whBranchFilter')?.value||'';let list=this._orders.filter(o=>['confirmed','processing','ready_to_pack','packed'].includes(this.orderStatus(o)));if(branch)list=list.filter(o=>(o.branchZone||o.zone||o.branchId||'')===branch);if(q)list=list.filter(o=>[o.id,o.orderId,o.customerName,o.name,o.phone].some(v=>String(v||'').toLowerCase().includes(q)));
    const host=document.getElementById('whFulfilmentTable');if(!host)return;host.innerHTML=list.length?list.map(o=>{const s=this.orderStatus(o),count=Array.isArray(o.items)?o.items.reduce((a,i)=>a+this.n(i.qty||i.quantity||1),0):0;const next=s==='packed'?'':s==='ready_to_pack'?'packed':s==='processing'?'ready_to_pack':'processing';return `<tr><td><b>${this.esc(o.orderId||o.id)}</b></td><td>${this.esc(o.customerName||o.name||'—')}</td><td>${this.esc(o.branchName||o.branchZone||'—')}</td><td>${count}</td><td>${this.esc(s)}</td><td>${next?`<button class="warehouse-action" onclick="WarehouseDash.advanceOrder('${this.esc(o.id)}','${next}')">${next==='processing'?'Start Pick':next==='ready_to_pack'?'Pick Complete':'Mark Packed'}</button>`:'Ready for dispatch'}</td></tr>`;}).join(''):'<tr><td colspan="6">Pick & Pack queue খালি</td></tr>';
  },
  async advanceOrder(id,status){try{await FB.updateDoc(FB.doc(FB.db,'orders',id),{status,warehouseUpdatedAt:FB.serverTimestamp(),warehouseUpdatedBy:this.currentUid});toast('অর্ডার স্ট্যাটাস আপডেট হয়েছে','success');await this.refresh();}catch(e){toast('অর্ডার আপডেট ব্যর্থ: '+e.message,'error');}},
  renderCycleCounts(){const host=document.getElementById('whCycleTable');if(!host)return;host.innerHTML=this._cycleCounts.slice(0,30).map(c=>`<tr><td>${this.esc(c.productName||c.productId)}</td><td>${this.n(c.systemStock)}</td><td>${this.n(c.physicalStock)}</td><td class="${this.n(c.variance)!==0?'warehouse-variance':''}">${this.n(c.variance)}</td><td>${this.date(c.createdAt)}</td></tr>`).join('')||'<tr><td colspan="5">এখনও cycle count করা হয়নি</td></tr>';},
  async saveCycleCount(){const id=document.getElementById('whCycleProduct').value,p=this._products.find(x=>x.id===id),physical=Number(document.getElementById('whCyclePhysical').value);if(!p||!Number.isFinite(physical)||physical<0){toast('প্রোডাক্ট ও সঠিক physical count দিন','error');return;}const system=this.n(p.stock),variance=physical-system,note=document.getElementById('whCycleNote').value.trim();try{await FB.addDoc(FB.collection(FB.db,'warehouse_cycle_counts'),{productId:id,productName:p.name||p.title||id,branchZone:p.branchZone||p.zone||'',systemStock:system,physicalStock:physical,variance,note,countedBy:this.currentUid,countedByName:this.currentName,createdAt:FB.serverTimestamp()});toast('Cycle count সংরক্ষণ হয়েছে','success');document.getElementById('whCyclePhysical').value='';document.getElementById('whCycleNote').value='';await this.refresh();}catch(e){toast('Cycle count সংরক্ষণ ব্যর্থ: '+e.message,'error');}},
  tab(btn,name){document.querySelectorAll('#page-warehouse-dash .zm-tabs button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');['Overview','Receiving','Fulfilment','Cycle'].forEach(x=>{const e=document.getElementById('wh'+x+'Pane');if(e)e.style.display=x.toLowerCase()===name?'block':'none';});},
  exportReceivingCsv(){const rows=[['PO','Supplier','Branch','Status'],...this._purchaseOrders.map(p=>[p.poNumber||p.id,p.supplierName||'',p.branchName||p.branchZone||'',p.status||'pending'])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='warehouse-receiving.csv';a.click();URL.revokeObjectURL(a.href);}
};
window.WarehouseDash=WarehouseDash;

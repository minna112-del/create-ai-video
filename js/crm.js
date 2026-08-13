/* crm.js — Phase 18: Customer Relationship Office */
const CRMOffice = {
  orders: [], users: [], profiles: [], loyalty: [], wallets: [], campaigns: [], activities: [], branches: [], customers: [],
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  bn(v){return typeof bn==='function'?bn(v):String(v);},
  money(v){return '৳'+Number(v||0).toLocaleString('bn-BD',{maximumFractionDigits:0});},
  uid(){return FB?.auth?.currentUser?.uid||OwnerAuth?.currentUid||'';},
  date(v){if(!v)return '—';const d=v.toDate?v.toDate():new Date(v);return isNaN(d)?'—':d.toLocaleDateString('bn-BD');},
  daysSince(v){if(!v)return 999;const d=v.toDate?v.toDate():new Date(v);return Math.floor((Date.now()-d.getTime())/86400000);},
  async render(){
    if(!window.FB){toast('Firebase সংযোগ পাওয়া যায়নি','error');return;}
    if(typeof EmployeeWorkspace!=='undefined')EmployeeWorkspace.mountCurrent('crmEmployeeWorkspace');
    await this.refresh();
  },
  async refresh(){
    const u=document.getElementById('crmUpdated');if(u)u.textContent='লোড হচ্ছে…';
    try{
      const names=['orders','users','customer_profiles','customer_loyalty','customer_wallets','crm_campaigns','crm_activities','branches'];
      const snaps=await Promise.all(names.map(n=>FB.getDocs(FB.collection(FB.db,n)).catch(()=>null)));
      const arr=(snap,idKey='id')=>{const out=[];snap?.forEach(x=>out.push({[idKey]:x.id,...x.data()}));return out;};
      [this.orders,this.users,this.profiles,this.loyalty,this.wallets,this.campaigns,this.activities,this.branches]=snaps.map(s=>arr(s));
      this.buildCustomers();
      this.renderAll();
      if(u)u.textContent='আপডেট: '+new Date().toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
    }catch(e){toast('CRM Office লোড হয়নি: '+e.message,'error');if(u)u.textContent='লোড ব্যর্থ';}
  },
  customerKey(o){return o.userId||o.customerId||o.customerUid||o.phone||o.customerPhone||o.email||o.customerEmail||`guest_${o.id}`;},
  orderTotal(o){return Number(o.total||o.grandTotal||o.totalAmount||o.amount||0);},
  orderDate(o){return o.createdAt||o.orderDate||o.placedAt||null;},
  customerName(o){return o.customerName||o.name||o.shippingName||o.deliveryName||'নাম অজানা';},
  customerPhone(o){return o.customerPhone||o.phone||o.shippingPhone||o.deliveryPhone||'';},
  customerEmail(o){return o.customerEmail||o.email||'';},
  customerBranch(o){return o.branchName||o.branchCode||o.branchId||o.branch||'';},
  buildCustomers(){
    const map=new Map();
    this.orders.forEach(o=>{
      const key=this.customerKey(o);
      if(!map.has(key))map.set(key,{id:key,name:this.customerName(o),phone:this.customerPhone(o),email:this.customerEmail(o),branch:this.customerBranch(o),orders:[],deliveredValue:0,lastOrderAt:null,firstOrderAt:null});
      const c=map.get(key);c.orders.push(o);
      if(o.status==='delivered')c.deliveredValue+=this.orderTotal(o);
      const dt=this.orderDate(o);if(dt){const d=dt.toDate?dt.toDate():new Date(dt);if(!c.lastOrderAt||d>(c.lastOrderAt.toDate?c.lastOrderAt.toDate():new Date(c.lastOrderAt)))c.lastOrderAt=dt;if(!c.firstOrderAt||d<(c.firstOrderAt.toDate?c.firstOrderAt.toDate():new Date(c.firstOrderAt)))c.firstOrderAt=dt;}
      if(!c.name||c.name==='নাম অজানা')c.name=this.customerName(o);
      if(!c.phone)c.phone=this.customerPhone(o);if(!c.email)c.email=this.customerEmail(o);if(!c.branch)c.branch=this.customerBranch(o);
    });
    this.users.forEach(u=>{
      const key=u.uid||u.id||u.phone||u.email;if(!key)return;
      if(!map.has(key))map.set(key,{id:key,name:u.name||u.displayName||'নাম অজানা',phone:u.phone||'',email:u.email||'',branch:u.branchName||u.branch||'',orders:[],deliveredValue:0,lastOrderAt:null,firstOrderAt:null});
    });
    this.customers=[...map.values()].map(c=>{
      const profile=this.profiles.find(x=>x.id===c.id||x.uid===c.id||x.phone===c.phone)||{};
      const loyalty=this.loyalty.find(x=>x.id===c.id||x.customerId===c.id||x.phone===c.phone)||{};
      const wallet=this.wallets.find(x=>x.id===c.id||x.customerId===c.id||x.phone===c.phone)||{};
      c.name=profile.name||c.name;c.phone=profile.phone||c.phone;c.email=profile.email||c.email;c.branch=profile.branchName||profile.branch||c.branch;
      c.points=Number(loyalty.points||profile.loyaltyPoints||0);c.wallet=Number(wallet.balance||profile.walletBalance||0);c.profile=profile;
      c.segment=this.segmentOf(c);return c;
    }).sort((a,b)=>b.deliveredValue-a.deliveredValue);
  },
  segmentOf(c){
    const days=this.daysSince(c.lastOrderAt),count=c.orders.length,value=c.deliveredValue;
    if(value>=25000||count>=15)return 'vip';
    if(count>=5)return 'loyal';
    if(count<=1&&days<=30)return 'new';
    if(count>=2&&days>=60&&days<120)return 'at_risk';
    if(days>=120)return 'inactive';
    return 'regular';
  },
  renderAll(){this.renderStats();this.renderPriority();this.renderCustomers();this.renderCampaigns();this.renderActivities();this.populateBranchFilter();},
  renderStats(){
    const repeat=this.customers.filter(c=>c.orders.length>=2).length,vip=this.customers.filter(c=>c.segment==='vip').length,risk=this.customers.filter(c=>['at_risk','inactive'].includes(c.segment)).length,value=this.customers.reduce((n,c)=>n+c.deliveredValue,0);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('crmStatCustomers',this.bn(this.customers.length));set('crmStatRepeat',this.bn(repeat));set('crmStatVip',this.bn(vip));set('crmStatValue',this.money(value));set('crmStatRisk',this.bn(risk));
  },
  renderPriority(){
    const host=document.getElementById('crmPriorityDesk');if(!host)return;
    const atRisk=this.customers.filter(c=>c.segment==='at_risk').length,inactive=this.customers.filter(c=>c.segment==='inactive').length,highValueNoOrder=this.customers.filter(c=>c.deliveredValue>=10000&&this.daysSince(c.lastOrderAt)>=45).length,noProfile=this.customers.filter(c=>!c.phone&&!c.email).length;
    const items=[];if(highValueNoOrder)items.push(`<li><strong>${this.bn(highValueNoOrder)} জন মূল্যবান customer ৪৫+ দিন অর্ডার করেননি</strong><span>Retention campaign ও personal follow-up করুন।</span></li>`);if(atRisk)items.push(`<li><strong>${this.bn(atRisk)} জন At Risk customer</strong><span>Coupon, wallet credit অথবা care call বিবেচনা করুন।</span></li>`);if(inactive)items.push(`<li><strong>${this.bn(inactive)} জন Inactive customer</strong><span>Reactivation campaign segment তৈরি করুন।</span></li>`);if(noProfile)items.push(`<li><strong>${this.bn(noProfile)}টি profile-এ যোগাযোগের তথ্য নেই</strong><span>Customer data quality উন্নত করুন।</span></li>`);
    host.innerHTML=`<div><span class="office-kicker">PRIORITY DESK</span><h2>${items.length?'Customer relationship-এর প্রয়োজনীয় সিদ্ধান্ত':'Customer relationship স্বাভাবিক'}</h2></div><ul>${items.join('')||'<li><strong>কোনো জরুরি retention risk নেই</strong><span>VIP ও loyal customer engagement চালু রাখুন।</span></li>'}</ul>`;
  },
  populateBranchFilter(){
    const e=document.getElementById('crmBranchFilter');if(!e)return;const current=e.value,vals=[...new Set(this.customers.map(c=>c.branch).filter(Boolean))].sort();e.innerHTML='<option value="">সব Branch</option>'+vals.map(v=>`<option value="${this.esc(v)}">${this.esc(v)}</option>`).join('');e.value=current;
  },
  renderCustomers(){
    const host=document.getElementById('crmCustomerCards');if(!host)return;const q=(document.getElementById('crmSearch')?.value||'').toLowerCase(),segment=document.getElementById('crmSegmentFilter')?.value||'',branch=document.getElementById('crmBranchFilter')?.value||'';
    const list=this.customers.filter(c=>(!segment||c.segment===segment)&&(!branch||c.branch===branch)&&(!q||[c.id,c.name,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(q))));
    host.innerHTML=list.map(c=>`<article class="crm-customer-card">
      <div class="crm-card-head"><div class="crm-avatar">${this.esc((c.name||'?').trim().charAt(0).toUpperCase())}</div><div><h3>${this.esc(c.name)}</h3><p>${this.esc(c.phone||c.email||'যোগাযোগ নেই')}</p></div><span class="crm-segment ${this.esc(c.segment)}">${this.esc(c.segment.replace('_',' '))}</span></div>
      <div class="crm-value-row"><div><strong>${this.money(c.deliveredValue)}</strong><span>Lifetime Value</span></div><div><strong>${this.bn(c.orders.length)}</strong><span>Orders</span></div><div><strong>${this.bn(c.points)}</strong><span>Points</span></div><div><strong>${this.money(c.wallet)}</strong><span>Wallet</span></div></div>
      <div class="crm-meta"><span>শেষ Order: ${this.date(c.lastOrderAt)}</span><span>Branch: ${this.esc(c.branch||'—')}</span></div>
      <div class="crm-actions"><button onclick="CRMOffice.openCustomer('${this.esc(c.id)}')">Customer 360</button><button onclick="CRMOffice.openNote('${this.esc(c.id)}')">Follow-up Note</button><button onclick="CRMOffice.adjustLoyalty('${this.esc(c.id)}')">Reward</button></div>
    </article>`).join('')||'<p class="attendance-empty">কোনো customer পাওয়া যায়নি।</p>';
  },
  customerActivities(c){return this.activities.filter(a=>a.customerId===c.id||a.phone===c.phone).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));},
  openCustomer(id){
    const c=this.customers.find(x=>x.id===id);if(!c)return;const orders=[...c.orders].sort((a,b)=>{const da=this.orderDate(a),db=this.orderDate(b);return (db?.seconds||0)-(da?.seconds||0)}).slice(0,20),acts=this.customerActivities(c).slice(0,15);
    document.getElementById('crmCustomerDetail').innerHTML=`<div class="crm-detail-head"><div class="crm-avatar large">${this.esc((c.name||'?').charAt(0))}</div><div><span class="crm-segment ${this.esc(c.segment)}">${this.esc(c.segment)}</span><h2>${this.esc(c.name)}</h2><p>${this.esc(c.phone||'')} · ${this.esc(c.email||'')}</p></div></div>
      <div class="crm-detail-stats"><div><strong>${this.money(c.deliveredValue)}</strong><span>Lifetime Value</span></div><div><strong>${this.bn(c.orders.length)}</strong><span>Total Orders</span></div><div><strong>${this.bn(c.points)}</strong><span>Loyalty Points</span></div><div><strong>${this.money(c.wallet)}</strong><span>Wallet</span></div></div>
      <h3>Order Timeline</h3><div class="crm-timeline">${orders.map(o=>`<div><strong>#${this.esc(o.orderNo||o.orderId||o.id)}</strong><span>${this.esc(o.status||'pending')} · ${this.money(this.orderTotal(o))} · ${this.date(this.orderDate(o))}</span></div>`).join('')||'<p>কোনো order নেই।</p>'}</div>
      <h3>Relationship Activity</h3><div class="crm-timeline">${acts.map(a=>`<div><strong>${this.esc(a.type||'note')}</strong><span>${this.esc(a.note||a.details||'')} · ${this.date(a.createdAt)}</span></div>`).join('')||'<p>কোনো activity নেই।</p>'}</div>`;
    this.openModal('crmCustomerModal');
  },
  renderCampaigns(){const host=document.getElementById('crmCampaignList');if(!host)return;const list=[...this.campaigns].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,20);host.innerHTML=list.map(x=>`<div class="crm-list-item"><div><strong>${this.esc(x.name||'Campaign')}</strong><span>${this.esc(x.segment||'all')} · ${this.esc(x.offerType||'message')} ${x.offerValue?x.offerValue:''}</span></div><div><small>${this.esc(x.status||'draft')}</small>${x.status!=='active'?`<button onclick="CRMOffice.updateCampaign('${x.id}','active')">Activate</button>`:`<button onclick="CRMOffice.updateCampaign('${x.id}','closed')">Close</button>`}</div></div>`).join('')||'<p class="attendance-empty">কোনো campaign নেই।</p>';},
  renderActivities(){const host=document.getElementById('crmActivityList');if(!host)return;const list=[...this.activities].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,25);host.innerHTML=list.map(x=>`<div class="crm-list-item"><div><strong>${this.esc(x.customerName||x.customerId||'Customer')}</strong><span>${this.esc(x.type||'activity')} · ${this.esc(x.note||x.details||'')}</span></div><small>${this.date(x.createdAt)}</small></div>`).join('')||'<p class="attendance-empty">কোনো CRM activity নেই।</p>';},
  openModal(id){const m=document.getElementById(id);if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}},
  closeModal(id){const m=document.getElementById(id);if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.style.overflow='';}},
  openCampaignForm(){document.getElementById('crmCampaignStart').value=new Date().toISOString().slice(0,10);this.openModal('crmCampaignModal');},
  async saveCampaign(){
    const name=document.getElementById('crmCampaignName').value.trim();if(!name){toast('Campaign নাম দিন','error');return;}
    const id=`campaign_${Date.now()}`;try{await FB.setDoc(FB.doc(FB.db,'crm_campaigns',id),{name,segment:document.getElementById('crmCampaignSegment').value,offerType:document.getElementById('crmCampaignType').value,offerValue:+document.getElementById('crmCampaignValue').value||0,startDate:document.getElementById('crmCampaignStart').value,endDate:document.getElementById('crmCampaignEnd').value,message:document.getElementById('crmCampaignMessage').value.trim(),status:'draft',createdBy:this.uid(),createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()});this.closeModal('crmCampaignModal');await this.refresh();toast('Campaign সংরক্ষণ হয়েছে','success');}catch(e){toast(e.message,'error');}
  },
  async updateCampaign(id,status){try{await FB.setDoc(FB.doc(FB.db,'crm_campaigns',id),{status,updatedBy:this.uid(),updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh();toast('Campaign status আপডেট হয়েছে','success');}catch(e){toast(e.message,'error');}},
  openNote(id){const c=this.customers.find(x=>x.id===id);if(!c)return;document.getElementById('crmNoteCustomerId').value=id;document.getElementById('crmNoteText').value='';this.openModal('crmNoteModal');},
  async saveNote(){
    const id=document.getElementById('crmNoteCustomerId').value,c=this.customers.find(x=>x.id===id),note=document.getElementById('crmNoteText').value.trim();if(!c||!note){toast('নোট লিখুন','error');return;}
    try{await FB.setDoc(FB.doc(FB.db,'crm_activities',`activity_${Date.now()}`),{customerId:c.id,customerName:c.name,phone:c.phone,type:'follow_up_note',note,createdBy:this.uid(),createdAt:FB.serverTimestamp()});this.closeModal('crmNoteModal');await this.refresh();toast('Follow-up note সংরক্ষণ হয়েছে','success');}catch(e){toast(e.message,'error');}
  },
  async adjustLoyalty(id){
    const c=this.customers.find(x=>x.id===id);if(!c)return;const raw=prompt(`${c.name}-কে কত loyalty point দেবেন?`,'100');if(raw===null)return;const points=Number(raw);if(!Number.isFinite(points)||points===0){toast('সঠিক point দিন','error');return;}
    try{const ref=FB.doc(FB.db,'customer_loyalty',c.id);await FB.setDoc(ref,{customerId:c.id,customerName:c.name,phone:c.phone,points:(c.points||0)+points,updatedBy:this.uid(),updatedAt:FB.serverTimestamp()},{merge:true});await FB.setDoc(FB.doc(FB.db,'crm_activities',`activity_${Date.now()}`),{customerId:c.id,customerName:c.name,phone:c.phone,type:'loyalty_adjustment',note:`${points} points adjusted`,createdBy:this.uid(),createdAt:FB.serverTimestamp()});await this.refresh();toast('Loyalty point আপডেট হয়েছে','success');}catch(e){toast(e.message,'error');}
  },
  exportCsv(){const head=['Customer ID','Name','Phone','Email','Branch','Segment','Orders','Lifetime Value','Last Order','Loyalty Points','Wallet'];const rows=this.customers.map(c=>[c.id,c.name,c.phone,c.email,c.branch,c.segment,c.orders.length,c.deliveredValue,this.date(c.lastOrderAt),c.points,c.wallet]);const csv=[head,...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='golapi-customer-relationship-report.csv';a.click();URL.revokeObjectURL(a.href);}
};
window.CRMOffice=CRMOffice;
const AssetERP={
  assets:[],assignments:[],maintenance:[],audits:[],disposals:[],staff:[],
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  bn(v){return typeof bn==='function'?bn(v):String(v);},
  money(v){return '৳'+Number(v||0).toLocaleString('bn-BD',{maximumFractionDigits:0});},
  uid(){return FB?.auth?.currentUser?.uid||'';},
  date(v){if(!v)return '—';const d=v.toDate?v.toDate():new Date(v);return isNaN(d)?'—':d.toLocaleString('bn-BD',{dateStyle:'medium'});},
  async render(){if(typeof EmployeeWorkspace!=='undefined')EmployeeWorkspace.mountCurrent('assetEmployeeWorkspace');await this.refresh();},
  async refresh(){
    try{
      const names=['company_assets','asset_assignments','asset_maintenance','asset_audits','asset_disposals','staff'];
      const snaps=await Promise.all(names.map(n=>FB.getDocs(FB.collection(FB.db,n)).catch(()=>null)));
      const arr=s=>{const a=[];s?.forEach(x=>a.push({id:x.id,...x.data()}));return a};
      [this.assets,this.assignments,this.maintenance,this.audits,this.disposals,this.staff]=snaps.map(arr);
      this.renderAll();
      const u=document.getElementById('assetUpdated');if(u)u.textContent='Updated '+new Date().toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
    }catch(e){toast(e.message,'error')}
  },
  currentAssignment(assetId){return this.assignments.find(a=>a.assetId===assetId&&!a.returnedAt&&a.status!=='returned')},
  depreciation(asset){
    const cost=Number(asset.purchaseCost||0),residual=Number(asset.residualValue||0),life=Math.max(1,Number(asset.usefulLifeYears||3));
    const purchase=asset.purchaseDate?new Date(asset.purchaseDate):null;
    if(!purchase||!Number.isFinite(purchase.getTime()))return {annual:0,accumulated:0,book:cost,percent:0};
    const years=Math.max(0,(Date.now()-purchase.getTime())/(365.25*86400000));
    const annual=Math.max(0,(cost-residual)/life),accumulated=Math.min(cost-residual,annual*years),book=Math.max(residual,cost-accumulated);
    return {annual,accumulated,book,percent:cost?accumulated/cost*100:0};
  },
  warrantyExpiring(){const now=Date.now(),limit=now+30*86400000;return this.assets.filter(a=>a.warrantyEnd&&new Date(a.warrantyEnd).getTime()>=now&&new Date(a.warrantyEnd).getTime()<=limit)},
  maintenanceDue(){return this.maintenance.filter(m=>m.status==='scheduled'&&m.scheduledDate&&new Date(m.scheduledDate)<=new Date(Date.now()+7*86400000))},
  renderAll(){
    const assigned=this.assets.filter(a=>a.status==='assigned'||this.currentAssignment(a.id)),available=this.assets.filter(a=>(a.status||'available')==='available'&&!this.currentAssignment(a.id)),book=this.assets.reduce((n,a)=>n+this.depreciation(a).book,0);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('assetTotal',this.bn(this.assets.length));set('assetAssigned',this.bn(assigned.length));set('assetAvailable',this.bn(available.length));set('assetMaintenance',this.bn(this.maintenanceDue().length));set('assetWarranty',this.bn(this.warrantyExpiring().length));set('assetBookValue',this.money(book));
    this.renderPriority();this.renderAssets();this.renderAssignments();this.renderMaintenance();this.renderDepreciation();this.renderAudits();this.renderDisposals();this.populate();
  },
  renderPriority(){
    const items=[],overdueReturns=this.assignments.filter(a=>!a.returnedAt&&a.expectedReturn&&new Date(a.expectedReturn)<new Date()),warranty=this.warrantyExpiring(),maintenance=this.maintenanceDue(),lost=this.assets.filter(a=>a.status==='lost'),auditVariance=this.audits.filter(a=>a.status==='variance'||Number(a.missingCount||0)>0);
    if(overdueReturns.length)items.push(`<li><strong>${this.bn(overdueReturns.length)} asset returns overdue</strong><span>Contact employee or manager and recover custody.</span></li>`);
    if(warranty.length)items.push(`<li><strong>${this.bn(warranty.length)} warranties expire within 30 days</strong><span>Complete inspection or warranty claim before expiry.</span></li>`);
    if(maintenance.length)items.push(`<li><strong>${this.bn(maintenance.length)} maintenance items due</strong><span>Schedule service to prevent downtime.</span></li>`);
    if(lost.length)items.push(`<li><strong>${this.bn(lost.length)} assets marked lost</strong><span>Security, HR and finance investigation required.</span></li>`);
    if(auditVariance.length)items.push(`<li><strong>${this.bn(auditVariance.length)} asset audits contain variance</strong><span>Resolve missing or mismatched asset records.</span></li>`);
    document.getElementById('assetPriority').innerHTML=`<div><span class="office-kicker">ASSET PRIORITY</span><h2>${items.length?'Asset control action required':'Asset operations stable'}</h2></div><ul>${items.join('')||'<li><strong>No critical asset risk</strong><span>Continue scheduled audits and maintenance.</span></li>'}</ul>`;
  },
  tab(name,btn){['register','assignments','maintenance','depreciation','audits','disposals'].forEach(x=>document.getElementById(`asset${x[0].toUpperCase()+x.slice(1)}Pane`).hidden=x!==name);document.querySelectorAll('.asset-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active')},
  renderAssets(){
    const q=(document.getElementById('assetSearch')?.value||'').toLowerCase(),cat=document.getElementById('assetCategoryFilter')?.value||'',status=document.getElementById('assetStatusFilter')?.value||'';
    document.getElementById('assetGrid').innerHTML=this.assets.filter(a=>(!cat||a.category===cat)&&(!status||a.status===status)&&(!q||[a.name,a.assetTag,a.serialNumber,a.brand,a.model,a.assignedToName].some(v=>String(v||'').toLowerCase().includes(q)))).map(a=>{const asg=this.currentAssignment(a.id),dep=this.depreciation(a);return`<article class="${this.esc(a.status||'available')}"><div class="asset-card-head"><div><span>${this.esc(a.category||'asset')}</span><h3>${this.esc(a.name||'Company Asset')}</h3><p>${this.esc(a.assetTag||'')} · ${this.esc(a.serialNumber||'')}</p></div><b>${this.esc(a.status||'available')}</b></div><div class="asset-meta"><span>Brand/Model: ${this.esc([a.brand,a.model].filter(Boolean).join(' ')||'—')}</span><span>Branch: ${this.esc(a.branch||'—')}</span><span>Location: ${this.esc(a.location||'—')}</span><span>Assignee: ${this.esc(asg?.employeeName||a.assignedToName||'Unassigned')}</span><span>Purchase Cost: ${this.money(a.purchaseCost)}</span><span>Book Value: ${this.money(dep.book)}</span></div><div class="asset-actions">${!asg&&a.status!=='retired'?`<button onclick="AssetERP.openAssignment('${a.id}')">Assign</button>`:''}${asg?`<button onclick="AssetERP.returnAsset('${asg.id}','${a.id}')">Return</button>`:''}<button onclick="AssetERP.openMaintenance('${a.id}')">Maintenance</button><button onclick="AssetERP.openDisposal('${a.id}')">Dispose</button></div></article>`}).join('')||'<p>No asset found</p>';
  },
  renderAssignments(){document.getElementById('assetAssignmentList').innerHTML=[...this.assignments].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(a=>`<article class="${a.returnedAt?'returned':'active'}"><div><strong>${this.esc(a.assetName||'Asset')} → ${this.esc(a.employeeName||'Employee')}</strong><span>${this.esc(a.employeeId||'')} · Condition ${this.esc(a.condition||'good')}</span><p>${this.esc(a.accessories||'')} · Assigned ${this.esc(a.assignedDate||'—')} · Expected ${this.esc(a.expectedReturn||'—')}</p></div><div><small>${a.returnedAt?'returned':'assigned'}</small>${!a.returnedAt?`<button onclick="AssetERP.returnAsset('${a.id}','${a.assetId}')">Return</button>`:''}</div></article>`).join('')||'<p>No assignment history</p>'},
  renderMaintenance(){document.getElementById('assetMaintenanceList').innerHTML=this.maintenance.map(m=>`<article class="${this.esc(m.status||'scheduled')}"><div><strong>${this.esc(m.assetName||'Asset')} · ${this.esc(m.type||'Maintenance')}</strong><span>${this.esc(m.vendor||'')} · ${this.money(m.estimatedCost)}</span><p>${this.esc(m.description||'')} · ${this.esc(m.scheduledDate||'—')}</p></div><div><small>${this.esc(m.status||'scheduled')}</small>${m.status!=='completed'?`<button onclick="AssetERP.completeMaintenance('${m.id}','${m.assetId}')">Complete</button>`:''}</div></article>`).join('')||'<p>No maintenance record</p>'},
  renderDepreciation(){document.getElementById('assetDepreciationGrid').innerHTML=this.assets.map(a=>{const d=this.depreciation(a);return`<article><span>${this.esc(a.category||'asset')}</span><h3>${this.esc(a.name||'Asset')}</h3><div class="asset-value">${this.money(d.book)}</div><div class="asset-depreciation-bar"><i style="width:${Math.min(100,d.percent)}%"></i></div><p>Cost ${this.money(a.purchaseCost)} · Accumulated ${this.money(d.accumulated)}</p><small>Annual depreciation ${this.money(d.annual)}</small></article>`}).join('')||'<p>No asset data</p>'},
  renderAudits(){document.getElementById('assetAuditList').innerHTML=this.audits.map(a=>`<article class="${a.status==='variance'?'critical':this.esc(a.priority||'normal')}"><div><strong>${this.esc(a.name||'Asset Audit')}</strong><span>${this.esc(a.branch||'All branches')} · ${this.esc(a.scope||'all')}</span><p>Expected ${this.bn(a.expectedCount||0)} · Verified ${this.bn(a.verifiedCount||0)} · Missing ${this.bn(a.missingCount||0)}</p></div><div><small>${this.esc(a.status||'scheduled')} · ${this.esc(a.scheduledDate||'')}</small>${a.status==='scheduled'?`<button onclick="AssetERP.performAudit('${a.id}')">Enter Result</button>`:''}${a.status==='variance'?`<button onclick="AssetERP.resolveAudit('${a.id}')">Resolve</button>`:''}</div></article>`).join('')||'<p>No asset audit</p>'},
  renderDisposals(){document.getElementById('assetDisposalList').innerHTML=this.disposals.map(d=>`<article><div><strong>${this.esc(d.assetName||'Asset')} · ${this.esc(d.method||'write_off')}</strong><span>Recovery ${this.money(d.recoveryAmount)} · Approved by ${this.esc(d.approvedBy||'—')}</span><p>${this.esc(d.reason||'')} · ${this.esc(d.disposalDate||'')}</p></div><div><small>${this.esc(d.status||'pending')}</small>${d.status==='pending'?`<button onclick="AssetERP.setDisposal('${d.id}','approved')">Approve</button>`:''}${d.status==='approved'?`<button onclick="AssetERP.completeDisposal('${d.id}','${d.assetId}')">Complete</button>`:''}</div></article>`).join('')||'<p>No disposal record</p>'},
  populate(){
    const staff=this.staff.filter(s=>s.active!==false&&!['inactive','resigned','suspended'].includes(s.status)).map(s=>`<option value="${this.esc(s.uid||s.id)}">${this.esc(s.name||'Employee')} · ${this.esc(s.employeeId||s.designation||'')}</option>`).join('');
    ['assetAssignmentEmployee','assetAuditAuditor'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=staff});
    const available=this.assets.filter(a=>(a.status||'available')==='available'&&!this.currentAssignment(a.id)).map(a=>`<option value="${this.esc(a.id)}">${this.esc(a.name||'Asset')} · ${this.esc(a.assetTag||a.serialNumber||'')}</option>`).join('');
    const all=this.assets.filter(a=>a.status!=='retired').map(a=>`<option value="${this.esc(a.id)}">${this.esc(a.name||'Asset')} · ${this.esc(a.assetTag||a.serialNumber||'')}</option>`).join('');
    const assign=document.getElementById('assetAssignmentAsset');if(assign)assign.innerHTML=available;
    ['assetMaintenanceAsset','assetDisposalAsset'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=all});
  },
  open(id){document.getElementById(id).classList.add('open')},
  close(id){document.getElementById(id).classList.remove('open')},
  openAssignment(assetId=''){this.populate();document.getElementById('assetAssignmentDate').value=new Date().toISOString().slice(0,10);if(assetId)document.getElementById('assetAssignmentAsset').value=assetId;this.open('assetAssignmentModal')},
  openMaintenance(assetId=''){this.populate();if(assetId)document.getElementById('assetMaintenanceAsset').value=assetId;this.open('assetMaintenanceModal')},
  openAudit(){this.populate();document.getElementById('assetAuditDate').value=new Date().toISOString().slice(0,10);this.open('assetAuditModal')},
  openDisposal(assetId=''){this.populate();document.getElementById('assetDisposalDate').value=new Date().toISOString().slice(0,10);if(assetId)document.getElementById('assetDisposalAsset').value=assetId;this.open('assetDisposalModal')},
  async saveAsset(){
    const name=document.getElementById('assetName').value.trim(),tag=document.getElementById('assetTag').value.trim();if(!name||!tag)return toast('Asset name and tag required','error');
    await FB.setDoc(FB.doc(FB.db,'company_assets',`asset_${Date.now()}`),{name,category:document.getElementById('assetCategory').value,assetTag:tag,serialNumber:document.getElementById('assetSerial').value.trim(),brand:document.getElementById('assetBrand').value.trim(),model:document.getElementById('assetModel').value.trim(),branch:document.getElementById('assetBranch').value.trim(),location:document.getElementById('assetLocation').value.trim(),purchaseDate:document.getElementById('assetPurchaseDate').value,purchaseCost:+document.getElementById('assetPurchaseCost').value||0,usefulLifeYears:+document.getElementById('assetLife').value||3,residualValue:+document.getElementById('assetResidual').value||0,warrantyEnd:document.getElementById('assetWarrantyEnd').value,status:document.getElementById('assetState').value,notes:document.getElementById('assetNotes').value.trim(),createdBy:this.uid(),createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()});this.close('assetRegisterModal');await this.refresh()
  },
  async saveAssignment(){
    const assetId=document.getElementById('assetAssignmentAsset').value,employeeUid=document.getElementById('assetAssignmentEmployee').value,a=this.assets.find(x=>x.id===assetId),s=this.staff.find(x=>(x.uid||x.id)===employeeUid);if(!a||!s)return toast('Asset and employee required','error');
    await FB.setDoc(FB.doc(FB.db,'asset_assignments',`assignment_${Date.now()}`),{assetId,assetName:a.name||'',assetTag:a.assetTag||'',employeeUid,employeeName:s.name||'',employeeId:s.employeeId||'',assignedDate:document.getElementById('assetAssignmentDate').value,expectedReturn:document.getElementById('assetAssignmentReturn').value,condition:document.getElementById('assetAssignmentCondition').value,accessories:document.getElementById('assetAssignmentAccessories').value.trim(),custodyTerms:document.getElementById('assetAssignmentTerms').value.trim(),status:'assigned',assignedBy:this.uid(),createdAt:FB.serverTimestamp()});
    await FB.setDoc(FB.doc(FB.db,'company_assets',assetId),{status:'assigned',assignedToUid:employeeUid,assignedToName:s.name||'',updatedAt:FB.serverTimestamp()},{merge:true});this.close('assetAssignmentModal');await this.refresh()
  },
  async returnAsset(assignmentId,assetId){
    const condition=prompt('Return condition লিখুন','good');if(condition===null)return;
    await FB.setDoc(FB.doc(FB.db,'asset_assignments',assignmentId),{status:'returned',returnedAt:FB.serverTimestamp(),returnCondition:condition,returnedBy:this.uid()},{merge:true});
    await FB.setDoc(FB.doc(FB.db,'company_assets',assetId),{status:'available',assignedToUid:'',assignedToName:'',updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()
  },
  async saveMaintenance(){
    const assetId=document.getElementById('assetMaintenanceAsset').value,a=this.assets.find(x=>x.id===assetId);if(!a)return toast('Asset required','error');
    const status=document.getElementById('assetMaintenanceStatus').value;
    await FB.setDoc(FB.doc(FB.db,'asset_maintenance',`maintenance_${Date.now()}`),{assetId,assetName:a.name||'',type:document.getElementById('assetMaintenanceType').value,scheduledDate:document.getElementById('assetMaintenanceDate').value,vendor:document.getElementById('assetMaintenanceVendor').value.trim(),estimatedCost:+document.getElementById('assetMaintenanceCost').value||0,status,description:document.getElementById('assetMaintenanceDescription').value.trim(),createdBy:this.uid(),createdAt:FB.serverTimestamp()});
    if(status!=='completed')await FB.setDoc(FB.doc(FB.db,'company_assets',assetId),{status:'maintenance',updatedAt:FB.serverTimestamp()},{merge:true});
    this.close('assetMaintenanceModal');await this.refresh()
  },
  async completeMaintenance(id,assetId){await FB.setDoc(FB.doc(FB.db,'asset_maintenance',id),{status:'completed',completedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await FB.setDoc(FB.doc(FB.db,'company_assets',assetId),{status:'available',updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  async saveAudit(){
    const name=document.getElementById('assetAuditName').value.trim(),branch=document.getElementById('assetAuditBranch').value.trim(),scope=document.getElementById('assetAuditScope').value,auditorUid=document.getElementById('assetAuditAuditor').value,s=this.staff.find(x=>(x.uid||x.id)===auditorUid);if(!name)return toast('Audit name required','error');
    let expected=this.assets.length;if(scope==='assigned')expected=this.assets.filter(a=>a.status==='assigned'||this.currentAssignment(a.id)).length;if(scope==='high_value')expected=this.assets.filter(a=>Number(a.purchaseCost||0)>=50000).length;if(scope==='selected_branch')expected=this.assets.filter(a=>a.branch===branch).length;
    await FB.setDoc(FB.doc(FB.db,'asset_audits',`audit_${Date.now()}`),{name,branch,scheduledDate:document.getElementById('assetAuditDate').value,auditorUid,auditorName:s?.name||'',scope,priority:document.getElementById('assetAuditPriority').value,expectedCount:expected,verifiedCount:0,missingCount:0,status:'scheduled',createdBy:this.uid(),createdAt:FB.serverTimestamp()});this.close('assetAuditModal');await this.refresh()
  },
  async performAudit(id){const a=this.audits.find(x=>x.id===id);if(!a)return;const raw=prompt(`Verified asset count লিখুন (Expected ${a.expectedCount||0})`,String(a.expectedCount||0));if(raw===null)return;const verified=Number(raw);if(!Number.isFinite(verified))return;const missing=Math.max(0,Number(a.expectedCount||0)-verified);await FB.setDoc(FB.doc(FB.db,'asset_audits',id),{verifiedCount:verified,missingCount:missing,status:missing?'variance':'completed',auditedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  async resolveAudit(id){await FB.setDoc(FB.doc(FB.db,'asset_audits',id),{status:'resolved',resolvedAt:FB.serverTimestamp(),resolvedBy:this.uid(),updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  async saveDisposal(){
    const assetId=document.getElementById('assetDisposalAsset').value,a=this.assets.find(x=>x.id===assetId);if(!a)return toast('Asset required','error');
    await FB.setDoc(FB.doc(FB.db,'asset_disposals',`disposal_${Date.now()}`),{assetId,assetName:a.name||'',assetTag:a.assetTag||'',method:document.getElementById('assetDisposalMethod').value,disposalDate:document.getElementById('assetDisposalDate').value,recoveryAmount:+document.getElementById('assetDisposalRecovery').value||0,approvedBy:document.getElementById('assetDisposalApprover').value.trim(),status:document.getElementById('assetDisposalStatus').value,reason:document.getElementById('assetDisposalReason').value.trim(),createdBy:this.uid(),createdAt:FB.serverTimestamp()});this.close('assetDisposalModal');await this.refresh()
  },
  async setDisposal(id,status){await FB.setDoc(FB.doc(FB.db,'asset_disposals',id),{status,updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  async completeDisposal(id,assetId){await FB.setDoc(FB.doc(FB.db,'asset_disposals',id),{status:'completed',completedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await FB.setDoc(FB.doc(FB.db,'company_assets',assetId),{status:'retired',retiredAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  exportAssets(){const rows=[['Asset','Category','Tag','Serial','Brand','Model','Branch','Location','Status','Assignee','Purchase Cost','Book Value','Warranty End'],...this.assets.map(a=>{const asg=this.currentAssignment(a.id);return[a.name,a.category,a.assetTag,a.serialNumber,a.brand,a.model,a.branch,a.location,a.status,asg?.employeeName||a.assignedToName||'',a.purchaseCost,this.depreciation(a).book,a.warrantyEnd]})];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download='golapi-company-assets.csv';a.click()}
};window.AssetERP=AssetERP;
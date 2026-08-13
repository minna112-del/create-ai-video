/* employee-management.js — People Operations Office */
const EmployeeManagement = {
  records: [], editingUid: null, photoFile: null,
  salaryGrades:['Intern','Trainee','Grade 1','Grade 2','Grade 3','Grade 4','Manager','Executive'],
  shifts:['General (9:00 AM–6:00 PM)','Morning (7:00 AM–3:00 PM)','Evening (3:00 PM–11:00 PM)','Night (11:00 PM–7:00 AM)','Flexible / Remote'],
  roles: {
    admin:{label:'CEO / Executive',designation:'Chief Executive Officer (CEO)',department:'Executive Office',workspace:'Executive Command Center',code:'CEO',uniform:'Executive Formal — dark suit/blazer, white shirt'},
    zone_manager:{label:'Zone Operations Manager',designation:'Zone Operations Manager',department:'Operations Division',workspace:'Zone Operations Center',code:'ZOM',uniform:'Management Formal — company blazer/shirt'},
    inventory_manager:{label:'Inventory Manager',designation:'Inventory Control Manager',department:'Supply & Inventory',workspace:'Inventory Control Room',code:'ICM',uniform:'Operations Uniform — branded polo/vest'},
    warehouse_manager:{label:'Warehouse Manager',designation:'Warehouse Operations Manager',department:'Fulfilment & Warehouse',workspace:'Warehouse Control Room',code:'WHM',uniform:'Warehouse Operations Uniform — branded polo/vest, safety shoes, ID badge'},
    logistics_manager:{label:'Delivery Operations Manager',designation:'Last-Mile Logistics Manager',department:'Last-Mile Logistics',workspace:'Advanced Warehouse ERP',code:'LCM',uniform:'Logistics Management Uniform — company blazer/polo, dark trousers, ID badge'},
    attendance_officer:{label:'Attendance & Time Officer',designation:'Attendance & Workforce Time Officer',department:'People Operations',workspace:'Attendance & Time Office',code:'ATO',uniform:'People Operations Formal — company shirt/blazer, dark trousers, ID badge'},
    payroll_officer:{label:'Payroll Officer',designation:'Payroll & Compensation Officer',department:'Finance & People Operations',workspace:'Payroll Office',code:'PRO',uniform:'Finance Office Formal — company blazer, white shirt, dark trousers, ID badge'},
    procurement:{label:'Procurement Officer',designation:'Procurement & Supplier Relations Officer',department:'Supply Chain Division',workspace:'Procurement & Vendor Management Office',code:'PRC',uniform:'Supply Chain Formal — company shirt/blazer, dark trousers, ID badge'},
    chief_procurement_officer:{label:'Chief Procurement Officer',designation:'Chief Procurement Officer',department:'Supply Chain & Vendor Governance',workspace:'Procurement & Vendor Management Office',code:'CPO',uniform:'Executive Supply Chain Formal — company blazer, white shirt, dark trousers, ID badge'},
    vendor_relationship_officer:{label:'Vendor Relationship Officer',designation:'Vendor Relationship & Compliance Officer',department:'Supply Chain & Vendor Governance',workspace:'Procurement & Vendor Management Office',code:'VRO',uniform:'Supply Chain Formal — company shirt/blazer, dark trousers, ID badge'},
    asset_officer:{label:'Asset Management Officer',designation:'Corporate Asset & Equipment Officer',department:'Operations & Administration',workspace:'Company Asset Management',code:'AMO',uniform:'Corporate Operations Formal — company shirt/blazer, dark trousers, ID badge'},
    branch_manager:{label:'Branch Manager',designation:'Branch Operations Manager',department:'Branch Operations',workspace:'Branch Management Office',code:'BRM',uniform:'Branch Management Formal — company blazer/shirt, dark trousers, ID badge'},
    crm_manager:{label:'CRM Manager',designation:'Customer Relationship & Loyalty Manager',department:'Customer Growth & Experience',workspace:'Customer Relationship Office',code:'CRM',uniform:'Customer Experience Formal — company blazer/shirt, dark trousers, ID badge'},
    company_systems_officer:{label:'Company Systems Officer',designation:'Company OS & Digital Workplace Officer',department:'Technology & Governance',workspace:'Golapi Company OS',code:'CSO',uniform:'Technology Office Formal — company blazer/shirt, dark trousers, ID badge'},
    ai_operations_manager:{label:'AI Operations Manager',designation:'AI Operations & Automation Manager',department:'AI, Data & Automation',workspace:'AI Control Center',code:'AIO',uniform:'AI Operations Formal — company blazer/shirt, dark trousers, ID badge'},
    security_officer:{label:'Security Officer',designation:'Information Security & Audit Officer',department:'Security, Risk & Governance',workspace:'Company Settings & Access',code:'SEC',uniform:'Security Governance Formal — company blazer/shirt, dark trousers, ID badge'},
    chief_executive_officer:{label:'Chief Executive Officer',designation:'Chief Executive Officer',department:'Executive Office',workspace:'Executive Command Center',code:'CEO',uniform:'Executive Leadership Formal — premium company suit/blazer, white shirt, ID badge'},
    talent_development_manager:{label:'Talent Development Manager',designation:'Talent Acquisition & Development Manager',department:'People & Culture',workspace:'Human Resources ERP',code:'TDM',uniform:'People Operations Formal — company blazer/shirt, dark trousers, ID badge'},
    financial_controller:{label:'Financial Controller',designation:'Financial Controller & Chief Accountant',department:'Finance & Accounting',workspace:'Finance ERP',code:'FCO',uniform:'Finance Executive Formal — company blazer, white shirt, dark trousers, ID badge'},
    warehouse_systems_manager:{label:'Warehouse Systems Manager',designation:'Warehouse Systems & Inventory Accuracy Manager',department:'Warehouse & Fulfillment',workspace:'Advanced Warehouse ERP',code:'WSM',uniform:'Warehouse Management Formal — company collared shirt/jacket, dark trousers, safety shoes, ID badge'},
    fleet_operations_manager:{label:'Fleet Operations Manager',designation:'Fleet & Logistics Operations Manager',department:'Fleet, Logistics & Delivery',workspace:'Advanced Warehouse ERP',code:'FLM',uniform:'Logistics Management Formal — company collared shirt/jacket, dark trousers, safety shoes, ID badge'},
    growth_automation_manager:{label:'Growth Automation Manager',designation:'Growth Marketing & Automation Manager',department:'Marketing, CRM & Growth',workspace:'Marketing Automation Center',code:'GAM',uniform:'Growth Office Formal — company blazer/shirt, dark trousers, ID badge'},
    legal_compliance_officer:{label:'Legal & Compliance Officer',designation:'Legal, Policy & Compliance Officer',department:'Legal, Risk & Governance',workspace:'Company Settings & Access',code:'LCO',uniform:'Legal Governance Formal — company blazer, white shirt, dark trousers, ID badge'},
    workflow_automation_manager:{label:'Workflow Automation Manager',designation:'Workflow, Process & Automation Manager',department:'Business Process & Automation',workspace:'Workflow Automation Engine',code:'WAM',uniform:'Business Automation Formal — company blazer/shirt, dark trousers, ID badge'},
    business_intelligence_manager:{label:'Business Intelligence Manager',designation:'Business Intelligence & Performance Analytics Manager',department:'Data, Analytics & Strategy',workspace:'Business Intelligence Center',code:'BIM',uniform:'Data Strategy Formal — company blazer/shirt, dark trousers, ID badge'},
    asset_lifecycle_manager:{label:'Asset Lifecycle Manager',designation:'Company Asset & Lifecycle Management Officer',department:'Administration, Assets & Facilities',workspace:'Company Asset Management',code:'ALM',uniform:'Asset Administration Formal — company blazer/collared shirt, dark trousers, ID badge'},
    customer_experience_manager:{label:'Customer Experience Manager',designation:'Customer Experience & Service Operations Manager',department:'Customer Experience, CRM & Support',workspace:'Customer Service CRM',code:'CXM',uniform:'Customer Experience Formal — company blazer/shirt, dark trousers, ID badge'},
    procurement_vendor_manager:{label:'Procurement & Vendor Manager',designation:'Procurement, Sourcing & Vendor Management Manager',department:'Procurement, Supply & Vendor Management',workspace:'Procurement & Vendor ERP',code:'PVM',uniform:'Procurement Management Formal — company blazer/collared shirt, dark trousers, ID badge'},
    facilities_operations_manager:{label:'Facilities Operations Manager',designation:'Facilities, Branch & Workplace Operations Manager',department:'Facilities, Administration & Branch Operations',workspace:'Facilities & Branch Operations ERP',code:'FOM',uniform:'Facilities Management Formal — company collared shirt/jacket, dark trousers, safety shoes, ID badge'},
    document_officer:{label:'Document & Records Officer',designation:'Document & Records Officer',department:'People Operations & Governance',workspace:'Document Management Office',code:'DRO',uniform:'Corporate Office Formal — company shirt/blazer, dark trousers, ID badge'},
    governance_officer:{label:'Governance & Compliance Officer',designation:'Governance & Access Control Officer',department:'Executive Governance',workspace:'Company Settings & Access Control',code:'GAC',uniform:'Executive Corporate Formal — company blazer, white shirt, dark trousers, ID badge'},
    analytics_manager:{label:'Business Intelligence Manager',designation:'Business Intelligence & Analytics Manager',department:'Strategy & Analytics',workspace:'Analytics & Reports Center',code:'BIA',uniform:'Executive Business Formal — company blazer, white shirt, dark trousers, ID badge'},
    finance:{label:'Finance Officer',designation:'Finance & Accounts Officer',department:'Finance Division',workspace:'Finance Office',code:'FAO',uniform:'Corporate Formal — white shirt, dark trousers'},
    support:{label:'Customer Care Executive',designation:'Customer Care Executive',department:'Customer Experience',workspace:'Customer Care Center',code:'CCE',uniform:'Customer Care Uniform — branded formal shirt'},
    customer_care_manager:{label:'Customer Care Manager',designation:'Customer Care Manager',department:'Customer Experience',workspace:'Customer Care Center',code:'CCM',uniform:'Customer Experience Management — company blazer/formal shirt, dark trousers, ID badge'},
    driver:{label:'Delivery Rider',designation:'Delivery Rider',department:'Last-Mile Logistics',workspace:'Delivery Operations Desk',code:'DLR',uniform:'Golapi Delivery Uniform — helmet, jacket/jersey, ID badge'},
    hr:{label:'People & Culture Officer',designation:'People & Culture Officer',department:'People Operations',workspace:'People & Culture Office',code:'PCO',uniform:'Corporate Formal'},
    marketing:{label:'Growth & Marketing Executive',designation:'Growth & Marketing Executive',department:'Growth Division',workspace:'Growth Studio',code:'GME',uniform:'Smart Business Casual'},
    designer:{label:'Creative Designer',designation:'Creative Designer',department:'Creative Division',workspace:'Creative Studio',code:'CRD',uniform:'Smart Business Casual'},
    developer:{label:'Software Engineer',designation:'Software Engineer',department:'Engineering Division',workspace:'Engineering Studio',code:'SWE',uniform:'Smart Business Casual'}
  },
  esc(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); },
  statusLabel(status){return ({active:'সক্রিয়',probation:'প্রবেশন',leave:'ছুটিতে',pending:'অপেক্ষমাণ',suspended:'স্থগিত',resigned:'পদত্যাগ',inactive:'নিষ্ক্রিয়'})[status]||status||'অজানা';},
  isOperational(status){return ['active','probation','leave'].includes(status);},
  async load(){
    if(!window.FB) return;
    this.populateControls();
    try{
      const snap=await FB.getDocs(FB.collection(FB.db,'staff'));
      this.records=[]; snap.forEach(d=>this.records.push({uid:d.id,...d.data()}));
      this.records.sort((a,b)=>(a.name||'').localeCompare(b.name||'','bn'));
      this.render();
    }catch(e){ toast('কর্মীর তালিকা লোড হয়নি: '+e.message,'error'); }
  },
  populateControls(){
    const roleFilter=document.getElementById('employeeRoleFilter');
    const roleInput=document.getElementById('empRole');
    const options=Object.entries(this.roles).map(([k,v])=>`<option value="${k}">${this.esc(v.label)}</option>`).join('');
    if(roleFilter && roleFilter.options.length<=1) roleFilter.insertAdjacentHTML('beforeend',options);
    if(roleInput) roleInput.innerHTML=options;
    const branch=document.getElementById('empBranch');
    if(branch) branch.innerHTML='<option value="Head Office">Head Office</option>'+Object.entries(window.BRANCH_INFO||{}).map(([id,b])=>`<option value="${this.esc(b.label||id)}">${this.esc(b.label||id)}</option>`).join('');
    const manager=document.getElementById('empReportingManager');
    if(manager){
      const selected=manager.value;
      manager.innerHTML='<option value="">কোনো রিপোর্টিং ম্যানেজার নেই</option>'+this.records.filter(x=>x.uid!==this.editingUid).map(x=>`<option value="${this.esc(x.uid)}">${this.esc(x.name||x.employeeId||x.uid)} — ${this.esc(x.designation||'Team Member')}</option>`).join('');
      manager.value=selected;
    }
    const grade=document.getElementById('empSalaryGrade');
    if(grade && !grade.options.length) grade.innerHTML=this.salaryGrades.map(x=>`<option value="${this.esc(x)}">${this.esc(x)}</option>`).join('');
    const shift=document.getElementById('empShift');
    if(shift && !shift.options.length) shift.innerHTML=this.shifts.map(x=>`<option value="${this.esc(x)}">${this.esc(x)}</option>`).join('');
  },
  render(){
    const host=document.getElementById('employeeDirectory'); if(!host) return;
    const q=(document.getElementById('employeeSearch')?.value||'').trim().toLowerCase();
    const role=document.getElementById('employeeRoleFilter')?.value||'';
    const status=document.getElementById('employeeStatusFilter')?.value||'';
    let list=this.records.filter(x=>(!role||x.role===role)&&(!status||(x.status||(x.active===false?'inactive':'active'))===status));
    if(q) list=list.filter(x=>[x.name,x.employeeId,x.designation,x.phone,x.department].some(v=>String(v||'').toLowerCase().includes(q)));
    const active=this.records.filter(x=>this.isOperational(x.status||(x.active===false?'inactive':'active'))).length;
    const pending=this.records.filter(x=>(x.status||'')==='pending').length;
    const deps=new Set(this.records.map(x=>x.department).filter(Boolean)).size;
    const put=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=typeof bn==='function'?bn(v):v};
    put('empStatTotal',this.records.length);put('empStatActive',active);put('empStatPending',pending);put('empStatDepartments',deps);
    if(!list.length){host.innerHTML='<div class="employee-empty">কোনো কর্মী পাওয়া যায়নি। “নতুন কর্মী নিয়োগ” থেকে প্রথম অফিস ডেস্ক তৈরি করুন।</div>';return;}
    host.innerHTML=list.map(x=>{
      const cfg=this.roles[x.role]||{}; const st=x.status||(x.active===false?'inactive':'active');
      const photo=x.photoURL||x.photoUrl||'icons/head_logo.webp';
      const manager=this.records.find(m=>m.uid===x.reportingManagerUid);
      return `<article class="employee-directory-card">
        <div class="employee-directory-main"><img src="${this.esc(photo)}" onerror="this.src='icons/head_logo.webp'" alt="${this.esc(x.name)}"><div><span class="employee-status ${st}">${this.statusLabel(st)}</span><h3>${this.esc(x.name||'নাম দেওয়া হয়নি')}</h3><p>${this.esc(x.designation||cfg.designation||'Team Member')}</p><b>${this.esc(x.employeeId||'ID অপেক্ষমাণ')}</b></div></div>
        <dl><div><dt>বিভাগ</dt><dd>${this.esc(x.department||cfg.department||'—')}</dd></div><div><dt>অফিস ডেস্ক</dt><dd>${this.esc(x.workspaceName||cfg.workspace||'—')}</dd></div><div><dt>শিফট</dt><dd>${this.esc(x.shift||'General')}</dd></div><div><dt>বেতন গ্রেড</dt><dd>${this.esc(x.salaryGrade||'—')}</dd></div><div><dt>যোগদানের তারিখ</dt><dd>${this.esc(x.joiningDate||'—')}</dd></div><div><dt>রিপোর্টিং ম্যানেজার</dt><dd>${this.esc(manager?.name||x.reportingManagerName||'Direct / Not assigned')}</dd></div></dl>
        <div class="employee-directory-actions"><button onclick="EmployeeManagement.showId('${this.esc(x.uid)}')">🪪 ID Card</button><button onclick="EmployeeManagement.openEdit('${this.esc(x.uid)}')">✏️ এডিট</button><button class="danger" onclick="EmployeeManagement.toggleStatus('${this.esc(x.uid)}')">${this.isOperational(st)?'ডেস্ক স্থগিত':'সক্রিয় করুন'}</button></div>
      </article>`;
    }).join('');
  },
  nextId(role){
    const cfg=this.roles[role]||{code:'EMP'};
    const nums=this.records.filter(x=>(x.employeeId||'').startsWith('GS-'+cfg.code+'-')).map(x=>Number((x.employeeId||'').split('-').pop())).filter(Number.isFinite);
    return `GS-${cfg.code}-${String((Math.max(0,...nums)+1)).padStart(4,'0')}`;
  },
  openCreate(){
    this.editingUid=null; this.photoFile=null; this.populateControls();
    ['empName','empUid','empEmail','empPhone','empDesignation','empDepartment','empWorkspace','empEmployeeId','empUniform','empResponsibilities','empJoiningDate','empProbationEnd','empEmergencyContact','empEmergencyPhone'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
    document.getElementById('empRole').value='support'; document.getElementById('empStatus').value='probation';
    document.getElementById('empSalaryGrade').value='Grade 1'; document.getElementById('empShift').value='General (9:00 AM–6:00 PM)'; document.getElementById('empReportingManager').value='';
    document.getElementById('empJoiningDate').value=new Date().toISOString().slice(0,10);
    document.getElementById('empUid').disabled=false; document.getElementById('employeePhotoPreview').src='icons/head_logo.webp';
    document.getElementById('employeeFormTitle').textContent='নতুন কর্মী নিয়োগ ও ডেস্ক বরাদ্দ';
    this.applyRoleDefaults(true); this.openForm();
  },
  openEdit(uid){
    const x=this.records.find(r=>r.uid===uid); if(!x)return;
    this.editingUid=uid; this.photoFile=null; this.populateControls();
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||''};
    set('empName',x.name);set('empUid',uid);set('empEmail',x.email);set('empPhone',x.phone);set('empRole',x.role||'support');set('empDesignation',x.designation);set('empDepartment',x.department);set('empWorkspace',x.workspaceName);set('empEmployeeId',x.employeeId);set('empBranch',x.branchName||x.branchZone||'Head Office');set('empUniform',x.uniform);set('empStatus',x.status||(x.active===false?'inactive':'active'));set('empResponsibilities',x.responsibilities);set('empJoiningDate',x.joiningDate);set('empProbationEnd',x.probationEndDate);set('empSalaryGrade',x.salaryGrade||'Grade 1');set('empShift',x.shift||'General (9:00 AM–6:00 PM)');set('empReportingManager',x.reportingManagerUid);set('empEmergencyContact',x.emergencyContactName);set('empEmergencyPhone',x.emergencyContactPhone);
    document.getElementById('empUid').disabled=true; document.getElementById('employeePhotoPreview').src=x.photoURL||x.photoUrl||'icons/head_logo.webp';
    document.getElementById('employeeFormTitle').textContent='কর্মীর পরিচয় ও অফিস ডেস্ক সম্পাদনা'; this.openForm();
  },
  openForm(){const m=document.getElementById('employeeFormModal');m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'},
  closeForm(){const m=document.getElementById('employeeFormModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}document.body.style.overflow='';},
  applyRoleDefaults(force=false){
    const role=document.getElementById('empRole')?.value; const cfg=this.roles[role]; if(!cfg)return;
    const fill=(id,val)=>{const e=document.getElementById(id);if(e&&(force||!e.value))e.value=val};
    fill('empDesignation',cfg.designation);fill('empDepartment',cfg.department);fill('empWorkspace',cfg.workspace);fill('empUniform',cfg.uniform);fill('empEmployeeId',this.nextId(role));
  },
  previewPhoto(input){const f=input.files?.[0];if(!f)return;if(f.size>5*1024*1024){toast('ছবি সর্বোচ্চ ৫MB হতে পারবে','error');input.value='';return}this.photoFile=f;document.getElementById('employeePhotoPreview').src=URL.createObjectURL(f)},
  async save(){
    const get=id=>document.getElementById(id)?.value.trim()||'';
    const uid=this.editingUid||get('empUid'), name=get('empName'), role=get('empRole'), employeeId=get('empEmployeeId');
    if(!uid||!name||!role||!employeeId||!get('empDesignation')||!get('empDepartment')||!get('empWorkspace')){toast('তারকাচিহ্নিত সব তথ্য পূরণ করুন','error');return;}
    const btn=document.getElementById('employeeSaveBtn');btn.disabled=true;btn.textContent='সংরক্ষণ হচ্ছে...';
    try{
      let photoURL=this.records.find(x=>x.uid===uid)?.photoURL||'';
      if(this.photoFile){const safe=this.photoFile.name.replace(/[^a-zA-Z0-9._-]/g,'_');const ref=FB.storageRef(FB.storage,`staff/${uid}/profile-${Date.now()}-${safe}`);await FB.uploadBytes(ref,this.photoFile);photoURL=await FB.getDownloadURL(ref);}
      const status=get('empStatus')||'probation'; const reportingManagerUid=get('empReportingManager'); const manager=this.records.find(x=>x.uid===reportingManagerUid); const payload={name,email:get('empEmail'),phone:get('empPhone'),role,designation:get('empDesignation'),department:get('empDepartment'),workspaceName:get('empWorkspace'),employeeId,branchName:get('empBranch')||'Head Office',uniform:get('empUniform'),responsibilities:get('empResponsibilities'),status,active:this.isOperational(status),joiningDate:get('empJoiningDate'),probationEndDate:get('empProbationEnd'),salaryGrade:get('empSalaryGrade'),shift:get('empShift'),reportingManagerUid,reportingManagerName:manager?.name||'',emergencyContactName:get('empEmergencyContact'),emergencyContactPhone:get('empEmergencyPhone'),photoURL,updatedAt:FB.serverTimestamp()};
      if(!this.editingUid) payload.createdAt=FB.serverTimestamp();
      await FB.setDoc(FB.doc(FB.db,'staff',uid),payload,{merge:true});
      toast('✓ কর্মীর পরিচয় ও অফিস ডেস্ক সংরক্ষণ হয়েছে','success');this.closeForm();await this.load();
    }catch(e){toast('সংরক্ষণ হয়নি: '+e.message,'error')}finally{btn.disabled=false;btn.textContent='কর্মীর ডেস্ক বরাদ্দ করুন';}
  },
  async toggleStatus(uid){const x=this.records.find(r=>r.uid===uid);if(!x)return;const current=x.status||(x.active===false?'inactive':'active');const next=this.isOperational(current)?'suspended':'active';if(!confirm(next==='suspended'?'এই কর্মীর অফিস ডেস্ক স্থগিত করবেন?':'এই কর্মীর অফিস ডেস্ক সক্রিয় করবেন?'))return;try{await FB.updateDoc(FB.doc(FB.db,'staff',uid),{status:next,active:next==='active',updatedAt:FB.serverTimestamp()});await this.load();toast('স্ট্যাটাস আপডেট হয়েছে','success')}catch(e){toast(e.message,'error')}},
  showId(uid){const x=this.records.find(r=>r.uid===uid);if(!x)return;const box=document.createElement('div');box.className='employee-id-viewer';box.innerHTML=`<div class="employee-modal-backdrop"></div><div class="employee-id-stage"><button aria-label="বন্ধ">×</button><div id="employeeIdMount"></div><p>এই ডিজিটাল পরিচয়পত্রটি কর্মীর নির্ধারিত Workspace-এর সঙ্গে সংযুক্ত।</p></div>`;document.body.appendChild(box);box.querySelector('button').onclick=box.querySelector('.employee-modal-backdrop').onclick=()=>box.remove();EmployeeWorkspace.mount('employeeIdMount',x,uid);}
};
window.EmployeeManagement=EmployeeManagement;

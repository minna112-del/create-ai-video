/* employee-workspace.js — shared employee identity + company ID card */
const EmployeeWorkspace = {
  roleMap: {
    admin:{designation:'Chief Executive Officer (CEO)', department:'Executive Office', workspace:'Executive Command Center', code:'CEO', uniform:'Executive Formal'},
    zone_manager:{designation:'Zone Operations Manager', department:'Operations Division', workspace:'Zone Operations Center', code:'ZOM', uniform:'Management Formal'},
    inventory_manager:{designation:'Inventory Control Manager', department:'Supply & Inventory', workspace:'Inventory Control Room', code:'ICM', uniform:'Operations Uniform'},
    finance:{designation:'Finance & Accounts Officer', department:'Finance Division', workspace:'Finance Office', code:'FAO', uniform:'Corporate Formal'},
    support:{designation:'Customer Care Executive', department:'Customer Experience', workspace:'Customer Care Center', code:'CCE', uniform:'Customer Care Uniform'},
    driver:{designation:'Delivery Rider', department:'Last-Mile Logistics', workspace:'Delivery Operations Desk', code:'DLR', uniform:'Golapi Delivery Uniform'}
  },
  esc(v){ return String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); },
  async mount(targetId, staffData=null, uid=null){
    const host=document.getElementById(targetId); if(!host) return;
    try{
      let data=staffData;
      const user=FB?.auth?.currentUser;
      uid=uid || user?.uid;
      if(!data && uid){ const s=await FB.getDoc(FB.doc(FB.db,'staff',uid)); if(s.exists()) data=s.data(); }
      if(!data) return;
      const cfg=this.roleMap[data.role] || {designation:data.designation||'Team Member',department:data.department||'Golapi Shop',workspace:'Employee Workspace',code:'EMP',uniform:'Company Uniform'};
      const name=data.name||'কর্মীর নাম';
      const designation=data.designation||cfg.designation;
      const department=data.department||cfg.department;
      const workspace=data.workspaceName||cfg.workspace;
      const employeeId=data.employeeId||data.companyId||`GS-${cfg.code}-${String(uid||'0000').slice(-6).toUpperCase()}`;
      const photo=data.photoURL||data.photoUrl||data.image||data.avatar||'icons/head_logo.webp';
      const branch=data.branchName||data.branchZone||'Head Office';
      const uniform=data.uniform||cfg.uniform;
      host.innerHTML=`
      <section class="employee-workspace-card" aria-label="কর্মীর অফিস পরিচয়">
        <div class="employee-profile-block">
          <div class="employee-photo-wrap"><img src="${this.esc(photo)}" alt="${this.esc(name)}" onerror="this.src='icons/head_logo.webp'"><span class="employee-online-dot"></span></div>
          <div class="employee-profile-copy">
            <span class="employee-kicker">${this.esc(workspace)}</span>
            <h2>${this.esc(name)}</h2>
            <p class="employee-designation">${this.esc(designation)}</p>
            <div class="employee-meta"><span>🏢 ${this.esc(department)}</span><span>📍 ${this.esc(branch)}</span><span>👔 ${this.esc(uniform)}</span></div>
          </div>
        </div>
        <div class="company-id-card" role="group" aria-label="Golapi Shop কোম্পানি আইডি কার্ড">
          <div class="company-id-top"><img src="icons/head_logo.webp" alt=""><div><strong>GOLAPI SHOP ONLINE</strong><small>OFFICIAL EMPLOYEE ID</small></div></div>
          <div class="company-id-body"><img src="${this.esc(photo)}" alt="" onerror="this.src='icons/head_logo.webp'"><div><strong>${this.esc(name)}</strong><span>${this.esc(designation)}</span><b>${this.esc(employeeId)}</b></div></div>
          <div class="company-id-foot"><span>${this.esc(branch)}</span><span>AUTHORIZED</span></div>
        </div>
      </section>`;
    }catch(e){ if(typeof devWarn==='function') devWarn('employee workspace mount failed',e.message); }
  },
  async mountCurrent(targetId){ return this.mount(targetId); }
};
window.EmployeeWorkspace=EmployeeWorkspace;

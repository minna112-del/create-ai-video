const WorkflowERP={
  definitions:[],runs:[],approvals:[],tasks:[],logs:[],staff:[],builderSteps:[],
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  bn(v){return typeof bn==='function'?bn(v):String(v);},
  money(v){return '৳'+Number(v||0).toLocaleString('bn-BD',{maximumFractionDigits:0});},
  uid(){return FB?.auth?.currentUser?.uid||'';},
  date(v){if(!v)return '—';const d=v.toDate?v.toDate():new Date(v);return isNaN(d)?'—':d.toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'});},
  async render(){if(typeof EmployeeWorkspace!=='undefined')EmployeeWorkspace.mountCurrent('workflowEmployeeWorkspace');await this.refresh();},
  async refresh(){
    try{
      const names=['workflow_definitions','workflow_instances','workflow_approvals','workflow_tasks','workflow_logs','staff'];
      const snaps=await Promise.all(names.map(n=>FB.getDocs(FB.collection(FB.db,n)).catch(()=>null)));
      const arr=s=>{const a=[];s?.forEach(x=>a.push({id:x.id,...x.data()}));return a};
      [this.definitions,this.runs,this.approvals,this.tasks,this.logs,this.staff]=snaps.map(arr);
      this.renderAll();
      document.getElementById('workflowUpdated').textContent='Updated '+new Date().toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
    }catch(e){toast(e.message,'error')}
  },
  overdue(item){return item.dueAt&&new Date(item.dueAt)<new Date()&&!['completed','approved','rejected','cancelled'].includes(item.status)},
  today(v){const d=v?.toDate?v.toDate():new Date(v||0);return d.toDateString()===new Date().toDateString()},
  renderAll(){
    const active=this.definitions.filter(x=>x.status==='active').length,running=this.runs.filter(x=>['running','waiting_approval','waiting_task'].includes(x.status)).length,pending=this.approvals.filter(x=>x.status==='pending').length,overdue=[...this.approvals,...this.tasks].filter(x=>this.overdue(x)).length,completed=this.runs.filter(x=>x.status==='completed'&&this.today(x.completedAt)).length,finished=this.runs.filter(x=>['completed','failed'].includes(x.status)),success=finished.length?Math.round(finished.filter(x=>x.status==='completed').length/finished.length*100):100;
    const set=(id,v)=>document.getElementById(id).textContent=v;
    set('workflowActive',this.bn(active));set('workflowRunning',this.bn(running));set('workflowApprovals',this.bn(pending));set('workflowOverdue',this.bn(overdue));set('workflowCompleted',this.bn(completed));set('workflowSuccess',`${this.bn(success)}%`);
    this.renderPriority();this.renderDefinitions();this.renderRuns();this.renderApprovals();this.renderTasks();this.renderLogs();this.populateDefinitions();
  },
  renderPriority(){
    const items=[],criticalApprovals=this.approvals.filter(x=>x.status==='pending'&&x.priority==='critical'),overdueApprovals=this.approvals.filter(x=>this.overdue(x)),overdueTasks=this.tasks.filter(x=>this.overdue(x)),failed=this.runs.filter(x=>x.status==='failed');
    if(criticalApprovals.length)items.push(`<li><strong>${this.bn(criticalApprovals.length)} critical approvals pending</strong><span>Immediate management decision required.</span></li>`);
    if(overdueApprovals.length)items.push(`<li><strong>${this.bn(overdueApprovals.length)} approvals overdue</strong><span>Escalate to next approver.</span></li>`);
    if(overdueTasks.length)items.push(`<li><strong>${this.bn(overdueTasks.length)} workflow tasks overdue</strong><span>Reassign or extend SLA.</span></li>`);
    if(failed.length)items.push(`<li><strong>${this.bn(failed.length)} workflow runs failed</strong><span>Review execution logs and retry.</span></li>`);
    document.getElementById('workflowPriority').innerHTML=`<div><h2>${items.length?'Workflow action required':'Automation operations stable'}</h2></div><ul>${items.join('')||'<li><strong>No critical workflow issue</strong></li>'}</ul>`;
  },
  tab(name,btn){['definitions','runs','approvals','tasks','logs'].forEach(x=>document.getElementById(`workflow${x[0].toUpperCase()+x.slice(1)}Pane`).hidden=x!==name);document.querySelectorAll('.workflow-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');},
  renderDefinitions(){
    const q=(document.getElementById('workflowSearch')?.value||'').toLowerCase(),status=document.getElementById('workflowStateFilter')?.value||'';
    document.getElementById('workflowDefinitionGrid').innerHTML=this.definitions.filter(w=>(!status||w.status===status)&&(!q||[w.name,w.trigger,w.department].some(v=>String(v||'').toLowerCase().includes(q)))).map(w=>`<article><div class="workflow-card-head"><div><span>${this.esc(w.trigger||'manual')}</span><h3>${this.esc(w.name||'Workflow')}</h3><p>${this.esc(w.department||'')} · SLA ${this.bn(w.slaHours||24)}h</p></div><b class="${this.esc(w.status||'draft')}">${this.esc(w.status||'draft')}</b></div><p>${this.esc(w.description||'')}</p><div class="workflow-step-preview">${(w.steps||[]).map((s,i)=>`<span><b>${i+1}</b>${this.esc(s.name||s.type||'Step')}</span>`).join('')}</div><div>${w.status!=='active'?`<button onclick="WorkflowERP.setDefinition('${w.id}','active')">Activate</button>`:`<button onclick="WorkflowERP.setDefinition('${w.id}','paused')">Pause</button>`}<button onclick="WorkflowERP.startDefinition('${w.id}')">Run</button></div></article>`).join('')||'<p>No workflow definition</p>';
  },
  renderRuns(){document.getElementById('workflowRunList').innerHTML=this.runs.map(r=>{const def=this.definitions.find(x=>x.id===r.definitionId);return`<article class="${this.esc(r.status||'running')}"><div><strong>${this.esc(r.workflowName||def?.name||'Workflow')}</strong><span>${this.esc(r.reference||'')} · Step ${this.bn((r.currentStepIndex||0)+1)}/${this.bn((def?.steps||[]).length)}</span><p>${this.esc(r.subject||r.details||'')}</p></div><div><small>${this.esc(r.status||'running')}</small>${['running','waiting_task'].includes(r.status)?`<button onclick="WorkflowERP.advanceRun('${r.id}')">Advance</button>`:''}${r.status==='failed'?`<button onclick="WorkflowERP.retryRun('${r.id}')">Retry</button>`:''}</div></article>`}).join('')||'<p>No workflow instance</p>';},
  renderApprovals(){document.getElementById('workflowApprovalList').innerHTML=this.approvals.map(a=>`<article class="${this.overdue(a)?'critical':this.esc(a.priority||'normal')}"><div><strong>${this.esc(a.title||a.workflowName||'Approval')}</strong><span>${this.esc(a.reference||'')} · ${this.esc(a.approverRole||a.approverName||'Approver')}</span><p>${this.esc(a.details||'')}</p><small>Due ${this.date(a.dueAt)}</small></div><div><small>${this.esc(a.status||'pending')}</small>${a.status==='pending'?`<button onclick="WorkflowERP.decide('${a.id}','approved')">Approve</button><button onclick="WorkflowERP.decide('${a.id}','rejected')">Reject</button>`:''}</div></article>`).join('')||'<p>No approval</p>';},
  renderTasks(){document.getElementById('workflowTaskList').innerHTML=this.tasks.map(t=>`<article class="${this.overdue(t)?'critical':this.esc(t.priority||'normal')}"><div><strong>${this.esc(t.title||'Workflow Task')}</strong><span>${this.esc(t.assignedToName||t.assignedRole||'Unassigned')} · ${this.esc(t.department||'')}</span><p>${this.esc(t.details||'')}</p><small>Due ${this.date(t.dueAt)}</small></div><div><small>${this.esc(t.status||'open')}</small>${!['completed','cancelled'].includes(t.status)?`<button onclick="WorkflowERP.completeTask('${t.id}')">Complete</button>`:''}</div></article>`).join('')||'<p>No workflow task</p>';},
  renderLogs(){document.getElementById('workflowLogList').innerHTML=this.logs.map(l=>`<article><div><strong>${this.esc(l.action||'Workflow Event')}</strong><span>${this.esc(l.workflowName||'')} · ${this.esc(l.instanceId||'')}</span><p>${this.esc(l.details||'')}</p></div><small>${this.date(l.createdAt)}</small></article>`).join('')||'<p>No execution log</p>';},
  open(id){document.getElementById(id).classList.add('open');if(id==='workflowBuilderModal'){this.builderSteps=[];this.addStep()}},
  close(id){document.getElementById(id).classList.remove('open')},
  addStep(step={}){
    this.builderSteps.push({name:step.name||'',type:step.type||'task',assigneeRole:step.assigneeRole||'',department:step.department||'',condition:step.condition||'',slaHours:step.slaHours||24});
    this.renderStepBuilder();
  },
  removeStep(i){this.builderSteps.splice(i,1);this.renderStepBuilder()},
  syncSteps(){
    this.builderSteps=this.builderSteps.map((s,i)=>({
      name:document.getElementById(`workflowStepName_${i}`)?.value.trim()||'',
      type:document.getElementById(`workflowStepType_${i}`)?.value||'task',
      assigneeRole:document.getElementById(`workflowStepRole_${i}`)?.value.trim()||'',
      department:document.getElementById(`workflowStepDepartment_${i}`)?.value.trim()||'',
      condition:document.getElementById(`workflowStepCondition_${i}`)?.value.trim()||'',
      slaHours:+document.getElementById(`workflowStepSla_${i}`)?.value||24
    }));
  },
  renderStepBuilder(){document.getElementById('workflowStepBuilder').innerHTML=this.builderSteps.map((s,i)=>`<article><b>${i+1}</b><div class="workflow-step-fields"><input id="workflowStepName_${i}" placeholder="Step name" value="${this.esc(s.name)}"><select id="workflowStepType_${i}"><option value="task" ${s.type==='task'?'selected':''}>Task</option><option value="approval" ${s.type==='approval'?'selected':''}>Approval</option><option value="notification" ${s.type==='notification'?'selected':''}>Notification</option><option value="update_record" ${s.type==='update_record'?'selected':''}>Update Record</option></select><input id="workflowStepRole_${i}" placeholder="Assignee role" value="${this.esc(s.assigneeRole)}"><input id="workflowStepDepartment_${i}" placeholder="Department" value="${this.esc(s.department)}"><input id="workflowStepCondition_${i}" placeholder="Condition (optional)" value="${this.esc(s.condition)}"><input id="workflowStepSla_${i}" type="number" min="1" value="${s.slaHours}"></div><button onclick="WorkflowERP.removeStep(${i})">×</button></article>`).join('');},
  populateDefinitions(){const e=document.getElementById('workflowRequestDefinition');if(e)e.innerHTML=this.definitions.filter(x=>x.status==='active').map(w=>`<option value="${this.esc(w.id)}">${this.esc(w.name||'Workflow')}</option>`).join('')},
  async saveWorkflow(){
    this.syncSteps();const name=document.getElementById('workflowName').value.trim();if(!name||!this.builderSteps.length)return toast('Workflow name and at least one step required','error');
    await FB.setDoc(FB.doc(FB.db,'workflow_definitions',`workflow_${Date.now()}`),{name,department:document.getElementById('workflowDepartment').value.trim(),trigger:document.getElementById('workflowTrigger').value,status:document.getElementById('workflowStatus').value,priority:document.getElementById('workflowPriorityValue').value,slaHours:+document.getElementById('workflowSla').value||24,description:document.getElementById('workflowDescription').value.trim(),steps:this.builderSteps,version:1,createdBy:this.uid(),createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()});this.close('workflowBuilderModal');await this.refresh();
  },
  async setDefinition(id,status){await FB.setDoc(FB.doc(FB.db,'workflow_definitions',id),{status,updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  startDefinition(id){this.populateDefinitions();document.getElementById('workflowRequestDefinition').value=id;this.open('workflowRequestModal')},
  async startWorkflow(){
    const id=document.getElementById('workflowRequestDefinition').value,d=this.definitions.find(x=>x.id===id);if(!d)return toast('Select workflow','error');
    const runId=`run_${Date.now()}`,due=new Date(Date.now()+(+d.slaHours||24)*3600000).toISOString();
    await FB.setDoc(FB.doc(FB.db,'workflow_instances',runId),{definitionId:id,workflowName:d.name,reference:document.getElementById('workflowRequestReference').value.trim(),subject:document.getElementById('workflowRequestSubject').value.trim(),amount:+document.getElementById('workflowRequestAmount').value||0,details:document.getElementById('workflowRequestDetails').value.trim(),currentStepIndex:0,status:'running',priority:d.priority||'normal',dueAt:due,startedBy:this.uid(),startedAt:FB.serverTimestamp(),createdAt:FB.serverTimestamp()});
    await this.createCurrentStep(runId,d,0);
    await this.log(runId,d.name,'workflow_started','Workflow instance started');
    this.close('workflowRequestModal');await this.refresh();
  },
  async createCurrentStep(runId,d,index){
    const s=(d.steps||[])[index];if(!s)return this.finishRun(runId,d);
    const due=new Date(Date.now()+(+s.slaHours||24)*3600000).toISOString();
    if(s.type==='approval')await FB.setDoc(FB.doc(FB.db,'workflow_approvals',`approval_${Date.now()}_${index}`),{instanceId:runId,definitionId:d.id,workflowName:d.name,title:s.name||'Approval',approverRole:s.assigneeRole||'',department:s.department||'',priority:d.priority||'normal',status:'pending',dueAt:due,createdAt:FB.serverTimestamp()});
    else if(s.type==='task')await FB.setDoc(FB.doc(FB.db,'workflow_tasks',`task_${Date.now()}_${index}`),{instanceId:runId,definitionId:d.id,workflowName:d.name,title:s.name||'Task',assignedRole:s.assigneeRole||'',department:s.department||'',priority:d.priority||'normal',status:'open',dueAt:due,createdAt:FB.serverTimestamp()});
    else await this.advanceRun(runId);
    await FB.setDoc(FB.doc(FB.db,'workflow_instances',runId),{status:s.type==='approval'?'waiting_approval':s.type==='task'?'waiting_task':'running',currentStepIndex:index,updatedAt:FB.serverTimestamp()},{merge:true});
  },
  async advanceRun(id){
    const r=this.runs.find(x=>x.id===id),d=this.definitions.find(x=>x.id===r?.definitionId);if(!r||!d)return;
    const next=(+r.currentStepIndex||0)+1;if(next>=(d.steps||[]).length)return this.finishRun(id,d);
    await FB.setDoc(FB.doc(FB.db,'workflow_instances',id),{currentStepIndex:next,status:'running',updatedAt:FB.serverTimestamp()},{merge:true});
    await this.createCurrentStep(id,d,next);await this.log(id,d.name,'workflow_advanced',`Advanced to step ${next+1}`);await this.refresh();
  },
  async finishRun(id,d){await FB.setDoc(FB.doc(FB.db,'workflow_instances',id),{status:'completed',completedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await this.log(id,d.name,'workflow_completed','Workflow completed');await this.refresh()},
  async decide(id,status){
    const a=this.approvals.find(x=>x.id===id);if(!a)return;
    await FB.setDoc(FB.doc(FB.db,'workflow_approvals',id),{status,decidedBy:this.uid(),decidedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});
    if(status==='approved')await this.advanceRun(a.instanceId);else await FB.setDoc(FB.doc(FB.db,'workflow_instances',a.instanceId),{status:'rejected',updatedAt:FB.serverTimestamp()},{merge:true});
    await this.log(a.instanceId,a.workflowName,'approval_decided',`${a.title} ${status}`);await this.refresh();
  },
  async completeTask(id){const t=this.tasks.find(x=>x.id===id);if(!t)return;await FB.setDoc(FB.doc(FB.db,'workflow_tasks',id),{status:'completed',completedBy:this.uid(),completedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await this.log(t.instanceId,t.workflowName,'task_completed',t.title||'Task completed');await this.advanceRun(t.instanceId)},
  async retryRun(id){await FB.setDoc(FB.doc(FB.db,'workflow_instances',id),{status:'running',retryCount:FB.increment?FB.increment(1):1,updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh()},
  async log(instanceId,workflowName,action,details){await FB.setDoc(FB.doc(FB.db,'workflow_logs',`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`),{instanceId,workflowName,action,details,userId:this.uid(),createdAt:FB.serverTimestamp()})},
  exportRuns(){const rows=[['Workflow','Reference','Subject','Status','Step','Priority','Started','Completed'],...this.runs.map(r=>[r.workflowName,r.reference,r.subject,r.status,r.currentStepIndex,r.priority,this.date(r.startedAt),this.date(r.completedAt)])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download='golapi-workflow-runs.csv';a.click()}
};window.WorkflowERP=WorkflowERP;
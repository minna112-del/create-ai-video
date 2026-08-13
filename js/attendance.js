/* attendance.js — Phase 14: Attendance & Time Office */
const AttendanceOffice = {
  staff: [], records: [], leaves: [], holidays: [], today: '', timer: null,
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  bn(v){return typeof bn==='function'?bn(v):String(v);},
  dateKey(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);},
  toDate(v){if(!v)return null;if(v.toDate)return v.toDate();const d=new Date(v);return isNaN(d)?null:d;},
  fmtTime(v){const d=this.toDate(v);return d?d.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dhaka'}):'—';},
  minutes(t){const m=String(t||'09:00').match(/(\d{1,2}):(\d{2})/);return m?(+m[1]*60)+(+m[2]):540;},
  async render(){
    if(!window.FB){toast('Firebase সংযোগ পাওয়া যায়নি','error');return;}
    this.today=this.dateKey();
    if(typeof EmployeeWorkspace!=='undefined') EmployeeWorkspace.mountCurrent('attendanceEmployeeWorkspace');
    this.startClock();
    await this.refresh();
  },
  startClock(){
    if(this.timer)clearInterval(this.timer);
    const tick=()=>{const n=new Date();const c=document.getElementById('attendanceLiveClock'),d=document.getElementById('attendanceLiveDate');if(c)c.textContent=n.toLocaleTimeString('bn-BD',{timeZone:'Asia/Dhaka'});if(d)d.textContent=n.toLocaleDateString('bn-BD',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'});};
    tick();this.timer=setInterval(tick,1000);
  },
  async refresh(){
    const stamp=document.getElementById('attendanceUpdated');if(stamp)stamp.textContent='লোড হচ্ছে…';
    try{
      const [s,a,l,h]=await Promise.all([
        FB.getDocs(FB.collection(FB.db,'staff')),
        FB.getDocs(FB.collection(FB.db,'attendance_records')),
        FB.getDocs(FB.collection(FB.db,'leave_requests')),
        FB.getDocs(FB.collection(FB.db,'company_holidays'))
      ]);
      this.staff=[];s.forEach(x=>{const v=x.data();if(v.active!==false&&!['inactive','resigned','suspended'].includes(v.status))this.staff.push({uid:x.id,...v});});
      this.records=[];a.forEach(x=>{const v=x.data();if(v.date===this.today)this.records.push({id:x.id,...v});});
      this.leaves=[];l.forEach(x=>this.leaves.push({id:x.id,...x.data()}));
      this.holidays=[];h.forEach(x=>this.holidays.push({id:x.id,...x.data()}));
      this.staff.sort((x,y)=>(x.name||'').localeCompare(y.name||'','bn'));
      this.renderAll();
      if(stamp)stamp.textContent='আপডেট: '+new Date().toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
    }catch(e){toast('Attendance Office লোড হয়নি: '+e.message,'error');if(stamp)stamp.textContent='লোড ব্যর্থ';}
  },
  currentUid(){return FB?.auth?.currentUser?.uid||OwnerAuth?.currentUid||'';},
  currentRecord(){const uid=this.currentUid();return this.records.find(r=>r.uid===uid);},
  renderAll(){this.renderSelf();this.renderStats();this.renderPriority();this.renderRegister();this.renderLeaves();this.renderHolidays();this.populateEmployeeSelect();},
  renderSelf(){
    const r=this.currentRecord(), title=document.getElementById('attendanceSelfStatus'), meta=document.getElementById('attendanceSelfMeta'), inBtn=document.getElementById('attendanceCheckInBtn'), outBtn=document.getElementById('attendanceCheckOutBtn');
    if(!title)return;
    if(!r){title.textContent='আজ এখনো চেক-ইন করা হয়নি';meta.textContent='লোকেশন অনুমতি দিলে উপস্থিতির সঙ্গে অবস্থান সংরক্ষণ হবে।';inBtn.disabled=false;outBtn.disabled=true;return;}
    if(r.checkOutAt){title.textContent=`আজকের কাজ শেষ · ${this.fmtTime(r.checkOutAt)}`;meta.textContent=`চেক-ইন ${this.fmtTime(r.checkInAt)} · মোট ${this.workHours(r)} ঘণ্টা`;inBtn.disabled=true;outBtn.disabled=true;}
    else{title.textContent=`আপনি ${r.status==='late'?'দেরিতে ':''}চেক-ইন করেছেন`;meta.textContent=`চেক-ইন সময় ${this.fmtTime(r.checkInAt)} · এখন কাজ চলছে`;inBtn.disabled=true;outBtn.disabled=false;}
  },
  leaveToday(uid){return this.leaves.find(l=>l.uid===uid&&l.status==='approved'&&l.startDate<=this.today&&l.endDate>=this.today);},
  workHours(r){const a=this.toDate(r.checkInAt),b=this.toDate(r.checkOutAt)||new Date();if(!a)return '০';return Math.max(0,(b-a)/36e5).toFixed(1);},
  overtime(r){const h=+this.workHours(r);return Math.max(0,h-(+(r.shiftHours||8)));},
  statusFor(staff){const r=this.records.find(x=>x.uid===staff.uid);if(r)return r.status||'present';if(this.leaveToday(staff.uid))return 'leave';return 'absent';},
  renderStats(){
    const present=this.staff.filter(s=>['present','late'].includes(this.statusFor(s))).length, late=this.staff.filter(s=>this.statusFor(s)==='late').length, leave=this.staff.filter(s=>this.statusFor(s)==='leave').length, absent=Math.max(0,this.staff.length-present-leave), overtime=this.records.reduce((n,r)=>n+this.overtime(r),0);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('attStatPresent',this.bn(present));set('attStatPresentPct',`${this.bn(this.staff.length?Math.round(present/this.staff.length*100):0)}% কর্মী`);set('attStatLate',this.bn(late));set('attStatLeave',this.bn(leave));set('attStatAbsent',this.bn(absent));set('attStatOvertime',this.bn(overtime.toFixed(1))+'h');
  },
  renderPriority(){
    const host=document.getElementById('attendancePriorityDesk');if(!host)return;
    const absent=this.staff.filter(s=>this.statusFor(s)==='absent').length, late=this.staff.filter(s=>this.statusFor(s)==='late').length, pending=this.leaves.filter(l=>l.status==='pending').length;
    const items=[];
    if(absent)items.push(`<li><strong>${this.bn(absent)} জন অনুপস্থিত</strong><span>শিফট শুরু হয়ে থাকলে সংশ্লিষ্ট ম্যানেজারকে অনুসরণ করতে হবে।</span></li>`);
    if(late)items.push(`<li><strong>${this.bn(late)} জন দেরিতে এসেছে</strong><span>পুনরাবৃত্ত দেরি হলে People Operations review করুন।</span></li>`);
    if(pending)items.push(`<li><strong>${this.bn(pending)}টি ছুটির আবেদন অপেক্ষমাণ</strong><span>আজই অনুমোদন বা প্রত্যাখ্যান করুন।</span></li>`);
    host.innerHTML=`<div><span class="office-kicker">PRIORITY DESK</span><h2>${items.length?'আজকের প্রয়োজনীয় সিদ্ধান্ত':'Attendance operation স্বাভাবিক'}</h2></div><ul>${items.join('')||'<li><strong>কোনো জরুরি ঝুঁকি নেই</strong><span>উপস্থিতি, ছুটি ও শিফট বর্তমানে নিয়ন্ত্রণে আছে।</span></li>'}</ul>`;
  },
  renderRegister(){
    const host=document.getElementById('attendanceRegisterBody');if(!host)return;
    const q=(document.getElementById('attendanceSearch')?.value||'').toLowerCase(), filter=document.getElementById('attendanceStatusFilter')?.value||'';
    let list=this.staff.filter(s=>{const st=this.statusFor(s);return(!filter||st===filter)&&(!q||[s.name,s.employeeId,s.designation,s.department].some(v=>String(v||'').toLowerCase().includes(q)));});
    host.innerHTML=list.map(s=>{const r=this.records.find(x=>x.uid===s.uid),st=this.statusFor(s),labels={present:'উপস্থিত',late:'দেরি',absent:'অনুপস্থিত',leave:'ছুটি'};return `<tr><td><div class="attendance-person"><img src="${this.esc(s.photoURL||'icons/head_logo.webp')}" onerror="this.src='icons/head_logo.webp'"><span><strong>${this.esc(s.name||'নাম নেই')}</strong><small>${this.esc(s.employeeId||s.designation||'—')}</small></span></div></td><td>${this.esc(s.shift||s.shiftName||'General · 09:00–18:00')}</td><td>${this.fmtTime(r?.checkInAt)}</td><td>${this.fmtTime(r?.checkOutAt)}</td><td>${r?this.bn(this.workHours(r))+'h':'—'}</td><td><span class="attendance-status ${st}">${labels[st]}</span></td><td>${r?`<button onclick="AttendanceOffice.manualEdit('${this.esc(s.uid)}')">সংশোধন</button>`:`<button onclick="AttendanceOffice.markPresent('${this.esc(s.uid)}')">উপস্থিত দিন</button>`}</td></tr>`;}).join('')||'<tr><td colspan="7">কোনো কর্মী পাওয়া যায়নি।</td></tr>';
  },
  renderLeaves(){
    const host=document.getElementById('attendanceLeaveList');if(!host)return;
    const list=[...this.leaves].sort((a,b)=>String(b.createdAt?.seconds||'').localeCompare(String(a.createdAt?.seconds||''))).slice(0,12);
    host.innerHTML=list.map(l=>`<div class="attendance-list-item"><div><strong>${this.esc(l.employeeName||'কর্মী')}</strong><span>${this.esc(l.type||'Leave')} · ${this.esc(l.startDate)} → ${this.esc(l.endDate)}</span></div><div><span class="attendance-status ${this.esc(l.status||'pending')}">${l.status==='approved'?'অনুমোদিত':l.status==='rejected'?'প্রত্যাখ্যাত':'অপেক্ষমাণ'}</span>${l.status==='pending'?`<button onclick="AttendanceOffice.reviewLeave('${l.id}','approved')">✓</button><button onclick="AttendanceOffice.reviewLeave('${l.id}','rejected')">×</button>`:''}</div></div>`).join('')||'<p class="attendance-empty">কোনো ছুটির আবেদন নেই।</p>';
  },
  renderHolidays(){
    const host=document.getElementById('attendanceHolidayList');if(!host)return;
    const list=this.holidays.filter(h=>h.date>=this.today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
    host.innerHTML=list.map(h=>`<div class="attendance-list-item"><div><strong>${this.esc(h.title)}</strong><span>${new Date(h.date+'T00:00:00').toLocaleDateString('bn-BD',{day:'numeric',month:'long',year:'numeric'})} · ${h.type==='event'?'বিশেষ অনুষ্ঠান':h.type==='restricted'?'সীমিত কার্যক্রম':'অফিস ছুটি'}</span></div><button onclick="AttendanceOffice.deleteHoliday('${h.id}')">×</button></div>`).join('')||'<p class="attendance-empty">সামনের কোনো অফিস ছুটি যোগ করা হয়নি।</p>';
  },
  populateEmployeeSelect(){const e=document.getElementById('leaveEmployee');if(e)e.innerHTML=this.staff.map(s=>`<option value="${this.esc(s.uid)}">${this.esc(s.name)} · ${this.esc(s.employeeId||s.designation||'')}</option>`).join('');},
  location(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({lat:+p.coords.latitude.toFixed(6),lng:+p.coords.longitude.toFixed(6),accuracy:Math.round(p.coords.accuracy)}),()=>resolve(null),{enableHighAccuracy:true,timeout:7000,maximumAge:60000});});},
  async checkIn(){
    const uid=this.currentUid();if(!uid){toast('প্রথমে অনুমোদিত স্টাফ অ্যাকাউন্টে লগইন করুন','error');return;}if(this.currentRecord()){toast('আজ ইতিমধ্যে চেক-ইন করা হয়েছে','error');return;}
    const staff=this.staff.find(s=>s.uid===uid)||{}, now=new Date(), dhaka=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Dhaka'}), shiftStart=staff.shiftStart||'09:00', late=this.minutes(dhaka)>this.minutes(shiftStart)+10, loc=await this.location();
    try{await FB.setDoc(FB.doc(FB.db,'attendance_records',`${this.today}_${uid}`),{uid,date:this.today,employeeName:staff.name||FB.auth.currentUser?.email||'Staff',employeeId:staff.employeeId||'',branchName:staff.branchName||'Head Office',shift:staff.shift||'General',shiftStart,shiftHours:+staff.shiftHours||8,status:late?'late':'present',checkInAt:FB.serverTimestamp(),checkInLocation:loc,source:'web',createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});toast(late?'চেক-ইন হয়েছে—দেরি হিসেবে রেকর্ড হয়েছে':'✓ চেক-ইন সফল','success');await this.refresh();}catch(e){toast('চেক-ইন হয়নি: '+e.message,'error');}
  },
  async checkOut(){const r=this.currentRecord();if(!r||r.checkOutAt){toast('চেক-আউট করার সক্রিয় রেকর্ড নেই','error');return;}try{const loc=await this.location();await FB.updateDoc(FB.doc(FB.db,'attendance_records',r.id),{checkOutAt:FB.serverTimestamp(),checkOutLocation:loc,updatedAt:FB.serverTimestamp()});toast('✓ চেক-আউট সফল','success');await this.refresh();}catch(e){toast(e.message,'error');}},
  async markPresent(uid){const s=this.staff.find(x=>x.uid===uid);if(!s)return;if(!confirm(`${s.name} কে এখন উপস্থিত দেখাবেন?`))return;try{await FB.setDoc(FB.doc(FB.db,'attendance_records',`${this.today}_${uid}`),{uid,date:this.today,employeeName:s.name||'',employeeId:s.employeeId||'',branchName:s.branchName||'Head Office',shift:s.shift||'General',shiftStart:s.shiftStart||'09:00',shiftHours:+s.shiftHours||8,status:'present',checkInAt:FB.serverTimestamp(),source:'manual',createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});await this.refresh();toast('উপস্থিতি সংরক্ষণ হয়েছে','success');}catch(e){toast(e.message,'error');}},
  async manualEdit(uid){const r=this.records.find(x=>x.uid===uid);if(!r)return;const status=prompt('স্ট্যাটাস লিখুন: present / late',r.status||'present');if(!['present','late'].includes(status))return;try{await FB.updateDoc(FB.doc(FB.db,'attendance_records',r.id),{status,updatedAt:FB.serverTimestamp()});await this.refresh();}catch(e){toast(e.message,'error');}},
  openModal(id){const m=document.getElementById(id);if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}},
  closeModal(id){const m=document.getElementById(id);if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.style.overflow='';}},
  openLeaveForm(){this.populateEmployeeSelect();const d=this.today;document.getElementById('leaveStart').value=d;document.getElementById('leaveEnd').value=d;this.openModal('attendanceLeaveModal');},
  async saveLeave(){const uid=document.getElementById('leaveEmployee').value,startDate=document.getElementById('leaveStart').value,endDate=document.getElementById('leaveEnd').value,type=document.getElementById('leaveType').value,reason=document.getElementById('leaveReason').value.trim(),s=this.staff.find(x=>x.uid===uid);if(!uid||!startDate||!endDate||endDate<startDate){toast('সঠিক কর্মী ও তারিখ নির্বাচন করুন','error');return;}try{const id=`${Date.now()}_${uid}`;await FB.setDoc(FB.doc(FB.db,'leave_requests',id),{uid,employeeName:s?.name||'',employeeId:s?.employeeId||'',type,startDate,endDate,reason,status:'pending',requestedBy:this.currentUid(),createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()});this.closeModal('attendanceLeaveModal');await this.refresh();toast('ছুটির আবেদন সংরক্ষণ হয়েছে','success');}catch(e){toast(e.message,'error');}},
  async reviewLeave(id,status){if(!confirm(status==='approved'?'ছুটি অনুমোদন করবেন?':'আবেদন প্রত্যাখ্যান করবেন?'))return;try{await FB.updateDoc(FB.doc(FB.db,'leave_requests',id),{status,reviewedBy:this.currentUid(),reviewedAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()});await this.refresh();}catch(e){toast(e.message,'error');}},
  openHolidayForm(){document.getElementById('holidayDate').value=this.today;this.openModal('attendanceHolidayModal');},
  async saveHoliday(){const date=document.getElementById('holidayDate').value,title=document.getElementById('holidayTitle').value.trim(),type=document.getElementById('holidayType').value;if(!date||!title){toast('তারিখ ও শিরোনাম দিন','error');return;}try{await FB.setDoc(FB.doc(FB.db,'company_holidays',date),{date,title,type,createdBy:this.currentUid(),createdAt:FB.serverTimestamp(),updatedAt:FB.serverTimestamp()},{merge:true});this.closeModal('attendanceHolidayModal');await this.refresh();toast('ক্যালেন্ডার আপডেট হয়েছে','success');}catch(e){toast(e.message,'error');}},
  async deleteHoliday(id){if(!confirm('দিনটি ক্যালেন্ডার থেকে সরাবেন?'))return;try{await FB.deleteDoc(FB.doc(FB.db,'company_holidays',id));await this.refresh();}catch(e){toast(e.message,'error');}},
  exportCsv(){const rows=[['Date','Employee ID','Employee','Designation','Shift','Check In','Check Out','Hours','Status']];this.staff.forEach(s=>{const r=this.records.find(x=>x.uid===s.uid);rows.push([this.today,s.employeeId||'',s.name||'',s.designation||'',s.shift||'General',this.fmtTime(r?.checkInAt),this.fmtTime(r?.checkOutAt),r?this.workHours(r):'',this.statusFor(s)]);});const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`attendance-${this.today}.csv`;a.click();URL.revokeObjectURL(a.href);}
};
window.AttendanceOffice=AttendanceOffice;

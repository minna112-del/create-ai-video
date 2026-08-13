/* staff-chat.js — StaffChat: সব স্টাফ ড্যাশবোর্ডে (Owner/Zone Manager/Inventory/Finance/Support/Driver)
   একই মডিউল কাজ করে। কোনো HTML পরিবর্তন লাগে না — এই স্ক্রিপ্ট নিজেই DOM-এ উইজেট
   ইনজেক্ট করে দেয়। প্রতিটা ড্যাশবোর্ড লগইন সফল হওয়ার পর একবার
   StaffChat.init(uid, name, role) কল করলেই যথেষ্ট।

   Firestore structure:
   - staff_presence/{uid}            : { name, role, lastActive }
   - staff_conversations/{convId}     : { participants:[uid1,uid2], lastMessage, lastMessageAt, readBy:{uid:ts} }
   - staff_conversations/{convId}/messages/{msgId} : { senderId, senderName, text, imageUrl, createdAt }
   convId সবসময় দুইজনের uid sort করে '_' দিয়ে জোড়া লাগিয়ে বানানো হয় — একই দুইজনের
   জন্য সবসময় একই conversation। */

const StaffChat = {
  uid: null, name: null, role: null,
  staffList: [],
  activeConvId: null, activePeer: null,
  _presenceUnsubs: {},
  _msgUnsub: null,
  _heartbeatTimer: null,
  _injected: false,

  roleLabel(r){
    const map = { admin:'Owner', zone_manager:'জোন ম্যানেজার', inventory_manager:'ইনভেন্টরি ম্যানেজার', finance:'ফাইন্যান্স', support:'সাপোর্ট', driver:'ড্রাইভার' };
    return map[r] || r || '—';
  },

  convId(otherUid){ return [this.uid, otherUid].sort().join('_'); },

  async init(uid, name, role){
    if(!uid || !FB) return;
    this.uid = uid; this.name = name; this.role = role;
    if(!this._injected){ this.injectUI(); this._injected = true; }
    this.startHeartbeat();
    await this.loadStaffList();
    this.renderStaffList();
    window.addEventListener('beforeunload', ()=>{ this.setOffline(); });
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) this.setOffline(); else this.heartbeat();
    });
  },

  // ---------- Presence ----------
  async heartbeat(){
    if(!this.uid || !FB) return;
    try{
      await FB.setDoc(FB.doc(FB.db,'staff_presence',this.uid), {
        name:this.name, role:this.role, lastActive: FB.serverTimestamp()
      }, {merge:true});
    }catch(e){ devWarn && devWarn('presence heartbeat failed', e.message); }
  },

  startHeartbeat(){
    this.heartbeat();
    if(this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(()=>this.heartbeat(), 25000);
  },

  async setOffline(){
    if(!this.uid || !FB) return;
    try{ await FB.updateDoc(FB.doc(FB.db,'staff_presence',this.uid), { lastActive: FB.serverTimestamp(), offline:true }); }catch(e){}
  },

  isOnline(lastActive, offlineFlag){
    if(offlineFlag) return false;
    if(!lastActive?.seconds) return false;
    return (Date.now() - lastActive.seconds*1000) < 60000;
  },

  // ---------- Staff directory ----------
  async loadStaffList(){
    try{
      const snap = await FB.getDocs(FB.collection(FB.db,'staff'));
      this.staffList = snap.docs.map(d=>({ uid:d.id, ...d.data() })).filter(s=>s.uid!==this.uid);
    }catch(e){ this.staffList = []; }
  },

  renderStaffList(){
    const box = document.getElementById('scStaffList');
    if(!box) return;
    box.innerHTML = this.staffList.map(s=>`
      <div class="sc-contact" onclick="StaffChat.openConversation('${s.uid}','${esc(s.name||'')}','${s.role||''}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-radius:10px" onmouseover="this.style.background='rgba(0,0,0,.04)'" onmouseout="this.style.background='transparent'">
        <div style="position:relative;flex-shrink:0">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--rose,#F0356B);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${(s.name||'?').charAt(0)}</div>
          <span id="scDot_${s.uid}" style="position:absolute;bottom:-1px;right:-1px;width:11px;height:11px;border-radius:50%;background:#c4c4c4;border:2px solid #fff"></span>
        </div>
        <div style="min-width:0;flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--ink,#181114);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name||'—')}</div>
          <div style="font-size:11px;color:var(--ink-muted,#8C7E82)">${esc(this.roleLabel(s.role))}</div>
        </div>
      </div>
    `).join('') || '<div style="padding:16px;text-align:center;color:var(--ink-muted,#8C7E82);font-size:12.5px">কোনো স্টাফ পাওয়া যায়নি</div>';

    this.watchPresence();
  },

  watchPresence(){
    Object.values(this._presenceUnsubs).forEach(fn=>fn && fn());
    this._presenceUnsubs = {};
    this.staffList.forEach(s=>{
      const unsub = FB.onSnapshot(FB.doc(FB.db,'staff_presence',s.uid), snap=>{
        const dot = document.getElementById('scDot_'+s.uid);
        if(!dot) return;
        const data = snap.exists() ? snap.data() : null;
        const online = data ? this.isOnline(data.lastActive, data.offline) : false;
        dot.style.background = online ? '#22c55e' : '#c4c4c4';
      });
      this._presenceUnsubs[s.uid] = unsub;
    });
  },

  // ---------- Conversation ----------
  openConversation(otherUid, otherName, otherRole){
    this.activeConvId = this.convId(otherUid);
    this.activePeer = { uid:otherUid, name:otherName, role:otherRole };
    const listView = document.getElementById('scListView');
    const chatView = document.getElementById('scChatView');
    if(listView) listView.style.display='none';
    if(chatView) chatView.style.display='flex';
    const nameEl = document.getElementById('scChatPeerName'); if(nameEl) nameEl.textContent = otherName;
    const roleEl = document.getElementById('scChatPeerRole'); if(roleEl) roleEl.textContent = this.roleLabel(otherRole);
    this.listenMessages();
  },

  backToList(){
    if(this._msgUnsub){ this._msgUnsub(); this._msgUnsub=null; }
    this.activeConvId = null; this.activePeer = null;
    const listView = document.getElementById('scListView');
    const chatView = document.getElementById('scChatView');
    if(listView) listView.style.display='block';
    if(chatView) chatView.style.display='none';
  },

  listenMessages(){
    if(this._msgUnsub){ this._msgUnsub(); this._msgUnsub=null; }
    const msgsRef = FB.collection(FB.db,'staff_conversations',this.activeConvId,'messages');
    this._msgUnsub = FB.onSnapshot(FB.query(msgsRef, FB.orderBy('createdAt','asc'), FB.limit(200)), snap=>{
      const list = snap.docs.map(d=>d.data());
      this.renderMessages(list);
    });
    // পড়া হয়েছে হিসেবে মার্ক করা
    FB.setDoc(FB.doc(FB.db,'staff_conversations',this.activeConvId), {
      participants:[this.uid,this.activePeer.uid],
      [`readBy.${this.uid}`]: FB.serverTimestamp()
    }, {merge:true}).catch(()=>{});
  },

  renderMessages(list){
    const box = document.getElementById('scMessages');
    if(!box) return;
    box.innerHTML = list.map(m=>{
      const mine = m.senderId===this.uid;
      return `<div style="align-self:${mine?'flex-end':'flex-start'};max-width:75%;display:flex;flex-direction:column">
        <div style="background:${mine?'var(--rose,#F0356B)':'#f0f0f0'};color:${mine?'#fff':'#181114'};padding:8px 12px;border-radius:14px;font-size:13px;word-break:break-word">
          ${m.imageUrl ? `<img src="${m.imageUrl}" style="max-width:180px;border-radius:10px;display:block;margin-bottom:${m.text?'6px':'0'}">` : ''}
          ${m.text ? esc(m.text) : ''}
        </div>
        <span style="font-size:9.5px;color:#999;margin-top:2px;align-self:${mine?'flex-end':'flex-start'}">${this.formatTime(m.createdAt)}</span>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  },

  formatTime(ts){
    if(!ts?.seconds) return '';
    return new Date(ts.seconds*1000).toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
  },

  async sendMessage(){
    const input = document.getElementById('scMsgInput');
    const text = input?.value.trim();
    if(!text || !this.activeConvId) return;
    input.value='';
    try{
      await FB.setDoc(FB.doc(FB.db,'staff_conversations',this.activeConvId), {
        participants:[this.uid,this.activePeer.uid],
        lastMessage:text, lastMessageAt: FB.serverTimestamp()
      }, {merge:true});
      await FB.addDoc(FB.collection(FB.db,'staff_conversations',this.activeConvId,'messages'), {
        senderId:this.uid, senderName:this.name, text, createdAt: FB.serverTimestamp()
      });
    }catch(e){ toast && toast('মেসেজ পাঠাতে সমস্যা হয়েছে','error'); }
  },

  async sendImage(fileInput){
    const file = fileInput.files[0];
    if(!file || !this.activeConvId) return;
    try{
      const fileRef = FB.storageRef(FB.storage, `staff-chat/${Date.now()}_${this.uid}.jpg`);
      await FB.uploadBytes(fileRef, file);
      const imageUrl = await FB.getDownloadURL(fileRef);
      await FB.setDoc(FB.doc(FB.db,'staff_conversations',this.activeConvId), {
        participants:[this.uid,this.activePeer.uid],
        lastMessage:'📷 ছবি', lastMessageAt: FB.serverTimestamp()
      }, {merge:true});
      await FB.addDoc(FB.collection(FB.db,'staff_conversations',this.activeConvId,'messages'), {
        senderId:this.uid, senderName:this.name, imageUrl, createdAt: FB.serverTimestamp()
      });
    }catch(e){ toast && toast('ছবি পাঠাতে সমস্যা হয়েছে','error'); }
    fileInput.value='';
  },

  togglePanel(){
    const panel = document.getElementById('scPanel');
    if(!panel) return;
    const willShow = panel.style.display==='none';
    panel.style.display = willShow ? 'flex' : 'none';
    if(willShow){ this.loadStaffList().then(()=>this.renderStaffList()); }
  },

  // ---------- UI injection (কোনো HTML ফাইল এডিট করা লাগে না) ----------
  injectUI(){
    const style = document.createElement('style');
    style.textContent = `
      #scBubble{position:fixed;top:14px;right:14px;z-index:9999;width:44px;height:44px;border-radius:50%;background:var(--rose,#F0356B);color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;border:none}
      #scPanel{position:fixed;top:66px;right:14px;z-index:9999;width:320px;max-width:90vw;height:460px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;font-family:inherit}
      #scHeader{padding:12px 14px;background:var(--rose,#F0356B);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:space-between}
      #scListView{flex:1;overflow-y:auto;padding:8px}
      #scChatView{flex:1;display:none;flex-direction:column}
      #scMessages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#fafafa}
      #scInputRow{display:flex;gap:6px;padding:8px;border-top:1px solid #eee;align-items:center}
      #scMsgInput{flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 14px;font-size:13px;outline:none}
      @media(max-width:480px){ #scPanel{width:94vw;right:3vw} }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button id="scBubble" onclick="StaffChat.togglePanel()" aria-label="স্টাফ চ্যাট">💬</button>
      <div id="scPanel">
        <div id="scHeader">
          <span id="scListHeaderTitle">স্টাফ চ্যাট</span>
          <button onclick="StaffChat.togglePanel()" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">✕</button>
        </div>
        <div id="scListView">
          <div id="scStaffList"></div>
        </div>
        <div id="scChatView">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eee">
            <button onclick="StaffChat.backToList()" style="background:none;border:none;font-size:16px;cursor:pointer;color:#181114">←</button>
            <div>
              <div id="scChatPeerName" style="font-size:13px;font-weight:700;color:#181114"></div>
              <div id="scChatPeerRole" style="font-size:10.5px;color:#8C7E82"></div>
            </div>
          </div>
          <div id="scMessages"></div>
          <div id="scInputRow">
            <label style="cursor:pointer;font-size:18px" title="ছবি পাঠান">
              📷<input type="file" accept="image/*" style="display:none" onchange="StaffChat.sendImage(this)">
            </label>
            <input id="scMsgInput" type="text" placeholder="মেসেজ লিখুন..." onkeydown="if(event.key==='Enter')StaffChat.sendMessage()">
            <button onclick="StaffChat.sendMessage()" style="background:var(--rose,#F0356B);color:#fff;border:none;border-radius:20px;padding:8px 14px;font-size:13px;cursor:pointer">পাঠান</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  }
};
/* widgets.js — floating AI chat widget (এখন ভাসমান/draggable, যেকোনো জায়গায় নেওয়া যায়) */
const ChatWidget = {
  isOpen:false, history:[],
  systemPrompt:`তুমি Golapi Shop Online এর কস্টমার সাপোর্ট সহায়ক। বাংলায়, সংক্ষিপ ও বন্ধুত্বপূর্ণভাবে উত্তর দাও।
দোকানের তথ্য: শুধু নোয়াখালী Zone-A ও Zone-B ডেলিভারি জোনে ডেলিভারি (Zone-C এখনো চালু হয়নি), নিজস্ব লোকাল ড্রাইভার। ক্যাটাগরি: ঔষধ, মুদি বাজার, কনফেকশনারি, স্টেশনারি, গ্যাস সিলিন্ডার, মোবাইল এক্সেসরিস, ঘড়ি, কসমেটিকস, জামা-কাপড়, ফার্নিচার। কাস্টম বাজার সেবা আছে (১০০ টাকা বিকাশ অগ্রিম + বাকি COD)। ডেলিভারি চার্জ দূরত্ব ও পণ্যসংখ্যা অনুযায়ী নির্ধারিত হয়, সাবটোটাল ৳১০০০+ হলে ডেলিভারি সম্পূর্ণ ফ্রি। পেমেন্ট: COD, bKash, Nagad। হটলাইন: +8801612057371।`,
  workerUrl: 'https://golapi-chat-proxy.studiomt46.workers.dev',
  toggle(){
    this.isOpen=!this.isOpen;
    const win=document.getElementById('chatWin');
    if(win){
      win.classList.toggle('show',this.isOpen);
      this._positionWindowNearButton(win); // বাটন যেখানেই টেনে রাখা থাকুক, উইন্ডো তার কাছাকাছি খোলে
    }
    // ⚠️ আগে এখানে icon.textContent='✕'/'💬' বসানো হতো, যেটা ভুলবশত ভেতরের লোগো <img>-টাকেই মুছে ফেলতো
    // (textContent সব children রিপ্লেস করে দেয়)। এখন শুধু একটা CSS ক্লাস টগল করা হয়, img অক্ষত থাকে।
    const btn=document.getElementById('chatBtn');
    if(btn) btn.classList.toggle('is-open', this.isOpen);
  },
  quickAsk(q){ const input=document.getElementById('chatInput'); if(input){ input.value=q; this.send(); } },
  append(role,text){
    const body=document.getElementById('chatBody');
    if(!body) return;
    const div=document.createElement('div'); div.className='cw-msg '+(role==='user'?'cw-user':'cw-bot'); div.textContent=text;
    body.appendChild(div); body.scrollTop=body.scrollHeight;
  },
  async send(){
    const input=document.getElementById('chatInput'); if(!input) return;
    const msg=input.value.trim(); if(!msg) return;
    input.value=''; this.append('user',msg); this.history.push({role:'user',content:msg});
    if(this.workerUrl.includes('YOUR-SUBDOMAIN')){ this.append('bot','AI চ্যাট এখনো সেটআপ হয়নি — golapishoponline.bd@gmail.com-এ মেসজ দিন।'); return; }
    try{
      const res = await fetch(this.workerUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,system:this.systemPrompt,messages:this.history})});
      const data = await res.json();
      const reply = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n') || 'দুঃখিত, উত্তর দিতে পারছি না।';
      this.append('bot',reply); this.history.push({role:'assistant',content:reply});
      if(this.history.length>20) this.history=this.history.slice(-20);
    }catch(e){ this.append('bot','সংযোগে সমস্যা হয়েছে। হটলাইন: ০১৬১২-০৫৭৩৭১'); }
  },

  /* ═══════════════════════════════════════════════════════════
     ভাসমান/Draggable বাটন — Facebook Messenger bubble-এর মতো
     যেকোনো দিকে টেনে নেওয়া যায়, অবস্থান localStorage-এ মনে থাকে
     ═══════════════════════════════════════════════════════════ */
  _dragState: null,
  _posKey: 'golapi_chatbtn_pos',

  initDraggable(){
    const btn = document.getElementById('chatBtn');
    if(!btn || btn.dataset.draggableInit) return;
    btn.dataset.draggableInit = '1';

    // আগের সেভ করা অবস্থান থাকলে সেখানেই বসানো, নইলে ডিফল্ট (নিচে-ডানে)
    this._restorePosition(btn);
    window.addEventListener('resize', ()=>this._clampToViewport(btn));

    const DRAG_THRESHOLD = 8; // এর কম নড়াচড়া হলে সেটা "ট্যাপ" ধরা হবে, ড্র্যাগ না

    const onStart = (clientX, clientY) => {
      const rect = btn.getBoundingClientRect();
      this._dragState = {
        startX: clientX, startY: clientY,
        offsetX: clientX - rect.left, offsetY: clientY - rect.top,
        moved: false, rectW: rect.width, rectH: rect.height
      };
      btn.style.transition = 'none';
    };
    const onMove = (clientX, clientY) => {
      const d = this._dragState;
      if(!d) return;
      const dx = clientX - d.startX, dy = clientY - d.startY;
      if(!d.moved && Math.hypot(dx,dy) > DRAG_THRESHOLD) d.moved = true;
      if(!d.moved) return;
      let left = clientX - d.offsetX;
      let top = clientY - d.offsetY;
      // ভিউপোর্টের বাইরে যেন না যায়
      left = Math.max(6, Math.min(left, window.innerWidth - d.rectW - 6));
      top = Math.max(6, Math.min(top, window.innerHeight - d.rectH - 6));
      btn.style.left = left + 'px';
      btn.style.top = top + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    };
    const onEnd = () => {
      const d = this._dragState;
      btn.style.transition = '';
      if(d && d.moved){
        this._savePosition(btn);
      } else {
        // নড়াচড়া হয়নি মানে এটা আসলে ট্যাপ ছিল — চ্যাট খোলা/বন্ধ করো
        this.toggle();
      }
      this._dragState = null;
    };

    // টাচ (মোবাইল — মূল ব্যবহার)
    btn.addEventListener('touchstart', e=>{ const t=e.touches[0]; onStart(t.clientX, t.clientY); }, {passive:true});
    btn.addEventListener('touchmove', e=>{ const t=e.touches[0]; onMove(t.clientX, t.clientY); e.preventDefault(); }, {passive:false});
    btn.addEventListener('touchend', onEnd);

    // মাউস (ডেস্কটপ/প্রিভিউ সাপোর্ট)
    btn.addEventListener('mousedown', e=>{ onStart(e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener('mousemove', e=>{ if(this._dragState) onMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', ()=>{ if(this._dragState) onEnd(); });

    // পুরনো onclick="ChatWidget.toggle()" attribute-টা সরিয়ে দেওয়া হলো, কারণ
    // এখন toggle() শুধু "ট্যাপ" (নড়াচড়া ছাড়া ছাড়া) হলেই onEnd()-এর ভেতর থেকে কল হয় —
    // দুটো একসাথে থাকলে ড্র্যাগ শেষেও ভুলবশত চ্যাট খুলে যেত
    btn.removeAttribute('onclick');
  },

  _savePosition(btn){
    const rect = btn.getBoundingClientRect();
    try{
      localStorage.setItem(this._posKey, JSON.stringify({
        xPct: rect.left / window.innerWidth,
        yPct: rect.top / window.innerHeight
      }));
    }catch(e){}
  },
  _restorePosition(btn){
    try{
      const saved = JSON.parse(localStorage.getItem(this._posKey) || 'null');
      if(saved){
        const rect = btn.getBoundingClientRect();
        const left = saved.xPct * window.innerWidth;
        const top = saved.yPct * window.innerHeight;
        btn.style.left = Math.max(6, Math.min(left, window.innerWidth - rect.width - 6)) + 'px';
        btn.style.top = Math.max(6, Math.min(top, window.innerHeight - rect.height - 6)) + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      }
    }catch(e){}
  },
  _clampToViewport(btn){
    if(btn.style.left === '' || btn.style.left === 'auto') return; // ডিফল্ট পজিশনে থাকলে কিছু করার দরকার নেই
    const rect = btn.getBoundingClientRect();
    const left = Math.max(6, Math.min(rect.left, window.innerWidth - rect.width - 6));
    const top = Math.max(6, Math.min(rect.top, window.innerHeight - rect.height - 6));
    btn.style.left = left + 'px';
    btn.style.top = top + 'px';
  },
  _positionWindowNearButton(win){
    const btn = document.getElementById('chatBtn');
    if(!btn) return;
    const bRect = btn.getBoundingClientRect();
    const winW = Math.min(360, window.innerWidth - 32);
    const winH = 420;
    let left = bRect.left + bRect.width/2 - winW/2;
    let top = bRect.top - winH - 10; // ডিফল্ট: বাটনের উপরে
    if(top < 10) top = bRect.bottom + 10; // উপরে জায়গা না থাকলে নিচে
    left = Math.max(10, Math.min(left, window.innerWidth - winW - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - winH - 10));
    win.style.left = left + 'px';
    win.style.top = top + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  }
};
window.ChatWidget=ChatWidget;

// চ্যাট বাটন স্লট থেকে async লোড হয়, তাই কয়েকবার চেষ্টা করে draggable init করা হয়
(function tryInitChatDraggable(){
  let tries = 0;
  const attempt = ()=>{
    const btn = document.getElementById('chatBtn');
    if(btn){ ChatWidget.initDraggable(); return; }
    if(++tries < 30) setTimeout(attempt, 300);
  };
  attempt();
})();

/* store.js — Wishlist state and rendering */
const Wishlist = {
  storageKey:'golapi_wishlist',
  items:[],
  load(){
    try{
      const parsed=JSON.parse(localStorage.getItem(this.storageKey)||'[]');
      this.items=Array.isArray(parsed)?[...new Set(parsed.filter(id=>typeof id==='string'&&id.trim()))]:[];
    }catch(e){ this.items=[]; }
    this.clean();
  },
  clean(){
    if(typeof ALL_PRODUCTS==='undefined'||!Array.isArray(ALL_PRODUCTS)) return;
    const valid=new Set(ALL_PRODUCTS.map(p=>p.id));
    const next=this.items.filter(id=>valid.has(id));
    if(next.length!==this.items.length){ this.items=next; this.save(false); }
  },
  save(announce=true){
    localStorage.setItem(this.storageKey,JSON.stringify(this.items));
    this.syncCount();
    if(document.getElementById('page-wishlist')?.classList.contains('active')) this.render();
  },
  has(id){ return this.items.includes(String(id)); },
  toggle(id){
    id=String(id);
    const active=this.has(id);
    this.items=active?this.items.filter(x=>x!==id):[...this.items,id];
    this.save(false);
    this.syncButtons(id);
    toast(active?'উইশলিস্ট থেকে সরানো হয়েছে':'❤️ উইশলিস্টে যুক্ত হয়েছে',active?'':'success');
  },
  remove(id){
    id=String(id);
    if(!this.has(id)) return;
    this.items=this.items.filter(x=>x!==id);
    this.save(false);
    this.syncButtons(id);
    toast('উইশলিস্ট থেকে সরানো হয়েছে');
  },
  clearAll(){
    if(!this.items.length) return;
    if(!confirm('উইশলিস্টের সব পণ্য মুছে ফেলবেন?')) return;
    const previous=[...this.items];
    this.items=[];
    this.save(false);
    previous.forEach(id=>this.syncButtons(id));
    toast('উইশলিস্ট খালি করা হয়েছে','success');
  },
  syncButtons(id){
    document.querySelectorAll('.wish').forEach(btn=>{
      const pid=btn.dataset.productId||btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if(!pid||(id&&pid!==id)) return;
      const active=this.has(pid);
      btn.textContent=active?'❤️':'🤍';
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',active?'true':'false');
      btn.setAttribute('aria-label',active?'উইশলিস্ট থেকে সরান':'উইশলিস্টে যোগ করুন');
    });
  },
  syncCount(){
    const count=this.items.length;
    const label=`${typeof bnNum==='function'?bnNum(count):count}টি পণ্য`;
    const countEl=document.getElementById('wishlistCount'); if(countEl) countEl.textContent=label;
    const clearBtn=document.getElementById('wishlistClearBtn'); if(clearBtn) clearBtn.hidden=!count;
    document.querySelectorAll('[data-wishlist-count]').forEach(el=>{ el.textContent=count; el.hidden=!count; });
  },
  count(){ return this.items.length; },
  render(){
    this.clean();
    const el=document.getElementById('wishlistGrid');
    this.syncCount();
    if(!el) return;
    if(!this.items.length){
      el.innerHTML=`<div class="empty-state wishlist-empty"><div class="em" aria-hidden="true">♡</div><h3>এখনও কোনো পণ্য সংরক্ষণ করেননি</h3><p>পণ্যের হৃদয় চিহ্নে চাপ দিলে সেটি এখানে পাওয়া যাবে।</p><button class="btn btn-gold" type="button" onclick="Router.go('listing',{cat:'all'})">পণ্য খুঁজুন</button></div>`;
      return;
    }
    const products=this.items.map(id=>ALL_PRODUCTS.find(p=>p.id===id)).filter(Boolean);
    el.innerHTML=products.map(pcardHTML).join('');
    this.syncButtons();
  }
};
Wishlist.load();
window.Wishlist=Wishlist;

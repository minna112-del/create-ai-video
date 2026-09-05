/* pages.js — Home, Medical, Listing, PDP, Cart, Search, Checkout, CustomBazar, MyOrders */
/* ---------- Home ---------- */
const Home = {
  render(){
    const catGrid=document.getElementById('catGrid');
    const featuredCategoryIds=['grocery','medicine','gas','vegetables','fish_meat','rice_pulses','edible_oil','dairy_bakery','personal_care','home_care'];
    const featuredCategories=featuredCategoryIds.map(id=>CATEGORIES.find(c=>c.id===id)).filter(Boolean);
    if(catGrid) catGrid.innerHTML = featuredCategories.map(c=>{
      const label=currentLang==='en'?(c.labelEn||c.label):c.label;
      return `<button type="button" class="cat-item" onclick="Router.go('listing',{cat:'${c.id}'})" aria-label="${esc(label)}">
        <span class="cat-icon" aria-hidden="true">${c.icon}</span>
        <span class="cat-label">${esc(label)}</span>
        <span class="cat-arrow ic ic-arrow-r" aria-hidden="true"></span>
      </button>`;
    }).join('');
    const zp = zoneProducts();
    const loading = !ProductStore.loaded;
    // ⚠️ আগে শুধু loaded (boolean) চেক হতো, তাই সব retry ব্যর্থ হওয়ার পরও UI
    // "loading" আর "কোনো পণ্য নেই" — এই দুই ভুল অবস্থার মধ্যে আটকে থাকতো,
    // কখনো real error দেখাতো না। এখন status==='error' + খালি ALL_PRODUCTS
    // হলে স্পষ্ট retry বাটনসহ error UI দেখানো হয়।
    const isErrorState = ProductStore.status === 'error' && ALL_PRODUCTS.length === 0;
    const specialSection = document.getElementById('homeSpecialProducts');
    const popularSection = document.getElementById('homePopularProducts');
    const empty = message => `<div class="home-products-empty" role="status"><span class="ic ic-cart" aria-hidden="true"></span><p>${message}</p><button type="button" onclick="Router.go('listing',{cat:'all'})">সব পণ্য দেখুন</button></div>`;
    const errorRetry = `<div class="home-products-empty" role="alert"><span class="ic ic-warning" aria-hidden="true">⚠</span><p>পণ্য লোড করা যায়নি — ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।</p><button type="button" onclick="ProductStore.retryLoad()">আবার চেষ্টা করুন</button></div>`;

    if(isErrorState){
      if(specialSection) specialSection.hidden = true;
      if(popularSection) popularSection.hidden = true;
      const ng=document.getElementById('newGrid'); if(ng) ng.innerHTML = errorRetry;
    }else if(loading){
      if(specialSection) specialSection.hidden = false;
      if(popularSection) popularSection.hidden = false;
      const fr=document.getElementById('flashRow'); if(fr) fr.innerHTML = skeletonCards(4);
      const br=document.getElementById('bestRow'); if(br) br.innerHTML = skeletonCards(4);
      const ng=document.getElementById('newGrid'); if(ng) ng.innerHTML = skeletonCards(8);
    }else{
      const available = zp.filter(p=>Number(p.stock)>0);
      const special = available.filter(p=>p.isFlash);
      const popularCandidates = available.filter(p=>Number(p.sold)>0).sort((a,b)=>Number(b.sold)-Number(a.sold));
      // ⚠️ আগে ১টা মাত্র বিক্রি হওয়া পণ্যকেও "জনপ্রিয় পণ্য"/"গ্রাহকের পছন্দ" বলে
      // দেখানো হতো — বাস্তব বিক্রির তথ্য যথেষ্ট না থাকলে এই দাবিটা fabricated/
      // বিভ্রান্তিকর মনে হতে পারে। এখন অন্তত ৩টা পণ্যের প্রতিটাতে অন্তত ৩টা করে
      // বিক্রি না হলে "জনপ্রিয়" দাবি না করে, নিরাপদ "নতুন যোগ হয়েছে" framing-এ
      // পড়ে যায় (নতুন পণ্য দেখিয়ে)।
      const hasEnoughSalesData = popularCandidates.filter(p=>Number(p.sold)>=3).length >= 3;
      const popular = hasEnoughSalesData
        ? popularCandidates.slice(0,10)
        : available.slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,10);
      const popularKickerEl = document.getElementById('popularProductsKicker');
      const popularTitleEl = document.getElementById('popularProductsTitle');
      const popularDescEl = document.getElementById('popularProductsDesc');
      if(popularKickerEl) popularKickerEl.textContent = hasEnoughSalesData ? 'বেশি অর্ডার হওয়া পণ্য' : 'সদ্য যোগ হয়েছে';
      if(popularTitleEl) popularTitleEl.innerHTML = hasEnoughSalesData
        ? '<span class="ic ic-star" aria-hidden="true"></span>জনপ্রিয় পণ্য'
        : '<span class="ic ic-sparkle" aria-hidden="true"></span>নতুন যোগ হয়েছে';
      if(popularDescEl) popularDescEl.textContent = hasEnoughSalesData
        ? 'যেগুলো বেশি অর্ডার হচ্ছে।'
        : 'সম্প্রতি যোগ হওয়া পণ্য দেখুন।';
      const prioritisedIds = new Set([...special,...popular].map(p=>p.id));
      // ⚠️ আগে এলোমেলোভাবে (ডেটাবেজে যেভাবে ছিল সেভাবেই) দেখাতো — মুদি-চা-গ্যাস-ন্যাপকিন
      // মিশে যেতো। এখন CATEGORIES তালিকার ক্রম অনুযায়ী গ্রুপ করে দেখানো হয় (সব মুদি
      // একসাথে, তারপর সব দুধ/বেকারি একসাথে, তারপর ঔষধ, এভাবে ক্যাটাগরি-ধারাবাহিকভাবে)।
      const remaining = available.filter(p=>!prioritisedIds.has(p.id));
      const catOrder = CATEGORIES.map(c=>c.id);
      remaining.sort((a,b)=>{
        const ai = catOrder.indexOf(a.category), bi = catOrder.indexOf(b.category);
        if(ai !== bi) return (ai===-1?999:ai) - (bi===-1?999:bi);
        return 0;
      });
      const more = [...remaining, ...available.filter(p=>prioritisedIds.has(p.id))].slice(0,10);

      if(specialSection) specialSection.hidden = special.length===0;
      if(popularSection) popularSection.hidden = popular.length===0;

      const fr=document.getElementById('flashRow'); if(fr) fr.innerHTML = special.map(pcardHTML).join('');
      // ⚠️ আগে বাকি দুই section-ও আলাদাভাবে idx 0 থেকে গোনা শুরু করতো, তাই
      // "প্রথম ৪টা" প্রায়োরিটি আসলে পুরো পেজে ১২টা (বা তার বেশি) card-এ প্রযোজ্য
      // হয়ে যেতো — ব্রাউজারের কাছে "high priority"-এর অর্থ নষ্ট হয়ে যেতো এবং
      // দুর্বল নেটওয়ার্কে একসাথে অনেক eager image request গিয়ে বাকি সবকিছু
      // (ছবিসহ) ধীর করে দিতো। এখন শুধু পেজের একদম উপরের section (flashRow)
      // eager/high-priority পায়; বাকি দুটোতে idx offset দিয়ে lazy রাখা হয়েছে।
      const br=document.getElementById('bestRow'); if(br) br.innerHTML = popular.map((p,i)=>pcardHTML(p,i+100)).join('');
      const ng=document.getElementById('newGrid'); if(ng) ng.innerHTML = more.map((p,i)=>pcardHTML(p,i+100)).join('') || empty('এই মুহূর্তে স্টকে কোনো পণ্য নেই।');
    }
  }
};

const Medical = {
  render(){
    const el = document.getElementById('medGrid');
    if(!el) return;
    el.innerHTML = MED_LIST.map(m=>`
      <div class="card" style="padding:18px">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><span style="font-size:28px">${m.icon}</span><div><div style="font-weight:600;color:var(--ink);font-size:13.5px">${esc(m.name)}</div><div style="font-size:12px;color:var(--emerald)">${esc(m.spec)}</div></div></div>
        <div style="font-size:11.5px;color:var(--ink-muted);margin-bottom:8px">🗓️ ${esc(m.sched)}</div>
        <div style="font-size:11px;color:var(--ink-dim);margin-bottom:12px">📍 ${esc(m.addr)||'চেম্বার তথ্যের জন্য কল করুন'}</div>
        <a href="tel:+880${(m.serial||'1612057371').split(',')[0].trim().replace(/^0/,'')}" class="btn btn-medical btn-block" style="font-size:12.5px;padding:9px" onclick="Medical.trackCall('${m.name.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">📞 সিরিয়াল: ${esc(m.serial)||'01612-057371'}</a>
      </div>`).join('');
  },
  trackCall(doctorName){
    if(typeof dataLayer!=='undefined'){
      dataLayer.push({event:'doctor_call_click', doctor_name: doctorName});
    }
  }
};

/* ---------- Listing ---------- */
const Listing = {
  toggleMobile(){ document.getElementById('listingAside')?.classList.toggle('show'); },
  selectedCategories: new Set(),
  renderCategoryFilters(){
    const el = document.getElementById('filterCategoryList');
    if(!el) return;
    el.innerHTML = CATEGORIES.map(c=>`<label class="filter-opt"><input type="checkbox" value="${c.id}" onchange="Listing.toggleCategory('${c.id}',this.checked)" ${this.selectedCategories.has(c.id)?'checked':''}> ${c.icon} ${currentLang==='bn'?c.label:(c.labelEn||c.label)}</label>`).join('');
  },
  toggleCategory(id, checked){
    checked ? this.selectedCategories.add(id) : this.selectedCategories.delete(id);
    this.render();
  },
  clearFilters(){
    this.selectedCategories.clear();
    const pr=document.getElementById('priceRange'); if(pr) pr.value = 10000;
    const pl=document.getElementById('priceMaxLabel'); if(pl) pl.textContent='৳১০,০০০';
    const cod=document.getElementById('filterCOD'); if(cod) cod.checked=false;
    const stock=document.getElementById('filterInStock'); if(stock) stock.checked=false;
    this.renderCategoryFilters();
    this.render();
  },
  render(){
    const cat = Router.params.cat || 'all';
    const q = (Router.params.q||'').trim().toLowerCase();
    const sortEl=document.getElementById('sortSelect');
    const sort = sortEl?sortEl.value:'relevance';
    // ⚠️ যথেষ্ট verified review ডেটা না থাকলে "সর্বোচ্চ রেটিং" sort option
    // দেখানো হচ্ছে না — সামান্য/অস্তিত্বহীন রিভিউ দিয়ে rating দিয়ে সাজানো
    // fabricated/বিভ্রান্তিকর মনে হতে পারে।
    const ratingOptEl = sortEl?.querySelector('option[value="rating"]');
    if(ratingOptEl){
      const hasEnoughReviews = ALL_PRODUCTS.filter(p=>Number(p.reviews)>=5).length >= 5;
      ratingOptEl.hidden = !hasEnoughReviews;
      if(!hasEnoughReviews && sort==='rating' && sortEl){ sortEl.value='relevance'; }
    }
    if(!document.getElementById('filterCategoryList')?.children.length) this.renderCategoryFilters();
    let items = zoneProducts();
    let title = currentLang==='bn' ? 'সব পণ্য' : 'All Products';
    if(cat==='flash'){ items = items.filter(p=>p.isFlash); title = currentLang==='bn' ? '🔥 ফ্ল্যাশ সেল' : '🔥 Flash Sale'; }
    else if(cat==='bestseller'){ items = [...items].sort((a,b)=>b.sold-a.sold); title = currentLang==='bn' ? '⭐ বেস্ট সেলার' : '⭐ Best Seller'; }
    else if(cat!=='all'){ items = items.filter(p=>p.category===cat); const catObj=CATEGORIES.find(c=>c.id===cat); title = (currentLang==='bn' ? catObj?.label : (catObj?.labelEn||catObj?.label)) || cat; }
    if(q){ items = items.filter(p=>p.name.toLowerCase().includes(q)); title = currentLang==='bn' ? `"${q}" — অনুসন্ধান` : `"${q}" — Search Results`; }
    if(this.selectedCategories.size) items = items.filter(p=>this.selectedCategories.has(p.category));
    const priceMax = Number(document.getElementById('priceRange')?.value||10000);
    if(priceMax < 10000) items = items.filter(p=>p.salePrice <= priceMax);
    const codEl=document.getElementById('filterCOD');
    if(codEl && codEl.checked) items = items.filter(p=>p.cod);
    const stockEl=document.getElementById('filterInStock');
    if(stockEl && stockEl.checked) items = items.filter(p=>p.stock>0);
    if(sort==='price_asc') items.sort((a,b)=>a.salePrice-b.salePrice);
    if(sort==='price_desc') items.sort((a,b)=>b.salePrice-a.salePrice);
    if(sort==='newest') items.sort((a,b)=>{
      const at = a.createdAt?.seconds || a.createdAt?.toMillis?.() / 1000 || 0;
      const bt = b.createdAt?.seconds || b.createdAt?.toMillis?.() / 1000 || 0;
      return bt - at;
    });
    if(sort==='rating') items.sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating));
    if(sort==='sold') items.sort((a,b)=>b.sold-a.sold);
    const titleEl=document.getElementById('listTitle'); if(titleEl) titleEl.textContent = title;
    const crumbTitleEl=document.getElementById('listTitleCrumb'); if(crumbTitleEl) crumbTitleEl.textContent = title;
    const subtitleEl=document.getElementById('listSubtitle');
    if(subtitleEl){
      subtitleEl.textContent = q
        ? (currentLang==='bn' ? 'সার্চের সঙ্গে মিলে এমন পণ্য দেখানো হচ্ছে। প্রয়োজন হলে ফিল্টার বদলে দেখুন।' : 'Showing products that match your search. Adjust filters if needed.')
        : (cat==='all'
          ? (currentLang==='bn' ? 'যা লাগবে খুঁজে কার্টে যোগ করুন।' : 'Find what you need, filter quickly, and add items to cart.')
          : (currentLang==='bn' ? 'এই বিভাগের উপলভ্য পণ্যগুলো দেখুন।' : 'Browse available products in this category.'));
    }
    const grid=document.getElementById('listingGrid');
    // ⚠️ আগে ProductStore.loaded চেক না থাকায়, ডেটা এখনো না এলেও সরাসরি
    // "কোনো প্রোডাক্ট পাওয়া যায়নি" দেখাতো — বিভ্রান্তিকর, মনে হতো সত্যিই কোনো পণ্য নেই।
    // এখন লোড না হওয়া পর্যন্ত স্পষ্ট "লোড হচ্ছে" অবস্থা দেখানো হয়।
    if(!ProductStore.loaded){
      const countEl=document.getElementById('listCount'); if(countEl) countEl.textContent = currentLang==='bn' ? 'লোড হচ্ছে... (ধীর নেটওয়ার্কে একটু সময় লাগতে পারে)' : 'Loading... (may take a moment on slow networks)';
      if(grid) grid.innerHTML = skeletonCards(6);
      return;
    }
    const countEl=document.getElementById('listCount'); if(countEl) countEl.textContent = currentLang==='bn' ? `${bn(items.length)} টি প্রোডাক্ট পাওয়া গেছে` : `${items.length} products found`;
    if(grid) grid.innerHTML = items.map(pcardHTML).join('') || `<div class="empty-state listing-empty" style="grid-column:1/-1"><span class="ic ic-search" aria-hidden="true"></span><h3>${currentLang==='bn'?'কোনো প্রোডাক্ট পাওয়া যায়নি':'No products found'}</h3><p>${currentLang==='bn'?'ফিল্টার কমিয়ে দেখুন, অন্য শব্দ দিয়ে সার্চ করুন, অথবা বাজারের তালিকা পাঠান।':'Try fewer filters, search another term, or send a shopping list.'}</p><div><button class="btn btn-outline" onclick="Listing.clearFilters()">${currentLang==='bn'?'ফিল্টার রিসেট করুন':'Reset Filters'}</button><button class="btn btn-gold" onclick="Router.go('custom-bazar')">${currentLang==='bn'?'তালিকা পাঠান':'Send List'}</button></div></div>`;
  }
};

/* ---------- PDP ---------- */
/* সাইট-লেভেল রিভিউ (নির্দিষ্ট প্রোডাক্ট না, পুরো Golapi Shop Online নিয়ে অভিজ্ঞতা) —
   প্রোডাক্ট রিভিউ-এর একই ReviewService/Firestore 'reviews' collection পুনরায়
   ব্যবহার করা হচ্ছে, শুধু productId হিসেবে একটা reserved sentinel মান
   ('SITE_REVIEW') ব্যবহার করা হয়েছে — তাই আলাদা কোনো নতুন Firestore rules লাগছে না। */
const SITE_REVIEW_ID = 'SITE_REVIEW';
const SiteReview = {
  currentRating: 0,
  async render(){
    const formEl = document.getElementById('siteReviewForm');
    if(formEl){
      if(Auth.currentUser){
        formEl.innerHTML = `
        <div style="display:flex;gap:4px;margin-bottom:10px;font-size:24px;cursor:pointer" id="siteStarInput">
          <span onclick="SiteReview.setRating(1)" data-star="1">☆</span>
          <span onclick="SiteReview.setRating(2)" data-star="2">☆</span>
          <span onclick="SiteReview.setRating(3)" data-star="3">☆</span>
          <span onclick="SiteReview.setRating(4)" data-star="4">☆</span>
          <span onclick="SiteReview.setRating(5)" data-star="5">☆</span>
        </div>
        <div class="field"><textarea id="siteReviewText" rows="3" placeholder="অর্ডার, ডেলিভারি বা সাইট ব্যবহারের অভিজ্ঞতা লিখুন..."></textarea></div>
        <button class="btn btn-gold" style="font-size:13px" onclick="SiteReview.submit()">মতামত জমা দিন</button>`;
      }else{
        formEl.innerHTML = `
        <p style="font-size:13px;color:var(--ink-muted);margin-bottom:12px">মতামত দিতে অ্যাকাউন্ট প্রয়োজন — লগইন করা থাকলেই দেওয়া যায়।</p>
        <button class="btn btn-gold" style="font-size:13px" onclick="AuthUI.open()">লগইন / অ্যাকাউন্ট তৈরি করুন</button>`;
      }
    }
    await ReviewService.renderReviews(SITE_REVIEW_ID, 'siteReviewList');
  },
  setRating(n){
    this.currentRating=n;
    document.querySelectorAll('#siteStarInput span').forEach(s=>{
      const star=parseInt(s.dataset.star);
      s.textContent = star<=n?'★':'☆';
      s.style.color = star<=n?'var(--gold)':'var(--ink-muted)';
    });
  },
  async submit(){
    const text=document.getElementById('siteReviewText')?.value.trim()||'';
    const userName = Auth.currentUser?.displayName || 'গ্রাহক';
    const ok = await ReviewService.submitReview(SITE_REVIEW_ID, this.currentRating, text, userName, null);
    if(ok){
      this.currentRating=0;
      const rt=document.getElementById('siteReviewText'); if(rt) rt.value='';
      this.render();
    }
  }
};

const PDP = {
  product:null, qty:1,
  load(id){
    const zp = zoneProducts();
    this.product = zp.find(p=>p.id===id);
    if(!this.product){ toast(currentLang==='bn'?'প্রোডাক্ট পাওয়া যায়নি':'Product not found','error'); Router.go('listing',{cat:'all'}); return; }
    this.qty = 1;
    const p = this.product;
    const homeLabel = currentLang==='bn'?'হোম':'Home';
    const catObj = CATEGORIES.find(c=>c.id===p.category);
    const catLabelCrumb = (currentLang==='bn' ? catObj?.label : (catObj?.labelEn||catObj?.label)) || '';
    const crumb=document.getElementById('pdpCrumb');
    if(crumb) crumb.innerHTML = `<a href="#" onclick="Router.go('home')">${homeLabel}</a> &gt; <a href="#" onclick="Router.go('listing',{cat:'${p.category}'})">${esc(catLabelCrumb)}</a> &gt; ${esc(p.name)}`;
    const img=document.getElementById('pdpImg'); if(img){ img.src = p.img; img.alt = p.name; }
    const fullImg=document.getElementById('pdpImgFull'); if(fullImg) fullImg.alt = p.name;
    const catLabel = catLabelCrumb || (currentLang==='bn'?'পণ্য':'Product');
    const catEl=document.getElementById('pdpCategoryLabel'); if(catEl) catEl.textContent=catLabel;
    const relatedLink=document.getElementById('pdpRelatedLink'); if(relatedLink) relatedLink.onclick=()=>Router.go('listing',{cat:p.category});
    const name=document.getElementById('pdpName'); if(name) name.textContent = p.name;
    const meta=document.getElementById('pdpMeta');
    if(meta) meta.innerHTML = p.reviews>0
      ? (currentLang==='bn'
          ? `<span aria-label="রেটিং">★ ${p.rating}</span> <span>(${bn(p.reviews)} মতামত)</span>`
          : `<span aria-label="Rating">★ ${p.rating}</span> <span>(${p.reviews} reviews)</span>`)
      : `<span>${currentLang==='bn'?'এই পণ্যে এখনো কোনো মতামত নেই':'No published reviews for this product yet'}</span>`;
    const price=document.getElementById('pdpPrice'); if(price) price.textContent = money(p.salePrice);
    const disc = p.price>p.salePrice ? Math.round((1-p.salePrice/p.price)*100) : 0;
    const old=document.getElementById('pdpOld'); if(old) old.textContent = disc? money(p.price):'';
    const discEl=document.getElementById('pdpDisc');
    if(discEl){ discEl.style.display='inline-block'; discEl.textContent = currentLang==='bn' ? `${bn(p.sold||0)} বিক্রি হয়েছে` : `${p.sold||0} sold`; }
    const ribbon=document.getElementById('pdpSavingsRibbon');
    if(ribbon){
      if(disc){ ribbon.style.display='flex'; ribbon.innerHTML = currentLang==='bn' ? `বাঁচলো<span class="amt">৳${bn(p.price - p.salePrice)}</span>` : `Saved<span class="amt">৳${p.price - p.salePrice}</span>`; }
      else { ribbon.style.display='none'; }
    }
    const unit=document.getElementById('pdpUnit'); if(unit) unit.textContent = '/ '+p.unit;
    const codTag = currentLang==='bn' ? 'ক্যাশ অন ডেলিভারি' : 'Cash on Delivery';
    const fastTag = currentLang==='bn' ? 'লোকাল ডেলিভারি' : 'Local Delivery';
    const tags=document.getElementById('pdpTags');
    if(tags) tags.innerHTML = `${p.cod?`<span class="cod-tag">${codTag}</span>`:''}${p.fastDelivery?`<span class="fast-tag">${fastTag}</span>`:''}`;
    const stock=document.getElementById('pdpStock');
    const inStock=Number(p.stock)>0;
    if(stock){
      stock.className='pdp-stock '+(!inStock?'is-unavailable':Number(p.stock)<=5?'is-low':'is-available');
      if(currentLang==='bn'){
        stock.textContent=!inStock?'বর্তমানে স্টক নেই':Number(p.stock)<=5?`মাত্র ${bn(p.stock)}টি স্টকে আছে`:'স্টকে আছে';
      } else {
        stock.textContent=!inStock?'Currently out of stock':Number(p.stock)<=5?`Only ${p.stock} left in stock`:'In Stock';
      }
    }
    const stockHelp=document.getElementById('pdpAssuranceStock');
    if(stockHelp) stockHelp.textContent = currentLang==='bn'
      ? (inStock?`${bn(p.stock)} ${p.unit} উপলভ্য`:'বর্তমানে অনুপলভ্য')
      : (inStock?`${p.stock} ${p.unit} available`:'Currently unavailable');
    const qtyHelp=document.getElementById('pdpQtyHelp');
    if(qtyHelp) qtyHelp.textContent = currentLang==='bn'
      ? (inStock?`সর্বোচ্চ ${bn(p.stock)} ${p.unit}`:'পরিমাণ নির্বাচন বন্ধ')
      : (inStock?`Max ${p.stock} ${p.unit}`:'Quantity selection disabled');
    ['pdpCartBtn','pdpBuyBtn','pdpMobileCartBtn','pdpMobileBuyBtn'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.disabled=!inStock; el.setAttribute('aria-disabled',String(!inStock)); } });
    const qtyEl=document.getElementById('pdpQty'); if(qtyEl) qtyEl.textContent = currentLang==='bn' ? '১' : '1';
    const desc=document.getElementById('pdpDesc');
    if(desc) desc.textContent = p.description || (currentLang==='bn'
      ? 'এই পণ্যের বিস্তারিত বিবরণ এখনো প্রকাশ করা হয়নি। অর্ডারের আগে নাম, ইউনিট, মূল্য ও স্টক তথ্য যাচাই করুন।'
      : "A detailed description for this product hasn't been published yet. Please verify the name, unit, price, and stock before ordering.");
    const spec=document.getElementById('pdpSpec');
    if(spec){
      if(currentLang==='bn'){
        spec.innerHTML = `<tr><td>ক্যাটাগরি</td><td>${catLabel}</td></tr><tr><td>বিক্রয় ইউনিট</td><td>${esc(p.unit)}</td></tr><tr><td>স্টক</td><td>${inStock?`${bn(p.stock)} ${esc(p.unit)}`:'স্টক নেই'}</td></tr><tr><td>পেমেন্ট</td><td>${p.cod?'ক্যাশ অন ডেলিভারি উপলভ্য':'চেকআউটে উপলভ্য পদ্ধতি দেখুন'}</td></tr>`;
      } else {
        spec.innerHTML = `<tr><td>Category</td><td>${catLabel}</td></tr><tr><td>Sales Unit</td><td>${esc(p.unit)}</td></tr><tr><td>Stock</td><td>${inStock?`${p.stock} ${esc(p.unit)}`:'Out of stock'}</td></tr><tr><td>Payment</td><td>${p.cod?'Cash on Delivery available':'See available methods at checkout'}</td></tr>`;
      }
    }
    const rel=document.getElementById('relatedRow');
    if(rel){ const related=zp.filter(x=>x.category===p.category && x.id!==p.id).slice(0,8); rel.innerHTML=related.length?related.map(pcardHTML).join(''):`<div class="empty-state"><p>${currentLang==='bn'?'এই ক্যাটাগরিতে আরও পণ্য পাওয়া যায়নি।':'No more products found in this category.'}</p></div>`; }
    const mobilePrice=document.getElementById('pdpMobilePrice'); if(mobilePrice) mobilePrice.textContent=money(p.salePrice);
    this.syncWishlistButton();
    this.tab(null,'desc');
    ReviewService.renderReviews(p.id, 'pdpReviews');
    const reviewForm=document.getElementById('pdpReviewForm');
    if(reviewForm){
      // ⚠️ আগে এই ফর্ম সবসময় দেখানো হতো, এমনকি লগইন ছাড়াই (guest) রিভিউ সাবমিট
      // করা যেতো — কোনো account থাকার শর্তই ছিল না। কেনাকাটা করতে হবে এমন শর্তও
      // কখনো ছিল না (সেটা ঠিকই ছিল, বহাল রাখা হলো) — শুধু এখন account/লগইন
      // বাধ্যতামূলক করা হলো, purchase-এর কোনো শর্ত নেই।
      if(Auth.currentUser){
        reviewForm.innerHTML = `
        <h3 class="tiro" style="font-size:16px;margin-bottom:10px">আপনার মতামত দিন</h3>
        <div style="display:flex;gap:4px;margin-bottom:10px;font-size:24px;cursor:pointer" id="starInput">
          <span onclick="PDP.setRating(1)" data-star="1">☆</span>
          <span onclick="PDP.setRating(2)" data-star="2">☆</span>
          <span onclick="PDP.setRating(3)" data-star="3">☆</span>
          <span onclick="PDP.setRating(4)" data-star="4">☆</span>
          <span onclick="PDP.setRating(5)" data-star="5">☆</span>
        </div>
        <div class="field"><textarea id="reviewText" rows="2" placeholder="আপনার অভিজ্ঞতা লিখুন..."></textarea></div>
        <div class="field"><label style="font-size:11.5px">ছবি যোগ করুন (না দিলেও চলবে)</label><input type="file" id="reviewPhoto" accept="image/*"></div>
        <button class="btn btn-gold" style="font-size:13px" onclick="PDP.submitReview()">মতামত জমা দিন</button>`;
      }else{
        reviewForm.innerHTML = `
        <h3 class="tiro" style="font-size:16px;margin-bottom:8px">মতামত দিতে অ্যাকাউন্ট প্রয়োজন</h3>
        <p style="font-size:13px;color:var(--ink-muted);margin-bottom:12px">পণ্য কেনা জরুরি নয় — লগইন করা থাকলেই মতামত দেওয়া যায়।</p>
        <button class="btn btn-gold" style="font-size:13px" onclick="AuthUI.open()">লগইন / অ্যাকাউন্ট তৈরি করুন</button>`;
      }
    }
    this.injectProductSchema(p, disc);
  },
  injectProductSchema(p, disc){
    const old = document.getElementById('productSchemaLD');
    if(old) old.remove();
    const schema = {
      "@context":"https://schema.org",
      "@type":"Product",
      "name": p.name,
      "image": p.img,
      "description": p.description || `${p.name} — Golapi Shop Online থেকে হোম ডেলিভারি, নোয়াখালিতে।`,
      "sku": p.id,
      "brand": { "@type":"Brand", "name":"Golapi Shop Online" },
      "offers": {
        "@type":"Offer",
        "url": `https://www.golapishop.online/#product?id=${p.id}`,
        "priceCurrency":"BDT",
        "price": p.salePrice,
        "availability": p.stock>0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "itemCondition":"https://schema.org/NewCondition"
      }
    };
    if(p.reviews>0){
      schema.aggregateRating = {
        "@type":"AggregateRating",
        "ratingValue": p.rating,
        "reviewCount": p.reviews
      };
    }
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'productSchemaLD';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  },
  currentRating:0,
  setRating(n){
    this.currentRating=n;
    document.querySelectorAll('#starInput span').forEach(s=>{
      const star=parseInt(s.dataset.star);
      s.textContent = star<=n?'★':'☆';
      s.style.color = star<=n?'var(--gold)':'var(--ink-muted)';
    });
  },
  async submitReview(){
    const text=document.getElementById('reviewText')?.value.trim()||'';
    const userName = Auth.currentUser?.displayName || 'গ্রাহক';
    const photoFile = document.getElementById('reviewPhoto')?.files[0] || null;
    const ok = await ReviewService.submitReview(this.product.id, this.currentRating, text, userName, photoFile);
    if(ok){
      this.currentRating=0;
      const rt=document.getElementById('reviewText'); if(rt) rt.value='';
      const rp=document.getElementById('reviewPhoto'); if(rp) rp.value='';
      ReviewService.renderReviews(this.product.id, 'pdpReviews');
    }
  },
  openFullImg(){
    const overlay=document.getElementById('pdpImgOverlay');
    const fullImg=document.getElementById('pdpImgFull');
    if(overlay && fullImg){
      // ⚠️ আগে সরাসরি this.product?.img||'' বসানো হতো, কোনো fallback/error-handling
      // ছাড়া। ছবির URL কোনো কারণে লোড ব্যর্থ হলে (broken link, ধীর নেটওয়ার্ক,
      // CORS ইত্যাদি) শুধু গাঢ় কালো overlay-টাই দেখা যেত, ভেতরে কিছুই না —
      // ঠিক যে সমস্যাটা রিপোর্ট হয়েছে। এখন safeImgSrc() fallback ব্যবহার করা
      // হচ্ছে (অন্য জায়গায় যেমন ব্যবহার হয়), আর onerror হলেও placeholder দেখাবে।
      fullImg.onerror = () => { fullImg.src = GOLAPI_IMG_PLACEHOLDER; };
      fullImg.src = safeImgSrc(this.product?.img);
      overlay.classList.add('is-open');
      document.body.style.overflow='hidden';
    }
  },
  closeFullImg(){
    const overlay=document.getElementById('pdpImgOverlay');
    if(overlay) overlay.classList.remove('is-open');
    document.body.style.overflow='';
  },
  syncWishlistButton(){
    const btn=document.getElementById('pdpWishlistBtn'); if(!btn||!this.product) return;
    const active=typeof Wishlist!=='undefined' && Wishlist.has(this.product.id);
    btn.classList.toggle('is-active',active); btn.setAttribute('aria-pressed',String(active)); btn.textContent=active?'♥ সংরক্ষিত':'♡ সংরক্ষণ';
  },
  toggleWishlist(){ if(!this.product||typeof Wishlist==='undefined') return; Wishlist.toggle(this.product.id); this.syncWishlistButton(); },
  tab(btn,name){
    document.querySelectorAll('.pdp-tabs button').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false');});
    document.querySelectorAll('.tab-pane').forEach(b=>b.classList.remove('active'));
    if(btn){ btn.classList.add('active'); btn.setAttribute('aria-selected','true'); } else { const first=document.querySelector('.pdp-tabs button'); first?.classList.add('active'); first?.setAttribute('aria-selected','true'); }
    const pane=document.getElementById('tab-'+name); if(pane) pane.classList.add('active');
  },
  changeQty(d){
    const max = this.product?.stock ?? 99;
    this.qty = Math.max(1, Math.min(max, this.qty+d));
    const el=document.getElementById('pdpQty'); if(el) el.textContent = bn(this.qty);
  },
  addToCart(){ if(!this.product||Number(this.product.stock)<=0){ toast('পণ্যটি বর্তমানে স্টকে নেই','error'); return; } Cart.add(this.product.id, this.qty); },
  buyNow(){ if(!this.product||Number(this.product.stock)<=0){ toast('পণ্যটি বর্তমানে স্টকে নেই','error'); return; } Cart.add(this.product.id, this.qty); Router.go('checkout'); }
};

/* ---------- Cart ---------- */
const Cart = {
  items:{},
  lastFocused:null,
  load(){
    try{
      const saved = JSON.parse(localStorage.getItem('golapi_cart')||'{}');
      this.items = saved && typeof saved==='object' && !Array.isArray(saved) ? saved : {};
    }catch(e){ this.items={}; }
    this.sanitize(false);
    this.badge();
  },
  sanitize(persist=true){
    let changed=false;
    Object.entries(this.items).forEach(([id,rawQty])=>{
      const p=ALL_PRODUCTS.find(x=>x.id===id);
      const stock=Math.max(0,Number(p?.stock)||0);
      const qty=Math.floor(Number(rawQty)||0);
      if(!p || stock<=0 || qty<=0){ delete this.items[id]; changed=true; return; }
      const safeQty=Math.min(qty,stock);
      if(safeQty!==qty){ this.items[id]=safeQty; changed=true; }
    });
    if(changed && persist) this.save();
    return changed;
  },
  save(){
    localStorage.setItem('golapi_cart', JSON.stringify(this.items));
    localStorage.setItem('golapi_cart_time', Date.now().toString());
    this.badge();
  },
  add(id,qty=1){
    const p=ALL_PRODUCTS.find(x=>x.id===id);
    if(!p){ toast('পণ্যটি খুঁজে পাওয়া যায়নি','error'); return; }
    const stock=Math.max(0,Number(p.stock)||0);
    if(stock<=0){ toast('পণ্যটি বর্তমানে স্টকে নেই','error'); return; }
    const requested=Math.max(1,Math.floor(Number(qty)||1));
    const current=Math.max(0,Number(this.items[id])||0);
    const next=Math.min(stock,current+requested);
    this.items[id]=next;
    this.save();
    toast(next<current+requested?'স্টকে থাকা সর্বোচ্চ পরিমাণ কার্টে রাখা হয়েছে':'✓ কার্টে যুক্ত হয়েছে',next<current+requested?'info':'success');
    this.renderDrawer();
    if(typeof dataLayer!=='undefined'){
      dataLayer.push({event:'add_to_cart', currency:'BDT', value:p.salePrice*(next-current), items:[{item_id:id,item_name:p.name||'',quantity:Math.max(0,next-current),price:p.salePrice||0}]});
    }
  },
  remove(id){
    const p=ALL_PRODUCTS.find(x=>x.id===id);
    delete this.items[id]; this.save(); this.renderDrawer();
    toast(`${esc(p?.name)||'পণ্য'} কার্ট থেকে সরানো হয়েছে`,'info');
  },
  setQty(id,qty){
    const p=ALL_PRODUCTS.find(x=>x.id===id);
    if(!p){ this.remove(id); return; }
    const stock=Math.max(0,Number(p.stock)||0);
    const next=Math.floor(Number(qty)||0);
    if(next<=0){ this.remove(id); return; }
    if(stock<=0){ this.remove(id); toast('পণ্যটি আর স্টকে নেই','error'); return; }
    this.items[id]=Math.min(next,stock);
    this.save(); this.renderDrawer();
    if(next>stock) toast(`বর্তমানে সর্বোচ্চ ${bn(stock)}টি পাওয়া যাচ্ছে`,'info');
  },
  totalCount(){ return Object.values(this.items).reduce((a,b)=>a+(Number(b)||0),0); },
  totalPrice(){ return Object.entries(this.items).reduce((s,[id,q])=>{ const p=ALL_PRODUCTS.find(x=>x.id===id); return s+(p?p.salePrice*q:0); },0); },
  badge(){
    const c=this.totalCount();
    const el=document.getElementById('cartBadge');
    const drawerCount=document.getElementById('cartDrawerCount');
    if(el){ if(c>0){ el.style.display='flex'; el.textContent=bn(c); } else el.style.display='none'; }
    if(drawerCount) drawerCount.textContent=bn(c);
  },
  renderDrawer(){
    const body=document.getElementById('cartBody'), foot=document.getElementById('cartFoot');
    if(!body) return;
    this.sanitize();
    const entries=Object.entries(this.items);
    this.badge();
    if(!entries.length){
      body.innerHTML=`<div class="cart-empty"><div class="cart-empty__icon" aria-hidden="true"><span class="ic ic-cart"></span></div><h3>কার্ট এখনো খালি</h3><p>প্রয়োজনীয় পণ্য যোগ করলে এখানে দাম ও পরিমাণ একসঙ্গে দেখতে পারবেন।</p><button type="button" class="btn btn-gold" onclick="Cart.close();Router.go('listing',{cat:'all'})">পণ্য দেখুন</button></div>`;
      if(foot) foot.hidden=true;
      return;
    }
    let total=0,itemCount=0;
    body.innerHTML=entries.map(([id,q])=>{
      const p=ALL_PRODUCTS.find(x=>x.id===id); if(!p) return '';
      const stock=Math.max(0,Number(p.stock)||0);
      const lineTotal=p.salePrice*q; total+=lineTotal; itemCount+=q;
      return `<article class="cart-item">
        <button type="button" class="cart-item__image" onclick="Cart.close();Router.go('product',{id:'${id}'})" aria-label="${esc(p.name)} বিস্তারিত দেখুন"><img src="${safeImgSrc(p.img)}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="64" height="64"></button>
        <div class="cart-item__content">
          <div class="cart-item__top">
            <button type="button" class="cart-item__name" onclick="Cart.close();Router.go('product',{id:'${id}'})">${esc(p.name)}</button>
            <button type="button" class="cart-item__remove" onclick="Cart.remove('${id}')" aria-label="${esc(p.name)} কার্ট থেকে সরান">✕</button>
          </div>
          <p class="cart-item__meta">${money(p.salePrice)} / ${esc(p.unit)}${stock<=5?` · মাত্র ${bn(stock)}টি আছে`:''}</p>
          <div class="cart-item__bottom">
            <div class="qty-ctrl cart-item__qty" role="group" aria-label="${esc(p.name)} পরিমাণ">
              <button type="button" onclick="Cart.setQty('${id}',${q-1})" aria-label="পরিমাণ কমান">−</button>
              <span aria-live="polite">${bn(q)}</span>
              <button type="button" onclick="Cart.setQty('${id}',${q+1})" aria-label="পরিমাণ বাড়ান" ${q>=stock?'disabled':''}>+</button>
            </div>
            <strong class="cart-item__total">${money(lineTotal)}</strong>
          </div>
        </div>
      </article>`;
    }).join('');
    if(foot) foot.hidden=false;
    const estimatedDelivery=typeof calcDeliveryCharge==='function' ? calcDeliveryCharge(itemCount,total,null) : 0;
    const sub=document.getElementById('cartSub'); if(sub) sub.textContent=money(total);
    const delEl=document.getElementById('cartDel'); if(delEl) delEl.textContent=estimatedDelivery===0?'ফ্রি':money(estimatedDelivery);
    const tot=document.getElementById('cartTot'); if(tot) tot.textContent=money(total+estimatedDelivery);
  },
  open(){
    const drawer=document.getElementById('cartDrawer'),overlay=document.getElementById('cartOverlay');
    if(!drawer||!overlay) return;
    this.lastFocused=document.activeElement;
    drawer.classList.add('show'); overlay.classList.add('show');
    drawer.setAttribute('aria-hidden','false'); overlay.setAttribute('aria-hidden','false');
    drawer.removeAttribute('inert'); overlay.removeAttribute('inert');
    document.body.classList.add('cart-open');
    this.renderDrawer();
    setTimeout(()=>drawer.querySelector('.cart-drawer__close')?.focus(),50);
  },
  close(){
    const drawer=document.getElementById('cartDrawer'),overlay=document.getElementById('cartOverlay');
    drawer?.classList.remove('show'); overlay?.classList.remove('show');
    drawer?.setAttribute('aria-hidden','true'); overlay?.setAttribute('aria-hidden','true');
    drawer?.setAttribute('inert',''); overlay?.setAttribute('inert','');
    document.body.classList.remove('cart-open');
    this.lastFocused?.focus?.();
  },
  goCheckout(){ if(!this.totalCount()){ toast('কার্ট খালি আছে'); return; } this.close(); Router.go('checkout'); }
};
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && document.getElementById('cartDrawer')?.classList.contains('show')) Cart.close(); });
Cart.load();

/* ---------- Search: suggestions, recent searches, voice search ---------- */
function getRecentSearches(){
  try{ return JSON.parse(localStorage.getItem('golapi_recent_searches')||'[]'); }catch(e){ return []; }
}
function saveRecentSearch(q){
  if(!q || !q.trim()) return;
  let list = getRecentSearches().filter(x=>x.toLowerCase()!==q.toLowerCase());
  list.unshift(q.trim());
  list = list.slice(0,6);
  localStorage.setItem('golapi_recent_searches', JSON.stringify(list));
}
function doSearch(v){
  const box = document.getElementById('searchSuggestBox');
  if(!box) return;
  const query = (v||'').trim().toLowerCase();
  if(!query){
    const recent = getRecentSearches();
    if(!recent.length){ box.style.display='none'; return; }
    box.innerHTML = `<div class="search-suggest-title">সাম্প্রতিক অনুসন্ধান</div>` +
      recent.map(r=>`<button type="button" class="search-suggest-row" onclick="document.getElementById('searchInput').value='${esc(r).replace(/'/g,"\\'")}';submitSearch()"><span class="ic ic-clock" aria-hidden="true"></span><span>${esc(r)}</span></button>`).join('');
    box.style.display='block';
    return;
  }
  const productMatches = ALL_PRODUCTS.filter(p=>p.name.toLowerCase().includes(query)).slice(0,6);
  const categoryMatches = CATEGORIES.filter(c=>c.label.toLowerCase().includes(query) || (c.labelEn||'').toLowerCase().includes(query)).slice(0,3);
  if(!productMatches.length && !categoryMatches.length){
    box.innerHTML = `<div class="search-empty"><span class="ic ic-search" aria-hidden="true"></span><strong>কোনো মিল পাওয়া যায়নি</strong><small>অন্য শব্দ লিখুন, অথবা বাজারের তালিকা পাঠান।</small><button type="button" onclick="Router.go('custom-bazar');document.getElementById('searchSuggestBox').style.display='none'">তালিকা পাঠান</button></div>`;
    box.style.display='block';
    return;
  }
  const categoryHtml = categoryMatches.length
    ? `<div class="search-suggest-title">ক্যাটাগরি</div>${categoryMatches.map(c=>`<button type="button" class="search-suggest-row" onclick="Router.go('listing',{cat:'${c.id}'});document.getElementById('searchSuggestBox').style.display='none'"><span class="search-suggest-emoji" aria-hidden="true">${c.icon}</span><span>${currentLang==='bn'?esc(c.label):esc(c.labelEn||c.label)}</span></button>`).join('')}`
    : '';
  const productHtml = productMatches.length
    ? `<div class="search-suggest-title">পণ্য</div>${productMatches.map(p=>`<button type="button" class="search-suggest-product" onclick="Router.go('product',{id:'${p.id}'});document.getElementById('searchSuggestBox').style.display='none'">
    <img src="${safeImgSrc(p.img)}" alt="" loading="lazy" decoding="async">
    <span><strong>${esc(p.name)}</strong><small>${money(p.salePrice)} / ${esc(p.unit)}</small></span>
  </button>`).join('')}`
    : '';
  box.innerHTML = categoryHtml + productHtml + `<button type="button" class="search-see-all" onclick="submitSearch()">সব ফলাফল দেখুন</button>`;
  box.style.display='block';
}
function submitSearch(){
  const q = document.getElementById('searchInput')?.value.trim();
  if(!q) return;
  saveRecentSearch(q);
  const box = document.getElementById('searchSuggestBox'); if(box) box.style.display='none';
  Router.go('listing',{cat:'all', q});
}
/* iOS Safari-তে Web Speech API নির্ভরযোগ্যভাবে কাজ করে না (Apple-এর সীমাবদ্ধতা,
   আমাদের কোডের সমস্যা না) — তাই মাইক বাটনটাই লুকিয়ে ফেলা হয়, বিভ্রান্তিকর error না দেখিয়ে */
(function hideMicOnUnsupportedIOS(){
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const hasSpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(isIOS || !hasSpeechRec){
    let tries = 0;
    const hide = ()=>{
      const btn = document.getElementById('voiceSearchBtn');
      if(btn){ btn.style.display='none'; return; }
      if(++tries < 20) setTimeout(hide, 300); // header slot-এ async লোড হয়, তাই কয়েকবার চেষ্টা
    };
    hide();
  }
})();
function toggleVoiceSearch(){
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRec){ toast('এই ব্রাউজারে ভয়েস সার্চ সাপোর্ট নেই','error'); return; }
  const btn = document.getElementById('voiceSearchBtn');
  const rec = new SpeechRec();
  rec.lang = 'bn-BD';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  btn.classList.add('listening');
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById('searchInput').value = text;
    submitSearch();
  };
  rec.onerror = (e) => {
    // iOS Safari-তে Web Speech API নির্ভরযোগ্যভাবে কাজ করে না (Apple-এর সীমাবদ্ধতা,
    // আমাদের কোডের বাগ না) — তাই এই ব্রাউজারে বারবার fail করলে মাইক আইকনটাই
    // চিরতরে লুকিয়ে ফেলি, যাতে ভবিষ্যতে ইউজার আর বিভ্রান্তিকর error না দেখে
    if(e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture'){
      toast('মাইক্রোফোন পারমিশন দিন, অথবা টাইপ করে সার্চ করুন','error');
    } else {
      localStorage.setItem('golapi_voice_unsupported','1');
      if(btn) btn.style.display = 'none';
      toast('এই ডিভাইসে ভয়েস সার্চ কাজ করছে না — টাইপ করে সার্চ করুন','error');
    }
  };
  rec.onend = () => { btn.classList.remove('listening'); };
  rec.start();
}
document.addEventListener('DOMContentLoaded', ()=>{
  // আগে একবার fail করে থাকলে মাইক বাটন শুরু থেকেই লুকানো থাকবে
  if(localStorage.getItem('golapi_voice_unsupported')==='1'){
    const btn = document.getElementById('voiceSearchBtn');
    if(btn) btn.style.display = 'none';
  }
});
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('searchInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter') submitSearch(); });
});

function onDeliveryZoneChange(prefix){
  const deliveryZone = document.getElementById(prefix+'District')?.value;
  const zoneSel = document.getElementById(prefix+'Zone');
  if(!zoneSel) return;
  if(deliveryZone && BRANCH_INFO[deliveryZone]?.active === false){
    if(typeof toast === 'function') toast(`দুঃখিত, ${BRANCH_INFO[deliveryZone].label} বর্তমানে সাময়িকভাবে বন্ধ আছে। অন্য জোন বেছে নিন।`, 'error');
    const distEl = document.getElementById(prefix+'District'); if(distEl) distEl.value = '';
    zoneSel.innerHTML = '<option value="">প্রথমে ডেলিভারি জোন বেছে নিন</option>';
    return;
  }
  if(!deliveryZone){ zoneSel.innerHTML = '<option value="">প্রথমে ডেলিভারি জোন বেছে নিন</option>'; }
  else { zoneSel.innerHTML = '<option value="">এলাকা বেছে নিন</option>' + AREA_ZONES[deliveryZone].map(z=>`<option value="${z}">${z}</option>`).join(''); }
  if(prefix==='cb'){
    const numEl = document.getElementById('cbBkashNum');
    if(numEl) numEl.textContent = deliveryZone ? BRANCH_INFO[deliveryZone].bkashNumber : 'ডেলিভারি জোন বেছে নিলে দেখাবে';
  }
  if(prefix==='ck'){
    const payInfo = document.getElementById('ckPayInfo');
    if(payInfo && payInfo.dataset.method) Checkout.selectPayByMethod(payInfo.dataset.method);
  }
}

/* ---------- Delivery charge ---------- */
const DELIVERY_SETTINGS = { baseFee: 30, perKmFee: 8, perItemFee: 3, avgDistanceKm: 3, freeAboveSubtotal: 1000, deliveryRadiusKm: 12, maxDistanceKm: 20 };
async function loadLiveDeliverySettings(){
  const FB = window.__fb;
  if(!FB) return;
  try{
    const snap = await FB.getDoc(FB.doc(FB.db,'setting','delivery'));
    if(snap.exists()) Object.assign(DELIVERY_SETTINGS, snap.data());
  }catch(e){ devWarn('live delivery settings load failed', e.message); }
}
// ⚠️ আগে সরাসরি এখানেই কল হতো, তখনো FB declare হয়নি (app.js পরে লোড হয়) —
// "Can't find variable: FB" এরর হতো, ঠিক utils.js-এর loadLiveDeliveryZones-এর
// মতোই। এখন firebase-ready event-এর অপেক্ষা করে।
if(window.__fb){ loadLiveDeliverySettings(); }
else { window.addEventListener('firebase-ready', loadLiveDeliverySettings); }
function calcDeliveryCharge(itemCount, subtotal=0, distanceKm=null){
  if(subtotal >= DELIVERY_SETTINGS.freeAboveSubtotal) return 0;
  const km = distanceKm ?? DELIVERY_SETTINGS.avgDistanceKm;
  const fee = DELIVERY_SETTINGS.baseFee + km*DELIVERY_SETTINGS.perKmFee + itemCount*DELIVERY_SETTINGS.perItemFee;
  return Math.round(fee);
}

/* ---------- Checkout ---------- */


/* ---------- Order Success ---------- */
const OrderSuccess = {
  storageKey: 'golapiLastOrderConfirmation',
  save(data){
    try{ sessionStorage.setItem(this.storageKey, JSON.stringify(data||{})); }catch(e){ devWarn('order confirmation save failed', e.message); }
  },
  get(){
    try{ return JSON.parse(sessionStorage.getItem(this.storageKey)||'{}'); }catch(e){ return {}; }
  },
  render(){
    const data=this.get();
    const set=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=value||'—'; };
    set('successOrderNo', data.orderNumber);
    set('successOrderTotal', Number.isFinite(Number(data.total)) ? money(Number(data.total)) : '—');
    set('successItemCount', data.itemCount ? `${data.itemCount}টি` : '—');
    set('successDeliveryArea', data.deliveryArea);
    const methodLabel={cod:'ক্যাশ অন ডেলিভারি',bkash:'বিকাশ',nagad:'নগদ','bkash+cod':'অগ্রিম বিকাশ + বাকি COD'}[data.paymentMethod]||'—';
    set('successPaymentMethod', methodLabel);
    const lead=document.getElementById('orderSuccessLead');
    const note=document.getElementById('successPaymentNote');
    if(data.paymentMethod==='bkash' || data.paymentMethod==='nagad'){
      if(lead) lead.textContent='পেমেন্টের তথ্য জমা হয়েছে। মিলিয়ে দেখা হলে অর্ডারের খবর আপডেট হবে।';
      if(note) note.querySelector('p').textContent='ট্রানজেকশন মিলিয়ে দেখা না হওয়া পর্যন্ত পেমেন্ট অপেক্ষায় থাকবে।';
    }else if(data.paymentMethod==='bkash+cod'){
      if(lead) lead.textContent='আপনার Custom Bazar অর্ডার জমা হয়েছে। ড্রাইভার বাজার করার পর বিলের ছবি এখানেই দেখতে পাবেন।';
      if(note) note.querySelector('p').textContent='অগ্রিম ৳১০০ বাদে বাকি বিল ডেলিভারির সময় নগদ পরিশোধ করুন।';
    }else{
      if(lead) lead.textContent='অর্ডারের পরবর্তী আপডেট “আমার অর্ডার” পেজে দেখতে পারবেন।';
      if(note) note.querySelector('p').textContent='ডেলিভারির সময় যে টাকা দেখানো হবে, সেটি নগদ পরিশোধ করুন। দরকার হলে আমাদের টিম ফোন করবে।';
    }
    const memoBtnWrap=document.getElementById('successMemoBtnWrap');
    if(memoBtnWrap){
      memoBtnWrap.innerHTML = data.customBazarMemoKey
        ? `<button class="btn btn-outline btn-block" onclick="BazarMemo.openById('${esc(data.customBazarMemoKey)}')">🧾 মেমো দেখুন / প্রিন্ট করুন</button>`
        : '';
    }
    const copy=document.getElementById('successCopyBtn');
    if(copy) copy.disabled=!data.orderNumber;
  },
  async copyOrderNumber(){
    const no=this.get().orderNumber;
    if(!no) return;
    try{ await navigator.clipboard.writeText(no); toast('✓ অর্ডার নম্বর কপি হয়েছে','success'); }
    catch(e){
      const ta=document.createElement('textarea'); ta.value=no; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); toast('✓ অর্ডার নম্বর কপি হয়েছে','success'); }catch(err){ toast('কপি করা যায়নি','error'); }
      ta.remove();
    }
  }
};

/* ---------- Custom Bazar ---------- */

/* ---------- Order Chat ---------- */
const OrderChat = {
  orderId:null, unsub:null, role:'customer',
  open(orderId, role='customer'){
    this.orderId = orderId; this.role = role;
    document.getElementById('chatOrderModal').classList.add('show');
    document.getElementById('chatOrderBody').innerHTML = '<p style="color:var(--ink-muted);text-align:center;padding:16px">লোড হচ্ছে...</p>';
    if(!FB) return;
    if(this.unsub) this.unsub();
    this.unsub = FB.onSnapshot(FB.query(FB.collection(FB.db,'orders',orderId,'messages'), FB.orderBy('at','asc')), snap=>{
      const body = document.getElementById('chatOrderBody');
      const msgs=[]; snap.forEach(d=>msgs.push(d.data()));
      body.innerHTML = msgs.length ? msgs.map(m=>`<div class="cw-msg ${m.from===this.role?'cw-user':'cw-bot'}">${esc(m.text)}</div>`).join('')
        : '<p style="color:var(--ink-muted);text-align:center;padding:16px">এখনো কোনো মেসেজ নেই — এখান থেকে ড্রাইভারকে মেসেজ পাঠান</p>';
      body.scrollTop = body.scrollHeight;
    });
  },
  close(){ document.getElementById('chatOrderModal').classList.remove('show'); if(this.unsub){ this.unsub(); this.unsub=null; } },
  async send(){
    const input = document.getElementById('chatOrderInput');
    const text = input?.value.trim(); if(!text || !this.orderId || !FB) return;
    // ⚠️ MT Studio audit fix: firestore.rules-এ এই subcollection-এ লেখার অনুমতি
    // request.resource.data.senderId == request.auth.uid শর্তে দেওয়া — কিন্তু
    // আগে শুধু 'from' (role string) পাঠানো হতো, কখনো 'senderId' না। ফলে এই
    // চ্যাট ফিচার একবারও কাজ করেনি (সবসময় permission-denied, নিঃশব্দে toast-এ ধরা পড়তো)।
    const senderId = Auth?.currentUser?.uid || null;
    if(!senderId){ toast('মেসেজ পাঠাতে লগইন প্রয়োজন','error'); return; }
    if(input) input.value='';
    try{ await FB.addDoc(FB.collection(FB.db,'orders',this.orderId,'messages'), {senderId, from:this.role, text, at:FB.serverTimestamp()}); }
    catch(e){ toast('মেসেজ পাঠানো যায়নি','error'); }
  }
};

/* ---------- Order tracking ---------- */
const TRACK_STAGES = [
  {key:'confirmed', label:'অর্ডার নিশ্চিত হয়েছে'},
  {key:'packed', label:'প্যাকিং সম্পন্ন'},
  {key:'picked_up', label:'ড্রাইভার পণ্য নিয়েছে'},
  {key:'in_transit', label:'ড্রাইভার আপনার পথে (লাইভ)'},
  {key:'delivered', label:'ডেলিভারি সম্পন্ন'}
];
function orderTrackHTML(o){
  const order = ['pending','confirmed','packed','assigned','picked_up','in_transit','delivered'];
  const curIdx = order.indexOf(o.status);
  const rows = TRACK_STAGES.map(st=>{
    const stIdx = order.indexOf(st.key);
    const done = curIdx >= stIdx && curIdx>-1;
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
      <span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;background:${done?'#22c55e':'var(--line)'};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff">${done?'✓':''}</span>
      <span style="font-size:12.5px;color:${done?'var(--ink)':'var(--ink-dim)'}">${st.label}</span>
    </div>`;
  }).join('');
  const etaBox = (o.status==='in_transit' && o.etaMinutes)
    ? `<div style="text-align:center;background:rgba(240,53,107,.06);border:1px solid var(--gold-line);border-radius:10px;padding:8px;margin-top:6px;font-size:12.5px;color:var(--ink)">⏱️ আনুমানিক পৌঁছাবে <strong style="color:var(--rose)">${o.etaMinutes} মিনিটে</strong></div>`
    : '';
  const liveBtn = (o.status==='in_transit' && o.driverLat && o.driverLng)
    ? `<div class="live-map-box" id="liveMapBox-${o.id}"><span class="live-map-badge"><span class="dot"></span> লাইভ ট্র্যাকিং</span></div>
       <a href="https://www.google.com/maps?q=${o.driverLat},${o.driverLng}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:6px;font-size:11.5px;color:var(--ink-muted)">লাইভ লোকেশন দেখুন ↗</a>${etaBox}`
    : '';
  const memoBtn = (o.orderType==='custom-bazar')
    ? (()=>{ const k=BazarMemo.register(o); return `<button class="btn btn-outline btn-block" style="margin-top:8px;font-size:12.5px" onclick="BazarMemo.openById('${esc(k)}')">🧾 মেমো দেখুন / প্রিন্ট করুন</button>`; })() : '';
  const billBox = (o.orderType==='custom-bazar' && (o.billPhotos?.length || o.bazarItems?.length))
    ? `<div style="margin-top:10px">
        ${o.bazarItems?.length ? `<div style="background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">
          ${o.bazarItems.map(it=>`<div class="row-between" style="font-size:12px"><span>${esc(it.text)}</span><span>${money(it.price)}</span></div>`).join('')}
          <div class="row-between" style="font-weight:700;color:var(--ink);border-top:1px solid var(--line);margin-top:6px;padding-top:6px"><span>মোট বিল</span><span style="color:var(--gold)">${money(o.billAmount||0)}</span></div>
        </div>` : ''}
        ${(o.billPhotos||[]).map(url=>`<img src="${url}" style="width:100%;border-radius:10px;border:1px solid var(--line);margin-bottom:6px">`).join('')}
        <div style="font-size:11.5px;color:var(--ink-muted)">ড্রাইভার ডেলিভারির সময় আসল দোকানের মেমো/রশিদও সাথে নিয়ে আসবে — টাকা রেডি রাখুন।</div>
      </div>` : '';
  const chatBtn = `<button class="btn btn-outline btn-block" style="margin-top:8px;font-size:12.5px" onclick="OrderChat.open('${o.id}','customer')">💬 ড্রাইভারের সাথে চ্যাট করুন</button>`;
  const isCancellable = ['pending','confirmed','packed','assigned'].includes(o.status);
  const cancelBtn = isCancellable ? `<button class="btn btn-outline btn-block" style="margin-top:6px;font-size:12px;color:#f87171;border-color:rgba(239,68,68,.2)" onclick="CancelOrder.open('${o.id}')">❌ অর্ডার বাতিল করুন</button>` : '';
  const refundBtn = (o.status==='delivered' && !o.refundRequested) ? `<button class="btn btn-outline btn-block" style="margin-top:6px;font-size:12px;color:#fbbf24;border-color:rgba(251,191,36,.2)" onclick="RefundRequest.open('${o.id}')">↩️ রিটার্ন/রিফান্ড রিকোয়েস্ট</button>` : '';
  return `<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">${rows}${liveBtn}${memoBtn}${billBox}${chatBtn}${cancelBtn}${refundBtn}</div>`;
}

/* ---------- Reorder (regular products) ---------- */
async function reorderFromPastOrder(orderId){
  const order = MyOrders.cache.find(o=>o.id===orderId);
  if(!order || !order.items || !order.items.length){ toast('এই অর্ডারে কোনো প্রোডাক্ট তথ্য নেই','error'); return; }
  let added = 0, skipped = 0;
  order.items.forEach(item=>{
    const p = ALL_PRODUCTS.find(x=>x.id===item.productId);
    if(p && p.stock > 0){ Cart.items[item.productId] = (Cart.items[item.productId]||0) + item.qty; added++; }
    else skipped++;
  });
  Cart.save();
  if(added>0){
    toast(skipped>0 ? `✓ ${added}টি প্রোডাক্ট কার্ট যোগ হয়েছে (${skipped}টি এখন অনুপলব্ধ)` : `✓ ${added}টি প্রোডাক্ট কার্টে যোগ হয়েছে`, 'success');
    Cart.open();
  } else {
    toast('দুঃখিত, এই অর্ডারের কোনো প্রোডাক্টই এখন স্টকে নেই','error');
  }
}

/* ---------- Saved Lists (কার্ট টেমপ্লেট সেভ করা) ---------- */
const SavedLists = {
  cache: [],
  async saveCurrentCart(){
    if(!Auth.currentUser){ toast('লিস্ট সেভ করতে লগইন করুন','error'); AuthUI.open(); return; }
    const entries = Object.entries(Cart.items);
    if(!entries.length){ toast('কার্ট খালি আছে','error'); return; }
    const name = prompt('এই লিস্টের একটা নাম দিন (যেমন: সাপ্তাহিক বাজার):', 'আমার লিস্ট '+new Date().toLocaleDateString('bn-BD'));
    if(!name) return;
    if(!FB){ toast('সংযোগ সমস্যা','error'); return; }
    try{
      await FB.addDoc(FB.collection(FB.db,'saved_lists'), {
        userId: Auth.currentUser.uid, name: name.trim(),
        items: entries.map(([id,qty])=>({productId:id,qty})),
        createdAt: FB.serverTimestamp()
      });
      toast('✓ লিস্ট সেভ হয়েছে — "আমার অর্ডার" পেজের সেভড ট্যাবে পাবেন','success');
    }catch(e){ toast('সমস্যা: '+e.message,'error'); }
  },
  async render(){
    const box = document.getElementById('savedListsBox');
    if(!box) return;
    if(!Auth.currentUser){ box.innerHTML = `<div class="empty-state"><div class="em">🔒</div><h3>লগইন করুন</h3><button class="btn btn-gold" onclick="AuthUI.open()">লগইন করুন</button></div>`; return; }
    if(!FB){ box.innerHTML = `<p style="color:var(--ink-muted)">সংযোগ সমস্যা</p>`; return; }
    box.innerHTML = `<p style="color:var(--ink-muted);padding:16px">লোড হচ্ছে...</p>`;
    try{
      const snap = await FB.getDocs(FB.query(FB.collection(FB.db,'saved_lists'), FB.where('userId','==',Auth.currentUser.uid)));
      const list=[]; snap.forEach(d=>list.push({id:d.id,...d.data()}));
      list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      this.cache = list;
      if(!list.length){ box.innerHTML = `<div class="empty-state"><div class="em">📑</div><h3>কোনো সেভড লিস্ট নেই</h3><p>কার্ট থেকে "লিস্ট সেভ করুন" চেপে বানাতে পারবেন</p></div>`; return; }
      box.innerHTML = list.map(l=>{
        const availableCount = l.items.filter(it=>{ const p=ALL_PRODUCTS.find(x=>x.id===it.productId); return p && p.stock>0; }).length;
        return `<div class="card-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong style="color:var(--ink)">${esc(l.name)}</strong>
            <a href="#" onclick="event.preventDefault();SavedLists.deleteList('${l.id}')" style="color:#f87171;font-size:11.5px">মুছুন</a>
          </div>
          <div style="font-size:12px;color:var(--ink-muted);margin-bottom:10px">${l.items.length}টি প্রোডাক্ট — ${availableCount}টি এখন পাওয়া যাচ্ছে</div>
          <button class="btn btn-gold btn-block" style="font-size:12.5px" onclick="SavedLists.addToCart('${l.id}')">🛒 কার্টে রাখুন</button>
        </div>`;
      }).join('');
    }catch(e){ devWarn('saved lists load failed', e.message); box.innerHTML = `<p style="color:var(--ink-muted)">লোড করা যায়নি</p>`; }
  },
  addToCart(id){
    const l = this.cache.find(x=>x.id===id); if(!l) return;
    let added=0, skipped=0;
    l.items.forEach(item=>{
      const p = ALL_PRODUCTS.find(x=>x.id===item.productId);
      if(p && p.stock>0){ Cart.items[item.productId]=(Cart.items[item.productId]||0)+item.qty; added++; }
      else skipped++;
    });
    Cart.save();
    toast(skipped>0 ? `✓ ${added}টি যোগ হয়েছে (${skipped}টি অনুপলব্ধ)` : `✓ ${added}টি প্রোডাক্ট কার্টে যোগ হয়েছে`,'success');
    Cart.open();
  },
  async deleteList(id){
    if(!confirm('এই সেভড লিস্টটা মুছে ফেলবেন?') || !FB) return;
    try{ await FB.deleteDoc(FB.doc(FB.db,'saved_lists',id)); this.render(); toast('✓ মুছে ফেলা হয়েছে','success'); }
    catch(e){ toast('সমস্যা: '+e.message,'error'); }
  }
};

/* ---------- My Orders ---------- */
const MyOrders = {
  cache: [], tab: 'active',
  switchTab(tab){
    this.tab = ['active','past','saved'].includes(tab) ? tab : 'active';
    const tabs = {active:'ordersTabActive',past:'ordersTabPast',saved:'ordersTabSaved'};
    Object.entries(tabs).forEach(([key,id])=>{
      const el=document.getElementById(id);
      if(!el) return;
      const selected=this.tab===key;
      el.classList.toggle('active',selected);
      el.setAttribute('aria-selected',String(selected));
    });
    const listEl=document.getElementById('myOrdersList');
    const savedBox=document.getElementById('savedListsBox');
    if(this.tab==='saved'){
      if(listEl) listEl.hidden=true;
      if(savedBox) savedBox.hidden=false;
      SavedLists.render();
    }else{
      if(listEl) listEl.hidden=false;
      if(savedBox) savedBox.hidden=true;
      this.renderList();
    }
  },
  async render(){
    const list=document.getElementById('myOrdersList');
    if(!list) return;
    list.innerHTML='<div class="orders-loading"><span class="spinner"></span><p>অর্ডার লোড হচ্ছে…</p></div>';
    const user=Auth.currentUser;
    if(!user){
      this.cache=[]; this.updateCounts();
      list.innerHTML='<div class="empty-state orders-empty"><div class="em">🔒</div><h3>অর্ডার দেখতে লগইন করুন</h3><p>আপনার অ্যাকাউন্টে লগইন করলে চলমান ও আগের অর্ডার এক জায়গায় পাবেন।</p><button class="btn btn-gold" type="button" onclick="AuthUI.open()">লগইন করুন</button></div>';
      return;
    }
    if(!FB){ list.innerHTML='<div class="orders-error"><strong>সংযোগ পাওয়া যাচ্ছে না</strong><p>ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।</p><button class="btn btn-outline" type="button" onclick="MyOrders.render()">আবার চেষ্টা করুন</button></div>'; return; }
    try{
      const snap=await FB.getDocs(FB.query(FB.collection(FB.db,'orders'),FB.where('userId','==',user.uid)));
      const orders=[]; snap.forEach(d=>orders.push({id:d.id,...d.data()}));
      orders.sort((a,b)=>this.createdMs(b)-this.createdMs(a));
      this.cache=orders;
      this.updateCounts();
      this.switchTab(this.tab);
    }catch(e){
      list.innerHTML='<div class="orders-error"><strong>অর্ডার লোড করা যায়নি</strong><p>কিছুক্ষণ পর আবার চেষ্টা করুন।</p><button class="btn btn-outline" type="button" onclick="MyOrders.render()">আবার চেষ্টা করুন</button></div>';
      devWarn('orders load failed',e.message);
    }
  },
  createdMs(order){
    const value=order?.createdAt;
    if(value?.toMillis) return value.toMillis();
    if(value?.seconds) return value.seconds*1000;
    const parsed=Date.parse(value||'');
    return Number.isFinite(parsed)?parsed:0;
  },
  updateCounts(){
    const isPast=o=>o.status==='delivered'||o.status==='cancelled';
    const active=this.cache.filter(o=>!isPast(o)).length;
    const past=this.cache.filter(isPast).length;
    const a=document.getElementById('activeOrdersCount');
    const p=document.getElementById('pastOrdersCount');
    if(a) a.textContent=String(active);
    if(p) p.textContent=String(past);
  },
  formatDate(order){
    const ms=this.createdMs(order);
    return ms?new Intl.DateTimeFormat('bn-BD',{day:'numeric',month:'short',year:'numeric'}).format(new Date(ms)):'তারিখ পাওয়া যায়নি';
  },
  amount(order){
    const value=Number(order.total ?? order.subtotal ?? 0);
    return Number.isFinite(value)?value:0;
  },
  itemSummary(order){
    if(order.orderType==='custom-bazar') return 'নিজস্ব বাজারের লিস্ট';
    const items=Array.isArray(order.items)?order.items:[];
    const qty=items.reduce((sum,item)=>sum+(Number(item.qty)||0),0);
    return qty?`${qty}টি পণ্য`:'পণ্যের তথ্য নেই';
  },
  renderList(){
    const list=document.getElementById('myOrdersList');
    if(!list) return;
    const isPast=o=>o.status==='delivered'||o.status==='cancelled';
    const orders=this.cache.filter(o=>this.tab==='active'?!isPast(o):isPast(o));
    if(!orders.length){
      list.innerHTML=this.tab==='active'
        ? '<div class="empty-state orders-empty"><div class="em">📦</div><h3>কোনো চলমান অর্ডার নেই</h3><p>নতুন অর্ডার করলে এর অগ্রগতি এখানে দেখা যাবে।</p><button class="btn btn-gold" type="button" onclick="Router.go(\'listing\',{cat:\'all\'})">শপিং শুরু করুন</button></div>'
        : '<div class="empty-state orders-empty"><div class="em">🗂️</div><h3>আগের কোনো অর্ডার নেই</h3><p>ডেলিভারি সম্পন্ন বা বাতিল হওয়া অর্ডার এখানে সংরক্ষিত থাকবে।</p></div>';
      return;
    }
    list.innerHTML=orders.map(o=>{
      const s=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
      const safeId=String(o.id||'').replace(/[^a-zA-Z0-9_-]/g,'');
      const safeNumber=String(o.orderNumber||o.id||'অর্ডার').replace(/[<>&"']/g,'');
      const editData=JSON.stringify({village:o.village||'',address:o.address||'',instructions:o.instructions||''}).replace(/'/g,'&#39;');
      const editBtn=(this.tab==='active'&&OrderEdit.isEditable(o.status))?`<button class="btn btn-outline order-action" type="button" onclick='OrderEdit.open("${safeId}",${editData})'>ঠিকানা/নির্দেশনা সম্পাদনা</button>`:'';
      const reorderBtn=(this.tab==='past'&&o.orderType!=='custom-bazar'&&o.items?.length)?`<button class="btn btn-gold order-action" type="button" onclick="reorderFromPastOrder('${safeId}')">আবার অর্ডার করুন</button>`:'';
      const paymentLabel=o.paymentStatus==='paid'?'পরিশোধিত':(o.paymentMethod==='cod'||!o.paymentStatus?'ক্যাশ অন ডেলিভারি':'পেমেন্ট অপেক্ষমাণ');
      return `<article class="order-card">
        <header class="order-card-head"><div><span class="order-date">${this.formatDate(o)}</span><h2>${safeNumber}</h2></div><span class="status-pill ${s.cls}">${s.label}</span></header>
        <div class="order-meta-grid"><div><span>অর্ডার</span><strong>${this.itemSummary(o)}</strong></div><div><span>মোট</span><strong>${money(this.amount(o))}</strong></div><div><span>পেমেন্ট</span><strong>${paymentLabel}</strong></div><div><span>ডেলিভারি এলাকা</span><strong>${esc(o.zoneName||o.zone||o.village||'ঠিকানা')}</strong></div></div>
        ${(editBtn||reorderBtn)?`<div class="order-actions">${editBtn}${reorderBtn}</div>`:''}
        ${this.tab==='active'?orderTrackHTML(o):''}
      </article>`;
    }).join('');
    if(this.tab==='active'&&window.LiveMap){
      LiveMap.destroyAll();
      orders.forEach(o=>{if(o.status==='in_transit'&&o.driverLat&&o.driverLng) LiveMap.init(o.id,'liveMapBox-'+o.id,o.driverLat,o.driverLng);});
    }
  }
};
window.Home=Home;window.Medical=Medical;window.Listing=Listing;window.SiteReview=SiteReview;window.PDP=PDP;window.Cart=Cart;window.OrderSuccess=OrderSuccess;window.OrderChat=OrderChat;window.SavedLists=SavedLists;window.MyOrders=MyOrders;

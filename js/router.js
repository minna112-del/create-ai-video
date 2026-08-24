/* router.js — Owner Auth (Firebase Auth secured) + page router */

const OwnerAuth = {
  currentUid: null,
  _verifiedThisSession: false,

  isUnlocked() {
    return !!this.currentUid ||
      (
        typeof FB !== 'undefined' &&
        FB &&
        FB.auth &&
        FB.auth.currentUser &&
        this._verifiedThisSession
      );
  },

  requestAccess() {
    document.getElementById('ownerEmail').value = '';
    document.getElementById('ownerPassword').value = '';
    document.getElementById('ownerGateMsg').className = 'form-msg';
    document.getElementById('ownerGateModal').classList.add('show');
  },

  cancel() {
    document.getElementById('ownerGateModal').classList.remove('show');
  },

  async unlock() {
    const email = document
      .getElementById('ownerEmail')
      .value
      .trim();

    const pass = document
      .getElementById('ownerPassword')
      .value;

    const msgEl = document.getElementById('ownerGateMsg');

    if (!email || !pass) {
      msgEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন';
      msgEl.className = 'form-msg err';
      return;
    }

    if (typeof FB === 'undefined' || !FB) {
      msgEl.textContent = 'সংযোগ সমস্যা';
      msgEl.className = 'form-msg err';
      return;
    }

    try {
      const cred = await FB.signInWithEmailAndPassword(
        FB.auth,
        email,
        pass
      );

      const staffSnap = await FB.getDoc(
        FB.doc(
          FB.db,
          'staff',
          cred.user.uid
        )
      );

      if (
        !staffSnap.exists() ||
        staffSnap.data().role !== 'admin'
      ) {
        await FB.signOut(FB.auth).catch(() => {});

        msgEl.textContent =
          'এই অ্যাকাউন্ট অ্যাডমিন হিসেবে অনুমোদিত নয়';

        msgEl.className = 'form-msg err';
        return;
      }

      this.currentUid = cred.user.uid;
      this._verifiedThisSession = true;

      if (typeof StaffChat !== 'undefined') {
        StaffChat.init(cred.user.uid, staffSnap.data().name || 'Owner', 'admin');
      }

      document
        .getElementById('ownerGateModal')
        .classList
        .remove('show');

      Router.go('admin-dash');
    } catch (e) {
      msgEl.textContent =
        'লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড সঠিক নয়';

      msgEl.className = 'form-msg err';
    }
  },

  async _restoreSession() {
    if (
      this.currentUid ||
      typeof FB === 'undefined' ||
      !FB ||
      !FB.auth.currentUser
    ) {
      return false;
    }

    try {
      const staffSnap = await FB.getDoc(
        FB.doc(
          FB.db,
          'staff',
          FB.auth.currentUser.uid
        )
      );

      if (
        staffSnap.exists() &&
        staffSnap.data().role === 'admin'
      ) {
        this.currentUid = FB.auth.currentUser.uid;
        this._verifiedThisSession = true;
        if (typeof StaffChat !== 'undefined') {
          StaffChat.init(this.currentUid, staffSnap.data().name || 'Owner', 'admin');
        }
        return true;
      }
    } catch (e) {
      if (typeof devWarn === 'function') {
        devWarn(
          'owner session restore failed',
          e.message
        );
      }
    }

    return false;
  },

  async lock() {
    if (
      typeof FB !== 'undefined' &&
      FB
    ) {
      await FB.signOut(FB.auth).catch(() => {});
    }

    this.currentUid = null;
    this._verifiedThisSession = false;
    if (window.StaffAccess) window.StaffAccess.clear();

    toast('🔒 লক করা হয়েছে');
    Router.go('home');
  }
};

/* Shared role/permission gate for staff offices that do not provide their own
   embedded login screen. This is a navigation guard; Firestore Security Rules
   remain the authoritative backend enforcement layer. */
const StaffAccess = {
  pendingPage:'company-os',staff:null,permissions:null,
  legacyRoleAliases:{hr:['people_officer'],procurement:['procurement_officer'],customer_care_manager:['support_manager']},
  v3WorkspaceIds:['hr-erp','warehouse-erp','marketing-erp','workflow-erp','bi-erp','asset-erp','crm-erp','procurement-erp','facilities-erp'],
  t(bn,en){return window.I18n?I18n.t(bn,en):bn;},
  async waitForFirebase(){
    if(window.__fb){window.FB=window.__fb;if(typeof FB!=='undefined'&&!FB)FB=window.__fb;return window.__fb;}
    await new Promise(resolve=>{
      const done=()=>{clearTimeout(timer);window.removeEventListener('firebase-ready',done);resolve();};
      const timer=setTimeout(done,12000);
      window.addEventListener('firebase-ready',done,{once:true});
    });
    if(window.__fb){window.FB=window.__fb;if(typeof FB!=='undefined'&&!FB)FB=window.__fb;}
    return window.__fb||null;
  },
  active(staff){return !!staff&&staff.active!==false&&!['inactive','suspended','resigned'].includes(staff.status);},
  permissionList(role){
    const matrix=this.permissions?.matrix||this.permissions?.rolePermissions||this.permissions||{};
    if(Array.isArray(matrix[role]))return matrix[role];
    for(const alias of this.legacyRoleAliases[role]||[]){if(Array.isArray(matrix[alias]))return matrix[alias];}
    return null;
  },
  usesMatrix(){
    if(Number(this.permissions?.schemaVersion)>=2)return true;
    const ids=new Set(AppRegistry.staffPages()),matrix=this.permissions?.matrix||this.permissions?.rolePermissions||this.permissions||{};
    return Object.values(matrix).some(list=>Array.isArray(list)&&list.some(id=>id==='*'||ids.has(id)));
  },
  canOpen(page,staff=this.staff){
    const meta=AppRegistry.staffMeta(page);
    if(!meta||!this.active(staff))return false;
    const role=staff.role||'staff',custom=staff.allowedWorkspaces||staff.permissions?.workspaces||[];
    if(role==='admin'||meta.roles.includes('*')||custom.includes(page)||custom.includes(meta.name))return true;
    const list=this.permissionList(role);
    if(this.usesMatrix()&&Array.isArray(list)){
      if(list.includes('*')||list.includes(page))return true;
      if(Number(this.permissions?.schemaVersion||0)<3&&this.v3WorkspaceIds.includes(page))return meta.roles.includes(role);
      return false;
    }
    return meta.roles.includes(role);
  },
  request(page){
    this.pendingPage=page||'company-os';
    const meta=AppRegistry.staffMeta(this.pendingPage),modal=document.getElementById('ownerGateModal');
    const title=document.getElementById('ownerGateTitle'),text=document.getElementById('ownerGateText'),button=document.getElementById('ownerGateSubmit');
    if(title)title.textContent=meta?.name||'Staff Workspace';
    if(text)text.textContent=this.t('অনুমোদিত staff email ও password দিয়ে প্রবেশ করুন','Sign in with an authorized staff email and password');
    if(button)button.textContent=this.t('Workspace খুলুন','Open workspace');
    const email=document.getElementById('ownerEmail'),password=document.getElementById('ownerPassword'),message=document.getElementById('ownerGateMsg');
    if(email)email.value='';if(password)password.value='';if(message){message.textContent='';message.className='form-msg';}
    modal?.classList.add('show');setTimeout(()=>email?.focus(),20);
  },
  cancel(){document.getElementById('ownerGateModal')?.classList.remove('show');},
  async load(user){
    const fb=await this.waitForFirebase();if(!fb||!user)return false;
    const [staffSnap,permissionSnap]=await Promise.all([
      fb.getDoc(fb.doc(fb.db,'staff',user.uid)),
      fb.getDoc(fb.doc(fb.db,'company_settings','permissions')).catch(()=>null)
    ]);
    if(!staffSnap.exists())throw new Error(this.t('Staff profile পাওয়া যায়নি','Staff profile was not found'));
    this.staff={uid:user.uid,...staffSnap.data()};
    this.permissions=permissionSnap?.exists()?permissionSnap.data():null;
    if(!this.active(this.staff))throw new Error(this.t('এই staff account বর্তমানে সক্রিয় নয়','This staff account is not active'));
    OwnerAuth.currentUid=user.uid;OwnerAuth._verifiedThisSession=true;
    return true;
  },
  async authorize(page){
    const fb=await this.waitForFirebase();
    if(!fb){toast(this.t('Firebase সংযোগ পাওয়া যায়নি','Firebase is unavailable'),'error');return false;}
    const user=fb.auth.currentUser;
    if(!user){this.request(page);return false;}
    try{
      if(!this.staff||this.staff.uid!==user.uid)await this.load(user);
      if(!this.canOpen(page)){
        this.request(page);
        const message=document.getElementById('ownerGateMsg');
        if(message){message.textContent=this.t('বর্তমান account-এর এই Workspace ব্যবহারের অনুমতি নেই','The current account does not have access to this workspace');message.className='form-msg err';}
        return false;
      }
      return true;
    }catch(error){
      this.request(page);
      const message=document.getElementById('ownerGateMsg');
      if(message){message.textContent=error.message;message.className='form-msg err';}
      return false;
    }
  },
  async unlock(){
    const email=document.getElementById('ownerEmail')?.value.trim(),password=document.getElementById('ownerPassword')?.value,message=document.getElementById('ownerGateMsg');
    if(!email||!password){if(message){message.textContent=this.t('ইমেইল ও পাসওয়ার্ড দিন','Enter your email and password');message.className='form-msg err';}return;}
    const fb=await this.waitForFirebase();
    if(!fb){if(message){message.textContent=this.t('Firebase সংযোগ পাওয়া যায়নি','Firebase is unavailable');message.className='form-msg err';}return;}
    try{
      const credential=await fb.signInWithEmailAndPassword(fb.auth,email,password);
      await this.load(credential.user);
      if(!this.canOpen(this.pendingPage))throw new Error(this.t('এই Workspace ব্যবহারের অনুমতি নেই','You do not have access to this workspace'));
      this.cancel();
      if(typeof StaffChat!=='undefined')StaffChat.init(credential.user.uid,this.staff.name||'Staff',this.staff.role||'staff');
      Router.go(this.pendingPage);
    }catch(error){if(message){message.textContent=error.message||'লগইন ব্যর্থ';message.className='form-msg err';}}
  },
  clear(){this.staff=null;this.permissions=null;this.pendingPage='company-os';}
};
window.StaffAccess=StaffAccess;

const Router = {
  current: 'home',
  params: {},
  staffPaths: AppRegistry.staffPaths(),

  /*
   * প্রতিটি public page-এর জন্য shareable URL,
   * title এবং meta description।
   *
   * Checkout, account, myorders ও order-success-এর মতো
   * private page ইচ্ছাকৃতভাবে বাদ রাখা হয়েছে।
   */
  seoMeta: {
    home: {
      path: '/',

      title:
        'Golapi Shop Online — নোয়াখালিতের অনলাইন শপ',

      desc:
        'নোয়াখালিতে মুদি, ঔষধ, গ্যাস ও দৈনন্দিন প্রয়োজনীয় পণ্য অর্ডার করুন অথবা নিজের বাজারের লিস্ট পাঠান। স্থানীয় ডেলিভারি ও সহজ পেমেন্ট।'
    },

    listing: {
      path: p => `/category/${p.cat || 'all'}`,

      title: p => {
        const category = CATEGORIES.find(
          c => c.id === p.cat
        );

        return `${
          category?.label || 'সব প্রোডাক্ট'
        } — Golapi Shop Online`;
      },

      desc: p => {
        const category = CATEGORIES.find(
          c => c.id === p.cat
        );

        return `${
          category?.label || 'সব প্রোডাক্ট'
        } কিনুন Golapi Shop Online থেকে — নোয়াখালিতে হোম ডেলিভারি।`;
      }
    },

    product: {
      path: p => `/product/${p.id}`,

      title: p => {
        const product = ALL_PRODUCTS.find(
          item => item.id === p.id
        );

        return product
          ? `${product.name} — ৳${product.salePrice} | Golapi Shop Online`
          : 'প্রোডাক্ট — Golapi Shop Online';
      },

      desc: p => {
        const product = ALL_PRODUCTS.find(
          item => item.id === p.id
        );

        return product
          ? (
              product.description ||
              `${product.name} — Golapi Shop Online থেকে হোম ডেলিভারিতে কিনুন।`
            )
          : '';
      }
    },

    medical: {
      path: '/medical',

      title:
        'স্বাস্থ্য সেবা — Golapi Shop Online',

      desc:
        'বিশেষজ্ঞ চিকিৎসকদের তথ্য, সময়সূচি এবং সিরিয়াল নেওয়ার সহায়তা দেখুন—নোয়াখালিতে।'
    },

    'custom-bazar': {
      path: '/custom-bazar',

      title:
        'কাস্টম বাজার — Golapi Shop Online',

      desc:
        'নিজের বাজারের লিস্ট পাঠান। আমাদের স্থানীয় টিম বাজার প্রস্তুত করে আপনার ঠিকানায় ডেলিভারির ব্যবস্থা করবে।'
    },

    contact: {
      path: '/contact',

      title:
        'যোগাযোগ — Golapi Shop Online',

      desc:
        'Golapi Shop Online-এর হটলাইন, শাখা ম্যানেজারের ফোন নম্বর এবং ইমেইল দেখুন।'
    },

    'about-app': {
      path: '/about',

      title:
        'আমাদের গল্প — Golapi Shop Online',

      desc:
        'Golapi Shop Online কীভাবে শুরু হলো এবং আমাদের স্থানীয় টিমের সঙ্গে পরিচিত হন।'
    },

    terms: {
      path: '/terms',

      title:
        'শর্তাবলী — Golapi Shop Online',

      desc:
        'Golapi Shop Online ব্যবহারের শর্তাবলী দেখুন।'
    },

    'privacy-info': {
      path: '/privacy',

      title:
        'প্রাইভেসি পলিসি — Golapi Shop Online',

      desc:
        'Golapi Shop Online-এর গোপনীয়তা নীতি দেখুন।'
    }
  },

  updateSeoTags(page, params, skipHistory) {
    const meta = this.seoMeta[page];

    const path = meta
      ? (typeof meta.path === 'function' ? meta.path(params) : meta.path)
      : this.staffPaths[page];

    const title =
      typeof meta?.title === 'function'
        ? meta.title(params)
        : meta?.title;

    const desc =
      typeof meta?.desc === 'function'
        ? meta.desc(params)
        : meta?.desc;

    if (title) {
      document.title = title;
    }

    if (desc) {
      const descriptionMeta = document.querySelector(
        'meta[name="description"]'
      );

      if (descriptionMeta) {
        descriptionMeta.setAttribute(
          'content',
          desc
        );
      }

      const ogDescription = document.querySelector(
        'meta[property="og:description"]'
      );

      if (ogDescription) {
        ogDescription.setAttribute(
          'content',
          desc
        );
      }

      const twitterDescription = document.querySelector(
        'meta[name="twitter:description"]'
      );

      if (twitterDescription) {
        twitterDescription.setAttribute(
          'content',
          desc
        );
      }
    }

    if (title) {
      const ogTitle = document.querySelector(
        'meta[property="og:title"]'
      );

      if (ogTitle) {
        ogTitle.setAttribute(
          'content',
          title
        );
      }

      const twitterTitle = document.querySelector(
        'meta[name="twitter:title"]'
      );

      if (twitterTitle) {
        twitterTitle.setAttribute(
          'content',
          title
        );
      }
    }

    if (path) {
      const absoluteUrl =
        `${window.location.origin}${path}`;

      const canonical = document.querySelector(
        'link[rel="canonical"]'
      );

      if (canonical) {
        canonical.setAttribute(
          'href',
          absoluteUrl
        );
      }

      const ogUrl = document.querySelector(
        'meta[property="og:url"]'
      );

      if (ogUrl) {
        ogUrl.setAttribute(
          'content',
          absoluteUrl
        );
      }
    }

    if (
      !skipHistory &&
      path &&
      window.location.pathname !== path
    ) {
      history.pushState(
        {
          page,
          params
        },
        '',
        path
      );
    }
  },

  async go(page, params = {}, opts = {}) {
    const externalTarget = AppRegistry.external(page);
    if (externalTarget) {
      window.location.assign(externalTarget);
      return;
    }

    if(AppRegistry.isStaff(page)&&!AppRegistry.selfAuth(page)){
      const allowed=await StaffAccess.authorize(page);
      if(!allowed)return;
    }
    /* ⚠️ admin/driver/zone-manager/payment/sms/memo/livemap আগে সবার জন্যই
       প্রথম লোডে ডাউনলোড হতো। এখন শুধু সংশ্লিষ্ট পেজে গেলেই লোড হয়। */
    const scripts = AppRegistry.scripts(page);
    if (scripts.length) {
      try {
        await Promise.all(scripts.map(src => window.loadScriptOnce(src)));
      } catch (error) {
        if (typeof toast === 'function') {
          toast(I18n.t('এই Workspace চালু করা যায়নি। আবার চেষ্টা করুন।', 'This workspace could not be started. Please try again.'), 'error');
        }
        return;
      }
    }

    /*
     * Staff page হলে প্রয়োজনীয় HTML fragment
     * আগে lazy load করা হয়।
     */
    if (!document.getElementById('page-' + page) && window.PageLoader) {
      await PageLoader.ensurePage(page);
    }

    const routeTarget = document.getElementById('page-' + page);
    if (!routeTarget) {
      if (typeof toast === 'function') {
        toast('এই Workspace-এর প্রয়োজনীয় ফাইল পাওয়া যায়নি', 'error');
      }
      if (page !== 'home') {
        return this.go('home');
      }
      return;
    }

    this.current = page;
    this.params = params;

    this.updateSeoTags(
      page,
      params,
      !!opts.skipHistory
    );

    if (typeof dataLayer !== 'undefined') {
      dataLayer.push({
        event: 'page_view',
        page_title: page,
        page_path: '/#' + page
      });
    }

    document
      .querySelectorAll('.page')
      .forEach(pageElement => {
        pageElement.classList.remove('active');
      });

    const targetPage = routeTarget;

    if (targetPage) {
      targetPage.classList.add('active');
    }

    // Lazy fragment ও controller-generated content বর্তমান ভাষায় sync রাখে।
    if (window.I18n) I18n.apply(targetPage, false);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    const navMap = {
      home: 0,
      listing: 1,
      checkout: 2,
      myorders: 3,
      product: 1
    };

    document
      .querySelectorAll('#custMobNav a')
      .forEach((navItem, index) => {
        navItem.classList.toggle(
          'active',
          index === (navMap[page] ?? -1)
        );
      });

    AppRegistry.invoke(page, params);

    const staffPage = AppRegistry.isStaff(page);

    const chatBtn =
      document.getElementById('chatBtn');

    if (chatBtn) {
      chatBtn.style.display =
        staffPage ? 'none' : 'flex';
    }

    const chatWin =
      document.getElementById('chatWin');

    if (chatWin) {
      chatWin.classList.remove('show');
    }

    /* ⚠️ আগে এখানে getElementById দিয়ে সরাসরি custTopbar/custHeader/
       custMobNav/custFooter খুঁজে display:none/'' বসানো হতো — একবারই,
       ঠিক এই মুহূর্তে DOM-এ যা আছে তার ওপর। কিন্তু footer.html deferred/idle
       partial (page-loader.js) হিসেবে 'pages-ready'-এর *পরে* লোড হয়, আর
       অ্যাপের প্রথম Router.go() কল হয় ঠিক 'pages-ready' ইভেন্টেই (app.js)।
       ফলে কেউ সরাসরি deep-link/PWA shortcut/bookmark দিয়ে কোনো staff/
       Business OS route-এ (যেমন /admin, /executive, /company-os) প্রথম
       ওপেন করলে, ওই মুহূর্তে custFooter এখনো DOM-এ থাকতোই না — hide করার
       চেষ্টা silently no-op হয়ে যেত। কিছুক্ষণ পর footer.html লোড হয়ে
       কোনো inline style ছাড়াই default visible অবস্থায় বসে যেত — ফলে
       customer-facing footer (Facebook/WhatsApp/marketing CTA ইত্যাদি)
       Business OS/Executive Command Center পেজের নিচে দেখা যেত।
       body-level class + CSS selector ব্যবহার করলে এই race condition
       থাকে না — footer পরে লোড হলেও CSS সাথে সাথেই hide করে দেয়,
       কারণ CSS selector সবসময় live/reactive, কোনো এক-বারের JS timing-এর
       ওপর নির্ভর করে না। */
    document.body.classList.toggle('gs-staff-shell', staffPage);
  }
};


/* একটি registry থেকেই initial load, back/forward ও shareable staff URL resolve হয়। */
Router.resolvePath = function(path) {
  return AppRegistry.resolve(path);
};

Router.navigate = function(path) {
  const target = this.resolvePath(path);
  if (!target) return false;
  this.go(target.page, target.params, { skipHistory: true });
  return true;
};

window.Router=Router;
window.OwnerAuth=OwnerAuth;

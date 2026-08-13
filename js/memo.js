/* memo.js — Golapi Shop Online: স্টাইলিশ ব্র্যান্ডেড কাস্টম বাজার মেমো */
const BazarMemo = {
  typeLabels:{weekly:'সাপ্তাহিক মুদি বাজার',monthly:'মাসিক মুদি বাজার',wedding:'বিয়ের বাজার',ramadan:'রমজানের বাজার',qurbani:'কুরবানির বাজার',other:'অন্যান্য বাজার'},

  // ⚠️ আগে পুরো অর্ডার-অবজেক্ট (নাম/ঠিকানা/নোট সহ) JSON.stringify করে সরাসরি
  // onclick="..." HTML attribute-এ বসানো হতো — এটা fragile ও ঝুঁকিপূর্ণ প্যাটার্ন
  // (attribute-escaping ও embedded-JS-parsing দুই স্তরেই ভুল হওয়ার সুযোগ ছিল)।
  // এখন অর্ডার-অবজেক্ট এই registry-তে রেখে, শুধু ছোট্ট একটা ID দিয়ে reference
  // করা হয় — কোনো ইউজার-ডেটা কখনো HTML attribute-এ বসেই না।
  _registry:{},
  register(order){
    const key = order.id || order.orderNumber || String(Date.now());
    this._registry[key] = order;
    return key;
  },
  openById(key){
    const order = this._registry[key];
    if(!order){ toast('অর্ডার তথ্য পাওয়া যায়নি','error'); return; }
    this.open(order);
  },

  buildHTML(order){
    const items = (order.bazarList||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const priced = order.bazarItems && order.bazarItems.length ? order.bazarItems : null;
    const date = order.createdAt?.seconds
      ? new Date(order.createdAt.seconds*1000).toLocaleDateString('bn-BD',{year:'numeric',month:'long',day:'numeric'})
      : new Date().toLocaleDateString('bn-BD',{year:'numeric',month:'long',day:'numeric'});
    const typeLabel = order.bazarTypeLabel || this.typeLabels[order.bazarType] || 'বাজার অর্ডার';
    const orderNo = order.orderNumber || order.id || '—';

    const rows = priced
      ? priced.map((it,i)=>`<tr><td class="idx">${i+1}</td><td>${esc(it.text)}</td><td class="amt">৳${(it.price||0).toLocaleString('bn-BD')}</td></tr>`).join('')
      : items.map((it,i)=>`<tr><td class="idx">${i+1}</td><td colspan="2">${esc(it)}</td></tr>`).join('');

    const totalRow = priced
      ? `<tr class="total-row"><td colspan="2">মোট বিল</td><td class="amt">৳${(order.billAmount||0).toLocaleString('bn-BD')}</td></tr>`
      : '';

    return `<!DOCTYPE html>
<html lang="bn"><head><meta charset="UTF-8"><title>বাজার মেমো — ${orderNo}</title>
<style>
  @page{ margin:14mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Hind Siliguri',Arial,sans-serif;background:#f6f3ee;color:#1a1a1a;padding:24px}
  .memo{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);border:1px solid #ecdfc0}
  .head{background:linear-gradient(120deg,#1a1a1a,#2a2015);padding:22px 24px;text-align:center;position:relative}
  .head::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:6px;background:linear-gradient(90deg,#d4af37,#e91e63,#d4af37)}
  .head img{width:46px;height:46px;border-radius:12px;object-fit:cover;margin-bottom:8px}
  .head h1{color:#d4af37;font-size:19px;letter-spacing:.5px}
  .head p{color:#e8e0d0;font-size:11.5px;margin-top:2px}
  .meta{display:flex;justify-content:space-between;padding:16px 24px;border-bottom:1px dashed #d8cba0;font-size:12px;color:#555}
  .meta strong{color:#1a1a1a}
  .cust{padding:14px 24px;border-bottom:1px dashed #d8cba0;font-size:12.5px;line-height:1.8;color:#333}
  .cust b{color:#a8842f}
  .badge{display:inline-block;background:#fdf3d8;color:#a8842f;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  thead td{background:#faf7f0;font-weight:700;color:#a8842f;padding:8px 12px;font-size:11px}
  tbody td{padding:9px 12px;border-bottom:1px solid #f0ebd f0;vertical-align:top}
  tbody tr:nth-child(even){background:#fbfaf7}
  .idx{width:26px;color:#999}
  .amt{text-align:right;white-space:nowrap;font-weight:600;color:#1a1a1a}
  .total-row td{border-top:2px solid #1a1a1a;font-weight:800;font-size:13.5px;padding-top:12px}
  .notes{padding:14px 24px;font-size:12px;color:#666;border-top:1px dashed #d8cba0;line-height:1.7}
  .foot{background:#1a1a1a;color:#cbb98a;text-align:center;padding:16px;font-size:11px;line-height:1.8}
  .foot b{color:#d4af37}
  .printbar{max-width:520px;margin:14px auto 0;text-align:center}
  .printbar button{background:#d4af37;color:#1a1a1a;border:none;padding:11px 26px;border-radius:24px;font-weight:700;font-size:13px;cursor:pointer}
  @media print{ body{background:#fff;padding:0} .printbar{display:none} .memo{box-shadow:none;border:none} }
</style></head>
<body>
  <div class="memo">
    <div class="head">
      <img src="https://www.golapishop.online/icons/head_logo.webp" onerror="this.style.display='none'">
      <h1>🌹 Golapi Shop Online</h1>
      <p>নোয়াখালী সদর ও বেগমগঞ্জ — কাস্টম বাজার মেমো</p>
    </div>
    <div class="meta">
      <span>অর্ডার নং: <strong>${orderNo}</strong></span>
      <span>তারিখ: <strong>${date}</strong></span>
    </div>
    <div class="cust">
      <b>👤 ${esc(order.customerName)||'—'}</b> · ${esc(order.customerPhone)||''}<br>
      📍 ${order.village?esc(order.village)+', ':''}${esc(order.address)||''}<br>
      <span class="badge">${esc(typeLabel)}</span>
    </div>
    <table>
      <thead><tr><td>#</td><td>আইটেম</td>${priced?'<td class="amt">দাম</td>':''}</tr></thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>
    ${order.notes?`<div class="notes"><b>বিশেষ নির্দেশনা:</b> ${esc(order.notes)}</div>`:''}
    ${order.instructions?`<div class="notes"><b>ডেলিভারি নির্দেশনা:</b> ${esc(order.instructions)}</div>`:''}
    <div class="foot">
      অগ্রিম পরিশোধ: <b>৳${(order.advanceAmount||100).toLocaleString('bn-BD')}</b> (বিকাশ) · বাকি ক্যাশ অন ডেলিভারি<br>
      ধন্যবাদ, Golapi Shop Online-এ আস্থা রাখার জন্য 🌹
    </div>
  </div>
  <div class="printbar"><button onclick="window.print()">🖨️ প্রিন্ট করুন / PDF সেভ করুন</button></div>
</body></html>`;
  },

  open(order){
    const html = this.buildHTML(order);
    const win = window.open('', '_blank');
    if(!win){ toast('পপ-আপ ব্লক করা আছে — ব্রাউজার সেটিংসে পপ-আপ অনুমতি দিন','error'); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }
};
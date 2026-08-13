const BusinessIntelligence={
  orders:[],products:[],customers:[],branches:[],drivers:[],refunds:[],expenses:[],purchaseOrders:[],kpis:[],
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  bn(v){return typeof bn==='function'?bn(v):String(v);},
  money(v){return '৳'+Number(v||0).toLocaleString('bn-BD',{maximumFractionDigits:0});},
  uid(){return FB?.auth?.currentUser?.uid||'';},
  ts(v){if(!v)return null;return v.toDate?v.toDate():new Date(v);},
  total(o){return Number(o.total||o.grandTotal||o.totalAmount||o.amount||0);},
  async render(){if(typeof EmployeeWorkspace!=='undefined')EmployeeWorkspace.mountCurrent('biEmployeeWorkspace');await this.refresh();},
  async refresh(){
    try{
      const names=['orders','products','customer_profiles','branches','drivers','refund_requests','expense_requests','purchase_orders','business_kpis'];
      const snaps=await Promise.all(names.map(n=>FB.getDocs(FB.collection(FB.db,n)).catch(()=>null)));
      const arr=s=>{const a=[];s?.forEach(x=>a.push({id:x.id,...x.data()}));return a};
      [this.orders,this.products,this.customers,this.branches,this.drivers,this.refunds,this.expenses,this.purchaseOrders,this.kpis]=snaps.map(arr);
      this.calculate();this.renderAll();
      document.getElementById('biUpdated').textContent='Updated '+new Date().toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
    }catch(e){toast(e.message,'error')}
  },
  calculate(){
    const delivered=this.orders.filter(o=>o.status==='delivered'),revenue=delivered.reduce((n,o)=>n+this.total(o),0);
    const productCost=delivered.reduce((n,o)=>n+Number(o.costTotal||o.totalCost||this.total(o)*.72),0);
    const approvedExpense=this.expenses.filter(e=>['approved','paid','posted'].includes(e.status)).reduce((n,e)=>n+Number(e.amount||0),0);
    const grossProfit=revenue-productCost,grossMargin=revenue?grossProfit/revenue*100:0,aov=delivered.length?revenue/delivered.length:0;
    const customerOrders={};delivered.forEach(o=>{const k=o.customerUid||o.customerId||o.phone||o.customerPhone||'guest';(customerOrders[k]??=[]).push(o)});
    const unique=Object.keys(customerOrders).length,repeat=Object.values(customerOrders).filter(x=>x.length>=2).length,repeatRate=unique?repeat/unique*100:0;
    const clv=unique?revenue/unique:0;
    const days30=this.dailySeries(30),avg=days30.reduce((n,x)=>n+x.value,0)/Math.max(1,days30.length),trend=days30.length>1?(days30.at(-1).value-days30[0].value)/Math.max(1,days30.length-1):0,forecast=Math.max(0,Math.round(avg*30+trend*15));
    const prior=this.periodRevenue(14,28),recent=this.periodRevenue(0,14),trendPct=prior?((recent-prior)/prior*100):recent?100:0;
    this.metrics={delivered,revenue,productCost,approvedExpense,grossProfit,grossMargin,aov,repeatRate,clv,forecast,trendPct,netProfit:grossProfit-approvedExpense};
  },
  dailySeries(days){
    const out=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const value=this.orders.filter(o=>{const t=this.ts(o.createdAt||o.orderDate);return t&&t.toDateString()===d.toDateString()&&o.status==='delivered'}).reduce((n,o)=>n+this.total(o),0);out.push({date:d,value})}return out;
  },
  periodRevenue(fromDays,toDays){const now=Date.now(),start=now-toDays*86400000,end=now-fromDays*86400000;return this.orders.filter(o=>{const t=this.ts(o.createdAt||o.orderDate);return t&&t.getTime()>=start&&t.getTime()<end&&o.status==='delivered'}).reduce((n,o)=>n+this.total(o),0)},
  renderAll(){
    const set=(id,v)=>document.getElementById(id).textContent=v;
    set('biRevenue',this.money(this.metrics.revenue));set('biRevenueTrend',`${this.metrics.trendPct>=0?'+':''}${this.metrics.trendPct.toFixed(1)}%`);set('biMargin',`${this.metrics.grossMargin.toFixed(1)}%`);set('biAov',this.money(this.metrics.aov));set('biClv',this.money(this.metrics.clv));set('biRepeat',`${this.metrics.repeatRate.toFixed(1)}%`);set('biForecast',this.money(this.metrics.forecast));
    this.renderInsights();this.renderRevenueChart();this.renderFunnel();this.renderProfitability();this.renderDelivery();this.renderSales();this.renderCustomers();this.renderProducts();this.renderBranches();this.renderKpis();
  },
  renderInsights(){
    const items=[],cancelRate=this.orders.length?this.orders.filter(o=>['cancelled','canceled'].includes(o.status)).length/this.orders.length*100:0,refundRate=this.orders.length?this.refunds.length/this.orders.length*100:0,low=this.products.filter(p=>(+p.stock||0)<= (+p.lowStockThreshold||5));
    if(this.metrics.trendPct<-10)items.push(`<li><strong>Revenue trend ${this.metrics.trendPct.toFixed(1)}%</strong><span>Sales decline requires channel, branch and product review.</span></li>`);
    if(this.metrics.grossMargin<15)items.push(`<li><strong>Gross margin below 15%</strong><span>Review procurement cost, discounts and pricing.</span></li>`);
    if(cancelRate>8)items.push(`<li><strong>Cancellation rate ${cancelRate.toFixed(1)}%</strong><span>Investigate stock, confirmation and delivery causes.</span></li>`);
    if(refundRate>5)items.push(`<li><strong>Refund rate ${refundRate.toFixed(1)}%</strong><span>Product quality and delivery quality review required.</span></li>`);
    if(low.length)items.push(`<li><strong>${this.bn(low.length)} low-stock products</strong><span>Potential revenue loss from stock availability.</span></li>`);
    document.getElementById('biInsightDesk').innerHTML=`<div><span class="office-kicker">MANAGEMENT INSIGHTS</span><h2>${items.length?'Decision signals detected':'Business indicators stable'}</h2></div><ul>${items.join('')||'<li><strong>No critical negative signal</strong><span>Continue monitoring KPI movements.</span></li>'}</ul>`;
  },
  tab(name,btn){['overview','sales','customers','products','branches','kpis'].forEach(x=>document.getElementById(`bi${x[0].toUpperCase()+x.slice(1)}Pane`).hidden=x!==name);document.querySelectorAll('.bi-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active')},
  renderRevenueChart(){const data=this.dailySeries(14),max=Math.max(1,...data.map(x=>x.value));document.getElementById('biRevenueChart').innerHTML=data.map(x=>`<div><span>${x.date.toLocaleDateString('bn-BD',{day:'numeric'})}</span><i style="height:${Math.max(7,x.value/max*170)}px"></i><strong>${this.money(x.value)}</strong></div>`).join('')},
  renderFunnel(){const statuses=['pending','confirmed','processing','assigned','out_for_delivery','delivered','cancelled'];const max=Math.max(1,...statuses.map(s=>this.orders.filter(o=>o.status===s||s==='cancelled'&&o.status==='canceled').length));document.getElementById('biOrderFunnel').innerHTML=statuses.map(s=>{const n=this.orders.filter(o=>o.status===s||s==='cancelled'&&o.status==='canceled').length;return`<div><span>${s.replaceAll('_',' ')}</span><i style="width:${n/max*100}%"></i><strong>${this.bn(n)}</strong></div>`}).join('')},
  renderProfitability(){document.getElementById('biProfitability').innerHTML=this.metricRows([['Revenue',this.money(this.metrics.revenue)],['Product Cost',this.money(this.metrics.productCost)],['Gross Profit',this.money(this.metrics.grossProfit)],['Operating Expense',this.money(this.metrics.approvedExpense)],['Estimated Net Profit',this.money(this.metrics.netProfit)]])},
  renderDelivery(){const delivered=this.orders.filter(o=>o.status==='delivered'),failed=this.orders.filter(o=>['cancelled','canceled','failed'].includes(o.status)),rate=this.orders.length?delivered.length/this.orders.length*100:0,active=this.drivers.filter(d=>d.online===true||d.status==='available'||d.status==='active').length;document.getElementById('biDeliveryMetrics').innerHTML=this.metricRows([['Delivery Success',`${rate.toFixed(1)}%`],['Delivered Orders',this.bn(delivered.length)],['Failed/Cancelled',this.bn(failed.length)],['Active Drivers',this.bn(active)]])},
  metricRows(rows){return rows.map(r=>`<div><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')},
  renderSales(){const monthly={};this.orders.filter(o=>o.status==='delivered').forEach(o=>{const t=this.ts(o.createdAt||o.orderDate);if(!t)return;const k=t.toISOString().slice(0,7);monthly[k]=(monthly[k]||0)+this.total(o)});document.getElementById('biSalesGrid').innerHTML=Object.entries(monthly).sort().reverse().map(([m,v])=>`<article><span>${m}</span><h3>${this.money(v)}</h3><p>${this.bn(this.orders.filter(o=>{const t=this.ts(o.createdAt||o.orderDate);return t&&t.toISOString().slice(0,7)===m&&o.status==='delivered'}).length)} delivered orders</p></article>`).join('')||'<p>No sales data</p>'},
  renderCustomers(){const segments={vip:0,repeat:0,new:0,at_risk:0,inactive:0,other:0};this.customers.forEach(c=>{const s=c.segment||'other';segments[s]=(segments[s]||0)+1});document.getElementById('biCustomerGrid').innerHTML=Object.entries(segments).map(([s,n])=>`<article><span>${s.replaceAll('_',' ')}</span><h3>${this.bn(n)}</h3><p>${this.customers.length?(n/this.customers.length*100).toFixed(1):0}% of customers</p></article>`).join('')},
  renderProducts(){
    const sales={};this.orders.filter(o=>o.status==='delivered').forEach(o=>(o.items||o.cart||[]).forEach(i=>{const k=i.productId||i.id||i.name||'unknown';sales[k]??={name:i.name||i.title||k,qty:0,revenue:0,cost:0};sales[k].qty+=Number(i.qty||i.quantity||1);sales[k].revenue+=Number(i.price||0)*Number(i.qty||i.quantity||1);sales[k].cost+=Number(i.cost||i.costPrice||Number(i.price||0)*.72)*Number(i.qty||i.quantity||1)}));
    document.getElementById('biProductList').innerHTML=Object.values(sales).sort((a,b)=>b.revenue-a.revenue).slice(0,30).map((p,i)=>`<article><b>${i+1}</b><div><strong>${this.esc(p.name)}</strong><span>${this.bn(p.qty)} units · Margin ${p.revenue?((p.revenue-p.cost)/p.revenue*100).toFixed(1):0}%</span></div><em>${this.money(p.revenue)}</em></article>`).join('')||'<p>No product sales data</p>';
  },
  branchKey(o){return o.branchId||o.branchCode||o.branchName||o.branch||''},
  renderBranches(){document.getElementById('biBranchList').innerHTML=this.branches.map(b=>{const os=this.orders.filter(o=>[b.id,b.branchCode,b.name].includes(this.branchKey(o))),del=os.filter(o=>o.status==='delivered'),rev=del.reduce((n,o)=>n+this.total(o),0),rate=os.length?del.length/os.length*100:0;return{b,os,rev,rate}}).sort((a,b)=>b.rev-a.rev).map((x,i)=>`<article><b>${i+1}</b><div><strong>${this.esc(x.b.name||x.b.branchCode||'Branch')}</strong><span>${this.bn(x.os.length)} orders · ${x.rate.toFixed(1)}% success</span></div><em>${this.money(x.rev)}</em></article>`).join('')||'<p>No branch data</p>'},
  kpiValue(k){if(k.source==='orders')return this.orders.length;if(k.source==='revenue')return this.metrics.revenue;if(k.source==='customers')return this.customers.length;if(k.source==='delivery_rate')return this.orders.length?this.metrics.delivered.length/this.orders.length*100:0;if(k.source==='refund_rate')return this.orders.length?this.refunds.length/this.orders.length*100:0;if(k.source==='inventory')return this.products.reduce((n,p)=>n+(+p.stock||0),0);return 0},
  renderKpis(){document.getElementById('biKpiGrid').innerHTML=this.kpis.map(k=>{const value=this.kpiValue(k),target=Number(k.target||0),good=k.direction==='lower'?value<=target:value>=target,pct=target?Math.min(100,Math.round(value/target*100)):0;return`<article class="${good?'good':'risk'}"><span>${this.esc(k.department||'Company')}</span><h3>${this.esc(k.name||'KPI')}</h3><div class="bi-kpi-value">${this.bn(Math.round(value))}</div><div class="bi-kpi-bar"><i style="width:${pct}%"></i></div><p>Target ${this.bn(target)} · ${good?'On Target':'Below Target'}</p></article>`}).join('')||'<p>No custom KPI</p>'},
  open(id){document.getElementById(id).classList.add('open')},close(id){document.getElementById(id).classList.remove('open')},
  async saveKpi(){const name=document.getElementById('biKpiName').value.trim();if(!name)return toast('KPI name required','error');await FB.setDoc(FB.doc(FB.db,'business_kpis',`kpi_${Date.now()}`),{name,department:document.getElementById('biKpiDepartment').value.trim(),source:document.getElementById('biKpiSource').value,aggregation:document.getElementById('biKpiAggregation').value,target:+document.getElementById('biKpiTarget').value||0,direction:document.getElementById('biKpiDirection').value,description:document.getElementById('biKpiDescription').value.trim(),status:'active',createdBy:this.uid(),createdAt:FB.serverTimestamp()});this.close('biKpiModal');await this.refresh()},
  async saveSnapshot(){await FB.setDoc(FB.doc(FB.db,'business_intelligence_snapshots',`snapshot_${Date.now()}`),{metrics:this.metrics,customKpis:this.kpis.map(k=>({id:k.id,name:k.name,value:this.kpiValue(k),target:k.target})),createdBy:this.uid(),createdAt:FB.serverTimestamp()});toast('BI snapshot saved','success')},
  exportKpis(){const rows=[['Metric','Value'],['Revenue',this.metrics.revenue],['Gross Margin',this.metrics.grossMargin],['AOV',this.metrics.aov],['CLV',this.metrics.clv],['Repeat Rate',this.metrics.repeatRate],['30 Day Forecast',this.metrics.forecast],...this.kpis.map(k=>[k.name,this.kpiValue(k)])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download='golapi-business-intelligence-kpis.csv';a.click()}
};window.BusinessIntelligence=BusinessIntelligence;
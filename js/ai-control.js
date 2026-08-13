const AIControl = {
  orders: [],
  products: [],
  drivers: [],
  customers: [],
  refunds: [],
  automations: [],
  recommendations: [],
  forecast: [],
  esc(v) {
    return String(v ?? "").replace(
      /[&<>\'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  },
  bn(v) {
    return typeof bn === "function" ? bn(v) : String(v);
  },
  money(v) {
    return (
      "৳" + Number(v || 0).toLocaleString("bn-BD", { maximumFractionDigits: 0 })
    );
  },
  uid() {
    return FB?.auth?.currentUser?.uid || OwnerAuth?.currentUid || "";
  },
  ts(v) {
    return v?.toDate ? v.toDate() : v ? new Date(v) : null;
  },
  total(o) {
    return Number(o.total || o.grandTotal || o.totalAmount || o.amount || 0);
  },
  async render() {
    if (typeof EmployeeWorkspace !== "undefined")
      EmployeeWorkspace.mountCurrent("aiEmployeeWorkspace");
    await this.refresh();
  },
  async refresh() {
    const u = document.getElementById("aiUpdated");
    if (u) u.textContent = "বিশ্লেষণ হচ্ছে…";
    const names = [
      "orders",
      "products",
      "drivers",
      "customer_profiles",
      "refund_requests",
      "ai_automations",
    ];
    const snaps = await Promise.all(
      names.map((n) => FB.getDocs(FB.collection(FB.db, n)).catch(() => null)),
    );
    const arr = (s) => {
      const a = [];
      s?.forEach((x) => a.push({ id: x.id, ...x.data() }));
      return a;
    };
    [
      this.orders,
      this.products,
      this.drivers,
      this.customers,
      this.refunds,
      this.automations,
    ] = snaps.map(arr);
    this.calculate();
    this.renderAll();
    if (u)
      u.textContent =
        "আপডেট: " +
        new Date().toLocaleTimeString("bn-BD", {
          hour: "2-digit",
          minute: "2-digit",
        });
  },
  calculate() {
    const delivered = this.orders.filter((o) => o.status === "delivered"),
      cancelled = this.orders.filter((o) =>
        ["cancelled", "canceled"].includes(o.status),
      ),
      low = this.products.filter(
        (p) => (+p.stock || 0) <= (+p.lowStockThreshold || 5),
      ),
      late = this.orders.filter(
        (o) =>
          ["assigned", "picked", "out_for_delivery"].includes(o.status) &&
          this.ts(o.updatedAt || o.createdAt) &&
          Date.now() - this.ts(o.updatedAt || o.createdAt).getTime() > 7200000,
      ),
      risk = this.customers.filter((c) =>
        ["at_risk", "inactive"].includes(c.segment || c.status),
      );
    const success = this.orders.length
        ? delivered.length / this.orders.length
        : 1,
      cancel = this.orders.length ? cancelled.length / this.orders.length : 0,
      refund = this.orders.length
        ? this.refunds.length / this.orders.length
        : 0;
    this.health = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          80 +
            success * 20 -
            cancel * 25 -
            refund * 20 -
            Math.min(20, low.length * 2) -
            Math.min(15, late.length * 3),
        ),
      ),
    );
    this.metrics = { low, late, risk };
    this.forecast = this.buildForecast();
    this.recommendations = [];
    if (low.length)
      this.recommendations.push({
        priority: "high",
        title: `${low.length}টি stock risk`,
        detail: "Restock request বা purchase order প্রস্তুত করুন।",
        action: "inventory-dash",
      });
    if (late.length)
      this.recommendations.push({
        priority: "high",
        title: `${late.length}টি delivery delay risk`,
        detail: "Rider load ও dispatch queue যাচাই করুন।",
        action: "zone-manager",
      });
    if (risk.length)
      this.recommendations.push({
        priority: "medium",
        title: `${risk.length} জন retention opportunity`,
        detail: "CRM campaign বা care call বিবেচনা করুন।",
        action: "crm-dash",
      });
    if (!this.recommendations.length)
      this.recommendations.push({
        priority: "normal",
        title: "Core operations stable",
        detail: "কোনো গুরুতর operational risk পাওয়া যায়নি।",
        action: "analytics-dash",
      });
  },
  buildForecast() {
    const vals = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const day = this.orders.filter((o) => {
        const t = this.ts(o.createdAt || o.orderDate);
        return (
          t && t.toDateString() === d.toDateString() && o.status !== "cancelled"
        );
      });
      vals.push(day.reduce((n, o) => n + this.total(o), 0));
    }
    const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length),
      trend = (vals.at(-1) - vals[0]) / Math.max(1, vals.length - 1);
    return Array.from({ length: 7 }, (_, i) => ({
      value: Math.max(0, Math.round(avg + trend * (i + 1))),
      date: new Date(Date.now() + (i + 1) * 86400000),
    }));
  },
  renderAll() {
    document.getElementById("aiHealthScore").textContent = this.bn(this.health);
    document.getElementById("aiRevenueForecast").textContent = this.money(
      this.forecast.reduce((n, x) => n + x.value, 0),
    );
    document.getElementById("aiStockRisk").textContent = this.bn(
      this.metrics.low.length,
    );
    document.getElementById("aiDeliveryRisk").textContent = this.bn(
      this.metrics.late.length,
    );
    document.getElementById("aiCustomerRisk").textContent = this.bn(
      this.metrics.risk.length,
    );
    this.renderRecommendations();
    this.renderForecast();
    this.renderInventory();
    this.renderCustomers();
    this.renderAnomalies();
    this.renderAutomations();
  },
  renderRecommendations() {
    document.getElementById("aiRecommendationList").innerHTML =
      this.recommendations
        .map(
          (r, i) =>
            `<article class="${r.priority}"><span>${i + 1}</span><div><strong>${this.esc(r.title)}</strong><p>${this.esc(r.detail)}</p></div><button onclick="Router.go('${r.action}')">Open →</button></article>`,
        )
        .join("");
  },
  renderForecast() {
    const max = Math.max(1, ...this.forecast.map((x) => x.value));
    document.getElementById("aiForecastChart").innerHTML = this.forecast
      .map(
        (x) =>
          `<div><span>${x.date.toLocaleDateString("bn-BD", { weekday: "short" })}</span><i style="height:${Math.max(8, (x.value / max) * 150)}px"></i><strong>${this.money(x.value)}</strong></div>`,
      )
      .join("");
  },
  renderInventory() {
    document.getElementById("aiInventoryList").innerHTML =
      this.metrics.low
        .slice(0, 12)
        .map((p) => {
          const q = Math.max(
            10,
            (+p.lowStockThreshold || 5) * 3 - (+p.stock || 0),
          );
          return `<article><div><strong>${this.esc(p.name || p.title || "Product")}</strong><span>Stock ${this.bn(+p.stock || 0)} · Suggested ${this.bn(q)}</span></div><button onclick="AIControl.createRestock('${p.id}',${q})">Create</button></article>`;
        })
        .join("") || "<p>কোনো reorder risk নেই।</p>";
  },
  renderCustomers() {
    document.getElementById("aiCustomerList").innerHTML =
      this.metrics.risk
        .slice(0, 12)
        .map(
          (c) =>
            `<article><div><strong>${this.esc(c.name || c.customerName || "Customer")}</strong><span>${this.esc(c.phone || c.email || "")} · ${this.esc(c.segment || c.status || "at_risk")}</span></div><button onclick="Router.go('crm-dash')">CRM</button></article>`,
        )
        .join("") || "<p>কোনো retention risk নেই।</p>";
  },
  renderAnomalies() {
    const a = [];
    const high = this.orders.filter((o) => this.total(o) > 20000);
    if (high.length) a.push(`${high.length}টি high-value order`);
    if (this.refunds.filter((r) => r.status === "pending").length > 5)
      a.push("Pending refund backlog");
    document.getElementById("aiAnomalyList").innerHTML =
      a
        .map(
          (x) =>
            `<article><div><strong>Attention</strong><span>${this.esc(x)}</span></div><button onclick="Router.go('analytics-dash')">Review</button></article>`,
        )
        .join("") || "<p>কোনো বড় anomaly নেই।</p>";
  },
  async createRestock(id, qty) {
    const p = this.products.find((x) => x.id === id);
    if (!p) return;
    await FB.setDoc(
      FB.doc(FB.db, "restock_requests", `ai_${id}_${Date.now()}`),
      {
        productId: id,
        productName: p.name || p.title || "",
        requestedQty: qty,
        status: "pending",
        source: "ai_control",
        requestedBy: this.uid(),
        createdAt: FB.serverTimestamp(),
      },
    );
    toast("AI restock request তৈরি হয়েছে", "success");
  },
  renderAutomations() {
    document.getElementById("aiAutomationTable").innerHTML =
      this.automations
        .map(
          (a) =>
            `<tr><td>${this.esc(a.name || "Automation")}</td><td>${this.esc(a.trigger || "")}</td><td>${this.esc(a.action || "")}</td><td>${this.esc(a.status || "active")}</td><td>${a.lastRunAt ? this.ts(a.lastRunAt).toLocaleString("bn-BD") : "—"}</td><td><button onclick="AIControl.runAutomation('${a.id}')">Run</button></td></tr>`,
        )
        .join("") || '<tr><td colspan="6">কোনো automation নেই।</td></tr>';
  },
  openModal(id) {
    document.getElementById(id)?.classList.add("open");
  },
  closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
  },
  runPrompt() {
    const q = document.getElementById("aiPromptInput").value.trim();
    if (!q) return toast("প্রশ্ন লিখুন", "error");
    document.getElementById("aiPromptOutput").innerHTML =
      `<strong>AI Analysis</strong><p>Business Health ${this.health}/100। ৭ দিনের forecast ${this.money(this.forecast.reduce((n, x) => n + x.value, 0))}। প্রধান ঝুঁকি: ${this.metrics.low.length} stock, ${this.metrics.late.length} delivery, ${this.metrics.risk.length} customer case।</p><small>Connected business data-এর rule-based analysis।</small>`;
  },
  async generateBrief() {
    await FB.setDoc(FB.doc(FB.db, "ai_reports", `brief_${Date.now()}`), {
      healthScore: this.health,
      revenueForecast: this.forecast.reduce((n, x) => n + x.value, 0),
      recommendations: this.recommendations,
      createdBy: this.uid(),
      createdAt: FB.serverTimestamp(),
    });
    toast("AI Executive Brief সংরক্ষণ হয়েছে", "success");
  },
  async saveRecommendations() {
    await FB.setDoc(
      FB.doc(FB.db, "ai_decision_logs", `decision_${Date.now()}`),
      {
        healthScore: this.health,
        recommendations: this.recommendations,
        createdBy: this.uid(),
        createdAt: FB.serverTimestamp(),
      },
    );
    toast("Decision Log সংরক্ষণ হয়েছে", "success");
  },
  async saveAutomation() {
    const name = document.getElementById("aiAutomationName").value.trim();
    if (!name) return toast("নাম দিন", "error");
    let config = {};
    try {
      config = JSON.parse(
        document.getElementById("aiAutomationConfig").value || "{}",
      );
    } catch {
      return toast("Config JSON সঠিক নয়", "error");
    }
    await FB.setDoc(
      FB.doc(FB.db, "ai_automations", `automation_${Date.now()}`),
      {
        name,
        trigger: document.getElementById("aiAutomationTrigger").value,
        action: document.getElementById("aiAutomationAction").value,
        status: document.getElementById("aiAutomationStatus").value,
        config,
        createdBy: this.uid(),
        createdAt: FB.serverTimestamp(),
      },
    );
    this.closeModal("aiAutomationModal");
    await this.refresh();
    toast("Automation সংরক্ষণ হয়েছে", "success");
  },
  async runAutomation(id) {
    const a = this.automations.find((x) => x.id === id);
    if (!a) return;
    if (a.trigger === "low_stock" && a.action === "create_restock") {
      for (const p of this.metrics.low.slice(0, 20))
        await this.createRestock(
          p.id,
          Math.max(10, (+a.config?.threshold || 5) * 3 - (+p.stock || 0)),
        );
    } else if (a.action === "save_report") await this.generateBrief();
    await FB.setDoc(
      FB.doc(FB.db, "ai_automations", id),
      { lastRunAt: FB.serverTimestamp(), lastRunResult: "Completed" },
      { merge: true },
    );
    await this.refresh();
    toast("Automation run complete", "success");
  },
};
window.AIControl = AIControl;

/* app-registry.js — single source of truth for routes, lazy views and controllers */
(function createAppRegistry(global) {
  'use strict';

  const employeeWorkspaceScript = './js/employee-workspace.js';
  const staffChatScript = './js/staff-chat.js';

  const pages = {
    home: { path: '/', initial: true, controller: ['Home', 'render'] },
    listing: { initial: true, controller: ['Listing', 'render'] },
    product: { initial: true, controller: ['PDP', 'load'], param: 'id' },
    checkout: { scripts: ['./js/checkout.js', './js/payment.js', './js/sms.js'], controller: ['Checkout', 'init'] },
    myorders: { path: '/myorders', scripts: ['./js/memo.js', './js/livemap.js'], controller: ['MyOrders', 'render'] },
    wishlist: { controller: ['Wishlist', 'render'] },
    account: { path: '/account', controller: ['AccountPage', 'render'] },
    'account-addresses': { controller: ['AccountPage', 'renderAddresses'] },
    medical: { path: '/medical', controller: ['Medical', 'render'] },
    'custom-bazar': { path: '/custom-bazar', scripts: ['./js/custom-bazar.js', './js/memo.js'], controller: ['CustomBazar', 'init'] },
    'order-success': { controller: ['OrderSuccess', 'render'] },
    'about-app': { path: '/about', controller: ['SiteReview', 'render'] },
    'privacy-info': { path: '/privacy' },
    terms: { path: '/terms' },
    contact: { path: '/contact' },

    'admin-dash': {
      path: '/admin', aliases: ['/executive'], staff: true,
      scripts: ['./js/admin.js', staffChatScript, employeeWorkspaceScript, './js/employee-management.js'],
      controller: ['AdminDash', 'render'], employeeHost: 'adminEmployeeWorkspace'
    },
    driver: {
      path: '/driver', staff: true, external: '/driver/'
    },
    'zone-manager': {
      path: '/zone-manager', aliases: ['/manager'], staff: true,
      scripts: ['./js/zone-manager.js', staffChatScript, employeeWorkspaceScript],
      controller: ['ZoneManagerDash', 'render']
    },
    'inventory-dash': { path: '/inventory', staff: true, scripts: ['./js/inventory.js', staffChatScript, employeeWorkspaceScript], controller: ['InventoryDash', 'render'] },
    'finance-dash': { path: '/finance', staff: true, scripts: ['./js/finance.js', staffChatScript, employeeWorkspaceScript], controller: ['FinanceDash', 'render'] },
    'support-dash': { path: '/support', staff: true, scripts: ['./js/support.js', staffChatScript, employeeWorkspaceScript], controller: ['SupportDash', 'render'] },
    'procurement-dash': { path: '/procurement', aliases: ['/procurement-office', '/vendors'], staff: true, scripts: ['./js/procurement.js', staffChatScript, employeeWorkspaceScript], controller: ['ProcurementDash', 'render'] },
    'warehouse-dash': { path: '/warehouse', staff: true, scripts: ['./js/warehouse.js', staffChatScript, employeeWorkspaceScript], controller: ['WarehouseDash', 'render'] },
    'analytics-dash': { path: '/analytics', aliases: ['/reports'], staff: true, scripts: ['./js/analytics.js', staffChatScript, employeeWorkspaceScript], controller: ['AnalyticsCenter', 'render'] },
    'company-settings': { path: '/company-settings', aliases: ['/access-control'], staff: true, scripts: ['./js/company-settings.js', employeeWorkspaceScript], controller: ['CompanySettings', 'render'] },
    'documents-dash': { path: '/documents', aliases: ['/document-office'], staff: true, scripts: ['./js/documents.js', employeeWorkspaceScript], controller: ['DocumentOffice', 'render'] },
    'attendance-dash': { path: '/attendance', aliases: ['/time-office'], staff: true, scripts: ['./js/attendance.js', employeeWorkspaceScript], controller: ['AttendanceOffice', 'render'] },
    'payroll-dash': { path: '/payroll', aliases: ['/payroll-office'], staff: true, scripts: ['./js/payroll.js', employeeWorkspaceScript], controller: ['PayrollOffice', 'render'] },
    'branch-dash': { path: '/branches', aliases: ['/branch-office'], staff: true, scripts: ['./js/branch.js', employeeWorkspaceScript], controller: ['BranchOffice', 'render'] },
    'crm-dash': { path: '/crm', aliases: ['/customer-relationship'], staff: true, scripts: ['./js/crm.js', employeeWorkspaceScript], controller: ['CRMOffice', 'render'] },
    'company-os': { path: '/company-os', aliases: ['/office'], staff: true, scripts: ['./js/company-os.js'], controller: ['CompanyOS', 'render'], persistent: true },
    'ai-control': { path: '/ai-control', aliases: ['/ai-center'], staff: true, scripts: ['./js/ai-control.js', employeeWorkspaceScript], controller: ['AIControl', 'render'] },
    'hr-erp': { path: '/hr-erp', aliases: ['/people-erp'], staff: true, scripts: ['./js/hr-erp.js', employeeWorkspaceScript], controller: ['HRERP', 'render'] },
    'finance-erp': { path: '/finance-erp', aliases: ['/accounting'], staff: true, scripts: ['./js/finance-erp.js', employeeWorkspaceScript], controller: ['FinanceERP', 'render'] },
    'warehouse-erp': { path: '/warehouse-erp', aliases: ['/wms'], staff: true, scripts: ['./js/warehouse-erp.js', employeeWorkspaceScript], controller: ['WarehouseERP', 'render'] },
    'marketing-erp': { path: '/marketing-erp', aliases: ['/marketing-automation'], staff: true, scripts: ['./js/marketing-erp.js', employeeWorkspaceScript], controller: ['MarketingERP', 'render'] },
    'workflow-erp': { path: '/workflow-erp', aliases: ['/automation-engine'], staff: true, scripts: ['./js/workflow-erp.js', employeeWorkspaceScript], controller: ['WorkflowERP', 'render'] },
    'bi-erp': { path: '/bi-erp', aliases: ['/business-intelligence'], staff: true, scripts: ['./js/bi-erp.js', employeeWorkspaceScript], controller: ['BusinessIntelligence', 'render'] },
    'asset-erp': { path: '/asset-erp', aliases: ['/asset-management'], staff: true, scripts: ['./js/asset-erp.js', employeeWorkspaceScript], controller: ['AssetERP', 'render'] },
    'crm-erp': { path: '/crm-erp', aliases: ['/customer-service-crm'], staff: true, scripts: ['./js/crm-erp.js', employeeWorkspaceScript], controller: ['CustomerCRM', 'render'] },
    'procurement-erp': { path: '/procurement-erp', aliases: ['/vendor-erp'], staff: true, scripts: ['./js/procurement-erp.js', employeeWorkspaceScript], controller: ['ProcurementERP', 'render'] },
    'facilities-erp': { path: '/facilities-erp', aliases: ['/branch-operations'], staff: true, scripts: ['./js/facilities-erp.js', employeeWorkspaceScript], controller: ['FacilitiesERP', 'render'] }
  };

  // Shared staff workspace metadata. Company OS, permission settings and the
  // router access gate all consume this list so a newly added office cannot be
  // visible in one place but missing or unprotected in another.
  const staffCatalog = Object.freeze([
    {id:'admin-dash',icon:'⌘',name:'Executive Command Center',description:'কোম্পানি নেতৃত্ব, সিদ্ধান্ত ও executive brief',roles:['admin','chief_executive_officer']},
    {id:'company-os',icon:'◈',name:'Company OS Home',description:'কেন্দ্রীয় অফিস ডেস্ক ও command center',roles:['*']},
    {id:'attendance-dash',icon:'◷',name:'Attendance & Time Office',description:'Attendance, leave, overtime ও workforce time',roles:['admin','hr','attendance_officer','people_officer']},
    {id:'payroll-dash',icon:'৳',name:'Payroll Office',description:'Salary, allowance, deduction ও payslip',roles:['admin','finance','payroll_officer','hr']},
    {id:'documents-dash',icon:'▤',name:'Document Management Office',description:'Employee documents, letters ও records',roles:['admin','hr','document_officer','people_officer']},
    {id:'inventory-dash',icon:'▦',name:'Inventory Control Room',description:'Stock, low inventory ও restock control',roles:['admin','inventory_manager','zone_manager','warehouse_manager']},
    {id:'procurement-dash',icon:'◫',name:'Procurement & Vendor Office',description:'RFQ, PO, suppliers, contracts ও vendor due',roles:['admin','procurement','procurement_officer','chief_procurement_officer','vendor_relationship_officer']},
    {id:'warehouse-dash',icon:'▣',name:'Warehouse Control Room',description:'Receiving, picking, packing ও cycle count',roles:['admin','warehouse_manager','inventory_manager']},
    {id:'support-dash',icon:'☏',name:'Customer Care Center',description:'Ticket, SLA, refund ও escalation',roles:['admin','support','customer_care_manager','support_manager','zone_manager']},
    {id:'finance-dash',icon:'₿',name:'Finance Office',description:'Revenue, COD, refunds ও finance ledger',roles:['admin','finance','zone_manager']},
    {id:'analytics-dash',icon:'◩',name:'Analytics & Reports Center',description:'Business intelligence ও performance reports',roles:['admin','analytics_manager','finance','zone_manager']},
    {id:'branch-dash',icon:'⌂',name:'Branch Management Office',description:'Branch manager, capacity ও performance',roles:['admin','branch_manager','zone_manager']},
    {id:'crm-dash',icon:'♡',name:'Customer Relationship Office',description:'Customer 360, VIP, loyalty ও campaigns',roles:['admin','crm_manager','support','customer_care_manager','zone_manager']},
    {id:'company-settings',icon:'⚙',name:'Company Settings & Access',description:'Company policy, permission ও governance',roles:['admin']},
    {id:'ai-control',icon:'✦',name:'AI Control Center',description:'Forecast, recommendations ও automation rules',roles:['admin','ai_operations_manager','analytics_manager','zone_manager']},
    {id:'hr-erp',icon:'👥',name:'Human Resources ERP',description:'Recruitment, onboarding, performance, training ও employee lifecycle',roles:['admin','hr','people_officer','talent_development_manager']},
    {id:'finance-erp',icon:'📒',name:'Finance ERP',description:'Accounts, journals, budgets, reconciliation ও statements',roles:['admin','finance','financial_controller']},
    {id:'warehouse-erp',icon:'🏬',name:'Advanced Warehouse ERP',description:'Locations, bin inventory, transfers, damage ও cycle counts',roles:['admin','warehouse_manager','inventory_manager','warehouse_systems_manager','logistics_manager','fleet_operations_manager']},
    {id:'marketing-erp',icon:'📣',name:'Marketing Automation Center',description:'Campaigns, segments, coupons, loyalty, referral ও automation',roles:['admin','marketing','crm_manager','growth_automation_manager']},
    {id:'workflow-erp',icon:'🔄',name:'Workflow Automation Engine',description:'Workflow builder, approvals, tasks, SLA ও execution logs',roles:['admin','workflow_automation_manager','governance_officer']},
    {id:'bi-erp',icon:'📊',name:'Business Intelligence Center',description:'KPI, forecast, funnel, profitability ও branch scorecard',roles:['admin','analytics_manager','business_intelligence_manager','financial_controller']},
    {id:'asset-erp',icon:'💼',name:'Company Asset Management',description:'Asset register, custody, maintenance, depreciation, audit ও disposal',roles:['admin','asset_officer','asset_manager','asset_lifecycle_manager','governance_officer','financial_controller']},
    {id:'crm-erp',icon:'🎧',name:'Customer Service CRM',description:'Tickets, customer 360, inbox, refunds, knowledge base ও service analytics',roles:['admin','support','support_manager','crm_manager','customer_experience_manager']},
    {id:'procurement-erp',icon:'🧾',name:'Procurement & Vendor ERP',description:'Requests, vendors, quotations, purchase orders, receipts ও invoice matching',roles:['admin','procurement','procurement_vendor_manager','financial_controller','warehouse_manager']},
    {id:'facilities-erp',icon:'🏢',name:'Facilities & Branch Operations ERP',description:'Branches, facility requests, rent, utilities, inspections ও daily checklists',roles:['admin','branch_manager','facilities_operations_manager','governance_officer','financial_controller']},
    {id:'zone-manager',icon:'◎',name:'Zone Operations Center',description:'Zone order, delivery ও branch operations',roles:['admin','zone_manager']},
    {id:'driver',icon:'♢',name:'Rider Workspace',description:'Assigned orders ও delivery activity',roles:['driver']}
  ].map(Object.freeze));
  const staffMeta = new Map(staffCatalog.map(item => [item.id, item]));
  const selfAuthPages = new Set(['driver','zone-manager','inventory-dash','finance-dash','support-dash','procurement-dash','warehouse-dash']);

  const routeIndex = new Map();
  Object.entries(pages).forEach(([id, definition]) => {
    [definition.path, ...(definition.aliases || [])]
      .filter(Boolean)
      .forEach(route => routeIndex.set(route.toLowerCase(), id));
  });

  function invoke(page, params) {
    const definition = pages[page];
    const [ownerName, methodName] = definition?.controller || [];
    const owner = ownerName && global[ownerName];
    const method = owner && owner[methodName];
    if (typeof method === 'function') {
      const argument = definition.param ? params?.[definition.param] : undefined;
      definition.param ? method.call(owner, argument) : method.call(owner);
    }
    if (definition?.employeeHost && global.EmployeeWorkspace) {
      global.EmployeeWorkspace.mountCurrent(definition.employeeHost);
    }
    if (definition?.persistent && global.BusinessOSRuntime) {
      global.BusinessOSRuntime.activate();
    }
  }

  function resolve(path) {
    const normalized = ('/' + String(path || '/').trim().replace(/^\/+|\/+$/g, '')).toLowerCase();
    const product = normalized.match(/^\/product\/([a-z0-9_-]+)$/i);
    if (product) return { page: 'product', params: { id: product[1] } };
    const category = normalized.match(/^\/category\/([a-z0-9_-]+)$/i);
    if (category) return { page: 'listing', params: { cat: category[1] } };
    const page = routeIndex.get(normalized);
    return page ? { page, params: {} } : null;
  }

  global.AppRegistry = Object.freeze({
    all: () => Object.keys(pages),
    definition: page => pages[page] || null,
    initialPages: () => Object.keys(pages).filter(page => pages[page].initial && !pages[page].external),
    lazyPages: () => Object.keys(pages).filter(page => !pages[page].initial && !pages[page].external),
    staffPages: () => Object.keys(pages).filter(page => pages[page].staff),
    staffCatalog: () => staffCatalog,
    staffMeta: page => staffMeta.get(page) || null,
    selfAuth: page => selfAuthPages.has(page),
    staffPaths: () => Object.fromEntries(Object.entries(pages).filter(([, value]) => value.staff && value.path).map(([page, value]) => [page, value.path])),
    isStaff: page => Boolean(pages[page]?.staff),
    scripts: page => pages[page]?.scripts || [],
    external: page => pages[page]?.external || null,
    invoke,
    resolve
  });
})(window);

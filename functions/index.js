/* functions/index.js
 *
 * README.md-এ স্পষ্ট করে লেখা ছিল:
 *   "⚠️ এখনো বাকি: actual notification পাঠানোর ট্রিগার (Cloud Function দরকার —
 *    Blaze plan + Firebase CLI/কম্পিউটার লাগবে, iPhone থেকে সম্ভব না)"
 *
 * firebase-init.js শুধু token রেজিস্টার করত (registerPushToken) — token দিয়ে
 * আসলে কাউকে notification *পাঠানোর* কোনো server-side কোড repo-তে ছিল না।
 * এই ফাইলটাই সেই বাকি অংশ।
 *
 * এখানে আরেকটা fix-ও আছে: checkout audit-এ ধরা পড়েছিল payment.js-এর
 * cancelOrder() client থেকে সরাসরি wallet/coupon/stock refund করার চেষ্টা করত,
 * কিন্তু Firestore rules নিজের walletBalance client-side বদলাতে দেয় না —
 * ফলে refund silently fail করত (.catch(()=>{}) দিয়ে গেলা হতো), কাস্টমারের
 * টাকা হারিয়ে যেত। Admin SDK security rules bypass করে, তাই এই refund এখন
 * এখানে, server-side, verify করে করা হয় — client rule আলগা করার দরকার নেই।
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ঢাকা/বাংলাদেশের কাছাকাছি region — network latency কমাতে
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

const STATUS_LABEL_BN = {
  pending: 'অর্ডার গ্রহণ করা হয়েছে',
  assigned: 'ডেলিভারি ম্যানের কাছে পাঠানো হয়েছে',
  picked: 'পণ্য সংগ্রহ করা হয়েছে',
  out_for_delivery: 'ডেলিভারির পথে',
  delivered: 'ডেলিভারি সম্পন্ন হয়েছে',
  cancelled: 'অর্ডার বাতিল হয়েছে'
};

const STAFF_NOTIFY_ROLES = ['admin', 'chief_executive_officer', 'zone_manager'];

/* ---------------------------------------------------------------------
 * ১) নতুন অর্ডার এলে relevant staff (admin/zone manager)-কে push পাঠানো
 * ------------------------------------------------------------------- */
exports.onOrderCreated = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data?.data();
  if (!order) return;

  const staffSnap = await db.collection('staff')
    .where('role', 'in', STAFF_NOTIFY_ROLES)
    .where('status', '==', 'active')
    .get()
    .catch(() => null);
  if (!staffSnap || staffSnap.empty) return;

  const tokens = await collectFcmTokens(staffSnap.docs.map(d => d.id));
  if (!tokens.length) return;

  await sendMulticast(tokens, {
    title: '🔔 নতুন অর্ডার এসেছে',
    body: `${order.customerName || 'কাস্টমার'} — ${order.orderNumber || event.params.orderId} (৳${order.total ?? order.subtotal ?? 0})`
  }, { type: 'new_order', orderId: event.params.orderId });
});

/* ---------------------------------------------------------------------
 * ২) অর্ডার status বদলালে কাস্টমারকে push পাঠানো
 * ------------------------------------------------------------------- */
exports.onOrderStatusChange = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (!after.userId) return; // guest order — কোনো account/token নেই

  const tokenDoc = await db.collection('fcmTokens').doc(after.userId).get();
  if (!tokenDoc.exists || !tokenDoc.data().token) return;

  const label = STATUS_LABEL_BN[after.status] || after.status;
  await sendMulticast([tokenDoc.data().token], {
    title: `📦 ${after.orderNumber || event.params.orderId}`,
    body: label
  }, { type: 'order_status', orderId: event.params.orderId, status: after.status });
});

/* ---------------------------------------------------------------------
 * ৩) নিরাপদ, server-side order cancel — wallet + coupon + stock একসাথে
 *    একটাই transaction-এ atomic ভাবে refund হয় (Admin SDK, rules bypass
 *    করে না — নিজেই owner/staff verify করে)
 * ------------------------------------------------------------------- */
exports.cancelOrderSecure = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'লগইন করা আবশ্যক।');

  const orderId = request.data?.orderId;
  const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim().slice(0, 500) : null;
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'orderId প্রয়োজন।');
  }

  const staffDoc = await db.collection('staff').doc(uid).get();
  const staffRole = staffDoc.exists ? staffDoc.data()?.role : null;
  // MT Studio audit fix: আগে "যেকোনো staff role" (isStaff = staffDoc.exists) দিয়ে
  // অন্যের অর্ডার বাতিল করা যেত — যেকোনো নিচু-স্তরের staff (যেমন CRM/procurement)
  // চাইলেই যেকোনো গ্রাহকের অর্ডার cancel করতে পারত। এখন শুধু admin/zone_manager।
  const isStaff = staffRole === 'admin' || staffRole === 'zone_manager';

  const result = await db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'অর্ডার পাওয়া যায়নি।');
    const order = orderSnap.data();

    if (!isStaff && order.userId !== uid) {
      throw new HttpsError('permission-denied', 'এই অর্ডার বাতিল করার অনুমতি নেই।');
    }
    if (order.status === 'cancelled') {
      return { alreadyCancelled: true };
    }
    // MT Studio audit fix: আগে শুধু 'cancelled'/'delivered' status ব্লক করা হতো —
    // 'picked_up'/'in_transit' অবস্থায়ও (ডেলিভারি ম্যান রাস্তায় থাকা অবস্থায়) বাতিল
    // করা যেত, যেটা স্টক/রিফান্ড হিসাব এলোমেলো করে দিতে পারত।
    if (['delivered', 'picked_up', 'in_transit'].includes(order.status)) {
      throw new HttpsError('failed-precondition', 'ডেলিভারি প্রক্রিয়া শুরু হয়ে যাওয়া অর্ডার বাতিল করা যায় না।');
    }

    // --- reads আগে (transaction rule) ---
    const userRef = (order.walletUsed > 0 && order.userId) ? db.collection('users').doc(order.userId) : null;
    const userSnap = userRef ? await tx.get(userRef) : null;

    let couponRef = null;
    if (order.couponCode) {
      const couponQuery = await db.collection('coupons').where('code', '==', order.couponCode).limit(1).get();
      if (!couponQuery.empty) couponRef = couponQuery.docs[0].ref;
    }
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    const productRefs = Array.isArray(order.items)
      ? order.items.map(it => db.collection('products').doc(it.productId))
      : [];
    const productSnaps = await Promise.all(productRefs.map(ref => tx.get(ref)));

    // --- writes পরে ---
    tx.update(orderRef, {
      status: 'cancelled',
      paymentStatus: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(reason ? { cancelReason: reason } : {})
    });

    if (userRef && userSnap?.exists) {
      tx.update(userRef, { walletBalance: admin.firestore.FieldValue.increment(Number(order.walletUsed) || 0) });
    }
    if (couponRef && couponSnap?.exists) {
      const usedCount = Number(couponSnap.data().usedCount || 0);
      tx.update(couponRef, { usedCount: Math.max(0, usedCount - 1) });
    }
    (order.items || []).forEach((it, i) => {
      if (!productSnaps[i]?.exists) return;
      tx.update(productRefs[i], {
        stock: admin.firestore.FieldValue.increment(Number(it.qty) || 0),
        sold: admin.firestore.FieldValue.increment(-(Number(it.qty) || 0))
      });
    });

    return {
      alreadyCancelled: false,
      walletRefunded: Number(order.walletUsed) || 0
    };
  });

  return result;
});

/* ---------------------------------------------------------------------
 * ৪) নিরাপদ, server-side order creation — MT Studio audit fix
 *
 *    আগে checkout.js নিজেই একটা client-run Firestore transaction দিয়ে order
 *    তৈরি করত। সেই transaction লাইভ product ডেটা পড়ত ঠিকই, কিন্তু হিসাবটা
 *    (subtotal/shipping/coupon discount/wallet/total) হতো client-side
 *    JavaScript-এ — আর firestore.rules-এর orders create rule সেই
 *    total/paymentStatus কিছুই যাচাই করত না। ফলে browser console থেকে সরাসরি
 *    Firestore SDK কল করে total:1 বা paymentStatus:'paid' লেখা একটা ভুয়া
 *    order তৈরি করা সম্ভব ছিল। এখন orders create rule সম্পূর্ণ বন্ধ
 *    (allow create: if false) — সব order এই ফাংশন দিয়ে তৈরি হয়, যেখানে দাম,
 *    ছাড়, শিপিং, wallet — সবকিছুই server-side, live Firestore ডেটা থেকে,
 *    নিজে recalculate করা হয়। Guest checkout-ও কাজ করে (request.auth
 *    optional) — শুধু userId null থাকবে, ঠিক আগের rule যেমন allow করত।
 * ------------------------------------------------------------------- */
const DELIVERY_DEFAULTS = { baseFee: 30, perKmFee: 8, perItemFee: 3, avgDistanceKm: 3, freeAboveSubtotal: 1000 };
const PHONE_RE = /^(?:\+880|880|0)1[3-9]\d{8}$/;
const NID_RE = /^\d{10}$|^\d{13}$/;

function calcDeliveryChargeServer(itemCount, subtotal, distanceKm, settings) {
  if (subtotal >= settings.freeAboveSubtotal) return 0;
  // MT Studio audit fix: client-supplied distanceKm আগে সরাসরি বিশ্বাস করা হতো —
  // negative/অস্বাভাবিক মান পাঠিয়ে ডেলিভারি ফি কমানো/শূন্য করা সম্ভব ছিল। এখন
  // 0..50km রেঞ্জে clamp করা হয় (bounds validation)।
  const km = Number.isFinite(distanceKm) ? Math.min(Math.max(distanceKm, 0), 50) : settings.avgDistanceKm;
  const fee = settings.baseFee + km * settings.perKmFee + itemCount * settings.perItemFee;
  return Math.max(0, Math.round(fee));
}

exports.createOrderSecure = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  const data = request.data || {};

  // ---- input shape validation (defense in depth; UI already checks most of this) ----
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!rawItems.length || rawItems.length > 50) {
    throw new HttpsError('invalid-argument', 'কার্টে কমপক্ষে ১টি ও সর্বোচ্চ ৫০ ধরনের পণ্য থাকতে পারে।');
  }
  const dedupItems = new Map();
  for (const it of rawItems) {
    if (!it || typeof it.productId !== 'string' || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50) {
      throw new HttpsError('invalid-argument', 'কার্টের একটি আইটেম সঠিক নয়।');
    }
    dedupItems.set(it.productId, (dedupItems.get(it.productId) || 0) + it.qty);
  }
  const items = Array.from(dedupItems, ([productId, qty]) => ({ productId, qty: Math.min(qty, 50) }));

  const customerName = typeof data.customerName === 'string' ? data.customerName.trim().slice(0, 120) : '';
  const customerPhone = typeof data.customerPhone === 'string' ? data.customerPhone.trim().replace(/[\s-]/g, '') : '';
  const customerNid = typeof data.customerNid === 'string' ? data.customerNid.trim().replace(/\s/g, '') : '';
  const address = typeof data.address === 'string' ? data.address.trim().slice(0, 500) : '';
  const village = typeof data.village === 'string' ? data.village.trim().slice(0, 200) : '';
  const instructions = typeof data.instructions === 'string' ? data.instructions.trim().slice(0, 500) : '';
  const branchZone = typeof data.branchZone === 'string' ? data.branchZone : '';
  const district = typeof data.district === 'string' ? data.district : '';
  const zone = typeof data.zone === 'string' ? data.zone : '';
  const paymentMethod = ['cod', 'bkash', 'nagad'].includes(data.paymentMethod) ? data.paymentMethod : 'cod';
  const couponCode = typeof data.couponCode === 'string' && data.couponCode.trim() ? data.couponCode.trim().toUpperCase() : null;
  const wantsWallet = !!data.useWallet && !!uid;
  const prescriptionUrl = typeof data.prescriptionUrl === 'string' ? data.prescriptionUrl.slice(0, 1000) : null;
  const distanceKm = Number.isFinite(Number(data.distanceKm)) ? Number(data.distanceKm) : null;
  const deliveryZoneId = typeof data.deliveryZoneId === 'string' ? data.deliveryZoneId.slice(0, 100) : null;
  const deliveryZoneLabel = typeof data.deliveryZoneLabel === 'string' ? data.deliveryZoneLabel.slice(0, 200) : null;
  const etaMinutes = Number.isFinite(Number(data.etaMinutes)) ? Number(data.etaMinutes) : null;
  const customerLat = Number.isFinite(Number(data.customerLat)) ? Number(data.customerLat) : null;
  const customerLng = Number.isFinite(Number(data.customerLng)) ? Number(data.customerLng) : null;

  if (!customerName) throw new HttpsError('invalid-argument', 'নাম প্রয়োজন।');
  if (!PHONE_RE.test(customerPhone)) throw new HttpsError('invalid-argument', 'সঠিক মোবাইল নম্বর প্রয়োজন।');
  if (customerNid && !NID_RE.test(customerNid)) throw new HttpsError('invalid-argument', 'NID ১০ বা ১৩ সংখ্যার হতে হবে।');
  if (address.length < 5) throw new HttpsError('invalid-argument', 'ঠিকানা বিস্তারিত লিখুন।');
  if (!branchZone || !zone || !village || !instructions) throw new HttpsError('invalid-argument', 'ডেলিভারি তথ্য অসম্পূর্ণ।');
  if (!deliveryZoneId) throw new HttpsError('invalid-argument', 'ডেলিভারি জোন নির্বাচন করা হয়নি।');

  // Guest checkout-সহ coupon lookup — cancelOrderSecure-এর মতোই transaction-এর
  // বাইরে query করে ref বের করা হয়, তারপর transaction-এর ভেতরে live অবস্থা verify হয়
  let couponRef = null;
  if (couponCode) {
    const couponQuery = await db.collection('coupons').where('code', '==', couponCode).limit(1).get();
    if (!couponQuery.empty) couponRef = couponQuery.docs[0].ref;
  }

  const orderNo = 'GS-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000);

  const result = await db.runTransaction(async (tx) => {
    // --- সব read আগে (transaction rule) ---
    const productRefs = items.map(it => db.collection('products').doc(it.productId));
    const productSnaps = await Promise.all(productRefs.map(ref => tx.get(ref)));
    const settingSnap = await tx.get(db.collection('setting').doc('delivery'));
    const userRef = wantsWallet ? db.collection('users').doc(uid) : null;
    const userSnap = userRef ? await tx.get(userRef) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    // --- প্রোডাক্ট/স্টক/দাম — সম্পূর্ণ server-side; client কোনো দাম পাঠায় না ---
    let subtotal = 0;
    let itemCount = 0;
    const itemsForOrder = [];
    for (let i = 0; i < items.length; i++) {
      const snap = productSnaps[i];
      if (!snap.exists) throw new HttpsError('failed-precondition', 'কার্টের একটি পণ্য আর পাওয়া যাচ্ছে না। কার্ট আপডেট করুন।');
      const p = snap.data();
      const qty = items[i].qty;
      const stock = Number(p.stock || 0);
      if (stock < qty) {
        throw new HttpsError('failed-precondition', `${p.name || 'পণ্য'}-এর পর্যাপ্ত স্টক নেই (মাত্র ${stock}টি আছে)। কার্ট আপডেট করুন।`);
      }
      const unitPrice = Number(p.salePrice ?? p.price ?? 0);
      subtotal += unitPrice * qty;
      itemCount += qty;
      itemsForOrder.push({ productId: items[i].productId, name: p.name || '', qty, unitPrice });
    }

    // --- শিপিং — server-side setting থেকে হিসাব করা; client কোনো shippingCost পাঠাতে পারে না ---
    const settings = Object.assign({}, DELIVERY_DEFAULTS, settingSnap.exists ? settingSnap.data() : {});
    const shippingCost = calcDeliveryChargeServer(itemCount, subtotal, distanceKm, settings);

    // --- কুপন — live document verify করে discount নিজে হিসাব করা ---
    let appliedCouponCode = null;
    let couponDiscount = 0;
    if (couponRef) {
      if (!couponSnap?.exists) throw new HttpsError('failed-precondition', 'কুপনটি আর পাওয়া যাচ্ছে না।');
      const c = couponSnap.data();
      const expiresAt = c.expiresAt?.toDate ? c.expiresAt.toDate() : (c.expiresAt ? new Date(c.expiresAt) : null);
      const expired = expiresAt && expiresAt < new Date();
      if (c.active === false || expired) throw new HttpsError('failed-precondition', 'কুপনটি আর সক্রিয় নেই।');
      if (c.usageLimit && Number(c.usedCount || 0) >= Number(c.usageLimit)) throw new HttpsError('failed-precondition', 'কুপনের ব্যবহারসীমা শেষ।');
      if (c.minOrder && subtotal < Number(c.minOrder)) throw new HttpsError('failed-precondition', 'এই অর্ডারে কুপনের ন্যূনতম মূল্য পূরণ হয়নি।');
      let disc = c.type === 'percent' ? Math.round(subtotal * Number(c.value || 0) / 100) : Number(c.value || 0);
      if (c.maxDiscount) disc = Math.min(disc, Number(c.maxDiscount));
      couponDiscount = Math.min(Math.max(0, disc), subtotal);
      appliedCouponCode = c.code || couponCode;
    }

    // --- Wallet — live balance থেকে; client কোনো walletUsed পাঠাতে পারে না ---
    const liveWallet = userSnap?.exists ? Math.max(0, Number(userSnap.data().walletBalance || 0)) : 0;
    const payableBeforeWallet = Math.max(0, subtotal + shippingCost - couponDiscount);
    const walletUsed = wantsWallet ? Math.min(liveWallet, payableBeforeWallet) : 0;
    const total = Math.max(0, payableBeforeWallet - walletUsed);
    const paymentStatus = paymentMethod === 'cod' ? 'cod' : 'pending_submission';

    // --- writes পরে ---
    productRefs.forEach((ref, i) => {
      tx.update(ref, {
        stock: admin.firestore.FieldValue.increment(-items[i].qty),
        sold: admin.firestore.FieldValue.increment(items[i].qty)
      });
    });
    if (userRef && walletUsed > 0) {
      tx.update(userRef, { walletBalance: admin.firestore.FieldValue.increment(-walletUsed) });
    }
    if (couponRef && couponDiscount > 0) {
      tx.update(couponRef, { usedCount: admin.firestore.FieldValue.increment(1) });
    }

    const orderRef = db.collection('orders').doc();
    tx.set(orderRef, {
      orderNumber: orderNo, customerName, customerPhone,
      address, village, branchZone, district, zone,
      customerLat, customerLng,
      deliveryZoneId, deliveryZoneLabel,
      distanceKm, etaMinutes,
      prescriptionUrl,
      instructions, paymentMethod, paymentStatus, deliverySlot: 'express',
      items: itemsForOrder,
      subtotal, shippingCost, walletUsed,
      couponCode: appliedCouponCode, couponDiscount, total,
      status: 'pending', driverId: null, driverName: null,
      userId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ⚠️ MT Studio audit fix (NID exposure): customerNid আর মূল order
    // ডকুমেন্টে থাকে না — আগে orders read rule isDriver()-কে পুরো ডকুমেন্ট
    // পড়ার অনুমতি দিতো, তাই ডেলিভারির জন্য অপ্রয়োজনীয় হওয়া সত্ত্বেও প্রতিটি
    // ড্রাইভার প্রতিটি অর্ডারের কাস্টমারের NID দেখতে পারতো। Firestore rules
    // এক ডকুমেন্টের ভেতরে field-level read filter করতে পারে না, তাই NID এখন
    // একটা আলাদা subcollection-এ, যেটা শুধু admin/finance পড়তে পারবে (rules
    // দ্রষ্টব্য) — driver বা অন্য কোনো staff role নয়।
    if (customerNid) {
      tx.set(orderRef.collection('private').doc('contact'), {
        nid: customerNid, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { orderId: orderRef.id, orderNumber: orderNo, subtotal, shippingCost, walletUsed, couponDiscount, total };
  });

  return result;
});

/* ---------------------------------------------------------------------
 * ৪.৫) নিরাপদ, server-side Custom Bazar (কাস্টম বাজার লিস্ট) অর্ডার তৈরি —
 *      MT Studio audit fix
 *
 *      আগে js/custom-bazar.js নিজে সরাসরি orders কালেকশনে addDoc() করার
 *      চেষ্টা করত — advanceAmount:100, paymentMethod ইত্যাদি সব client-trusted
 *      মান দিয়ে। কিন্তু firestore.rules-এ orders create rule সম্পূর্ণ বন্ধ
 *      (allow create: if false, createOrderSecure চালু হওয়ার পর থেকে) — ফলে
 *      হোমপেজে প্রচারিত এই ফিচারটা প্রতিটি গ্রাহকের জন্য সম্পূর্ণ অকার্যকর হয়ে
 *      গিয়েছিল (প্রতিটি সাবমিট silently ব্যর্থ হতো)। এখন createOrderSecure-এর
 *      মতোই একটা dedicated, server-side validated Cloud Function — advance
 *      amount/paymentMethod সার্ভারে ফিক্সড, bkashTrxId ডুপ্লিকেট-চেক করা হয়
 *      (client-side sessionStorage গার্ড সহজেই বাইপাসযোগ্য ছিল)।
 * ------------------------------------------------------------------- */
const BAZAR_TYPE_LABELS = { weekly: 'সাপ্তাহিক', monthly: 'মাসিক', wedding: 'বিয়ের', ramadan: 'রমজানের', qurbani: 'কুরবানির', other: 'অন্যান্য' };

exports.createCustomBazarOrderSecure = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  const data = request.data || {};

  const customerName = typeof data.customerName === 'string' ? data.customerName.trim().slice(0, 120) : '';
  const customerPhone = typeof data.customerPhone === 'string' ? data.customerPhone.trim().replace(/[\s-]/g, '') : '';
  const address = typeof data.address === 'string' ? data.address.trim().slice(0, 500) : '';
  const village = typeof data.village === 'string' ? data.village.trim().slice(0, 200) : '';
  const instructions = typeof data.instructions === 'string' ? data.instructions.trim().slice(0, 500) : '';
  const branchZone = typeof data.branchZone === 'string' ? data.branchZone : '';
  const district = typeof data.district === 'string' ? data.district.slice(0, 100) : '';
  const zone = typeof data.zone === 'string' ? data.zone : '';
  const bazarType = Object.keys(BAZAR_TYPE_LABELS).includes(data.bazarType) ? data.bazarType : 'weekly';
  const bazarList = typeof data.bazarList === 'string' ? data.bazarList.trim().slice(0, 3000) : '';
  const notes = typeof data.notes === 'string' ? data.notes.trim().slice(0, 500) : '';
  const bkashTrxId = typeof data.bkashTrxId === 'string' ? data.bkashTrxId.trim().toUpperCase().slice(0, 50) : '';

  if (!customerName) throw new HttpsError('invalid-argument', 'নাম প্রয়োজন।');
  if (!PHONE_RE.test(customerPhone)) throw new HttpsError('invalid-argument', 'সঠিক মোবাইল নম্বর প্রয়োজন।');
  if (address.length < 5) throw new HttpsError('invalid-argument', 'ঠিকানা বিস্তারিত লিখুন।');
  if (!branchZone || !zone || !village || !instructions) throw new HttpsError('invalid-argument', 'ডেলিভারি তথ্য অসম্পূর্ণ।');
  if (!bazarList) throw new HttpsError('invalid-argument', 'বাজারের লিস্ট দিন।');
  if (bkashTrxId.length < 6) throw new HttpsError('invalid-argument', 'সঠিক bKash ট্রানজেকশন ID দিন।');

  // ডুপ্লিকেট পেমেন্ট গার্ড — server-side (client sessionStorage গার্ড বাইপাস করা সহজ ছিল)
  const dupQuery = await db.collection('orders')
    .where('orderType', '==', 'custom-bazar')
    .where('bkashTrxId', '==', bkashTrxId)
    .limit(1).get();
  if (!dupQuery.empty) {
    throw new HttpsError('already-exists', 'এই ট্রানজেকশন ID দিয়ে ইতিমধ্যে একটি অর্ডার জমা হয়েছে।');
  }

  const orderNo = 'CB-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000);
  const orderRef = db.collection('orders').doc();
  await orderRef.set({
    orderNumber: orderNo, orderType: 'custom-bazar', bazarType, bazarTypeLabel: BAZAR_TYPE_LABELS[bazarType],
    customerName, customerPhone, address, village, instructions, branchZone, district,
    zone, bazarList, notes, bkashTrxId, advanceAmount: 100, paymentMethod: 'bkash+cod',
    billPhotoUrl: null, billAmount: null,
    status: 'pending', userId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { orderId: orderRef.id, orderNumber: orderNo };
});

/* ---------------------------------------------------------------------
 * ৫) নিরাপদ, server-side driver payout request — MT Studio audit fix
 *
 *    আগে driver-app-এর requestDetailedPayout() client-side হিসাব করা
 *    walletBalance-এর বিপরীতে শুধু `amount <= walletBalance` চেক করে সরাসরি
 *    payoutRequests-এ addDoc করত। DevTools দিয়ে সরাসরি এই ফাংশন কল করলে
 *    আসল earning যাচাই না করেই যেকোনো amount পাঠানো যেত। এখন এই ফাংশন
 *    driver-এর delivered orders ও আগের payout — দুটোই Firestore থেকে নিজে
 *    যোগ করে real balance বের করে, এবং orders update rule-এও এখন driver
 *    আর driverEarning ফিল্ড নিজে বদলাতে পারে না (আগে isDriver() unrestricted
 *    ছিল) — তাই earning-এর উৎসও এখন নির্ভরযোগ্য।
 * ------------------------------------------------------------------- */
exports.requestPayoutSecure = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'লগইন করা আবশ্যক।');

  const staffDoc = await db.collection('staff').doc(uid).get();
  const staffData = staffDoc.data();
  if (!staffDoc.exists || staffData?.role !== 'driver') {
    throw new HttpsError('permission-denied', 'শুধুমাত্র ড্রাইভার এই ফিচার ব্যবহার করতে পারবেন।');
  }
  const driverId = String(staffData?.driverId || uid);

  const amount = Math.round(Number(request.data?.amount) * 100) / 100;
  const method = typeof request.data?.method === 'string' ? request.data.method.slice(0, 40) : 'bKash';
  const accountNumber = typeof request.data?.accountNumber === 'string' ? request.data.accountNumber.trim().slice(0, 30) : '';
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError('invalid-argument', 'সঠিক পরিমাণ দিন।');
  }
  if (!accountNumber) {
    throw new HttpsError('invalid-argument', 'অ্যাকাউন্ট/মোবাইল নম্বর প্রয়োজন।');
  }

  // driver-এর real earning ও আগের payout — দুটোই server-side, live Firestore থেকে
  const [ordersSnap, payoutsSnap] = await Promise.all([
    db.collection('orders').where('driverId', '==', driverId).where('status', '==', 'delivered').get(),
    db.collection('payoutRequests').where('driverId', '==', driverId).get()
  ]);
  const earned = ordersSnap.docs.reduce((sum, d) => {
    const o = d.data();
    return sum + Number(o.driverEarning ?? o.driverFee ?? o.shippingCost ?? 0);
  }, 0);
  const paidOrPending = payoutsSnap.docs.reduce((sum, d) => {
    const p = d.data();
    return p.status !== 'rejected' ? sum + Number(p.amount || 0) : sum;
  }, 0);
  const walletBalance = Math.max(0, earned - paidOrPending);

  if (amount > walletBalance) {
    throw new HttpsError('failed-precondition', `আপনার সর্বোচ্চ উত্তোলনযোগ্য ব্যালেন্স ৳${walletBalance}। এর বেশি অনুরোধ করা যাবে না।`);
  }

  const payoutRef = await db.collection('payoutRequests').add({
    driverId, driverName: staffData?.name || '',
    amount, method, accountNumber,
    status: 'processing', createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { payoutId: payoutRef.id, walletBalance: walletBalance - amount };
});

/* ---------------------------------------------------------------------
 * helpers
 * ------------------------------------------------------------------- */
async function collectFcmTokens(uids) {
  const snaps = await Promise.all(uids.map(uid => db.collection('fcmTokens').doc(uid).get()));
  return snaps.filter(s => s.exists && s.data().token).map(s => s.data().token);
}

async function sendMulticast(tokens, notification, data) {
  if (!tokens.length) return;
  try {
    await messaging.sendEachForMulticast({
      tokens,
      notification,
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: { fcmOptions: { link: 'https://www.golapishop.online/myorders' } }
    });
  } catch (e) {
    console.warn('push send failed', e.message);
  }
}

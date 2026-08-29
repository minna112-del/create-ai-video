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
const crypto = require('node:crypto');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

function createGuestAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}
function hashGuestAccessToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}
function guestTokenMatches(storedHash, token) {
  if (typeof storedHash !== 'string' || storedHash.length !== 64 || typeof token !== 'string' || !token) return false;
  const suppliedHash = hashGuestAccessToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(suppliedHash, 'hex'));
  } catch {
    return false;
  }
}

async function canMutateOrder({ tx, orderRef, order, uid, guestAccessToken, allowStaff = false }) {
  if (uid && order.userId === uid) return true;
  if (uid && allowStaff) {
    const staffSnap = await tx.get(db.collection('staff').doc(uid));
    const role = staffSnap.exists ? staffSnap.data()?.role : null;
    if (role === 'admin' || role === 'zone_manager') return true;
  }
  if (order.userId != null) return false;
  const accessSnap = await tx.get(orderRef.collection('private').doc('access'));
  return accessSnap.exists && guestTokenMatches(accessSnap.data()?.guestAccessHash, guestAccessToken);
}

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
  if (!before || !after || before.status === after.status) return;

  // Referral wallet credit is money movement, so keep it server-side and atomic.
  if (after.status === 'delivered' && after.userId) {
    await awardReferralBonusIfEligible(after.userId).catch(err => console.warn('referral bonus failed', err.message));
  }

  if (!after.userId) return; // guest order — কোনো account/token নেই
  const tokenDoc = await db.collection('fcmTokens').doc(after.userId).get();
  if (!tokenDoc.exists || !tokenDoc.data().token) return;

  const label = STATUS_LABEL_BN[after.status] || after.status;
  await sendMulticast([tokenDoc.data().token], {
    title: `📦 ${after.orderNumber || event.params.orderId}`,
    body: label
  }, { type: 'order_status', orderId: event.params.orderId, status: after.status });
});

async function awardReferralBonusIfEligible(userId) {
  const BONUS = 20;
  return db.runTransaction(async tx => {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return false;
    const user = userSnap.data();
    if (!user.referredBy || user.referralBonusGiven === true || user.referredBy === userId) return false;

    const referrerRef = db.collection('users').doc(user.referredBy);
    const referrerSnap = await tx.get(referrerRef);
    if (!referrerSnap.exists) return false;

    tx.update(userRef, {
      walletBalance: admin.firestore.FieldValue.increment(BONUS),
      referralBonusGiven: true,
      referralBonusAt: admin.firestore.FieldValue.serverTimestamp()
    });
    tx.update(referrerRef, {
      walletBalance: admin.firestore.FieldValue.increment(BONUS),
      referralRewardAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  });
}

/* ---------------------------------------------------------------------
 * ৩) নিরাপদ, server-side order cancel — wallet + coupon + stock একসাথে
 *    একটাই transaction-এ atomic ভাবে refund হয় (Admin SDK, rules bypass
 *    করে না — নিজেই owner/staff verify করে)
 * ------------------------------------------------------------------- */
exports.cancelOrderSecure = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  const orderId = request.data?.orderId;
  const guestAccessToken = typeof request.data?.guestAccessToken === 'string' ? request.data.guestAccessToken : '';
  const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim().slice(0, 500) : null;
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpsError('invalid-argument', 'orderId প্রয়োজন।');
  }

  const result = await db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'অর্ডার পাওয়া যায়নি।');
    const order = orderSnap.data();

    const authorized = await canMutateOrder({ tx, orderRef, order, uid, guestAccessToken, allowStaff: true });
    if (!authorized) {
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
      walletRefunded: Number(order.walletUsed) || 0,
      items: Array.isArray(order.items) ? order.items.map(it => ({ productId: it.productId, qty: Number(it.qty) || 0 })) : []
    };
  });

  return result;
});

/* ---------------------------------------------------------------------
 * ৩.৫) Secure customer profile bootstrap + referral resolution.
 *      Client-authenticated users cannot create arbitrary wallet balances.
 * ------------------------------------------------------------------- */
exports.createCustomerProfileSecure = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'লগইন করা আবশ্যক।');

  const data = request.data || {};
  const name = typeof data.name === 'string' ? data.name.trim().slice(0, 120) : 'গ্রাহক';
  const phone = typeof data.phone === 'string' ? data.phone.trim().replace(/[\s-]/g, '').slice(0, 30) : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase().slice(0, 254) : '';
  const referralInput = typeof data.referralCode === 'string' ? data.referralCode.trim().toUpperCase().slice(0, 20) : '';
  if (name.length < 2) throw new HttpsError('invalid-argument', 'সঠিক নাম দিন।');
  if (phone && !PHONE_RE.test(phone)) throw new HttpsError('invalid-argument', 'সঠিক মোবাইল নম্বর দিন।');

  const userRef = db.collection('users').doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    const profile = existing.data();
    return { created: false, referralCode: profile.referralCode || '' };
  }

  let referredBy = null;
  if (referralInput) {
    const referralSnap = await db.collection('users').where('referralCode', '==', referralInput).limit(1).get();
    if (!referralSnap.empty && referralSnap.docs[0].id !== uid) referredBy = referralSnap.docs[0].id;
  }

  let referralCode = uid.slice(0, 6).toUpperCase();
  for (const size of [6, 8, 10, 12]) {
    const candidate = uid.slice(0, size).toUpperCase();
    const collision = await db.collection('users').where('referralCode', '==', candidate).limit(1).get();
    if (collision.empty) { referralCode = candidate; break; }
  }

  await userRef.create({
    name,
    email: email || request.auth.token?.email || '',
    phone: phone || request.auth.token?.phone_number || '',
    role: 'customer',
    referralCode,
    referredBy,
    referralBonusGiven: false,
    walletBalance: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { created: true, referralCode, referralApplied: !!referredBy };
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

const SERVICE_AREA_DEFAULTS = {
  zone_a: ['চরমটুয়া','দাদপুর','নোয়ান্নই','কাদির হানিফ','বিনোদপুর','নোয়াখালী','ধর্মপুর','এওজবালিয়া','কালা দরাপ','অশ্বদিয়া','নেয়াজপুর','আন্ডারচর'],
  zone_b: ['আমান উল্যাপুর','গোপালপুর','জিরতলী','আলাইয়ারপুর','ছয়ানী','রাজগঞ্জ','একলাশপুর','মিরওয়ারিশপুর','নরোত্তমপুর','দূর্গাপুর','কুতুবপুর','রসুলপুর','হাজিপুর','শরীফপুর','কাদিরপুর'],
  zone_c: []
};
const SERVICE_BRANCH_DEFAULTS = {
  zone_a: { label:'Zone - A', lat:22.8710, lng:91.0996, active:true, bkashNumber:'01627010060', nagadNumber:'01627010060' },
  zone_b: { label:'Zone - B', lat:22.9412, lng:91.1119, active:true, bkashNumber:'01612057371', nagadNumber:'01310006959' },
  zone_c: { label:'Zone - C', lat:null, lng:null, active:false, bkashNumber:'', nagadNumber:'' }
};
const SERVICE_DELIVERY_DEFAULTS = {
  zone_a:[{id:'zone_a_near',label:'নিকটবর্তী ডেলিভারি সীমা',radiusKm:3,fee:30},{id:'zone_a_mid',label:'মাঝারি ডেলিভারি সীমা',radiusKm:7,fee:50},{id:'zone_a_far',label:'সর্বোচ্চ ডেলিভারি সীমা',radiusKm:12,fee:80}],
  zone_b:[{id:'zone_b_near',label:'নিকটবর্তী ডেলিভারি সীমা',radiusKm:3,fee:30},{id:'zone_b_mid',label:'মাঝারি ডেলিভারি সীমা',radiusKm:7,fee:50},{id:'zone_b_far',label:'সর্বোচ্চ ডেলিভারি সীমা',radiusKm:12,fee:80}],
  zone_c:[]
};
function normalizeServiceZoneId(value) {
  return value;
}
function haversineKmServer(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function normalizeServerTierLabel(label, index) {
  const text = String(label || '').trim();
  if (/^Zone\s*[- ]?A\b/i.test(text)) return 'নিকটবর্তী ডেলিভারি সীমা';
  if (/^Zone\s*[- ]?B\b/i.test(text)) return 'মাঝারি ডেলিভারি সীমা';
  if (/^Zone\s*[- ]?C\b/i.test(text)) return 'সর্বোচ্চ ডেলিভারি সীমা';
  return text || ['নিকটবর্তী ডেলিভারি সীমা','মাঝারি ডেলিভারি সীমা','সর্বোচ্চ ডেলিভারি সীমা'][index] || 'ডেলিভারি সীমা';
}
function resolveDeliveryServer({ branchZone, areaName, deliveryZoneId, customerLat, customerLng, branches, zones, serviceAreas, subtotal, settings }) {
  const normalizedBranchZone = normalizeServiceZoneId(branchZone);
  if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng) || Math.abs(customerLat) > 90 || Math.abs(customerLng) > 180) {
    throw new HttpsError('invalid-argument', 'সঠিক ম্যাপ লোকেশন প্রয়োজন।');
  }
  const branch = branches?.[normalizedBranchZone];
  if (!branch || branch.active === false) throw new HttpsError('failed-precondition', 'এই ডেলিভারি জোনটি বর্তমানে বন্ধ আছে।');
  const allowedAreas = Array.isArray(serviceAreas?.[normalizedBranchZone]) ? serviceAreas[normalizedBranchZone] : [];
  if (!areaName || !allowedAreas.includes(areaName)) throw new HttpsError('failed-precondition', 'এই এরিয়ায় এখনো Golapi Shop-এর ডেলিভারি চালু হয়নি।');

  const branchEntries = Object.entries(branches || {})
    .filter(([, b]) => b?.active !== false && Number.isFinite(Number(b?.lat)) && Number.isFinite(Number(b?.lng)))
    .map(([id,b]) => [normalizeServiceZoneId(id), b]);
  if (!branchEntries.length) throw new HttpsError('failed-precondition', 'ডেলিভারি জোনের লোকেশন কনফিগার করা নেই।');
  const ranked = branchEntries.map(([id, b]) => ({ id, branch: b, distanceKm: haversineKmServer(customerLat, customerLng, Number(b.lat), Number(b.lng)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = ranked[0];
  if (nearest.id !== normalizedBranchZone) throw new HttpsError('failed-precondition', 'ম্যাপ লোকেশন ও নির্বাচিত জোন মিলছে না। লোকেশন আবার কনফার্ম করুন।');

  const branchZones = Array.isArray(zones?.[normalizedBranchZone]) ? zones[normalizedBranchZone] : [];
  const matchedIndex = branchZones
    .map((z, index) => ({ z, index }))
    .filter(({z}) => Number.isFinite(Number(z?.radiusKm)) && nearest.distanceKm <= Number(z.radiusKm))
    .sort((a, b) => Number(a.z.radiusKm) - Number(b.z.radiusKm))[0];
  if (!matchedIndex) throw new HttpsError('failed-precondition', 'এই লোকেশন বর্তমানে আমাদের ডেলিভারি সীমার বাইরে।');
  const matched = matchedIndex.z;
  if (String(matched.id || '') !== String(deliveryZoneId || '')) throw new HttpsError('failed-precondition', 'ডেলিভারি সীমা পরিবর্তিত হয়েছে। লোকেশন আবার কনফার্ম করুন।');
  const freeAbove = Number(settings?.freeAboveSubtotal || 0);
  const zoneFee = Math.max(0, Number(matched.fee || 0));
  return {
    branchZone: normalizedBranchZone,
    distanceKm: Math.round(nearest.distanceKm * 100) / 100,
    deliveryZoneId: String(matched.id || ''),
    deliveryZoneLabel: normalizeServerTierLabel(matched.label, matchedIndex.index),
    shippingCost: freeAbove > 0 && subtotal >= freeAbove ? 0 : zoneFee
  };
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
  const deliveryZoneId = typeof data.deliveryZoneId === 'string' ? data.deliveryZoneId.slice(0, 100) : null;
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
  const guestAccessToken = uid ? null : createGuestAccessToken();
  const guestAccessHash = guestAccessToken ? hashGuestAccessToken(guestAccessToken) : null;

  const result = await db.runTransaction(async (tx) => {
    // --- সব read আগে (transaction rule) ---
    const productRefs = items.map(it => db.collection('products').doc(it.productId));
    const productSnaps = await Promise.all(productRefs.map(ref => tx.get(ref)));
    const settingSnap = await tx.get(db.collection('setting').doc('delivery'));
    const branchesSnap = await tx.get(db.collection('setting').doc('branches'));
    const zonesSnap = await tx.get(db.collection('setting').doc('delivery_zones'));
    const serviceAreasSnap = await tx.get(db.collection('setting').doc('service_areas'));
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

    // --- শিপিং — live branch + delivery zone + GPS server-side verify করে হিসাব ---
    const settings = Object.assign({}, DELIVERY_DEFAULTS, settingSnap.exists ? settingSnap.data() : {});
    const branches = Object.assign({}, SERVICE_BRANCH_DEFAULTS, branchesSnap.exists ? (branchesSnap.data().branches || {}) : {});
    const zones = Object.assign({}, SERVICE_DELIVERY_DEFAULTS, zonesSnap.exists ? (zonesSnap.data().zones || {}) : {});
    const serviceAreas = Object.assign({}, SERVICE_AREA_DEFAULTS, serviceAreasSnap.exists ? (serviceAreasSnap.data().zones || {}) : {});
    const delivery = resolveDeliveryServer({ branchZone, areaName: zone, deliveryZoneId, customerLat, customerLng, branches, zones, serviceAreas, subtotal, settings });
    const shippingCost = delivery.shippingCost;

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
      address, village, branchZone: delivery.branchZone, district, zone,
      customerLat, customerLng,
      deliveryZoneId: delivery.deliveryZoneId, deliveryZoneLabel: delivery.deliveryZoneLabel,
      distanceKm: delivery.distanceKm, etaMinutes: Math.max(10, Math.round(delivery.distanceKm * 3.5 + 10)),
      prescriptionUrl,
      instructions, paymentMethod, paymentStatus, deliverySlot: 'express',
      items: itemsForOrder,
      subtotal, shippingCost, walletUsed,
      couponCode: appliedCouponCode, couponDiscount, total,
      status: 'pending', driverId: null, driverName: null,
      userId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (guestAccessHash) {
      tx.set(orderRef.collection('private').doc('access'), {
        guestAccessHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

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

  return { ...result, ...(guestAccessToken ? { guestAccessToken } : {}) };
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

  const normalizedBazarZone = normalizeServiceZoneId(branchZone);
  const [bazarAreasSnap, bazarBranchesSnap] = await Promise.all([
    db.collection('setting').doc('service_areas').get(),
    db.collection('setting').doc('branches').get()
  ]);
  const bazarAreas = Object.assign({}, SERVICE_AREA_DEFAULTS, bazarAreasSnap.exists ? (bazarAreasSnap.data().zones || {}) : {});
  const bazarBranches = Object.assign({}, SERVICE_BRANCH_DEFAULTS, bazarBranchesSnap.exists ? (bazarBranchesSnap.data().branches || {}) : {});
  if (bazarBranches[normalizedBazarZone]?.active === false || !Array.isArray(bazarAreas[normalizedBazarZone]) || !bazarAreas[normalizedBazarZone].includes(zone)) {
    throw new HttpsError('failed-precondition', 'এই এরিয়ায় এখনো Golapi Shop-এর ডেলিভারি চালু হয়নি।');
  }

  // Legacy orders used the transaction id on the root document; reject those first.
  const dupQuery = await db.collection('orders')
    .where('orderType', '==', 'custom-bazar')
    .where('bkashTrxId', '==', bkashTrxId)
    .limit(1).get();
  if (!dupQuery.empty) {
    throw new HttpsError('already-exists', 'এই ট্রানজেকশন ID দিয়ে ইতিমধ্যে একটি অর্ডার জমা হয়েছে।');
  }

  // New orders use a hash-keyed claim document inside the same transaction, closing
  // the query-then-write race. The raw transaction id is kept private from drivers.
  const claimId = hashGuestAccessToken(`custom-bazar:bkash:${bkashTrxId}`);
  const claimRef = db.collection('payment_claims').doc(claimId);
  const orderRef = db.collection('orders').doc();
  const orderNo = 'CB-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900000) + 100000);
  await db.runTransaction(async tx => {
    const claimSnap = await tx.get(claimRef);
    if (claimSnap.exists) {
      throw new HttpsError('already-exists', 'এই ট্রানজেকশন ID দিয়ে ইতিমধ্যে একটি অর্ডার জমা হয়েছে।');
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.create(claimRef, { orderId: orderRef.id, method: 'bkash', purpose: 'custom-bazar', createdAt: now });
    tx.set(orderRef, {
      orderNumber: orderNo, orderType: 'custom-bazar', bazarType, bazarTypeLabel: BAZAR_TYPE_LABELS[bazarType],
      customerName, customerPhone, address, village, instructions, branchZone: normalizedBazarZone, district,
      zone, bazarList, notes, advanceAmount: 100, paymentMethod: 'bkash+cod',
      billPhotoUrl: null, billAmount: null,
      status: 'pending', userId: uid, createdAt: now
    });
    tx.set(orderRef.collection('private').doc('payment'), { bkashTrxId, advanceAmount: 100, method: 'bkash', createdAt: now });
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
/* ---------------------------------------------------------------------
 * ৪.৬) Secure customer/guest payment mutation and pending-payment lookup.
 *      Guest orders are authorized with a one-time random token whose SHA-256
 *      hash is stored under orders/{id}/private/access. Firestore rules no
 *      longer allow anonymous direct order mutations.
 * ------------------------------------------------------------------- */
exports.updateOrderPaymentSecure = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  const data = request.data || {};
  const orderId = typeof data.orderId === 'string' ? data.orderId : '';
  const guestAccessToken = typeof data.guestAccessToken === 'string' ? data.guestAccessToken : '';
  const action = data.action === 'cod' ? 'cod' : data.action === 'submit' ? 'submit' : '';
  if (!orderId || !action) throw new HttpsError('invalid-argument', 'সঠিক অর্ডার ও action প্রয়োজন।');

  return db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'অর্ডার পাওয়া যায়নি।');
    const order = orderSnap.data();
    const authorized = await canMutateOrder({ tx, orderRef, order, uid, guestAccessToken });
    if (!authorized) throw new HttpsError('permission-denied', 'এই অর্ডার পরিবর্তনের অনুমতি নেই।');
    if (!['pending','confirmed','packed','assigned'].includes(order.status)) {
      throw new HttpsError('failed-precondition', 'এই অবস্থায় পেমেন্ট পরিবর্তন করা যাবে না।');
    }

    if (action === 'cod') {
      tx.update(orderRef, {
        paymentMethod: 'cod',
        paymentStatus: 'cod',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { paymentMethod: 'cod', paymentStatus: 'cod' };
    }

    const method = ['bkash','nagad'].includes(data.method) ? data.method : '';
    const trxId = typeof data.trxId === 'string' ? data.trxId.trim().toUpperCase().slice(0, 64) : '';
    if (!method || !/^[A-Z0-9]{8,64}$/.test(trxId)) {
      throw new HttpsError('invalid-argument', 'সঠিক পেমেন্ট মাধ্যম ও ট্রানজেকশন ID দিন।');
    }
    tx.update(orderRef, {
      paymentMethod: method,
      paymentStatus: 'paid_pending_verification',
      paymentTrxId: trxId,
      paymentVerifiedAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { paymentMethod: method, paymentStatus: 'paid_pending_verification' };
  });
});

exports.getOrderPaymentStateSecure = onCall(async (request) => {
  const uid = request.auth?.uid || null;
  const orderId = typeof request.data?.orderId === 'string' ? request.data.orderId : '';
  const guestAccessToken = typeof request.data?.guestAccessToken === 'string' ? request.data.guestAccessToken : '';
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId প্রয়োজন।');

  return db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'অর্ডার পাওয়া যায়নি।');
    const order = orderSnap.data();
    const authorized = await canMutateOrder({ tx, orderRef, order, uid, guestAccessToken });
    if (!authorized) throw new HttpsError('permission-denied', 'এই অর্ডার দেখার অনুমতি নেই।');
    return {
      orderNumber: order.orderNumber || '',
      status: order.status || '',
      paymentMethod: order.paymentMethod || '',
      paymentStatus: order.paymentStatus || ''
    };
  });
});

exports.getStaffDirectorySecure = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'লগইন করা আবশ্যক।');
  const self = await db.collection('staff').doc(uid).get();
  if (!self.exists) throw new HttpsError('permission-denied', 'Staff account প্রয়োজন।');

  const snap = await db.collection('staff').get();
  const staff = snap.docs.map(d => {
    const v = d.data() || {};
    return {
      uid: d.id,
      name: String(v.name || ''),
      nameEn: String(v.nameEn || ''),
      employeeId: String(v.employeeId || ''),
      role: String(v.role || ''),
      designation: String(v.designation || ''),
      department: String(v.department || ''),
      branchId: String(v.branchId || ''),
      branchCode: String(v.branchCode || ''),
      branchName: String(v.branchName || ''),
      workspaceName: String(v.workspaceName || ''),
      status: String(v.status || ''),
      active: v.active !== false,
      photoURL: String(v.photoURL || v.photoUrl || v.avatar || ''),
      shiftStart: String(v.shiftStart || ''),
      shiftHours: Number(v.shiftHours || 8)
    };
  });
  return { staff };
});

exports.updateDriverOrderSecure = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'লগইন করা আবশ্যক।');

  const orderId = typeof request.data?.orderId === 'string' ? request.data.orderId.trim() : '';
  const action = typeof request.data?.action === 'string' ? request.data.action.trim() : '';
  if (!orderId || !['accept', 'decline', 'advance'].includes(action)) {
    throw new HttpsError('invalid-argument', 'সঠিক orderId ও action প্রয়োজন।');
  }

  const staffRef = db.collection('staff').doc(uid);
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async (tx) => {
    const [staffSnap, orderSnap] = await Promise.all([tx.get(staffRef), tx.get(orderRef)]);
    if (!staffSnap.exists || staffSnap.data()?.role !== 'driver' || staffSnap.data()?.active === false ||
        ['inactive', 'suspended', 'resigned'].includes(String(staffSnap.data()?.status || ''))) {
      throw new HttpsError('permission-denied', 'সক্রিয় ড্রাইভার অ্যাকাউন্ট প্রয়োজন।');
    }
    if (!orderSnap.exists) throw new HttpsError('not-found', 'অর্ডার পাওয়া যায়নি।');

    const staff = staffSnap.data();
    const driverId = String(staff?.driverId || uid);
    const order = orderSnap.data();
    if (![driverId, uid].includes(String(order.driverId || ''))) {
      throw new HttpsError('permission-denied', 'এই অর্ডারটি আপনার জন্য অ্যাসাইন করা নয়।');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const current = String(order.status || '');
    let patch;

    if (action === 'accept') {
      if (current !== 'assigned' || order.driverAccepted === true) {
        throw new HttpsError('failed-precondition', 'এই অর্ডারটি এখন গ্রহণ করা যাবে না।');
      }
      patch = { driverAccepted: true, acceptedAt: now, updatedAt: now };
    } else if (action === 'decline') {
      // A driver may release an order only before pickup has started.
      if (current !== 'assigned') {
        throw new HttpsError('failed-precondition', 'পিকআপ শুরু হওয়ার পর অর্ডার ছাড়া যাবে না।');
      }
      patch = {
        status: 'confirmed', driverId: null, driverName: null, driverAccepted: false,
        rejectedAt: now, updatedAt: now
      };
    } else {
      if (order.driverAccepted !== true) {
        throw new HttpsError('failed-precondition', 'আগে অর্ডারটি গ্রহণ করুন।');
      }
      const transitions = {
        assigned: { status: 'packed' },
        packed: { status: 'picked_up', pickedUpAt: now },
        picked_up: { status: 'in_transit', startedDeliveryAt: now },
        in_transit: { status: 'delivered', deliveredAt: now }
      };
      patch = transitions[current];
      if (!patch) throw new HttpsError('failed-precondition', 'এই স্ট্যাটাস থেকে পরবর্তী ধাপে যাওয়া যাবে না।');
      patch.updatedAt = now;
    }

    tx.update(orderRef, patch);
    return { orderId, status: patch.status || current, action };
  });
});

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

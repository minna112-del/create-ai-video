import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../lib/firebase';
import { TabType, Language, DriverProfile, Hotspot, Order, TipNotification, PreferencesState, EarningsDay, PayoutTransaction } from '../types';
import { playIncomingOrderSound, playCompletedTripSound, playCashOutSound } from '../lib/sound';

interface DriverContextType {
  authReady: boolean; currentUser: User | null; driverId: string | null; authError: string | null;
  login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>;
  isOnline: boolean; setIsOnline: (online: boolean) => void;
  language: Language; setLanguage: (lang: Language) => void;
  activeTab: TabType; setActiveTab: (tab: TabType) => void;
  profile: DriverProfile; updateProfile: (updates: Partial<DriverProfile>) => void;
  preferences: PreferencesState; updatePreferences: (key: keyof PreferencesState, val: unknown) => void; resetPreferences: () => void;
  hotspots: Hotspot[]; driverLocation: [number, number] | null; activeOrder: Order | null;
  acceptOrder: () => void; declineOrder: () => void; advanceOrderStatus: () => void; cancelActiveOrder: () => void;
  tipNotifications: TipNotification[]; sendThanksForTip: (id: string) => void; deleteTipNotification: (id: string) => void; clearAllInbox: () => void;
  earningsDays: EarningsDay[]; payoutTransactions: PayoutTransaction[];
  viewMode: 'mobile' | 'dashboard'; setViewMode: (mode: 'mobile' | 'dashboard') => void;
  showPreferencesModal: boolean; setShowPreferencesModal: (show: boolean) => void;
  showCashOutModal: boolean; setShowCashOutModal: (show: boolean) => void;
  showProfileModal: boolean; setShowProfileModal: (show: boolean) => void;
  unableOnlineMessage: string | null; setUnableOnlineMessage: (msg: string | null) => void;
  requestInstantPayout: () => void;
  requestDetailedPayout: (amount: number, method: PayoutTransaction['method'], accountNumber: string) => void;
  isPayoutSuccess: boolean;
}

const defaultProfile: DriverProfile = {
  name: 'ড্রাইভার', nameEn: 'Driver', phone: '', tier: 'গোল্ড', tierEn: 'Gold', avatar: '/icons/driver_logo.webp',
  rating: 0, acceptanceRate: 0, cancellationRate: 0, totalTrips: 0, walletBalance: 0,
  todayEarnings: 0, weeklyEarnings: 0, points: 0, vehicleType: ''
};
const defaultPreferences: PreferencesState = {
  acceptAllTrips: true, acceptDeliveries: true, acceptShopAndDeliver: true, acceptCash: true,
  maxDistanceKm: 10, noLimitDistance: true, shopAndDeliver: true, insulatedBagVerified: false
};
const DriverContext = createContext<DriverContextType | undefined>(undefined);

const moneyNumber = (value: unknown) => Number(value || 0);
const timestampMs = (value: any) => value?.toMillis?.() || value?.seconds * 1000 || new Date(value || 0).getTime() || 0;
const numericCoord = (value: unknown) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const coordPair = (lat: unknown, lng: unknown): [number, number] | null => {
  const latitude = numericCoord(lat); const longitude = numericCoord(lng);
  return latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ? null : [latitude, longitude];
};
const statusToUi = (status: string, accepted?: boolean): Order['status'] => {
  if (status === 'assigned' && !accepted) return 'incoming';
  if (status === 'assigned') return 'picking_up';
  if (status === 'packed') return 'verifying';
  if (status === 'picked_up') return 'delivering';
  if (status === 'in_transit') return 'arrived';
  if (status === 'delivered') return 'completed';
  return 'incoming';
};
const uiToStatus: Record<Order['status'], string> = {
  idle: 'assigned', incoming: 'assigned', picking_up: 'packed', verifying: 'picked_up',
  delivering: 'in_transit', arrived: 'delivered', completed: 'delivered'
};
const mapOrder = (id: string, data: any): Order => {
  const items = Array.isArray(data.items) ? data.items.map((item: any, index: number) => ({
    id: String(item.id || item.productId || index), name: String(item.name || item.title || 'পণ্য'),
    quantity: Number(item.quantity || item.qty || 1), price: moneyNumber(item.price)
  })) : [];
  const address = [data.village, data.zone, data.district, data.address].filter(Boolean).join(', ');
  return {
    id, restaurantName: data.storeName || data.shopName || 'Golapi Shop',
    restaurantAddress: data.pickupAddress || data.branchAddress || data.branchZone || 'Golapi Shop শাখা',
    customerName: data.customerName || 'কাস্টমার', customerCode: data.orderNumber || id.slice(-6).toUpperCase(),
    customerAddress: address || 'ঠিকানা দেওয়া হয়নি', customerPhone: data.customerPhone || '',
    itemCount: items.reduce((total: number, item: any) => total + item.quantity, 0) || Number(data.itemCount || 0),
    items, businessNote: data.instructions || data.note || '',
    estimatedEarnings: moneyNumber(data.driverEarning ?? data.driverFee ?? data.shippingCost),
    distanceFt: 0, distanceFormatted: data.distanceFormatted || '', estTimeMin: Number(data.estTimeMin || 0),
    pickupCoords: coordPair(data.pickupLat ?? data.branchLat, data.pickupLng ?? data.branchLng),
    dropoffCoords: coordPair(data.customerLat ?? data.lat, data.customerLng ?? data.lng),
    status: statusToUi(data.status, data.driverAccepted)
  };
};

export const DriverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false); const [currentUser, setCurrentUser] = useState<User | null>(null); const [authError, setAuthError] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null); const [profile, setProfile] = useState<DriverProfile>(defaultProfile);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]); const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [isOnline, setOnline] = useState(false); const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('golapi_driver_lang') as Language) || 'bn');
  const [activeTab, setActiveTab] = useState<TabType>('home'); const [preferences, setPreferences] = useState<PreferencesState>(() => { try { return JSON.parse(localStorage.getItem('golapi_driver_preferences') || 'null') || defaultPreferences; } catch { return defaultPreferences; } });
  const [activeOrder, setActiveOrder] = useState<Order | null>(null); const [activeOrderId, setActiveOrderId] = useState<string | null>(null); const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [payoutTransactions, setPayoutTransactions] = useState<PayoutTransaction[]>([]); const [viewMode, setViewMode] = useState<'mobile' | 'dashboard'>('mobile');
  const [showPreferencesModal, setShowPreferencesModal] = useState(false); const [showCashOutModal, setShowCashOutModal] = useState(false); const [showProfileModal, setShowProfileModal] = useState(false);
  const [unableOnlineMessage, setUnableOnlineMessage] = useState<string | null>(null); const [isPayoutSuccess, setIsPayoutSuccess] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async user => {
    setAuthError(null); setCurrentUser(user);
    if (!user) { setDriverId(null); setProfile(defaultProfile); setRawOrders([]); setActiveOrder(null); setAuthReady(true); return; }
    try {
      const staff = await getDoc(doc(db, 'staff', user.uid));
      const staffData = staff.data();
      if (!staff.exists() || staffData?.role !== 'driver' || staffData?.active === false || ['inactive', 'suspended', 'resigned'].includes(staffData?.status)) {
        await signOut(auth); setAuthError('এই অ্যাকাউন্টটি সক্রিয় অনুমোদিত ড্রাইভার অ্যাকাউন্ট নয়।'); setAuthReady(true); return;
      }
      const id = String(staffData?.driverId || user.uid); setDriverId(id);
      const driverSnap = await getDoc(doc(db, 'drivers', id)); const driver = driverSnap.data() || {};
      setDriverLocation(coordPair(driver.lat, driver.lng));
      setPreferences({ ...defaultPreferences, ...(driver.preferences || {}) });
      setProfile({
        ...defaultProfile, name: staffData?.name || driver.name || 'ড্রাইভার', nameEn: staffData?.nameEn || staffData?.name || driver.nameEn || driver.name || 'Driver',
        phone: driver.phone || staffData?.phone || '',
        avatar: staffData?.photoURL || staffData?.photoUrl || staffData?.photo || staffData?.avatar || driver.avatar || driver.photoURL || '',
        rating: Number(driver.rating || 0), acceptanceRate: Number(driver.acceptanceRate || 0), cancellationRate: Number(driver.cancellationRate || 0),
        points: Number(driver.points || 0), vehicleType: driver.vehicleType || '', tier: driver.tier || 'গোল্ড', tierEn: driver.tierEn || 'Gold'
      });
      setOnline(driver.online === true); setAuthReady(true);
    } catch (error) { console.error(error); setAuthError('ড্রাইভার তথ্য লোড করা যায়নি।'); setAuthReady(true); }
  }), []);

  useEffect(() => onSnapshot(doc(db, 'setting', 'branches'), snapshot => {
    const branches = snapshot.data()?.branches || {};
    setHotspots(Object.entries(branches).flatMap(([id, value]: [string, any]) => {
      const coords = coordPair(value?.lat, value?.lng);
      return coords ? [{ id, name: value.label || value.name || id, lat: coords[0], lng: coords[1], driversCount: Number(value.onlineDrivers || 0), surgeMultiplier: value.statusLabel || 'সার্ভিস জোন' }] : [];
    }));
  }, error => console.error('Branch sync failed', error)), []);

  useEffect(() => {
    if (!driverId) return;
    return onSnapshot(query(collection(db, 'orders'), where('driverId', '==', driverId), limit(300)), snapshot => {
      const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a: any, b: any) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
      setRawOrders(rows);
      const live = rows.find((order: any) => !['delivered', 'cancelled'].includes(order.status));
      if (live) {
        const mapped = mapOrder(live.id, live);
        setActiveOrder(previous => { if ((!previous || previous.id !== mapped.id) && mapped.status === 'incoming') playIncomingOrderSound(); return mapped; });
        setActiveOrderId(live.id);
      } else { setActiveOrder(null); setActiveOrderId(null); }
    }, error => { console.error(error); setUnableOnlineMessage('অর্ডার সিঙ্ক করা যাচ্ছে না। ইন্টারনেট সংযোগ পরীক্ষা করুন।'); });
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    return onSnapshot(query(collection(db, 'payoutRequests'), where('driverId', '==', driverId), limit(100)), snapshot => {
      const rows = snapshot.docs.map(item => {
        const data: any = item.data(); const createdAtMs = timestampMs(data.createdAt) || Date.now();
        const status: PayoutTransaction['status'] = data.status === 'completed' ? 'completed' : data.status === 'rejected' ? 'rejected' : 'processing';
        return { createdAtMs, transaction: { id: item.id, amount: Number(data.amount || 0), method: data.method || 'bKash', accountNumber: data.accountNumber || '', timestamp: new Date(createdAtMs).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US'), status } as PayoutTransaction };
      }).sort((a, b) => b.createdAtMs - a.createdAtMs).map(item => item.transaction);
      setPayoutTransactions(rows);
    });
  }, [driverId, language]);

  useEffect(() => {
    if (!driverId || !activeOrderId || !['delivering', 'arrived'].includes(activeOrder?.status || '') || !navigator.geolocation) return;
    let lastWrite = 0;
    const watchId = navigator.geolocation.watchPosition(position => {
      const now = Date.now(); if (now - lastWrite < 15000) return; lastWrite = now;
      const location: [number, number] = [position.coords.latitude, position.coords.longitude]; setDriverLocation(location);
      const shared = { lat: location[0], lng: location[1], locationUpdatedAt: serverTimestamp(), lastSeen: serverTimestamp() };
      updateDoc(doc(db, 'orders', activeOrderId), { driverLat: location[0], driverLng: location[1], driverAccuracy: position.coords.accuracy, locationUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(console.error);
      updateDoc(doc(db, 'drivers', driverId), shared).catch(console.error);
    }, () => setUnableOnlineMessage('লাইভ লোকেশনের অনুমতি পাওয়া যায়নি।'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverId, activeOrderId, activeOrder?.status]);

  useEffect(() => localStorage.setItem('golapi_driver_lang', language), [language]);
  useEffect(() => localStorage.setItem('golapi_driver_preferences', JSON.stringify(preferences)), [preferences]);

  const delivered = useMemo(() => rawOrders.filter((order: any) => order.status === 'delivered'), [rawOrders]);
  const earningsDays = useMemo<EarningsDay[]>(() => {
    const days: EarningsDay[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - offset); const next = new Date(date); next.setDate(next.getDate() + 1);
      const rows = delivered.filter((order: any) => { const at = timestampMs(order.deliveredAt || order.updatedAt || order.createdAt); return at >= date.getTime() && at < next.getTime(); });
      const activeMs = rows.reduce((total: number, order: any) => total + Math.max(0, timestampMs(order.deliveredAt || order.updatedAt) - timestampMs(order.pickedUpAt || order.acceptedAt || order.assignedAt)), 0);
      days.push({ dayName: new Intl.DateTimeFormat('bn-BD', { weekday: 'short' }).format(date), dayNameEn: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date), dateNum: new Intl.DateTimeFormat('bn-BD', { day: '2-digit' }).format(date), amount: rows.reduce((total: number, order: any) => total + moneyNumber(order.driverEarning ?? order.driverFee ?? order.shippingCost), 0), onlineHours: 0, activeHours: Math.round(activeMs / 360000) / 10, trips: rows.length });
    }
    return days;
  }, [delivered]);
  const computedProfile = useMemo(() => {
    const paidOrPending = payoutTransactions.filter(payout => payout.status !== 'rejected').reduce((total, payout) => total + payout.amount, 0);
    const earned = delivered.reduce((total: number, order: any) => total + moneyNumber(order.driverEarning ?? order.driverFee ?? order.shippingCost), 0);
    return { ...profile, totalTrips: delivered.length, todayEarnings: earningsDays.at(-1)?.amount || 0, weeklyEarnings: earningsDays.reduce((total, day) => total + day.amount, 0), walletBalance: Math.max(0, earned - paidOrPending) };
  }, [profile, delivered, earningsDays, payoutTransactions]);
  const tipNotifications = useMemo<TipNotification[]>(() => delivered.filter((order: any) => moneyNumber(order.tipAmount ?? order.driverTip) > 0 && order.driverNotificationHidden !== true).map((order: any) => {
    const at = timestampMs(order.deliveredAt || order.updatedAt || order.createdAt); const date = new Date(at || Date.now());
    return { id: order.id, amount: moneyNumber(order.tipAmount ?? order.driverTip), dateStr: date.toLocaleDateString('bn-BD'), dateStrEn: date.toLocaleDateString('en-US'), timeAgo: date.toLocaleString('bn-BD'), timeAgoEn: date.toLocaleString('en-US'), sentThanks: order.driverThanksSent === true, type: 'tip', read: order.driverTipRead === true };
  }), [delivered]);

  const login = async (email: string, password: string) => { setAuthError(null); try { await signInWithEmailAndPassword(auth, email, password); } catch { setAuthError('লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড সঠিক নয়।'); throw new Error('login failed'); } };
  const logout = async () => { await signOut(auth); };
  const setIsOnline = (online: boolean) => { setOnline(online); if (driverId) updateDoc(doc(db, 'drivers', driverId), { online, lastSeen: serverTimestamp() }).catch(() => { setOnline(!online); setUnableOnlineMessage('অনলাইন স্ট্যাটাস আপডেট হয়নি।'); }); };
  const setLanguage = (value: Language) => setLanguageState(value);
  const updateProfile = (updates: Partial<DriverProfile>) => {
    const allowedUpdates: Partial<DriverProfile> = {};
    if (typeof updates.phone === 'string') allowedUpdates.phone = updates.phone;
    if (typeof updates.vehicleType === 'string') allowedUpdates.vehicleType = updates.vehicleType;
    setProfile(previous => ({ ...previous, ...allowedUpdates }));
    if (driverId && Object.keys(allowedUpdates).length) {
      updateDoc(doc(db, 'drivers', driverId), allowedUpdates as any).catch(() => setUnableOnlineMessage('প্রোফাইল আপডেট করা যায়নি।'));
    }
  };
  const savePreferences = (next: PreferencesState) => { setPreferences(next); if (driverId) updateDoc(doc(db, 'drivers', driverId), { preferences: next, updatedAt: serverTimestamp() }).catch(() => setUnableOnlineMessage('পছন্দসমূহ সংরক্ষণ করা যায়নি।')); };
  const updatePreferences = (key: keyof PreferencesState, value: unknown) => savePreferences({ ...preferences, [key]: value });
  const resetPreferences = () => savePreferences(defaultPreferences);
  const updateOrder = async (fields: any) => { if (activeOrderId) await updateDoc(doc(db, 'orders', activeOrderId), { ...fields, updatedAt: serverTimestamp() }); };
  const acceptOrder = () => void updateOrder({ driverAccepted: true, acceptedAt: serverTimestamp(), status: 'assigned' });
  const declineOrder = () => void updateOrder({ status: 'confirmed', driverId: null, driverName: null, driverAccepted: false, rejectedAt: serverTimestamp() });
  const advanceOrderStatus = () => {
    if (!activeOrder) return;
    const next: Record<Order['status'], Order['status']> = { idle: 'incoming', incoming: 'picking_up', picking_up: 'verifying', verifying: 'delivering', delivering: 'arrived', arrived: 'completed', completed: 'completed' };
    const nextStatus = next[activeOrder.status]; const fields: any = { status: uiToStatus[activeOrder.status] };
    if (nextStatus === 'delivering') fields.pickedUpAt = serverTimestamp();
    if (nextStatus === 'arrived') fields.startedDeliveryAt = serverTimestamp();
    if (nextStatus === 'completed') { fields.deliveredAt = serverTimestamp(); playCompletedTripSound(); }
    void updateOrder(fields);
  };
  const cancelActiveOrder = () => void declineOrder();
  // ⚠️ MT Studio audit fix: আগে এখানে শুধু client-side হিসাব করা
  // computedProfile.walletBalance-এর বিপরীতে amount চেক করে সরাসরি
  // payoutRequests-এ addDoc হতো — DevTools দিয়ে এই ফাংশন সরাসরি কল করলে আসল
  // earning যাচাই ছাড়াই যেকোনো amount পাঠানো যেতো। এখন requestPayoutSecure
  // Cloud Function driver-এর delivered orders ও আগের payout নিজে
  // Firestore থেকে যোগ করে real balance server-side যাচাই করে, তারপর
  // payoutRequests তৈরি করে (client-side create এখন firestore.rules-এ বন্ধ)।
  const requestDetailedPayout = (amount: number, method: PayoutTransaction['method'], accountNumber: string) => {
    if (!driverId || amount <= 0 || amount > computedProfile.walletBalance) return;
    playCashOutSound(); setIsPayoutSuccess(true);
    const requestPayout = httpsCallable(functions, 'requestPayoutSecure');
    requestPayout({ amount, method, accountNumber })
      .then(() => window.setTimeout(() => { setIsPayoutSuccess(false); setShowCashOutModal(false); }, 1600))
      .catch((error: any) => { setIsPayoutSuccess(false); setUnableOnlineMessage(error?.message || 'পেআউট অনুরোধ পাঠানো যায়নি।'); });
  };
  const requestInstantPayout = () => requestDetailedPayout(computedProfile.walletBalance, 'bKash', computedProfile.phone);
  const sendThanksForTip = (id: string) => void updateDoc(doc(db, 'orders', id), { driverThanksSent: true, driverTipRead: true, driverThanksAt: serverTimestamp() }).catch(console.error);
  const deleteTipNotification = (id: string) => void updateDoc(doc(db, 'orders', id), { driverNotificationHidden: true }).catch(console.error);
  const clearAllInbox = () => { tipNotifications.forEach(item => void updateDoc(doc(db, 'orders', item.id), { driverNotificationHidden: true }).catch(console.error)); };

  return <DriverContext.Provider value={{ authReady, currentUser, driverId, authError, login, logout, isOnline, setIsOnline, language, setLanguage, activeTab, setActiveTab, profile: computedProfile, updateProfile, preferences, updatePreferences, resetPreferences, hotspots, driverLocation, activeOrder, acceptOrder, declineOrder, advanceOrderStatus, cancelActiveOrder, tipNotifications, sendThanksForTip, deleteTipNotification, clearAllInbox, earningsDays, payoutTransactions, viewMode, setViewMode, showPreferencesModal, setShowPreferencesModal, showCashOutModal, setShowCashOutModal, showProfileModal, setShowProfileModal, unableOnlineMessage, setUnableOnlineMessage, requestInstantPayout, requestDetailedPayout, isPayoutSuccess }}>{children}</DriverContext.Provider>;
};

export const useDriver = () => { const context = useContext(DriverContext); if (!context) throw new Error('useDriver must be used within DriverProvider'); return context; };

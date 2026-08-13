export type TabType = 'home' | 'discover' | 'earnings' | 'inbox' | 'menu' | 'preferences';
export type Language = 'bn' | 'en';

export interface DriverProfile {
  name: string;
  nameEn: string;
  phone: string;
  tier: 'ডায়মوند' | 'প্লাটিনাম' | 'গোল্ড';
  tierEn: 'Diamond' | 'Platinum' | 'Gold';
  avatar: string;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  totalTrips: number;
  walletBalance: number;
  todayEarnings: number;
  weeklyEarnings: number;
  points: number;
  vehicleType?: string;
}

export interface PayoutTransaction {
  id: string;
  amount: number;
  method: 'bKash' | 'Nagad' | 'Rocket' | 'Bank';
  accountNumber: string;
  timestamp: string;
  status: 'completed' | 'processing' | 'rejected';
}

export interface Hotspot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  driversCount: number;
  surgeMultiplier: string;
  isStar?: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  restaurantName: string;
  restaurantAddress: string;
  customerName: string;
  customerCode: string;
  customerAddress: string;
  customerPhone: string;
  itemCount: number;
  items: OrderItem[];
  businessNote: string;
  estimatedEarnings: number;
  distanceFt: number;
  distanceFormatted: string;
  estTimeMin: number;
  pickupCoords: [number, number] | null;
  dropoffCoords: [number, number] | null;
  status: 'idle' | 'incoming' | 'picking_up' | 'verifying' | 'delivering' | 'arrived' | 'completed';
}

export interface TipNotification {
  id: string;
  amount: number;
  dateStr: string;
  dateStrEn: string;
  timeAgo: string;
  timeAgoEn: string;
  sentThanks: boolean;
  type: 'tip' | 'alert' | 'update' | 'message';
  read: boolean;
}

export interface PreferencesState {
  acceptAllTrips: boolean;
  acceptDeliveries: boolean;
  acceptShopAndDeliver: boolean;
  acceptCash: boolean;
  maxDistanceKm: number;
  noLimitDistance: boolean;
  shopAndDeliver: boolean;
  insulatedBagVerified: boolean;
}

export interface EarningsDay {
  dayName: string;
  dayNameEn: string;
  dateNum: string;
  amount: number;
  onlineHours: number;
  activeHours: number;
  trips: number;
}

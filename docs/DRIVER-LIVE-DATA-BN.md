# Driver app live data contract

Driver app কোনো seed/demo record তৈরি করে না। নিচের existing/live Firestore records থাকলে UI সেগুলো real time-এ দেখায়; record না থাকলে সঠিক empty state দেখায়।

## Identity

- `staff/{firebaseAuthUid}`: `role: "driver"`, `driverId`, `active/status`, official name।
- `drivers/{driverId}`: phone, avatar, vehicleType, online, location, rating, points, preferences।

## Orders ও tracking

- `orders/{orderId}`-এ `driverId` match হলে app-এ assigned order আসে।
- App operational status: `assigned → packed → picked_up → in_transit → delivered`।
- Live tracking: `driverLat`, `driverLng`, `driverAccuracy`, `locationUpdatedAt`।
- Correct map navigation-এর জন্য order-এ `pickupLat/pickupLng` বা `branchLat/branchLng`, এবং `customerLat/customerLng` বা `lat/lng` দিন। Coordinate না থাকলে app ভুল fallback pin ব্যবহার করে না; address text দিয়ে Google Maps navigation খোলে।

## Earnings, tips ও payout

- Earnings: delivered order-এর `driverEarning`, fallback `driverFee`/`shippingCost`।
- Tip: `tipAmount` অথবা `driverTip`।
- Payout request: `payoutRequests` collection; pending এবং completed দুটোই withdrawable balance থেকে বাদ যায়।

## Branches ও opportunities

- Branch map: `setting/branches` document-এর `branches` map; প্রতিটি branch-এ `label/name`, `lat`, `lng`।
- Driver opportunity: `driverOpportunities/{id}`; supported fields:
  - `active`
  - `titleBn`, `titleEn`
  - `rewardBn`, `rewardEn`
  - `scheduleBn`, `scheduleEn`
  - `tagBn`, `tagEn`
- Driver opt-in: `drivers/{driverId}/opportunityOptIns/{opportunityId}`।

## Update behavior

Website এবং Driver web app একই Netlify deploy-এর অংশ। দুইটি Android shell live HTTPS URLs চালায় এবং `/app-version.json` দেখে visible অবস্থায় সর্বোচ্চ পাঁচ মিনিটের মধ্যে নতুন deploy reload করে। Firebase product/order/branch/opportunity changes `onSnapshot`-এর মাধ্যমে deploy ছাড়াই real time-এ আসে।

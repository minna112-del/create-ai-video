# Firebase Setup — ধাপে ধাপে

## ১. একই Firebase project নিশ্চিত করুন

Firebase Console → Project settings → General-এ গিয়ে Project ID দেখুন:

```text
golapishoponline
```

অন্য project ব্যবহার করলে Driver app website-এর order পাবে না।

## ২. Email/Password Login চালু করুন

Firebase Console → Authentication → Sign-in method → Email/Password → Enable → Save।

## ৩. Driver তৈরি করার সঠিক ক্রম

### A. Website dashboard-এ Driver যোগ করুন

Golapi Shop Admin/Zone Manager dashboard-এর Driver Management থেকে Driver-এর নাম, phone এবং branch zone দিয়ে Driver যোগ করুন।

এতে Firestore-এ তৈরি হবে:

```text
drivers/{driverDocumentId}
```

নতুন document-এর ID কপি করুন। উদাহরণ:

```text
abcDriverDoc123
```

### B. Firebase Authentication user তৈরি করুন

Firebase Console → Authentication → Users → Add user

- Email: Driver-এর login email
- Password: শক্তিশালী password

User তৈরি হলে UID কপি করুন।

### C. `staff/{UID}` document তৈরি করুন

Firestore → `staff` collection → Authentication UID-কে Document ID হিসেবে ব্যবহার করুন।

প্রয়োজনীয় fields:

| Field | Type | Value |
|---|---|---|
| `role` | string | `driver` |
| `driverId` | string | `drivers` document ID |
| `name` | string | Driver-এর নাম |
| `phone` | string | Driver-এর phone |
| `branchZone` | string | Website-এর zone value |
| `active` | boolean | `true` |

সবচেয়ে গুরুত্বপূর্ণ সম্পর্ক:

```text
Authentication UID
  → staff/{UID}.driverId
  → drivers/{driverId}
  → orders/{orderId}.driverId
```

চার জায়গার ID সম্পর্ক ঠিক না হলে order app-এ আসবে না।

## ৪. Test order assign করুন

Website Admin/Zone Manager dashboard থেকে existing order-এ Driver assign করুন। এতে website নিজেই order document-এ লিখবে:

```text
driverId: <driver document id>
driverName: <driver name>
status: assigned
assignedAt: server timestamp
```

Driver app-এ login করার পর order real time দেখা যাবে।

## ৫. Driver order flow পরীক্ষা

1. Driver order গ্রহণ করবে → `driverAccepted: true`
2. প্যাকিং সম্পন্ন → `status: packed`
3. পিকআপ সম্পন্ন → `status: picked_up`
4. রওনা/লাইভ লোকেশন → `status: in_transit`
5. ডেলিভারি সম্পন্ন → `status: delivered`

`in_transit` অবস্থায় app একই order document-এ লিখবে:

- `driverLat`
- `driverLng`
- `driverAccuracy`
- `locationUpdatedAt`

এবং `drivers/{driverId}` document-এ current location/last seen update করবে।

## ৬. Online/Offline

Driver app-এর toggle এই document update করে:

```text
drivers/{driverId}.online
```

## ৭. Payout

Driver payout request দিলে document তৈরি হবে:

```text
payoutRequests/{autoId}
```

প্রয়োজনীয় fields:

- `driverId`
- `driverName`
- `amount`
- `method`
- `accountNumber`
- `status: processing`
- `createdAt`

## ৮. সফল integration test

- Website থেকে order তৈরি
- Dashboard থেকে Driver assign
- Driver app-এ real-time order দেখা
- Accept করলে dashboard-এ `driverAccepted: true`
- প্রতিটি status dashboard/customer tracking-এ update
- `in_transit` হলে location update
- `delivered` হলে Driver history/earnings update

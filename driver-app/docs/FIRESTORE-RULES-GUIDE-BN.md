# Firestore Rules Integration Guide

এই repository কোনো full replacement Firestore Rules দেয় না, কারণ Golapi Shop website, Admin, Zone Manager, Customer এবং Driver একই database ব্যবহার করে। Full rules replace করলে অন্য অংশ বন্ধ হতে পারে।

Existing rules-এ Driver role-এর জন্য নিচের access নিশ্চিত করুন।

## Driver identity helper-এর ধারণা

Authenticated user-এর `staff/{uid}` document-এ:

```text
role == "driver"
driverId == সংশ্লিষ্ট driver document ID
```

## প্রয়োজনীয় permission checklist

### `staff/{uid}`

Driver নিজের staff document read করতে পারবে। অন্য staff document read করা প্রয়োজন নেই।

### `drivers/{driverId}`

Driver নিজের document read করতে পারবে এবং সীমিত operational fields update করতে পারবে:

- `online`
- `lastSeen`
- `lat`
- `lng`
- `locationUpdatedAt`
- `preferences`
- অনুমোদিত profile fields

### `orders/{orderId}`

Driver শুধু সেই order read/update করতে পারবে যেখানে:

```text
resource.data.driverId == staff/{uid}.driverId
```

Update-এ ownership পরিবর্তন আটকাতে হবে, তবে reject operation-এর সময় website-এর existing flow অনুযায়ী:

- `status = confirmed`
- `driverId = null`
- `driverName = null`
- `driverAccepted = false`

অনুমোদন দিতে হবে।

Driver-এর operational fields:

- `driverAccepted`
- `acceptedAt`
- `status`
- `updatedAt`
- `startedDeliveryAt`
- `deliveredAt`
- `rejectedAt`
- `driverLat`
- `driverLng`
- `driverAccuracy`
- `locationUpdatedAt`
- `driverTipRead`
- `driverThanksSent`
- `driverThanksAt`
- `driverNotificationHidden`

### `payoutRequests/{requestId}`

Driver create করতে পারবে যখন request-এর `driverId` তার নিজের staff driverId-এর সমান। Driver নিজের request read করতে পারবে। Driver নিজে `status: completed` করতে পারবে না।

### `setting/branches`

Authenticated Driver branch name এবং published coordinates read করতে পারবে। এই document Driver update করতে পারবে না।

### `driverOpportunities/{opportunityId}`

Authenticated active Driver published opportunity read করতে পারবে। Driver opportunity document create/update/delete করতে পারবে না।

### `drivers/{driverId}/opportunityOptIns/{opportunityId}`

Driver শুধু নিজের Driver document-এর নিচে opt-in read/create করতে পারবে। Create payload-এর `driverId` ও `driverUid` authenticated staff identity-এর সঙ্গে মিলতে হবে। অন্য Driver-এর opt-in access নিষিদ্ধ থাকবে।

## নিরাপত্তা পরীক্ষা

Rules publish করার আগে Firebase Rules Playground/Emulator-এ পরীক্ষা করুন:

1. Driver নিজের assigned order পড়তে পারে
2. অন্য Driver-এর order পড়তে পারে না
3. Driver নিজের order status update করতে পারে
4. Driver order total/customer ownership field পরিবর্তন করতে পারে না
5. Driver নিজের online/location update করতে পারে
6. Driver অন্য Driver-এর profile update করতে পারে না
7. Driver payout create করতে পারে, payout approve করতে পারে না
8. Driver published branch/opportunity read করতে পারে, পরিবর্তন করতে পারে না
9. Driver শুধু নিজের opportunity opt-in create করতে পারে
10. Driver tip notification field update করতে পারে, order amount/customer/driver ownership পরিবর্তন করতে পারে না

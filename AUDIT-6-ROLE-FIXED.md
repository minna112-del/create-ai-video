# Golapi Shop Online — ৬ রোল অডিট ও ফিক্স রিপোর্ট

তারিখ: ২০২৬-০৮-২৯

## Source coverage

- Latest source package থেকে fresh audit করা হয়েছে: `golapishop.online-main(20260829-093316).zip`
- Total files inventoried: 208
- Readable code/text files scanned: 190
- Attached context checked:
  - `website.txt`
  - `github.txt`
  - `firebase rule.txt`
  - `Netlify.txt`
  - `নতুন.txt`

## ১) Customer role

- Homepage hero copy `নতুন.txt` অনুযায়ী রাখা হয়েছে।
- Customer-facing trust promises রাখা হয়েছে, কিন্তু fabricated review wording বাদ দিয়ে বাস্তব service-promise/social-proof copy করা হয়েছে।
- CTA wording পরিষ্কার করা হয়েছে: `নিরাপদে অর্ডার করুন`।
- Zone-A, Zone-B, Zone-C wording customer UI-তে বজায় আছে।

## ২) UI/UX design role

- Soft Cream background, Deep Black typography, Soft Pink accents, Champagne Gold highlight design direction বজায় আছে।
- Layout/color/design system বদলানো হয়নি।
- English section kicker বাংলায় করা হয়েছে:
  - `দ্রুত সেবার হাইলাইট`
  - `লাইভ অর্ডার ও ট্র্যাকিং`
  - `গ্রাহকের আস্থা`
  - `কাস্টমার কেয়ার`

## ৩) Security/Firebase role

- Attached `firebase rule.txt` এবং project `firestore.rules` consistency checked.
- Old location key/name scan clean রাখা হয়েছে; পুরনো location naming source package-এ রাখা হয়নি।
- Payment/order security flow source-level audit করা হয়েছে।

## ৪) Developer/QA role

- JS/MJS syntax check passed.
- Customer project validator passed.
- Driver project validator passed.
- Customer fallback bundle build passed.

## ৫) Deployment/Netlify role

- Duplicate `/driver/assets/*` Netlify header block removed.
- Service worker cache bumped to `golapi-v95-six-role-cache` so updated UI/copy stale cache-এ আটকে না থাকে।
- Unified validator cache expectation updated.

## ৬) Operations/Admin/Driver role

- Zone-A/B/C naming source scan clean.
- Admin sidebar ৬ রোল/অফিস গ্রুপ অনুযায়ী সাজানো হয়েছে, যাতে CEO/Admin, Customer, Zone Manager, Rider/Delivery, Support, Finance/Growth এবং Office Control আলাদা বোঝা যায়।
- Admin/driver/customer source validation passed.
- Driver production build এখানে চালানো হয়নি, কারণ `driver-app/node_modules` নেই এবং Vite dependencies install দরকার।

## Final validation summary

- Old location naming scan: clean
- JS/MJS syntax: pass
- Customer validator: pass
- Driver validator: pass
- Customer fallback build: pass
- Zip integrity: pass

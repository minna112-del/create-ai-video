# People Operations Office — Phase 2

Executive Command Center > “কর্মী ও অফিস ডেস্ক” থেকে:
- কর্মীর নাম, ছবি, ফোন, ইমেইল
- Firebase Authentication UID
- Role, পদবি, বিভাগ ও Workspace
- Employee ID, শাখা ও Dress Code
- দায়িত্ব এবং Active/Pending/Inactive status
- ডিজিটাল কোম্পানি ID Card preview

## নিয়োগ প্রক্রিয়া
1. কর্মীর জন্য সংশ্লিষ্ট staff login screen থেকে Firebase Auth account তৈরি/সাইন-আপ করুন।
2. Firebase Console > Authentication > Users থেকে UID কপি করুন।
3. CEO Office > কর্মী ও অফিস ডেস্ক > নতুন কর্মী নিয়োগ খুলুন।
4. UID এবং পরিচয় পূরণ করে ডেস্ক বরাদ্দ করুন।
5. `staff/{uid}` profile তৈরি হলে কর্মী তার role অনুযায়ী Workspace-এ ঢুকতে পারবে।

## Firebase Storage
কর্মীর ছবি `staff/{uid}/...` path-এ upload হয়। Storage rules-এ admin write permission নিশ্চিত করুন।

const admin = require('firebase-admin');
admin.initializeApp({ storageBucket: 'golapishoponline.firebasestorage.app' });
const db = admin.firestore();
const bucket = admin.storage().bucket();

async function main() {
  console.log('=== সব প্রোডাক্ট ও ছবি মোছা শুরু হচ্ছে ===');
  const snap = await db.collection('products').get();
  console.log(`মোট ${snap.size}টা প্রোডাক্ট পাওয়া গেছে`);
  let deletedDocs = 0, deletedImages = 0, failedImages = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    for (const field of ['imageUrl', 'imageUrlSmall']) {
      const url = data[field];
      if (!url) continue;
      try {
        const match = url.match(/\/o\/(.+?)\?/);
        if (match) {
          const path = decodeURIComponent(match[1]);
          await bucket.file(path).delete();
          deletedImages++;
        }
      } catch (e) { failedImages++; }
    }
    await doc.ref.delete();
    deletedDocs++;
    console.log(`মোছা হয়েছে: ${data.name || '(নাম নেই)'}`);
  }
  console.log('');
  console.log(`সম্পন্ন — ${deletedDocs}টা প্রোডাক্ট, ${deletedImages}টা ছবি মোছা হয়েছে (${failedImages}টা ছবি আগে থেকেই ছিল না, স্বাভাবিক)`);
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

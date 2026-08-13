import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
await access(manifestPath, constants.R_OK | constants.W_OK);
let manifest = await readFile(manifestPath, 'utf8');

const insertPermission = (source, permission) => {
  if (source.includes(permission)) return source;

  const manifestOpen = source.match(/<manifest\b[^>]*>/);
  if (!manifestOpen?.index && manifestOpen?.index !== 0) {
    throw new Error('AndroidManifest.xml root <manifest> tag was not found');
  }

  const insertAt = manifestOpen.index + manifestOpen[0].length;
  return `${source.slice(0, insertAt)}\n    <uses-permission android:name="${permission}" />${source.slice(insertAt)}`;
};

for (const permission of ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.POST_NOTIFICATIONS']) {
  manifest = insertPermission(manifest, permission);
}
await writeFile(manifestPath, manifest);
console.log('Golapi Customer Android permissions configured.');

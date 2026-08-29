import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'dist/index.html',
  'dist/sw.js',
  'dist/js/core/app-registry.js',
  'dist/app-version.json',
  'dist/driver/index.html',
  'customer-app/package-lock.json',
  'driver-app/package-lock.json',
  '.github/workflows/build-mobile-apks.yml'
];

for (const path of required) {
  await access(resolve(root, path), constants.R_OK);
}

const [rootPackage, netlify, registry, router, worker, driverIndex, customerConfig, driverConfig, workflow, releaseSync, dashboardUrls, releaseMetadata, manifest, twaManifest] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'netlify.toml'), 'utf8'),
  readFile(resolve(root, 'js/core/app-registry.js'), 'utf8'),
  readFile(resolve(root, 'js/router.js'), 'utf8'),
  readFile(resolve(root, 'sw.js'), 'utf8'),
  readFile(resolve(root, 'dist/driver/index.html'), 'utf8'),
  readFile(resolve(root, 'customer-app/capacitor.config.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'driver-app/capacitor.config.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, '.github/workflows/build-mobile-apks.yml'), 'utf8'),
  readFile(resolve(root, 'js/update-check.js'), 'utf8'),
  readFile(resolve(root, 'docs/DASHBOARD-URLS-BN.md'), 'utf8'),
  readFile(resolve(root, 'dist/app-version.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'manifest.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'twa-manifest.json'), 'utf8').then(JSON.parse)
]);

const assertions = [
  [netlify.includes('publish = "dist"'), 'Netlify publish directory is not dist'],
  [netlify.includes('to = "/driver/index.html"'), 'Driver SPA rewrite is missing'],
  [registry.includes("external: '/driver/'"), 'Driver external route is missing'],
  [registry.includes('external: page =>'), 'Registry external accessor is missing'],
  [registry.includes('!pages[page].external'), 'External apps are still included in fragment loading'],
  [router.includes('AppRegistry.external(page)'), 'Router does not open the Driver app'],
  [worker.includes("requestUrl.pathname.startsWith('/driver/')"), 'Storefront service worker does not bypass Driver'],
  [worker.includes("requestUrl.pathname === '/app-version.json'"), 'Release metadata is still service-worker cached'],
  [worker.includes("golapi-v95-six-role-cache"), 'Fast cache service-worker version is missing'],
  [worker.includes('stale-while-revalidate'), 'Static stale-while-revalidate strategy is missing'],
  [netlify.includes('/driver/assets/*') && netlify.includes('immutable'), 'Driver hashed assets are not immutable-cached'],
  [/\/driver\/assets\//.test(driverIndex), 'Driver web build does not use the /driver/ base path'],
  [customerConfig.server?.url === 'https://www.golapishop.online/', 'Customer APK is not connected to the live website'],
  [driverConfig.server?.url === 'https://www.golapishop.online/driver/', 'Driver APK is not connected to the live Driver app'],
  [customerConfig.server?.cleartext === false && driverConfig.server?.cleartext === false, 'A mobile app allows cleartext traffic'],
  [workflow.includes('customer-app') && workflow.includes('driver-app'), 'Unified APK matrix does not build both apps'],
  [workflow.includes('ANDROID_KEYSTORE_BASE64') && workflow.includes('assembleRelease'), 'Stable signed release APK path is missing'],
  [releaseSync.includes('location.reload()') && releaseSync.includes('app-version.json'), 'Automatic deployed-release sync is missing'],
  [releaseMetadata.version === rootPackage.version && releaseMetadata.release, 'Generated release metadata is invalid'],
  [dashboardUrls.includes('/admin') && dashboardUrls.includes('/company-os') && dashboardUrls.includes('/driver/'), 'Dashboard URL documentation is incomplete'],
  [manifest.icons?.some(icon => icon.src === '/icons/head_logo-512.webp' && icon.sizes === '512x512'), 'PWA manifest 512 icon is missing or points to the wrong file'],
  [twaManifest.icons?.some(icon => icon.src === '/icons/head_logo-512.webp' && icon.sizes === '512x512'), 'TWA manifest 512 icon is missing or points to the wrong file']
];

for (const [passed, message] of assertions) {
  if (!passed) throw new Error(message);
}

// Driver production bundle must be pinned to the Golapi Shop Firebase project.
// This catches accidental Netlify/Vite environment overrides before deployment.
const driverAssetsDir = resolve(root, 'dist/driver/assets');
const driverAssetNames = await readdir(driverAssetsDir);
const driverJsFiles = driverAssetNames.filter(name => name.endsWith('.js'));
const driverBundleText = (await Promise.all(
  driverJsFiles.map(name => readFile(resolve(driverAssetsDir, name), 'utf8'))
)).join('\n');
if (!driverBundleText.includes('golapishoponline.firebaseapp.com')) {
  throw new Error('Driver bundle is not connected to golapishoponline Firebase Auth');
}
if (!driverBundleText.includes('golapishoponline')) {
  throw new Error('Driver bundle is missing the golapishoponline project id');
}
if (driverBundleText.includes('mt-studio-ai.firebaseapp.com')) {
  throw new Error('Driver bundle still contains the legacy mt-studio-ai Firebase config');
}

for (const removedLegacyFile of ['pages/driver.html', 'js/driver.js']) {
  try {
    await access(resolve(root, removedLegacyFile), constants.F_OK);
    throw new Error(`Legacy Driver portal still exists: ${removedLegacyFile}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

console.log('Unified repository validation passed.');

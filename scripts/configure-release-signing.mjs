import { readFile, writeFile } from 'node:fs/promises';

const required = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing Android signing environment: ${name}`);
}

const path = 'android/app/build.gradle';
let gradle = await readFile(path, 'utf8');
if (!gradle.includes('GOLAPI_RELEASE_SIGNING')) {
  gradle = gradle.replace(/android\s*\{/, `android {\n    // GOLAPI_RELEASE_SIGNING: stable key supplied only by GitHub Actions secrets.\n    signingConfigs {\n        release {\n            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))\n            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')\n            keyAlias System.getenv('ANDROID_KEY_ALIAS')\n            keyPassword System.getenv('ANDROID_KEY_PASSWORD')\n        }\n    }`);
  gradle = gradle.replace(/buildTypes\s*\{\s*release\s*\{/, match => `${match}\n            signingConfig signingConfigs.release`);
}
await writeFile(path, gradle);
console.log('Stable Android release signing configured.');

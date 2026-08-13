import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

for (const file of ['package.json', 'capacitor.config.json', 'src/fallback.html', '../.github/workflows/build-mobile-apks.yml']) {
  await access(file, constants.R_OK);
}

const config = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
if (config.appId !== 'online.golapishop.customer') throw new Error('Customer application id is invalid');
if (config.server?.url !== 'https://www.golapishop.online/') throw new Error('Customer app is not connected to the live website');
if (config.server?.cleartext !== false) throw new Error('Customer app must reject cleartext traffic');
console.log('Golapi Customer live-shell validation passed.');

import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'package.json', 'index.html', 'capacitor.config.json',
  'src/main.tsx', 'src/App.tsx', 'src/lib/firebase.ts',
  'src/context/DriverContext.tsx', 'src/lib/releaseSync.ts', '../.github/workflows/build-mobile-apks.yml'
];

for (const file of requiredFiles) {
  await access(file, constants.R_OK);
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const requiredPackages = ['react', 'react-dom', 'firebase', '@capacitor/core', '@capacitor/android'];
for (const name of requiredPackages) {
  if (!pkg.dependencies?.[name]) throw new Error(`Missing dependency: ${name}`);
}

const context = await readFile('src/context/DriverContext.tsx', 'utf8');
for (const token of ["'staff'", "'drivers'", "'orders'", "'payoutRequests'", "driverAccepted", "driverLat", "driverLng"]) {
  if (!context.includes(token)) throw new Error(`Missing Golapi Shop integration token: ${token}`);
}
for (const status of ["'assigned'", "'packed'", "'picked_up'", "'in_transit'", "'delivered'"]) {
  if (!context.includes(status)) throw new Error(`Missing order status: ${status}`);
}
const capacitor = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
if (capacitor.server?.url !== 'https://www.golapishop.online/driver/') throw new Error('Driver APK is not connected to the live Driver web app');
if (capacitor.server?.cleartext !== false) throw new Error('Driver APK must reject cleartext traffic');
for (const forbidden of ['startOrderSimulation', 'startCustomOrderSimulation', '23.8103', '90.4125']) {
  if (context.includes(forbidden)) throw new Error(`Non-production Driver token remains: ${forbidden}`);
}
console.log('Golapi Driver project validation passed.');

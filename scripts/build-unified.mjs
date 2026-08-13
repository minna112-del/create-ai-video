import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');

if (output === root || !output.startsWith(`${root}/`)) {
  throw new Error('Unsafe build output path');
}

const storefrontDirectories = ['.well-known', 'css', 'icons', 'js', 'pages'];
const storefrontFiles = [
  'google5758c8ffc56e6df6.html',
  'index.html',
  'manifest.json',
  'offline.html',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
  'twa-manifest.json'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of storefrontDirectories) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

for (const file of storefrontFiles) {
  await cp(resolve(root, file), resolve(output, file));
}

await cp(resolve(root, 'driver-app', 'dist'), resolve(output, 'driver'), { recursive: true });

const rootPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const releaseId = process.env.COMMIT_REF || process.env.GITHUB_SHA || `local-${Date.now()}`;
await writeFile(resolve(output, 'app-version.json'), `${JSON.stringify({
  version: rootPackage.version,
  release: releaseId,
  builtAt: new Date().toISOString()
}, null, 2)}\n`);

console.log('Unified storefront, live release metadata and Driver app built into dist/.');

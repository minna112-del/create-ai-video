import { cp, mkdir, rm } from 'node:fs/promises';

await rm('www', { recursive: true, force: true });
await mkdir('www/icons', { recursive: true });
await cp('../icons/head_logo.webp', 'www/icons/head_logo.webp');
await cp('src/fallback.html', 'www/index.html');
console.log('Golapi Customer native fallback bundle built.');

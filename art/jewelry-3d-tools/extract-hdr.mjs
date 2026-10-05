// Writes the CC0 studio HDRI bundled in @pmndrs/assets to hdr/studio.exr for Blender.
import fs from 'fs';
import studio from '@pmndrs/assets/hdri/studio.exr.js';
fs.mkdirSync('hdr', { recursive: true });
fs.writeFileSync('hdr/studio.exr', Buffer.from(studio.slice(studio.indexOf('base64,') + 7), 'base64'));
console.log('wrote hdr/studio.exr');

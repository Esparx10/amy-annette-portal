import { build } from 'esbuild';
import fs from 'fs';
const [entry, shellFile, name] = process.argv.slice(2);
await build({ entryPoints: [entry], bundle: true, minify: true, format: 'iife', outfile: `dist/${name}.bundle.js`, legalComments: 'none' });
const js = fs.readFileSync(`dist/${name}.bundle.js`, 'utf8').replace(/<\/script/gi, '<\\/script');
const body = fs.readFileSync(shellFile, 'utf8').split('<script>/*BUNDLE*/</script>').join('<script>' + js + '</script>');
fs.writeFileSync(`dist/${name}.artifact.html`, body);
const cut = body.indexOf('<div id="stage">');
fs.writeFileSync(`dist/${name}.html`,
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + body.slice(0, cut) + '</head>\n<body>\n' + body.slice(cut) + '\n</body>\n</html>\n');
console.log('built', name, (fs.statSync(`dist/${name}.html`).size / 1024).toFixed(0) + 'KB');

import { build } from 'esbuild';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = process.argv[2];
if (!destination) throw new Error('Supply the absolute output HTML path.');
const assets = resolve(root, 'dist/client/assets');
const cssFiles = (await readdir(assets)).filter(name => name.endsWith('.css'));
if (!cssFiles.length) throw new Error('Build the site before exporting HTML.');
const css = (await Promise.all(cssFiles.map(name => readFile(resolve(assets, name), 'utf8')))).join('\n');
const result = await build({
  absWorkingDir:root, entryPoints:['portable/main.tsx'], bundle:true, write:false,
  platform:'browser', format:'iife', target:['es2020'], minify:true, legalComments:'inline',
  define:{'process.env.NODE_ENV':'"production"'}, tsconfig:resolve(root,'tsconfig.json'),
  plugins:[{name:'portable-bills',setup(bundler) {
    bundler.onResolve({filter:/^@\/lib\/bills-client$/}, () => ({path:resolve(root,'portable/bills-client.ts')}));
  }}],
});
const script = result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const portableCss = `.portable-banner{max-width:1376px;margin:1rem auto 0;padding:.85rem 1rem;border:1px solid #ddd3e4;border-radius:.7rem;background:#fff;font:14px/1.5 "Trebuchet MS",Arial,sans-serif;display:grid;gap:.2rem;color:#675570}.portable-banner strong{color:#542052}.portable-banner span{font-size:14px}@media(max-width:1440px){.portable-banner{margin:1rem 2rem 0}}@media(max-width:680px){.portable-banner{margin:.8rem .9rem 0}}@media print{.portable-banner{display:none!important}}`;
const html = `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0b4436"><title>Namma Mallige — Billing Software</title><meta name="description" content="Daily flower bills, customer account book, WhatsApp messages and Saturday printing. Device-local HTML edition."><style>${css}\n${portableCss}</style></head><body><div id="root"></div><noscript>This billing software needs JavaScript. Open the downloaded HTML file in Chrome, Edge, Firefox or Safari with JavaScript enabled.</noscript><script>${script}</script></body></html>`;
await mkdir(dirname(destination), {recursive:true});
await writeFile(destination,html);
console.log(`HTML exported: ${destination} (${Buffer.byteLength(html)} bytes; all app code and styles embedded)`);

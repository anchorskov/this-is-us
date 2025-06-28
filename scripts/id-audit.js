// scripts/id-audit.js  (run with:  node scripts/id-audit.js)
import { promises as fs } from 'fs';
import path               from 'path';
import glob               from 'fast-glob';

const SRC = ['layouts/**/*.html', 'static/js/**/*.js'];

const idAttr   = /id="([^"]+)"/g;
const idSelect = /getElementById\(['"`]([^'"`]+)/g;

const idsHTML = new Map();
const idsJS   = new Map();

for (const file of await glob(SRC)) {
  const txt = await fs.readFile(file, 'utf8');
  if (file.endsWith('.html')) {
    for (const m of txt.matchAll(idAttr))
      idsHTML.set(m[1], (idsHTML.get(m[1])||[]).concat(file));
  } else {
    for (const m of txt.matchAll(idSelect))
      idsJS.set(m[1],  (idsJS.get(m[1]) || []).concat(file));
  }
}

console.log('\n🔎 IDs referenced in JS but missing in templates:');
for (const [id, jsFiles] of idsJS)
  if (!idsHTML.has(id))
    console.log(`  #${id}  →  ${jsFiles.join(', ')}`);

console.log('\n⚠️ IDs defined in HTML but never used in JS:');
for (const [id, htmlFiles] of idsHTML)
  if (!idsJS.has(id))
    console.log(`  #${id}  →  ${htmlFiles.join(', ')}`);

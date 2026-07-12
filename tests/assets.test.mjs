import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('service worker precache assets all exist', () => {
  const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const assets = [...source.matchAll(/'\.\/(.*?)'/g)].map((match) => match[1]).filter(Boolean);
  const unique = [...new Set(assets)];
  for (const asset of unique) {
    assert.ok(fs.existsSync(path.join(root, asset)), `missing precache asset: ${asset}`);
  }
});

test('public files do not contain local Drive paths or tracking scripts', () => {
  const files = ['index.html', 'css/styles.css', 'js/app.js', 'js/engine.js', 'js/content.js', 'README.md'];
  for (const relative of files) {
    if (!fs.existsSync(path.join(root, relative))) continue;
    const text = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.equal(/G:\\|내 드라이브|googletagmanager|goatcounter/i.test(text), false, relative);
  }
});

test('manifest is valid and scoped to this app', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
});

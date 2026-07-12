import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const expectedPages = ['home', 'trainer', 'history', 'mechanism', 'evidence'];

test('the long document is split into five page views', () => {
  const viewTags = [...html.matchAll(/<(?:div|section)\b[^>]*\bdata-page="([^"]+)"[^>]*>/g)];
  assert.deepEqual(viewTags.map((match) => match[1]), expectedPages);

  for (const match of viewTags) {
    const pageId = match[1];
    const tag = match[0];
    assert.equal(/\shidden(?:\s|>)/.test(tag), pageId !== 'home', `${pageId} initial visibility`);
    const labelledBy = tag.match(/\baria-labelledby="([^"]+)"/)?.[1];
    assert.ok(labelledBy, `${pageId} needs aria-labelledby`);
    assert.match(html, new RegExp(`\\bid="${labelledBy}"`));
  }
});

test('the header exposes one link for every page and keeps step controls', () => {
  const links = [...html.matchAll(/<a\b[^>]*\bdata-page-link\b[^>]*\bhref="#([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, expectedPages);
  for (const id of ['previous-page', 'next-page', 'page-position']) {
    assert.match(html, new RegExp(`\\bid="${id}"`));
  }
});

test('hash navigation pauses an active session before leaving training', () => {
  assert.match(app, /const PAGE_ORDER = \['home', 'trainer', 'history', 'mechanism', 'evidence'\]/);
  assert.match(app, /window\.addEventListener\('hashchange', \(\) => showPage\(true\)\)/);
  assert.match(app, /currentPage === 'trainer'[\s\S]*pauseSession\('page'\)/);
  assert.match(app, /window\.scrollTo\(0, 0\)/);
  assert.match(app, /setAttribute\('aria-current', 'page'\)/);
});

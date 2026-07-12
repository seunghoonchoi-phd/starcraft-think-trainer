import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

test('the app exposes only the full-screen trainer', () => {
  const viewTags = [...html.matchAll(/<(?:div|section)\b[^>]*\bdata-page="([^"]+)"[^>]*>/g)];
  assert.deepEqual(viewTags.map((match) => match[1]), ['trainer']);
  assert.doesNotMatch(html, /<header\b|data-page-link|page-stepper|page-position|install-button/);
  assert.doesNotMatch(html, /data-page="home"|data-page="mechanism"|data-page="evidence"|data-page="history"/);
  assert.match(html, /<body data-current-page="trainer">/);
});

test('the trainer opens directly and removes stale hash navigation', () => {
  assert.match(app, /function showTrainer\(focusTrainer = true\)/);
  assert.match(app, /showTrainer\(false\)/);
  assert.doesNotMatch(app, /PAGE_ORDER|PAGE_LABELS|requestedPage|hashchange|beforeinstallprompt/);
  assert.match(app, /window\.history\.replaceState\(null, '', `\$\{location\.pathname\}\$\{location\.search\}`\)/);
});

test('the trainer uses the full viewport and enlarges its content', () => {
  assert.match(css, /height: 100dvh;/);
  assert.match(css, /min-height: 100dvh;/);
  assert.match(css, /font-size: clamp\(38px, 4\.8vw, 64px\)/);
  assert.match(css, /\.start-panel > div:first-child > p:last-child,[\s\S]*font-size: 18px/);
  assert.match(css, /\.console-topbar #phase-name \{ font-size: 22px; \}/);
  assert.match(css, /\.decision-option span \{ font-size: 13px; \}/);
});

test('the app keeps local record export and never renders the removed overview strip', () => {
  assert.match(html, /id="export-button"/);
  assert.match(app, /function exportRecords\(\)/);
  assert.doesNotMatch(html, /command-strip|radar-grid|hero-visual|history-chart/);
  assert.doesNotMatch(app, /historyChart|renderHistory/);
});

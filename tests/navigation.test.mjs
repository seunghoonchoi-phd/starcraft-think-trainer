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
  assert.match(css, /\.base \{[^}]*width: 96px;[^}]*height: 58px;[^}]*font: 700 14px/);
});

test('the trainer exposes immediate start, stage practice, pause, and home controls', () => {
  assert.match(html, /id="start-button"[^>]*>바로 훈련 시작</);
  assert.equal((html.match(/class="phase-button"/g) || []).length, 8);
  assert.match(html, /id="pause-button"/);
  assert.match(html, /일시정지/);
  assert.match(html, /id="home-button"/);
  assert.match(html, /홈으로/);
  assert.match(html, /id="decision-status">응답 시간</);
  assert.match(html, /id="situation-visual"/);
  assert.match(html, /id="target-instruction"/);
  assert.match(html, /1\. 1 키 누르기/);
  assert.match(html, /빛나는 표적 클릭/);
  assert.match(html, /id="tutorial-button"/);
  assert.match(html, /id="tutorial-panel"/);
  assert.match(html, /id="tutorial-question"/);
  assert.match(html, /시간 제한 없음/);
  assert.doesNotMatch(html, /<kbd>[RTYFGH]<\/kbd>/);
  assert.match(app, /createMotorCommand/);
  assert.match(app, /빛나는 표적/);
  assert.doesNotMatch(app, /같은 기호가 있는 표적/);
  assert.match(app, /const DECISION_ANSWER_MS = 3000/);
  assert.doesNotMatch(app, /DECISION_READING_MS|beginDecisionAnswer/);
  assert.match(app, /function returnHome\(message = ''\)/);
  assert.match(app, /const PHASE_TUTORIALS =/);
  assert.match(app, /function beginPhase\(\)/);
  assert.match(app, /function openPhaseTutorial\(phase, onComplete\)/);
  assert.match(app, /튜토리얼을 닫았습니다\. 홈에서 원하는 단계를 다시 선택하세요/);
  assert.match(app, /startSession\(false, button\.closest\('li'\)\?\.dataset\.phase\)/);
  assert.match(app, /if \(!decision \|\| !decision\.ready \|\| decision\.answered \|\| !hasDecision\(\)\) return false/);
});

test('the app keeps local record export and never renders the removed overview strip', () => {
  assert.match(html, /id="export-button"/);
  assert.match(app, /function exportRecords\(\)/);
  assert.doesNotMatch(html, /command-strip|radar-grid|hero-visual|history-chart/);
  assert.doesNotMatch(app, /historyChart|renderHistory/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicFiles = [
  'index.html',
  'README.md',
  'manifest.webmanifest',
  'js/app.js',
  'js/content.js',
  'js/engine.js'
];

const banned = [
  { name: 'em or en dash', pattern: /[\u2013\u2014]/u },
  { name: 'Markdown inline emphasis', pattern: /\*\*/u },
  { name: 'reversal template', pattern: /(?:가|이|은|는) 아니라/u },
  { name: 'simile', pattern: /처럼|같이|마치|듯이|듯한/u },
  { name: 'metaphorical or vague legacy copy', pattern: /손이 바쁘|생각 보존|생각이 (?:멈|남)|생각을 놓|판단이 (?:무너지|흔들)|판단을 놓|판단할 틈|처리 공간|기회가 열|부딪히|병목|손 기준선|손 순환|손을 멈|헛입력|부풀리|꼬인다|묶을|뭉개|난사|가볍게 만드/u },
  { name: 'unexplained legacy labels', pattern: /원시 APM|SESSION COMPLETE|HOW IT WORKS|EVIDENCE & LIMITS|STARCRAFT-STYLE/u }
];

test('public Korean copy keeps the direct-writing guardrails', () => {
  const failures = [];
  for (const relative of publicFiles) {
    const text = fs.readFileSync(path.join(root, relative), 'utf8');
    for (const rule of banned) {
      const match = text.match(rule.pattern);
      if (match) failures.push(`${relative}: ${rule.name}: ${match[0]}`);
    }
  }
  assert.deepEqual(failures, []);
});

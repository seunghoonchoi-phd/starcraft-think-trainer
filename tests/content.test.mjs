import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecision, goalForPhase, priorityForTime, PRIORITY_GUIDE, TUTORIAL_CASES } from '../js/content.js';

function seededRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test('decision always has three unique choices and one answer key', () => {
  const decision = createDecision('balance', { random: seededRandom([0.1, 0.7, 0.3, 0.9]) });
  assert.equal(decision.options.length, 3);
  assert.equal(new Set(decision.options.map((item) => item.id)).size, 3);
  assert.ok(['KeyQ', 'KeyW', 'KeyE'].includes(decision.correctCode));
  assert.equal(decision.options.filter((item) => item.id === decision.correctId).length, 1);
  assert.ok(decision.issues.every((issue) => issue.visual && issue.visual.metric && issue.visual.description));
});

test('switch phase rotates explicit goals', () => {
  assert.equal(goalForPhase('switch', 0), 'survive');
  assert.equal(goalForPhase('switch', 16), 'grow');
  assert.equal(goalForPhase('switch', 32), 'attack');
  assert.equal(goalForPhase('dual', 50), 'balance');
});

test('decision keys follow the left-to-right situation order', () => {
  const decision = createDecision('balance', { random: () => 0.25 });
  assert.deepEqual(decision.options.map((item) => item.code), ['KeyQ', 'KeyW', 'KeyE']);
  assert.deepEqual(decision.options.map((item) => item.id), decision.issues.map((item) => item.id));
  assert.deepEqual(decision.options.map((item) => item.positionLabel), ['왼쪽', '가운데', '오른쪽']);
});

test('priority phase rotates all three priorities', () => {
  assert.equal(priorityForTime(0), '입력 우선');
  assert.equal(priorityForTime(20), '판단 우선');
  assert.equal(priorityForTime(40), '동일 비중');
});

test('tutorial presents every situation without a timer and explains each answer', () => {
  assert.equal(PRIORITY_GUIDE.length, 6);
  assert.deepEqual(PRIORITY_GUIDE.map((item) => item.rank), ['01', '02', '03', '04', '05', '06']);
  assert.equal(TUTORIAL_CASES.length, 6);
  for (const item of TUTORIAL_CASES) {
    assert.ok(item.prompt);
    assert.ok(item.reason);
    assert.ok(item.options.some((option) => option.id === item.correctId));
  }
});

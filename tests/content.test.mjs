import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecision, goalForPhase, priorityForTime } from '../js/content.js';

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
});

test('switch phase rotates explicit goals', () => {
  assert.equal(goalForPhase('switch', 0), 'survive');
  assert.equal(goalForPhase('switch', 16), 'grow');
  assert.equal(goalForPhase('switch', 32), 'attack');
  assert.equal(goalForPhase('dual', 50), 'balance');
});

test('priority phase rotates all three priorities', () => {
  assert.equal(priorityForTime(0), '손 우선');
  assert.equal(priorityForTime(20), '판단 우선');
  assert.equal(priorityForTime(40), '균형');
});

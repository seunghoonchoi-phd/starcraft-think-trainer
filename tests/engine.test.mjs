import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASES,
  adjustMotorInterval,
  blankStats,
  createMotorCommand,
  computeSessionSummary,
  median,
  summarizePhase
} from '../js/engine.js';

test('real session is exactly 600 seconds', () => {
  assert.equal(PHASES.reduce((sum, phase) => sum + phase.seconds, 0), 600);
});

test('median handles odd, even, and empty samples', () => {
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.equal(median([]), 0);
});

test('phase summary rewards valid completed actions, not noise', () => {
  const summary = summarizePhase({
    elapsedSeconds: 60,
    validActions: 30,
    motorAttempts: 40,
    noiseInputs: 120,
    decisionAttempts: 0,
    correctDecisions: 0,
    decisionTimes: []
  });
  assert.equal(summary.actionRate, 30);
  assert.equal(summary.motorAccuracy, 0.75);
  assert.equal(summary.noiseInputs, 120);
});

test('adaptive tempo changes only when both channels justify it', () => {
  assert.equal(adjustMotorInterval(1000, 0.94, 0.88), 930);
  assert.equal(adjustMotorInterval(1000, 0.95, 0.6), 1100);
  assert.equal(adjustMotorInterval(1000, 0.85, 0.75), 1000);
});

test('motor command provides one number key before a click', () => {
  const first = createMotorCommand(0, 'motor');
  const transfer = createMotorCommand(0, 'transfer');
  assert.deepEqual(first, { groupCode: 'Digit1' });
  assert.deepEqual(transfer, { groupCode: 'Digit3' });
});

test('session summary separates motor and thinking retention', () => {
  const phases = Object.fromEntries(PHASES.map((phase) => [phase.id, blankStats()]));
  phases.motor = { ...blankStats(), elapsedSeconds: 60, validActions: 40, motorAttempts: 44 };
  phases.decision = { ...blankStats(), elapsedSeconds: 40, decisionAttempts: 10, correctDecisions: 9, decisionTimes: Array(10).fill(1000) };
  for (const id of ['dual', 'priority', 'switch', 'inhibit']) {
    phases[id] = { ...blankStats(), elapsedSeconds: 60, validActions: 32, motorAttempts: 38, decisionAttempts: 10, correctDecisions: 8, decisionTimes: Array(10).fill(1200) };
  }
  phases.transfer = { ...blankStats(), elapsedSeconds: 110, validActions: 30, motorAttempts: 40, decisionAttempts: 10, correctDecisions: 7, decisionTimes: Array(10).fill(1300) };
  const summary = computeSessionSummary(phases);
  assert.ok(summary.motorRetention > 0.75 && summary.motorRetention < 0.85);
  assert.ok(summary.thinkingRetention > 0.7 && summary.thinkingRetention < 0.8);
  assert.equal(summary.combined.decisionAccuracy, 0.8);
  assert.equal(summary.transfer.decisionAccuracy, 0.7);
});

test('retention is unavailable when a baseline has no valid performance', () => {
  const phases = Object.fromEntries(PHASES.map((phase) => [phase.id, blankStats()]));
  const summary = computeSessionSummary(phases);
  assert.equal(summary.motorRetention, null);
  assert.equal(summary.thinkingRetention, null);
});

test('fast wrong answers cannot hide a loss of decision accuracy', () => {
  const phases = Object.fromEntries(PHASES.map((phase) => [phase.id, blankStats()]));
  phases.motor = { ...blankStats(), elapsedSeconds: 60, validActions: 40, motorAttempts: 40 };
  phases.decision = {
    ...blankStats(),
    elapsedSeconds: 40,
    decisionAttempts: 10,
    correctDecisions: 10,
    decisionTimes: Array(10).fill(1000)
  };
  for (const id of ['dual', 'priority', 'switch', 'inhibit']) {
    phases[id] = {
      ...blankStats(),
      elapsedSeconds: 60,
      validActions: 40,
      motorAttempts: 40,
      decisionAttempts: 10,
      correctDecisions: 2,
      decisionTimes: Array(10).fill(200)
    };
  }

  const summary = computeSessionSummary(phases);
  assert.equal(summary.efficiencyRetention, 1);
  assert.equal(summary.accuracyRetention, 0.2);
  assert.equal(summary.thinkingRetention, 0.2);
});

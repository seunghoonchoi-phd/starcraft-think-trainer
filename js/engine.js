export const PHASES = [
  { id: 'prepare', name: '준비', seconds: 20, mode: 'none' },
  { id: 'motor', name: '손 기준선', seconds: 60, mode: 'motor' },
  { id: 'decision', name: '판단 기준선', seconds: 40, mode: 'decision' },
  { id: 'dual', name: '둘을 같이', seconds: 120, mode: 'dual' },
  { id: 'priority', name: '우선순위', seconds: 120, mode: 'dual' },
  { id: 'switch', name: '규칙 전환', seconds: 70, mode: 'dual' },
  { id: 'inhibit', name: '멈춤', seconds: 60, mode: 'dual' },
  { id: 'transfer', name: '새 조합', seconds: 110, mode: 'dual' }
];

export const DEMO_PHASES = PHASES.map((phase) => ({
  ...phase,
  seconds: phase.id === 'prepare' ? 3 : 6
}));

export const MOTOR_ORDERS = {
  practice: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
  transfer: ['Digit4', 'Digit2', 'Digit1', 'Digit3']
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function safeRatio(value, baseline, fallback = 0) {
  return baseline > 0 ? value / baseline : fallback;
}

export function summarizePhase(stats = {}) {
  const elapsedSeconds = Math.max(1, stats.elapsedSeconds || 0);
  const motorAttempts = stats.motorAttempts || 0;
  const decisionAttempts = stats.decisionAttempts || 0;
  const validActions = stats.validActions || 0;
  const motorAccuracy = motorAttempts ? validActions / motorAttempts : 0;
  const decisionAccuracy = decisionAttempts ? (stats.correctDecisions || 0) / decisionAttempts : 0;
  const actionRate = validActions / elapsedSeconds * 60;
  const decisionMedianMs = median(stats.decisionTimes || []);
  const decisionEfficiency = decisionMedianMs > 0 ? decisionAccuracy / (decisionMedianMs / 1000) : 0;
  return {
    ...stats,
    motorAccuracy,
    decisionAccuracy,
    actionRate,
    decisionMedianMs,
    decisionEfficiency
  };
}

export function computeSessionSummary(rawByPhase) {
  const phases = Object.fromEntries(Object.entries(rawByPhase).map(([id, value]) => [id, summarizePhase(value)]));
  const motor = phases.motor || summarizePhase();
  const decision = phases.decision || summarizePhase();
  const combinedRaw = ['dual', 'priority', 'switch', 'inhibit'].reduce((acc, id) => {
    const source = rawByPhase[id] || {};
    acc.elapsedSeconds += source.elapsedSeconds || 0;
    acc.validActions += source.validActions || 0;
    acc.motorAttempts += source.motorAttempts || 0;
    acc.noiseInputs += source.noiseInputs || 0;
    acc.decisionAttempts += source.decisionAttempts || 0;
    acc.correctDecisions += source.correctDecisions || 0;
    acc.decisionTimes.push(...(source.decisionTimes || []));
    return acc;
  }, blankStats());
  const combined = summarizePhase(combinedRaw);
  const transfer = phases.transfer || summarizePhase();
  const motorRetention = motor.actionRate > 0 ? clamp(safeRatio(combined.actionRate, motor.actionRate), 0, 1.25) : null;
  const thinkingRetention = decision.decisionEfficiency > 0 ? clamp(safeRatio(combined.decisionEfficiency, decision.decisionEfficiency), 0, 1.25) : null;
  const accuracyRetention = decision.decisionAccuracy > 0 ? clamp(safeRatio(combined.decisionAccuracy, decision.decisionAccuracy), 0, 1.25) : null;
  return {
    phases,
    baseline: { motor, decision },
    combined,
    transfer,
    motorRetention,
    thinkingRetention,
    accuracyRetention,
    profile: classifyProfile({ motor, decision, combined, motorRetention, thinkingRetention })
  };
}

export function classifyProfile({ motor, decision, combined, motorRetention, thinkingRetention }) {
  if (motor.motorAccuracy < 0.78 || motor.actionRate < 12) {
    return { id: 'motor', title: '손 순서부터 묶을 때입니다', advice: '속도를 올리기 전에 1→2→3→4 순서를 정확히 끝내세요. 다음 세션은 손 정확도 90%를 먼저 노립니다.' };
  }
  if (decision.decisionAccuracy < 0.7) {
    return { id: 'decision', title: '판단 규칙부터 가볍게 만드세요', advice: '손을 쉬게 해도 선택이 흔들렸습니다. 피로를 확인하고, 화면의 우선순위 규칙을 천천히 익힌 뒤 다시 합치세요.' };
  }
  if (motorRetention < 0.75 || thinkingRetention < 0.72) {
    return { id: 'dual', title: '둘을 합칠 때 병목이 생깁니다', advice: '손과 판단은 따로 할 수 있지만 함께하면 한쪽이 크게 줄었습니다. 평소 속도의 80~85%에서 두 축을 같이 지키는 연습이 맞습니다.' };
  }
  if ((combined.noiseInputs || 0) > (combined.validActions || 0) * 0.35) {
    return { id: 'noise', title: '빠르지만 헛입력이 많습니다', advice: '원시 입력 수는 높지만 끝까지 맞게 수행한 동작이 적습니다. 반복키와 선입력을 줄이면 판단할 틈도 같이 늘어납니다.' };
  }
  return { id: 'balanced', title: '손과 판단을 함께 잘 지켰습니다', advice: '다음 세션에서는 속도보다 새 조합 정확도를 올리세요. 실제 게임에서는 교전 중 생산 공백이 줄었는지 따로 확인합니다.' };
}

export function adjustMotorInterval(currentMs, motorAccuracy, decisionAccuracy) {
  if (motorAccuracy >= 0.9 && decisionAccuracy >= 0.82) return clamp(currentMs - 70, 520, 1600);
  if (motorAccuracy < 0.78 || decisionAccuracy < 0.68) return clamp(currentMs + 100, 520, 1600);
  return currentMs;
}

export function blankStats() {
  return {
    elapsedSeconds: 0,
    validActions: 0,
    motorAttempts: 0,
    noiseInputs: 0,
    stopTrials: 0,
    stopSuccesses: 0,
    decisionAttempts: 0,
    correctDecisions: 0,
    decisionTimes: []
  };
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function keyLabel(code) {
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}

export function shuffle(items, random = Math.random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

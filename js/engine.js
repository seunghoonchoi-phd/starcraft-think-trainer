export const PHASES = [
  { id: 'prepare', name: '준비', seconds: 20, mode: 'none' },
  { id: 'motor', name: '입력 기준선', seconds: 60, mode: 'motor' },
  { id: 'decision', name: '판단 기준선', seconds: 40, mode: 'decision' },
  { id: 'dual', name: '동시 수행', seconds: 120, mode: 'dual' },
  { id: 'priority', name: '우선 과제 변경', seconds: 120, mode: 'dual' },
  { id: 'switch', name: '판단 규칙 변경', seconds: 70, mode: 'dual' },
  { id: 'inhibit', name: '입력 억제', seconds: 60, mode: 'dual' },
  { id: 'transfer', name: '변경 조건 검사', seconds: 110, mode: 'dual' }
];

export const DEMO_PHASES = PHASES.map((phase) => ({
  ...phase,
  seconds: phase.id === 'prepare' ? 3 : 6
}));

export const MOTOR_ORDERS = {
  practice: ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  transfer: ['KeyF', 'KeyD', 'KeyA', 'KeyS']
};

export const MOTOR_COMMANDS = {
  KeyA: { id: 'advance', code: 'KeyS', symbol: '▲', label: '전진' },
  KeyS: { id: 'hold', code: 'KeyD', symbol: '■', label: '고정' },
  KeyD: { id: 'scan', code: 'KeyF', symbol: '○', label: '탐색' },
  KeyF: { id: 'shift', code: 'KeyG', symbol: '◆', label: '이동' }
};

export function createMotorCommand(index, phaseId) {
  const order = phaseId === 'transfer' ? MOTOR_ORDERS.transfer : MOTOR_ORDERS.practice;
  const groupCode = order[index % order.length];
  const action = MOTOR_COMMANDS[groupCode];
  return {
    groupCode,
    actionCode: action.code,
    actionSymbol: action.symbol,
    actionLabel: action.label
  };
}

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
  const efficiencyRetention = decision.decisionEfficiency > 0 ? clamp(safeRatio(combined.decisionEfficiency, decision.decisionEfficiency), 0, 1.25) : null;
  const accuracyRetention = decision.decisionAccuracy > 0 ? clamp(safeRatio(combined.decisionAccuracy, decision.decisionAccuracy), 0, 1.25) : null;
  const thinkingRetention = efficiencyRetention !== null && accuracyRetention !== null
    ? Math.min(efficiencyRetention, accuracyRetention)
    : null;
  return {
    phases,
    baseline: { motor, decision },
    combined,
    transfer,
    motorRetention,
    efficiencyRetention,
    thinkingRetention,
    accuracyRetention,
    profile: classifyProfile({ motor, decision, combined, motorRetention, thinkingRetention })
  };
}

export function classifyProfile({ motor, decision, combined, motorRetention, thinkingRetention }) {
  if (motor.motorAccuracy < 0.78 || motor.actionRate < 12) {
    return { id: 'motor', title: '사용자는 왼손 입력과 클릭 순서를 먼저 연습해야 합니다', advice: '사용자의 입력 정확도가 기준보다 낮았습니다. 사용자는 다음 세션에서 속도를 올리지 말고 표적에 표시된 A, S, D, F, G 키를 같은 줄에서 차례로 누른 뒤 표적을 클릭해야 합니다. 사용자는 입력 정확도 90%를 목표로 연습해야 합니다.' };
  }
  if (decision.decisionAccuracy < 0.7) {
    return { id: 'decision', title: '사용자는 우선순위 규칙을 먼저 익혀야 합니다', advice: '사용자가 입력 과제를 하지 않은 구간에서도 판단 정확도가 기준보다 낮았습니다. 사용자는 피로 상태와 화면에 표시된 우선순위 규칙을 확인한 뒤 판단 과제를 다시 수행해야 합니다.' };
  }
  if (motorRetention < 0.75 || thinkingRetention < 0.72) {
    return { id: 'dual', title: '두 과제를 함께 수행할 때 성적이 낮아졌습니다', advice: '두 과제를 함께 수행한 구간에서 사용자의 입력 속도나 판단 성적 중 하나가 기준선보다 많이 낮아졌습니다. 사용자는 다음 세션에서 입력 속도를 기준선의 80~85%로 유지하면서 판단 문제를 함께 풀어야 합니다.' };
  }
  if ((combined.noiseInputs || 0) > (combined.validActions || 0) * 0.35) {
    return { id: 'noise', title: '사용자의 잘못된 입력 횟수가 많았습니다', advice: '사용자의 전체 입력 수는 많았지만, 사용자가 두 키와 클릭을 정확한 순서로 완료한 횟수는 적었습니다. 사용자는 다음 세션에서 반복 입력과 앱이 표적을 표시하기 전에 누르는 키를 줄이고, 화면에 표시된 순서만 입력해야 합니다.' };
  }
  return { id: 'balanced', title: '사용자가 입력 속도와 판단 성적을 함께 유지했습니다', advice: '사용자는 다음 세션에서 변경 조건 검사의 판단 정확도를 높여야 합니다. 사용자는 실제 게임 리플레이를 열어 교전 중 생산 공백 시간이 줄었는지 따로 확인해야 합니다.' };
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
  if (!Number.isFinite(value)) return '측정 불가';
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

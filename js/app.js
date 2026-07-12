import {
  PHASES,
  DEMO_PHASES,
  MOTOR_ORDERS,
  adjustMotorInterval,
  blankStats,
  computeSessionSummary,
  formatPercent,
  keyLabel,
  summarizePhase
} from './engine.js';
import { createDecision, goalForPhase, priorityForTime, GOALS } from './content.js';

const STORAGE_KEY = 'think-hands-trainer-v1';
const $ = (selector) => document.querySelector(selector);
const elements = {
  app: $('#app'),
  startPanel: $('#start-panel'),
  playPanel: $('#play-panel'),
  resultPanel: $('#result-panel'),
  startButton: $('#start-button'),
  demoButton: $('#demo-button'),
  restartButton: $('#restart-button'),
  exportButton: $('#export-button'),
  installButton: $('#install-button'),
  totalTime: $('#total-time'),
  phaseTime: $('#phase-time'),
  phaseNumber: $('#phase-number'),
  phaseName: $('#phase-name'),
  phaseList: $('#phase-list'),
  priorityChip: $('#priority-chip'),
  liveActions: $('#live-actions'),
  liveMotorAccuracy: $('#live-motor-accuracy'),
  liveDecisionAccuracy: $('#live-decision-accuracy'),
  liveNoise: $('#live-noise'),
  mapBoard: $('#map-board'),
  mapMessage: $('#map-message'),
  motorTarget: $('#motor-target'),
  targetKey: $('#target-key'),
  motorOrder: $('#motor-order'),
  decisionCard: $('#decision-card'),
  decisionRule: $('#decision-rule'),
  issueList: $('#issue-list'),
  decisionOptions: $('#decision-options'),
  decisionFeedback: $('#decision-feedback'),
  coachLine: $('#coach-line'),
  pauseButton: $('#pause-button'),
  pauseOverlay: $('#pause-overlay'),
  resumeButton: $('#resume-button'),
  resultTitle: $('#result-title'),
  resultSummary: $('#result-summary'),
  resultMotor: $('#result-motor'),
  resultThinking: $('#result-thinking'),
  resultTransfer: $('#result-transfer'),
  resultDetail: $('#result-detail'),
  historyChart: $('#history-chart'),
  fatigueSelect: $('#fatigue-select'),
  gameSelect: $('#game-select')
};

const session = {
  running: false,
  paused: false,
  demo: false,
  phases: PHASES,
  phaseIndex: 0,
  phaseRemaining: 0,
  totalRemaining: 600,
  phaseElapsed: 0,
  lastTick: 0,
  stats: {},
  motorInterval: 1150,
  motorTimer: 0,
  decisionTimer: 0,
  currentTarget: null,
  currentDecision: null,
  motorIndex: 0,
  priority: '균형',
  summary: null
};

function loadStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && Array.isArray(value.records)) return value;
  } catch (_) {}
  return { records: [] };
}

function saveRecord(summary) {
  const store = loadStore();
  store.records.push({
    date: new Date().toISOString(),
    game: elements.gameSelect.value,
    fatigue: elements.fatigueSelect.value,
    motorRetention: summary.motorRetention,
    thinkingRetention: summary.thinkingRetention,
    transferAccuracy: summary.transfer.decisionAccuracy,
    profile: summary.profile.id
  });
  store.records = store.records.slice(-30);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function renderHistory() {
  const records = loadStore().records.filter((record) => Number.isFinite(record.thinkingRetention)).slice(-10);
  if (!records.length) {
    elements.historyChart.innerHTML = '<p>첫 세션을 끝내면 최근 기록이 여기에 쌓입니다.</p>';
    return;
  }
  elements.historyChart.innerHTML = records.map((record) => {
    const value = Math.max(8, Math.min(100, Math.round(record.thinkingRetention * 100)));
    const label = new Date(record.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    return `<div class="history-bar" style="height:${value}%" title="${label} 생각 보존율 ${value}%"><span>${value}</span></div>`;
  }).join('');
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function activePhase() {
  return session.phases[session.phaseIndex];
}

function hasMotor(phase = activePhase()) {
  return phase && (phase.mode === 'motor' || phase.mode === 'dual');
}

function hasDecision(phase = activePhase()) {
  return phase && (phase.mode === 'decision' || phase.mode === 'dual');
}

function startSession(demo = false) {
  const qaMode = new URLSearchParams(location.search).get('qa') === '1';
  session.running = true;
  session.paused = false;
  session.demo = demo;
  session.phases = qaMode ? PHASES.map((phase) => ({ ...phase, seconds: 1.5 })) : (demo ? DEMO_PHASES : PHASES);
  session.phaseIndex = 0;
  session.totalRemaining = session.phases.reduce((sum, phase) => sum + phase.seconds, 0);
  session.stats = {};
  session.motorInterval = demo ? 850 : 1150;
  session.summary = null;
  elements.startPanel.hidden = true;
  elements.resultPanel.hidden = true;
  elements.playPanel.hidden = false;
  elements.app.dataset.state = 'playing';
  elements.app.scrollIntoView({ block: 'start', behavior: 'smooth' });
  elements.phaseList.querySelectorAll('li').forEach((item) => item.classList.remove('active', 'done'));
  setupPhase();
  session.lastTick = performance.now();
  requestAnimationFrame(tick);
  elements.mapBoard.focus({ preventScroll: true });
}

function setupPhase() {
  clearPhaseTimers();
  const phase = activePhase();
  session.phaseRemaining = phase.seconds;
  session.phaseElapsed = 0;
  session.motorIndex = 0;
  session.stats[phase.id] = blankStats();
  elements.phaseNumber.textContent = String(session.phaseIndex + 1).padStart(2, '0');
  elements.phaseName.textContent = phase.name;
  elements.phaseTime.textContent = formatClock(session.phaseRemaining);
  elements.priorityChip.textContent = phase.id === 'priority' ? '손 우선' : (phase.id === 'switch' ? GOALS.survive.label : '균형');
  elements.motorOrder.textContent = phase.id === 'transfer' ? '4 → 2 → 1 → 3' : '1 → 2 → 3 → 4';
  elements.mapMessage.hidden = hasMotor(phase);
  elements.mapMessage.innerHTML = phase.id === 'prepare'
    ? '<strong>정확도가 먼저입니다</strong><span>맞는 숫자 키를 누른 뒤 표적을 클릭하세요.</span>'
    : '<strong>판단 기준선</strong><span>지금은 손을 쉬고 판단 카드만 풉니다.</span>';
  elements.decisionCard.hidden = true;
  elements.motorTarget.hidden = true;
  elements.decisionFeedback.textContent = '';
  updatePhaseRail();
  updateCoach();
  updateLiveMetrics();

  if (hasMotor(phase)) {
    spawnMotorTarget();
    scheduleMotor();
  }
  if (hasDecision(phase)) scheduleDecision(phase.id === 'decision' ? 400 : 900);
}

function updatePhaseRail() {
  elements.phaseList.querySelectorAll('li').forEach((item, index) => {
    item.classList.toggle('active', index === session.phaseIndex);
    item.classList.toggle('done', index < session.phaseIndex);
  });
}

function updateCoach() {
  const phase = activePhase();
  const lines = {
    prepare: '곧 손과 판단을 따로 잽니다. 속도를 억지로 올리지 마세요.',
    motor: '숫자 키를 누른 뒤 표적을 클릭해야 유효 동작입니다.',
    decision: '화면의 규칙 안에서 가장 먼저 처리할 일을 고르세요.',
    dual: '손 순환을 멈추지 말고 판단 카드를 함께 처리하세요.',
    priority: '한쪽 우선이라고 다른 한쪽을 완전히 버리면 안 됩니다.',
    switch: '상단 목표가 바뀌면 같은 상황의 우선순위도 달라집니다.',
    inhibit: '빨간 STOP 표적에서는 아무 키도 누르지 마세요.',
    transfer: '순서가 4→2→1→3으로 바뀝니다. 지금은 정답 피드백이 없습니다.'
  };
  elements.coachLine.textContent = lines[phase.id];
}

function clearPhaseTimers() {
  window.clearTimeout(session.motorTimer);
  window.clearTimeout(session.decisionTimer);
  session.motorTimer = 0;
  session.decisionTimer = 0;
  expireTarget();
  session.currentDecision = null;
}

function scheduleMotor() {
  window.clearTimeout(session.motorTimer);
  session.motorTimer = window.setTimeout(() => {
    if (!session.running || session.paused || !hasMotor()) return;
    spawnMotorTarget();
    scheduleMotor();
  }, session.motorInterval);
}

function spawnMotorTarget() {
  expireTarget();
  const phase = activePhase();
  if (!phase || !hasMotor(phase)) return;
  const stats = session.stats[phase.id];
  const order = phase.id === 'transfer' ? MOTOR_ORDERS.transfer : MOTOR_ORDERS.practice;
  const code = order[session.motorIndex % order.length];
  session.motorIndex += 1;
  const stop = phase.id === 'inhibit' && Math.random() < 0.24;
  session.currentTarget = { code, keyed: false, stop, violated: false, resolved: false, spawnAt: performance.now() };
  if (stop) stats.stopTrials += 1;
  else stats.motorAttempts += 1;
  elements.motorTarget.hidden = false;
  elements.motorTarget.classList.toggle('stop', stop);
  elements.motorTarget.classList.remove('keyed');
  elements.targetKey.textContent = stop ? 'STOP' : keyLabel(code);
  const x = 15 + Math.random() * 70;
  const y = 17 + Math.random() * 66;
  elements.motorTarget.style.left = `${x}%`;
  elements.motorTarget.style.top = `${y}%`;
}

function expireTarget() {
  const target = session.currentTarget;
  if (!target) return;
  if (target.stop && !target.violated) session.stats[activePhase().id].stopSuccesses += 1;
  elements.motorTarget.hidden = true;
  elements.motorTarget.classList.remove('keyed', 'stop');
  session.currentTarget = null;
}

function handleMotorKey(code) {
  if (!session.running || session.paused || !hasMotor()) return false;
  if (!code.startsWith('Digit')) return false;
  const stats = session.stats[activePhase().id];
  const target = session.currentTarget;
  if (!target || target.resolved) {
    stats.noiseInputs += 1;
    updateLiveMetrics();
    return true;
  }
  if (target.stop) {
    target.violated = true;
    stats.noiseInputs += 1;
    elements.motorTarget.hidden = true;
    updateLiveMetrics();
    return true;
  }
  if (code === target.code && !target.keyed) {
    target.keyed = true;
    elements.motorTarget.classList.add('keyed');
  } else {
    stats.noiseInputs += 1;
  }
  updateLiveMetrics();
  return true;
}

function handleTargetClick() {
  if (!session.running || session.paused || !hasMotor()) return;
  const target = session.currentTarget;
  const stats = session.stats[activePhase().id];
  if (!target) return;
  if (target.stop) {
    target.violated = true;
    stats.noiseInputs += 1;
  } else if (target.keyed && !target.resolved) {
    target.resolved = true;
    stats.validActions += 1;
    elements.motorTarget.hidden = true;
  } else {
    stats.noiseInputs += 1;
  }
  updateLiveMetrics();
}

function scheduleDecision(delay = 900) {
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => {
    if (!session.running || session.paused || !hasDecision()) return;
    showDecision();
  }, delay);
}

function showDecision() {
  if (session.currentDecision) closeDecision(false);
  const phase = activePhase();
  const goalId = goalForPhase(phase.id, session.phaseElapsed);
  session.currentDecision = {
    ...createDecision(goalId, { transfer: phase.id === 'transfer' }),
    shownAt: performance.now(),
    answered: false
  };
  const decision = session.currentDecision;
  elements.priorityChip.textContent = phase.id === 'priority' ? session.priority : decision.goalLabel;
  elements.decisionRule.textContent = decision.rule;
  elements.issueList.innerHTML = decision.issues.map((issue) => `<li>${issue.text}</li>`).join('');
  elements.decisionOptions.innerHTML = decision.options.map((option) => `
    <button class="decision-option" type="button" data-code="${option.code}">
      <kbd>${keyLabel(option.code)}</kbd><span>${option.label}</span>
    </button>`).join('');
  elements.decisionOptions.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => answerDecision(button.dataset.code));
  });
  elements.decisionFeedback.textContent = '';
  elements.decisionFeedback.className = 'decision-feedback';
  elements.decisionCard.hidden = false;
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => closeDecision(false), 4200);
}

function answerDecision(code) {
  const decision = session.currentDecision;
  if (!decision || decision.answered || !hasDecision()) return false;
  if (!['KeyQ', 'KeyW', 'KeyE'].includes(code)) return false;
  decision.answered = true;
  const stats = session.stats[activePhase().id];
  const responseMs = performance.now() - decision.shownAt;
  const correct = code === decision.correctCode;
  stats.decisionAttempts += 1;
  stats.decisionTimes.push(responseMs);
  if (correct) stats.correctDecisions += 1;
  if (activePhase().id !== 'transfer') {
    elements.decisionFeedback.textContent = correct ? `정확합니다. ${decision.reason}` : `지금은 ${decision.correctLabel}이 먼저입니다.`;
    elements.decisionFeedback.classList.toggle('wrong', !correct);
  }
  updateLiveMetrics();
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => closeDecision(true), activePhase().id === 'transfer' ? 180 : 520);
  return true;
}

function closeDecision(answered) {
  if (!session.currentDecision) return;
  if (!answered && !session.currentDecision.answered) {
    session.stats[activePhase().id].decisionAttempts += 1;
    if (activePhase().id !== 'transfer') {
      elements.decisionFeedback.textContent = '시간 안에 고르지 못했습니다.';
      elements.decisionFeedback.classList.add('wrong');
    }
  }
  session.currentDecision = null;
  elements.decisionCard.hidden = true;
  updateLiveMetrics();
  if (session.running && !session.paused && hasDecision()) scheduleDecision(700 + Math.random() * 650);
}

function updateLiveMetrics() {
  const phase = activePhase();
  if (!phase || !session.stats[phase.id]) return;
  const stats = summarizePhase({ ...session.stats[phase.id], elapsedSeconds: Math.max(1, session.phaseElapsed) });
  elements.liveActions.textContent = Math.round(stats.actionRate || 0);
  elements.liveMotorAccuracy.textContent = stats.motorAttempts ? formatPercent(stats.motorAccuracy) : '—';
  elements.liveDecisionAccuracy.textContent = stats.decisionAttempts ? formatPercent(stats.decisionAccuracy) : '—';
  elements.liveNoise.textContent = String(stats.noiseInputs || 0);
}

function tick(now) {
  if (!session.running) return;
  if (session.paused) {
    session.lastTick = now;
    requestAnimationFrame(tick);
    return;
  }
  const delta = Math.min(0.25, (now - session.lastTick) / 1000);
  session.lastTick = now;
  session.phaseRemaining -= delta;
  session.totalRemaining -= delta;
  session.phaseElapsed += delta;
  const phase = activePhase();
  session.stats[phase.id].elapsedSeconds = session.phaseElapsed;
  elements.phaseTime.textContent = formatClock(session.phaseRemaining);
  elements.totalTime.textContent = formatClock(session.totalRemaining);

  if (phase.id === 'priority') {
    session.priority = priorityForTime(session.phaseElapsed);
    elements.priorityChip.textContent = session.priority;
  } else if (phase.id === 'switch' && !session.currentDecision) {
    elements.priorityChip.textContent = GOALS[goalForPhase(phase.id, session.phaseElapsed)].label;
  }

  if (session.phaseRemaining <= 0) {
    advancePhase();
  } else {
    if (Math.floor(session.phaseElapsed * 2) % 2 === 0) updateLiveMetrics();
    requestAnimationFrame(tick);
  }
}

function advancePhase() {
  const completed = activePhase();
  session.stats[completed.id].elapsedSeconds = completed.seconds;
  if (['dual', 'priority'].includes(completed.id)) {
    const block = summarizePhase(session.stats[completed.id]);
    session.motorInterval = adjustMotorInterval(session.motorInterval, block.motorAccuracy, block.decisionAccuracy);
  }
  clearPhaseTimers();
  if (session.phaseIndex >= session.phases.length - 1) {
    finishSession();
    return;
  }
  session.phaseIndex += 1;
  setupPhase();
  session.lastTick = performance.now();
  requestAnimationFrame(tick);
}

function finishSession() {
  session.running = false;
  session.paused = false;
  clearPhaseTimers();
  session.summary = computeSessionSummary(session.stats);
  if (!session.demo) saveRecord(session.summary);
  renderResult(session.summary);
  renderHistory();
  elements.playPanel.hidden = true;
  elements.resultPanel.hidden = false;
  elements.app.dataset.state = 'result';
  elements.phaseList.querySelectorAll('li').forEach((item) => item.classList.add('done'));
  elements.totalTime.textContent = '00:00';
}

function renderResult(summary) {
  const profile = summary.profile;
  elements.resultTitle.textContent = profile.title;
  elements.resultSummary.textContent = session.demo
    ? `45초 체험 결과입니다. ${profile.advice}`
    : profile.advice;
  elements.resultMotor.textContent = formatPercent(summary.motorRetention);
  elements.resultThinking.textContent = formatPercent(summary.thinkingRetention);
  elements.resultTransfer.textContent = summary.transfer.decisionAttempts ? formatPercent(summary.transfer.decisionAccuracy) : '자료 부족';
  const baselineRate = Math.round(summary.baseline.motor.actionRate);
  const combinedRate = Math.round(summary.combined.actionRate);
  const baselineDecision = formatPercent(summary.baseline.decision.decisionAccuracy);
  const combinedDecision = formatPercent(summary.combined.decisionAccuracy);
  elements.resultDetail.innerHTML = `손 기준선은 분당 <strong>${baselineRate}</strong>개, 손과 판단을 합쳤을 때는 <strong>${combinedRate}</strong>개였습니다. 판단 정확도는 <strong>${baselineDecision}</strong>에서 <strong>${combinedDecision}</strong>로 바뀌었습니다. 앱 안 수치가 올라도 실제 게임 전이는 리플레이에서 따로 확인해야 합니다.`;
}

function pauseSession(auto = false) {
  if (!session.running || session.paused) return;
  session.paused = true;
  window.clearTimeout(session.motorTimer);
  window.clearTimeout(session.decisionTimer);
  elements.pauseOverlay.hidden = false;
  elements.pauseOverlay.querySelector('p').textContent = auto ? '탭을 벗어난 시간은 기록하지 않습니다.' : '쉬는 시간은 기록하지 않습니다.';
}

function resumeSession() {
  if (!session.running || !session.paused) return;
  session.paused = false;
  elements.pauseOverlay.hidden = true;
  session.lastTick = performance.now();
  if (hasMotor()) scheduleMotor();
  if (hasDecision() && !session.currentDecision) scheduleDecision(700);
  elements.mapBoard.focus({ preventScroll: true });
}

function exportRecords() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), ...loadStore() }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `think-hands-records-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

elements.startButton.addEventListener('click', () => startSession(false));
elements.demoButton.addEventListener('click', () => startSession(true));
elements.restartButton.addEventListener('click', () => {
  elements.resultPanel.hidden = true;
  elements.startPanel.hidden = false;
  elements.app.dataset.state = 'idle';
  elements.totalTime.textContent = '10:00';
});
elements.exportButton.addEventListener('click', exportRecords);
elements.motorTarget.addEventListener('click', handleTargetClick);
elements.pauseButton.addEventListener('click', () => pauseSession(false));
elements.resumeButton.addEventListener('click', resumeSession);

window.addEventListener('keydown', (event) => {
  if (event.repeat || !session.running || session.paused) return;
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE'].includes(event.code)) event.preventDefault();
  if (answerDecision(event.code)) return;
  handleMotorKey(event.code);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseSession(true);
});

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
  elements.installButton.hidden = false;
});
elements.installButton.addEventListener('click', async () => {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  deferredInstall = null;
  elements.installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

renderHistory();

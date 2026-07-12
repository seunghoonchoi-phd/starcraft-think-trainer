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
const BASE_TITLE = '스타크래프트 입력·판단 훈련';
const DECISION_READING_MS = 3000;
const DECISION_ANSWER_MS = 4200;
const $ = (selector) => document.querySelector(selector);
const elements = {
  pageViews: [...document.querySelectorAll('.page-view[data-page]')],
  app: $('#app'),
  startPanel: $('#start-panel'),
  playPanel: $('#play-panel'),
  resultPanel: $('#result-panel'),
  startButton: $('#start-button'),
  demoButton: $('#demo-button'),
  restartButton: $('#restart-button'),
  exportButton: $('#export-button'),
  totalTimeLabel: $('#total-time-label'),
  totalTime: $('#total-time'),
  phaseTime: $('#phase-time'),
  phaseNumber: $('#phase-number'),
  phaseName: $('#phase-name'),
  phaseList: $('#phase-list'),
  phaseButtons: [...document.querySelectorAll('.phase-button')],
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
  decisionStatus: $('#decision-status'),
  decisionRule: $('#decision-rule'),
  issueList: $('#issue-list'),
  decisionOptions: $('#decision-options'),
  decisionFeedback: $('#decision-feedback'),
  coachLine: $('#coach-line'),
  pauseButton: $('#pause-button'),
  homeButton: $('#home-button'),
  pauseOverlay: $('#pause-overlay'),
  resumeButton: $('#resume-button'),
  resultTitle: $('#result-title'),
  resultSummary: $('#result-summary'),
  resultMotor: $('#result-motor'),
  resultThinking: $('#result-thinking'),
  resultTransfer: $('#result-transfer'),
  resultDetail: $('#result-detail'),
  practiceStatus: $('#practice-status'),
  fatigueSelect: $('#fatigue-select'),
  gameSelect: $('#game-select')
};

const session = {
  running: false,
  paused: false,
  demo: false,
  practice: false,
  runId: 0,
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
  priority: '동일 비중',
  summary: null
};

let currentPage = 'trainer';

function showTrainer(focusTrainer = true) {
  if (location.hash) window.history.replaceState(null, '', `${location.pathname}${location.search}`);
  elements.pageViews.forEach((view) => {
    view.hidden = false;
    view.classList.add('is-active');
  });
  elements.pauseOverlay.hidden = !session.paused;
  document.body.dataset.currentPage = 'trainer';
  document.title = BASE_TITLE;

  if (focusTrainer) elements.pageViews[0]?.focus({ preventScroll: true });
}

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

function phasesForSession(demo, qaMode) {
  if (qaMode) return PHASES.map((phase) => ({ ...phase, seconds: 1.5 }));
  return demo ? DEMO_PHASES : PHASES;
}

function phaseNumber(phase) {
  return PHASES.findIndex((candidate) => candidate.id === phase.id) + 1;
}

function startSession(demo = false, practicePhaseId = null) {
  const qaMode = demo
    && ['127.0.0.1', 'localhost'].includes(location.hostname)
    && new URLSearchParams(location.search).get('qa') === '1';
  const allPhases = phasesForSession(demo, qaMode);
  const selectedPhase = practicePhaseId
    ? allPhases.find((phase) => phase.id === practicePhaseId)
    : null;
  if (practicePhaseId && !selectedPhase) return;
  session.runId += 1;
  clearPhaseTimers();
  session.running = true;
  session.paused = false;
  session.demo = demo;
  session.practice = Boolean(selectedPhase);
  session.phases = selectedPhase ? [selectedPhase] : allPhases;
  session.phaseIndex = 0;
  session.totalRemaining = session.phases.reduce((sum, phase) => sum + phase.seconds, 0);
  session.stats = {};
  session.motorInterval = demo ? 850 : 1150;
  session.summary = null;
  elements.startPanel.hidden = true;
  elements.resultPanel.hidden = true;
  elements.playPanel.hidden = false;
  elements.app.dataset.state = 'playing';
  elements.totalTimeLabel.textContent = session.practice ? '단계 시간' : '전체 시간';
  elements.practiceStatus.hidden = true;
  elements.phaseList.querySelectorAll('li').forEach((item) => item.classList.remove('active', 'done'));
  setupPhase();
  session.lastTick = performance.now();
  requestTick();
  elements.mapBoard.focus({ preventScroll: true });
}

function setupPhase() {
  clearPhaseTimers();
  const phase = activePhase();
  session.phaseRemaining = phase.seconds;
  session.phaseElapsed = 0;
  session.motorIndex = 0;
  session.stats[phase.id] = blankStats();
  elements.phaseNumber.textContent = String(phaseNumber(phase)).padStart(2, '0');
  elements.phaseName.textContent = phase.name;
  elements.phaseTime.textContent = formatClock(session.phaseRemaining);
  elements.priorityChip.textContent = phase.id === 'priority' ? '입력 우선' : (phase.id === 'switch' ? GOALS.survive.label : '동일 비중');
  elements.motorOrder.textContent = phase.id === 'transfer' ? '4 → 2 → 1 → 3' : '1 → 2 → 3 → 4';
  elements.mapMessage.hidden = hasMotor(phase);
  elements.mapMessage.innerHTML = phase.id === 'prepare'
    ? '<strong>앱은 정확하게 완료한 입력만 점수로 계산합니다</strong><span>사용자는 화면에 표시된 숫자 키를 누른 뒤 표적을 클릭해야 합니다.</span>'
    : '<strong>앱이 판단 기준선을 측정합니다</strong><span>사용자는 이 구간에서 숫자 키를 누르지 않고 판단 문제만 풀어야 합니다.</span>';
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
  const phase = activePhase();
  const currentNumber = phaseNumber(phase);
  elements.phaseList.querySelectorAll('li').forEach((item) => {
    const itemNumber = phaseNumber({ id: item.dataset.phase });
    const active = item.dataset.phase === phase.id;
    item.classList.toggle('active', active);
    item.classList.toggle('done', !session.practice && itemNumber < currentNumber);
    const button = item.querySelector('button');
    if (active) button?.setAttribute('aria-current', 'step');
    else button?.removeAttribute('aria-current');
  });
}

function updateCoach() {
  const phase = activePhase();
  const lines = {
    prepare: '앱은 곧 입력 과제와 판단 과제를 따로 측정합니다. 사용자는 정확도를 유지할 수 있는 속도로 입력해야 합니다.',
    motor: '사용자가 숫자 키를 누른 뒤 표적을 클릭하면 앱이 완료 동작 한 개를 기록합니다.',
    decision: '사용자는 화면에 표시된 우선순위 규칙에 따라 가장 먼저 처리할 행동을 골라야 합니다.',
    dual: '사용자는 입력 순서를 계속 수행하면서 판단 문제도 풀어야 합니다.',
    priority: '앱이 한 과제를 우선 과제로 표시해도 사용자는 다른 과제를 계속 수행해야 합니다.',
    switch: '앱이 상단 목표를 바꾸면 사용자는 새 목표에 맞는 행동을 골라야 합니다.',
    inhibit: '앱이 빨간 STOP 표적을 표시하면 사용자는 숫자 키를 누르거나 표적을 클릭하면 안 됩니다.',
    transfer: '앱이 입력 순서를 4→2→1→3으로 바꿉니다. 앱은 이 구간에서 정답을 바로 알려 주지 않습니다.'
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
    shownAt: 0,
    ready: false,
    answered: false
  };
  const decision = session.currentDecision;
  elements.priorityChip.textContent = phase.id === 'priority' ? session.priority : decision.goalLabel;
  elements.decisionRule.textContent = decision.rule;
  elements.issueList.innerHTML = decision.issues.map((issue) => `<li>${issue.text}</li>`).join('');
  elements.decisionOptions.innerHTML = decision.options.map((option) => `
    <button class="decision-option" type="button" data-code="${option.code}" disabled>
      <kbd>${keyLabel(option.code)}</kbd><span>${option.label}</span>
    </button>`).join('');
  elements.decisionOptions.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => answerDecision(button.dataset.code));
  });
  elements.decisionFeedback.textContent = '';
  elements.decisionFeedback.className = 'decision-feedback';
  elements.decisionStatus.textContent = '읽는 시간 3초';
  elements.decisionCard.dataset.state = 'reading';
  elements.decisionCard.hidden = false;
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(beginDecisionAnswer, DECISION_READING_MS);
}

function beginDecisionAnswer() {
  const decision = session.currentDecision;
  if (!decision || !session.running || session.paused || !hasDecision()) return;
  decision.ready = true;
  decision.shownAt = performance.now();
  elements.decisionStatus.textContent = '판단 시작';
  elements.decisionCard.dataset.state = 'answering';
  elements.decisionOptions.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => closeDecision(false), DECISION_ANSWER_MS);
}

function answerDecision(code) {
  const decision = session.currentDecision;
  if (!decision || !decision.ready || decision.answered || !hasDecision()) return false;
  if (!['KeyQ', 'KeyW', 'KeyE'].includes(code)) return false;
  decision.answered = true;
  const stats = session.stats[activePhase().id];
  const responseMs = performance.now() - decision.shownAt;
  const correct = code === decision.correctCode;
  stats.decisionAttempts += 1;
  stats.decisionTimes.push(responseMs);
  if (correct) stats.correctDecisions += 1;
  if (activePhase().id !== 'transfer') {
    elements.decisionFeedback.textContent = correct ? `사용자가 고른 답이 맞습니다. ${decision.reason}` : `이 문제의 정답은 ${decision.correctLabel}입니다.`;
    elements.decisionFeedback.classList.toggle('wrong', !correct);
  }
  updateLiveMetrics();
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => closeDecision(true), activePhase().id === 'transfer' ? 180 : 520);
  return true;
}

function closeDecision(answered) {
  const decision = session.currentDecision;
  if (!decision) return;
  if (!answered && decision.ready && !decision.answered) {
    session.stats[activePhase().id].decisionAttempts += 1;
    if (activePhase().id !== 'transfer') {
      elements.decisionFeedback.textContent = '사용자가 제한 시간 안에 행동을 고르지 못했습니다.';
      elements.decisionFeedback.classList.add('wrong');
    }
  }
  session.currentDecision = null;
  delete elements.decisionCard.dataset.state;
  elements.decisionCard.hidden = true;
  updateLiveMetrics();
  if (session.running && !session.paused && hasDecision()) scheduleDecision(700 + Math.random() * 650);
}

function updateLiveMetrics() {
  const phase = activePhase();
  if (!phase || !session.stats[phase.id]) return;
  const stats = summarizePhase({ ...session.stats[phase.id], elapsedSeconds: Math.max(1, session.phaseElapsed) });
  elements.liveActions.textContent = Math.round(stats.actionRate || 0);
  elements.liveMotorAccuracy.textContent = stats.motorAttempts ? formatPercent(stats.motorAccuracy) : '측정 전';
  elements.liveDecisionAccuracy.textContent = stats.decisionAttempts ? formatPercent(stats.decisionAccuracy) : '측정 전';
  elements.liveNoise.textContent = String(stats.noiseInputs || 0);
}

function requestTick() {
  const runId = session.runId;
  requestAnimationFrame((now) => tick(now, runId));
}

function tick(now, runId) {
  if (!session.running || runId !== session.runId) return;
  if (session.paused) {
    session.lastTick = now;
    requestTick();
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
    requestTick();
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
  requestTick();
}

function finishSession() {
  const completedPhase = activePhase();
  session.running = false;
  session.paused = false;
  clearPhaseTimers();
  if (session.practice) {
    returnHome(`${completedPhase.name} 연습을 마쳤습니다. 다른 단계를 누르거나 바로 훈련 시작을 누르세요.`);
    return;
  }
  session.summary = computeSessionSummary(session.stats);
  if (!session.demo) saveRecord(session.summary);
  renderResult(session.summary);
  elements.playPanel.hidden = true;
  elements.resultPanel.hidden = false;
  elements.app.dataset.state = 'result';
  elements.phaseList.querySelectorAll('li').forEach((item) => item.classList.add('done'));
  elements.totalTime.textContent = '00:00';
}

function returnHome(message = '') {
  session.runId += 1;
  session.running = false;
  session.paused = false;
  session.practice = false;
  clearPhaseTimers();
  elements.pauseOverlay.hidden = true;
  elements.playPanel.hidden = true;
  elements.resultPanel.hidden = true;
  elements.startPanel.hidden = false;
  elements.app.dataset.state = 'idle';
  elements.totalTimeLabel.textContent = '전체 시간';
  elements.totalTime.textContent = '10:00';
  elements.phaseList.querySelectorAll('li').forEach((item) => {
    item.classList.remove('active', 'done');
    item.querySelector('button')?.removeAttribute('aria-current');
  });
  elements.practiceStatus.hidden = !message;
  elements.practiceStatus.textContent = message;
}

function renderResult(summary) {
  const profile = summary.profile;
  elements.resultTitle.textContent = profile.title;
  elements.resultSummary.textContent = session.demo
    ? `앱이 45초 체험 결과를 계산했습니다. ${profile.advice}`
    : profile.advice;
  elements.resultMotor.textContent = formatPercent(summary.motorRetention);
  elements.resultThinking.textContent = formatPercent(summary.thinkingRetention);
  elements.resultTransfer.textContent = summary.transfer.decisionAttempts ? formatPercent(summary.transfer.decisionAccuracy) : '판단 응답 없음';
  const baselineRate = Math.round(summary.baseline.motor.actionRate);
  const combinedRate = Math.round(summary.combined.actionRate);
  const baselineDecision = formatPercent(summary.baseline.decision.decisionAccuracy);
  const combinedDecision = formatPercent(summary.combined.decisionAccuracy);
  elements.resultDetail.innerHTML = `입력만 수행한 구간에서 사용자는 분당 <strong>${baselineRate}</strong>개의 동작을 완료했습니다. 입력과 판단을 함께 수행한 구간에서는 사용자가 분당 <strong>${combinedRate}</strong>개의 동작을 완료했습니다. 사용자의 판단 정확도는 <strong>${baselineDecision}</strong>에서 <strong>${combinedDecision}</strong>로 바뀌었습니다. 이 앱의 기록이 좋아져도 사용자는 실제 게임 리플레이에서 생산 공백 시간과 판단 누락 횟수가 줄었는지 따로 확인해야 합니다.`;
}

function pauseSession(reason = 'manual') {
  if (!session.running || session.paused) return;
  session.paused = true;
  window.clearTimeout(session.motorTimer);
  window.clearTimeout(session.decisionTimer);
  const messages = {
    tab: '앱은 사용자가 다른 탭을 본 시간을 훈련 시간에 포함하지 않습니다.',
    page: '앱은 사용자가 다른 화면을 본 시간을 훈련 시간에 포함하지 않습니다.',
    manual: '앱은 사용자가 일시정지한 시간을 훈련 시간에 포함하지 않습니다.'
  };
  elements.pauseOverlay.hidden = currentPage !== 'trainer';
  elements.pauseOverlay.querySelector('p').textContent = messages[reason] || messages.manual;
}

function resumeSession() {
  if (!session.running || !session.paused) return;
  session.paused = false;
  elements.pauseOverlay.hidden = true;
  session.lastTick = performance.now();
  if (hasMotor()) scheduleMotor();
  if (hasDecision() && session.currentDecision) {
    if (session.currentDecision.ready) {
      session.currentDecision.shownAt = performance.now();
      session.decisionTimer = window.setTimeout(() => closeDecision(false), DECISION_ANSWER_MS);
    } else {
      elements.decisionStatus.textContent = '읽는 시간 3초';
      session.decisionTimer = window.setTimeout(beginDecisionAnswer, DECISION_READING_MS);
    }
  } else if (hasDecision()) {
    scheduleDecision(700);
  }
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
elements.phaseButtons.forEach((button) => {
  button.addEventListener('click', () => startSession(false, button.closest('li')?.dataset.phase));
});
elements.restartButton.addEventListener('click', () => {
  elements.resultPanel.hidden = true;
  elements.startPanel.hidden = false;
  elements.app.dataset.state = 'idle';
  elements.totalTime.textContent = '10:00';
});
elements.exportButton.addEventListener('click', exportRecords);
elements.motorTarget.addEventListener('click', handleTargetClick);
elements.pauseButton.addEventListener('click', () => pauseSession('manual'));
elements.homeButton.addEventListener('click', () => returnHome('현재 훈련을 멈추고 홈으로 돌아왔습니다.'));
elements.resumeButton.addEventListener('click', resumeSession);

window.addEventListener('keydown', (event) => {
  if (event.repeat || !session.running || session.paused) return;
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE'].includes(event.code)) event.preventDefault();
  if (answerDecision(event.code)) return;
  handleMotorKey(event.code);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseSession('tab');
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

showTrainer(false);

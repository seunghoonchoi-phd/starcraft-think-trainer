import {
  PHASES,
  DEMO_PHASES,
  adjustMotorInterval,
  blankStats,
  createMotorCommand,
  computeSessionSummary,
  formatPercent,
  keyLabel,
  summarizePhase
} from './engine.js';
import { createDecision, goalForPhase, priorityForTime, GOALS, PRIORITY_GUIDE, TUTORIAL_CASES } from './content.js';

const STORAGE_KEY = 'think-hands-trainer-v1';
const BASE_TITLE = '이중과제 입력·판단 훈련';
const DECISION_ANSWER_MS = 3000;
const $ = (selector) => document.querySelector(selector);
const elements = {
  pageViews: [...document.querySelectorAll('.page-view[data-page]')],
  app: $('#app'),
  startPanel: $('#start-panel'),
  playPanel: $('#play-panel'),
  resultPanel: $('#result-panel'),
  startButton: $('#start-button'),
  motorTutorialButton: $('#motor-tutorial-button'),
  decisionTutorialButton: $('#decision-tutorial-button'),
  restartButton: $('#restart-button'),
  exportButton: $('#export-button'),
  totalTimeLabel: $('#total-time-label'),
  totalTime: $('#total-time'),
  phaseClockLabel: $('#phase-clock-label'),
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
  targetInstruction: $('#target-instruction'),
  motorOrder: $('#motor-order'),
  decisionCard: $('#decision-card'),
  decisionStatus: $('#decision-status'),
  decisionRule: $('#decision-rule'),
  situationVisual: $('#situation-visual'),
  decisionOptions: $('#decision-options'),
  decisionFeedback: $('#decision-feedback'),
  coachLine: $('#coach-line'),
  pauseButton: $('#pause-button'),
  homeButton: $('#home-button'),
  pauseOverlay: $('#pause-overlay'),
  resumeButton: $('#resume-button'),
  pauseReview: $('#pause-review'),
  pauseReviewList: $('#pause-review-list'),
  pauseReviewResume: $('#pause-review-resume'),
  resultTitle: $('#result-title'),
  resultSummary: $('#result-summary'),
  resultMotor: $('#result-motor'),
  resultThinking: $('#result-thinking'),
  resultTransfer: $('#result-transfer'),
  resultDetail: $('#result-detail'),
  practiceStatus: $('#practice-status'),
  fatigueSelect: $('#fatigue-select'),
  tutorialPanel: $('#tutorial-panel'),
  tutorialProgress: $('#tutorial-progress'),
  tutorialTitle: $('#tutorial-title'),
  tutorialScene: $('#tutorial-scene'),
  tutorialPrompt: $('#tutorial-prompt'),
  tutorialQuestion: $('#tutorial-question'),
  tutorialOptions: $('#tutorial-options'),
  tutorialFeedback: $('#tutorial-feedback'),
  tutorialClose: $('#tutorial-close'),
  tutorialNext: $('#tutorial-next')
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
  motorInterval: 1350,
  motorTimer: 0,
  decisionTimer: 0,
  currentTarget: null,
  currentDecision: null,
  motorIndex: 0,
  decisionKeyCycle: [],
  decisionKeyIndex: 0,
  lastDecisionKey: '',
  priority: '동일 비중',
  summary: null,
  tutorialsSeen: new Set()
};

let currentPage = 'trainer';
const tutorial = { active: false, index: 0, answered: false, kind: 'decision', onComplete: null, motorStep: 0 };
const PHASE_TUTORIALS = {
  prepare: {
    title: '훈련을 시작하기 전에 규칙을 확인합니다',
    prompt: '각 단계의 시간은 튜토리얼을 닫고 실제 훈련을 시작한 뒤에만 흐릅니다.',
    steps: ['화면 아래의 현재 순서를 먼저 읽습니다.', '새 행동이 나오면 앱이 시간을 멈춘 튜토리얼을 먼저 표시합니다.']
  },
  motor: {
    title: '입력 기준선: 두 단계를 순서대로 수행합니다',
    prompt: '판단 문제는 없습니다. 아래 순서만 정확하게 수행하세요.',
    steps: ['표적 안에 무작위로 표시된 1, 2, 3, 4 중 한 숫자 키를 누릅니다.', '빛나는 표적을 클릭합니다.']
  },
  dual: {
    title: '동시 수행: 입력과 판단을 함께 수행합니다',
    prompt: '왼쪽 표적의 두 단계 입력을 계속하면서 오른쪽 상황 카드의 답도 고르세요.',
    steps: ['입력 순서는 아래 문장을 따릅니다.', '상황 카드는 가장 늦으면 손해가 큰 일을 묻습니다.', '두 과제 중 하나가 표시돼도 다른 과제를 멈추지 않습니다.']
  },
  priority: {
    title: '우선 과제 변경: 위쪽 안내를 먼저 확인합니다',
    prompt: '앱은 입력 우선, 판단 우선, 동일 비중을 번갈아 표시합니다.',
    steps: ['입력 우선이면 표적 순서를 먼저 처리합니다.', '판단 우선이면 상황 카드의 답을 먼저 고릅니다.', '표시가 바뀌어도 두 과제를 모두 수행합니다.']
  },
  switch: {
    title: '판단 규칙 변경: 질문 위의 규칙을 읽습니다',
    prompt: '상황은 비슷해도 우선순위 규칙이 바뀌면 먼저 고를 행동도 바뀔 수 있습니다.',
    steps: ['상황 카드 위의 한 문장 규칙을 확인합니다.', '그 규칙에 맞는 행동을 Q, W, E 중에서 고릅니다.']
  },
  inhibit: {
    title: '입력 억제: STOP 표적에서는 아무것도 입력하지 않습니다',
    prompt: '빨간 STOP 표적이 보이면 숫자 키와 클릭을 모두 멈추세요.',
    steps: ['STOP이 아닌 표적에서는 숫자 키와 클릭을 수행합니다.', 'STOP 표적에서는 다음 표적이 나올 때까지 기다립니다.']
  },
  transfer: {
    title: '변경 조건 검사: 순서와 피드백이 바뀝니다',
    prompt: '앱은 숫자 키 순서를 바꾸고 판단 정답을 바로 알려 주지 않습니다.',
    steps: ['화면 아래의 현재 순서를 매번 확인합니다.', '상황 카드의 답을 고른 뒤에는 정답을 기다리지 않고 다음 행동을 수행합니다.']
  },
  challenge: {
    title: '최고 난도 복합: 멈추지 않고 두 과제를 함께 수행합니다',
    prompt: '이 모드는 시간 제한이 없습니다. 숫자 표적, 상황 판단, 고정 우선순위, STOP 표적이 함께 나옵니다.',
    steps: ['숫자 키를 누른 뒤 빛나는 표적을 클릭합니다.', '왼쪽 상황은 Q, 가운데는 W, 오른쪽은 E로 고릅니다.', '빨간 STOP 표적에서는 숫자 키와 클릭을 모두 멈춥니다.', '기지 방어, 보급, 생산, 정찰, 확장, 공격 순서를 항상 사용합니다.', '순서가 기억나지 않으면 일시중지를 누르고 오른쪽 우선순위표를 다시 봅니다.']
  }
};

function showTrainer(focusTrainer = true) {
  if (location.hash) window.history.replaceState(null, '', `${location.pathname}${location.search}`);
  elements.pageViews.forEach((view) => {
    view.hidden = false;
    view.classList.add('is-active');
  });
  elements.pauseOverlay.hidden = !session.paused || isUnlimited();
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

function isUnlimited(phase = activePhase()) {
  return Boolean(phase?.unlimited);
}

function phasesForSession(demo, qaMode) {
  if (qaMode) return PHASES.map((phase) => ({ ...phase, seconds: 1.5 }));
  return demo ? DEMO_PHASES : PHASES;
}

function phaseNumber(phase) {
  const matched = PHASES.find((candidate) => candidate.id === phase.id);
  return phase.displayNumber || matched?.displayNumber || PHASES.findIndex((candidate) => candidate.id === phase.id) + 1;
}

function startSession(demo = false, practicePhaseId = null) {
  const qaMode = demo
    && ['127.0.0.1', 'localhost'].includes(location.hostname)
    && new URLSearchParams(location.search).get('qa') === '1';
  const allPhases = phasesForSession(demo, qaMode);
  const selectablePhases = demo ? allPhases : PHASES;
  const selectedPhase = practicePhaseId
    ? selectablePhases.find((phase) => phase.id === practicePhaseId)
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
  session.totalRemaining = isUnlimited(session.phases[0]) ? 0 : session.phases.reduce((sum, phase) => sum + phase.seconds, 0);
  session.stats = {};
  session.motorInterval = demo ? 850 : 1150;
  session.summary = null;
  session.tutorialsSeen = new Set();
  elements.startPanel.hidden = true;
  elements.resultPanel.hidden = true;
  elements.playPanel.hidden = false;
  elements.app.dataset.state = 'playing';
  elements.totalTimeLabel.textContent = isUnlimited(session.phases[0]) ? '무제한 연습' : (session.practice ? '단계 시간' : '전체 시간');
  elements.practiceStatus.hidden = true;
  elements.phaseList.querySelectorAll('li').forEach((item) => item.classList.remove('active', 'done'));
  beginPhase();
}

function beginPhase() {
  const phase = activePhase();
  if (!phase) return;
  if (phase.id !== 'challenge' && !session.tutorialsSeen.has(phase.id)) {
    session.tutorialsSeen.add(phase.id);
    openPhaseTutorial(phase, () => {
      if (!session.running || activePhase()?.id !== phase.id) return;
      startActivePhase();
    });
    return;
  }
  startActivePhase();
}

function startActivePhase() {
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
  resetDecisionKeyCycle();
  session.stats[phase.id] = blankStats();
  elements.phaseNumber.textContent = String(phaseNumber(phase)).padStart(2, '0');
  elements.phaseName.textContent = phase.name;
  elements.phaseClockLabel.textContent = isUnlimited(phase) ? '경과 시간' : '남은 시간';
  elements.phaseTime.textContent = isUnlimited(phase) ? '00:00' : formatClock(session.phaseRemaining);
  elements.totalTime.textContent = isUnlimited(phase) ? '무제한' : formatClock(session.totalRemaining);
  elements.priorityChip.textContent = phase.id === 'priority'
    ? '입력 우선'
    : (phase.id === 'challenge' ? GOALS.balance.label : (phase.id === 'switch' ? GOALS.survive.label : '동일 비중'));
  elements.motorOrder.textContent = hasMotor(phase) ? '명령 대기' : '입력 없음';
  elements.mapMessage.hidden = hasMotor(phase);
  elements.mapMessage.innerHTML = phase.id === 'prepare'
    ? '<strong>앱은 완성한 명령만 점수로 계산합니다</strong><span>사용자는 숫자 키와 표적 클릭을 순서대로 수행해야 합니다.</span>'
    : '<strong>앱이 시각 판단 기준선을 측정합니다</strong><span>사용자는 이 구간에서 입력하지 않고 상황 그림만 보고 행동을 골라야 합니다.</span>';
  elements.decisionCard.hidden = true;
  elements.pauseReview.hidden = true;
  elements.motorTarget.hidden = true;
  elements.decisionFeedback.textContent = '';
  updatePhaseRail();
  updateCoach();
  updateLiveMetrics();

  if (hasMotor(phase)) {
    if (phase.id === 'challenge') session.motorInterval = 1440;
    spawnMotorTarget();
    scheduleMotor();
  }
  if (hasDecision(phase)) scheduleDecision(phase.id === 'decision' ? 400 : 900);
}

function updatePhaseRail() {
  const phase = activePhase();
  const currentNumber = phaseNumber(phase);
  elements.phaseList.querySelectorAll('li').forEach((item) => {
    if (!item.dataset.phase) return;
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
    motor: '사용자는 숫자 키를 누른 뒤 움직인 표적을 클릭해야 합니다.',
    decision: '사용자는 문장을 읽지 않고 상황 그림을 보고 가장 먼저 처리할 행동을 골라야 합니다.',
    dual: '사용자는 숫자 키와 표적 클릭을 계속 수행하면서 그림 판단도 함께 풀어야 합니다.',
    priority: '앱이 한 과제를 우선 과제로 표시해도 사용자는 다른 과제를 계속 수행해야 합니다.',
    switch: '앱이 상단 목표를 바꾸면 사용자는 새 목표에 맞는 행동을 골라야 합니다.',
    inhibit: '앱이 빨간 STOP 표적을 표시하면 사용자는 숫자 키와 클릭을 모두 멈춰야 합니다.',
    transfer: '앱이 숫자 키 순서를 바꾸고 정답을 바로 알려 주지 않습니다.',
    challenge: '사용자는 숫자 표적, Q·W·E 판단, 고정 우선순위, STOP 억제를 함께 수행해야 합니다. 순서가 기억나지 않으면 일시중지 후 오른쪽 표를 다시 봅니다.'
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
  const command = createMotorCommand(session.motorIndex, phase.id);
  session.motorIndex += 1;
  const stop = ['inhibit', 'challenge'].includes(phase.id) && Math.random() < (phase.id === 'challenge' ? 0.18 : 0.24);
  session.currentTarget = {
    ...command,
    grouped: false,
    commanded: false,
    stop,
    violated: false,
    resolved: false,
    spawnAt: performance.now()
  };
  if (stop) stats.stopTrials += 1;
  else stats.motorAttempts += 1;
  elements.motorTarget.hidden = false;
  elements.motorTarget.classList.toggle('stop', stop);
  elements.motorTarget.classList.remove('keyed', 'commanded');
  elements.targetKey.textContent = stop ? 'STOP' : `${keyLabel(command.groupCode)} 키 → 클릭`;
  elements.targetInstruction.textContent = stop ? '숫자 키와 클릭을 멈추세요' : '숫자 키를 누른 뒤 여기 클릭';
  elements.motorTarget.setAttribute('aria-label', stop ? '멈춤 표적' : `${keyLabel(command.groupCode)} 키를 누른 뒤 클릭할 빛나는 표적`);
  elements.motorOrder.textContent = stop
    ? 'STOP · 숫자 키와 클릭을 모두 멈추세요'
    : `1. ${keyLabel(command.groupCode)} 키 누르기 → 2. 빛나는 표적 클릭`;
  const x = 11 + Math.random() * 78;
  const y = 14 + Math.random() * 72;
  elements.motorTarget.style.left = `${x}%`;
  elements.motorTarget.style.top = `${y}%`;
}

function expireTarget() {
  const target = session.currentTarget;
  if (!target) return;
  if (target.stop && !target.violated) session.stats[activePhase().id].stopSuccesses += 1;
  elements.motorTarget.hidden = true;
  elements.motorTarget.classList.remove('keyed', 'commanded', 'stop');
  session.currentTarget = null;
}

function handleMotorKey(code) {
  if (!session.running || session.paused || !hasMotor()) return false;
  const isGroupKey = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code);
  if (!isGroupKey) return false;
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
  if (isGroupKey && code === target.groupCode && !target.grouped) {
    target.grouped = true;
    elements.motorTarget.classList.add('keyed');
    target.commanded = true;
    elements.motorTarget.classList.add('commanded');
    elements.targetKey.textContent = '여기 클릭';
    elements.targetInstruction.textContent = '마우스로 클릭하세요';
    elements.motorOrder.textContent = '2. 빛나는 표적 클릭';
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
  } else if (target.commanded && !target.resolved) {
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

function decisionAnswerMs(phase = activePhase()) {
  return phase?.id === 'challenge' ? 4000 : DECISION_ANSWER_MS;
}

function situationGraphic(id) {
  const graphics = {
    defend: `<svg viewBox="0 0 140 74" aria-hidden="true"><rect class="friendly" x="12" y="43" width="32" height="20" rx="3"/><path class="route danger" d="M121 14C95 20 79 31 50 48"/><path class="arrow danger" d="m53 40-7 9 11 1"/><circle class="danger" cx="116" cy="16" r="7"/><circle class="danger" cx="99" cy="21" r="5"/><circle class="danger" cx="110" cy="31" r="4"/></svg>`,
    supply: `<svg viewBox="0 0 140 74" aria-hidden="true"><rect class="production" x="16" y="19" width="40" height="32" rx="4"/><path class="friendly" d="M27 35h18"/><rect class="meter warn" x="74" y="18" width="12" height="38" rx="2"/><rect class="meter warn" x="91" y="25" width="12" height="31" rx="2"/><rect class="meter warn" x="108" y="32" width="12" height="24" rx="2"/><path class="route warn" d="M63 40h54"/></svg>`,
    produce: `<svg viewBox="0 0 140 74" aria-hidden="true"><circle class="resource" cx="26" cy="39" r="15"/><path class="accent" d="M19 39h14M26 32v14"/><rect class="production" x="62" y="20" width="21" height="37" rx="3"/><rect class="production quiet" x="92" y="20" width="21" height="37" rx="3"/><path class="danger" d="M97 28l12 20M109 28 97 48"/></svg>`,
    scout: `<svg viewBox="0 0 140 74" aria-hidden="true"><circle class="fog" cx="35" cy="37" r="22"/><path class="route" d="M63 37h44"/><circle class="quiet" cx="113" cy="37" r="16"/><path class="danger" d="M103 37h20M113 27v20"/></svg>`,
    expand: `<svg viewBox="0 0 140 74" aria-hidden="true"><rect class="friendly" x="14" y="32" width="30" height="20" rx="3"/><path class="route" d="M48 42c26-23 39-23 60-5"/><circle class="resource" cx="116" cy="38" r="16"/><path class="accent" d="M109 38h14M116 31v14"/></svg>`,
    pressure: `<svg viewBox="0 0 140 74" aria-hidden="true"><circle class="friendly" cx="25" cy="23" r="6"/><circle class="friendly" cx="37" cy="35" r="7"/><circle class="friendly" cx="23" cy="46" r="5"/><path class="route friendly" d="M50 38h38"/><path class="arrow friendly" d="m82 31 10 7-10 7"/><rect class="danger" x="102" y="26" width="22" height="24" rx="3"/></svg>`
  };
  return graphics[id] || '';
}

function renderSituation(decision) {
  elements.decisionRule.textContent = `지금 가장 늦으면 손해가 큰 일을 고르세요. ${decision.rule}`;
  elements.situationVisual.innerHTML = decision.issues.map((issue) => `
    <article class="situation-signal situation-signal--${issue.id}" aria-label="${issue.visual.description}">
      <div class="situation-art" aria-hidden="true">${situationGraphic(issue.id)}</div>
      <div class="situation-caption"><strong><kbd class="situation-key">${keyLabel(issue.keyCode)}</kbd>${issue.visual.metric}</strong><span>${issue.positionLabel} · ${issue.visual.label}</span></div>
      <p class="situation-description">${issue.visual.prompt}</p>
    </article>`).join('');
}

function openDecisionTutorial(onComplete = null) {
  tutorial.active = true;
  tutorial.index = -1;
  tutorial.answered = false;
  tutorial.kind = 'decision';
  tutorial.onComplete = onComplete;
  elements.tutorialPanel.hidden = false;
  renderTutorial();
  elements.tutorialPanel.querySelector('.tutorial-card')?.focus({ preventScroll: true });
}

function openMotorTutorial() {
  tutorial.active = true;
  tutorial.index = 0;
  tutorial.answered = false;
  tutorial.kind = 'motor';
  tutorial.motorStep = 0;
  tutorial.onComplete = null;
  elements.tutorialPanel.hidden = false;
  renderTutorial();
  elements.tutorialPanel.querySelector('.tutorial-card')?.focus({ preventScroll: true });
}

function openPhaseTutorial(phase, onComplete) {
  if (phase.id === 'decision') {
    openDecisionTutorial(onComplete);
    return;
  }
  tutorial.active = true;
  tutorial.index = 0;
  tutorial.answered = true;
  tutorial.kind = 'phase';
  tutorial.onComplete = onComplete;
  elements.tutorialPanel.hidden = false;
  renderTutorial();
  elements.tutorialPanel.querySelector('.tutorial-card')?.focus({ preventScroll: true });
}

function closeTutorial(message = '', cancelled = false) {
  const onComplete = tutorial.onComplete;
  tutorial.active = false;
  tutorial.onComplete = null;
  elements.tutorialPanel.hidden = true;
  if (cancelled && onComplete) {
    returnHome('튜토리얼을 닫았습니다. 홈에서 원하는 단계를 다시 선택하세요.');
    return;
  }
  if (message) {
    elements.practiceStatus.hidden = false;
    elements.practiceStatus.textContent = message;
  }
}

function finishTutorial(message = '') {
  const onComplete = tutorial.onComplete;
  closeTutorial(message);
  if (onComplete) onComplete();
}

function renderTutorial() {
  if (tutorial.kind === 'phase') {
    renderPhaseTutorial();
    return;
  }
  if (tutorial.kind === 'motor') {
    renderMotorTutorial();
    return;
  }
  renderDecisionTutorial();
}

function renderMotorTutorial() {
  const step = tutorial.motorStep;
  const state = step === 0 ? 'key' : (step === 1 ? 'click' : 'complete');
  const copy = {
    key: {
      title: '3 키를 누르세요',
      prompt: '키보드에서 3 키를 한 번 누르세요.',
      question: '지금은 마우스를 클릭하지 않습니다.',
      feedback: '3 키를 누르면 표적을 클릭하는 단계가 시작됩니다.'
    },
    click: {
      title: '이제 빛나는 표적을 클릭하세요',
      prompt: '3 키를 눌렀습니다. 아래 빛나는 표적을 마우스로 클릭하세요.',
      question: '숫자 키를 다시 누르지 말고 표적을 클릭하세요.',
      feedback: '표적을 클릭하면 입력 한 번이 완료됩니다.'
    },
    complete: {
      title: '잘했어요',
      prompt: '사용자는 3 키를 누른 뒤 해당 표적을 클릭했습니다.',
      question: '이 모드에서는 표적에 표시된 숫자 키를 누른 뒤 그 표적을 클릭합니다.',
      feedback: '입력 규칙을 이해했습니다. 이제 최고 난도 복합을 시작할 수 있습니다.'
    }
  }[state];
  elements.tutorialProgress.textContent = `키 입력 튜토리얼 ${step + 1} / 3`;
  elements.tutorialTitle.textContent = copy.title;
  elements.tutorialScene.innerHTML = `<div class="motor-tutorial-board motor-tutorial-board--${state}">
    <kbd>${state === 'key' ? '3' : (state === 'click' ? '3 ✓' : '완료')}</kbd>
    <button id="motor-tutorial-target" type="button">${state === 'key' ? '표적' : (state === 'click' ? '여기 클릭' : '잘했어요')}</button>
  </div>`;
  elements.tutorialPrompt.textContent = copy.prompt;
  elements.tutorialQuestion.textContent = copy.question;
  elements.tutorialOptions.hidden = true;
  elements.tutorialOptions.innerHTML = '';
  elements.tutorialFeedback.textContent = copy.feedback;
  elements.tutorialFeedback.className = 'tutorial-feedback';
  elements.tutorialNext.textContent = '튜토리얼 완료';
  elements.tutorialNext.hidden = state !== 'complete';
  elements.tutorialScene.querySelector('#motor-tutorial-target').addEventListener('click', answerMotorTutorialClick);
}

function handleMotorTutorialKey(code) {
  if (!tutorial.active || tutorial.kind !== 'motor') return;
  if (tutorial.motorStep !== 0) {
    elements.tutorialFeedback.textContent = '그렇게 하는 게 아니라 빛나는 표적을 클릭하는 겁니다.';
    elements.tutorialFeedback.classList.add('is-wrong');
    return;
  }
  if (code === 'Digit3') {
    tutorial.motorStep = 1;
    renderMotorTutorial();
    return;
  }
  elements.tutorialFeedback.textContent = '그렇게 하는 게 아니라 3 키를 누르는 겁니다.';
  elements.tutorialFeedback.classList.add('is-wrong');
}

function answerMotorTutorialClick() {
  if (!tutorial.active || tutorial.kind !== 'motor') return;
  if (tutorial.motorStep !== 1) {
    elements.tutorialFeedback.textContent = '그렇게 하는 게 아니라 3 키를 누른 뒤 해당 표적을 클릭하는 겁니다.';
    elements.tutorialFeedback.classList.add('is-wrong');
    return;
  }
  tutorial.motorStep = 2;
  tutorial.answered = true;
  renderMotorTutorial();
}

function renderPhaseTutorial() {
  const phase = activePhase();
  const guide = PHASE_TUTORIALS[phase.id];
  elements.tutorialProgress.textContent = `${phase.name} 튜토리얼`;
  elements.tutorialTitle.textContent = guide.title;
  elements.tutorialScene.innerHTML = `<ol class="tutorial-steps">${guide.steps.map((step) => `<li>${step}</li>`).join('')}</ol>`;
  elements.tutorialPrompt.textContent = guide.prompt;
  elements.tutorialQuestion.textContent = '아래 버튼을 누르면 이 단계의 시간이 시작됩니다.';
  elements.tutorialOptions.hidden = true;
  elements.tutorialOptions.innerHTML = '';
  elements.tutorialFeedback.textContent = '시간 제한은 아직 시작하지 않았습니다. 조작 순서와 판단 기준을 확인한 뒤 시작하세요.';
  elements.tutorialFeedback.className = 'tutorial-feedback';
  elements.tutorialNext.textContent = '이해했습니다. 연습 시작';
  elements.tutorialNext.hidden = false;
}

function renderDecisionTutorial() {
  if (tutorial.index === -1) {
    renderPriorityGuide();
    return;
  }
  const item = TUTORIAL_CASES[tutorial.index];
  tutorial.answered = false;
  elements.tutorialProgress.textContent = `상황 ${tutorial.index + 1} / ${TUTORIAL_CASES.length}`;
  elements.tutorialTitle.textContent = '시간 제한 없이 한 상황만 판단합니다';
  elements.tutorialScene.innerHTML = situationGraphic(item.issueId);
  elements.tutorialPrompt.textContent = item.prompt;
  elements.tutorialQuestion.textContent = '지금 먼저 해야 할 일은 무엇인가요?';
  elements.tutorialOptions.hidden = false;
  elements.tutorialOptions.innerHTML = item.options.map((option) => `
    <button class="tutorial-option" type="button" data-id="${option.id}">${option.label}</button>`).join('');
  elements.tutorialOptions.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => answerTutorial(button.dataset.id));
  });
  elements.tutorialFeedback.textContent = '시간 제한이 없습니다. 문장과 그림을 확인한 뒤 답을 고르세요.';
  elements.tutorialFeedback.className = 'tutorial-feedback';
  elements.tutorialNext.hidden = true;
}

function renderPriorityGuide() {
  tutorial.answered = true;
  elements.tutorialProgress.textContent = '먼저 외울 기본 순서';
  elements.tutorialTitle.textContent = '가장 위에 있는 행동을 먼저 고르세요';
  elements.tutorialScene.innerHTML = `<ol class="priority-memory">${PRIORITY_GUIDE.map((item) => `
    <li><b>${item.rank}</b><div><strong>${item.action}</strong><span>${item.condition}</span></div></li>`).join('')}</ol>`;
  elements.tutorialPrompt.textContent = '실제 판단에서는 세 상황 중 이 순서에서 가장 위에 있는 행동을 고릅니다.';
  elements.tutorialQuestion.textContent = '최고 난도 복합도 이 기본 순서를 항상 사용합니다.';
  elements.tutorialOptions.hidden = true;
  elements.tutorialOptions.innerHTML = '';
  elements.tutorialFeedback.textContent = '시간 제한이 없습니다. 이 순서를 외운 뒤 상황 문제로 넘어가세요.';
  elements.tutorialFeedback.className = 'tutorial-feedback';
  elements.tutorialNext.textContent = '순서를 외웠습니다. 상황 문제로 가기';
  elements.tutorialNext.hidden = false;
}

function showPauseReview() {
  const phase = activePhase();
  const goal = phase.id === 'challenge'
    ? GOALS.balance
    : (GOALS[goalForPhase(phase.id, session.phaseElapsed)] || GOALS.balance);
  const orderedGuide = PRIORITY_GUIDE.slice().sort((a, b) => goal.priority.indexOf(a.id) - goal.priority.indexOf(b.id));
  elements.pauseReview.querySelector('h4').textContent = phase.id === 'challenge'
    ? '고정 우선순위 다시 보기'
    : `${goal.label} 우선순위 다시 보기`;
  elements.pauseReview.querySelector('p').textContent = `${goal.rule} 순서가 기억나면 훈련을 계속하세요.`;
  elements.pauseReviewList.innerHTML = orderedGuide.map((item, index) => `
    <li>
      <div class="pause-review-art" aria-hidden="true">${situationGraphic(item.id)}</div>
      <div><b>${String(index + 1).padStart(2, '0')}</b><span>${item.action}</span><small>${item.condition}</small></div>
    </li>`).join('');
  elements.pauseReview.hidden = false;
  elements.decisionCard.hidden = false;
  elements.decisionCard.dataset.state = 'paused';
}

function hidePauseReview() {
  elements.pauseReview.hidden = true;
  if (elements.decisionCard.dataset.state === 'paused') delete elements.decisionCard.dataset.state;
}

function resetDecisionKeyCycle() {
  const keys = ['KeyQ', 'KeyW', 'KeyE'];
  for (let index = keys.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [keys[index], keys[swapIndex]] = [keys[swapIndex], keys[index]];
  }
  if (session.lastDecisionKey && keys[0] === session.lastDecisionKey) [keys[0], keys[1]] = [keys[1], keys[0]];
  session.decisionKeyCycle = keys;
  session.decisionKeyIndex = 0;
}

function nextDecisionKey() {
  if (session.decisionKeyIndex >= session.decisionKeyCycle.length) resetDecisionKeyCycle();
  const key = session.decisionKeyCycle[session.decisionKeyIndex];
  session.decisionKeyIndex += 1;
  session.lastDecisionKey = key;
  return key;
}

function answerTutorial(answerId) {
  if (!tutorial.active || tutorial.kind !== 'decision' || tutorial.answered) return;
  const item = TUTORIAL_CASES[tutorial.index];
  tutorial.answered = true;
  const correct = answerId === item.correctId;
  elements.tutorialOptions.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
    if (button.dataset.id === item.correctId) button.classList.add('is-correct');
    if (button.dataset.id === answerId && !correct) button.classList.add('is-wrong');
  });
  elements.tutorialFeedback.textContent = correct
    ? `맞습니다. ${item.reason}`
    : `정답은 ${item.options.find((option) => option.id === item.correctId).label}입니다. ${item.reason}`;
  elements.tutorialFeedback.classList.toggle('is-wrong', !correct);
  elements.tutorialNext.textContent = tutorial.index === TUTORIAL_CASES.length - 1 ? '튜토리얼 완료' : '다음 상황';
  elements.tutorialNext.hidden = false;
}

function showDecision() {
  if (session.currentDecision) closeDecision(false);
  const phase = activePhase();
  const goalId = phase.id === 'challenge' ? 'balance' : goalForPhase(phase.id, session.phaseElapsed);
  session.currentDecision = {
    ...createDecision(goalId, { transfer: phase.id === 'transfer', correctCode: nextDecisionKey() }),
    shownAt: performance.now(),
    ready: true,
    answered: false
  };
  const decision = session.currentDecision;
  elements.priorityChip.textContent = phase.id === 'priority' ? session.priority : decision.goalLabel;
  renderSituation(decision);
  elements.decisionOptions.innerHTML = decision.options.map((option) => `
    <button class="decision-option" type="button" data-code="${option.code}">
       <kbd>${keyLabel(option.code)}</kbd><span><small>${option.positionLabel} 상황</small>${option.label}</span>
    </button>`).join('');
  elements.decisionOptions.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => answerDecision(button.dataset.code));
  });
  elements.decisionFeedback.textContent = '';
  elements.decisionFeedback.className = 'decision-feedback';
  elements.decisionStatus.textContent = activePhase().id === 'challenge' ? '응답 4초' : '응답 3초';
  elements.decisionCard.dataset.state = 'answering';
  elements.decisionCard.hidden = false;
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => closeDecision(false), decisionAnswerMs());
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
    elements.decisionFeedback.textContent = correct
      ? `정답입니다. ${decision.reason}`
      : `오답입니다. 정답은 ${decision.correctLabel}입니다. ${decision.reason}`;
    elements.decisionFeedback.classList.toggle('wrong', !correct);
  }
  updateLiveMetrics();
  window.clearTimeout(session.decisionTimer);
  session.decisionTimer = window.setTimeout(() => closeDecision(true), activePhase().id === 'challenge' ? 1100 : (activePhase().id === 'transfer' ? 180 : 520));
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
      if (activePhase().id === 'challenge') {
        decision.answered = true;
        session.decisionTimer = window.setTimeout(() => closeDecision(true), 1100);
        return;
      }
    }
  }
  session.currentDecision = null;
  delete elements.decisionCard.dataset.state;
  elements.decisionCard.hidden = true;
  updateLiveMetrics();
  if (session.running && !session.paused && hasDecision()) {
    const gap = activePhase().id === 'challenge' ? 1400 + Math.random() * 1300 : 700 + Math.random() * 650;
    scheduleDecision(gap);
  }
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
  if (!isUnlimited()) {
    session.phaseRemaining -= delta;
    session.totalRemaining -= delta;
  }
  session.phaseElapsed += delta;
  const phase = activePhase();
  session.stats[phase.id].elapsedSeconds = session.phaseElapsed;
  elements.phaseTime.textContent = isUnlimited(phase) ? formatClock(session.phaseElapsed) : formatClock(session.phaseRemaining);
  elements.totalTime.textContent = isUnlimited(phase) ? '무제한' : formatClock(session.totalRemaining);

  if (phase.id === 'priority') {
    session.priority = priorityForTime(session.phaseElapsed);
    elements.priorityChip.textContent = session.priority;
  } else if (phase.id === 'switch' && !session.currentDecision) {
    elements.priorityChip.textContent = GOALS[goalForPhase(phase.id, session.phaseElapsed)].label;
  }

  if (!isUnlimited(phase) && session.phaseRemaining <= 0) {
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
  beginPhase();
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
  hidePauseReview();
  elements.playPanel.hidden = true;
  elements.resultPanel.hidden = true;
  elements.startPanel.hidden = false;
  elements.app.dataset.state = 'idle';
  elements.totalTimeLabel.textContent = '전체 시간';
  elements.totalTime.textContent = '10:00';
  elements.phaseClockLabel.textContent = '남은 시간';
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
  const reviewOnRight = isUnlimited();
  elements.pauseOverlay.hidden = reviewOnRight || currentPage !== 'trainer';
  elements.pauseOverlay.querySelector('p').textContent = messages[reason] || messages.manual;
  if (reviewOnRight) showPauseReview();
}

function resumeSession() {
  if (!session.running || !session.paused) return;
  session.paused = false;
  elements.pauseOverlay.hidden = true;
  hidePauseReview();
  session.lastTick = performance.now();
  if (hasMotor()) scheduleMotor();
  if (hasDecision() && session.currentDecision) {
    session.currentDecision.shownAt = performance.now();
    elements.decisionStatus.textContent = activePhase().id === 'challenge' ? '응답 4초' : '응답 3초';
    session.decisionTimer = window.setTimeout(() => closeDecision(false), decisionAnswerMs());
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
elements.motorTutorialButton.addEventListener('click', openMotorTutorial);
elements.decisionTutorialButton.addEventListener('click', () => openDecisionTutorial());
elements.tutorialClose.addEventListener('click', () => closeTutorial('', Boolean(tutorial.onComplete)));
elements.tutorialNext.addEventListener('click', () => {
  if (!tutorial.active) return;
  if (tutorial.kind === 'phase') {
    finishTutorial();
    return;
  }
  if (tutorial.kind === 'motor') {
    if (tutorial.answered) finishTutorial('키 입력 튜토리얼을 완료했습니다.');
    return;
  }
  if (!tutorial.answered) return;
  if (tutorial.index >= TUTORIAL_CASES.length - 1) {
    finishTutorial('상황 판단 튜토리얼을 완료했습니다. 이제 바로 훈련을 시작할 수 있습니다.');
    return;
  }
  tutorial.index += 1;
  renderTutorial();
});
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
elements.pauseReviewResume.addEventListener('click', resumeSession);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (tutorial.active) {
    if (tutorial.kind === 'motor') {
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) event.preventDefault();
      handleMotorTutorialKey(event.code);
    }
    return;
  }
  if (!session.running || session.paused) return;
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

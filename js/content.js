import { shuffle } from './engine.js';

export const GOALS = {
  balance: {
    label: '가장 급한 일 먼저',
    rule: '본진 위험, 곧 막히는 생산, 자원 사용 순서로 행동을 고르세요.',
    priority: ['defend', 'supply', 'produce', 'scout', 'expand', 'pressure']
  },
  survive: {
    label: '위험 대응 먼저',
    rule: '본진 위험이 보이면 기지 방어를 먼저 고르세요.',
    priority: ['defend', 'supply', 'scout', 'produce', 'expand', 'pressure']
  },
  grow: {
    label: '생산 유지 먼저',
    rule: '생산이 멈추기 전에 보급 건물과 생산 재개를 먼저 고르세요.',
    priority: ['supply', 'produce', 'expand', 'scout', 'defend', 'pressure']
  },
  attack: {
    label: '공세 준비 먼저',
    rule: '공격 기회가 보이면 공격 실행을 먼저 고르세요.',
    priority: ['pressure', 'produce', 'scout', 'supply', 'defend', 'expand']
  }
};

const ISSUES = {
  defend: {
    action: '기지 방어',
    visual: { label: '접근', metric: '07s', prompt: '적 병력이 본진에 7초 뒤 도착합니다.', description: '적 병력이 본진에 7초 뒤 도착합니다.' },
    lines: [
      '적 병력이 7초 안에 본진에 도착합니다.',
      '미니맵이 두 번째 기지 근처에 적 병력을 표시했습니다.',
      '정찰 유닛이 본진으로 이동하는 적 병력을 확인했습니다.'
    ],
    transfer: ['아군 주력 병력이 본진에서 멀리 떨어져 있고, 적 병력이 본진 입구에 도착했습니다.']
  },
  supply: {
    action: '보급 건물 건설',
    visual: { label: '한도', metric: '2/3', prompt: '생산이 끝나기 전 보급이 부족합니다.', description: '생산이 끝나기 전 보급이 부족합니다.' },
    lines: [
      '현재 보급 한도까지 2칸 남았고, 유닛 생산은 6초 뒤에 끝납니다.',
      '현재 보급 한도까지 1칸 남았고, 생산 건물은 유닛 두 기를 만들고 있습니다.',
      '현재 생산이 끝나면 보급 한도를 넘지만, 사용자는 보급 건물을 건설하지 않고 있습니다.'
    ],
    transfer: ['생산 건물 세 곳이 5초 안에 유닛 생산을 끝내지만, 현재 보급 한도까지 3칸 남았습니다.']
  },
  produce: {
    action: '생산 재개',
    visual: { label: '유휴', metric: '02', prompt: '자원은 있지만 생산 건물 두 곳이 비어 있습니다.', description: '자원은 있지만 생산 건물 두 곳이 비어 있습니다.' },
    lines: [
      '사용자는 자원 620을 보유하고 있지만, 생산 건물 두 곳에 4초 동안 생산 명령을 내리지 않았습니다.',
      '현재 보급 한도에는 여유가 있지만, 사용자는 주력 유닛을 생산하지 않고 있습니다.',
      '생산 건물에 생산 명령이 없고, 사용자는 유닛 생산에 필요한 자원을 보유하고 있습니다.'
    ],
    transfer: ['사용자는 가스와 미네랄을 충분히 보유하고 있지만, 핵심 생산 건물 세 곳에 생산 명령을 내리지 않았습니다.']
  },
  scout: {
    action: '적 정보 확인',
    visual: { label: '미확인', metric: '90s', prompt: '상대 정보를 90초 동안 확인하지 못했습니다.', description: '상대 정보를 90초 동안 확인하지 못했습니다.' },
    lines: [
      '사용자가 적 기지를 마지막으로 정찰한 시점은 90초 전입니다. 미니맵은 아군 기지 근처에 적 병력을 표시하지 않습니다.',
      '사용자는 2분 동안 상대가 새 기지를 건설했는지 확인하지 못했습니다.',
      '미니맵이 적 주력 병력을 더 이상 표시하지 않습니다.'
    ],
    transfer: ['사용자는 상대 본진을 2분 동안 정찰하지 않았고, 미니맵은 공격 경로 두 곳에 적 병력을 표시하지 않았습니다.']
  },
  expand: {
    action: '새 기지 건설',
    visual: { label: '자원', metric: '900', prompt: '자원 900이 있고 안전한 확장 지점이 있습니다.', description: '자원 900이 있고 안전한 확장 지점이 있습니다.' },
    lines: [
      '모든 생산 건물에 생산 명령이 있고, 사용자는 자원 900을 보유하고 있습니다.',
      '적 병력이 없는 새 자원 지점이 있고, 현재 기지에서 얻는 자원이 줄고 있습니다.',
      '미니맵은 아군 기지 근처에 적 병력을 표시하지 않고, 모든 생산 건물에 생산 명령이 있습니다. 일꾼 여러 명이 한 광물 지점에서 자원을 채취하고 있습니다.'
    ],
    transfer: ['현재 기지에서 얻는 자원이 줄고 있고, 사용자는 적 병력이 없는 확장 지점을 확인했습니다.']
  },
  pressure: {
    action: '공격 실행',
    visual: { label: '우세', metric: '4:1', prompt: '아군 병력이 가까운 공격 경로에서 우세합니다.', description: '아군 병력이 가까운 공격 경로에서 우세합니다.' },
    lines: [
      '아군 주력 병력이 상대 기지 근처에 모여 있고, 상대 주력 병력은 지도의 반대편에 있습니다.',
      '상대 방어 병력 수가 적고, 아군 주력 병력이 상대 기지 근처에 있습니다.',
      '상대 핵심 유닛이 현재 전장에 없고, 아군 주력 병력이 상대 방어 병력보다 많습니다.'
    ],
    transfer: ['상대 지원 병력이 다른 기지로 이동했고, 아군 주력 병력이 상대 기지와 가까운 공격 경로에 있습니다.']
  }
};

export const PRIORITY_GUIDE = [
  { id: 'defend', rank: '01', action: '기지 방어', condition: '적 병력이 본진에 곧 도착합니다.' },
  { id: 'supply', rank: '02', action: '보급 건물 건설', condition: '보급이 막히기 전에 생산 길을 엽니다.' },
  { id: 'produce', rank: '03', action: '생산 재개', condition: '자원이 있는데 생산 건물이 비어 있습니다.' },
  { id: 'scout', rank: '04', action: '적 정보 확인', condition: '상대 병력과 위치 정보를 오래 확인하지 못했습니다.' },
  { id: 'expand', rank: '05', action: '새 기지 건설', condition: '즉시 위험이 없고 자원이 충분합니다.' },
  { id: 'pressure', rank: '06', action: '공격 실행', condition: '아군 병력이 가까운 곳에서 확실히 우세합니다.' }
];

export const TUTORIAL_CASES = [
  {
    issueId: 'defend',
    prompt: '적 병력이 본진에 7초 뒤 도착합니다.',
    options: [
      { id: 'expand', label: '새 기지 건설' },
      { id: 'supply', label: '보급 건물 건설' },
      { id: 'defend', label: '기지 방어' }
    ],
    correctId: 'defend',
    reason: '적 병력이 본진에 도착하면 생산과 자원 사용도 멈출 수 있습니다. 사용자는 기지 방어를 먼저 해야 합니다.'
  },
  {
    issueId: 'supply',
    prompt: '생산이 끝나기 전 보급이 부족합니다.',
    options: [
      { id: 'scout', label: '적 정보 확인' },
      { id: 'supply', label: '보급 건물 건설' },
      { id: 'expand', label: '새 기지 건설' }
    ],
    correctId: 'supply',
    reason: '보급이 막히면 준비한 생산 명령도 실행할 수 없습니다. 사용자는 보급 건물을 먼저 건설해야 합니다.'
  },
  {
    issueId: 'produce',
    prompt: '자원은 있지만 생산 건물 두 곳이 비어 있습니다.',
    options: [
      { id: 'produce', label: '생산 재개' },
      { id: 'pressure', label: '공격 실행' },
      { id: 'scout', label: '적 정보 확인' }
    ],
    correctId: 'produce',
    reason: '생산 건물이 비어 있으면 보유 자원이 병력으로 바뀌지 않습니다. 사용자는 생산을 먼저 재개해야 합니다.'
  },
  {
    issueId: 'scout',
    prompt: '상대 정보를 90초 동안 확인하지 못했습니다.',
    options: [
      { id: 'expand', label: '새 기지 건설' },
      { id: 'scout', label: '적 정보 확인' },
      { id: 'pressure', label: '공격 실행' }
    ],
    correctId: 'scout',
    reason: '상대 병력과 확장 위치를 모르면 다음 행동의 위험을 계산할 수 없습니다. 사용자는 적 정보를 먼저 확인해야 합니다.'
  },
  {
    issueId: 'expand',
    prompt: '자원 900이 있고 안전한 확장 지점이 있습니다.',
    options: [
      { id: 'expand', label: '새 기지 건설' },
      { id: 'supply', label: '보급 건물 건설' },
      { id: 'defend', label: '기지 방어' }
    ],
    correctId: 'expand',
    reason: '생산이 유지되고 즉시 막을 위험이 없으면, 새 자원 지점을 확보해 다음 생산을 준비해야 합니다.'
  },
  {
    issueId: 'pressure',
    prompt: '아군 병력이 가까운 공격 경로에서 우세합니다.',
    options: [
      { id: 'scout', label: '적 정보 확인' },
      { id: 'pressure', label: '공격 실행' },
      { id: 'produce', label: '생산 재개' }
    ],
    correctId: 'pressure',
    reason: '아군 병력이 가깝고 우세하면 상대가 방어를 준비하기 전에 공격 기회를 사용해야 합니다.'
  }
];

let sequence = 0;

export function createDecision(goalId = 'balance', options = {}) {
  const random = options.random || Math.random;
  const transfer = Boolean(options.transfer);
  const goal = GOALS[goalId] || GOALS.balance;
  const ids = shuffle(Object.keys(ISSUES), random).slice(0, 3);
  const ranked = ids.slice().sort((a, b) => goal.priority.indexOf(a) - goal.priority.indexOf(b));
  const correctId = ranked[0];
  const keyCodes = ['KeyQ', 'KeyW', 'KeyE'];
  const positionLabels = ['왼쪽', '가운데', '오른쪽'];
  const decisionOptions = ids.map((id, index) => ({
    code: keyCodes[index],
    id,
    label: ISSUES[id].action,
    positionLabel: positionLabels[index]
  }));
  const issueLines = ids.map((id, index) => {
    const source = transfer && ISSUES[id].transfer.length ? ISSUES[id].transfer : ISSUES[id].lines;
    return {
      id,
      text: source[Math.floor(random() * source.length)],
      visual: ISSUES[id].visual,
      keyCode: keyCodes[index],
      positionLabel: positionLabels[index]
    };
  });
  sequence += 1;
  return {
    id: `decision-${sequence}`,
    goalId,
    goalLabel: goal.label,
    rule: goal.rule,
    issues: issueLines,
    options: decisionOptions,
    correctId,
    correctCode: decisionOptions.find((item) => item.id === correctId).code,
    correctLabel: ISSUES[correctId].action,
    reason: `${goal.label} 규칙에서는 사용자가 ‘${ISSUES[correctId].action}’ 항목을 먼저 골라야 합니다.`
  };
}

export function goalForPhase(phaseId, elapsedSeconds) {
  if (phaseId === 'switch') {
    const rotation = ['survive', 'grow', 'attack'];
    return rotation[Math.floor(elapsedSeconds / 16) % rotation.length];
  }
  return 'balance';
}

export function priorityForTime(elapsedSeconds) {
  const rotation = ['입력 우선', '판단 우선', '동일 비중'];
  return rotation[Math.floor(elapsedSeconds / 20) % rotation.length];
}

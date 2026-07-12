import { shuffle } from './engine.js';

export const GOALS = {
  balance: {
    label: '균형',
    rule: '지금 가장 급한 문제를 먼저 처리하세요.',
    priority: ['defend', 'supply', 'produce', 'scout', 'expand', 'pressure']
  },
  survive: {
    label: '생존 우선',
    rule: '공격받아도 버틸 수 있게 만드는 일을 먼저 고르세요.',
    priority: ['defend', 'supply', 'scout', 'produce', 'expand', 'pressure']
  },
  grow: {
    label: '성장 우선',
    rule: '생산이 끊기지 않게 만든 뒤 수입을 늘리세요.',
    priority: ['supply', 'produce', 'expand', 'scout', 'defend', 'pressure']
  },
  attack: {
    label: '압박 우선',
    rule: '지금 가진 병력으로 기회를 살리는 일을 먼저 고르세요.',
    priority: ['pressure', 'produce', 'scout', 'supply', 'defend', 'expand']
  }
};

const ISSUES = {
  defend: {
    action: '위협 대응',
    lines: [
      '적 병력이 7초 안에 본진에 도착합니다.',
      '두 번째 기지 쪽에 적 전투 신호가 떴습니다.',
      '정찰 유닛이 가까운 공격 움직임을 확인했습니다.'
    ],
    transfer: ['주력 병력이 먼 곳에 있고 적이 본진 입구에 나타났습니다.']
  },
  supply: {
    action: '보급 확보',
    lines: [
      '남은 보급은 2, 생산 완료까지 6초입니다.',
      '보급 여유가 1이고 유닛 두 기가 생산 중입니다.',
      '곧 보급이 막히지만 보급 건물은 짓고 있지 않습니다.'
    ],
    transfer: ['세 생산 건물이 5초 안에 완료되지만 남은 보급은 3입니다.']
  },
  produce: {
    action: '생산 재개',
    lines: [
      '자원은 620, 생산 건물 두 곳이 4초째 쉬고 있습니다.',
      '보급은 넉넉하지만 주력 유닛 생산이 멈췄습니다.',
      '생산 건물이 비었고 바로 쓸 수 있는 자원이 있습니다.'
    ],
    transfer: ['가스와 미네랄이 충분한데 핵심 생산 건물 세 곳이 비었습니다.']
  },
  scout: {
    action: '정찰 갱신',
    lines: [
      '마지막 적 정보가 90초 전이고 당장 보이는 위협은 없습니다.',
      '상대의 새 기지 여부를 2분째 확인하지 못했습니다.',
      '적 주력 병력 위치가 미니맵에서 사라졌습니다.'
    ],
    transfer: ['상대 본진 정보가 오래됐고 공격 경로 두 곳이 비어 있습니다.']
  },
  expand: {
    action: '새 기지 확보',
    lines: [
      '생산은 돌고 있고 자원 900이 계속 남습니다.',
      '안전한 새 자원 지점이 있고 현재 수입이 줄기 시작했습니다.',
      '방어와 생산은 안정적이고 일꾼이 광물 지점에 몰렸습니다.'
    ],
    transfer: ['현재 기지의 자원이 줄고 있으며 안전한 확장 지점을 확보했습니다.']
  },
  pressure: {
    action: '공격 압박',
    lines: [
      '내 주력 병력은 모였고 상대 병력은 반대편에서 확인됐습니다.',
      '상대 방어 병력이 적고 내 병력이 공격 위치에 도착했습니다.',
      '상대의 핵심 유닛이 빠졌고 짧은 공격 기회가 열렸습니다.'
    ],
    transfer: ['상대 지원 병력이 떠났고 내 병력이 가까운 공격로에 있습니다.']
  }
};

let sequence = 0;

export function createDecision(goalId = 'balance', options = {}) {
  const random = options.random || Math.random;
  const transfer = Boolean(options.transfer);
  const goal = GOALS[goalId] || GOALS.balance;
  const ids = shuffle(Object.keys(ISSUES), random).slice(0, 3);
  const ranked = ids.slice().sort((a, b) => goal.priority.indexOf(a) - goal.priority.indexOf(b));
  const correctId = ranked[0];
  const keyCodes = ['KeyQ', 'KeyW', 'KeyE'];
  const optionIds = shuffle(ids, random);
  const decisionOptions = optionIds.map((id, index) => ({ code: keyCodes[index], id, label: ISSUES[id].action }));
  const issueLines = ids.map((id) => {
    const source = transfer && ISSUES[id].transfer.length ? ISSUES[id].transfer : ISSUES[id].lines;
    return { id, text: source[Math.floor(random() * source.length)] };
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
    reason: `${goal.label} 규칙에서는 ‘${ISSUES[correctId].action}’이 가장 먼저입니다.`
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
  const rotation = ['손 우선', '판단 우선', '균형'];
  return rotation[Math.floor(elapsedSeconds / 20) % rotation.length];
}

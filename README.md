# 스타크래프트 생각·손 훈련소

스타를 하다가 손을 빨리 움직이면 다음 판단이 멈추는 느낌이 들 때가 있습니다. 이 앱은 그 문제를 `손만`, `판단만`, `둘을 같이` 세 조건으로 나눠 측정하고 훈련합니다.

원시 APM은 점수로 쓰지 않습니다. 맞는 숫자 키를 누른 뒤 표적까지 클릭한 동작만 `유효 동작`으로 셉니다. 판단 카드를 푸느라 손을 멈추거나, 숫자 키를 난사해도 좋은 기록을 만들 수 없습니다.

## 10분 세션

1. 손 기준선: 판단 없이 1→2→3→4 순환을 수행합니다.
2. 판단 기준선: 손을 쉬고 우선순위 카드만 풉니다.
3. 둘을 같이: 손 순환을 유지하면서 판단을 처리합니다.
4. 우선순위: 손 우선, 판단 우선, 균형을 번갈아 연습합니다.
5. 규칙 전환: 생존, 성장, 압박 목표가 바뀝니다.
6. 멈춤: 빨간 STOP 표적에서 성급한 입력을 참습니다.
7. 새 조합: 4→2→1→3 순서와 처음 보는 상황을 피드백 없이 풉니다.

결과는 `손 유지율`, `생각 보존율`, `새 조합 정확도`로 나눠 보여 줍니다. 한 점수로 모두 뭉개지 않습니다.

## 왜 이렇게 만들었나

두 가지 빠른 일을 겹치면 행동을 고르는 단계에서 병목이 생길 수 있습니다. 반복 연습은 일부 처리 시간을 줄일 수 있지만, 고정 동작만 계속 익힌다고 실제 게임 판단이 저절로 좋아지는 것은 아닙니다. 그래서 이 앱은 정확한 짧은 동작, 이중과제, 목표 전환, 새 조합 검사를 한 세션 안에 함께 넣었습니다.

주요 근거:

- [Pashler (1994), Dual-task interference in simple tasks](https://pubmed.ncbi.nlm.nih.gov/7972591/)
- [Strobach & Schubert (2017), Practice-related reductions of dual-task interference](https://pmc.ncbi.nlm.nih.gov/articles/PMC5385484/)
- [Guadagnoli & Lee (2004), Challenge point framework](https://pubmed.ncbi.nlm.nih.gov/15130871/)
- [Czyż et al. (2024), Contextual interference and transfer meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC11349744/)
- [Glass et al. (2013), Real-time strategy game training](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0070350)
- [Smith & Basak (2023), Video-game training meta-analysis](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0285925)

## 한계

이 앱은 연구 원리를 바탕으로 만든 실험적 훈련 도구입니다. 이 앱에서 점수가 올랐다고 스타크래프트 실력이 올랐다고 말할 수는 없습니다. 실제 전이는 리플레이에서 교전 중 생산 공백, 공급 막힘, 큰 판단 누락이 줄었는지 따로 확인해야 합니다.

의료 검사, 지능 검사, ADHD 치료 도구가 아닙니다. Blizzard Entertainment와 관련 없는 비공식 팬 프로젝트이며, 게임의 그림·소리·코드를 사용하지 않습니다.

## 실행과 검사

정적 파일만 사용하므로 별도 빌드가 필요 없습니다. 로컬 HTTP 서버에서 `index.html`을 열면 됩니다.

```powershell
npm.cmd test
npm.cmd run check
```

`main` 브랜치에 push하면 GitHub Actions가 테스트 뒤 Pages에 배포합니다. 기록은 서버로 보내지 않고 사용자의 브라우저 `localStorage`에만 저장합니다.

# oddk React Todo 포트폴리오 연결

2026-10-30. 기존 독립 앱 `C:/workspace/study/todo`를 포트폴리오 여섯 번째 프로젝트로 소개한다. `C:/workspace/react_todo/todo`의 정적 랜딩 시안과 구분해 실제 [oddk](https://seonyoungyoo16.github.io/oddk-todo/todo/)를 연결했다. 독립 앱의 로컬 미커밋 변경은 수정하거나 포함하지 않았다.

ALPEN 작업 블록: A=원본 확인/카드·상세/소스 연결/브라우저/배포, L=구현25분·검증15분 추정, P=통합 여유10분, E=실제 앱과 소스 대응 우선, N=아래 결과 갱신. 추정 예산이며 실측 시간이 아니다.

## 연결한 내용

- 목록: 기존 카드 너비·간격을 따르는 `oddk · React Todo`, React·Next.js·TypeScript·ALPEN·Time Blocking.
- 상세: `#project/todo`, 실제 앱 열기와 GitHub 링크, 네 단계의 설계 의도와 실제 코드 선택.
- 기능: 할 일 모으기 → 작업과 여유 정하기 → 시간표 배치 → 실행·점검. ALPEN은 무엇을 얼마나 할지 계획하고, 타임블로킹은 언제 실행할지 배치한다. 계획과 실제 기록을 별도로 설명한다.
- 예시 그림은 HTML/CSS로 표현한 정적 구성 예시다. 포트폴리오에 별도 할 일 저장소나 로그인 앱을 복제하지 않았다.

## 소스 근거

고정 리비전 `af0728e7a562bbc78471edc41a088afc93d66be6`의 아래 함수 전체를 추출했다. 함수 문법 트리로 시작·끝을 찾고 원본 파일의 행·공백까지 유지한다. GitHub 원본 파일 SHA-256과 줄별 코드가 일치해야 브라우저 검사를 통과한다.

| 사용자 흐름 | 원본 구현 |
|---|---|
| 등록 | `app/todo/page.tsx`의 `addTask` |
| 작업·여유 예상 | `app/todo/task-time.ts`의 `parseTaskTimeDraft`; 실제 편집기의 소요시간 입력에서 사용 |
| 시간표 배치 | `app/todo/timeline.ts`의 `layoutTimeline`; 같은 화면이 호출하는 겹침/열 계산 |
| 실제 기록 커밋 | `app/todo/execution-idb.ts`의 `localExecutionTransaction`; `tx.oncomplete`에서 성공 반환 |

현재 날짜·실제 사용자 데이터·OAuth 상태·앱의 테스트 횟수를 포트폴리오 예시나 새 검증 결과로 만들지 않는다. 앱의 기존 검증은 고정 리비전의 `docs/ux/UX13-ACCEPTANCE.md`로 연결한다.

## 검증

로컬: [투두 연결 5그룹](todo-verification/local/browser.json), 320/390/768/1440/1800px, 원본 4개 파일 해시/코드, 실제 배포 앱 새 탭 및 기존 다섯 프로젝트 진입 통과. 기존 결제 3D 17그룹의 공통 카드 검사도 여섯 장으로 확장해 통과했다. 로그인·가입·결제 각18그룹과 공통 사용자 여정12그룹도 통과했다. 마지막 카드에서 상세로 진입할 때 공통 라우트 스크롤을 즉시 맨 위로 이동하게 해 이전 목록의 긴 스크롤 높이가 남는 현상을 해결했다.

이번 범위는 포트폴리오 소개·라우팅·소스·앱 연결이다. 독립 Todo 앱의 실제 계정/동기화/저장소 변경이나 OAuth·실물 기기 인수를 재실행하지 않았다. 화면 크기 검사는 Chromium 뷰포트 기준이다.

## 공개 배포 결과

- 포트폴리오 소스 `551d56debdf953789e72247de1923b9d9146d9bd`, Pages `2d0d52fc8aaa9f7ddc752ef84d8d85d5fe770d1a`.
- [Pages 실행 40935060508](https://github.com/seonyoungyoo16/portfolio/actions/runs/40935060508) 성공. [릴리스 검증](todo-verification/published/release.json)은 HTML·JS·CSS의 SHA-256 및 모든 프로젝트 원본 리비전을 확인했다.
- [공개 투두 연결 5그룹](todo-verification/published/browser.json), [공통 카드·결제 3D 17그룹](payment-three-verification/published/browser.json), [기존 사용자 여정 12그룹](user-journey-verification/published/browser.json), 합계34그룹 통과. 예상치 않은 페이지 오류0건.
- [공개 카드](todo-verification/published/project-card.png), [데스크톱 상세](todo-verification/published/detail-1440.png), [모바일 상세](todo-verification/published/detail-390.png). 인앱 브라우저에서도 공개 상세와 ALPEN 단계의 소스 전환을 확인했다.
- 배포 주소: [React Todo 프로젝트](https://seonyoungyoo16.github.io/portfolio/#project/todo). 실제 앱은 기존 oddk 배포를 그대로 연결했다.

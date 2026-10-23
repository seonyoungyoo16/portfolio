# 흐름 중심 UI 점검

참고: [사용자가 제공한 Board 화면](docs/project-view-verification/reference-board.png). 기존 프로젝트의 요소를 유지하면서 정보 순서와 경로 가독성을 개선하는 작업이다.

| 단계 | 관찰 및 수정 | 확인 화면 | 상태 |
|---|---|---|---|
| 1. 시작 화면 | 상단 카메라 도구와 네 방향 배치가 주 흐름보다 강했다. 역할 3개·가로 주 경로·방향 화살표를 먼저 보여주고 View를 아래에 접었다. | [로그인](docs/project-view-verification/local/login-flow-first.png), [회원가입](docs/project-view-verification/local/signup-flow-first.png) | 통과 |
| 2. 요청과 데이터 변화 | 현재 단계의 경로·진행 번호·설명·데이터를 한 장면에 연결했다. 요소를 골라도 전체 구도를 유지한다. 실제 소스 버튼은 해당 동결 커밋의 코드 영역을 연다. | [로그인 발급](docs/project-view-verification/local/login-issued.png), [결제](docs/project-view-verification/local/payment-flow-first.png) | 통과 |
| 3. 작은 화면과 접근성 | 320/390/768/1440/1800px에서 가로 넘침·노드 겹침·키보드·동작 줄이기를 검사했다. WebGL 불가/복구에서도 네이티브 단계·소스를 유지한다. | [모바일 로그인](docs/project-view-verification/local/login-responsive-390.png), [모바일 가입](docs/project-view-verification/local/signup-responsive-390.png) | 통과 |

브라우저 자동 검사의 전체 근거는 [결과 JSON](docs/project-view-verification/local/browser.json)과 같은 폴더의 상태별 이미지다. Codex 인앱 브라우저에서도 실제 로그인 화면을 열어 장면과 조작을 확인했다. 실제 휴대기기·전체 WCAG 적합성·백엔드 I/O 재실행을 주장하지 않는다. 공개 화면은 단계별 스냅샷 시뮬레이션이며 실제 백엔드 근거는 기존에 동결된 별도 실험 결과다.

final result: passed

공개 검증도 통과했다. [최종 요청 장면](docs/project-view-verification/published/login-request.png)에서 브라우저 → 서버 화살표와 접힌 View를 확인했고, [최종 모바일 가입](docs/project-view-verification/published/signup-responsive-390.png)은 데이터 카드 두 열을 유지한다. [공개 20그룹 결과](docs/project-view-verification/published/browser.json)와 [배포 해시](docs/project-view-verification/published/release.json)를 함께 보존한다.

## 사용자 조작 순서 개선

| 관찰 | 수정과 검증 | 결과 |
|---|---|---|
| 왼쪽에 기능·상태·환경 조작이 섞여 시작점이 불명확했다. | 네 프로젝트 기본 화면을 번호·현재 행동·결과·다음 버튼으로 통일했다. 기술 설정은 별도 모드이며 모드 전환은 실습 데이터를 바꾸지 않는다. | 로컬 12그룹 통과 |
| 일부 장면이 소스의 실제 처리 요소를 통과하지 않는 것처럼 보였다. | 인증 소스 57개의 경계를 명시하고 현재 연결만 강조한다. 서버 내부 단계는 서버만, DB/Redis는 실제 왕복, 브라우저 로컬 행동은 패킷 없이 해당 요소만 강조한다. 렌더링된 연결과 패킷 위치를 검사했다. | 계약 7그룹·실제 장면 검사 통과 |
| 로컬 행동에도 서버 Java가 나타나고 일부 추출 코드에 핵심 SQL이 없었다. | 로컬 13개 분기를 실제 고정 브라우저 코드로 연결하고 PREPARING/SSO 추출을 확장했다. 설정·로그·구현의 역할도 표시한다. | 13개 행/파일 해시 일치 |
| 모바일에서 행동 후 흐름 패널을 찾기 어려웠다. | 결과에 `처리 흐름·소스 보기`를 연결하고 체험 패널로 돌아와 다음 행동을 이어가게 했다. | 320~1440px 기본 체험, 기존 1800px 회귀 통과 |

[최종 조작과 흐름](docs/user-journey-verification/local/login-action-flow-source.png), [390px 로그인 폼](docs/user-journey-verification/local/login-guide-390.png), [전체 검증 범위](docs/user-action-journeys.md). 인앱 브라우저에서도 기본 로그인 버튼 → 완료 결과 → 모바일 흐름·소스 진입을 확인했다. View는 계속 부가기능이다.

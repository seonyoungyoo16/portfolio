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

# 결제 Three.js 장면과 프로젝트 목록

공개 결제 체험은 브라우저 시뮬레이션이다. `executePayment`가 만든 프레임의 `visual` 경로와 `snapshot`을 선택해 표시하며, 3D 장면은 금융 상태를 변경하거나 서버에 요청하지 않는다. 독립 백엔드의 기존 64개 브라우저/12개 SQL·API 결과와 이번 프런트엔드 검증은 별도다. 소스 기준 커밋 `4b44cb606c2a77af45e5f16dbc4c34c33a29afbb`와 37개 앵커는 유지한다.

| 요소 | 연결 데이터 | 선택과 검증 |
|---|---|---|
| 요청 패킷 | `visual.from/to/kind/lost`, 현재 단계 재생/일시 정지 | 요청/조회/응답 유실 경로. 실제 WebGL 픽셀 변화와 일시 정지 확인 |
| 중복 게이트 | 승인 요청 24개, 새 canonical 작업 1개 또는 재사용 시 0개 | 24개는 공개 시뮬레이션 표현이며 실제 동시 HTTP 부하 테스트 수치가 아니다. 기존 작업/PG 거래는 하나 |
| 상점·PG 원장 | 해당 프레임의 `ledger`/`transactions`, 승인/취소 구분 | PG 커밋 시 PG 1건·상점 0건 → 상점 반영 후 각 1건. 입체 원장은 최근 8건, 숫자/거래 비교는 전체 |
| 취소 예약 링 | 승인 A, 확정 취소 C, 미해결 예약 R | 정상 링은 A−C−R / C / R. C+R>A는 실제 C를 보존하고 R을 바깥 링으로 분리, REVIEW 표시 |
| 실제 소스 | `frame.source` → 동결된 파일/행/코드/해시 | 단계 목록·노드·원장 raycast로 선택. 원장 행은 해당 거래가 처음 나타난 프레임, 일반 노드는 현재 이전의 가장 가까운 단계 또는 첫 이후 단계 |

곡선은 아크 길이 기준 `getPointAt`을 사용한다. 렌더러는 화면 진입/크기 변경/선택 변화와 재생 중에만 그린다. 화면 밖·일시 정지·동작 줄이기에서는 연속 렌더링을 멈춘다. 컴포넌트를 떠날 때 observer, listener, RAF, geometry, material, instanced mesh와 renderer를 해제한다. WebGL 미지원/컨텍스트 유실에서도 네이티브 노드·금액·단계·소스는 사용할 수 있다. 컨텍스트 복구 시 하나의 장면을 다시 구성한다.

목록은 `project-list` 공통 그리드로 묶었다. 5개 카드 너비와 두 열 비율을 맞추고, 800px 이하에서는 한 열로 쌓는다. 카드 간격은 큰 화면 24px, 작은 화면 20px이며 개별 카드의 이전 상단 margin을 대체한다. 상세 페이지 열 너비에는 적용하지 않는다.

```powershell
npm run build
npm run test:payment
npm run test:payment-scene
npm run verify:payment-source
# 개발/미리보기 서버 실행 후
$env:PORTFOLIO_URL='http://127.0.0.1:5190/'
npm run test:payment-browser
npm run test:payment-three-browser
```

새 순수 검사 9개와 WebGL/반응형 검사 17그룹은 `scripts/test-payment-scene.ts`, `scripts/test-payment-three-browser.mjs`로 재실행한다. 기존 결제 모델 18개/공개 브라우저 18그룹과 로그인·회원가입 회귀도 별도로 실행한다. 320/390/768/1440/1800px에서 이름표 경계와 카드 너비·열·간격, 가로 넘침을 검사한다. 실제 모바일 기기 검증은 아니며 Chromium 뷰포트 검증이다. 결과와 스크린샷은 `docs/payment-three-verification/{local,published}`에 기록한다.

공개 배포 후 `release.json`의 포트폴리오 커밋, 네 프로젝트의 동결 소스 커밋, HTML/JS/CSS SHA-256을 대조하고 같은 브라우저 시나리오를 공개 URL에서 다시 실행한다.

# 프로젝트별 Three.js 처리 흐름

게시판의 Overview / Side / Top / Station / Flight 방식을 로그인·회원가입·채팅·결제에 적용한다. 기존 기능 모델과 동결 백엔드 소스·검증 수치는 유지하고, 선택한 처리 단계의 스냅샷을 3D로 표현한다. 공개 Pages의 시뮬레이션과 실제 백엔드 I/O 증거는 별개다.

## Board 참고 화면을 반영한 정보 순서

사용자가 제공한 [Board 참고](project-view-verification/reference-board.png)의 역할명·가로 연결선·요청 설명·소스 버튼 배치를 따른다. 첫 화면의 읽는 순서는 **역할 3개 → 방향이 있는 3D 경로 → 현재 요청·처리 단계와 진행 번호 → 데이터 상태**다. View는 장면 아래 `보기 설정`에 기본으로 접어 둔다. 요소 선택은 전체 구도를 유지하며 해당 단계와 실제 소스를 연다. 확대는 사용자가 Station을 선택했을 때만 수행한다.

로그인은 기기 → 인증 서버 → 세션 DB를 가로로 배치하고 Redis를 후면 보조 경로로 둔다. 회원가입은 사용자 → 가입 서버 → 계정 DB가 주 경로이며 메일·Redis·IdP의 평상시 선은 약하게 표시한다. 선택한 경로는 주황색 화살표와 패킷으로 강조한다. 결제 조회 경로는 점선, 차단·응답 유실 경로는 실패 지점까지만 강조하며 금액 확정으로 표현하지 않는다. 채팅도 현재 방향의 곡선·화살표와 메시지가 같은 경로를 따른다.

장면 안 `현재 단계 소스`는 동결 커밋의 소스 영역을 열고 이동한다. 로그인·회원가입 설명은 장면 바로 아래로 옮겨 같은 경로의 단계·데이터·코드를 이어 읽게 한다. 모바일에서도 이 순서를 유지하고, 조작하지 않을 때는 반복 렌더링하지 않는다. 참고 화면은 방향과 정보 순서의 기준이며 새 프로젝트의 3D 요소는 유지한다.

로그인 첫 요청은 CSRF 설정 소스를 참조해도 브라우저 → 서버 방향으로 표시한다. 마지막 응답은 서버 → 브라우저다. 방향을 소스 키 이름으로 추측하지 않고 단계로 구분하며 모델·브라우저에서 검증한다. 320/390/768px의 로그인·회원가입 상태 카드는 두 열로 표시해 정보가 지나치게 쪼개지지 않게 한다.

| 프로젝트 | 선택한 요소 | 보여줄 경계 |
|---|---|---|
| 로그인 | PC·쿠키 토큰, A/B 서버 랙, Redis TTL 토러스, 발급 상태 카드 | PREPARING → Redis 저장 → ACTIVE → 쿠키, 만료·회전·폐기 |
| 회원가입 | 메일 봉투·outbox 카드, DB 중복 게이트, 외부 신원 오브·연결 링 | SMTP 접수 / 이메일 소유 확인 / 계정 확정 / SSO 연결의 차이 |
| 채팅 | 기존 PC·소켓 곡선·메시지·Outbox/Kafka/Consumer | 요청·저장·ACK·전달, 대기/복구를 카메라로 추적 |
| 결제 | 기존 요청 패킷·중복 게이트·상점/PG 원장·취소 예약 링 | 서로 다른 커밋, 미해결 예약과 확정 취소를 보존 |

요소 선택은 Three.js 공식 [TubeGeometry](https://threejs.org/docs/pages/TubeGeometry.html), [TorusGeometry](https://threejs.org/docs/pages/TorusGeometry.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html)를 기준으로 한다. 현재 프로젝트의 Three.js 0.180.0에서 지원되는 API만 사용한다. 카메라 전환은 관찰 동작이며 인증·메일·금전 상태나 요청 실행을 바꾸지 않는다. Station은 요소를 확대하고, 노드의 단계 선택은 해당 스냅샷과 실제 소스를 연다. Flight는 선택한 단계의 요청을 따른다.

ALPEN 계획: A는 공통 View·로그인/회원가입 3D·기존 장면 확장·브라우저·배포, L은 구현 50분/검증 10분 블록, P는 통합 여유 30%, E는 상태·소스 일치와 작은 화면 우선, N은 아래 결과 갱신이다. 계획 시간은 실제 실행 시간과 구분한다.

| 검증 블록 | 완료 기준 | 상태 |
|---|---|---|
| 구현 | 네 프로젝트의 다섯 View, 선택한 단계/소스/데이터 연동 | 완료 |
| 기능 | 모델·소스 검증과 기존 브라우저 회귀 | 완료: 새 모델 8개, 기존 모델·소스 검사, 로그인·회원가입·결제 각 18그룹 및 기존 결제 3D 17그룹 |
| 시각 | 흐름 우선 배치, 실제 WebGL, 카메라별 픽셀 차이, 320~1800px, 동작 줄이기·fallback | 새 브라우저 20그룹: 역할/장면/단계/접힌 View 순서·소스 접근, 채팅 접속/전송 중 카메라 전환과 한 번의 저장·전달 포함 |
| 배포 | 공개 URL 재검증과 빌드/배포 자원 해시 일치 | 완료: source `6c864c6`, Pages `df9852f`, HTML·JS·CSS 3개 해시 일치 |

Redis 링은 선택 기기의 **최근 발급 세션**의 서버 키 TTL이다. 쿠키 발급 전에도 PREPARING → Redis 저장 → ACTIVE 구간의 TTL을 관찰한다. 키가 존재하는 것과 인증 가능한 상태를 구분하며, 인증 상태와 쿠키는 브라우저·발급 상태에서 따로 표시한다. 실습 시계 외에는 TTL을 줄이거나 늘리지 않는다. 메일 접수 횟수, 이메일 증명, 가입 계정, 연결된 외부 신원도 각각 별도 값으로 유지한다.

각 View는 카메라만 바꾼다. Station의 화살표와 선택창은 관찰할 요소만 바꾸며, 요소 버튼/3D 선택은 현재 작업 안에서 해당 노드의 가장 가까운 이전 단계(없으면 첫 이후 단계)와 소스를 연다. 처리 중인 채팅 작업에서는 카메라만 움직이고 처리 단계 건너뛰기를 막는다. 기존 3D 결제의 원장 행은 거래가 처음 생긴 프레임으로 연결한다. WebGL 불가/컨텍스트 유실에도 네이티브 단계·소스·데이터는 유지하며 복구 시 하나의 렌더러를 다시 만든다. 정지/동작 줄이기에서는 반복 렌더링하지 않는다. 작은 화면의 채팅 View가 입력 영역을 가리지 않도록 고정 배치를 풀었다.

```powershell
npm run build
# 별도 터미널에서 정적 빌드 미리보기
npx vite preview --host 127.0.0.1 --port 5191 --strictPort
# 검사 터미널
npm run test:auth-scene
$env:PORTFOLIO_URL='http://127.0.0.1:5191/'
npm run test:project-views-browser
npm run test:login-browser
npm run test:signup-browser
npm run test:payment-browser
npm run test:payment-three-browser
```

브라우저 검사는 개발 서버의 HMR을 사용하지 않는 **정적 빌드**에서 수행한다. 병렬 검사가 증거 JSON을 쓸 때 Vite 개발 서버가 페이지를 새로 고쳐 진행 중인 채팅 상태를 초기화한 것을 로그로 확인했으며, 정적 미리보기에서 접속/전송 검사를 통과했다. 증거는 `project-view-verification/{model.json,local/browser.json,published/browser.json}`과 같은 폴더의 이미지에 기록한다. 320/390/768/1440/1800px Chromium 뷰포트 검사이며 실제 휴대기기 검증 수치는 아니다. 실제 백엔드 소스/검증 기준 커밋은 그대로 유지한다.

## 공개 검증 결과

[공개 로그인 화면](https://seonyoungyoo16.github.io/portfolio/#project/login), [공개 회원가입](https://seonyoungyoo16.github.io/portfolio/#project/signup), [채팅](https://seonyoungyoo16.github.io/portfolio/#project/chat), [결제](https://seonyoungyoo16.github.io/portfolio/#project/payment).

[최종 Pages 실행](https://github.com/seonyoungyoo16/portfolio/actions/runs/40027099371)이 성공했고 [릴리스 해시](project-view-verification/published/release.json)가 일치한다. [흐름 UI 20그룹](project-view-verification/published/browser.json), [로그인 18그룹](login-verification/published/browser.json), [회원가입 18그룹](signup-verification/published/browser.json)은 요청 방향·좁은 화면 수정 후 공개 주소에서 다시 통과했다. 결제 기능 18그룹·3D 17그룹도 흐름 UI 배포본에서 통과했으며 마지막 로그인 방향/인증 카드 CSS 수정의 영향 범위 밖이다. 페이지 오류와 예상치 않은 백엔드 호출은 0건이었다. 이번 작업에서는 실제 백엔드 I/O를 재실행하지 않았다.

로컬 미리보기 `http://127.0.0.1:5191/`를 유지하기 위해 Pages는 별도 `C:/workspace/portfolio-flow-pages-build`에 빌드했다. 릴리스 검사는 `PORTFOLIO_RELEASE_FILE`로 그 빌드의 `release.json`을 지정할 수 있다. 최종 참고 화면 비교는 [design-qa.md](../design-qa.md)에 기록했다.

## 사용자 행동 중심 조작

후속 개선에서 왼쪽을 공통 사용자 여정으로 통일하고 상세 설정을 `직접 실험하기`로 옮겼다. 인증 경로는 소스별 경계를 명시하고 로컬 행동에는 실제 브라우저 코드를 연결한다. 이전 행동의 기기·서버는 해당 요청에 고정한다. 기존 View와 요소 선택은 관찰용으로 유지한다. 현재 결과와 배포 근거는 [사용자 행동과 처리 흐름 연결](user-action-journeys.md)에 기록한다.

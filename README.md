# Source-based Developer Portfolio

회원가입 실험실은 [`#project/signup`](https://seonyoungyoo16.github.io/portfolio/#project/signup)에서 엽니다. 독립 [Spring Boot Signup Lab](https://github.com/seonyoungyoo16/springboot-signup-lab)의 실제 백엔드 검증 12개와 브라우저 시나리오 50개를 연결합니다. 공개 체험은 브라우저 시뮬레이션이며 실제 이메일·IdP 요청은 원본 프로젝트에서 실행합니다.

회원가입 체험은 이메일 요청·outbox·SMTP 접수·명시 확인·가입 원자 확정, 두 독립 문맥의 중복 가입, 응답 유실 복구, Redis/DB/SMTP 장애, 실제 코드에 근거한 SSO 가입과 기존 계정 신원 연결을 설명합니다. 단계별 스냅샷과 27개 소스 발췌를 고정 커밋의 파일·행·SHA-256과 대조합니다.

```sh
npm run test:signup
npm run verify:signup-source
npm run test:signup-browser
```

브라우저 검사는 실행 중인 개발/미리보기 서버를 사용합니다. 다른 주소는 `PORTFOLIO_URL`로 지정합니다. 소스를 갱신할 때는 독립 프로젝트를 먼저 커밋한 다음 `node scripts/export-signup-source.mjs <signup-checkout>`으로 추출합니다. [회원가입 검증 범위](docs/signup-project.md)

메인은 프로젝트 목록이고, Spring Boot Board Lab을 클릭하면 해당 프로젝트의 실제 GitHub 소스에 맞는 DB 관계와 동작 체험이 열립니다. 기존 Agentic Factory 사이트는 별도 사이트로 유지합니다.

## 실행
```sh
npm install
npm run dev
npm run build
node --experimental-strip-types scripts/test-board-demo.ts
```
개발 주소: http://127.0.0.1:5188 / 상세: /#project/board

## GitHub Pages
배포 주소: https://seonyoungyoo16.github.io/portfolio/

`npm run build:pages`로 `/portfolio/` 경로에 맞춘 정적 파일을 생성합니다. GitHub Pages는 `gh-pages` 브랜치의 루트에서 배포합니다. 해당 브랜치에는 `dist/` 내용과 `.nojekyll`만 올립니다. 기존 Sites 빌드는 `npm run build`로 루트 경로를 유지합니다.

현재 배포는 빌드 결과를 직접 게시하는 방식입니다. 이후 소스 변경을 배포하려면 Pages 빌드 결과도 갱신해야 합니다.

## 소스와 분석
저장소: https://github.com/seonyoungyoo16/springboot-board-lab

GitHub에 게시한 뒤 별도 디렉터리로 clone한 소스를 읽고, `scripts/export-model.mjs`로 모델을 추출했습니다. `src/generated/board-model.json`은 고정된 Git commit, 실제 SQL 테이블/컬럼/FK/유일 제약, JPA 매핑, API endpoint, service 흐름과 해당 소스 줄 번호 및 SHA-256을 포함합니다.

갱신할 때 최신 GitHub 소스를 별도 checkout한 후 다음을 실행합니다.
```sh
node <board-checkout>/scripts/export-model.mjs <board-checkout> src/generated/board-model.json
```

- `src/App.tsx`: 목록 → 프로젝트 상세 이동
- `src/components/BoardProject.tsx`: 요청 흐름, 테이블 현황, 소스 근거, 게시판 체험
- `src/components/ui/request-scene.tsx`: PC/앱 → API 요청 → Spring Boot 서버, 문서/하트 이동과 처리 결과, 카메라 5종
- `src/components/ui/ServerLogView.tsx`: 서버 터미널 클릭 → 현재 동작의 Controller/Service/Repository 소스와 내부 호출 확인
- 서버에 요청이 도착하면 소스 흐름 화면이 열리고, 실제 코드 조각을 정상 처리 순서에 맞춰 강조합니다. 일시 정지/재개, 다시 재생, 단계 클릭을 지원하며 조건부 호출은 조건을 만족하는 경우로 표시합니다.
- `scripts/export-server-source.mjs`: 고정 commit의 Git 객체에서 소스 코드·줄 번호 추출 (`node scripts/export-server-source.mjs <board-checkout>`)
- `src/board-demo.ts`: 소스 규칙에 맞춘 브라우저 시뮬레이션
- `src/project.css`: 프로젝트 상세와 모바일 레이아웃
- `docs/archive/App-before-board.tsx`: 이전 전체 메인 구성 보관

## 실행 범위
포트폴리오는 브라우저 저장 기반 시뮬레이션입니다. 글 CRUD, 댓글 CRUD, 사용자별 좋아요 등록·취소, 작성자 검사, 입력 제한, 버전 비교와 연관 삭제를 실제 소스 규칙에 맞춰 구현했습니다. 테이블 데이터 화면은 실제 SQL 컬럼명을 사용합니다. source revision별로 브라우저 저장 키를 분리합니다.

3D의 API 요소는 HTTP 요청을 설명하는 논리적인 단계입니다. 별도 API 게이트웨이나 서버를 의미하지 않습니다. 글 작성 시 문서, 좋아요 시 하트가 이동하며 실제 소스의 요청 메서드/경로와 DB 처리 내용을 표시합니다. 좋아요 요청은 소스에 맞게 `PUT /api/posts/{id}/likes/me`이며, 등록 전에 중복을 확인합니다.

실제 Spring Boot API와 H2 파일 DB는 GitHub 저장소의 Java 앱으로 별도 실행합니다. GitHub에는 실행 가능한 소스, Dockerfile, 테스트와 CI 템플릿을 게시했습니다. 현재 연결의 workflow 권한이 없어 CI는 활성화되지 않았습니다.

## 검증
Java API 통합 테스트 5개 통과. 브라우저 시뮬레이션은 CRUD/권한/버전/댓글/멱등 좋아요/연관 삭제 및 추출 모델 제약을 검증합니다. 실제 API UI와 포트폴리오 UI는 별도로 브라우저 확인합니다.

### 이미지 업로드 및 조회 체험
새 글 작성에서 PNG/JPEG 한 장(2MB, 4096×4096 이하)을 첨부합니다. data JSON + image 파일의 FormData 구성을 표시하고, 게시글 INSERT → post_images BLOB INSERT 소스 순서를 재생합니다. 저장된 이미지를 클릭하면 GET /api/images/{id} 조회 흐름을 재생합니다. Pages는 브라우저 저장 시뮬레이션이며 실제 서버 전송은 Spring Boot 저장소 UI에서 실행합니다.
모델 재생성: Spring Boot 저장소의 scripts/export-model.mjs로 board-model.json을 추출한 뒤 node scripts/export-server-source.mjs를 실행합니다.

## 실시간 채팅 프로젝트
`#project/chat`에서 두 참가자의 메시지 전송, 방 격리, 재접속, 중복 요청 처리를 체험합니다. 메시지가 발신자 → WebSocket 서버 → DB → 같은 방 참가자로 이동하고, 실제 코드의 현재 단계를 강조합니다.

실제 서버: https://github.com/seonyoungyoo16/springboot-chat-lab
구현 및 검증: [docs/chat-project.md](docs/chat-project.md)

## 로그인·로그인 유지 프로젝트

`#project/login`에서 로그인 발급, 서버 A·B의 공유 세션, 유휴·절대 만료, 로그인 유지 복원, 동시 요청, 기기 폐기와 장애 흐름을 체험합니다. 선택한 단계에 맞춰 데이터 스냅샷과 실제 Java 코드가 바뀝니다.

독립 프로젝트: https://github.com/seonyoungyoo16/springboot-login-lab

Pages 화면은 브라우저 시뮬레이션입니다. 실제 Spring Boot A·B, Redis, PostgreSQL과 HTTPS 브라우저 검증은 독립 프로젝트에서 실행합니다. 화면의 검증 결과·상세 설계·실행 방법은 고정 소스 커밋으로 연결합니다.

로그인 체험 검증:

```sh
npm run test:login
npm run verify:login-source
npm run test:login-browser
```

브라우저 검증은 개발 서버가 실행 중일 때 수행합니다. 최초 1회 `npx playwright install chromium`으로 런타임을 준비합니다. 공개 배포 URL 검증은 PowerShell에서 다음을 실행합니다.

```powershell
$env:PORTFOLIO_URL='https://seonyoungyoo16.github.io/portfolio/'
npm run test:login-browser
Remove-Item Env:PORTFOLIO_URL
```

소스 갱신은 독립 프로젝트의 변경을 커밋한 다음 `node scripts/export-login-source.mjs <login-checkout>`으로 추출합니다. `verify:login-source`는 고정 커밋의 파일 해시·행·코드 조각·정책 값을 확인합니다. [검증 기록과 범위](docs/login-project.md)

### 전송 중 연결 끊김 / 자동 재전송

참가자를 같은 방에 연결하고 `다음 전송: 저장 후 ACK 수신 전 연결 끊기`를 체크해 보냅니다. 서버 저장·방송 후 발신자가 ACK를 받기 전에 오프라인이 됩니다. `다시 접속`하면 대화 기록을 복구한 뒤 같은 requestId와 본문으로 대기 요청을 자동 재전송합니다. 서버 중복 조회 → 기존 메시지 반환 → INSERT/방송 생략 → ACK → 대기 목록 제거 순서가 3D와 소스 단계에 표시됩니다. 대기 요청은 sessionStorage에 보관하며 방송/기록 수신만으로 제거하지 않습니다. 실제 Java 앱에도 같은 장애 체험과 ACK 기준 대기 처리를 적용했습니다.


### DB 중단 / 복구 체험

두 참가자를 연결한 뒤 `DB 중단`을 누르고 메시지를 보냅니다. 저장 실패 시 DB rows와 Outbox는 늘지 않고 PC의 전송 대기에 원래 requestId·본문·방·방식을 보관합니다. `DB 복구` 시 같은 요청을 자동 재전송하여 한 건 저장하고 선택한 경로로 전달합니다. 이미 저장된 요청의 재시도는 기존 메시지 ACK만 반환합니다. DB 중단 동안 기록 조회와 읽음 저장, Outbox 발행/소비도 대기합니다.

Kafka도 중단하면 PC 전송 대기 → DB 복구 후 Outbox 보관 → Kafka 복구 후 전달 대기 → Consumer 복구 후 전달 순서로 구분해 볼 수 있습니다. Pages는 브라우저 시뮬레이션이며 실제 Java 앱은 DB 접근 실패 주입과 H2 트랜잭션 롤백 테스트를 제공합니다.


### 여러 메시지 전송 대기열

DB 중단이나 전송 처리 중에도 입력창과 보내기를 계속 사용할 수 있습니다. 대기열은 각 메시지의 원래 requestId·본문·방·전송 방식을 보관하며, 현재 요청의 ACK를 확인한 다음 요청을 꺼냅니다. 대기열에는 순서·전송 중/대기 상태를 표시하고, 저장이 끝난 원래 요청 ID는 완료 목록에서 확인합니다. 새로고침 후에도 sessionStorage의 미확인 요청을 같은 ID로 재시도합니다. 참가자별 현재 방의 요청을 처리하며, 다른 방의 요청은 그 방에 다시 접속하면 이어서 처리합니다.

검증은 현재 방식/Kafka 방식 각각 여러 요청의 저장·전달 순서, 처리 중 추가 요청, ACK 유실 후 같은 머리 요청 재시도, 두 번째 DB 장애, 중복 ACK와 방 격리를 포함합니다. 실제 서버 클라이언트의 단일 요청 전송 모듈도 별도로 검사합니다.


### 전송 대기 취소

대기열의 `취소`는 서버로 전송하기 전 요청 또는 저장 실패가 확인된 요청을 제거합니다. 취소한 ID는 sessionStorage의 대기열에서 먼저 지우고 화면을 갱신하므로, 새로고침/DB 복구 후에도 재전송하지 않습니다. 나머지는 원래 요청 ID·본문·전송 방식·순서를 유지합니다. 취소 목록과 PC의 취소/대기 건수, 서버 호출 없는 클라이언트 소스 단계로 구분합니다.

전송을 시작하기 전에 취소 불가 상태를 저장합니다. 이미 전송됐지만 ACK가 없는 요청은 저장 여부가 불확실하므로 취소 버튼을 비활성화하고 같은 ID로 결과를 확인합니다. 저장된 메시지를 지우거나 서버 작업을 취소하는 기능은 아닙니다. 저장 공간 오류가 발생하면 취소를 완료했다고 표시하지 않습니다.


### 취소 메시지 다시 보내기

취소 목록에서 `다시 보내기`를 누르면 새 UUID의 요청을 대기열 맨 뒤에 추가합니다. 본문·원래 방·전송 방식은 유지하고 기존 대기 요청의 ID·순서는 바꾸지 않습니다. 취소된 이전 ID와 다시 보낸 새 ID를 함께 표시하며, PC에서 새 ID 발급 → 맨 뒤 추가 → 대기열 저장의 실제 클라이언트 소스 단계를 재생합니다. 같은 취소 항목의 연속 클릭은 한 건만 추가합니다. 새 요청을 다시 취소한 경우 해당 새 취소 항목에서 다시 보낼 수 있습니다.

현재 방식과 Kafka 방식 모두 기존 ID는 미저장, 남은 요청 ID는 유지, 새 ID는 마지막 저장/전달, 새로고침 후 ID 유지, 새 요청의 중복 재시도 및 기존 전송 중 요청 보호를 검증합니다.

## 결제 실험실

[Spring Boot Payment Lab](https://github.com/seonyoungyoo16/springboot-payment-lab)을 다섯 번째 프로젝트로 추가했습니다. [공개 결제 체험](https://seonyoungyoo16.github.io/portfolio/#project/payment)에서 중복 승인 방지·거래 정합성·전액/부분 취소·불명 복구와 실제 소스 37개를 살펴볼 수 있습니다. 공개 화면은 브라우저 시뮬레이션이며 독립 상점/PG의 실제 백엔드 64개 브라우저·12개 SQL/API 결과는 고정 커밋으로 따로 연결합니다.

`npm run test:payment`, `npm run verify:payment-source`, `npm run test:payment-browser`. [연결 및 검증 범위](docs/payment-project.md).

결제 체험의 Three.js 장면은 현재 처리 프레임의 요청·중복 게이트·독립 원장·취소 예약을 표시합니다. 노드·원장 선택은 해당 단계와 고정 커밋 실제 소스를 함께 엽니다. 프로젝트 목록 5개는 공통 너비·열 비율과 데스크톱 24px/작은 화면 20px 간격을 사용합니다. [장면과 검증 범위](docs/payment-three.md).

로그인·회원가입·채팅·결제에도 게시판과 같은 `Overview / Side / Top / Station / Flight` View를 제공합니다. 로그인은 쿠키·A/B 서버·Redis TTL·발급 상태, 회원가입은 인증 메일·가입 게이트·SSO 신원으로 표현합니다. 선택한 요소의 처리 단계와 실제 소스를 함께 볼 수 있습니다. [요소 선택과 검증 범위](docs/project-three-views.md).

체험 화면은 `역할 → 방향 화살표와 요청 패킷 → 현재 처리 단계 → 데이터 변화` 순서로 읽습니다. 장면 안 소스 버튼은 현재 단계의 실제 코드를 열고, 요소를 선택해도 전체 흐름은 유지합니다. 카메라 View는 장면 아래 접힌 `보기 설정`에서 보조적으로 조작합니다.

로그인·가입·결제·채팅은 기본 `사용자로 체험하기`에서 번호 순서대로 행동합니다. 완료하면 결과와 다음 행동이 나타나고, 장애·서버·중복 실험 설정은 `직접 실험하기`에서 조작합니다. 모바일은 행동 직후 `처리 흐름·소스 보기`로 연결됩니다. 실제 HTTP·저장소 왕복·서버 내부 처리·브라우저 동작을 구분하고, 인증 소스 57개 및 로컬 행동 소스 13개의 고정 코드와 경로를 검사합니다. [설계와 검증 범위](docs/user-action-journeys.md).

`npm run test:auth-trace`, `npm run verify:interaction-source`, `npm run test:user-journeys-browser`. 브라우저 검사는 HMR 없는 정적 빌드에서 실행합니다. 기본 주소는 `http://127.0.0.1:5191/`, 공개 검사는 `PORTFOLIO_URL`로 지정합니다. 원본 공개 파일까지 확인하려면 `npm run verify:interaction-source -- --remote`를 실행합니다.

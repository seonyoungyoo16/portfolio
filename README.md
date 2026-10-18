# Source-based Developer Portfolio

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

### 전송 중 연결 끊김 / 자동 재전송

참가자를 같은 방에 연결하고 `다음 전송: 저장 후 ACK 수신 전 연결 끊기`를 체크해 보냅니다. 서버 저장·방송 후 발신자가 ACK를 받기 전에 오프라인이 됩니다. `다시 접속`하면 대화 기록을 복구한 뒤 같은 requestId와 본문으로 대기 요청을 자동 재전송합니다. 서버 중복 조회 → 기존 메시지 반환 → INSERT/방송 생략 → ACK → 대기 목록 제거 순서가 3D와 소스 단계에 표시됩니다. 대기 요청은 sessionStorage에 보관하며 방송/기록 수신만으로 제거하지 않습니다. 실제 Java 앱에도 같은 장애 체험과 ACK 기준 대기 처리를 적용했습니다.

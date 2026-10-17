# Chat Lab 구현과 검증

- 실제 서버 저장소: https://github.com/seonyoungyoo16/springboot-chat-lab
- 포트폴리오 경로: `#project/chat`
- 서버 실행: Java 21에서 저장소의 `scripts/maven.ps1 spring-boot:run` 후 http://localhost:8089 를 두 창에서 연다.
- 서버는 실제 native WebSocket `/ws/chat`을 사용한다. 서버가 저장/commit한 메시지를 같은 방에 방송한 뒤 발신자에게 ACK한다.
- Pages의 두 참가자 체험은 로컬 브라우저 시뮬레이션이다. 연결·방·대화·중복 요청을 상태로 처리하고 메시지 저장, 방송, ACK 시점에 따라 시각화를 갱신한다. 공개 서버에 접속했다는 표시를 하지 않는다.
- 소스 모델은 서버 저장소의 `scripts/export-flows.mjs`가 특정 Git commit에서 추출한다. 각 단계에 원본 파일, 줄, 실제 코드, 강조할 구문을 포함한다.
- 모델 갱신: 서버 저장소에서 `node scripts/export-flows.mjs . ../banking-portfolio-3d/src/generated/chat-source.json`.

## 검증 명령
```powershell
node scripts/verify-chat-source.mjs
node --experimental-strip-types scripts/test-chat-demo.ts
node --experimental-strip-types scripts/test-board-demo.ts
npm run build:pages
```

실제 서버의 `maven verify`는 임의 포트의 Tomcat에 여러 Java WebSocket 클라이언트를 연결한다. 브라우저에서도 별도 두 창 사이 양방향 전송, 접속 종료 목록, 최근 대화 재조회, 서버 프로세스 재시작 후 H2 데이터 유지를 검증했다.

Pages 체험은 대화를 입력한 뒤 처리 순서를 천천히 보여준다. 처리 중 다른 요청은 비활성화한다. 일시 정지하면 진행과 패킷 이동을 멈추고, 재개하면 남은 단계부터 실행한다. `다시 보기`는 같은 흐름을 재생하며 DB를 다시 변경하지 않는다. `같은 요청 다시 보내기`는 동일 requestId의 실제 데모 처리를 수행한다.

GitHub Pages는 Java 서버를 실행하지 않는다. 별도 서버 호스팅 없이 사용할 수 있는 공개 결과는 Pages 시각화 체험과 실제 서버의 소스/실행 파일 빌드 방법이다. Dockerfile을 제공하지만 Docker 이미지 실행 검증은 이 작업에서 수행하지 않았다.

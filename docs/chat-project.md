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
# Three.js 연결·메시지 흐름

## 읽음 확인

내 메시지 옆의 안 읽음/읽음은 상대 참가자의 `chat_reads` 읽음 위치로 결정한다. 서버 저장 ACK, 화면 미수신 건수, 읽음은 서로 다른 상태이다. 온라인만으로 읽지 않으며, 대화창이 화면에 보이고 맨 아래가 열렸을 때 READ 흐름을 자동으로 실행한다. READ 프레임 → 읽음 위치 저장 → 같은 방 온라인 참가자에게 읽음 확인 → 발신자 표시 갱신 순서다. 재접속 시 저장된 읽음 위치도 불러온다. 다시 보기는 읽음 위치를 변경하지 않는다.

읽음 위치는 방·참가자별로 앞으로만 움직인다. 이는 클라이언트가 확인했다고 보고한 마지막 메시지이며 실제 독해 측정은 아니다. 서버의 `ChatSocketTest`와 체험 테스트는 오프라인·재접속, 방 격리, 미수신과 읽음의 구분, 잘못된 읽음 ID, 과거 ID 재전송을 검증한다.

오프라인은 탈퇴나 채팅방 나가기가 아닌 실시간 소켓 연결 중단이다. 온라인 참가자가 보낸 메시지는 계속 저장되며 오프라인 참가자의 화면에는 전달하지 않는다. 화면의 미수신 건수는 현재 로드된 메시지 ID와 최근 100개 서버 기록을 비교한 체험용 수치이며, 실제 읽음 확인이나 별도 서버 큐를 뜻하지 않는다.

재접속 시 저장소 SELECT → 저장소에서 서버로 결과 반환 → 서버에서 PC로 전달 → 대화 복구 순서로 표시한다. 복구 카드가 PC에 도착한 뒤 화면의 메시지와 미수신 건수를 갱신한다. 소스는 기존 history 조회와 joined 응답을 가리킨다.

참가자 A는 왼쪽, B는 오른쪽에 고정한다. 발신자가 바뀌면 카드 이동 방향만 바뀐다. PC·앱, 말풍선 메시지 카드, 서버 랙, 채팅방 링, 메시지 저장소를 Three.js로 표시한다.

처음에는 연결 전 상태이며, 소켓 연결 버튼으로 CONNECT → OPEN → JOIN → 서버 검증 → SELECT → HISTORY → PRESENCE 순서를 보여준다. 대화 복구 단계에서 참가자를 연결 상태로 바꾼다. 방 변경은 실제 클라이언트 소스처럼 소켓을 다시 열고 입장한다. CLOSE → 서버 종료 감지 → 세션 제거·PRESENCE도 소스에 연결한다.

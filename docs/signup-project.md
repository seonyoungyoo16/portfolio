# 회원가입 프로젝트의 구현과 검증 범위

독립 프로젝트: [springboot-signup-lab](https://github.com/seonyoungyoo16/springboot-signup-lab). 공개 체험: [포트폴리오 회원가입](https://seonyoungyoo16.github.io/portfolio/#project/signup).

ALPEN과 시간 블록으로 이메일 확인 → DB 원자 가입·중복 방지 → 실제 OIDC·명시 연결 → 장애·보안·관찰 → 포트폴리오·배포 순서로 진행했다. 단계마다 실제 API·DB와 브라우저 검사를 통과시킨 뒤 다음 기능으로 진행했다. 계획 블록은 집중 50분과 점검 10분이며, 예상과 실제 실행 시간을 혼용하지 않는다. 전체 기본 브라우저 회귀 50개를 최종 실행했다.

| 범위 | 근거 | 판정 |
|---|---|---|
| 실제 이메일 요청·확인 | Spring Boot A·B, PostgreSQL challenge hash/암호화 outbox, Mailpit 실제 SMTP | 실제 백엔드 저장 검사 4개, E01~E10 포함 전체 실행 통과 |
| 실제 중복 가입·멱등 결과 | SQL 유일 제약·Argon2id·동의 행, 독립 문맥·A/B 경쟁 | 실제 SQL 검사 4개, D01~D08 포함 전체 실행 통과 |
| 실제 OIDC와 계정 연결 | Keycloak code/PKCE, state/nonce/JWKS/claims, PostgreSQL 신원 소유 | 실제 SQL 검사 4개, O01~O12 포함 전체 실행 통과 |
| 실제 장애·보안·관찰 | TCP 차단, 앱 프로세스 종료, SMTP 접수 응답 제거, Redis 재시작, CSRF/출처/만료 | F01~F10, S01~S06, U01~U04 포함 전체 50개 실행 통과 |
| 포트폴리오 설명 모델 | Pages에서 사용하는 순수 상태 모델의 정합성·소유권 불변식 | 별도 18개 검사 통과 |
| 포트폴리오 소스 | 실제 게시 커밋의 27개 발췌, 14개 파일 SHA-256·행·내용 | verify-signup-source로 대조 |
| 포트폴리오 브라우저 | 메일·가입·중복·SSO 연결·장애·소스 팝업·반응형·기존 화면 이동 | 배포 전/후 결과 JSON을 별도 보존 |

실제 백엔드 근거는 `src/generated/signup-source.json`이 가리키는 고정 커밋의 `docs/verification/COVERAGE.md`, `browser-summary.json`, `backend-summary.json`, `test-runner.json`에 있다. 해당 소스와 공개 화면의 상태 모델을 구분한다. 공개 체험의 클릭은 실제 회원을 만들거나 메일을 보내지 않는다.

F01 등의 지정 실패는 코드 체크포인트다. F02/F09는 실제 앱 종료, F03/F06/F07/F10은 실제 TCP 차단이다. F04는 SMTP 250 응답을 실제로 제거해 접수 결과 불명을 재현한다. F05는 캡처한 옛 메일을 SMTP로 재주입해 늦은 도착을 통제한다. O09는 실제 토큰의 서명을 바꾸거나 검증기의 기대 값과 시간을 통제하는 검사다. IdP가 실제로 잘못된 클레임을 발급했다는 뜻은 아니다.

SMTP 접수는 인터넷 메일 도착·스팸 판정·읽음까지 증명하지 않는다. 여러 RP 간 SSO(T01~T04), 부하 한계, 운영 가용성은 검증 범위에 포함하지 않는다. 실제 백엔드는 루프백 Windows 실험 환경이며 공개 GitHub Pages는 정적 빌드다.

실행 결과: [설명 모델](signup-verification/model.json), [배포 전 브라우저](signup-verification/local/browser.json), [배포 후 브라우저](signup-verification/published/browser.json). 기존 게시판·채팅 모델과 로그인 18개 설명 모델/브라우저 회귀도 함께 확인한다.

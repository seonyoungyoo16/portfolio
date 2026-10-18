# 결제 프로젝트와 공개 체험

독립 구현: [springboot-payment-lab](https://github.com/seonyoungyoo16/springboot-payment-lab). 소스 연결 기준은 `src/generated/payment-source.json`의 고정 커밋이다.

상점 Spring Boot A/B, Redis, 상점 PostgreSQL, Node.js Local PSP와 별도 PG PostgreSQL을 실행한다. 두 DB 클러스터 식별자, 실제 HTTP·DB 반영·소켓 단절·앱 종료를 별도로 검증했다. 원본 설계의 P/D/T/C/W/F/S/U 64개가 실제 브라우저로 통과했고 SQL/API 검사는 12개다. 새 체크아웃의 설치·다운로드·새 DB 초기화·핵심 브라우저 4개와 전체 DB 재시작 후 금융 사실 보존도 확인했다. X01~X04 외부 PG 연결은 후속 범위다.

공개 [결제 체험](https://seonyoungyoo16.github.io/portfolio/#project/payment)은 실제 백엔드를 원격 호출하지 않는 브라우저 시뮬레이션이다. 주문/인증/승인, 다른 키 재전송, PG 도착 전 장애, 승인 후 응답 유실, DB 반영 실패, 전액/부분 취소, 예약, 외부 취소 혼합, 종료 후 보상, 대사와 영수증 소비를 재현한다. PG 커밋 프레임과 상점 원장 커밋 프레임을 분리하고 선택한 단계의 스냅샷으로 데이터를 표시한다.

37개 소스 앵커를 Java·PSP·게이트웨이·프런트엔드에서 추출한다. 실제 파일 SHA-256, 시작 행, 코드 조각을 고정 커밋과 비교한다. 브라우저 검사에서는 소스 선택과 새 창 URL을 확인하고 raw GitHub 파일의 실제 응답과 해시를 대조한다. 실제 백엔드 검증 64개와 공개 체험 검증 18그룹/모델 18개는 별도 수치다.

```powershell
node scripts/export-payment-source.mjs ..\springboot-payment-lab
npm run verify:payment-source
npm run test:payment
# 로컬 정적 미리보기 서버를 실행한 다음
$env:PORTFOLIO_URL='http://127.0.0.1:5190/'
npm run test:payment-browser
# 배포 후
$env:PORTFOLIO_URL='https://seonyoungyoo16.github.io/portfolio/'
npm run test:payment-browser
Remove-Item Env:PORTFOLIO_URL
```

ALPEN 검증 블록: A는 독립 구현·실제 장애 검증·공개 체험 연결·배포, L은 기능별 50분/점검 10분의 계획 블록, P는 통합 수정 여유 30%, E는 금융 효과와 검증 근거 우선, N은 단계별 실제 결과 갱신이다. 실제 통과 시각과 결과는 `docs/payment-verification/{local,published}/browser.json`에 기록한다. 작업 계획의 예상 블록은 실제 실행 시간과 구분한다.

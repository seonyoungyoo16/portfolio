// These are reviewed explanatory boundaries, not captured network events.
export type AuthTrace = {
  action?: string;
  request?: string;
  path: string[];
  kind:
    | "request"
    | "response"
    | "store"
    | "internal"
    | "client"
    | "worker"
    | "failure";
  operation: string;
  sourceRole: "implementation" | "configuration" | "browser" | "observation";
};
type Step = { node: string; source: string; title: string };
const round = (node: string) => ["server", node, "server"];
const loginSources: Record<string, [string, string[]]> = {
  "AuthOperations.reauthenticate": [
    "비밀번호 확인 · 최근 인증 갱신",
    round("database"),
  ],
  "AuthOperations.expiredLogout": [
    "만료 세션의 유지 자격정보 폐기",
    round("database"),
  ],
  "AuthOperations.revoke": ["DB 인증 폐기 · 정리 작업 커밋", round("database")],
  "AuthOperations.recent": ["최근 비밀번호 인증 여부 검사", ["server"]],
  "AuthService.password": [
    "DB 계정 조회 · 서버 비밀번호 해시 비교",
    round("database"),
  ],
  "AuthService.prepare": ["기기 인증과 PREPARING 발급 커밋", round("database")],
  "AuthService.activate": [
    "DB 상태·버전 재검사 후 ACTIVE 커밋",
    round("database"),
  ],
  "AuthService.guard": ["공유 세션과 DB 발급 상태 검증", round("database")],
  "AuthService.write": ["보호된 설정 변경 커밋", round("database")],
  "AuthService.restore": ["유지 자격정보 교체 트랜잭션", round("database")],
  "AuthService.restore.lock": [
    "사용자·기기·유지 자격정보 잠금",
    round("database"),
  ],
  "CleanupService.clean": [
    "DB 정리 작업 확인 · Redis 키 삭제 · 완료 기록",
    ["server", "database", "server", "redis", "server", "database", "server"],
  ],
  "Faults.check": ["실험용 중단 지점 검사", ["server"]],
  "LoginLimiter.reserve": [
    "Redis Lua로 계정·IP 요청 제한 예약",
    round("redis"),
  ],
  "SecurityConfig.csrf": [
    "HTTP 요청 · CSRF 보안 설정 통과",
    ["browser", "server"],
  ],
  "SessionStore.save": ["보호 쿠키 발급·삭제", ["server", "browser"]],
  "SessionStore.ttl": ["공유 Redis 세션 저장 · TTL 설정", round("redis")],
  "SessionStore.raw": ["쿠키의 SID로 공유 Redis 세션 조회", round("redis")],
  "TraceFilter.request": ["HTTP 요청 진입", ["browser", "server"]],
  "TraceFilter.response": ["HTTP 오류 응답", ["server", "browser"]],
  "TraceLog.finish": ["서버 처리 기록 완료", ["server"]],
  "Gateway.response_lost": [
    "서버 응답 전달 중 연결 유실",
    ["server", "browser"],
  ],
  "Gateway.network": ["저장소 연결 실패", ["server"]],
  Policy: ["유휴·절대·유지 수명 정책", ["server"]],
  "AuthController.login": ["로그인 결과 응답", ["server", "browser"]],
  "AuthController.restore": ["로그인 복원 결과 응답", ["server", "browser"]],
  "AuthController.me": ["내 정보 응답", ["server", "browser"]],
  "AuthController.logout": ["현재 기기 로그아웃 응답", ["server", "browser"]],
  "AuthController.all": ["모든 기기 로그아웃 응답", ["server", "browser"]],
  "AuthController.reauth": ["재인증 결과 응답", ["server", "browser"]],
};
const signupRound = (node: string) => ["Server", node, "Server"];
const signupSources: Record<string, [string, string[]]> = {
  "AuthService.login": ["기존 계정·자격정보 조회 및 로그인", signupRound("DB")],
  "AuthService.reauthenticate": ["기존 비밀번호 재인증", signupRound("DB")],
  "Cleanup.expire": ["만료 데이터 정리", signupRound("DB")],
  "Contexts.authenticate": ["인증 컨텍스트 DB 기록", signupRound("DB")],
  "Crypto.encrypt": ["서버에서 메일 내용 암호화", ["Server"]],
  "Crypto.email": ["서버 이메일 정규화·입력 검증", ["Server"]],
  "Faults.check": ["실험용 장애 지점 검사", ["Server"]],
  "LabController.snapshot": ["실습 상태 조회", signupRound("DB")],
  "Limiter.reserve": ["Redis Lua 공유 요청 제한", signupRound("Redis")],
  "MailWorker.claim": ["DB 발송 작업 lease 선점", signupRound("DB")],
  "MailWorker.send": [
    "SMTP 접수 후 DB 발송 결과 기록",
    ["Server", "SMTP", "Server", "DB", "Server"],
  ],
  "OidcService.start": [
    "OIDC 거래 기록 후 외부 인증으로 이동",
    ["Server", "DB", "Server", "Browser", "IdP"],
  ],
  "OidcService.callback": [
    "외부 인증 응답 · 서버 코드 교환",
    ["IdP", "Browser", "Server", "IdP", "Server"],
  ],
  "OidcService.validate": ["서버에서 issuer·nonce·만료·서명 검증", ["Server"]],
  "OidcService.link": [
    "외부 신원 소유권·최근 인증 확인 후 DB 연결",
    signupRound("DB"),
  ],
  "RequestFilter.request": [
    "HTTP 요청 · 서버 문맥 검사",
    ["Browser", "Server"],
  ],
  "RequestFilter.response": ["HTTP 오류 응답", ["Server", "Browser"]],
  "SecurityConfig.csrf": ["HTTP 요청의 CSRF 검사", ["Browser", "Server"]],
  "SignupService.create": ["가입 흐름 생성 · DB 커밋", signupRound("DB")],
  "SignupService.requestEmail": [
    "인증 토큰·발송 outbox 원자 기록",
    signupRound("DB"),
  ],
  "SignupService.change": ["이메일 변경 · 이전 증명 폐기", signupRound("DB")],
  "SignupService.verify": [
    "문맥·일회용 토큰 검증 후 이메일 증명 커밋",
    signupRound("DB"),
  ],
  "SignupService.complete": [
    "DB 고유 제약·가입 결과 원자 커밋",
    signupRound("DB"),
  ],
  "TraceLog.finish": ["요청 결과 응답", ["Server", "Browser"]],
  "Gateway.network": ["의존 서비스 연결 차단 설정", ["Server"]],
  "Gateway.response_lost": [
    "커밋 후 HTTP 응답 연결 유실",
    ["Server", "Browser"],
  ],
  "Gateway.redeliver": ["같은 메일 재발송", ["Server", "SMTP", "Server"]],
};
const localLogin = new Set(["advance", "redis", "db", "close", "stale"]);
const localSignup = new Set([
  "switch",
  "wait",
  "redis",
  "db",
  "smtp",
  "smtpLoss",
  "trust",
  "open",
]);
export function describeAuthStep(
  project: "login" | "signup",
  action: string,
  frame: Step,
  index: number,
  total: number,
): AuthTrace {
  const definition = (project === "login" ? loginSources : signupSources)[
    frame.source
  ];
  if (!definition)
    throw Error(`Unreviewed ${project} source boundary: ${frame.source}`);
  const [operation, original] = definition;
  const local = (project === "login" ? localLogin : localSignup).has(action);
  if (local)
    return {
      path: [frame.node],
      kind:
        (project === "login" && action === "close") ||
        (project === "signup" && action === "open")
          ? "client"
          : "internal",
      operation:
        project === "login" && action === "close"
          ? "브라우저 내부 · 세션 쿠키 제거 · 서버 호출 없음"
          : project === "signup" && action === "open"
            ? "브라우저에서 확인 화면 열기 · 인증 POST 없음"
            : "실험 상태 변경 · 인증/가입 API 호출 없음",
      sourceRole: "browser",
    };
  if (
    project === "signup" &&
    action === "deliver" &&
    (index === 0 || index === total - 1)
  )
    return {
      path: ["Server"],
      kind: "worker",
      operation:
        index === 0
          ? "메일 작업자 시작 · 사용자 HTTP 요청과 별도"
          : "메일 작업자 처리 종료",
      sourceRole: "implementation",
    };
  let path = [...original];
  if (
    project === "login" &&
    frame.source === "AuthService.guard" &&
    frame.node === "redis"
  )
    path = round("redis");
  if (
    project === "login" &&
    frame.source === "Gateway.network" &&
    ["redis", "database"].includes(frame.node)
  )
    path = ["server", frame.node];
  if (
    project === "signup" &&
    frame.source === "Gateway.network" &&
    ["DB", "Redis", "SMTP"].includes(frame.node)
  )
    path = ["Server", frame.node];
  if (index === total - 1 && project === "login" && action === "cleanup")
    path = ["server"];
  const lost =
    frame.source === "Gateway.response_lost" ||
    frame.source === "Gateway.network";
  const kind = lost
    ? "failure"
    : path.length === 1
      ? "internal"
      : path.at(-1) === (project === "login" ? "browser" : "Browser")
        ? "response"
        : path[0] === (project === "login" ? "browser" : "Browser")
          ? "request"
          : "store";
  return {
    path,
    kind,
    operation,
    sourceRole: frame.source.endsWith("csrf")
      ? "configuration"
      : frame.source === "TraceLog.finish"
        ? "observation"
        : "implementation",
  };
}

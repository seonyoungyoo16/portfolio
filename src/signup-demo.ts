// 공개 Pages의 설명용 상태 모델. 실제 I/O 검증은 독립 Spring Boot 프로젝트 결과를 사용한다.
import { describeAuthStep, type AuthTrace } from "./auth-trace.ts";
export type Node = "Browser" | "Server" | "Redis" | "DB" | "SMTP" | "IdP";
export type Mail = {
  id: number;
  flow: number;
  generation: number;
  expires: number;
  state: "PENDING" | "DELIVERY_UNKNOWN" | "SMTP_ACCEPTED" | "EXPIRED";
  received: number;
  consumed: boolean;
};
type Proof = {
  issuer: string;
  subject: string;
  email: string;
  verified: boolean;
  expires: number;
};
type Flow = {
  id: number;
  email: string;
  generation: number;
  issued: number;
  lastIssued: number | null;
  expires: number;
  verifiedUntil: number | null;
  state: "OPEN" | "COMPLETED";
  method: "LOCAL" | "OIDC";
  provider: Proof | null;
  account: number | null;
  result: { key: string; input: string; account: number } | null;
  login: number | null;
  recent: number | null;
  epoch: number;
  link: { target: number; epoch: number; proof: Proof } | null;
};
export type SignupState = {
  now: number;
  active: 0 | 1;
  next: number;
  flows: Flow[];
  mail: Mail[];
  accounts: { id: number; email: string; method: string }[];
  identities: { issuer: string; subject: string; account: number }[];
  limits: { email: string; count: number; until: number }[];
  redisUp: boolean;
  dbUp: boolean;
  smtpUp: boolean;
  trust: boolean;
  smtpLoss: boolean;
  selectedMail: number | null;
};
export type Frame = {
  trace?: AuthTrace;
  node: Node;
  title: string;
  detail: string;
  source: string;
  snapshot: SignupState;
};
export type Action =
  | "request"
  | "deliver"
  | "open"
  | "verify"
  | "change"
  | "complete"
  | "recover"
  | "oidc"
  | "login"
  | "reauth"
  | "link"
  | "confirmLink"
  | "logout"
  | "wait"
  | "redis"
  | "db"
  | "smtp"
  | "smtpLoss"
  | "trust"
  | "switch";
export type Input = {
  email?: string;
  name?: string;
  terms?: boolean;
  key?: string;
  drop?: boolean;
  mail?: number;
  provider?: "main" | "team";
  user?: "alice" | "match";
  seconds?: number;
  browser?: 0 | 1;
};
export type Result = {
  status: number;
  code: string;
  message: string;
  frames: Frame[];
  state: SignupState;
};
const flow = (id: number): Flow => ({
  id,
  email: "new@lab.test",
  generation: 0,
  issued: 0,
  lastIssued: null,
  expires: 1800,
  verifiedUntil: null,
  state: "OPEN",
  method: "LOCAL",
  provider: null,
  account: null,
  result: null,
  login: null,
  recent: null,
  epoch: 0,
  link: null,
});
export const emptySignup = (): SignupState => ({
  now: 0,
  active: 0,
  next: 1,
  flows: [flow(0), flow(1)],
  mail: [],
  accounts: [{ id: 1, email: "existing@lab.test", method: "LOCAL" }],
  identities: [],
  limits: [],
  redisUp: true,
  dbUp: true,
  smtpUp: true,
  trust: false,
  smtpLoss: false,
  selectedMail: null,
});
export const ownFlow = (s: SignupState) => s.flows[s.active];
export const verified = (s: SignupState) =>
  !!ownFlow(s).verifiedUntil && ownFlow(s).verifiedUntil! > s.now;
const provider = (i: Input, now: number): Proof => ({
  issuer:
    "https://localhost:18443/realms/signup-" +
    (i.provider === "team" ? "team" : "lab"),
  subject: i.user === "match" ? "fixture-match" : "fixture-alice",
  email: i.user === "match" ? "existing@lab.test" : "alice@lab.test",
  verified: true,
  expires: now + 300,
});
export function executeSignup(
  previous: SignupState,
  action: Action,
  input: Input = {},
): Result {
  const s = structuredClone(previous),
    frames: Frame[] = [];
  let f = ownFlow(s);
  const step = (node: Node, title: string, detail: string, source: string) =>
    frames.push({ node, title, detail, source, snapshot: structuredClone(s) });
  const done = (status: number, code: string, message: string) => {
    step(
      "Browser",
      status ? `${status} · ${code}` : code,
      message,
      "TraceLog.finish",
    );
    return {
      status,
      code,
      message,
      frames: frames.map((f, i) => ({
        ...f,
        trace: {
          ...describeAuthStep("signup", action, f, i, frames.length),
          action,
        },
      })),
      state: s,
    };
  };
  step(
    action === "deliver" ? "Server" : "Browser",
    action === "deliver" ? "메일 작업자 시작" : "브라우저 조작",
    `컨텍스트 ${s.active ? "B" : "A"} · 시뮬레이션 시간 ${s.now}초`,
    action === "deliver" ? "MailWorker.claim" : "RequestFilter.request",
  );
  if (action === "switch") {
    s.active = input.browser || 0;
    s.selectedMail = null;
    return done(
      200,
      "CONTEXT_SELECTED",
      "독립된 두 가입 흐름은 DB의 계정 목록과 제한을 공유합니다.",
    );
  }
  if (action === "wait") {
    s.now += input.seconds || 60;
    for (const m of s.mail)
      if (m.state !== "SMTP_ACCEPTED" && m.expires <= s.now)
        m.state = "EXPIRED";
    step(
      "DB",
      "서버 만료 기준",
      "관찰과 시간 이동은 증명을 연장하지 않습니다.",
      "Cleanup.expire",
    );
    return done(
      200,
      "CLOCK_ADVANCED",
      "메일·확인 증명·재인증의 남은 시간을 비교하세요.",
    );
  }
  if (["redis", "db", "smtp"].includes(action)) {
    if (action === "redis") s.redisUp = !s.redisUp;
    if (action === "db") s.dbUp = !s.dbUp;
    if (action === "smtp") s.smtpUp = !s.smtpUp;
    step(
      "Server",
      "의존 서비스 장애 실험",
      "공개 화면에서는 상태를 바꾸며 실제 TCP 차단 검증은 원본 프로젝트에 있습니다.",
      "Gateway.network",
    );
    return done(
      200,
      "DEPENDENCY_CHANGED",
      "같은 요청의 상태를 복구 후 다시 확인하세요.",
    );
  }
  if (action === "smtpLoss") {
    s.smtpLoss = !s.smtpLoss;
    return done(
      200,
      "SMTP_RESPONSE_LOSS",
      s.smtpLoss
        ? "다음 SMTP 접수 응답 유실을 설정했습니다."
        : "유실 설정을 해제했습니다.",
    );
  }
  if (action === "trust") {
    s.trust = !s.trust;
    return done(
      200,
      "EMAIL_TRUST_CHANGED",
      "main 공급자의 email_verified만 명시 정책에 따라 신뢰합니다.",
    );
  }
  if (!s.dbUp) {
    step(
      "DB",
      "DB 연결 확인 불가",
      "요청한 DB 처리를 시도할 수 없어 성공으로 처리하지 않습니다.",
      "Gateway.network",
    );
    return done(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "DB 결과를 확인할 수 없습니다. 성공으로 추정하지 않습니다.",
    );
  }
  if (action === "deliver") {
    for (const m of s.mail.filter((m) =>
      ["PENDING", "DELIVERY_UNKNOWN"].includes(m.state),
    )) {
      const owner = s.flows[m.flow];
      step(
        "DB",
        "작업자 lease 선점",
        "A·B 작업자 중 하나가 메시지를 선점합니다.",
        "MailWorker.claim",
      );
      if (
        m.expires <= s.now ||
        m.generation !== owner.generation ||
        owner.state !== "OPEN"
      ) {
        m.state = "EXPIRED";
        continue;
      }
      if (!s.smtpUp) {
        m.state = "DELIVERY_UNKNOWN";
        step(
          "SMTP",
          "접수 확인 불가",
          "durable outbox에 남겨 재시도합니다.",
          "MailWorker.send",
        );
        continue;
      }
      m.received++;
      if (s.smtpLoss) {
        m.state = "DELIVERY_UNKNOWN";
        s.smtpLoss = false;
        step(
          "SMTP",
          "접수 후 응답 유실",
          "메일은 도착했지만 접수 응답을 확인하지 못해 같은 링크로 재시도합니다.",
          "Gateway.network",
        );
      } else {
        m.state = "SMTP_ACCEPTED";
        step(
          "SMTP",
          "메일 접수",
          "SMTP 접수는 인터넷 도착·읽음과 구분합니다.",
          "MailWorker.send",
        );
      }
    }
    return done(
      200,
      "WORKER_POLLED",
      "수신 횟수와 outbox 상태를 각각 확인하세요.",
    );
  }
  if (!s.redisUp) {
    step(
      "Redis",
      "Redis 연결 확인 불가",
      "공유 제한과 문맥을 확인할 수 없어 요청을 차단합니다.",
      "Gateway.network",
    );
    return done(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "Redis 제한·브라우저 문맥을 확인할 수 없습니다. 계정을 만들지 않습니다.",
    );
  }
  step(
    "Server",
    "CSRF와 소유 문맥 검사",
    "가입 쿠키는 로그인 권한과 분리합니다.",
    "SecurityConfig.csrf",
  );
  if (action === "login") {
    f.login = 1;
    f.recent = s.now;
    f.epoch++;
    step(
      "DB",
      "기존 자격정보 확인",
      "실제 프로젝트는 Argon2id 검증 뒤 인증 문맥을 회전합니다.",
      "AuthService.login",
    );
    return done(
      200,
      "AUTHENTICATED",
      "실습용 기존 계정에 로그인했습니다. 신원은 아직 연결되지 않았습니다.",
    );
  }
  if (action === "reauth") {
    if (!f.login)
      return done(401, "LOGIN_REQUIRED", "기존 계정에 먼저 로그인하세요.");
    f.recent = s.now;
    f.epoch++;
    f.link = null;
    step(
      "DB",
      "기존 수단 재확인",
      "최근 인증 시각과 문맥을 갱신합니다.",
      "AuthService.reauthenticate",
    );
    return done(
      200,
      "REAUTHENTICATED",
      "외부 신원 연결을 새로 시작할 수 있습니다.",
    );
  }
  if (action === "logout") {
    f.login = null;
    f.recent = null;
    f.epoch++;
    return done(
      200,
      "LOGGED_OUT",
      "기존 연결 증명의 대상 계정은 바뀌지 않습니다. 최종 연결은 거부됩니다.",
    );
  }
  if (action === "link" || action === "oidc") {
    if (
      action === "link" &&
      (!f.login || f.recent === null || f.recent + 300 <= s.now)
    )
      return done(
        403,
        "REAUTH_REQUIRED",
        "기존 계정의 로그인과 최근 재확인이 필요합니다.",
      );
    const proof = provider(input, s.now);
    step(
      "IdP",
      "외부 인증 · Code + PKCE",
      "실제 Keycloak의 인증 결과를 검증하는 경로를 설명합니다.",
      "OidcService.start",
    );
    step(
      "Server",
      "state · nonce · 서명 · issuer · audience 검증",
      "이 정적 체험은 공급자와 통신하지 않습니다. 실제 검증은 원본 프로젝트에 있습니다.",
      "OidcService.validate",
    );
    if (action === "link") {
      f.link = { target: f.login!, epoch: f.epoch, proof };
      step(
        "DB",
        "대상 계정에 외부 증명 결속",
        "아직 external_identities를 만들지 않습니다.",
        "OidcService.callback",
      );
      return done(
        200,
        "LINK_PROOF_READY",
        "외부 신원을 확인했습니다. 연결 확정 버튼이 필요합니다.",
      );
    }
    if (
      s.identities.some(
        (i) => i.issuer === proof.issuer && i.subject === proof.subject,
      )
    )
      return done(
        409,
        "IDENTITY_ALREADY_REGISTERED",
        "기존 SSO 로그인 경로를 사용하세요. 새 계정을 만들지 않습니다.",
      );
    if (f.state !== "OPEN" || f.expires <= s.now)
      return done(410, "FLOW_EXPIRED", "새 가입 흐름이 필요합니다.");
    f.method = "OIDC";
    f.provider = proof;
    if (!verified(s)) f.email = proof.email;
    if (s.trust && input.provider !== "team") {
      f.verifiedUntil = Math.min(s.now + 600, f.expires);
      step(
        "DB",
        "명시적으로 신뢰한 이메일 확인",
        "main의 email_verified=true에 한해 정책을 적용합니다.",
        "OidcService.callback",
      );
    } else
      step(
        "DB",
        "자체 이메일 확인 대기",
        "이메일 클레임만으로 기존 계정에 연결하지 않습니다.",
        "OidcService.callback",
      );
    return done(
      200,
      "PROVIDER_PROOF_READY",
      verified(s)
        ? "동의 후 가입을 확정하세요."
        : "자체 이메일 확인 후 가입할 수 있습니다.",
    );
  }
  if (action === "confirmLink") {
    if (
      !f.login ||
      !f.link ||
      f.link.target !== f.login ||
      f.link.epoch !== f.epoch
    )
      return done(
        403,
        "LINK_OWNER_CHANGED",
        "로그인 대상이나 인증 문맥이 변경되어 다시 확인해야 합니다.",
      );
    if (f.recent === null || f.recent + 300 <= s.now)
      return done(
        403,
        "REAUTH_REQUIRED",
        "기존 로그인 수단으로 다시 확인하세요.",
      );
    const p = f.link.proof,
      old = s.identities.find(
        (i) => i.issuer === p.issuer && i.subject === p.subject,
      );
    if (old && old.account !== f.login)
      return done(
        409,
        "IDENTITY_CONFLICT",
        "다른 계정의 신원을 가져올 수 없습니다.",
      );
    if (!old)
      s.identities.push({
        issuer: p.issuer,
        subject: p.subject,
        account: f.login,
      });
    f.link = null;
    step(
      "DB",
      "신원 유일 제약 + 연결 커밋",
      "accountId와 기존 비밀번호는 유지합니다.",
      "OidcService.link",
    );
    return done(
      200,
      "IDENTITY_LINKED",
      "기존 계정에 신원만 명시적으로 연결했습니다.",
    );
  }
  if (action === "recover") {
    if (!f.result)
      return done(
        404,
        "RESULT_NOT_FOUND",
        "확정 결과가 없습니다. 같은 키로 재시도하세요.",
      );
    return done(
      200,
      "RESULT_RECOVERED",
      "자기 가입 흐름의 저장된 accountId " +
        f.result.account +
        "를 복구했습니다.",
    );
  }
  if (f.expires <= s.now)
    return done(
      410,
      "FLOW_EXPIRED",
      "가입 흐름이 만료되었습니다. 실험 초기화로 시작하세요.",
    );
  if (action === "complete") {
    const key = input.key || "fixed-completion-key",
      fingerprint = JSON.stringify({
        name: input.name || "신규 회원",
        terms: input.terms,
        method: f.method,
      });
    if (f.result) {
      if (f.result.key !== key)
        return done(409, "FLOW_COMPLETED", "이미 완료한 가입 흐름입니다.");
      if (f.result.input !== fingerprint)
        return done(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "같은 키에 다른 입력을 사용할 수 없습니다.",
        );
      return done(
        200,
        "SAME_RESULT",
        "저장된 계정 " +
          f.result.account +
          "를 반환하며 추가 행을 만들지 않습니다.",
      );
    }
    if (f.provider && f.provider.expires <= s.now)
      return done(
        403,
        "OIDC_PROOF_EXPIRED",
        "외부 인증 증명이 만료되어 다시 시작해야 합니다.",
      );
    if (!verified(s))
      return done(
        403,
        "EMAIL_PROOF_REQUIRED",
        "현재 이메일의 확인 증명이 필요합니다.",
      );
    if (!input.terms)
      return done(400, "CONSENT_REQUIRED", "필수 동의가 필요합니다.");
    step(
      "DB",
      "흐름 잠금 · 증명과 동의 재검사",
      "같은 키 결과를 먼저 확인하고 최신 만료·정책을 다시 검사합니다.",
      "SignupService.complete",
    );
    if (s.accounts.some((a) => a.email === f.email.toLowerCase())) {
      step(
        "DB",
        "이메일 유일 제약 · 패자 롤백",
        "계정·자격정보·동의가 부분 생성되지 않습니다.",
        "SignupService.complete",
      );
      return done(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "기존 계정으로 자동 로그인·연결하지 않습니다.",
      );
    }
    const id = s.accounts.length + 1;
    s.accounts.push({ id, email: f.email.toLowerCase(), method: f.method });
    if (f.provider)
      s.identities.push({
        issuer: f.provider.issuer,
        subject: f.provider.subject,
        account: id,
      });
    f.account = id;
    f.state = "COMPLETED";
    f.result = { key, input: fingerprint, account: id };
    step(
      "DB",
      "계정 · 이메일 · 자격정보 · 동의 · 결과 커밋",
      "실제 LOCAL은 Argon2id, OIDC는 issuer/subject 신원을 같은 트랜잭션으로 저장합니다.",
      "SignupService.complete",
    );
    if (input.drop) {
      step(
        "Server",
        "커밋 후 HTTP 응답 유실",
        "클라이언트는 결과를 모르지만 DB 확정 결과는 남습니다.",
        "Gateway.response_lost",
      );
      return done(
        0,
        "RESPONSE_LOST",
        "결과 확인 또는 같은 요청 재전송으로 복구하세요.",
      );
    }
    return done(
      201,
      "ACCOUNT_CREATED",
      "가입을 확정했습니다. 로그인 권한은 별도로 얻어야 합니다.",
    );
  }
  if (action === "change") {
    if (f.state !== "OPEN")
      return done(
        409,
        "FLOW_COMPLETED",
        "이미 확정한 이메일을 이 흐름에서 바꿀 수 없습니다.",
      );
    f.email = input.email?.trim().toLowerCase() || "";
    f.generation++;
    f.verifiedUntil = null;
    step(
      "DB",
      "이메일 수정 · 이전 증명 폐기",
      "새 이메일은 다시 확인해야 합니다.",
      "SignupService.change",
    );
    return done(
      200,
      "EMAIL_CHANGED",
      "새 이메일 확인 전에는 가입할 수 없습니다.",
    );
  }
  if (action === "request") {
    if (f.state !== "OPEN")
      return done(409, "FLOW_COMPLETED", "이미 완료한 흐름입니다.");
    const email = (input.email || f.email).trim().toLowerCase();
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
      return done(400, "INVALID_EMAIL", "이메일 형식을 확인하세요.");
    const limit = s.limits.find((l) => l.email === email && l.until > s.now);
    if (limit && limit.count >= 5)
      return done(
        429,
        "EMAIL_LIMIT",
        "공유 Redis의 시간당 이메일 한도에 도달했습니다.",
      );
    if (f.lastIssued !== null && f.lastIssued + 60 > s.now)
      return done(429, "RESEND_COOLDOWN", "재발송 간격 60초가 지나야 합니다.");
    if (f.issued >= 3)
      return done(429, "FLOW_MAIL_LIMIT", "흐름당 메일은 최대 3회입니다.");
    if (limit) limit.count++;
    else s.limits.push({ email, count: 1, until: s.now + 3600 });
    step(
      "Redis",
      "발급 제한 원자 판정",
      "A·B는 같은 이메일 제한을 공유합니다.",
      "Limiter.reserve",
    );
    f.email = email;
    f.generation++;
    f.issued++;
    f.lastIssued = s.now;
    f.verifiedUntil = null;
    s.mail.push({
      id: s.next++,
      flow: s.active,
      generation: f.generation,
      expires: Math.min(s.now + 600, f.expires),
      state: "PENDING",
      received: 0,
      consumed: false,
    });
    step(
      "DB",
      "challenge + 암호화 outbox 원자 커밋",
      "확인 토큰의 해시와 비동기 발송 작업을 함께 남깁니다.",
      "SignupService.requestEmail",
    );
    return done(
      202,
      "REQUEST_ACCEPTED",
      "접수했습니다. 작업자 실행 후 메일함에서 링크를 열어 주세요.",
    );
  }
  const mail = s.mail.find((m) => m.id === (input.mail ?? s.selectedMail));
  if (!mail || !mail.received)
    return done(404, "MAIL_NOT_FOUND", "수신한 메일을 먼저 선택하세요.");
  if (action === "open") {
    s.selectedMail = mail.id;
    return done(
      200,
      "CONFIRMATION_REQUIRED",
      "링크를 열기만 해서는 확인되지 않습니다. 확인 POST 버튼을 누르세요.",
    );
  }
  if (action === "verify") {
    if (mail.flow !== s.active)
      return done(
        403,
        "FLOW_OWNER_MISMATCH",
        "가입을 시작한 브라우저 문맥에서 확인해야 합니다.",
      );
    if (mail.generation !== f.generation || mail.expires <= s.now)
      return done(
        410,
        "CHALLENGE_EXPIRED",
        "만료되었거나 이전 세대의 메일입니다.",
      );
    if (!mail.consumed) {
      mail.consumed = true;
      f.verifiedUntil = Math.min(s.now + 600, f.expires);
    } else if (!verified(s))
      return done(
        410,
        "PROOF_EXPIRED",
        "같은 링크로 확인 증명을 연장할 수 없습니다.",
      );
    step(
      "DB",
      "소유 · 세대 · 만료 · 한 번 소비",
      "메일 재전송이 기존 계정의 비밀번호를 바꾸지 않습니다.",
      "SignupService.verify",
    );
    return done(
      200,
      "EMAIL_VERIFIED",
      s.accounts.some((a) => a.email === f.email)
        ? "이미 가입한 주소입니다. 기존 로그인 후 연결하세요."
        : "이메일을 확인했습니다. 이제 가입 정보를 확정할 수 있습니다.",
    );
  }
  return done(400, "UNKNOWN_ACTION", "동작을 다시 선택하세요.");
}

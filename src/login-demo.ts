// Pages 체험용 상태 모델. 인증·저장소 I/O는 독립 Spring Boot 프로젝트에서 검증한다.
import model from "./generated/login-source.json" with { type: "json" };
export type Node = "browser" | "server" | "redis" | "database";
export type Source = keyof typeof model.sources;
export type Device = 0 | 1;
type Browser = {
  sid: string | null;
  remember: { grant: string; generation: number } | null;
  authenticated: boolean;
};
export type Grant = {
  id: string;
  device: Device;
  version: number;
  revoked: boolean;
  end: number;
  remember: boolean;
  generation: number;
  previousAt: number | null;
};
export type Session = {
  id: string;
  grant: string;
  version: number;
  state: "PREPARING" | "ACTIVE" | "REVOKED";
  redis: boolean;
  idleUntil: number;
  absolute: number;
  method: "PASSWORD" | "REMEMBER";
  passwordAt: number | null;
};
export type LoginState = {
  now: number;
  next: number;
  version: number;
  redisUp: boolean;
  dbUp: boolean;
  browsers: Browser[];
  grants: Grant[];
  sessions: Session[];
  cleanup: string[];
};
export type Frame = {
  node: Node;
  title: string;
  detail: string;
  source: Source;
  state: LoginState;
};
export type Kind =
  | "login"
  | "me"
  | "restore"
  | "concurrent"
  | "replay"
  | "close"
  | "logout"
  | "logoutAll"
  | "reauth"
  | "advance"
  | "redis"
  | "db"
  | "cleanup"
  | "partial"
  | "lost"
  | "stale"
  | "deferred";
export type Action = {
  kind: Kind;
  device?: Device;
  remember?: boolean;
  password?: string;
  seconds?: number;
  available?: boolean;
};
export type Result = {
  state: LoginState;
  frames: Frame[];
  status: number;
  code: string;
  message: string;
  request: string;
};
export const policy = model.policy;
export const fixturePassword = "Lab!2026Pass";
const copy = <T>(value: T): T => structuredClone(value);
export const emptyLogin = (): LoginState => ({
  now: 0,
  next: 1,
  version: 0,
  redisUp: true,
  dbUp: true,
  browsers: [0, 1].map(() => ({
    sid: null,
    remember: null,
    authenticated: false,
  })),
  grants: [],
  sessions: [],
  cleanup: [],
});
export function sessionOf(state: LoginState, device: Device) {
  return state.sessions.find((s) => s.id === state.browsers[device].sid);
}
export function redisTTL(state: LoginState, session: Session) {
  return session.redis
    ? Math.max(0, Math.min(session.idleUntil, session.absolute) - state.now)
    : 0;
}
export function executeLogin(previous: LoginState, action: Action): Result {
  const state = copy(previous),
    frames: Frame[] = [],
    device = action.device ?? 0,
    browser = state.browsers[device],
    p = policy;
  const route: Partial<Record<Kind, string>> = {
    me: "GET /api/auth/me",
    concurrent: "POST /api/auth/restore",
    replay: "POST /api/auth/restore",
    lost: "POST /api/auth/restore",
    partial: "POST /api/auth/login",
    reauth: "POST /api/auth/reauthenticate",
    logoutAll: "POST /api/auth/logout-all",
    deferred: "POST /api/auth/logout",
  };
  let status = 200,
    code = "OK",
    message = "",
    request = route[action.kind] || "POST /api/auth/" + action.kind;
  const frame = (node: Node, title: string, detail: string, source: Source) =>
    frames.push({ node, title, detail, source, state: copy(state) });
  const finish = (s: number, c: string, text: string) => {
    status = s;
    code = c;
    message = text;
    const responseSource: Source =
      s >= 400
        ? "TraceFilter.response"
        : c === "AUTHENTICATED"
          ? action.kind === "login"
            ? "AuthController.login"
            : "AuthController.restore"
          : c === "SESSION_VALID"
            ? "AuthController.me"
            : c.startsWith("LOGGED_OUT")
              ? action.kind === "logoutAll"
                ? "AuthController.all"
                : "AuthController.logout"
              : c === "REAUTHENTICATED"
                ? "AuthController.reauth"
                : c === "RESPONSE_LOST"
                  ? "Gateway.response_lost"
                  : frames.at(-1)?.source || "TraceFilter.request";
    frame("browser", s + " · " + c, text, responseSource);
    return { state, frames, status, code, message, request };
  };
  const unavailable = (target: "redis" | "db") => {
    const title = target === "redis" ? "Redis" : "PostgreSQL";
    frame(
      target === "redis" ? "redis" : "database",
      title + " 연결 확인 불가",
      "인증 성공으로 처리하지 않고 503을 반환합니다.",
      "Gateway.network",
    );
    return finish(
      503,
      "AUTH_UNAVAILABLE",
      title + " 연결을 복구한 뒤 인증 상태를 다시 확인하세요.",
    );
  };
  const grantOf = (s: Session) => state.grants.find((g) => g.id === s.grant)!;
  const fresh = (g: Grant, method: "PASSWORD" | "REMEMBER") => {
    const s: Session = {
      id: "SID-" + state.next++,
      grant: g.id,
      version: state.version,
      state: "PREPARING",
      redis: false,
      idleUntil: state.now + p.idle,
      absolute: Math.min(state.now + p.absolute, g.end),
      method,
      passwordAt: method === "PASSWORD" ? state.now : null,
    };
    state.sessions.push(s);
    return s;
  };
  const issue = (s: Session, g: Grant) => {
    s.redis = true;
    frame(
      "redis",
      "공유 세션 저장",
      "A·B가 같은 Redis를 사용합니다. TTL = min(유휴 수명, 절대 잔여 수명).",
      "SessionStore.ttl",
    );
    if (action.kind === "partial") {
      frame(
        "server",
        "ACTIVE 확정 직전에 중단",
        "Redis 키가 있어도 DB가 PREPARING이면 인증에 사용할 수 없습니다. 성공 쿠키는 발급하지 않습니다.",
        "Faults.check",
      );
      return finish(
        503,
        "ACTIVATION_INTERRUPTED",
        "PREPARING 기록과 Redis 키가 남았지만 브라우저는 로그인되지 않았습니다.",
      );
    }
    s.state = "ACTIVE";
    frame(
      "database",
      "폐기·버전 재확인 후 ACTIVE 커밋",
      "DB 활성화가 끝난 세션만 브라우저로 전달합니다.",
      "AuthService.activate",
    );
    if (action.kind === "lost") {
      frame(
        "server",
        "서버 처리 후 응답 유실",
        "토큰은 이미 교체됐지만 새 쿠키는 브라우저에 도착하지 않았습니다.",
        "Gateway.response_lost",
      );
      return finish(
        0,
        "RESPONSE_LOST",
        "기존 유지 토큰으로 되돌리지 않습니다. 비밀번호로 다시 로그인하세요.",
      );
    }
    browser.sid = s.id;
    browser.authenticated = true;
    if (g.remember)
      browser.remember = { grant: g.id, generation: g.generation };
    else browser.remember = null;
    frame(
      "browser",
      "보호 쿠키 수신",
      "실제 서버는 Secure · HttpOnly · SameSite=Lax · Path=/의 __Host- 쿠키를 발급합니다. 여기는 설명용 식별자입니다.",
      "SessionStore.save",
    );
    return finish(
      200,
      "AUTHENTICATED",
      s.method === "PASSWORD"
        ? "비밀번호 로그인 완료 · 기기 " + (device ? "B" : "A")
        : "로그인 복원 완료 · 고정 유지 종료 시각은 늘어나지 않습니다.",
    );
  };
  if (action.kind === "advance") {
    state.now += Math.max(0, action.seconds ?? 0);
    request = "LAB · 가상 시계 이동";
    frame(
      "server",
      "관찰용 시계 이동 +" + action.seconds + "초",
      "이동 자체는 인증 활동이 아닙니다. Redis 유휴 수명과 절대 종료 시각을 연장하지 않습니다. 실제 백엔드 테스트는 실제 경과 시간을 사용합니다.",
      "Policy",
    );
    return finish(
      200,
      "CLOCK_ADVANCED",
      "실습 시간 " + state.now + "초 · 보호 요청으로 만료 여부를 확인하세요.",
    );
  }
  if (action.kind === "redis" || action.kind === "db") {
    const key = action.kind === "redis" ? "redisUp" : "dbUp";
    state[key] = action.available ?? !state[key];
    request = "LAB · 저장소 연결 변경";
    frame(
      action.kind === "redis" ? "redis" : "database",
      (action.kind === "redis" ? "Redis" : "DB") +
        (state[key] ? " 연결 복구" : " 연결 차단"),
      "실제 실험실에서는 앱과 저장소 사이의 TCP 경로를 차단합니다. 이 체험은 같은 분기를 시뮬레이션합니다.",
      "Gateway.network",
    );
    return finish(
      200,
      "NETWORK_CHANGED",
      "다음 인증 요청에서 연결 상태를 확인합니다.",
    );
  }
  if (action.kind === "close") {
    browser.sid = null;
    browser.authenticated = false;
    request = "LAB · 세션 쿠키 없는 재방문";
    frame(
      "browser",
      "세션 쿠키 없이 재방문",
      browser.remember
        ? "유지 자격정보만 남았습니다. 로그인 복원을 눌러 교체 과정을 확인하세요."
        : "일반 로그인에는 유지 쿠키가 없습니다. 비밀번호 로그인이 필요합니다.",
      "SessionStore.save",
    );
    return finish(
      200,
      "BROWSER_REVISIT",
      "서버의 기존 세션은 TTL까지 남을 수 있습니다. 여기서는 브라우저 종료를 설명하기 위해 세션 식별자를 제거했습니다.",
    );
  }
  if (action.kind === "cleanup") {
    request = "WORKER · 정리 재시도";
    if (!state.dbUp) return unavailable("db");
    if (!state.redisUp) return unavailable("redis");
    for (const id of state.cleanup) {
      const s = state.sessions.find((s) => s.id === id);
      if (s) s.redis = false;
    }
    state.cleanup = [];
    frame(
      "redis",
      "폐기 세션 정리 재시도",
      "DB 폐기와 별개로 남아 있던 Redis 키를 삭제합니다.",
      "CleanupService.clean",
    );
    return finish(
      200,
      "CLEANUP_DONE",
      "대기 중이던 Redis 정리를 완료했습니다.",
    );
  }
  if (action.kind === "stale") {
    request = "LAB · 폐기된 Redis 스냅샷 복구";
    const s = [...state.sessions]
      .reverse()
      .find((s) => s.state === "REVOKED" && grantOf(s).device === device);
    if (!s)
      return finish(
        400,
        "NO_REVOKED_SESSION",
        "현재 기기에서 먼저 로그아웃을 실행하세요.",
      );
    s.redis = true;
    s.idleUntil = state.now + p.idle;
    browser.sid = s.id;
    browser.authenticated = false;
    frame(
      "redis",
      "오래된 Redis 키 복구",
      "DB 폐기 상태와 버전은 되돌리지 않습니다. 보호 요청으로 차단 여부를 확인하세요.",
      "AuthService.guard",
    );
    return finish(
      200,
      "STALE_RESTORED",
      "옛 쿠키와 Redis 키가 있어도 DB 검증에서 폐기 상태를 확인합니다.",
    );
  }
  frame(
    "browser",
    request,
    "기기 " +
      (device ? "B" : "A") +
      "에서 요청을 보냅니다. 실제 프로젝트의 POST에는 CSRF 검증을 적용합니다.",
    "SecurityConfig.csrf",
  );
  if (!state.redisUp) return unavailable("redis");
  if (!state.dbUp) return unavailable("db");
  if (action.kind === "login" || action.kind === "partial") {
    frame(
      "redis",
      "계정·IP별 요청 제한",
      "실제 서버는 검증 중 요청과 실패 횟수를 Redis Lua에서 원자적으로 예약합니다.",
      "LoginLimiter.reserve",
    );
    frame(
      "server",
      "비밀번호 해시 검증",
      "BCrypt로 입력과 DB 해시를 비교합니다. 체험용 공개 계정만 사용하세요.",
      "AuthService.password",
    );
    if (action.password !== fixturePassword)
      return finish(
        401,
        "AUTHENTICATION_FAILED",
        "아이디 또는 비밀번호를 확인해 주세요.",
      );
    const remember = action.remember ?? false,
      g: Grant = {
        id: "GRANT-" + state.next++,
        device,
        version: state.version,
        revoked: false,
        end: state.now + (remember ? p.remember : p.absolute),
        remember,
        generation: 0,
        previousAt: null,
      };
    state.grants.push(g);
    const s = fresh(g, "PASSWORD");
    frame(
      "database",
      "기기 인증과 PREPARING 커밋",
      remember
        ? "로그인 유지의 원문 대신 토큰 해시와 고정 종료 시각을 저장합니다."
        : "기기 인증과 발급 기록을 남기고 Redis 저장을 준비합니다.",
      "AuthService.prepare",
    );
    return issue(s, g);
  }
  if (["restore", "concurrent", "replay", "lost"].includes(action.kind)) {
    const saved = browser.remember,
      g = saved && state.grants.find((g) => g.id === saved.grant);
    if (!saved || !g)
      return finish(
        401,
        "REMEMBER_INVALID",
        "유효한 로그인 유지 정보가 없습니다.",
      );
    frame(
      "database",
      "사용자·기기·유지 자격정보 행 잠금",
      "같은 유지 자격정보의 두 요청이 동시에 교체를 커밋하지 못하도록 잠그고 상태를 재검증합니다.",
      "AuthService.restore.lock",
    );
    if (g.end <= state.now)
      return finish(
        401,
        "REMEMBER_EXPIRED",
        "로그인 유지 기간이 끝났습니다. 비밀번호로 로그인하세요.",
      );
    if (g.revoked || g.version !== state.version)
      return finish(401, "AUTH_REVOKED", "로그인 권한이 해제되었습니다.");
    const sent =
      action.kind === "replay"
        ? Math.max(-1, saved.generation - 1)
        : saved.generation;
    if (sent !== g.generation) {
      const racing =
        sent === g.generation - 1 &&
        g.previousAt !== null &&
        g.previousAt + p.grace > state.now;
      frame(
        "database",
        "행 잠금 후 토큰 세대 재검증",
        "현재 해시와 일치하지 않습니다. 유예 시간 안의 이전 토큰은 409, 그 이후에는 401입니다. 성공 쿠키를 지우지 않습니다.",
        "AuthService.restore",
      );
      return finish(
        racing ? 409 : 401,
        racing ? "RESTORE_ALREADY_PROCESSED" : "REMEMBER_STALE",
        racing
          ? "다른 탭에서 이미 복원했습니다. 성공한 새 쿠키를 유지합니다."
          : "이미 사용한 유지 토큰입니다. 현재의 유효한 인증 묶음은 별도로 유지합니다.",
      );
    }
    g.generation++;
    g.previousAt = state.now;
    const s = fresh(g, "REMEMBER");
    frame(
      "database",
      "잠금 → 현재 토큰 검증 → 세대 교체",
      "generation " +
        (g.generation - 1) +
        " → " +
        g.generation +
        " · PREPARING 기록을 같은 트랜잭션에 커밋합니다.",
      "AuthService.restore",
    );
    const result = issue(s, g);
    if (action.kind === "concurrent") {
      frame(
        "database",
        "동시에 보낸 두 번째 요청: 409",
        "같은 이전 토큰으로 온 두 번째 요청은 성공 세대의 쿠키를 덮어쓰거나 지우지 않습니다.",
        "AuthService.restore",
      );
      return finish(
        200,
        "CONCURRENT_200_409",
        "동일 토큰의 동시 복원: 200 / 409 · 새 인증 세션 1개, 토큰 교체 1회.",
      );
    }
    return result;
  }
  const s = sessionOf(state, device),
    g = s && grantOf(s);
  frame(
    "redis",
    "공유 세션 조회",
    "서버 인스턴스와 관계없이 같은 세션 키를 조회합니다.",
    "AuthService.guard",
  );
  const validSession = s && s.redis && redisTTL(state, s) > 0;
  if (action.kind === "logout" && !validSession) {
    const saved = browser.remember,
      expiredGrant = saved && state.grants.find((g) => g.id === saved.grant);
    if (
      expiredGrant &&
      !expiredGrant.revoked &&
      expiredGrant.end > state.now &&
      (expiredGrant.generation === saved!.generation ||
        expiredGrant.generation - 1 === saved!.generation)
    ) {
      expiredGrant.revoked = true;
      for (const item of state.sessions.filter(
        (s) => s.grant === expiredGrant.id,
      )) {
        item.state = "REVOKED";
        item.redis = false;
      }
      frame(
        "database",
        "만료된 세션에서도 유지 자격정보 폐기",
        "유효한 유지 자격정보를 확인해 인증 묶음을 서버에서 폐기합니다. 쿠키 삭제만으로 끝내지 않습니다.",
        "AuthOperations.expiredLogout",
      );
    }
    browser.sid = null;
    browser.remember = null;
    browser.authenticated = false;
    return finish(
      204,
      "LOGGED_OUT",
      "현재 기기의 로그인 유지 권한을 폐기하고 쿠키를 삭제했습니다.",
    );
  }
  if (!validSession) {
    browser.authenticated = false;
    return finish(
      401,
      s && s.absolute <= state.now ? "SESSION_EXPIRED" : "SESSION_REQUIRED",
      "세션이 없거나 만료되었습니다." +
        (browser.remember
          ? " 로그인 복원을 실행할 수 있습니다."
          : " 비밀번호로 다시 로그인하세요."),
    );
  }
  if (
    !g ||
    s.state !== "ACTIVE" ||
    g.revoked ||
    s.version !== state.version ||
    g.version !== state.version
  ) {
    browser.authenticated = false;
    return finish(
      401,
      "AUTH_REVOKED",
      "DB의 발급 상태·기기 폐기·사용자 버전 검사에서 차단했습니다.",
    );
  }
  frame(
    "database",
    "ACTIVE · 폐기 · 버전 확인",
    "보호 요청마다 주 DB를 조회합니다. 즉시 폐기를 위해 DB 비용과 장애 의존성을 감수한 설계입니다.",
    "AuthService.guard",
  );
  s.idleUntil = Math.min(state.now + p.idle, s.absolute);
  frame(
    "redis",
    "유휴 TTL 갱신 · 절대 종료 고정",
    "활동은 유휴 시간만 갱신합니다. 절대 종료와 유지 종료 시각은 연장하지 않습니다.",
    "SessionStore.ttl",
  );
  if (action.kind === "reauth") {
    if (action.password !== fixturePassword)
      return finish(
        401,
        "REAUTHENTICATION_FAILED",
        "비밀번호를 확인해 주세요.",
      );
    const next = fresh(g, "PASSWORD");
    next.absolute = s.absolute;
    next.idleUntil = Math.min(state.now + p.idle, next.absolute);
    next.redis = true;
    next.state = "ACTIVE";
    s.state = "REVOKED";
    s.redis = false;
    browser.sid = next.id;
    frame(
      "database",
      "비밀번호 재확인과 새 SID 활성화",
      "기존 세션을 교체하며 절대 종료 시각은 유지합니다. 민감한 기기 관리가 5분 동안 허용됩니다.",
      "AuthOperations.reauthenticate",
    );
    return finish(
      204,
      "REAUTHENTICATED",
      "최근 비밀번호 확인 완료 · 세션 식별자 교체.",
    );
  }
  if (
    action.kind === "logout" ||
    action.kind === "logoutAll" ||
    action.kind === "deferred"
  ) {
    const all = action.kind === "logoutAll";
    if (all && (s.passwordAt === null || s.passwordAt + p.recent < state.now)) {
      frame(
        "server",
        "최근 비밀번호 확인 필요",
        "유지 토큰으로 복원한 세션은 전체 기기 폐기 전 비밀번호 재확인이 필요합니다.",
        "AuthOperations.recent",
      );
      return finish(
        403,
        "REAUTH_REQUIRED",
        "비밀번호 재확인을 먼저 실행하세요.",
      );
    }
    if (all) state.version++;
    const ids = state.grants
      .filter((item) => all || item.id === g.id)
      .map((item) => {
        item.revoked = true;
        return item.id;
      });
    const targets = state.sessions.filter((item) => ids.includes(item.grant));
    for (const item of targets) {
      item.state = "REVOKED";
      state.cleanup.push(item.id);
    }
    frame(
      "database",
      all ? "전체 기기 폐기와 auth_version 증가" : "현재 기기 인증 폐기 커밋",
      "폐기 기록과 Redis 정리 작업을 같은 DB 트랜잭션에 저장합니다.",
      "AuthOperations.revoke",
    );
    if (action.kind === "deferred") {
      state.redisUp = false;
      browser.sid = null;
      browser.remember = null;
      browser.authenticated = false;
      frame(
        "redis",
        "폐기 커밋 뒤 Redis 정리 실패",
        "DB 폐기는 완료됐습니다. 정리 작업을 보존하고 복구 후 다시 시도합니다.",
        "CleanupService.clean",
      );
      return finish(
        204,
        "LOGGED_OUT_CLEANUP_PENDING",
        "로그아웃 완료 · Redis 키 정리는 복구 후 재시도합니다.",
      );
    }
    for (const item of targets) item.redis = false;
    state.cleanup = state.cleanup.filter(
      (id) => !targets.some((item) => item.id === id),
    );
    frame(
      "redis",
      "폐기된 공유 세션 삭제",
      "Redis 삭제가 지연되어도 DB의 폐기 상태가 옛 쿠키 접근을 막습니다.",
      "CleanupService.clean",
    );
    browser.sid = null;
    browser.remember = null;
    browser.authenticated = false;
    return finish(
      204,
      "LOGGED_OUT",
      all
        ? "전체 기기 로그인 권한을 폐기했습니다. 다른 기기의 다음 요청도 거부됩니다."
        : "현재 기기의 세션과 로그인 유지 권한을 폐기했습니다.",
    );
  }
  browser.authenticated = true;
  request = "GET /api/auth/me";
  return finish(
    200,
    "SESSION_VALID",
    "공유 세션과 DB 검증 통과 · 사용자 demo@lab.test",
  );
}

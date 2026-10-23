import {
  policy,
  sessionOf,
  redisTTL,
  type LoginState,
  type Device,
  type Frame as LoginFrame,
} from "./login-demo.ts";
import {
  ownFlow,
  verified,
  type SignupState,
  type Frame as SignupFrame,
} from "./signup-demo.ts";
import type { Point3 } from "./scene-view";
export type Tone = "blue" | "mint" | "amber" | "red" | "muted";
export type AuthNode = {
  id: string;
  label: string;
  detail: string;
  position: Point3;
  shape: "browser" | "server" | "redis" | "database" | "mail" | "identity";
  tone: Tone;
  count: number;
  items: Tone[];
  fraction?: number;
  gate?: boolean;
};
export type AuthSceneState = {
  project: "login" | "signup";
  nodes: AuthNode[];
  edges: [string, string][];
  node: string;
  source: string;
  route: [string, string] | null;
  key: string;
  summary: string[];
};
const positive = (n: number) => Math.max(0, n);
const tones = (n: number, tone: Tone) =>
  Array.from({ length: Math.min(6, n) }, () => tone);
export function loginSceneState(
  s: LoginState,
  device: Device,
  server: string,
  frames: LoginFrame[],
  step: number,
): AuthSceneState {
  const current = frames[step],
    b = s.browsers[device],
    session =
      [...s.sessions]
        .reverse()
        .find((item) =>
          s.grants.some((g) => g.id === item.grant && g.device === device),
        ) || sessionOf(s, device),
    ttl = session ? redisTTL(s, session) : 0;
  const alive = s.sessions.filter(
    (item) => item.redis && redisTTL(s, item) > 0,
  ).length;
  const generation = b.remember?.generation;
  const nodes: AuthNode[] = [
    {
      id: "browser",
      label: `기기 ${device ? "B" : "A"}`,
      detail: `SID ${b.sid ? "있음" : "없음"} · 유지 ${generation === undefined ? "없음" : "g" + generation}`,
      position: [-2.6, 0, 1.5],
      shape: "browser",
      tone: b.authenticated ? "mint" : "blue",
      count: Number(!!b.sid) + Number(!!b.remember),
      items: tones(Number(!!b.sid) + Number(!!b.remember), "blue"),
    },
    {
      id: "server",
      label: `서버 ${server} / A·B 공유`,
      detail: "Spring Security · 발급 상태 확인",
      position: [2.6, 0, 1.5],
      shape: "server",
      tone: "blue",
      count: 2,
      items: [],
    },
    {
      id: "redis",
      label: "공유 Redis",
      detail: s.redisUp
        ? `만료 전 키 ${alive}개 · 최근 발급 TTL ${ttl}초`
        : "연결 불가 · 저장 상태 보존",
      position: [-2.6, 0, -2.6],
      shape: "redis",
      tone: !s.redisUp ? "red" : ttl > 0 ? "mint" : "muted",
      count: alive,
      items: tones(alive, "mint"),
      fraction: Math.min(1, ttl / policy.idle),
    },
    {
      id: "database",
      label: "PostgreSQL",
      detail: s.dbUp
        ? `발급 ${s.sessions.length}개 · 사용자 버전 ${s.version}`
        : "연결 불가 · 발급 상태 미확인",
      position: [2.6, 0, -2.6],
      shape: "database",
      tone: !s.dbUp ? "red" : "mint",
      count: s.sessions.length,
      items: s.sessions
        .slice(-6)
        .map((item) =>
          item.state === "ACTIVE"
            ? "mint"
            : item.state === "REVOKED"
              ? "red"
              : "amber",
        ),
    },
  ];
  const node = current?.node || "browser",
    first = step === 0 && current?.source === "TraceFilter.request";
  return {
    project: "login",
    nodes,
    edges: [
      ["browser", "server"],
      ["server", "redis"],
      ["server", "database"],
    ],
    node,
    source: current?.source || "ready",
    route: !current
      ? null
      : node === "browser"
        ? first
          ? ["browser", "server"]
          : ["server", "browser"]
        : node === "server"
          ? ["browser", "server"]
          : ["server", node],
    key: current ? `${step}:${current.source}:${current.title}` : "ready",
    summary: [
      `최근 발급 ${session?.state || "없음"} · Redis TTL ${ttl}초`,
      `유지 토큰 ${generation === undefined ? "없음" : "세대 " + generation} · 폐기된 발급 ${s.sessions.filter((item) => item.state === "REVOKED").length}개`,
    ],
  };
}
export function signupSceneState(
  s: SignupState,
  frames: SignupFrame[],
  step: number,
): AuthSceneState {
  const current = frames[step],
    f = ownFlow(s),
    proof = verified(s),
    pending = s.mail.filter(
      (m) => m.state === "PENDING" || m.state === "DELIVERY_UNKNOWN",
    ).length,
    received = s.mail.reduce((n, m) => n + m.received, 0),
    provider = f.provider || f.link?.proof,
    external = provider && provider.expires > s.now;
  const nodes: AuthNode[] = [
    {
      id: "Browser",
      label: `가입 컨텍스트 ${s.active ? "B" : "A"}`,
      detail: proof
        ? `이메일 확인 · ${positive(f.verifiedUntil! - s.now)}초`
        : "이메일 소유 증명 없음",
      position: [-3.8, 0, 1.5],
      shape: "browser",
      tone: proof ? "mint" : "blue",
      count: Number(proof),
      items: tones(Number(proof), "mint"),
      fraction: proof ? positive(f.verifiedUntil! - s.now) / 600 : 0,
    },
    {
      id: "Server",
      label: "가입 서버 A·B",
      detail:
        f.state === "COMPLETED"
          ? "가입 확정 · 자동 로그인 없음"
          : "이메일 확인 → 계정 확정",
      position: [0, 0, 1.5],
      shape: "server",
      tone: f.state === "COMPLETED" ? "mint" : "blue",
      count: 2,
      items: [],
    },
    {
      id: "DB",
      label: "PostgreSQL · 가입 게이트",
      detail: s.dbUp
        ? `계정 ${s.accounts.length}개 · 대기 메일 ${pending}개`
        : "연결 불가 · 성공 추정 금지",
      position: [3.8, 0, 1.5],
      shape: "database",
      tone: !s.dbUp ? "red" : f.state === "COMPLETED" ? "mint" : "blue",
      count: s.accounts.length,
      items: s.accounts
        .slice(-6)
        .map((a) => (a.method === "OIDC" ? "amber" : "mint")),
      gate: true,
    },
    {
      id: "Redis",
      label: "Redis · 공유 제한",
      detail: s.redisUp
        ? `제한 버킷 ${s.limits.length}개`
        : "연결 불가 · 신규 접수 차단",
      position: [-3.8, 0, -2.8],
      shape: "redis",
      tone: s.redisUp ? "blue" : "red",
      count: s.limits.length,
      items: tones(s.limits.length, "blue"),
    },
    {
      id: "SMTP",
      label: "인증 메일 / SMTP",
      detail: s.smtpUp
        ? `접수 ${received}회 · 미확정 ${pending}개`
        : "접수 확인 불가 · outbox 유지",
      position: [0, 0, -2.8],
      shape: "mail",
      tone: !s.smtpUp ? "red" : pending ? "amber" : "mint",
      count: received,
      items: tones(pending || received, pending ? "amber" : "mint"),
    },
    {
      id: "IdP",
      label: "SSO · 외부 신원",
      detail: `외부 증명 ${external ? "있음" : "없음/만료"} · 연결 ${s.identities.length}건`,
      position: [3.8, 0, -2.8],
      shape: "identity",
      tone: s.identities.length ? "mint" : external ? "amber" : "muted",
      count: s.identities.length,
      items: tones(s.identities.length, "mint"),
      fraction: external ? positive(provider!.expires - s.now) / 300 : 0,
    },
  ];
  const node = current?.node || "Browser",
    first = step === 0 && current?.source === "RequestFilter.request";
  return {
    project: "signup",
    nodes,
    edges: [
      ["Browser", "Server"],
      ["Server", "Redis"],
      ["Server", "DB"],
      ["Server", "SMTP"],
      ["Browser", "IdP"],
      ["IdP", "Server"],
    ],
    node,
    source: current?.source || "ready",
    route: !current
      ? null
      : node === "Browser"
        ? first
          ? ["Browser", "Server"]
          : ["Server", "Browser"]
        : node === "IdP"
          ? ["Browser", "IdP"]
          : node === "Server"
            ? ["Browser", "Server"]
            : ["Server", node],
    key: current ? `${step}:${current.source}:${current.title}` : "ready",
    summary: [
      `이메일 증명 ${proof ? "확인됨" : "미확인"} · 가입 ${f.state === "COMPLETED" ? "확정" : "미확정"}`,
      `메일 접수 ${received}회 ≠ 인증 완료 · SSO 연결 ${s.identities.length}건`,
    ],
  };
}
export function authNodeStep(
  frames: { node: string }[],
  node: string,
  current: number,
) {
  const candidates = frames
    .map((f, i) => (f.node === node ? i : -1))
    .filter((i) => i >= 0);
  return candidates.filter((i) => i <= current).at(-1) ?? candidates[0] ?? -1;
}

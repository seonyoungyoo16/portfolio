import assert from "node:assert/strict";
import {
  emptyLogin,
  executeLogin,
  fixturePassword,
  policy,
  sessionOf,
  redisTTL,
  type Action,
  type LoginState,
} from "../src/login-demo.ts";
import model from "../src/generated/login-source.json" with { type: "json" };
let checks = 0;
const check = (name: string, test: () => void) => {
  test();
  checks++;
  console.log("PASS " + name);
};
let state = emptyLogin();
const run = (action: Action) => {
  const result = executeLogin(state, action);
  state = result.state;
  for (const f of result.frames) assert.ok(model.sources[f.source]);
  return result;
};
const login = (remember = true, device: 0 | 1 = 0) =>
  run({ kind: "login", password: fixturePassword, remember, device });
check("incorrect password does not create grants or sessions", () => {
  assert.equal(run({ kind: "login", password: "wrong" }).status, 401);
  assert.equal(state.sessions.length, 0);
  assert.equal(state.grants.length, 0);
});
check("login: PREPARING → Redis → ACTIVE → browser cookie", () => {
  const r = login();
  assert.equal(r.status, 200);
  const prepared = r.frames.find((f) => f.source === "AuthService.prepare")!,
    saved = r.frames.find((f) => f.source === "SessionStore.ttl")!,
    active = r.frames.find((f) => f.source === "AuthService.activate")!;
  assert.equal(prepared.state.sessions[0].state, "PREPARING");
  assert.equal(prepared.state.sessions[0].redis, false);
  assert.equal(saved.state.sessions[0].redis, true);
  assert.equal(saved.state.browsers[0].sid, null);
  assert.equal(active.state.sessions[0].state, "ACTIVE");
  assert.ok(state.browsers[0].sid);
});
check("protected request shares session and keeps absolute end fixed", () => {
  const s = sessionOf(state, 0)!,
    end = s.absolute;
  run({ kind: "advance", seconds: 60 });
  assert.equal(run({ kind: "me" }).status, 200);
  assert.equal(sessionOf(state, 0)!.absolute, end);
  assert.equal(redisTTL(state, sessionOf(state, 0)!), policy.idle);
});
check(
  "observer clock does not refresh TTL; idle expiration denies request",
  () => {
    const old = state.sessions[0].idleUntil;
    run({ kind: "advance", seconds: policy.idle });
    assert.equal(state.sessions[0].idleUntil, old);
    assert.equal(run({ kind: "me" }).status, 401);
  },
);
check("restore rotates credentials and preserves remember deadline", () => {
  const end = state.grants[0].end;
  assert.equal(run({ kind: "restore" }).status, 200);
  assert.equal(state.grants[0].generation, 1);
  assert.equal(state.grants[0].end, end);
  assert.equal(sessionOf(state, 0)!.method, "REMEMBER");
});
check(
  "restored session requires password confirmation before all-device revoke",
  () => {
    assert.equal(run({ kind: "logoutAll" }).status, 403);
    const absolute = sessionOf(state, 0)!.absolute;
    assert.equal(
      run({ kind: "reauth", password: fixturePassword }).status,
      204,
    );
    assert.equal(sessionOf(state, 0)!.absolute, absolute);
    assert.equal(run({ kind: "logoutAll" }).status, 204);
  },
);
check("ordinary login has no remembered credential on revisit", () => {
  state = emptyLogin();
  login(false);
  run({ kind: "close" });
  assert.equal(run({ kind: "restore" }).status, 401);
});
check(
  "concurrent restore creates one new session; late request leaves success cookie",
  () => {
    state = emptyLogin();
    login();
    run({ kind: "close" });
    const r = run({ kind: "concurrent" });
    assert.equal(r.code, "CONCURRENT_200_409");
    assert.equal(state.sessions.length, 2);
    assert.equal(state.grants[0].generation, 1);
    const sid = state.browsers[0].sid;
    assert.equal(run({ kind: "replay" }).status, 409);
    assert.equal(state.browsers[0].sid, sid);
  },
);
check("stale token after grace is 401 without revoking current grant", () => {
  run({ kind: "advance", seconds: policy.grace });
  assert.equal(run({ kind: "replay" }).status, 401);
  assert.equal(state.grants[0].revoked, false);
  assert.equal(run({ kind: "me" }).status, 200);
});
check("fixed remember expiration prevents indefinite restore", () => {
  state = emptyLogin();
  login();
  run({ kind: "close" });
  run({ kind: "advance", seconds: policy.remember });
  assert.equal(run({ kind: "restore" }).code, "REMEMBER_EXPIRED");
});
check("absolute expiry cannot be extended by activity", () => {
  state = emptyLogin();
  login(false);
  const end = sessionOf(state, 0)!.absolute;
  for (let t = 0; t < policy.absolute; t += 60) {
    run({ kind: "advance", seconds: 60 });
    const r = run({ kind: "me" });
    assert.equal(r.status, state.now < end ? 200 : 401);
  }
  assert.equal(sessionOf(state, 0)!.absolute, end);
});
check("all-device revoke invalidates another independent browser", () => {
  state = emptyLogin();
  login(true, 0);
  login(true, 1);
  assert.equal(run({ kind: "logoutAll", device: 0 }).status, 204);
  assert.equal(run({ kind: "me", device: 1 }).status, 401);
  assert.equal(run({ kind: "restore", device: 1 }).code, "AUTH_REVOKED");
});
check("logout after idle expiration revokes remember credential", () => {
  state = emptyLogin();
  login();
  const old = structuredClone(state.browsers[0].remember);
  run({ kind: "advance", seconds: policy.idle });
  assert.equal(run({ kind: "logout" }).status, 204);
  state.browsers[0].remember = old;
  assert.equal(run({ kind: "restore" }).code, "AUTH_REVOKED");
});
check("Redis and DB outage fail closed without deleting store state", () => {
  for (const kind of ["redis", "db"] as const) {
    state = emptyLogin();
    login();
    const sid = state.browsers[0].sid;
    run({ kind, available: false });
    assert.equal(run({ kind: "me" }).status, 503);
    assert.equal(state.browsers[0].sid, sid);
    run({ kind, available: true });
    assert.equal(run({ kind: "me" }).status, 200);
  }
});
check(
  "activation failure leaves PREPARING and no browser success; forged SID denied",
  () => {
    state = emptyLogin();
    assert.equal(
      run({ kind: "partial", password: fixturePassword, remember: true })
        .status,
      503,
    );
    assert.equal(state.browsers[0].sid, null);
    assert.equal(state.sessions[0].state, "PREPARING");
    assert.equal(state.sessions[0].redis, true);
    state.browsers[0].sid = state.sessions[0].id;
    assert.equal(run({ kind: "me" }).code, "AUTH_REVOKED");
  },
);
check("lost restore response cannot reuse old credential after grace", () => {
  state = emptyLogin();
  login();
  run({ kind: "close" });
  assert.equal(run({ kind: "lost" }).status, 0);
  assert.equal(state.browsers[0].sid, null);
  assert.equal(state.browsers[0].remember!.generation, 0);
  run({ kind: "advance", seconds: policy.grace });
  assert.equal(run({ kind: "restore" }).code, "REMEMBER_STALE");
  assert.equal(run({ kind: "logout" }).status, 204);
  assert.equal(state.grants[0].revoked, true);
});
check(
  "revoke commit survives failed cleanup and stale Redis resurrection",
  () => {
    state = emptyLogin();
    login();
    assert.equal(run({ kind: "deferred" }).status, 204);
    assert.equal(state.cleanup.length, 1);
    assert.equal(state.grants[0].revoked, true);
    assert.equal(state.sessions[0].redis, true);
    run({ kind: "redis", available: true });
    run({ kind: "stale" });
    assert.equal(run({ kind: "me" }).code, "AUTH_REVOKED");
    run({ kind: "cleanup" });
    assert.equal(state.cleanup.length, 0);
    assert.equal(state.sessions[0].redis, false);
  },
);
check("input state remains immutable and snapshots preserve step state", () => {
  const before: LoginState = emptyLogin(),
    text = JSON.stringify(before);
  const result = executeLogin(before, {
    kind: "login",
    password: fixturePassword,
  });
  assert.equal(JSON.stringify(before), text);
  assert.equal(result.frames[0].state.sessions.length, 0);
  assert.equal(result.state.sessions.length, 1);
});
console.log(`${checks} login model scenarios passed`);

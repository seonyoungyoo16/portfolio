import assert from "node:assert/strict";
import fs from "node:fs";
import {
  emptyLogin,
  executeLogin,
  fixturePassword,
  policy,
} from "../src/login-demo.ts";
import { emptySignup, executeSignup, ownFlow } from "../src/signup-demo.ts";
import {
  loginSceneState,
  signupSceneState,
  authNodeStep,
} from "../src/auth-scene.ts";
import { scenePose, sceneViews } from "../src/scene-view.ts";
const checks: string[] = [];
const check = (name: string, fn: () => void) => {
  fn();
  checks.push(name);
  console.log("PASS " + name);
};
const node = (scene: ReturnType<typeof loginSceneState>, id: string) =>
  scene.nodes.find((n) => n.id === id)!;
check(
  "login scene separates PREPARING Redis ACTIVE and browser-cookie snapshots",
  () => {
    const result = executeLogin(emptyLogin(), {
      kind: "login",
      password: fixturePassword,
      remember: true,
    });
    const preparing = result.frames.findIndex((f) =>
      f.state.sessions.some((s) => s.state === "PREPARING" && !s.redis),
    );
    assert.deepEqual(loginSceneState(result.frames[0].state, 0, "A", result.frames, 0).route, ["browser", "server"]);
    assert(preparing >= 0);
    const a = loginSceneState(
      result.frames[preparing].state,
      0,
      "A",
      result.frames,
      preparing,
    );
    assert.equal(node(a, "database").count, 1);
    assert.equal(node(a, "browser").count, 0);
    assert.deepEqual(node(a, "database").items, ["amber"]);
    const storing = result.frames.findIndex(
        (f) => f.source === "SessionStore.ttl",
      ),
      b = loginSceneState(
        result.frames[storing].state,
        0,
        "A",
        result.frames,
        storing,
      );
    assert.equal(node(b, "redis").count, 1);
    assert.equal(node(b, "redis").fraction, 1);
    assert.equal(node(b, "browser").count, 0);
    const final = loginSceneState(
      result.state,
      0,
      "A",
      result.frames,
      result.frames.length - 1,
    );
    assert.equal(node(final, "browser").count, 2);
    assert.deepEqual(final.route, ["server", "browser"]);
    assert.equal(node(final, "redis").fraction, 1);
    assert.deepEqual(node(final, "database").items, ["mint"]);
  },
);
check(
  "observing TTL never advances time and expiry removes the available ring only",
  () => {
    let s = executeLogin(emptyLogin(), {
      kind: "login",
      password: fixturePassword,
      remember: true,
    }).state;
    const before = structuredClone(s);
    for (let i = 0; i < 10; i++) loginSceneState(s, 0, "B", [], 0);
    assert.deepEqual(s, before);
    s = executeLogin(s, { kind: "advance", seconds: policy.idle }).state;
    const scene = loginSceneState(s, 0, "B", [], 0);
    assert.equal(node(scene, "redis").fraction, 0);
    assert.equal(node(scene, "redis").count, 0);
    assert.equal(node(scene, "database").count, 1);
    assert(node(scene, "server").label.includes("B"));
  },
);
check(
  "revocation and dependency outage preserve facts with explicit unavailable styling",
  () => {
    let s = executeLogin(emptyLogin(), {
      kind: "login",
      password: fixturePassword,
      remember: true,
    }).state;
    s = executeLogin(s, { kind: "redis", available: false }).state;
    const unavailable = loginSceneState(s, 0, "A", [], 0);
    assert.equal(node(unavailable, "redis").tone, "red");
    assert.equal(node(unavailable, "database").count, 1);
    s = executeLogin(s, { kind: "redis", available: true }).state;
    s = executeLogin(s, { kind: "logout" }).state;
    const loggedOut = loginSceneState(s, 0, "A", [], 0);
    assert.equal(node(loggedOut, "browser").count, 0);
    assert.equal(node(loggedOut, "redis").count, 0);
    assert.deepEqual(node(loggedOut, "database").items, ["red"]);
  },
);
check(
  "mail receipt proof and account creation remain three distinct scene states",
  () => {
    let s = emptySignup();
    const act = (
      a: Parameters<typeof executeSignup>[1],
      i: Parameters<typeof executeSignup>[2] = {},
    ) => {
      const r = executeSignup(s, a, { email: "new@lab.test", ...i });
      s = r.state;
      return r;
    };
    act("request");
    let scene = signupSceneState(s, [], 0);
    assert.equal(node(scene, "SMTP").count, 0);
    assert.equal(node(scene, "Browser").count, 0);
    assert.equal(node(scene, "DB").count, 1);
    assert.equal(node(scene, "SMTP").tone, "amber");
    act("deliver");
    scene = signupSceneState(s, [], 0);
    assert.equal(node(scene, "SMTP").count, 1);
    assert.equal(node(scene, "Browser").count, 0);
    act("open", { mail: s.mail[0].id });
    act("verify", { mail: s.mail[0].id });
    scene = signupSceneState(s, [], 0);
    assert.equal(node(scene, "Browser").count, 1);
    assert.equal(node(scene, "DB").count, 1);
    assert.equal(node(scene, "Browser").fraction, 1);
    act("complete", { terms: true, key: "signup-one" });
    scene = signupSceneState(s, [], 0);
    assert.equal(node(scene, "DB").count, 2);
    assert.equal(node(scene, "DB").gate, true);
    assert.equal(ownFlow(s).login, null);
  },
);
check("SSO proof is amber until explicit identity link commits", () => {
  let s = executeSignup(emptySignup(), "login", {}).state;
  s = executeSignup(s, "link", { user: "match" }).state;
  let scene = signupSceneState(s, [], 0);
  assert.equal(node(scene, "IdP").count, 0);
  assert.equal(node(scene, "IdP").tone, "amber");
  s = executeSignup(s, "confirmLink", {}).state;
  scene = signupSceneState(s, [], 0);
  assert.equal(node(scene, "IdP").count, 1);
  assert.equal(node(scene, "IdP").tone, "mint");
  assert.equal(s.accounts.length, 1);
});
check(
  "SMTP failure retains pending cards and does not manufacture email proof",
  () => {
    let s = executeSignup(emptySignup(), "request", {
      email: "new@lab.test",
    }).state;
    s = executeSignup(s, "smtp", {}).state;
    s = executeSignup(s, "deliver", {}).state;
    const before = structuredClone(s),
      scene = signupSceneState(s, [], 0);
    assert.equal(node(scene, "SMTP").tone, "red");
    assert.equal(node(scene, "Browser").count, 0);
    assert.equal(node(scene, "DB").count, 1);
    assert.deepEqual(s, before);
  },
);
check(
  "node selection uses nearest past stage or first future stage without mutation",
  () => {
    const frames = [
      { node: "Browser" },
      { node: "DB" },
      { node: "SMTP" },
      { node: "DB" },
    ];
    assert.equal(authNodeStep(frames, "DB", 2), 1);
    assert.equal(authNodeStep(frames, "DB", 0), 1);
    assert.equal(authNodeStep(frames, "DB", 3), 3);
    assert.equal(authNodeStep(frames, "IdP", 3), -1);
  },
);
check(
  "five distinct camera poses keep Station focus and Flight packet target separate",
  () => {
    const focus: [number, number, number] = [3, 0, 1],
      packet: [number, number, number] = [-2, 0.5, 0],
      poses = sceneViews.map((v) => scenePose(v, focus, packet));
    assert.equal(new Set(poses.map((p) => p.position.join())).size, 5);
    assert.deepEqual(scenePose("station", focus, packet).target, [3, 0.55, 1]);
    assert.deepEqual(scenePose("flight", focus, packet).target, packet);
    for (const p of poses)
      for (const n of [...p.position, ...p.target, p.zoom])
        assert(Number.isFinite(n));
  },
);
fs.mkdirSync("docs/project-view-verification", { recursive: true });
fs.writeFileSync(
  "docs/project-view-verification/model.json",
  JSON.stringify(
    { status: "passed", verifiedAt: new Date().toISOString(), checks },
    null,
    2,
  ) + "\n",
);
console.log(`${checks.length} auth scene and camera checks passed`);

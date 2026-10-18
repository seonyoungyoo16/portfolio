import assert from "node:assert/strict";
import fs from "node:fs";
import {
  emptySignup,
  executeSignup,
  ownFlow,
  verified,
  type SignupState,
  type Action,
  type Input,
} from "../src/signup-demo.ts";
const sources = JSON.parse(
  fs.readFileSync("src/generated/signup-source.json", "utf8"),
).sources;
let checks = 0,
  s: SignupState;
const act = (action: Action, input: Input = {}) => {
  const r = executeSignup(s, action, input);
  for (const frame of r.frames) assert.ok(sources[frame.source], frame.source);
  s = r.state;
  return r;
};
const verify = (email = "new@lab.test") => {
  act("request", { email });
  act("deliver");
  act("open", { mail: s.mail.at(-1)!.id });
  assert.equal(act("verify").status, 200);
};
function check(name: string, fn: () => void) {
  s = emptySignup();
  fn();
  checks++;
  console.log("PASS " + name);
}
check(
  "202 only queues a challenge; worker reception and explicit verification remain separate",
  () => {
    assert.equal(act("request").status, 202);
    assert.equal(s.mail[0].received, 0);
    assert.equal(s.accounts.length, 1);
    act("deliver");
    act("open", { mail: 1 });
    assert.equal(verified(s), false);
    act("verify");
    assert.equal(verified(s), true);
    assert.equal(s.accounts.length, 1);
  },
);
check("copied link cannot consume another context proof", () => {
  act("request");
  act("deliver");
  act("switch", { browser: 1 });
  act("open", { mail: 1 });
  assert.equal(act("verify").status, 403);
  assert.equal(s.mail[0].consumed, false);
  act("switch", { browser: 0 });
  act("open", { mail: 1 });
  assert.equal(act("verify").status, 200);
});
check(
  "cooldown, latest generation, one consumption and fixed proof expiry",
  () => {
    act("request");
    act("deliver");
    assert.equal(act("request").status, 429);
    act("wait", { seconds: 60 });
    act("request");
    act("deliver");
    act("open", { mail: 1 });
    assert.equal(act("verify").status, 410);
    act("open", { mail: 2 });
    act("verify");
    const until = ownFlow(s).verifiedUntil;
    act("wait", { seconds: 1 });
    assert.equal(act("verify").status, 200);
    assert.equal(ownFlow(s).verifiedUntil, until);
  },
);
check("address change invalidates old proof", () => {
  verify();
  act("change", { email: "other@lab.test" });
  assert.equal(verified(s), false);
  assert.equal(act("complete", { terms: true }).status, 403);
});
check("expired link and proof refuse persistence", () => {
  verify();
  act("wait", { seconds: 601 });
  assert.equal(act("verify").status, 410);
  assert.equal(act("complete", { terms: true }).status, 403);
  assert.equal(s.accounts.length, 1);
});
check(
  "single atomic account, replay and changed input conflict without login",
  () => {
    verify();
    assert.equal(act("complete", { terms: true, key: "one" }).status, 201);
    assert.equal(s.accounts.length, 2);
    assert.equal(ownFlow(s).login, null);
    assert.equal(act("complete", { terms: true, key: "one" }).status, 200);
    assert.equal(
      act("complete", { terms: true, key: "one", name: "changed" }).status,
      409,
    );
    assert.equal(s.accounts.length, 2);
  },
);
check("independent verified flows hit the shared unique constraint", () => {
  verify();
  act("switch", { browser: 1 });
  verify();
  act("complete", { terms: true });
  act("switch", { browser: 0 });
  assert.equal(act("complete", { terms: true }).status, 409);
  assert.equal(s.accounts.length, 2);
  assert.equal(ownFlow(s).login, null);
});
check("committed result survives an HTTP response loss", () => {
  verify();
  assert.equal(act("complete", { terms: true, drop: true }).status, 0);
  assert.equal(s.accounts.length, 2);
  assert.equal(act("recover").status, 200);
  assert.equal(act("complete", { terms: true }).status, 200);
  assert.equal(s.accounts.length, 2);
});
check(
  "SMTP accepted response loss allows duplicate mail, single proof/account",
  () => {
    act("request");
    act("smtpLoss");
    act("deliver");
    assert.equal(s.mail[0].state, "DELIVERY_UNKNOWN");
    act("deliver");
    assert.equal(s.mail[0].received, 2);
    assert.equal(s.mail.length, 1);
    act("open", { mail: 1 });
    act("verify");
    act("verify");
    act("complete", { terms: true });
    assert.equal(s.accounts.length, 2);
  },
);
check("SMTP outage keeps durable pending work and recovery delivers", () => {
  act("smtp");
  act("request");
  act("deliver");
  assert.equal(s.mail[0].received, 0);
  assert.equal(s.mail[0].state, "DELIVERY_UNKNOWN");
  act("smtp");
  act("deliver");
  assert.equal(s.mail[0].received, 1);
});
check("Redis and DB outages do not create phantom success", () => {
  act("redis");
  assert.equal(act("request").status, 503);
  act("redis");
  verify();
  act("db");
  assert.equal(act("complete", { terms: true }).status, 503);
  assert.equal(s.accounts.length, 1);
  act("db");
  assert.equal(act("complete", { terms: true }).status, 201);
});
check(
  "OIDC requires own email by default and keeps LOCAL credential separate",
  () => {
    act("oidc");
    assert.equal(verified(s), false);
    verify("alice@lab.test");
    assert.equal(act("complete", { terms: true }).status, 201);
    assert.equal(s.accounts[1].method, "OIDC");
    assert.equal(s.identities.length, 1);
  },
);
check(
  "explicit trust skips only main email verification; team still requires it",
  () => {
    act("trust");
    act("oidc", { provider: "team" });
    assert.equal(verified(s), false);
    act("oidc", { provider: "main" });
    assert.equal(verified(s), true);
  },
);
check(
  "same email never silently connects a provider to existing account",
  () => {
    act("oidc", { user: "match" });
    verify("existing@lab.test");
    assert.equal(act("complete", { terms: true }).status, 409);
    assert.equal(s.identities.length, 0);
    assert.equal(ownFlow(s).login, null);
  },
);
check("existing login and external proof require final explicit link", () => {
  act("login");
  act("link", { user: "match" });
  assert.equal(s.identities.length, 0);
  assert.equal(act("confirmLink").status, 200);
  assert.equal(s.identities[0].account, 1);
  assert.equal(s.accounts.length, 1);
});
check("logout or stale recent authentication refuses final link", () => {
  act("login");
  act("link");
  act("logout");
  assert.equal(act("confirmLink").status, 403);
  act("login");
  act("link");
  act("wait", { seconds: 301 });
  assert.equal(act("confirmLink").status, 403);
  assert.equal(s.identities.length, 0);
});
check(
  "provider already connected elsewhere conflicts, no account reassignment",
  () => {
    act("trust");
    act("oidc");
    act("complete", { terms: true });
    act("login");
    act("link");
    assert.equal(act("confirmLink").status, 409);
    assert.equal(s.identities[0].account, 2);
  },
);
check("issuer isolates the same subject; OIDC proof itself expires", () => {
  act("login");
  act("link", { provider: "main" });
  act("confirmLink");
  act("link", { provider: "team" });
  act("confirmLink");
  assert.equal(s.identities.length, 2);
  assert.equal(s.identities[0].subject, s.identities[1].subject);
  assert.notEqual(s.identities[0].issuer, s.identities[1].issuer);
  s = emptySignup();
  act("trust");
  act("oidc");
  act("wait", { seconds: 301 });
  assert.equal(act("complete", { terms: true }).code, "OIDC_PROOF_EXPIRED");
});
fs.mkdirSync("docs/signup-verification", { recursive: true });
fs.writeFileSync(
  "docs/signup-verification/model.json",
  JSON.stringify(
    {
      status: "passed",
      checks,
      completedAt: new Date().toISOString(),
      scope:
        "static portfolio model invariants, separate from actual backend 50 cases",
    },
    null,
    2,
  ) + "\n",
);
console.log(checks + " portfolio model checks passed");

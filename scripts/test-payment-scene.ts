import assert from "node:assert/strict";
import {
  emptyPayment,
  executePayment,
  type Action,
  type Input,
} from "../src/payment-demo.ts";
import {
  paymentRoute,
  paymentNodeStep,
  paymentRing,
} from "../src/payment-scene.ts";
import fs from "node:fs";
const sources = JSON.parse(
  fs.readFileSync("src/generated/payment-source.json", "utf8"),
).sources;
let state = emptyPayment();
const checks: string[] = [];
const act = (action: Action, input: Input = {}) => {
  const r = executePayment(state, action, input);
  state = r.state;
  return r;
};
const auth = () => {
  state = emptyPayment();
  act("order");
  act("authenticate");
};
const paid = () => {
  auth();
  return act("confirm");
};
const check = (name: string, fn: () => void) => {
  fn();
  checks.push(name);
  console.log("PASS " + name);
};
check(
  "24 represented requests create one canonical operation and one PG transaction",
  () => {
    auth();
    const before = structuredClone(state),
      r = act("confirm", { requests: 24 });
    assert.equal(before.captured, 0);
    assert.equal(state.captured, 10000);
    assert.equal(state.ops.length, 1);
    assert.equal(state.pgCalls, 1);
    assert.equal(state.transactions.length, 1);
    const gate = r.frames.find((f) => f.visual?.kind === "dedupe")!;
    assert.equal(gate.visual?.packets, 24);
    assert.equal(gate.visual?.forwarded, 1);
    assert.deepEqual(paymentRoute(gate), ["Browser", "Server"]);
  },
);
check("canonical replay represents 24 joins without another PG call", () => {
  const r = act("confirm", { requests: 24, key: "new-key" });
  assert.equal(state.pgCalls, 1);
  assert.equal(state.ledger.length, 1);
  assert.equal(
    r.frames.find((f) => f.visual?.kind === "dedupe")?.visual?.forwarded,
    0,
  );
});
check(
  "PG and merchant rows appear at separate commit frames and source anchors",
  () => {
    const r = paid(),
      pg = paymentNodeStep(
        r.frames,
        "PG DB",
        r.frames.length - 1,
        state.transactions[0].id,
      ),
      local = paymentNodeStep(
        r.frames,
        "DB",
        r.frames.length - 1,
        state.ledger[0].id,
      );
    assert(pg < local);
    assert.equal(r.frames[pg].snapshot.ledger.length, 0);
    assert.equal(r.frames[pg].source, "Psp.commitOperation");
    assert.equal(r.frames[local].source, "PaymentProcessor.apply");
    assert.equal(r.frames[local].snapshot.ledger.length, 1);
  },
);
check(
  "reservation frame retains pending R before PG and local cancel commits",
  () => {
    const r = act("cancel", { amount: 3000 }),
      frame = r.frames.find((f) => f.visual?.kind === "reserve")!;
    assert.equal(frame.source, "PaymentService.reserveCancel");
    assert.equal(frame.snapshot.canceled, 0);
    assert.equal(frame.snapshot.reserved, 3000);
    assert.equal(frame.snapshot.pgCanceled, 0);
    const ring = paymentRing(frame.snapshot);
    assert.equal(ring.available, 7000);
    assert.equal(ring.segments.find((s) => s.kind === "reserved")?.share, 0.3);
    assert.equal(state.canceled, 3000);
    assert.equal(state.reserved, 0);
  },
);
check(
  "lost PG response shows committed remote cancellation and unresolved local reservation",
  () => {
    paid();
    state.fault = "pg-response";
    const r = act("cancel", { amount: 3000 }),
      lost = r.frames.find((f) => f.visual?.lost)!;
    assert.equal(lost.visual?.from, "PG");
    assert.equal(lost.visual?.to, "Server");
    assert.equal(lost.snapshot.pgCanceled, 3000);
    assert.equal(lost.snapshot.canceled, 0);
    assert.equal(lost.snapshot.reserved, 3000);
    assert.deepEqual(paymentRoute(lost), ["PG", "Server"]);
  },
);
check(
  "recovery query traverses the PG node and clears reservation only after apply",
  () => {
    state.fault = "none";
    const r = act("recover"),
      q = r.frames.find((f) => f.source === "Psp.query")!;
    assert.deepEqual(paymentRoute(q), ["Server", "PG", "PG DB"]);
    assert.equal(q.snapshot.reserved, 3000);
    assert.equal(state.reserved, 0);
    assert.equal(state.canceled, 3000);
    assert.equal(state.pgCalls, 2);
  },
);
check(
  "external facts plus unresolved R use an outer ring without erasing real amounts",
  () => {
    paid();
    state.fault = "pg-connect";
    act("cancel", { amount: 7000 });
    act("external-cancel", { amount: 5000 });
    state.fault = "none";
    act("recover");
    const ring = paymentRing(state);
    assert.equal(state.sync, "REVIEW");
    assert.equal(ring.canceled, 5000);
    assert.equal(ring.reserved, 7000);
    assert(ring.overbooked);
    assert(ring.segments.find((s) => s.kind === "reserved")?.outer);
    assert.equal(
      ring.segments.filter((s) => !s.outer).reduce((n, s) => n + s.share, 0),
      1,
    );
  },
);
check("zero and fully canceled approvals have finite exact ring shares", () => {
  assert.deepEqual(paymentRing(emptyPayment()).segments, []);
  const ring = paymentRing({ captured: 10000, canceled: 10000, reserved: 0 });
  assert.equal(ring.available, 0);
  assert.equal(ring.segments.length, 1);
  assert.equal(ring.segments[0].share, 1);
});
check(
  "all scenario frames resolve to frozen source anchors and preserve input snapshots",
  () => {
    for (const fault of [
      "none",
      "redis",
      "pg-connect",
      "pg-response",
      "db-apply",
    ] as const) {
      auth();
      state.fault = fault;
      const before = structuredClone(state),
        r = executePayment(state, "confirm", { requests: 24 });
      assert.deepEqual(state, before);
      for (const f of r.frames) {
        assert(sources[f.source], f.source);
        if (f.visual) assert(paymentRoute(f).length >= 2);
      }
    }
  },
);
console.log(`${checks.length} payment scene checks passed`);

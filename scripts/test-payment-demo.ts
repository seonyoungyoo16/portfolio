import assert from "node:assert/strict";
import {
  emptyPayment,
  executePayment,
  type State,
  type Action,
  type Input,
} from "../src/payment-demo.ts";
const checks: string[] = [];
let state = emptyPayment();
const act = (a: Action, b: Input = {}) => {
  const r = executePayment(state, a, b);
  state = r.state;
  return r;
};
const reset = () => (state = emptyPayment());
const auth = () => {
  reset();
  act("order");
  act("authenticate");
};
const paid = () => {
  auth();
  act("confirm");
};
const check = (title: string, fn: () => void) => {
  fn();
  checks.push(title);
  console.log("PASS " + title);
};
check("same checkout intent returns existing order", () => {
  reset();
  act("order");
  assert.equal(act("order").code, "EXISTING_CHECKOUT_ORDER");
  assert.equal(state.ops.length, 0);
});
check("authentication does not capture money", () => {
  auth();
  assert(state.authorized);
  assert.equal(state.pgCaptured, 0);
});
check("one confirmation atomically records one capture", () => {
  paid();
  assert.equal(state.captured, 10000);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.outbox, 1);
  assert(state.accepted);
});
check("different approval keys share canonical operation", () => {
  const before = state.pgCalls;
  act("confirm", { key: "new-key" });
  assert.equal(state.ops.length, 1);
  assert.equal(state.pgCalls, before);
});
check("browser amount mutation rejected before approval", () => {
  auth();
  assert.equal(act("confirm", { amount: 1 }).status, 400);
  assert.equal(state.transactions.length, 0);
});
check("Redis unavailability blocks new durable work", () => {
  auth();
  state.fault = "redis";
  assert.equal(act("confirm").status, 503);
  assert.equal(state.ops.length, 0);
});
check("PG arrival failure is UNKNOWN then recoverable", () => {
  auth();
  state.fault = "pg-connect";
  act("confirm");
  assert.equal(state.pgCalls, 0);
  assert.equal(state.ops[0].state, "UNKNOWN");
  state.fault = "none";
  act("recover");
  assert.equal(state.captured, 10000);
});
check(
  "PG response loss preserves remote fact without local partial commit",
  () => {
    auth();
    state.fault = "pg-response";
    act("confirm");
    assert.equal(state.pgCaptured, 10000);
    assert.equal(state.captured, 0);
    state.fault = "none";
    act("recover");
    assert.equal(state.ledger.length, 1);
    assert.equal(state.pgCalls, 1);
  },
);
check("DB apply failure leaves local ledger and outbox empty", () => {
  auth();
  state.fault = "db-apply";
  act("confirm");
  assert.equal(state.ledger.length, 0);
  assert.equal(state.outbox, 0);
  state.fault = "none";
  act("recover");
  assert.equal(state.outbox, 1);
});
check("successive partial cancellations conserve totals", () => {
  paid();
  act("cancel", { amount: 3000 });
  act("cancel", { amount: 2000 });
  assert.equal(state.canceled, 5000);
  assert.equal(state.reserved, 0);
  assert.equal(state.pgCanceled, 5000);
});
check("full refund preserves original capture and closes order", () => {
  act("cancel", { amount: 5000 });
  assert.equal(state.captured, 10000);
  assert.equal(state.canceled, 10000);
  assert.equal(state.order, "CLOSED");
});
check("same cancel key replay adds no PG effect", () => {
  paid();
  act("cancel", { amount: 3000 });
  const calls = state.pgCalls;
  act("retry-cancel");
  assert.equal(state.pgCalls, calls);
  assert.equal(state.canceled, 3000);
});
check("new key with stale payment version is rejected", () => {
  assert.equal(act("stale-cancel", { amount: 3000 }).status, 409);
  assert.equal(state.transactions.length, 2);
});
check("ambiguous external cancellation keeps reservation and REVIEW", () => {
  paid();
  state.fault = "pg-connect";
  act("cancel", { amount: 7000 });
  assert.equal(state.reserved, 7000);
  assert.equal(act("cancel", { amount: 1000 }).code, "CANCEL_IN_PROGRESS");
  act("external-cancel", { amount: 5000 });
  state.fault = "none";
  act("recover");
  assert.equal(state.canceled, 5000);
  assert.equal(state.reserved, 7000);
  assert.equal(state.sync, "REVIEW");
});
check("late capture after closure generates one compensation", () => {
  auth();
  state.fault = "pg-response";
  act("confirm");
  act("close");
  state.fault = "none";
  act("recover");
  assert.equal(state.order, "CLOSED");
  assert.equal(state.ops.filter((o) => o.kind === "COMPENSATE").length, 1);
  assert.equal(state.captured - state.canceled, 0);
  assert.equal(state.transactions.length, 2);
});
check("webhook deduplication and old projection converge", () => {
  paid();
  act("project");
  act("cancel", { amount: 3000 });
  act("webhook");
  act("webhook");
  act("project");
  assert.equal(state.inbox.length, 1);
  assert.equal(state.ledger.length, 2);
  assert.equal(state.receipt?.canceled, 3000);
});
check("other customer cannot mutate owner order", () => {
  state.user = "B";
  const before = state.transactions.length;
  assert.equal(act("cancel").status, 403);
  assert.equal(state.transactions.length, before);
});
check("expiration and safety limits do not create financial effects", () => {
  paid();
  act("tick", { seconds: 601 });
  assert.equal(state.order, "ACCEPTED");
  assert.equal(state.pgCanceled, 0);
  auth();
  state.fault = "pg-connect";
  act("confirm");
  act("tick", { seconds: 86401 });
  state.fault = "none";
  act("recover");
  assert.equal(state.transactions.length, 0);
  assert.equal(state.order, "CLOSED");
});
console.log(checks.length + " payment model checks passed");

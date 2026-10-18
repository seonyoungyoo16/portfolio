export type Node = "Browser" | "Server" | "Redis" | "DB" | "PG" | "PG DB";
export type Fault =
  "none" | "redis" | "pg-connect" | "pg-response" | "db-apply";
export type Action =
  | "order"
  | "authenticate"
  | "confirm"
  | "cancel"
  | "retry-cancel"
  | "recover"
  | "close"
  | "webhook"
  | "external-cancel"
  | "project"
  | "stale-cancel"
  | "tick";
type Op = {
  id: string;
  kind: "CONFIRM" | "CANCEL" | "COMPENSATE";
  amount: number;
  state: string;
  key: string;
  version: number;
};
type Tx = {
  id: string;
  operation: string | null;
  kind: "CAPTURE" | "CANCEL";
  amount: number;
};
export type State = {
  now: number;
  expires: number;
  user: "A" | "B";
  owner: "A";
  order: string;
  authorized: boolean;
  closing: boolean;
  accepted: boolean;
  amount: number;
  captured: number;
  canceled: number;
  reserved: number;
  version: number;
  sync: string;
  pgCaptured: number;
  pgCanceled: number;
  pgCalls: number;
  transactions: Tx[];
  ledger: Tx[];
  ops: Op[];
  outbox: number;
  receipt: { version: number; canceled: number } | null;
  inbox: string[];
  fault: Fault;
  lastCancel: string | null;
};
export type Frame = {
  node: Node;
  message: string;
  source: string;
  snapshot: State;
  visual?: FlowVisual;
};
export type FlowVisual = {
  kind:
    | "request"
    | "query"
    | "response"
    | "commit"
    | "reserve"
    | "dedupe"
    | "blocked"
    | "state";
  from: Node;
  to: Node;
  packets?: number;
  forwarded?: number;
  operation?: string;
  lost?: boolean;
};
export type Result = {
  state: State;
  frames: Frame[];
  status: number;
  code: string;
};
export type Input = {
  amount?: number;
  key?: string;
  currency?: string;
  expectedVersion?: number;
  seconds?: number;
  dropBrowser?: boolean;
  requests?: number;
};
export const emptyPayment = (): State => ({
  now: 0,
  expires: 600,
  user: "A",
  owner: "A",
  order: "NONE",
  authorized: false,
  closing: false,
  accepted: false,
  amount: 10000,
  captured: 0,
  canceled: 0,
  reserved: 0,
  version: 1,
  sync: "CURRENT",
  pgCaptured: 0,
  pgCanceled: 0,
  pgCalls: 0,
  transactions: [],
  ledger: [],
  ops: [],
  outbox: 0,
  receipt: null,
  inbox: [],
  fault: "none",
  lastCancel: null,
});
export function executePayment(
  before: State,
  action: Action,
  input: Input = {},
): Result {
  const s: State = structuredClone(before),
    frames: Frame[] = [];
  let status = 200,
    code = "OK";
  const frame = (
    node: Node,
    message: string,
    source: string,
    visual?: FlowVisual,
  ) =>
    frames.push({
      node,
      message,
      source,
      snapshot: structuredClone(s),
      visual,
    });
  const result = (n: number, c: string) => {
    status = n;
    code = c;
    frame(
      "Browser",
      input.dropBrowser
        ? "응답 유실 · 결과를 추정하지 않고 기존 작업 조회"
        : n + " · " + c,
      "Frontend.receive",
      {
        kind: "response",
        from: "Server",
        to: "Browser",
        lost: !!input.dropBrowser,
      },
    );
    return {
      state: s,
      frames,
      status: input.dropBrowser ? 0 : status,
      code: input.dropBrowser ? "RESPONSE_LOST" : code,
    };
  };
  const apply = () => {
    const fresh = s.transactions.filter(
      (t) => !s.ledger.some((l) => l.id === t.id),
    );
    s.ledger.push(...structuredClone(fresh));
    s.captured = s.ledger
      .filter((t) => t.kind === "CAPTURE")
      .reduce((n, t) => n + t.amount, 0);
    s.canceled = s.ledger
      .filter((t) => t.kind === "CANCEL")
      .reduce((n, t) => n + t.amount, 0);
    for (const op of s.ops)
      if (s.ledger.some((t) => t.operation === op.id)) {
        op.state = "SUCCEEDED";
        if (op.kind !== "CONFIRM") s.reserved = 0;
      }
    if (fresh.length) {
      s.version++;
      s.outbox++;
    }
    if (s.canceled + s.reserved > s.captured) {
      s.sync = "REVIEW";
      for (const o of s.ops)
        if (o.kind !== "CONFIRM" && o.state !== "SUCCEEDED") o.state = "REVIEW";
    } else s.sync = s.reserved ? "PENDING" : "CURRENT";
    if (s.captured && !s.closing && s.now < s.expires && !s.accepted) {
      s.accepted = true;
      s.order = "ACCEPTED";
    }
    if (
      s.closing &&
      s.captured > s.canceled &&
      !s.reserved &&
      !s.ops.some((o) => o.kind === "COMPENSATE")
    ) {
      const op: Op = {
        id: "compensate-1",
        kind: "COMPENSATE",
        amount: s.captured - s.canceled,
        state: "PENDING",
        key: "stable-compensate-1",
        version: s.version,
      };
      s.ops.push(op);
      s.reserved = op.amount;
      s.sync = "PENDING";
      frame(
        "DB",
        "늦은 승인 기록 후 별도 보상 작업·금액 예약",
        "PaymentProcessor.compensate",
      );
    }
    if (
      (s.closing || s.captured > 0) &&
      s.captured === s.canceled &&
      !s.reserved &&
      !s.ops.some((o) => ["PENDING", "UNKNOWN", "REVIEW"].includes(o.state))
    )
      s.order = "CLOSED";
    frame(
      "DB",
      "PG 거래 유일성 검사 · 원장·작업·주문·outbox 함께 반영",
      "PaymentProcessor.apply",
      { kind: "commit", from: "Server", to: "DB" },
    );
  };
  const send = (op: Op) => {
    if (s.fault === "pg-connect") {
      op.state = "UNKNOWN";
      s.sync = "UNKNOWN";
      frame(
        "Server",
        "PG 도착 전 연결 실패 · 작업과 예약 유지",
        "Workers.process",
        { kind: "blocked", from: "Server", to: "PG", operation: op.id },
      );
      return false;
    }
    s.pgCalls++;
    frame("PG", "고정 작업 식별자·동일 PG 멱등 키 전송", "PspClient.call", {
      kind: "request",
      from: "Server",
      to: "PG",
      operation: op.id,
    });
    if (!s.transactions.some((t) => t.operation === op.id)) {
      s.transactions.push({
        id: "pg-tx-" + (s.transactions.length + 1),
        operation: op.id,
        kind: op.kind === "CONFIRM" ? "CAPTURE" : "CANCEL",
        amount: op.amount,
      });
      if (op.kind === "CONFIRM") s.pgCaptured += op.amount;
      else s.pgCanceled += op.amount;
    }
    frame("PG DB", "독립 PG 승인/취소 거래 커밋", "Psp.commitOperation", {
      kind: "commit",
      from: "PG",
      to: "PG DB",
      operation: op.id,
    });
    if (s.fault === "pg-response" || s.fault === "db-apply") {
      op.state = "UNKNOWN";
      s.sync = "UNKNOWN";
      frame(
        s.fault === "pg-response" ? "PG" : "DB",
        s.fault === "pg-response"
          ? "PG 커밋 후 HTTP 응답 유실"
          : "PG 성공 후 상점 반영 트랜잭션 실패 · 부분 쓰기 없음",
        s.fault === "pg-response"
          ? "Psp.commitOperation"
          : "PaymentProcessor.apply",
        s.fault === "pg-response"
          ? {
              kind: "response",
              from: "PG",
              to: "Server",
              operation: op.id,
              lost: true,
            }
          : { kind: "blocked", from: "Server", to: "DB", operation: op.id },
      );
      return false;
    }
    apply();
    return true;
  };
  const requests = action === "confirm" && input.requests === 24 ? 24 : 1;
  frame("Browser", "명시한 사용자 동작 · " + action, "RequestFilter.request", {
    kind: "request",
    from: "Browser",
    to: "Server",
    packets: requests,
  });
  if (action === "tick") {
    s.now += input.seconds ?? 30;
    if (s.order === "OPEN" && s.now >= s.expires) {
      s.closing = true;
      s.order = "CLOSING";
      if (!s.ops.length) s.order = "CLOSED";
    }
    frame(
      "DB",
      "실습 시계 경과 · 승인된 주문을 자동 환불하지 않음",
      "Workers.reconcile",
    );
    return result(200, "CLOCK_ADVANCED");
  }
  if (action === "project") {
    s.receipt = { version: s.version, canceled: s.canceled };
    frame(
      "DB",
      "중복 소비 방지와 최신 결제 버전 영수증 반영",
      "Workers.project",
    );
    return result(200, "PROJECTION_CURRENT");
  }
  if (s.user !== s.owner) return result(403, "ORDER_OWNER_MISMATCH");
  if (action === "recover" || action === "webhook") {
    if (s.fault === "pg-connect")
      return result(503, "PG_OBSERVATION_UNAVAILABLE");
    if (action === "webhook") {
      if (!s.inbox.includes("event-1")) s.inbox.push("event-1");
      frame(
        "DB",
        "서명 검증 후 eventId inbox 접수 · 중복 제거",
        "ApiController.webhook",
        { kind: "request", from: "PG", to: "DB" },
      );
    }
    frame(
      "PG DB",
      "현재 PG 거래를 다시 조회 · 금액만으로 작업 성공 추정 금지",
      "Psp.query",
      { kind: "query", from: "Server", to: "PG DB" },
    );
    if (s.fault === "db-apply") return result(503, "LOCAL_APPLY_UNAVAILABLE");
    apply();
    for (const op of s.ops.filter((o) =>
      ["PENDING", "UNKNOWN"].includes(o.state),
    )) {
      if (s.ledger.some((t) => t.operation === op.id)) continue;
      if (s.closing && op.kind === "CONFIRM" && !s.pgCaptured) {
        op.state = "FAILED_FINAL";
        s.order = "CLOSED";
        continue;
      }
      if (s.now > 86400) {
        op.state = "REVIEW";
        s.sync = "REVIEW";
        frame(
          "DB",
          "PG 키 안전 기한 초과 · 새 전송 없이 REVIEW",
          "PaymentProcessor.review",
        );
        continue;
      }
      send(op);
    }
    return result(200, s.sync === "REVIEW" ? "REVIEW_REQUIRED" : "RECONCILED");
  }
  if (action === "external-cancel") {
    const amount = input.amount ?? 3000;
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > s.pgCaptured - s.pgCanceled
    )
      return result(400, "INVALID_AMOUNT");
    s.transactions.push({
      id: "pg-tx-" + (s.transactions.length + 1),
      operation: null,
      kind: "CANCEL",
      amount,
    });
    s.pgCanceled += amount;
    frame(
      "PG DB",
      "상점 작업과 연결되지 않은 PG 외부 취소 사실",
      "Psp.commitOperation",
      { kind: "commit", from: "PG", to: "PG DB" },
    );
    return result(200, "EXTERNAL_CHANGE");
  }
  if (action === "close") {
    s.closing = true;
    s.order = "CLOSING";
    frame(
      "DB",
      "종료 의사 저장 · 미해결 금전 상태를 CLOSED로 추정하지 않음",
      "PaymentService.closeOrder",
    );
    if (!s.ops.length) s.order = "CLOSED";
    return result(202, "CLOSE_REQUESTED");
  }
  if (s.fault === "redis") {
    frame(
      "Redis",
      "신규 변경 접수 시 Redis 연결 확인 불가",
      "Limiter.reserve",
      {
        kind: "blocked",
        from: "Server",
        to: "Redis",
      },
    );
    return result(503, "REDIS_UNAVAILABLE");
  }
  frame(
    "Redis",
    "공유 요청 제한 · Redis 잠금에 정합성을 의존하지 않음",
    "Limiter.reserve",
    { kind: "query", from: "Server", to: "Redis" },
  );
  if (action === "order") {
    if (s.order === "NONE") {
      s.order = "OPEN";
      frame(
        "DB",
        "서버 상품 가격 스냅샷·checkout intent 유일성 커밋",
        "PaymentService.createOrder",
        { kind: "commit", from: "Server", to: "DB" },
      );
      return result(201, "ORDER_CREATED");
    }
    return result(200, "EXISTING_CHECKOUT_ORDER");
  }
  if (action === "authenticate") {
    if (s.order !== "OPEN" || s.now >= s.expires || s.ops.length)
      return result(409, "ORDER_NOT_PAYABLE");
    s.authorized = true;
    frame(
      "PG",
      "별도 인증과 소유·주문·금액 검증 · 승인 없음",
      "PaymentService.callback",
      { kind: "response", from: "PG", to: "Server" },
    );
    return result(200, "AUTHORIZED_ONLY");
  }
  if (action === "confirm") {
    if (
      (input.amount !== undefined && input.amount !== s.amount) ||
      (input.currency && input.currency !== "KRW")
    )
      return result(400, "ORDER_AMOUNT_MISMATCH");
    const old = s.ops.find((o) => o.kind === "CONFIRM");
    if (old) {
      frame(
        "Server",
        "같은 승인 요청은 기존 canonical 작업으로 합류",
        "PaymentService.confirm",
        {
          kind: "dedupe",
          from: "Browser",
          to: "Server",
          packets: requests,
          forwarded: 0,
          operation: old.id,
        },
      );
      return result(
        old.state === "SUCCEEDED" ? 200 : 202,
        "CANONICAL_" + old.state,
      );
    }
    if (!s.authorized || s.order !== "OPEN" || s.now >= s.expires)
      return result(409, "ORDER_NOT_PAYABLE");
    const op: Op = {
      id: "confirm-1",
      kind: "CONFIRM",
      amount: s.amount,
      state: "PENDING",
      key: input.key || "client-confirm-1",
      version: s.version,
    };
    s.ops.push(op);
    frame(
      "DB",
      "승인 작업·고정 PG 키·job 접수 커밋",
      "PaymentService.confirm",
      { kind: "commit", from: "Server", to: "DB", operation: op.id },
    );
    if (requests > 1)
      frame(
        "Server",
        "승인 요청 24개 → canonical 작업 1개 · 중복 23개 합류",
        "PaymentService.confirm",
        {
          kind: "dedupe",
          from: "Browser",
          to: "Server",
          packets: 24,
          forwarded: 1,
          operation: op.id,
        },
      );
    send(op);
    return result(202, "CONFIRM_" + op.state);
  }
  if (
    action === "cancel" ||
    action === "retry-cancel" ||
    action === "stale-cancel"
  ) {
    const key =
        action === "retry-cancel"
          ? s.lastCancel
          : input.key || "client-cancel-" + (s.ops.length + 1),
      old = s.ops.find((o) => o.key === key),
      amount = action === "retry-cancel" ? old?.amount : (input.amount ?? 3000);
    if (old) {
      if (amount !== old.amount) return result(409, "IDEMPOTENCY_KEY_REUSED");
      return result(
        old.state === "SUCCEEDED" ? 200 : 202,
        "CANCEL_REPLAY_" + old.state,
      );
    }
    if (!Number.isSafeInteger(amount) || amount! < 1)
      return result(400, "INVALID_AMOUNT");
    const version =
      action === "stale-cancel"
        ? s.version - 1
        : (input.expectedVersion ?? s.version);
    if (version !== s.version) return result(409, "PAYMENT_VERSION_CHANGED");
    if (
      s.ops.some(
        (o) =>
          o.kind !== "CONFIRM" &&
          ["PENDING", "UNKNOWN", "REVIEW"].includes(o.state),
      )
    )
      return result(409, "CANCEL_IN_PROGRESS");
    if (s.sync !== "CURRENT" || amount! > s.captured - s.canceled - s.reserved)
      return result(409, "CANCEL_EXCEEDS_BALANCE");
    const op: Op = {
      id: "cancel-" + s.ops.length,
      kind: "CANCEL",
      amount: amount!,
      state: "PENDING",
      key: key!,
      version: s.version,
    };
    s.ops.push(op);
    s.lastCancel = key;
    s.reserved = op.amount;
    s.version++;
    s.sync = "PENDING";
    frame(
      "DB",
      "취소 금액 예약·작업·job 동일 트랜잭션 커밋",
      "PaymentService.reserveCancel",
      { kind: "reserve", from: "Server", to: "DB", operation: op.id },
    );
    send(op);
    return result(202, "CANCEL_" + op.state);
  }
  return result(status, code);
}

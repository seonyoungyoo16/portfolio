import type { Frame, Node, State } from "./payment-demo";

export const paymentNodes: Node[] = [
  "Browser",
  "Server",
  "Redis",
  "DB",
  "PG",
  "PG DB",
];
const edges: [Node, Node][] = [
  ["Browser", "Server"],
  ["Server", "Redis"],
  ["Server", "DB"],
  ["Server", "PG"],
  ["PG", "PG DB"],
];
export function paymentRoute(frame?: Frame): Node[] {
  const v = frame?.visual;
  if (!v || v.from === v.to) return [];
  const queue: Node[][] = [[v.from]],
    seen = new Set<Node>([v.from]);
  while (queue.length) {
    const path = queue.shift()!;
    for (const edge of edges) {
      const n =
        edge[0] === path.at(-1)
          ? edge[1]
          : edge[1] === path.at(-1)
            ? edge[0]
            : null;
      if (!n || seen.has(n)) continue;
      const next = [...path, n];
      if (n === v.to) return next;
      seen.add(n);
      queue.push(next);
    }
  }
  return [];
}
export function paymentNodeStep(
  frames: Frame[],
  node: Node,
  current: number,
  transaction?: string,
): number {
  if (transaction) {
    const field = node === "DB" ? "ledger" : "transactions";
    return frames.findIndex((f) =>
      f.snapshot[field].some((t) => t.id === transaction),
    );
  }
  const candidates = frames
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.visual?.to === node || f.node === node);
  return (
    candidates.filter((c) => c.i <= current).at(-1)?.i ?? candidates[0]?.i ?? -1
  );
}
export function paymentRing(
  state: Pick<State, "captured" | "canceled" | "reserved">,
) {
  const a = state.captured,
    c = state.canceled,
    r = state.reserved,
    overbooked = c + r > a;
  return {
    approved: a,
    canceled: c,
    reserved: r,
    overbooked,
    available: Math.max(0, a - c - r),
    segments:
      a > 0
        ? [
            {
              kind: "available",
              amount: Math.max(0, a - c - (overbooked ? 0 : r)),
              outer: false,
            },
            { kind: "canceled", amount: c, outer: false },
            { kind: "reserved", amount: r, outer: overbooked },
          ]
            .filter((s) => s.amount > 0)
            .map((s) => ({ ...s, share: s.amount / a }))
        : [],
  };
}

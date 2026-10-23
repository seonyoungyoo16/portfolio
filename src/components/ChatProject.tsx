import { useEffect, useRef, useState } from "react";
import ChatScene from "./ChatScene";
import CanceledChatItem from "./CanceledChatItem";
import {
  publishChatEvent,
  consumeChatEvent,
  nextDelivery,
  deliveryStats,
} from "../chat-delivery";
import {
  attemptChat,
  enqueueChat,
  acknowledgeChat,
  pendingFor,
  nextPendingChat,
  canCancelChat,
  cancelPendingChat,
  markChatAttempted,
  requeueCanceledChat,
  prepareRequeueBody,
  type CanceledChat,
  type PendingChat,
} from "../chat-outbox";
import {
  relayChatTyping,
  cleanChatTyping,
  visibleChatTyping,
  type TypingNotice,
} from "../chat-typing";
import model from "../generated/chat-source.json";
import {
  chatHistory,
  waitingChat,
  readChat,
  hasReadChat,
  nextReadChat,
  deliverChat,
  emptyChat,
  storeChat,
  validateChatRequest,
  type ChatClient,
  type ChatRead,
  type ChatDatabase,
  type ChatMessage,
  type DeliveryMode,
} from "../chat-demo";
import "../chat.css";
import LabWorkbench, { UserActionTrace } from "./LabWorkbench";
import { ChatJourney } from "./UserJourneys";

type Flow = keyof typeof model.flows;
type Saved = ReturnType<typeof storeChat>;
type Trace = {
  kind: Flow;
  actor: number;
  run: number;
  body: string;
  roomId: string;
  job: Saved | null;
  recoveryCount: number;
  readUpTo: number;
  applyRead: boolean;
  typingActive: boolean;
  mode: DeliveryMode;
  requestId: string;
  previousRequestId?: string;
  previousBody?: string;
};
const cacheKey = "chat-lab:v1",
  outboxKey = "chat-lab:outbox:v1";
function initialOutbox(): PendingChat[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(outboxKey) || "[]");
    if (Array.isArray(list))
      return list.filter(
        (p) =>
          p &&
          ["clientId", "roomId", "requestId", "body"].every(
            (key) => typeof p[key] === "string",
          ),
      );
  } catch {}
  return [];
}
function initialDatabase(): ChatDatabase {
  try {
    const db = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (db && Array.isArray(db.messages) && Number.isSafeInteger(db.nextId))
      return db;
  } catch {}
  return emptyChat();
}
const format = (m: ChatMessage) =>
  new Date(m.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const flowName: Record<Flow, string> = {
  join: "입장과 대화 복구",
  send: "메시지 전송",
  duplicate: "중복 전송 방지",
  disconnect: "오프라인으로 전환",
  read: "읽음 확인",
  typing: "입력 중 신호 · 저장하지 않음",
  interrupted: "전송 중 연결 끊김 · ACK 미수신",
  retry: "재접속 후 자동 재전송",
  kafkaSend: "Kafka 경유 · 저장과 전달 분리",
  kafkaInterrupted: "Kafka 저장 후 ACK 미수신",
  kafkaDeliver: "전달 서버 · 대기 이벤트 처리",
  kafkaPublish: "Outbox 미발행 이벤트 복구",
  kafkaUnavailable: "Kafka 중단 · Outbox 보관",
  kafkaUnavailableInterrupted: "Kafka 중단 + ACK 미수신",
  databaseUnavailable: "DB 저장 실패 · PC에서 전송 대기",
  databaseRetry: "전송 대기열 · 원래 ID로 순서대로 재전송",
  databaseRetryKafka: "전송 대기열 · 원래 ID → DB + Outbox",
  databaseRetryOutbox: "전송 대기열 · 원래 ID → Outbox 보관",
  cancel: "전송 대기 취소 · 재전송 제외",
  requeue: "취소 메시지 다시 보내기 · 새 ID로 맨 뒤에 추가",
};
export default function ChatProject() {
  const [userOrigin, setUserOrigin] = useState("");
  const [db, setDb] = useState(initialDatabase);
  const [databaseRunning, setDatabaseRunning] = useState(
    () => sessionStorage.getItem("chat-lab:database") !== "paused",
  );
  const [mode, setMode] = useState<DeliveryMode>("direct"),
    [workerRunning, setWorkerRunning] = useState(
      () => sessionStorage.getItem("chat-lab:worker") !== "paused",
    ),
    [brokerRunning, setBrokerRunning] = useState(
      () => sessionStorage.getItem("chat-lab:broker") !== "paused",
    );
  const [clients, setClients] = useState<ChatClient[]>(() =>
    [0, 1].map((i) => ({
      id: "demo-" + (i ? "b" : "a"),
      name: "참가자 " + (i ? "B" : "A"),
      roomId: "lobby",
      connected: false,
      viewOpen: true,
      messages: [],
    })),
  );
  const [drafts, setDrafts] = useState(["", ""]),
    [notice, setNotice] = useState(
      "참가자 A와 B의 다시 접속을 눌러 시작하세요. 오프라인에서도 메시지는 서버에 보관됩니다.",
    );
  const [trace, setTrace] = useState<Trace>({
    kind: "join",
    actor: 0,
    run: 0,
    body: "채팅방 입장",
    roomId: "lobby",
    job: null,
    recoveryCount: 0,
    readUpTo: 0,
    applyRead: false,
    typingActive: false,
    mode: "direct",
    requestId: "",
  });
  const [step, setStep] = useState(0),
    [fastForward, setFastForward] = useState(false),
    [playing, setPlaying] = useState(false),
    [running, setRunning] = useState(false),
    [lastRequests, setLastRequests] = useState<(ChatMessage | null)[]>([
      null,
      null,
    ]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [outbox, setOutbox] = useState(initialOutbox),
    [dropNext, setDropNext] = useState([false, false]),
    [retryResults, setRetryResults] = useState<(Saved | null)[]>([null, null]);
  const [cancellations, setCancellations] = useState<CanceledChat[]>([]);
  const activeSend = useRef<PendingChat | null>(null),
    requeuedItems = useRef(new Set<string>());
  const [queueReceipts, setQueueReceipts] = useState<
    { message: ChatMessage; duplicate: boolean }[]
  >([]);
  const [receipts, setReceipts] = useState<ChatRead[][]>(() => [
      initialDatabase().reads || [],
      initialDatabase().reads || [],
    ]),
    [readTick, setReadTick] = useState(0);
  const [typingNotices, setTypingNotices] = useState<TypingNotice[]>([]),
    [typingClock, setTypingClock] = useState(Date.now);
  const typingIdle = useRef<(ReturnType<typeof setTimeout> | null)[]>([
      null,
      null,
    ]),
    typingSent = useRef([
      { active: false, at: 0 },
      { active: false, at: 0 },
    ]);
  const blocking = running && trace.kind !== "typing",
    busyNow = useRef(false),
    live = useRef({ clients, kind: trace.kind, running });
  busyNow.current = blocking;
  live.current = { clients, kind: trace.kind, running };
  const pendingConnection = useRef(false),
    published = useRef(false);
  const committed = useRef(false),
    delivered = useRef(false),
    acknowledged = useRef(false);
  const messageLists = useRef<(HTMLDivElement | null)[]>([]);
  const timelines = model.flows[trace.kind],
    current = timelines[Math.min(step, timelines.length - 1)];
  useEffect(() => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(db));
    } catch {
      setNotice("저장 공간이 부족해 현재 화면에서만 대화가 유지됩니다.");
    }
  }, [db]);
  useEffect(() => {
    sessionStorage.setItem(
      "chat-lab:database",
      databaseRunning ? "running" : "paused",
    );
  }, [databaseRunning]);
  useEffect(() => {
    sessionStorage.setItem(
      "chat-lab:broker",
      brokerRunning ? "running" : "paused",
    );
  }, [brokerRunning]);
  useEffect(() => {
    sessionStorage.setItem(
      "chat-lab:worker",
      workerRunning ? "running" : "paused",
    );
  }, [workerRunning]);
  useEffect(() => {
    messageLists.current.forEach((list) => {
      if (list) list.scrollTop = list.scrollHeight;
    });
  }, [clients]);
  useEffect(() => {
    if (!playing || !running) return;
    const timer = setInterval(
      () =>
        setStep((i) => {
          if (i >= timelines.length - 1) {
            setRunning(false);
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      fastForward ? 40 : trace.kind === "typing" ? 400 : 1100,
    );
    return () => clearInterval(timer);
  }, [playing, running, timelines.length, trace.run, trace.kind, fastForward]);
  const persistOutbox = (pending: PendingChat[]) => {
    try {
      sessionStorage.setItem(outboxKey, JSON.stringify(pending));
      return true;
    } catch {
      setNotice("대기 상태를 저장하지 못했습니다. 전송·취소를 보류합니다.");
      return false;
    }
  };
  const acceptAck = (job: Saved, actor: number) => {
    activeSend.current = null;
    const queued = outbox.find(
      (p) =>
        p.clientId === job.message.clientId &&
        p.roomId === job.message.roomId &&
        p.requestId === job.message.requestId,
    );
    const remaining = acknowledgeChat(outbox, job.message);
    persistOutbox(remaining);
    setOutbox(remaining);
    setLastRequests((last) =>
      last.map((m, i) => (i === actor ? job.message : m)),
    );
    if (queued?.failed || queued?.queued || trace.kind === "retry") {
      setRetryResults((rs) => rs.map((m, i) => (i === actor ? job : m)));
      setQueueReceipts((rs) =>
        [
          ...rs.filter(
            (r) =>
              r.message.clientId !== job.message.clientId ||
              r.message.requestId !== job.message.requestId,
          ),
          { message: job.message, duplicate: job.duplicate },
        ].slice(-20),
      );
    }
  };
  useEffect(() => {
    if (
      trace.kind === "join" &&
      pendingConnection.current &&
      step >= timelines.length - 1
    ) {
      pendingConnection.current = false;
      setReceipts((rs) =>
        rs.map((r, i) => (i === trace.actor ? db.reads || [] : r)),
      );
      setClients((cs) =>
        cs.map((c, i) =>
          i === trace.actor
            ? { ...c, connected: true, messages: chatHistory(db, trace.roomId) }
            : c,
        ),
      );
      setNotice(
        clients[trace.actor].name +
          " 다시 접속 완료 · 미수신 " +
          trace.recoveryCount +
          "건을 최근 대화에서 받아왔습니다.",
      );
    }
    if (trace.kind === "read" && trace.applyRead) {
      if (step >= 2 && !committed.current) {
        committed.current = true;
        setDb((database) =>
          readChat(database, clients[trace.actor], trace.readUpTo),
        );
      }
      if (step >= timelines.length - 1 && !delivered.current) {
        delivered.current = true;
        setReceipts((rs) =>
          rs.map((r, i) =>
            clients[i].connected && clients[i].roomId === trace.roomId
              ? db.reads || []
              : r,
          ),
        );
        setNotice(
          clients[trace.actor].name +
            "가 #" +
            trace.readUpTo +
            "까지 읽었습니다. 같은 방의 온라인 참가자에게 읽음 확인을 전달했습니다.",
        );
      }
    }
    const job = trace.job;
    if (!job) return;
    if (trace.kind === "kafkaPublish") {
      if (step >= 1 && brokerRunning && !published.current) {
        published.current = true;
        setDb((database) =>
          publishChatEvent(database, job.message.id, brokerRunning),
        );
      }
      return;
    }
    if (trace.kind === "kafkaDeliver") {
      if (step >= 3 && !delivered.current) {
        delivered.current = true;
        setClients((cs) => deliverChat(cs, job.message));
      }
      if (step >= 2 && !committed.current) {
        committed.current = true;
        setDb((database) => consumeChatEvent(database, job.message.id));
      }
      if (step >= 4 && !acknowledged.current) {
        acknowledged.current = true;
        setNotice(
          "Kafka 이벤트 #" +
            job.message.id +
            " 처리 완료 · 같은 방에 전달하고 offset을 갱신했습니다. 읽음 확인은 별도입니다.",
        );
      }
      return;
    }
    if (
      [
        "kafkaSend",
        "kafkaInterrupted",
        "kafkaUnavailable",
        "kafkaUnavailableInterrupted",
        "databaseRetryKafka",
        "databaseRetryOutbox",
      ].includes(trace.kind)
    ) {
      if (step >= 3 && !committed.current) {
        committed.current = true;
        setDb(job.database);
      }
      if (step >= 4 && !acknowledged.current) {
        acknowledged.current = true;
        if (
          trace.kind === "kafkaInterrupted" ||
          trace.kind === "kafkaUnavailableInterrupted"
        ) {
          setClients((cs) =>
            cs.map((c, i) =>
              i === trace.actor ? { ...c, connected: false } : c,
            ),
          );
          setNotice(
            "서버 저장 후 ACK 확인 전에 연결이 끊겼습니다. " +
              (brokerRunning
                ? "Kafka 전달은 별도로 계속됩니다."
                : "메시지는 Outbox에 보관하며 Kafka 복구를 기다립니다."),
          );
        } else {
          acceptAck(job, trace.actor);
          setClients((cs) =>
            cs.map((c, i) =>
              i === trace.actor ? deliverChat([c], job.message)[0] : c,
            ),
          );
          setNotice(
            "저장 ACK #" +
              job.message.id +
              " · 상대 전달은 Kafka Consumer가 처리합니다.",
          );
        }
      }
      if (step >= 5 && !published.current) {
        published.current = true;
        setDb((database) =>
          publishChatEvent(database, job.message.id, brokerRunning),
        );
        if (!brokerRunning)
          setNotice(
            "Kafka 연결 불가 · 메시지 #" +
              job.message.id +
              "는 Outbox에 미발행 상태로 보관합니다. " +
              (trace.kind.endsWith("Interrupted")
                ? "ACK는 받지 못했습니다. 재접속 시 같은 요청 ID로 확인합니다."
                : "저장 ACK는 완료됐습니다.") +
              " Kafka 복구 후 자동 발행합니다.",
          );
      }
      return;
    }
    if (
      (trace.kind === "send" ||
        trace.kind === "interrupted" ||
        trace.kind === "databaseRetry") &&
      step >= 4 &&
      !committed.current
    ) {
      committed.current = true;
      setDb(job.database);
    }
    if (
      (trace.kind === "send" ||
        trace.kind === "interrupted" ||
        trace.kind === "databaseRetry") &&
      step >= 5 &&
      !delivered.current
    ) {
      delivered.current = true;
      setClients((cs) => deliverChat(cs, job.message));
    }
    if (trace.kind === "interrupted") {
      if (step >= timelines.length - 1 && !acknowledged.current) {
        acknowledged.current = true;
        setClients((cs) =>
          cs.map((c, i) =>
            i === trace.actor ? { ...c, connected: false } : c,
          ),
        );
        setNotice(
          "메시지 #" +
            job.message.id +
            "는 서버에 저장됐지만 ACK를 받기 전에 연결이 끊겼습니다. 다시 접속하면 같은 requestId로 자동 재전송합니다.",
        );
      }
      return;
    }
    if (step >= timelines.length - 1 && !acknowledged.current) {
      acceptAck(job, trace.actor);
      acknowledged.current = true;
      setNotice(
        job.duplicate
          ? "같은 requestId · INSERT와 방송 없이 기존 메시지 #" +
              job.message.id +
              "로 ACK했습니다."
          : "메시지 #" +
              job.message.id +
              " 서버 저장·ACK 완료 · " +
              (clients[1 - trace.actor].roomId !== trace.roomId
                ? "다른 방의 참가자에게는 전달하지 않습니다."
                : !clients[1 - trace.actor].connected
                  ? "상대는 오프라인입니다. 다시 접속할 때 받아옵니다."
                  : !clients[1 - trace.actor].viewOpen
                    ? "상대는 온라인 · 대화창 닫힘입니다. 수신해도 안 읽음으로 남습니다."
                    : "대화창에 표시된 뒤 상대의 읽음 신호를 기다립니다."),
      );
    }
  }, [step, trace, timelines.length]);
  const start = (
    kind: Flow,
    actor: number,
    body: string,
    job: Saved | null = null,
    connect = false,
    roomId = clients[actor].roomId,
    recoveryCount = waitingChat(db, { ...clients[actor], roomId }).length,
    readUpTo = 0,
    applyRead = false,
    typingActive = false,
    modeOverride: DeliveryMode = mode,
    requestId = "",
    previousRequestId = "",
    previousBody = "",
  ) => {
    busyNow.current = kind !== "typing";
    pendingConnection.current = connect;
    committed.current = false;
    delivered.current = false;
    acknowledged.current = false;
    published.current = false;
    setTrace((t) => ({
      kind,
      actor,
      body,
      roomId,
      job,
      recoveryCount,
      readUpTo,
      applyRead,
      typingActive,
      mode: job?.message.deliveryMode || modeOverride,
      requestId: job?.message.requestId || requestId,
      previousRequestId,
      previousBody,
      run: t.run + 1,
    }));
    setStep(0);
    setPlaying(true);
    setRunning(true);
  };
  const signalTyping = (actor: number, active: boolean, visual = true) => {
    if (!active) {
      if (typingIdle.current[actor]) clearTimeout(typingIdle.current[actor]!);
      if (!typingSent.current[actor].active) return;
    }
    const now = Date.now(),
      source = live.current.clients[actor],
      last = typingSent.current[actor];
    if (active && (!source.connected || !source.viewOpen)) return;
    if (active && last.active && now - last.at < 900) return;
    typingSent.current[actor] = { active, at: now };
    setTypingClock(now);
    setTypingNotices((previous) =>
      relayChatTyping(previous, live.current.clients, actor, active, now),
    );
    if (
      visual &&
      !outbox.length &&
      !busyNow.current &&
      (!active || live.current.kind !== "typing" || !live.current.running)
    )
      start(
        "typing",
        actor,
        active
          ? "TYPING true · 입력 여부만 서버로 전송"
          : "TYPING false · 입력 중 표시 해제",
        null,
        false,
        source.roomId,
        0,
        0,
        false,
        active,
      );
  };
  const inputDraft = (actor: number, body: string) => {
    setDrafts((d) => d.map((value, i) => (i === actor ? body : value)));
    if (typingIdle.current[actor]) clearTimeout(typingIdle.current[actor]!);
    signalTyping(actor, !!body.trim());
    if (body.trim())
      typingIdle.current[actor] = setTimeout(
        () => signalTyping(actor, false),
        2000,
      );
  };
  useEffect(
    () => () =>
      typingIdle.current.forEach((timer) => {
        if (timer) clearTimeout(timer);
      }),
    [],
  );
  useEffect(() => {
    setTypingNotices((previous) =>
      cleanChatTyping(previous, clients, Date.now()),
    );
  }, [clients]);
  useEffect(() => {
    if (!typingNotices.length) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingClock(now);
      setTypingNotices((previous) =>
        previous.filter((notice) => notice.expiresAt > now),
      );
    }, 200);
    return () => clearInterval(timer);
  }, [typingNotices.length]);
  const send = (index: number, repeat = false) => {
    signalTyping(index, false, false);
    try {
      const previous = lastRequests[index],
        body = repeat ? previous?.body || "" : drafts[index],
        requestId = repeat ? previous?.requestId || "" : crypto.randomUUID(),
        client = clients[index];
      const selectedMode = repeat ? previous?.deliveryMode || "direct" : mode;
      validateChatRequest(client, body, requestId, selectedMode);
      const wait = blocking || busyNow.current || outbox.length > 0,
        request: PendingChat = {
          clientId: client.id,
          roomId: client.roomId,
          requestId,
          body: body.trim(),
          mode: selectedMode,
          failed: !databaseRunning,
          queued: wait,
          cut: !repeat && dropNext[index],
          cancelable: wait || !databaseRunning,
        };
      const pending = enqueueChat(outbox, request);
      if (!persistOutbox(pending)) return;
      setOutbox(pending);
      if (!wait && databaseRunning) activeSend.current = request;
      setRetryResults((rs) => rs.map((m, i) => (i === index ? null : m)));
      if (!repeat) {
        setDrafts((d) => d.map((v, i) => (i === index ? "" : v)));
        setDropNext((d) => d.map((v, i) => (i === index ? false : v)));
      }
      if (wait) {
        setNotice(
          "전송 대기열에 추가 · 앞선 요청의 ACK 후 순서대로 처리합니다. · " +
            requestId,
        );
        return;
      }
      const result = attemptChat(db, client, request, databaseRunning).saved,
        cut = request.cut && !result?.duplicate;
      if (!result)
        start(
          "databaseUnavailable",
          index,
          request.body,
          null,
          false,
          client.roomId,
          0,
          0,
          false,
          false,
          selectedMode,
          requestId,
        );
      else
        start(
          result.duplicate
            ? "duplicate"
            : selectedMode === "kafka"
              ? brokerRunning
                ? cut
                  ? "kafkaInterrupted"
                  : "kafkaSend"
                : cut
                  ? "kafkaUnavailableInterrupted"
                  : "kafkaUnavailable"
              : cut
                ? "interrupted"
                : "send",
          index,
          result.message.body,
          result,
        );
      setNotice(
        (!databaseRunning
          ? "DB 저장 실패 · ACK 없음 · 같은 요청 ID로 전송 대기"
          : selectedMode === "kafka"
            ? "Kafka 경유"
            : "직접 전달") +
          " · JSON mode=" +
          selectedMode +
          " · " +
          requestId,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "전송할 수 없습니다.");
    }
  };
  const connection = (index: number) => {
    signalTyping(index, false, false);
    const connected = !clients[index].connected;
    if (!connected)
      setClients((cs) =>
        cs.map((c, i) => (i === index ? { ...c, connected: false } : c)),
      );
    start(
      connected ? "join" : "disconnect",
      index,
      connected
        ? "다시 접속 → 서버 대화 조회 → PC로 대화 복구"
        : "오프라인 전환 · 메시지는 서버에 계속 보관됩니다",
      null,
      connected,
    );
    setNotice(
      clients[index].name +
        (connected
          ? " 다시 접속 중 · 서버에 보관된 대화를 받아옵니다…"
          : " 오프라인 · 메시지는 서버에 보관되며 다시 접속하면 받아옵니다."),
    );
  };
  const roomChange = (index: number, roomId: string) => {
    signalTyping(index, false, false);
    const connected = clients[index].connected;
    setClients((cs) =>
      cs.map((c, i) =>
        i === index ? { ...c, roomId, connected: false, messages: [] } : c,
      ),
    );
    if (connected) {
      start(
        "join",
        index,
        "방 변경 · 서버에서 대화 불러오기",
        null,
        true,
        roomId,
      );
    }
    setNotice(
      connected
        ? "소켓을 다시 연결하고 새 방에 입장합니다."
        : "방을 선택했습니다. 다시 접속하면 이 방의 대화를 받아옵니다.",
    );
  };
  const toggleView = (index: number) => {
    if (clients[index].viewOpen) signalTyping(index, false);
    const opening = !clients[index].viewOpen;
    setClients((cs) =>
      cs.map((client, i) =>
        i === index ? { ...client, viewOpen: opening } : client,
      ),
    );
    setNotice(
      clients[index].name +
        (opening
          ? " 대화창을 열었습니다. 온라인이면 확인한 대화의 읽음 신호를 보냅니다."
          : " 대화창을 닫았습니다. 온라인 연결과 메시지 수신은 유지하며 읽음 신호는 보내지 않습니다."),
    );
  };
  useEffect(() => {
    const changed = () => {
        setReadTick((t) => t + 1);
        if (document.hidden) {
          signalTyping(0, false, false);
          signalTyping(1, false, false);
        }
      },
      observer = new IntersectionObserver(changed, { threshold: [0, 0.1, 1] });
    messageLists.current.forEach((list) => {
      if (list) observer.observe(list);
    });
    document.addEventListener("visibilitychange", changed);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", changed);
    };
  }, []);
  useEffect(() => {
    if (blocking || busyNow.current || !brokerRunning || !databaseRunning)
      return;
    const unpublished = db.kafkaEvents?.find((e) => !e.published);
    if (unpublished) {
      const message = db.messages.find((m) => m.id === unpublished.messageId);
      if (message) {
        start(
          "kafkaPublish",
          Math.max(
            0,
            clients.findIndex((c) => c.id === message.clientId),
          ),
          message.body,
          { database: db, message, duplicate: false },
          false,
          message.roomId,
        );
        return;
      }
    }
    if (!workerRunning) return;
    const event = nextDelivery(db);
    if (!event) return;
    const message = db.messages.find((m) => m.id === event.messageId);
    if (!message) return;
    const actor = Math.max(
      0,
      clients.findIndex((c) => c.id === message.clientId),
    );
    start(
      "kafkaDeliver",
      actor,
      message.body,
      { database: db, message, duplicate: false },
      false,
      message.roomId,
    );
    setNotice(
      "전달 서버가 Kafka P" +
        event.partition +
        " offset " +
        event.offset +
        "의 메시지 #" +
        message.id +
        "를 처리합니다.",
    );
  }, [db, clients, workerRunning, brokerRunning, blocking, databaseRunning]);
  useEffect(() => {
    if (blocking || busyNow.current || !databaseRunning) return;
    const next = nextPendingChat(outbox, clients);
    if (!next) return;
    const { request, actor } = next;
    try {
      const job = storeChat(
        db,
        clients[actor],
        request.body,
        request.requestId,
        request.mode || "direct",
      );
      const pending = markChatAttempted(outbox, request);
      if (!persistOutbox(pending)) return;
      activeSend.current = request;
      setOutbox(pending);
      start(
        job.duplicate
          ? "retry"
          : job.message.deliveryMode === "kafka"
            ? brokerRunning
              ? request.cut
                ? "kafkaInterrupted"
                : request.failed || request.queued
                  ? "databaseRetryKafka"
                  : "kafkaSend"
              : request.cut
                ? "kafkaUnavailableInterrupted"
                : request.failed || request.queued
                  ? "databaseRetryOutbox"
                  : "kafkaUnavailable"
            : request.cut
              ? "interrupted"
              : request.failed || request.queued
                ? "databaseRetry"
                : "send",
        actor,
        request.body,
        job,
      );
      setNotice(
        "대기 요청 자동 재전송 · 같은 requestId " +
          request.requestId +
          " · " +
          (job.duplicate
            ? "기존 메시지 #" + job.message.id + " 확인"
            : "서버에 저장되지 않은 요청 처리"),
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "재전송할 수 없습니다.",
      );
    }
  }, [clients, db, blocking, outbox, databaseRunning, brokerRunning]);
  useEffect(() => {
    if (
      !databaseRunning ||
      blocking ||
      busyNow.current ||
      (brokerRunning && workerRunning && nextDelivery(db)) ||
      document.hidden ||
      clients.some(
        (client) =>
          client.connected &&
          pendingFor(outbox, client.id, client.roomId).length,
      )
    )
      return;
    const index = clients.findIndex((client, i) => {
      if (!nextReadChat(db, client)) return false;
      const list = messageLists.current[i];
      if (!list || list.scrollHeight - list.scrollTop - list.clientHeight > 24)
        return false;
      const end = list.lastElementChild?.getBoundingClientRect();
      if (!end) return false;
      let top = 0,
        bottom = innerHeight;
      for (let el: HTMLElement | null = list; el; el = el.parentElement) {
        if (
          el === list ||
          /(auto|scroll|hidden)/.test(getComputedStyle(el).overflowY)
        ) {
          const box = el.getBoundingClientRect();
          top = Math.max(top, box.top);
          bottom = Math.min(bottom, box.bottom);
        }
      }
      return end.bottom > top && end.bottom <= bottom + 2;
    });
    if (index >= 0) {
      start(
        "read",
        index,
        "대화 화면에서 메시지 확인 → READ → 읽음 확인 전달",
        null,
        false,
        clients[index].roomId,
        0,
        nextReadChat(db, clients[index]),
        true,
      );
      setNotice(
        clients[index].name +
          "가 대화를 확인했습니다. 읽음 신호를 서버로 보내는 중입니다.",
      );
    }
  }, [clients, db, blocking, readTick, databaseRunning]);
  const chooseMode = (next: DeliveryMode) => {
    if (blocking) return;
    signalTyping(0, false, false);
    signalTyping(1, false, false);
    setMode(next);
    setRunning(false);
    setPlaying(false);
    setStep(0);
    setTrace((t) => ({
      ...t,
      kind: next === "kafka" ? "kafkaSend" : "send",
      mode: next,
      job: null,
      previousRequestId: "",
      previousBody: "",
      run: 0,
      body: "메시지를 보내 선택한 처리 흐름을 확인하세요.",
    }));
    setNotice(
      next === "kafka"
        ? "Kafka 방식 선택 · 같은 보내기 동작이 DB + Outbox → Kafka → 전달 서버로 분기합니다."
        : "현재 방식 선택 · DB 저장 후 같은 방에 직접 전달합니다. Kafka 대기 메시지는 선택과 별도로 유지됩니다.",
    );
  };
  const cancelRequest = (request: PendingChat, actor: number) => {
    const pending = cancelPendingChat(outbox, request, activeSend.current);
    if (pending === outbox) {
      setNotice("이미 전송한 요청은 저장 결과를 확인해야 합니다.");
      return;
    }
    if (!persistOutbox(pending)) return;
    setOutbox(pending);
    setCancellations((list) => [...list, request].slice(-20));
    if (
      (!blocking && !busyNow.current) ||
      (trace.kind === "databaseUnavailable" &&
        trace.requestId === request.requestId &&
        trace.actor === actor)
    )
      start(
        "cancel",
        actor,
        request.body,
        null,
        false,
        request.roomId,
        0,
        0,
        false,
        false,
        request.mode || "direct",
        request.requestId,
      );
    setNotice(
      "전송 대기 취소 · " +
        request.requestId +
        " · 재전송 대상에서 제외했습니다. 나머지 요청은 원래 순서를 유지합니다.",
    );
  };
  const requeueCanceled = (
    canceled: CanceledChat,
    actor: number,
    editedBody: string,
  ) => {
    try {
      const existing = cancellations.find(
        (p) =>
          p.clientId === canceled.clientId &&
          p.roomId === canceled.roomId &&
          p.requestId === canceled.requestId,
      );
      if (
        !existing ||
        existing.requeuedAs ||
        requeuedItems.current.has(existing.clientId + ":" + existing.requestId)
      )
        return;
      const body = prepareRequeueBody(editedBody);
      const newRequestId = crypto.randomUUID(),
        restored = requeueCanceledChat(outbox, existing, newRequestId, body);
      if (!persistOutbox(restored.outbox)) return;
      requeuedItems.current.add(existing.clientId + ":" + existing.requestId);
      setOutbox(restored.outbox);
      setCancellations((list) =>
        list.map((p) =>
          p === existing
            ? { ...p, requeuedAs: newRequestId, requeuedBody: body }
            : p,
        ),
      );
      if (
        (!blocking && !busyNow.current) ||
        trace.kind === "cancel" ||
        trace.kind === "requeue"
      )
        start(
          "requeue",
          actor,
          body,
          null,
          false,
          existing.roomId,
          0,
          0,
          false,
          false,
          restored.request.mode || "direct",
          newRequestId,
          existing.requestId,
          existing.body,
        );
      setNotice(
        "새 요청 ID " +
          newRequestId +
          " · 수정한 내용을 대기열 맨 뒤에 추가했습니다. 기존 메시지의 내용·ID·순서는 유지합니다.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "대기열에 다시 추가하지 못했습니다.",
      );
    }
  };
  const toggleDatabase = () => {
    const next = !databaseRunning;
    setDatabaseRunning(next);
    setNotice(
      next
        ? "DB 복구 · PC에 남은 요청을 같은 requestId와 원래 방식으로 자동 재전송합니다."
        : "DB 중단 · 저장/조회와 Outbox 처리를 멈춥니다. 전송 실패 요청은 PC에서 ACK 없이 대기합니다.",
    );
  };
  const toggleWorker = () => {
    const next = !workerRunning;
    setWorkerRunning(next);
    if (
      !next &&
      trace.kind === "kafkaDeliver" &&
      running &&
      !committed.current
    ) {
      setRunning(false);
      setPlaying(false);
      setTrace((t) => ({ ...t, job: null }));
    }
    setNotice(
      next
        ? "전달 서버 복구 · Kafka 대기 이벤트를 순서대로 처리합니다."
        : "전달 서버 중단 · WebSocket 연결과 DB 저장은 유지합니다. Kafka에 이벤트가 쌓입니다.",
    );
  };
  const toggleBroker = () => {
    const next = !brokerRunning;
    setBrokerRunning(next);
    if (
      !next &&
      ["kafkaPublish", "kafkaDeliver"].includes(trace.kind) &&
      running &&
      !(trace.kind === "kafkaDeliver" && committed.current)
    ) {
      setRunning(false);
      setPlaying(false);
      setTrace((t) => ({ ...t, job: null }));
    }
    setNotice(
      next
        ? "Kafka 복구 · Outbox 미발행 이벤트를 다시 발행합니다. 전달 서버가 실행 중이면 상대에게 이어서 전달합니다."
        : "Kafka 중단 · 발행과 소비를 멈춥니다. 메시지 저장과 ACK는 유지하며 Outbox에 보관합니다.",
    );
  };
  const stats = deliveryStats(db),
    events = db.kafkaEvents || [],
    queued = events.filter((e) => !e.consumed);
  const waiting = clients.map((client) => waitingChat(db, client).length);
  const sourceLink = `${model.repo}/blob/${model.revision}/${current.file}#L${current.line}`;
  return (
    <main className="chat-project">
      <div className="project-topline">
        <a href="#projects">← 프로젝트 목록</a>
        <span>PROJECT 02 / REALTIME MESSAGE FLOW</span>
        <a href={model.repo} target="_blank" rel="noopener noreferrer">
          GitHub 소스 ↗
        </a>
      </div>
      <section className="chat-intro">
        <div>
          <span className="eyebrow">SPRING BOOT · WEBSOCKET · JPA</span>
          <h1>
            메시지는 어떻게
            <br />
            <em>상대에게 도착할까요?</em>
          </h1>
          <p>
            연결은 유지하고, 메시지는 저장하고, 같은 방에만 전달합니다.
            <br />두 참가자로 대화하며 그 사이의 흐름을 따라가 보세요.
          </p>
        </div>
        <div className="chat-intro-note">
          <span>Chat Lab.</span>
          <p>
            {mode === "kafka"
              ? "저장 ACK → Kafka → 전달 서버"
              : "보내기 → 저장 → 직접 전달 → ACK"}
          </p>
          <small>
            브라우저 시뮬레이션 · 실제 WebSocket·Kafka 서버는 GitHub 저장소에서
            실행
          </small>
          <a
            href={model.repo + "#실행"}
            target="_blank"
            rel="noopener noreferrer"
          >
            실제 서버 실행 방법 ↗
          </a>
        </div>
      </section>
      <div className="chat-workspace">
        <LabWorkbench
          hasResult={trace.run > 0}
          onFlow={() =>
            document
              .querySelector(".chat-flow-pane")
              ?.scrollIntoView({ block: "start", behavior: "smooth" })
          }
          environment={
            !databaseRunning || !brokerRunning || !workerRunning
              ? "서비스 중단 조건"
              : clients[0].roomId !== clients[1].roomId
                ? "서로 다른 대화방"
                : mode === "kafka"
                  ? "Kafka 전송 방식"
                  : undefined
          }
          onModeChange={() => {
            setUserOrigin("");
            setFastForward(false);
          }}
          busy={blocking}
          onFinish={() => {
            setFastForward(true);
            setPlaying(true);
          }}
          guide={
            <ChatJourney
              clients={clients}
              draft={drafts[0]}
              busy={blocking}
              onConnect={(index) => {
                setFastForward(false);
                setUserOrigin(
                  `${clients[index].name} ${clients[index].connected ? "대화방 나가기" : "대화방에 입장하기"}`,
                );
                connection(index);
              }}
              onDraft={(text) => {
                setFastForward(false);
                setUserOrigin("참가자 A · 메시지 입력하기");
                inputDraft(0, text);
              }}
              onSend={() => {
                setFastForward(false);
                setUserOrigin("참가자 A · 메시지 보내기");
                send(0);
              }}
            />
          }
        >
          <section className="chat-playground" aria-label="두 참가자 채팅 체험">
            <div className="chat-section-head">
              <div>
                <span className="eyebrow">TWO CLIENTS / ONE ROOM</span>
                <h2>직접 대화해 보세요.</h2>
              </div>
              <span className="chat-demo-label">브라우저 체험</span>
            </div>
            <p className="chat-boundary">
              아래 체험은 이 브라우저에서 처리합니다. 독립 서버 앱은 실제
              WebSocket으로 서로 다른 브라우저를 연결합니다.
            </p>
            <fieldset className="chat-mode-switch">
              <legend>메시지 전송 방식</legend>
              <label className={mode === "direct" ? "selected" : ""}>
                <input
                  type="radio"
                  name="delivery-mode"
                  value="direct"
                  checked={mode === "direct"}
                  disabled={blocking}
                  onChange={() => chooseMode("direct")}
                />
                <strong>현재 방식</strong>
                <small>저장 → 직접 전달</small>
              </label>
              <label className={mode === "kafka" ? "selected" : ""}>
                <input
                  type="radio"
                  name="delivery-mode"
                  value="kafka"
                  checked={mode === "kafka"}
                  disabled={blocking}
                  onChange={() => chooseMode("kafka")}
                />
                <strong>Kafka 방식</strong>
                <small>저장 → Kafka → 전달 서버</small>
              </label>
            </fieldset>
            <div className="chat-route-summary" data-mode={mode}>
              <b>{mode === "kafka" ? "KAFKA DELIVERY" : "DIRECT DELIVERY"}</b>
              <span>
                {mode === "kafka"
                  ? "PC → 수신 서버 → DB + Outbox → Kafka → 전달 서버 → 상대 PC"
                  : "PC → Spring Boot 서버 → DB 저장 → 같은 방 PC에 직접 전달"}
              </span>
              <small>
                보내기 요청의 mode: {mode} · 저장 ACK와 상대 읽음은 별도
              </small>
            </div>
            <section
              className="chat-worker-panel chat-database-panel"
              aria-label="DB 장애 체험"
            >
              <header>
                <div>
                  <strong>DB · 메시지 저장소</strong>
                  <span className={databaseRunning ? "online" : "offline"}>
                    {databaseRunning
                      ? "● 저장 가능"
                      : "○ 중단 · 저장/조회 불가"}
                  </span>
                </div>
                <button
                  className="chat-text-action"
                  disabled={blocking}
                  onClick={toggleDatabase}
                >
                  {databaseRunning ? "DB 중단" : "DB 복구"}
                </button>
              </header>
              <div className="chat-worker-metrics">
                <span>
                  PC 전송 대기{" "}
                  <b data-metric="client-pending">{outbox.length}</b>
                </span>
                <span>
                  저장된 메시지 <b data-metric="stored">{db.messages.length}</b>
                </span>
              </div>
              <p>
                {databaseRunning
                  ? "DB를 중단하고 메시지를 보내 보세요. 복구하면 같은 요청 ID로 자동 재시도합니다."
                  : "저장 실패 → ACK 없음 → PC 전송 대기. DB 복구 후 저장하고, 선택한 방식으로 전달합니다."}
              </p>
              <small>
                전송 전 대기 요청은 취소할 수 있습니다. 취소 목록에서 내용을
                수정해 다시 보내면 새 ID로 맨 뒤에 추가합니다. 나머지 요청의
                순서는 유지합니다.
              </small>
            </section>
            <section
              className="chat-worker-panel"
              aria-label="Kafka 및 전달 서버 제어"
            >
              <header className="chat-broker-control">
                <div>
                  <strong>Kafka · Broker</strong>
                  <span className={brokerRunning ? "online" : "offline"}>
                    {brokerRunning ? "● 연결 가능" : "○ 중단 · 연결 불가"}
                  </span>
                </div>
                <button
                  className="chat-text-action"
                  disabled={
                    blocking &&
                    !["kafkaPublish", "kafkaDeliver"].includes(trace.kind)
                  }
                  onClick={toggleBroker}
                >
                  {brokerRunning ? "Kafka 중단" : "Kafka 복구"}
                </button>
              </header>
              <header>
                <div>
                  <strong>전달 서버 · Consumer</strong>
                  <span className={workerRunning ? "online" : "offline"}>
                    {workerRunning
                      ? !databaseRunning
                        ? "● 실행 중 · DB 대기"
                        : brokerRunning
                          ? "● 실행 중"
                          : "● 실행 중 · Kafka 대기"
                      : "○ 중단됨"}
                  </span>
                </div>
                <button
                  className="chat-text-action"
                  disabled={blocking && trace.kind !== "kafkaDeliver"}
                  onClick={toggleWorker}
                >
                  {workerRunning ? "전달 서버 중단" : "전달 서버 복구"}
                </button>
              </header>
              <div className="chat-worker-metrics">
                <span>
                  Outbox 발행 대기 <b data-metric="outbox">{stats.outbox}</b>
                </span>
                <span>
                  Kafka 전달 대기 <b data-metric="queued">{stats.queued}</b>
                </span>
                <span>
                  처리 완료 <b data-metric="processed">{stats.processed}</b>
                </span>
              </div>
              <p>
                {!databaseRunning
                  ? "DB 중단: PC 전송 대기에 요청을 남깁니다. DB에 보관된 기존 Outbox와 이벤트도 복구 후 이어서 처리합니다."
                  : mode === "kafka"
                    ? !brokerRunning
                      ? "Kafka 중단: Outbox에 미발행 메시지가 쌓입니다. Kafka 복구 시 자동 발행하고, 전달 서버가 실행 중이면 상대에게 전달합니다."
                      : !workerRunning
                        ? "전달 서버 중단: Kafka에 발행된 이벤트가 쌓입니다. 전달 서버를 복구하면 상대에게 전달합니다."
                        : "Kafka 또는 전달 서버를 중단하고 메시지를 보내 보세요. 대기하는 위치가 다릅니다."
                    : "현재 방식은 Kafka와 Consumer를 거치지 않습니다. 둘 다 중단해도 직접 전달됩니다."}
              </p>
              {queued.length > 0 && (
                <ol className="chat-broker-queue" aria-label="대기 이벤트">
                  {queued.map((event) => (
                    <li key={event.messageId}>
                      <b>#{event.messageId}</b>
                      <span>
                        {
                          db.messages.find((m) => m.id === event.messageId)
                            ?.body
                        }
                      </span>
                      <small>
                        {event.published
                          ? "Kafka P" +
                            event.partition +
                            " · offset " +
                            event.offset
                          : brokerRunning
                            ? "Outbox · 발행 전"
                            : "Outbox · Kafka 복구 후 발행"}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
              <small>
                같은 방은 같은 파티션을 사용합니다. 오프라인 상대는 재접속 시 DB
                기록을 조회합니다.
              </small>
            </section>
            <div className="chat-clients">
              {clients.map((client, index) => (
                <section
                  key={client.id}
                  className={"chat-client client-" + index}
                  aria-label={client.name + " 채팅"}
                >
                  <header>
                    <div>
                      <span className="chat-avatar">{index ? "B" : "A"}</span>
                      <div>
                        <h3>{client.name}</h3>
                        <small
                          className={client.connected ? "online" : "offline"}
                        >
                          {client.connected ? "● 온라인" : "○ 오프라인"}
                        </small>
                      </div>
                    </div>
                    <button
                      className="chat-text-action"
                      disabled={
                        blocking || (!databaseRunning && !client.connected)
                      }
                      onClick={() => connection(index)}
                    >
                      {client.connected ? "오프라인으로 전환" : "다시 접속"}
                    </button>
                  </header>
                  <label className="chat-room-select">
                    ROOM
                    <select
                      aria-label={client.name + " 채팅방"}
                      value={client.roomId}
                      disabled={blocking || !databaseRunning}
                      onChange={(e) => roomChange(index, e.target.value)}
                    >
                      {model.rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="chat-view-control">
                    <span>
                      {client.viewOpen ? "대화창 열림" : "대화창 닫힘"} · 소켓{" "}
                      {client.connected ? "연결됨" : "연결 전"}
                    </span>
                    <button
                      className="chat-text-action"
                      disabled={blocking}
                      aria-expanded={client.viewOpen}
                      aria-controls={"chat-view-" + index}
                      onClick={() => toggleView(index)}
                    >
                      {client.viewOpen ? "대화창 닫기" : "대화창 열기"}
                    </button>
                  </div>
                  {!client.connected ? (
                    <div className="chat-offline-state" role="status">
                      <span>오프라인 · 메시지는 서버에 보관됩니다</span>
                      <strong>최근 대화 중 미수신 {waiting[index]}건</strong>
                      <small>다시 접속하면 최근 100개 대화를 받아옵니다.</small>
                    </div>
                  ) : (
                    trace.kind === "join" &&
                    trace.actor === index &&
                    step === timelines.length - 1 && (
                      <div className="chat-recovered" role="status">
                        서버 → PC · 미수신 {trace.recoveryCount}건 복구 완료
                      </div>
                    )
                  )}
                  {pendingFor(outbox, client.id, client.roomId).length > 0 && (
                    <section
                      className="chat-client-queue"
                      aria-label={client.name + " 전송 대기열"}
                    >
                      <header>
                        <strong>
                          전송 대기{" "}
                          {pendingFor(outbox, client.id, client.roomId).length}
                          건
                        </strong>
                        <small>
                          앞선 요청의 ACK 확인 후 다음 요청 전송 · 전송 전
                          대기만 취소 가능
                        </small>
                      </header>
                      <ol>
                        {pendingFor(outbox, client.id, client.roomId).map(
                          (request, position) => (
                            <li
                              key={request.requestId}
                              className="chat-outbox"
                              data-request-id={request.requestId}
                              data-queue-state={
                                trace.job?.message.requestId ===
                                  request.requestId &&
                                trace.job.message.clientId === client.id &&
                                running
                                  ? "sending"
                                  : "waiting"
                              }
                            >
                              <strong>
                                {position + 1}.{" "}
                                {trace.job?.message.requestId ===
                                  request.requestId &&
                                trace.job.message.clientId === client.id &&
                                running
                                  ? "전송 중 · ACK 확인 대기"
                                  : !databaseRunning
                                    ? "DB 복구 대기"
                                    : "순서 대기"}
                              </strong>
                              <p>{request.body}</p>
                              <code>{request.requestId}</code>
                              <small>
                                {request.mode === "kafka"
                                  ? "Kafka 방식"
                                  : "현재 방식"}{" "}
                                · 같은 ID로 재전송 · ACK 후 대기열에서 제거
                              </small>
                              {request.requeuedFrom && (
                                <small className="chat-requeue-origin">
                                  취소한 이전 ID: {request.requeuedFrom}
                                </small>
                              )}
                              <button
                                type="button"
                                className="chat-text-action chat-cancel-action"
                                aria-label={
                                  client.name +
                                  " 대기 메시지 " +
                                  (position + 1) +
                                  " 취소"
                                }
                                disabled={
                                  !canCancelChat(request, activeSend.current)
                                }
                                onClick={() => cancelRequest(request, index)}
                              >
                                {canCancelChat(request, activeSend.current)
                                  ? "취소"
                                  : "전송 결과 확인 중"}
                              </button>
                            </li>
                          ),
                        )}
                      </ol>
                    </section>
                  )}
                  {cancellations.some(
                    (p) =>
                      p.clientId === client.id && p.roomId === client.roomId,
                  ) && (
                    <details className="chat-cancelled-requests" open>
                      <summary>
                        취소한 요청{" "}
                        {
                          cancellations.filter(
                            (p) =>
                              p.clientId === client.id &&
                              p.roomId === client.roomId,
                          ).length
                        }
                        건 · 이전 ID 재전송 제외
                      </summary>
                      <ol>
                        {cancellations
                          .filter(
                            (p) =>
                              p.clientId === client.id &&
                              p.roomId === client.roomId,
                          )
                          .map((p, position) => (
                            <CanceledChatItem
                              key={p.requestId}
                              request={p}
                              clientName={client.name}
                              position={position}
                              bodyMax={model.bodyMax}
                              onResend={(body) =>
                                requeueCanceled(p, index, body)
                              }
                            />
                          ))}
                      </ol>
                    </details>
                  )}
                  {queueReceipts.some(
                    (r) =>
                      r.message.clientId === client.id &&
                      r.message.roomId === client.roomId,
                  ) && (
                    <details className="chat-queue-receipts">
                      <summary>
                        최근 대기 요청 저장 완료{" "}
                        {
                          queueReceipts.filter(
                            (r) =>
                              r.message.clientId === client.id &&
                              r.message.roomId === client.roomId,
                          ).length
                        }
                        건 · ID 확인
                      </summary>
                      <ol>
                        {queueReceipts
                          .filter(
                            (r) =>
                              r.message.clientId === client.id &&
                              r.message.roomId === client.roomId,
                          )
                          .map((r) => (
                            <li key={r.message.requestId}>
                              <b>
                                #{r.message.id} ·{" "}
                                {r.duplicate ? "기존 저장 확인" : "저장 ACK"}
                              </b>
                              <p>{r.message.body}</p>
                              <code>{r.message.requestId}</code>
                            </li>
                          ))}
                      </ol>
                    </details>
                  )}
                  {retryResults[index]?.message.roomId === client.roomId && (
                    <div className="chat-retry-result" role="status">
                      <strong>
                        재전송 ACK ·{" "}
                        {retryResults[index]!.duplicate
                          ? "기존 메시지"
                          : "저장된 메시지"}{" "}
                        #{retryResults[index]!.message.id}
                      </strong>
                      <small>
                        {retryResults[index]!.duplicate
                          ? "추가 INSERT 0건 · 추가 방송 0회"
                          : "같은 요청 ID · 저장 1건 · 중복 저장 없음"}
                      </small>
                      <code>{retryResults[index]!.message.requestId}</code>
                    </div>
                  )}
                  {!client.viewOpen && (
                    <div className="chat-closed-view" role="status">
                      <strong>대화창을 닫았습니다.</strong>
                      <p>
                        {client.connected
                          ? "온라인 · 메시지 수신 중"
                          : "오프라인 · 서버에 대화 보관 중"}
                      </p>
                      <span>
                        받은 메시지 {client.messages.length}건 · 안 읽은 메시지{" "}
                        {
                          client.messages.filter(
                            (message) =>
                              message.clientId !== client.id &&
                              !hasReadChat(db.reads || [], message, client.id),
                          ).length
                        }
                        건
                      </span>
                      <small>
                        대화창을 열어 확인하기 전까지 상대에게는 안 읽음으로
                        표시됩니다.
                      </small>
                    </div>
                  )}
                  <div id={"chat-view-" + index} hidden={!client.viewOpen}>
                    <div
                      ref={(list) => {
                        messageLists.current[index] = list;
                      }}
                      onScroll={() => setReadTick((t) => t + 1)}
                      className="chat-messages"
                      role="log"
                      aria-label={client.name + " 메시지"}
                      aria-live="polite"
                    >
                      {client.messages.length === 0 ? (
                        <div className="chat-empty">
                          {client.connected
                            ? "첫 메시지를 기다리고 있어요."
                            : "오프라인 상태입니다."}
                          <small>같은 방에 있는 참가자끼리만 대화합니다.</small>
                        </div>
                      ) : (
                        client.messages.map((message) => (
                          <article
                            key={message.id}
                            className={
                              "chat-bubble " +
                              (message.clientId === client.id ? "mine" : "")
                            }
                          >
                            <small>
                              {message.deliveryMode === "kafka"
                                ? "KAFKA · "
                                : ""}
                              {message.sender} · #{message.id} ·{" "}
                              {format(message)}
                            </small>
                            <p>{message.body}</p>
                            {message.clientId === client.id &&
                              events.some(
                                (event) =>
                                  event.messageId === message.id &&
                                  !event.consumed,
                              ) && (
                                <span className="chat-delivery-pending">
                                  저장됨 · 전달 대기
                                </span>
                              )}
                            {message.clientId === client.id &&
                              outbox.some(
                                (p) =>
                                  p.clientId === client.id &&
                                  p.requestId === message.requestId,
                              ) && (
                                <span className="chat-ack-pending">
                                  ACK 확인 대기
                                </span>
                              )}
                            {message.clientId === client.id && (
                              <span
                                className="chat-read-state"
                                data-read-state={
                                  hasReadChat(
                                    receipts[index],
                                    message,
                                    clients[1 - index].id,
                                  )
                                    ? "read"
                                    : "unread"
                                }
                              >
                                {hasReadChat(
                                  receipts[index],
                                  message,
                                  clients[1 - index].id,
                                )
                                  ? "읽음"
                                  : "안 읽음"}
                              </span>
                            )}
                          </article>
                        ))
                      )}
                      {trace.job &&
                        trace.actor === index &&
                        running &&
                        !trace.kind.startsWith("kafka") &&
                        step < timelines.length - 1 && (
                          <p className="chat-pending">
                            {trace.kind === "duplicate"
                              ? "중복 요청 확인 중…"
                              : "서버 확인을 기다리는 중…"}
                          </p>
                        )}
                    </div>
                    <div
                      className="chat-typing-status"
                      role="status"
                      aria-live="polite"
                    >
                      {visibleChatTyping(
                        typingNotices,
                        client,
                        typingClock,
                      ).map((name) => (
                        <span key={name}>
                          {name} 입력 중
                          <span className="chat-typing-dots" aria-hidden="true">
                            …
                          </span>
                        </span>
                      ))}
                    </div>
                    <label className="chat-fault-control">
                      <input
                        type="checkbox"
                        aria-label={client.name + " 전송 중 연결 끊김 체험"}
                        checked={dropNext[index]}
                        disabled={
                          !client.connected ||
                          blocking ||
                          !!pendingFor(outbox, client.id, client.roomId).length
                        }
                        onChange={(e) =>
                          setDropNext((d) =>
                            d.map((v, i) =>
                              i === index ? e.target.checked : v,
                            ),
                          )
                        }
                      />
                      <span>다음 전송: 저장 후 ACK 수신 전 연결 끊기</span>
                    </label>
                    <form
                      className="chat-compose"
                      onSubmit={(e) => {
                        e.preventDefault();
                        send(index);
                      }}
                    >
                      <textarea
                        aria-label={client.name + " 메시지 입력"}
                        placeholder={
                          client.connected
                            ? "메시지를 입력하세요"
                            : "다시 접속하면 대화를 받아옵니다"
                        }
                        maxLength={model.bodyMax}
                        rows={2}
                        required
                        disabled={!client.connected}
                        value={drafts[index]}
                        onChange={(e) => inputDraft(index, e.target.value)}
                        onBlur={() => signalTyping(index, false)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                      <button
                        aria-label={client.name + " 보내기"}
                        disabled={!client.connected || !drafts[index].trim()}
                      >
                        {pendingFor(outbox, client.id, client.roomId).length ||
                        blocking
                          ? "대기열에 보내기 ↑"
                          : mode === "kafka"
                            ? "Kafka로 보내기 ↑"
                            : "바로 보내기 ↑"}
                      </button>
                    </form>
                  </div>
                  <div className="chat-client-foot">
                    <span>{client.messages.length} messages</span>
                    <button
                      className="chat-text-action"
                      disabled={
                        blocking ||
                        !client.connected ||
                        !client.viewOpen ||
                        !!pendingFor(outbox, client.id, client.roomId).length ||
                        !lastRequests[index]
                      }
                      onClick={() => send(index, true)}
                    >
                      같은 요청 다시 보내기
                    </button>
                  </div>
                </section>
              ))}
            </div>
            <p className="chat-retry-hint">
              끊김 체험을 체크하고 보내세요. 서버 저장 후 연결이 끊기면 ‘다시
              접속’을 눌러 자동 재전송을 확인할 수 있습니다. 같은 ID를 쓰므로
              저장과 방송은 한 번만 처리합니다.
            </p>
            <p className="chat-read-hint">
              온라인이어도 대화창을 닫으면 안 읽음으로 남습니다. 대화창을 열고
              맨 아래를 확인하면 읽음 신호를 보냅니다. 서버 저장 ACK와 읽음은
              별개입니다.
            </p>
            <p role="status" className="chat-notice">
              {notice}
            </p>
          </section>
        </LabWorkbench>
        <section
          className={"chat-flow-pane " + (sourceOpen ? "source-open" : "")}
          aria-label="메시지 흐름 시각화"
        >
          <div className="chat-section-head">
            <div>
              <span className="eyebrow">LIVE MESSAGE FLOW</span>
              <h2>연결 사이에서 일어나는 일</h2>
            </div>
            <div className="chat-flow-tools">
              <button
                disabled={!running}
                onClick={() => setPlaying(!playing)}
                aria-label={playing ? "채팅 흐름 일시 정지" : "채팅 흐름 재개"}
              >
                {playing ? "Ⅱ" : "▷"}
              </button>
              <button
                onClick={() =>
                  start(
                    trace.kind,
                    trace.actor,
                    trace.body,
                    null,
                    false,
                    trace.roomId,
                    trace.recoveryCount,
                    trace.readUpTo,
                    false,
                    trace.typingActive,
                    trace.mode,
                    trace.requestId,
                    trace.previousRequestId,
                    trace.previousBody,
                  )
                }
                disabled={blocking || trace.run === 0}
              >
                다시 보기 ↻
              </button>
            </div>
          </div>
          <div className="chat-flow-status">
            <span>
              {trace.kind === "cancel" || trace.kind === "requeue"
                ? "PC 대기열"
                : ["read", "typing", "join", "disconnect"].includes(trace.kind)
                  ? "공통 WebSocket"
                  : trace.mode === "kafka"
                    ? "KAFKA"
                    : "DIRECT"}{" "}
              · {flowName[trace.kind]}
            </span>
            <strong>
              {String(step + 1).padStart(2, "0")} / {timelines.length} ·{" "}
              {trace.run === 0
                ? clients.some((c) => c.connected)
                  ? "메시지를 보내 흐름을 비교하세요"
                  : "참가자를 같은 방에 연결하세요"
                : current.label}
            </strong>
          </div>
          <UserActionTrace
            action={
              userOrigin ||
              (trace.run
                ? `${clients[trace.actor].name} · ${flowName[trace.kind]}`
                : "왼쪽에서 대화방 입장부터 시작하세요.")
            }
            request={
              trace.run ? `현재 처리: ${flowName[trace.kind]}` : undefined
            }
          />
          <ChatScene
            sourceFile={current.file}
            sourceLine={current.line}
            stepLabel={current.label}
            onShowSource={() => setSourceOpen(true)}
            onNode={(node) => {
              if (blocking) return;
              const family = node.startsWith("client-")
                ? (node === "client-a" ? 0 : 1) === trace.actor
                  ? "sender"
                  : "recipient"
                : node;
              const candidates = timelines
                .map((item, index) =>
                  item.node === family ||
                  (family === "database" &&
                    [
                      "database-return",
                      "outbox",
                      "database-unavailable",
                    ].includes(item.node))
                    ? index
                    : -1,
                )
                .filter((index) => index >= 0);
              const index =
                candidates.filter((index) => index <= step).at(-1) ??
                candidates[0];
              if (index !== undefined) {
                setStep(index);
                setPlaying(false);
                setSourceOpen(true);
              }
            }}
            cancelledCounts={clients.map(
              (c) =>
                cancellations.filter(
                  (p) => p.clientId === c.id && p.roomId === c.roomId,
                ).length,
            )}
            pendingCounts={clients.map(
              (c) => pendingFor(outbox, c.id, c.roomId).length,
            )}
            databaseRunning={databaseRunning}
            pendingCount={outbox.length}
            brokerRunning={brokerRunning}
            outboxCount={stats.outbox}
            roomId={trace.roomId}
            mode={trace.run ? trace.mode : mode}
            workerRunning={workerRunning}
            queueCount={stats.queued}
            clients={clients}
            actor={trace.actor}
            kind={trace.kind}
            step={step}
            node={current.node}
            body={trace.body}
            run={trace.run}
            playing={playing}
            running={running}
            total={timelines.length}
            waiting={waiting}
            stored={db.messages.length}
            recoveryCount={trace.recoveryCount}
            readUpTo={trace.readUpTo}
            typingActive={trace.typingActive}
          />
          <div className="chat-scene-legend">
            <span>A 왼쪽 · B 오른쪽 고정</span>
            <span>
              {trace.kind === "requeue"
                ? "내용 확인 → 새 ID 발급 → 맨 뒤에 추가"
                : trace.kind === "cancel"
                  ? "전송 대기 취소 · 서버 호출 없음"
                  : mode === "kafka"
                    ? "읽음·입력 신호는 공통 WebSocket 경로"
                    : "링 = 채팅방 · 선 = 소켓 연결"}
            </span>
          </div>
          <div className="chat-payload">
            <span>
              {step === timelines.length - 1 &&
              (trace.kind === "send" ||
                trace.kind === "databaseRetry" ||
                trace.kind === "duplicate" ||
                trace.kind === "retry")
                ? "SERVER ACK"
                : trace.kind === "requeue"
                  ? "CLIENT REQUEUE · 새 요청 ID"
                  : trace.kind === "cancel"
                    ? "CLIENT CANCEL · 서버 호출 없음"
                    : trace.kind === "databaseUnavailable"
                      ? "DB_UNAVAILABLE · ACK 없음"
                      : trace.kind.startsWith("kafka") ||
                          trace.kind === "databaseRetryKafka" ||
                          trace.kind === "databaseRetryOutbox"
                        ? "KAFKA EVENT / DELIVERY"
                        : trace.kind === "read"
                          ? "READ RECEIPT"
                          : trace.kind === "typing"
                            ? "TYPING · DB 저장 없음"
                            : trace.kind === "join"
                              ? "CONNECT / OPEN / JOIN"
                              : "JSON FRAME"}
            </span>
            <p>{trace.body}</p>
            {trace.kind === "requeue" && trace.previousBody && (
              <small className="chat-requeue-previous-body">
                수정 전: {trace.previousBody}
              </small>
            )}
            {trace.previousRequestId && (
              <small className="chat-requeue-origin">
                이전 요청 ID: {trace.previousRequestId} → 새 요청 ID:{" "}
                {trace.requestId}
              </small>
            )}
            {trace.requestId && (
              <small>
                mode: {trace.mode} · requestId: {trace.requestId} · room:{" "}
                {trace.roomId}
              </small>
            )}
          </div>
          <ol className="chat-steps">
            {timelines.map((item, index) => (
              <li
                key={index}
                className={
                  step === index ? "active" : index < step ? "done" : ""
                }
              >
                <button
                  onClick={() => {
                    if (blocking) return;
                    setStep(index);
                    setPlaying(false);
                  }}
                  disabled={blocking}
                  aria-current={step === index ? "step" : undefined}
                >
                  <span>
                    {index < step ? "✓" : String(index + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
          <div className="chat-db-count">
            <span>chat_messages</span>
            <strong>{db.messages.length} rows</strong>
            <small>
              {trace.kind === "requeue"
                ? "새 ID로 맨 뒤에 추가 · 처리 차례가 되면 서버로 전송합니다."
                : trace.kind === "cancel"
                  ? "취소한 요청은 서버로 전송하지 않습니다."
                  : !databaseRunning
                    ? "DB 중단 · 표시된 건수는 마지막 저장 상태"
                    : trace.kind.startsWith("kafka")
                      ? "Outbox와 대화는 같은 트랜잭션으로 저장합니다."
                      : trace.kind === "typing"
                        ? "입력 신호는 DB에 저장하지 않습니다."
                        : trace.kind === "retry"
                          ? "기존 ID 반환 · INSERT / 방송 생략"
                          : "UNIQUE (client_id, request_id)"}
            </small>
          </div>
          <button
            className="chat-source-toggle"
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            소스 흐름 {sourceOpen ? "닫기 −" : "열기 +"}
            <span>{model.revision.slice(0, 7)}</span>
          </button>
          {sourceOpen && (
            <div className="chat-source-panel">
              <p>
                현재 단계의 실제 소스 · 처리 순서 해석이며 서버 로그 수집은
                아닙니다.
              </p>
              <h3>{current.label}</h3>
              <div className="chat-code">
                {current.lines.map((line, index) => {
                  const at = line.indexOf(current.highlight);
                  return (
                    <div key={index} className={at >= 0 ? "executing" : ""}>
                      <span>{current.line + index}</span>
                      <code>
                        {at >= 0 ? (
                          <>
                            {line.slice(0, at)}
                            <mark>{current.highlight}</mark>
                            {line.slice(at + current.highlight.length)}
                          </>
                        ) : (
                          line
                        )}
                      </code>
                    </div>
                  );
                })}
              </div>
              <a href={sourceLink} target="_blank" rel="noopener noreferrer">
                {current.file.split("/").at(-1)}:{current.line} · 원본 소스 ↗
              </a>
            </div>
          )}
        </section>
      </div>
      <div className="chat-design-notes">
        <article>
          <span>01 / CONNECTION</span>
          <h3>연결은 한 번, 대화는 계속.</h3>
          <p>
            HTTP 업그레이드 후 연결을 유지합니다. 메시지마다 새 요청을 만드는
            대신 같은 소켓으로 프레임을 주고받습니다.
          </p>
        </article>
        <article>
          <span>02 / COMMIT FIRST</span>
          <h3>저장한 메시지만 전달합니다.</h3>
          <p>
            서버가 메시지 ID를 발급하고 트랜잭션이 끝나면 같은 방으로
            방송합니다. 화면에 보이는 ID는 저장된 한 메시지를 가리킵니다.
          </p>
        </article>
        <article>
          <span>03 / REQUEST ID</span>
          <h3>다시 보내도 한 번만 남깁니다.</h3>
          <p>
            DB 저장 실패 시 PC에 요청을 남깁니다. 복구 후 같은 requestId로
            재시도하고, 이미 저장된 요청이면 INSERT와 방송을 생략합니다.
            발신자는 기존 메시지의 ACK로 결과를 확인합니다.
          </p>
        </article>
      </div>
    </main>
  );
}

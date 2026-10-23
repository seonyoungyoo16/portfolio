import { useEffect, useState } from "react";
import model from "../generated/payment-source.json";
import {
  emptyPayment,
  executePayment,
  type Action,
  type Input,
  type Result,
  type Fault,
} from "../payment-demo";
import PaymentScene from "./PaymentScene";
import LabWorkbench, { UserActionTrace } from "./LabWorkbench";
import { PaymentJourney } from "./UserJourneys";
import "../payment.css";
const sources = model.sources as Record<
  string,
  { file: string; line: number; lines: string[] }
>;
const href = (file: string, line?: number) =>
  `${model.repo}/blob/${model.revision}/${file}${line ? "#L" + line : ""}`;
const won = (n: number) => n.toLocaleString("ko-KR") + "원";
export default function PaymentProject() {
  const [state, setState] = useState(emptyPayment),
    [result, setResult] = useState<Result | null>(null),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [runVersion, setRunVersion] = useState(0),
    [tab, setTab] = useState("service"),
    [amount, setAmount] = useState("3000"),
    [drop, setDrop] = useState(false),
    [sourceOpen, setSourceOpen] = useState(true),
    [userAction, setUserAction] = useState("");
  const current = result?.frames[step],
    view = current?.snapshot || state,
    busy = playing,
    source = sources[current?.source || "PaymentService.createOrder"];
  useEffect(() => {
    if (!playing || !result) return;
    const timer = setTimeout(() => {
      if (step < result.frames.length - 1) setStep(step + 1);
      else setPlaying(false);
    }, 650);
    return () => clearTimeout(timer);
  }, [playing, result, step]);
  const run = (action: Action, input: Input = {}, label?: string) => {
    setUserAction(
      label ||
        (
          {
            order: "상품 주문하기",
            authenticate: "결제 수단 인증하기",
            confirm: "결제하기",
            cancel: "결제 취소하기",
          } as Record<string, string>
        )[action] ||
        "결제 조건 실험하기",
    );
    const next = executePayment(state, action, { dropBrowser: drop, ...input });
    setState(next.state);
    setResult(next);
    setRunVersion((v) => v + 1);
    setStep(0);
    setPlaying(true);
  };
  const reset = () => {
    setState(emptyPayment());
    setResult(null);
    setUserAction("");
    setRunVersion((v) => v + 1);
    setStep(0);
    setPlaying(false);
    setAmount("3000");
    setDrop(false);
  };
  const sourceKeys = Object.keys(sources);
  const selectStep = (index: number) => {
    setPlaying(false);
    setStep(index);
    setSourceOpen(true);
  };
  return (
    <main className="payment-project">
      <a className="back-link" href="#projects">
        ← 프로젝트 목록
      </a>
      <section className="payment-intro">
        <div>
          <span className="eyebrow">05 / PAYMENT CONSISTENCY</span>
          <h1>
            한 번의 결제를,
            <br />
            <em>끝까지 확인합니다.</em>
          </h1>
          <p>
            중복 요청부터 부분 취소와 장애 복구까지.
            <br />
            상점과 결제사의 서로 다른 커밋을 따라갑니다.
          </p>
        </div>
        <aside className="payment-evidence">
          <span>독립 Local PSP 실제 검증 기록</span>
          <strong>
            {model.verification.backend} SQL / API +{" "}
            {model.verification.browser} Browser
          </strong>
          <p>
            상점 A·B / PostgreSQL 2개 / Redis
            <br />
            승인·취소·응답 유실·프로세스 종료 검증
          </p>
          <a
            href={href("docs/verification/browser.json")}
            target="_blank"
            rel="noopener noreferrer"
          >
            64개 브라우저 검증 기록 ↗
          </a>
          <a href={href("README.md")} target="_blank" rel="noopener noreferrer">
            실제 백엔드 실행 방법과 전체 소스 ↗
          </a>
          <small>
            commit {model.revision.slice(0, 7)} · {model.verification.anchors}{" "}
            source anchors
          </small>
        </aside>
      </section>
      <div className="payment-boundary">
        <b>브라우저 시뮬레이션</b>
        <p>
          이 공개 화면은 설계 흐름을 재현합니다. 실제 백엔드·독립 PG 검증은 위의
          고정 커밋에 별도로 기록했습니다. 카드 정보나 실제 금전은 사용하지
          않습니다.
        </p>
        <a
          href="https://localhost:8480"
          target="_blank"
          rel="noopener noreferrer"
        >
          로컬 실험실 열기 ↗
        </a>
      </div>
      <nav className="payment-tabs" aria-label="결제 체험 패널">
        {[
          ["service", "결제·취소"],
          ["flow", "흐름·소스"],
          ["data", "거래 비교"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="payment-workspace">
        <section
          className={
            "payment-panel payment-service " +
            (tab === "service" ? "mobile-active" : "")
          }
          aria-label="결제 서비스 체험"
        >
          <LabWorkbench
            hasResult={!!result}
            onFlow={() => {
              setTab("flow");
              requestAnimationFrame(() =>
                document
                  .querySelector(".payment-flow")
                  ?.scrollIntoView({ block: "start", behavior: "smooth" }),
              );
            }}
            environment={
              state.fault !== "none" || drop
                ? "결제 연결·응답 장애 조건"
                : state.user !== "A"
                  ? "다른 고객 B"
                  : undefined
            }
            busy={playing}
            onFinish={() => {
              setPlaying(false);
              setStep((result?.frames.length || 1) - 1);
            }}
            guide={
              <PaymentJourney
                state={state}
                busy={playing}
                result={result?.frames.at(-1)?.message}
                lastAction={userAction}
                status={result?.status}
                onReset={reset}
                onRun={(action, input, label) => run(action, input, label)}
              />
            }
          >
            <div className="payment-toolbar">
              <button onClick={reset}>실험 초기화 ↺</button>
              <label>
                실습 사용자
                <select
                  aria-label="결제 실습 사용자"
                  value={state.user}
                  disabled={busy}
                  onChange={(e) => {
                    setState({ ...state, user: e.target.value as "A" | "B" });
                    setResult(null);
                  }}
                >
                  <option>A</option>
                  <option>B</option>
                </select>
              </label>
              <label>
                장애 주입
                <select
                  aria-label="결제 장애 주입"
                  value={state.fault}
                  disabled={busy}
                  onChange={(e) => {
                    setState({ ...state, fault: e.target.value as Fault });
                    setResult(null);
                  }}
                >
                  <option value="none">정상</option>
                  <option value="redis">Redis 연결 실패</option>
                  <option value="pg-connect">PG 도착 전 연결 실패</option>
                  <option value="pg-response">PG 커밋 후 응답 유실</option>
                  <option value="db-apply">PG 성공 후 상점 DB 반영 실패</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={drop}
                  onChange={(e) => setDrop(e.target.checked)}
                />
                상점 응답 유실
              </label>
              <button
                disabled={busy}
                onClick={() => run("tick", { seconds: 30 })}
              >
                실습 시계 +30초
              </button>
              <small>관찰·재생은 시간을 연장하지 않습니다.</small>
            </div>
            <div className="payment-panel-head">
              <h2>주문과 결제</h2>
              <small>USER {state.user}</small>
            </div>
            <p className="payment-subtle">
              서버 상품 10,000원 · 같은 구매 의도는 주문 하나
            </p>
            <div className="payment-actions">
              <button disabled={busy} onClick={() => run("order")}>
                주문 생성
              </button>
              <button disabled={busy} onClick={() => run("authenticate")}>
                PG 인증
              </button>
            </div>
            <div className="payment-order">
              <b data-testid="payment-order-state">{view.order}</b>
              <span>
                {won(view.amount)} · 실습 기한{" "}
                {Math.max(0, view.expires - view.now)}초
              </span>
              <small>
                주문 수락 {view.accepted ? "확인됨" : "미확정"} · 인증{" "}
                {view.authorized ? "확인됨" : "미확정"}
              </small>
            </div>
            <div className="payment-actions">
              <button
                className="payment-primary"
                disabled={busy}
                onClick={() => run("confirm")}
              >
                결제 확정 →
              </button>
              <button
                disabled={busy}
                onClick={() => run("confirm", { key: "another-client-key" })}
              >
                새 키로 같은 승인
              </button>
              <button
                disabled={busy}
                onClick={() => run("confirm", { requests: 24 })}
              >
                같은 승인 24개 동시 요청
              </button>
              <button
                disabled={busy}
                onClick={() => run("confirm", { amount: 1 })}
              >
                승인 금액 변조
              </button>
              <button disabled={busy} onClick={() => run("close")}>
                주문 종료 요청
              </button>
            </div>
            <p className="payment-subtle">
              PG 인증과 승인 접수를 구분합니다. 202는 처리 접수이며 PG 확정은
              별도입니다.
            </p>
            <hr />
            <h2>전액·부분 취소</h2>
            <label>
              부분 취소 금액
              <input
                aria-label="결제 부분 취소 금액"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <div className="payment-actions">
              <button
                disabled={busy}
                onClick={() => run("cancel", { amount: Number(amount) })}
              >
                부분 취소 요청
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run("cancel", { amount: state.captured - state.canceled })
                }
              >
                남은 금액 전액 취소
              </button>
              <button disabled={busy} onClick={() => run("retry-cancel")}>
                같은 취소 재전송
              </button>
              <button
                disabled={busy}
                onClick={() => run("stale-cancel", { amount: Number(amount) })}
              >
                낡은 버전 취소
              </button>
            </div>
            <div className="payment-balance">
              <b data-testid="payment-balance">
                A {won(view.captured)} · C {won(view.canceled)}
              </b>
              <span data-testid="payment-reserved">
                미해결 예약 R {won(view.reserved)}
              </span>
              <span>실제 잔액 A−C {won(view.captured - view.canceled)}</span>
              <small>
                동기화 {view.sync} · version {view.version}
              </small>
            </div>
            <div
              className="payment-result"
              data-testid="payment-result"
              role="status"
            >
              {busy
                ? "처리 단계 재생 중"
                : result
                  ? `${result.status || "연결 유실"} · ${result.code}`
                  : "요청 대기"}
            </div>
            <p className="payment-subtle">
              결과 불명에서는 예약을 유지합니다. 현재 상태와 명시한 버전을
              확인한 뒤 다음 취소를 접수합니다.
            </p>
          </LabWorkbench>
        </section>
        <section
          className={
            "payment-panel payment-flow " +
            (tab === "flow" ? "mobile-active" : "")
          }
          aria-label="결제 흐름과 실제 소스"
        >
          <div className="payment-panel-head">
            <h2>커밋의 경계를 따라가기</h2>
            <small>
              {result ? `${step + 1} / ${result.frames.length}` : "READY"}
            </small>
          </div>
          <div className="payment-actions">
            <button
              disabled={!result}
              onClick={() => {
                if (!playing && result && step === result.frames.length - 1)
                  setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "일시 정지 Ⅱ" : "재생 ▷"}
            </button>
            <button
              disabled={!result || step === result.frames.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep(step + 1);
              }}
            >
              다음 단계 →
            </button>
            <button
              disabled={!result || step === result.frames.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep(result!.frames.length - 1);
              }}
            >
              마지막으로 ⇥
            </button>
          </div>
          <UserActionTrace action={result ? userAction : ""} />
          <PaymentScene
            view={view}
            frames={result?.frames || []}
            step={step}
            playing={playing}
            run={runVersion}
            onSelectStep={selectStep}
            onShowSource={() => setSourceOpen(true)}
          >
            <div className="payment-current">
              <b>
                {current?.message ||
                  "주문을 만들고 인증·승인을 나누어 실행하세요."}
              </b>
              <small>{current?.node || "DESIGN FLOW"}</small>
            </div>
          </PaymentScene>
          <ol className="payment-steps">
            {result?.frames.map((f, i) => (
              <li key={i}>
                <button
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => selectStep(i)}
                >
                  {i + 1} · {f.message}
                  <small>{f.node}</small>
                </button>
              </li>
            ))}
          </ol>
          <button
            className="payment-source-toggle"
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            현재 단계 실제 소스 {sourceOpen ? "닫기" : "열기"}
          </button>
          {sourceOpen && source && (
            <div className="payment-source">
              <a
                href={href(source.file, source.line)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.file}:{source.line} ↗
              </a>
              <pre>
                {source.lines.map((line, i) => (
                  <div key={i}>
                    <span>{source.line + i}</span>
                    <code>{line || " "}</code>
                  </div>
                ))}
              </pre>
              <small>
                commit {model.revision.slice(0, 7)} · SHA-256{" "}
                {(model.hashes as Record<string, string>)[source.file]}
              </small>
            </div>
          )}
        </section>
        <aside
          className={
            "payment-panel payment-data " +
            (tab === "data" ? "mobile-active" : "")
          }
          aria-label="상점과 PG 거래 비교"
        >
          <h2>두 저장소의 관찰</h2>
          <p className="payment-subtle">
            선택한 단계의 스냅샷입니다. PG 커밋과 상점 반영 사이의 차이를
            확인하세요.
          </p>
          <div className="payment-counts">
            <div>
              상점 원장
              <strong data-testid="payment-ledger-count">
                {view.ledger.length}
              </strong>
            </div>
            <div>
              독립 PG 거래
              <strong data-testid="payment-pg-count">
                {view.transactions.length}
              </strong>
            </div>
            <div>
              PG 변경 전송<strong>{view.pgCalls}</strong>
            </div>
            <div>
              상점 outbox<strong>{view.outbox}</strong>
            </div>
          </div>
          <div className="payment-comparison">
            <b>MERCHANT DB</b>
            <span>
              승인 {won(view.captured)} / 취소 {won(view.canceled)}
            </span>
            <b>PSP DB</b>
            <span>
              승인 {won(view.pgCaptured)} / 취소 {won(view.pgCanceled)}
            </span>
          </div>
          <h3>불명 결과 복구</h3>
          <div className="payment-actions">
            <button disabled={busy} onClick={() => run("recover")}>
              조회·복구 실행
            </button>
            <button disabled={busy} onClick={() => run("webhook")}>
              웹훅 재전달
            </button>
            <button
              disabled={busy}
              onClick={() => run("external-cancel", { amount: Number(amount) })}
            >
              PG 외부 취소
            </button>
            <button disabled={busy} onClick={() => run("project")}>
              영수증 소비·재생
            </button>
          </div>
          <p className="payment-subtle">
            장애를 ‘정상’으로 바꾼 뒤 복구하세요. 외부 취소 사실을 자기 취소
            성공으로 연결하지 않습니다.
          </p>
          <details open>
            <summary>상점 작업과 예약</summary>
            <pre>
              {JSON.stringify(
                {
                  operations: view.ops,
                  reserved: view.reserved,
                  sync: view.sync,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <details>
            <summary>상점 원장</summary>
            <pre>{JSON.stringify(view.ledger, null, 2)}</pre>
          </details>
          <details>
            <summary>독립 PG 거래</summary>
            <pre>{JSON.stringify(view.transactions, null, 2)}</pre>
          </details>
          <details>
            <summary>inbox · 영수증</summary>
            <pre>
              {JSON.stringify(
                { inbox: view.inbox, receipt: view.receipt },
                null,
                2,
              )}
            </pre>
          </details>
          <p className="payment-subtle">
            PG 취소 확정과 카드사의 최종 청구 변경·환급 완료는 서로 다른
            단계입니다.
          </p>
        </aside>
      </div>
      <section className="payment-reading">
        <h2>직접 확인할 설계</h2>
        <div>
          <article>
            <b>멱등성의 세 경계</b>
            <p>
              구매 의도 → 상점 canonical 작업 → PG 멱등 키. 새 클라이언트 키로
              같은 승인을 우회하지 않습니다.
            </p>
          </article>
          <article>
            <b>취소를 먼저 예약</b>
            <p>
              확정 취소 C와 불명 예약 R을 구분합니다. 전액·부분 취소는 잔액과
              결제 버전을 잠금 안에서 판정합니다.
            </p>
          </article>
          <article>
            <b>거래 사실을 보존</b>
            <p>
              조회·웹훅·동기 응답이 경합해도 PG 거래 ID는 원장 한 건입니다. 추가
              승인과 늦은 승인은 별도 보상합니다.
            </p>
          </article>
        </div>
        <label>
          실제 소스 찾아보기
          <select
            aria-label="결제 실제 소스 선택"
            value={current?.source || "PaymentService.createOrder"}
            onChange={(e) => {
              const next: Result = {
                state,
                frames: [
                  {
                    node: "Server",
                    message: "고정 커밋 실제 소스 살펴보기",
                    source: e.target.value,
                    snapshot: state,
                  },
                ],
                status: 200,
                code: "SOURCE_VIEW",
              };
              setResult(next);
              setRunVersion((v) => v + 1);
              setStep(0);
              setPlaying(false);
              setSourceOpen(true);
            }}
          >
            {sourceKeys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </section>
    </main>
  );
}

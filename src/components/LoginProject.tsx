import { useEffect, useState } from "react";
import {
  emptyLogin,
  executeLogin,
  fixturePassword,
  policy,
  redisTTL,
  sessionOf,
  type Action,
  type Device,
  type LoginState,
  type Result,
} from "../login-demo";
import model from "../generated/login-source.json";
import AuthScene from "./AuthScene";
import { loginSceneState } from "../auth-scene";
import "../login.css";

const duration = (seconds: number) =>
  seconds >= 86400
    ? `${(seconds / 86400).toFixed(1).replace(".0", "")}일`
    : seconds >= 3600
      ? `${(seconds / 3600).toFixed(1).replace(".0", "")}시간`
      : seconds >= 60
        ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
        : `${seconds}초`;
const clock = (seconds: number) =>
  `D+${Math.floor(seconds / 86400)} ${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const sourceUrl = (file: string, line?: number) =>
  `${model.repo}/blob/${model.revision}/${file}${line ? "#L" + line : ""}`;
function DataPanel({ state, device }: { state: LoginState; device: Device }) {
  const browser = state.browsers[device],
    session = sessionOf(state, device);
  return (
    <section className="login-panel login-data" aria-label="인증 데이터 관찰">
      <div className="login-panel-head">
        <h2>데이터가 말하는 인증 상태</h2>
        <span>SIMULATED DATA</span>
      </div>
      <p className="login-subtle">
        선택한 처리 단계의 스냅샷입니다. 조회는 유휴 시간을 연장하지 않습니다.
      </p>
      <dl className="login-facts">
        <div>
          <dt>기기 {device ? "B" : "A"} 세션</dt>
          <dd>{browser.sid || "없음"}</dd>
        </div>
        <div>
          <dt>Redis 잔여 TTL</dt>
          <dd data-testid="login-ttl">
            {session ? duration(redisTTL(state, session)) : "—"}
          </dd>
        </div>
        <div>
          <dt>세션 절대 종료</dt>
          <dd>{session ? clock(session.absolute) : "—"}</dd>
        </div>
        <div>
          <dt>유지 토큰 세대</dt>
          <dd>
            {browser.remember
              ? "generation " + browser.remember.generation
              : "없음"}
          </dd>
        </div>
        <div>
          <dt>사용자 auth_version</dt>
          <dd>{state.version}</dd>
        </div>
        <div>
          <dt>Redis 정리 대기</dt>
          <dd>{state.cleanup.length}건</dd>
        </div>
      </dl>
      <div className="login-table-wrap">
        <table>
          <caption>auth_sessions · DB 발급 기록</caption>
          <thead>
            <tr>
              <th>세션</th>
              <th>상태</th>
              <th>Redis TTL</th>
            </tr>
          </thead>
          <tbody>
            {state.sessions.length ? (
              state.sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    <span className={"login-state " + s.state.toLowerCase()}>
                      {s.state}
                    </span>
                  </td>
                  <td>
                    {s.redis && redisTTL(state, s) > 0
                      ? redisTTL(state, s) + "s"
                      : "없음"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>발급 기록이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="login-table-wrap">
        <table>
          <caption>device_auth_grants · 기기 인증</caption>
          <thead>
            <tr>
              <th>기기 / ID</th>
              <th>권한</th>
              <th>고정 종료</th>
            </tr>
          </thead>
          <tbody>
            {state.grants.length ? (
              state.grants.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.device ? "B" : "A"} / {g.id}
                  </td>
                  <td>{g.revoked ? "폐기" : g.remember ? "유지" : "일반"}</td>
                  <td>{clock(g.end)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>인증 묶음이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="login-subtle">
        표의 SID·세대는 설명용 값입니다. 실제 DB는 세션 식별자와 유지 자격정보의
        해시를 저장합니다.
      </p>
    </section>
  );
}
export default function LoginProject() {
  const [state, setState] = useState(emptyLogin),
    [device, setDevice] = useState<Device>(0),
    [server, setServer] = useState("A");
  const [remember, setRemember] = useState(true),
    [password, setPassword] = useState(fixturePassword),
    [loginId, setLoginId] = useState("demo@lab.test");
  const [result, setResult] = useState<Result | null>(null),
    [step, setStep] = useState(0),
    [runVersion, setRunVersion] = useState(0),
    [playing, setPlaying] = useState(false),
    [sourceOpen, setSourceOpen] = useState(true),
    [flowServer, setFlowServer] = useState("A");
  const [tab, setTab] = useState("service");
  const frames = result?.frames || [],
    current = frames[step],
    view = current?.state || state,
    busy = !!result && step < frames.length - 1;
  const source = current
    ? model.sources[current.source]
    : model.sources["AuthService.password"];
  const selected = view.browsers[device];
  const run = (action: Action) => {
    if (busy) return;
    const next = executeLogin(state, { ...action, device });
    setFlowServer(server);
    setState(next.state);
    setResult(next);
    setRunVersion((v) => v + 1);
    setStep(0);
    setPlaying(true);
  };
  useEffect(() => {
    if (!playing || !result) return;
    const timer = setTimeout(() => {
      if (step < frames.length - 1) setStep(step + 1);
      else setPlaying(false);
    }, 850);
    return () => clearTimeout(timer);
  }, [playing, result, step, frames.length]);
  const control = (
    kind: Action["kind"],
    label: string,
    extra: Partial<Action> = {},
  ) => (
    <button disabled={busy} onClick={() => run({ kind, ...extra })}>
      {label}
    </button>
  );
  const reset = () => {
    setState(emptyLogin());
    setResult(null);
    setRunVersion((v) => v + 1);
    setStep(0);
    setPlaying(false);
    setDevice(0);
    setServer("A");
  };
  return (
    <main className="login-project">
      <div className="project-topline">
        <a href="#projects">← 프로젝트 목록</a>
        <span>PROJECT 03 / AUTHENTICATION LIFECYCLE</span>
        <a href={model.repo} target="_blank" rel="noopener noreferrer">
          독립 프로젝트 소스 ↗
        </a>
      </div>
      <section className="login-intro">
        <div>
          <span className="eyebrow">
            SPRING BOOT · SPRING SECURITY · REDIS · POSTGRESQL
          </span>
          <h1>
            로그인이 끝난 뒤에도,
            <br />
            <em>인증은 계속 확인됩니다.</em>
          </h1>
          <p>
            세션은 어디에 남고, 로그인 유지는 언제 끝날까요?
            <br />두 기기와 두 서버로 발급·복원·폐기 과정을 따라가 보세요.
          </p>
        </div>
        <aside className="login-evidence">
          <span>실제 백엔드 검증</span>
          <strong>
            {model.verification.backend} API <i>+</i>{" "}
            {model.verification.browser} 브라우저
          </strong>
          <p>
            독립 실험실에서 실제 Spring Boot A·B,
            <br />
            Redis·PostgreSQL로 확인한 결과입니다.
          </p>
          <a
            href={sourceUrl("docs/verification/RESULTS.md")}
            target="_blank"
            rel="noopener noreferrer"
          >
            검증 시나리오와 결과 ↗
          </a>
          <small>검증일 2026.10.18 · source {model.revision.slice(0, 7)}</small>
        </aside>
      </section>
      <div className="login-boundary">
        <span>브라우저 시뮬레이션</span>
        <p>
          이 Pages 체험은 실제 소스의 처리 규칙을 브라우저에서 재현합니다.{" "}
          <a
            href={sourceUrl("README.md")}
            target="_blank"
            rel="noopener noreferrer"
          >
            실제 백엔드 실행 방법 ↗
          </a>
          으로 독립 실험실을 열면 실제 요청·Redis TTL·DB 기록과 소스를 함께 볼
          수 있습니다.
        </p>
      </div>
      <div
        className="login-mobile-tabs"
        role="tablist"
        aria-label="로그인 체험 패널"
      >
        {[
          ["service", "체험"],
          ["flow", "흐름·소스"],
          ["data", "데이터"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            aria-controls={"login-" + id}
            id={"login-tab-" + id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="login-workspace">
        <div
          className={
            "login-service-column " +
            (tab === "service" ? "login-mobile-active" : "")
          }
          id="login-service"
        >
          <section
            className="login-panel login-service"
            aria-label="로그인 체험"
          >
            <div className="login-panel-head">
              <h2>직접 요청해 보세요.</h2>
              <button onClick={reset} className="login-text-button">
                실험 초기화 ↺
              </button>
            </div>
            <div className="login-selectors">
              <fieldset disabled={busy}>
                <legend>독립 브라우저 기기</legend>
                {([0, 1] as const).map((d) => (
                  <button
                    key={d}
                    aria-pressed={device === d}
                    onClick={() => setDevice(d)}
                  >
                    기기 {d ? "B" : "A"}
                  </button>
                ))}
              </fieldset>
              <fieldset disabled={busy}>
                <legend>요청 처리 서버</legend>
                {["A", "B"].map((s) => (
                  <button
                    key={s}
                    aria-pressed={server === s}
                    onClick={() => setServer(s)}
                  >
                    서버 {s}
                  </button>
                ))}
              </fieldset>
            </div>
            <div
              className={
                "login-account " +
                (selected.authenticated && view.redisUp && view.dbUp
                  ? "authenticated"
                  : "")
              }
            >
              <span>
                {!view.redisUp || !view.dbUp
                  ? "○ 인증 상태 확인 불가"
                  : selected.authenticated
                    ? "● 로그인됨"
                    : "○ 인증 확인 필요"}
              </span>
              <strong>
                {selected.authenticated
                  ? "demo@lab.test"
                  : "기기 " + (device ? "B" : "A")}
              </strong>
              <small>
                서버 {server} · {selected.sid || "세션 없음"} · 유지{" "}
                {selected.remember ? "있음" : "없음"}
              </small>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run({
                  kind: "login",
                  remember,
                  password: loginId === "demo@lab.test" ? password : "invalid",
                });
              }}
            >
              <label>
                아이디
                <input
                  aria-label="로그인 아이디"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <label>
                비밀번호
                <input
                  aria-label="로그인 비밀번호"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <label className="login-checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  disabled={busy}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                로그인 유지 · 고정 14일
              </label>
              <button type="submit" className="login-primary" disabled={busy}>
                로그인하고 흐름 보기 →
              </button>
            </form>
            <p className="login-fixture">
              공개 실습 계정: demo@lab.test / Lab!2026Pass
            </p>
            <div className="login-actions">
              {control("me", "보호 요청")}
              {control("close", "세션 쿠키 없이 재방문")}
              {control("restore", "로그인 복원")}
              {control("logout", "현재 기기 로그아웃")}
            </div>
            <details className="login-experiments" open>
              <summary>동시성 · 폐기 · 장애 실험</summary>
              <div className="login-actions">
                {control("concurrent", "동시에 두 탭 복원")}
                {control("replay", "이전 토큰 재사용")}
                {control("reauth", "비밀번호 재확인", { password })}
                {control("logoutAll", "전체 기기 로그아웃")}
                {control("deferred", "폐기 후 Redis 정리 실패")}
                {control("cleanup", "정리 재시도")}
                {control("stale", "폐기된 Redis 키 복구")}
                {control("partial", "ACTIVE 직전 중단", { password, remember })}
                {control("lost", "유지 복원 응답 유실")}
              </div>
            </details>
            <div className="login-network">
              <span>저장소 연결</span>
              <button
                disabled={busy}
                aria-pressed={!state.redisUp}
                onClick={() => run({ kind: "redis" })}
              >
                Redis {state.redisUp ? "정상 → 차단" : "차단 → 복구"}
              </button>
              <button
                disabled={busy}
                aria-pressed={!state.dbUp}
                onClick={() => run({ kind: "db" })}
              >
                DB {state.dbUp ? "정상 → 차단" : "차단 → 복구"}
              </button>
            </div>
          </section>
          <section className="login-panel login-clock">
            <div className="login-panel-head">
              <h2>만료 시간 실험</h2>
              <span>가상 시계</span>
            </div>
            <strong>{clock(view.now)}</strong>
            <div className="login-actions">
              {[
                [60, "+1분"],
                [policy.idle, "+30분"],
                [policy.absolute, "+8시간"],
                [policy.remember, "+14일"],
              ].map(([seconds, label]) =>
                control("advance", String(label), { seconds: Number(seconds) }),
              )}
            </div>
            <p className="login-subtle">
              유휴 30분 · 절대 8시간 · 유지 14일. 보호 요청은 유휴 시간만
              갱신하며, 화면 관찰은 만료를 연장하지 않습니다.
            </p>
          </section>
        </div>
        <section
          className={
            "login-panel login-flow " +
            (tab === "flow" ? "login-mobile-active" : "")
          }
          id="login-flow"
          aria-label="로그인 처리 흐름"
        >
          <div className="login-panel-head">
            <div>
              <span className="eyebrow">REQUEST → STATE → SOURCE</span>
              <h2>인증 상태가 바뀌는 순간</h2>
            </div>
            <span className="login-step-count">
              {result ? `${step + 1} / ${frames.length}` : "READY"}
            </span>
          </div>
          <div className="login-playback">
            <button
              disabled={!result}
              aria-label={playing ? "흐름 일시 정지" : "흐름 재생"}
              onClick={() => {
                if (step === frames.length - 1) setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Ⅱ 일시 정지" : "▷ 재생"}
            </button>
            <button
              disabled={!result || step === frames.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep(Math.min(step + 1, frames.length - 1));
              }}
            >
              다음 단계 →
            </button>
            <button
              disabled={!result || step === frames.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep(frames.length - 1);
              }}
            >
              마지막으로 ⇥
            </button>
          </div>
          <div className="login-current">
            <span>{result?.request || "로그인 요청으로 시작하세요."}</span>
            <strong>
              {current?.title || "발급부터 만료, 복원과 폐기까지."}
            </strong>
            <p>
              {current?.detail ||
                "체험 화면의 요청을 실행하면 처리 단계·데이터·실제 소스가 함께 바뀝니다."}
            </p>
          </div>
          <AuthScene
            data={loginSceneState(view, device, flowServer, frames, step)}
            frames={frames}
            step={step}
            run={runVersion}
            playing={playing}
            onSelectStep={(index) => {
              setStep(index);
              setPlaying(false);
              setSourceOpen(true);
            }}
          />
          <ol className="login-steps">
            {frames.map((f, i) => (
              <li key={i}>
                <button
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => {
                    setPlaying(false);
                    setStep(i);
                  }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {f.title}
                  <small>
                    {f.node === "database"
                      ? "DB"
                      : f.node === "server"
                        ? "SERVER " + flowServer
                        : f.node.toUpperCase()}
                  </small>
                </button>
              </li>
            ))}
          </ol>
          <div
            role="status"
            className={
              "login-result " + (result && result.status >= 400 ? "error" : "")
            }
            data-testid="login-result"
          >
            <span>
              {busy
                ? "처리 단계 재생 중"
                : result
                  ? `${result.status === 0 ? "응답 유실" : result.status} · ${result.code}`
                  : "요청 대기"}
            </span>
            <p>
              {busy
                ? "다음 단계 또는 마지막으로 버튼으로 이동할 수 있습니다."
                : result?.message ||
                  "왼쪽의 공개 실습 계정으로 로그인해 보세요."}
            </p>
          </div>
          <button
            className="login-source-toggle"
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            현재 단계의 실제 소스 {sourceOpen ? "닫기 −" : "열기 +"}
            <span>{model.revision.slice(0, 7)}</span>
          </button>
          {sourceOpen && (
            <div className="login-source">
              <a
                href={sourceUrl(source.file, source.line)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.file.split("/").at(-1)}:{source.line} · GitHub 원본 ↗
              </a>
              <p>
                고정 커밋에서 추출한 코드입니다. 현재 흐름은 처리 규칙의
                시뮬레이션입니다.
              </p>
              <pre aria-label="선택 단계 실제 소스">
                {source.lines.map((line, i) => (
                  <div key={i}>
                    <span>{source.line + i}</span>
                    <code>{line || " "}</code>
                  </div>
                ))}
              </pre>
            </div>
          )}
        </section>
        <div
          className={
            "login-data-column " + (tab === "data" ? "login-mobile-active" : "")
          }
          id="login-data"
        >
          <DataPanel state={view} device={device} />
        </div>
      </div>
      <section className="login-design">
        <article>
          <span>01 / ISSUE BOUNDARY</span>
          <h3>Redis 저장은 발급의 끝이 아닙니다.</h3>
          <p>
            DB의 PREPARING과 ACTIVE를 나눕니다. 중간에 실패해 Redis 키가 남아도
            보호 요청의 DB 확인에서 사용을 차단합니다.
          </p>
        </article>
        <article>
          <span>02 / FIXED LIFETIME</span>
          <h3>로그인 유지는 끝나는 시간이 있습니다.</h3>
          <p>
            유지 자격정보를 쓸 때마다 해시를 교체합니다. 고정 14일은 늘리지
            않고, 동시 복원에서 뒤늦은 요청은 409로 처리합니다.
          </p>
        </article>
        <article>
          <span>03 / REVOKE FIRST</span>
          <h3>권한 폐기와 키 정리를 분리합니다.</h3>
          <p>
            DB에 폐기와 정리 작업을 함께 커밋합니다. Redis 정리가 늦어져도 DB
            상태와 인증 버전으로 옛 세션의 접근을 차단합니다.
          </p>
        </article>
      </section>
      <section className="login-real-lab">
        <div>
          <span className="eyebrow">RUN THE ACTUAL BACKEND</span>
          <h2>실제 요청과 저장소까지 확인하려면</h2>
          <p>
            독립 프로젝트를 실행하면 같은 흐름을 실제 서버 처리 기록으로
            재생합니다.
            <br />
            브라우저에서 전체 검증을 실행하고 Redis·DB 상태를 직접 관찰할 수
            있습니다.
          </p>
        </div>
        <div>
          <a
            href={sourceUrl("README.md")}
            target="_blank"
            rel="noopener noreferrer"
          >
            실행 방법과 실습 계정 ↗
          </a>
          <a
            href={sourceUrl("docs/DESIGN.md")}
            target="_blank"
            rel="noopener noreferrer"
          >
            상세 설계와 브라우저 시나리오 ↗
          </a>
          <a
            href={sourceUrl("docs/verification/RESULTS.md")}
            target="_blank"
            rel="noopener noreferrer"
          >
            실제 백엔드·브라우저 검증 결과 ↗
          </a>
        </div>
      </section>
    </main>
  );
}

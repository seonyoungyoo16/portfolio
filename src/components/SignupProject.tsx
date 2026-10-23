import { useEffect, useState } from "react";
import model from "../generated/signup-source.json";
import {
  emptySignup,
  executeSignup,
  ownFlow,
  verified,
  type Action,
  type Input,
  type Result,
} from "../signup-demo";
import "../signup.css";
import AuthScene from "./AuthScene";
import { signupSceneState } from "../auth-scene";
const href = (file: string, line?: number) =>
  `${model.repo}/blob/${model.revision}/${file}${line ? "#L" + line : ""}`;
const remaining = (end: number | null, now: number) =>
  end === null ? "미확인" : Math.max(0, end - now) + "초";
const sources = model.sources as Record<
  string,
  { file: string; line: number; lines: string[] }
>;
export default function SignupProject() {
  const [state, setState] = useState(emptySignup),
    [result, setResult] = useState<Result | null>(null),
    [step, setStep] = useState(0),
    [runVersion, setRunVersion] = useState(0),
    [playing, setPlaying] = useState(false),
    [email, setEmail] = useState("new@lab.test"),
    [name, setName] = useState("신규 회원"),
    [terms, setTerms] = useState(false),
    [drop, setDrop] = useState(false),
    [provider, setProvider] = useState<"main" | "team">("main"),
    [user, setUser] = useState<"alice" | "match">("alice"),
    [tab, setTab] = useState("service"),
    [sourceOpen, setSourceOpen] = useState(true);
  const current = result?.frames[step],
    view = current?.snapshot || state,
    flow = ownFlow(state),
    shown = ownFlow(view),
    busy = !!result && step < result.frames.length - 1,
    source = sources[current?.source || "SignupService.create"];
  useEffect(() => {
    if (!playing || !result) return;
    const timer = setTimeout(() => {
      if (step < result.frames.length - 1) setStep(step + 1);
      else setPlaying(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [playing, result, step]);
  const run = (action: Action, extra: Input = {}) => {
    const next = executeSignup(state, action, {
      email,
      name,
      terms,
      key: "signup-fixed-key-" + state.active,
      drop,
      provider,
      user,
      ...extra,
    });
    setState(next.state);
    setResult(next);
    setRunVersion((v) => v + 1);
    setStep(0);
    setPlaying(true);
    if (action === "switch" || action === "oidc")
      setEmail(ownFlow(next.state).email);
  };
  const reset = () => {
    setState(emptySignup());
    setResult(null);
    setRunVersion((v) => v + 1);
    setStep(0);
    setPlaying(false);
    setEmail("new@lab.test");
    setName("신규 회원");
    setTerms(false);
    setDrop(false);
    setProvider("main");
    setUser("alice");
  };
  return (
    <main className="signup-project">
      <a className="back-link" href="#projects">
        ← 프로젝트 목록
      </a>
      <section className="signup-intro">
        <div>
          <span className="eyebrow">04 / IDENTITY & ONBOARDING</span>
          <h1>
            이메일의 주인을 확인하고,
            <br />
            <em>하나의 계정으로 연결합니다.</em>
          </h1>
          <p>
            인증 메일, 가입 트랜잭션, 외부 신원 연결.
            <br />
            요청이 오가는 경계와 DB에 확정되는 순간을 따라가 보세요.
          </p>
        </div>
        <aside className="signup-evidence">
          <span>독립 프로젝트 · 실제 백엔드 검증 기록</span>
          <strong>
            {model.verification.backend} SQL / API <i>+</i>{" "}
            {model.verification.browser} Browser
          </strong>
          <p>
            Spring Boot A·B / PostgreSQL / Redis
            <br />
            실제 SMTP 수신함 / Keycloak OIDC
          </p>
          <a
            href={href("docs/verification/COVERAGE.md")}
            target="_blank"
            rel="noopener noreferrer"
          >
            시나리오별 실행 근거 보기 ↗
          </a>
          <small>
            commit {model.revision.slice(0, 7)} · {model.verification.anchors}{" "}
            source anchors
          </small>
        </aside>
      </section>
      <div className="signup-boundary">
        <b>공개 체험 · 브라우저 시뮬레이션</b>
        <p>
          아래 상태와 메일함은 설명을 위한 시뮬레이션입니다. 실제 메일·IdP
          요청은 독립 프로젝트에서 검증했으며, 각 단계는 그 소스에 연결됩니다.
        </p>
        <a href={href("README.md")} target="_blank" rel="noopener noreferrer">
          실제 백엔드 실행 방법 ↗
        </a>
      </div>
      <div className="signup-toolbar">
        <div>
          <span>시뮬레이션 시간</span>
          <b>
            {Math.floor(state.now / 60)}분 {state.now % 60}초
          </b>
        </div>
        <button onClick={() => run("wait", { seconds: 60 })} disabled={busy}>
          60초 경과
        </button>
        <button onClick={() => run("wait", { seconds: 601 })} disabled={busy}>
          10분 1초 경과
        </button>
        <button onClick={reset}>실험 초기화 ↺</button>
      </div>
      <nav className="signup-tabs" aria-label="회원가입 체험 패널">
        {[
          ["service", "서비스"],
          ["flow", "흐름·소스"],
          ["data", "데이터"],
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
      <div className="signup-workspace">
        <div
          className={
            "signup-services signup-pane " +
            (tab === "service" ? "selected" : "")
          }
        >
          <section className="signup-panel">
            <div className="signup-panel-head">
              <h2>이메일로 가입하기</h2>
              <span>{flow.state}</span>
            </div>
            <div className="signup-context">
              <label>
                브라우저 문맥
                <select
                  aria-label="가입 브라우저 문맥"
                  disabled={busy}
                  value={state.active}
                  onChange={(e) =>
                    run("switch", { browser: Number(e.target.value) as 0 | 1 })
                  }
                >
                  <option value="0">A · 독립 가입 흐름</option>
                  <option value="1">B · 독립 가입 흐름</option>
                </select>
              </label>
              <small>
                두 문맥은 계정·제한을 공유합니다. 쿠키 소유권은 분리됩니다.
              </small>
            </div>
            <div className="signup-proof">
              <b>
                {flow.state === "COMPLETED"
                  ? "가입 완료"
                  : verified(state)
                    ? "이메일 확인됨"
                    : "이메일 확인 필요"}
              </b>
              <small>
                흐름 {remaining(flow.expires, state.now)} · 증명{" "}
                {remaining(flow.verifiedUntil, state.now)} · 세대{" "}
                {flow.generation}
              </small>
            </div>
            <label>
              가입 이메일
              <input
                aria-label="가입 이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || flow.state === "COMPLETED"}
              />
            </label>
            <div className="signup-actions">
              <button onClick={() => run("request")} disabled={busy}>
                인증 메일 요청
              </button>
              <button onClick={() => run("change")} disabled={busy}>
                이메일 수정 반영
              </button>
            </div>
            {verified(state) && flow.state === "OPEN" ? (
              <div className="signup-details">
                <label>
                  표시 이름
                  <input
                    aria-label="가입 표시 이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <p className="signup-note">
                  실제 백엔드는 이 단계에서 비밀번호를 입력받습니다. 공개 체험은
                  비밀번호를 수집하지 않습니다.
                </p>
                <label className="signup-check">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    disabled={busy}
                  />
                  필수 약관 동의
                </label>
                <label className="signup-check">
                  <input
                    type="checkbox"
                    checked={drop}
                    onChange={(e) => setDrop(e.target.checked)}
                    disabled={busy}
                  />
                  가입 커밋 후 응답 연결 유실
                </label>
                <button
                  className="signup-primary"
                  onClick={() => run("complete")}
                  disabled={busy}
                >
                  가입 확정하고 흐름 보기 →
                </button>
              </div>
            ) : (
              <p className="signup-note">
                이메일 확인 뒤 가입 정보를 확정합니다. 가입만으로 로그인하지
                않습니다.
              </p>
            )}
            <div className="signup-actions">
              <button disabled={busy} onClick={() => run("recover")}>
                가입 결과 확인
              </button>
              <button
                disabled={busy || !flow.result}
                onClick={() => run("complete")}
              >
                같은 가입 요청 재전송
              </button>
            </div>
          </section>
          <section className="signup-panel signup-mailbox">
            <div className="signup-panel-head">
              <h2>메일함과 Outbox</h2>
              <span>
                {state.mail.reduce((n, m) => n + m.received, 0)} received
              </span>
            </div>
            <p className="signup-note">
              202 접수와 SMTP 접수는 별개입니다. 링크 GET만으로는 확인되지
              않습니다.
            </p>
            <button disabled={busy} onClick={() => run("deliver")}>
              메일 작업자 실행
            </button>
            <div className="signup-mails">
              {state.mail.filter((m) => m.received > 0).length ? (
                state.mail
                  .filter((m) => m.received > 0)
                  .map((m) => (
                    <article key={m.id}>
                      <div>
                        <b>
                          확인 메일 #{m.id} · 세대 {m.generation}
                        </b>
                        <small>
                          브라우저 {m.flow ? "B" : "A"} · 수신 {m.received}회 ·{" "}
                          {remaining(m.expires, state.now)}
                        </small>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => run("open", { mail: m.id })}
                      >
                        메일 #{m.id} 링크 열기
                      </button>
                    </article>
                  ))
              ) : (
                <p className="signup-empty">
                  수신 메일이 없습니다.
                  <br />
                  요청 접수 후 작업자를 실행하세요.
                </p>
              )}
            </div>
            {state.selectedMail !== null && (
              <div className="signup-confirm">
                <p>
                  메일 #{state.selectedMail}의 링크를 열었습니다.
                  <br />
                  가입을 시작한 문맥에서 명시적으로 확인합니다.
                </p>
                <button
                  className="signup-primary"
                  disabled={busy}
                  onClick={() => run("verify")}
                >
                  이메일 확인 POST
                </button>
              </div>
            )}
          </section>
          <section className="signup-panel">
            <h2>외부 인증과 계정 연결</h2>
            <p className="signup-note">
              이메일이 같아도 자동 연결하지 않습니다. 기존 계정의 로그인과 외부
              신원을 각각 확인합니다.
            </p>
            <label>
              외부 인증 공급자
              <select
                aria-label="가입 외부 인증 공급자"
                value={provider}
                onChange={(e) => setProvider(e.target.value as "main" | "team")}
                disabled={busy}
              >
                <option value="main">Keycloak · signup-lab</option>
                <option value="team">Keycloak · signup-team</option>
              </select>
            </label>
            <label>
              공급자의 실습 신원
              <select
                aria-label="공급자 실습 신원"
                value={user}
                onChange={(e) => setUser(e.target.value as "alice" | "match")}
                disabled={busy}
              >
                <option value="alice">alice · 신규 이메일</option>
                <option value="match">match · 기존 계정과 같은 이메일</option>
              </select>
            </label>
            <label className="signup-check">
              <input
                type="checkbox"
                checked={state.trust}
                onChange={() => run("trust")}
                disabled={busy}
              />
              main의 email_verified 명시 신뢰
            </label>
            <button disabled={busy} onClick={() => run("oidc")}>
              SSO로 가입 계속
            </button>
            <div className="signup-auth">
              <b>
                {flow.login
                  ? "기존 계정 로그인됨 · #" + flow.login
                  : "기존 계정 로그인 필요"}
              </b>
              <small>
                fixture: existing@lab.test · 최근 인증{" "}
                {flow.recent === null
                  ? "없음"
                  : remaining(flow.recent + 300, state.now)}
              </small>
            </div>
            <div className="signup-actions">
              <button disabled={busy} onClick={() => run("login")}>
                기존 계정 로그인
              </button>
              <button disabled={busy} onClick={() => run("reauth")}>
                기존 수단 재확인
              </button>
              <button disabled={busy} onClick={() => run("link")}>
                외부 신원 연결 시작
              </button>
              <button disabled={busy} onClick={() => run("confirmLink")}>
                확인한 외부 신원 연결 확정
              </button>
              <button disabled={busy} onClick={() => run("logout")}>
                기존 계정 로그아웃
              </button>
            </div>
          </section>
        </div>
        <section
          className={
            "signup-panel signup-flow signup-pane " +
            (tab === "flow" ? "selected" : "")
          }
        >
          <div className="signup-panel-head">
            <h2>처리 흐름과 실제 소스</h2>
            <span>
              {result ? `${step + 1} / ${result.frames.length}` : "READY"}
            </span>
          </div>
          <p className="signup-note">
            선택한 단계의 시뮬레이션 스냅샷입니다. 실제 이벤트 기록은 독립
            프로젝트에서 확인할 수 있습니다.
          </p>
          <div className="signup-playback">
            <button
              disabled={!result}
              onClick={() => {
                if (result && step === result.frames.length - 1) setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Ⅱ 일시 정지" : "▷ 재생"}
            </button>
            <button
              disabled={!busy}
              onClick={() => {
                setPlaying(false);
                setStep(step + 1);
              }}
            >
              다음 단계 →
            </button>
            <button
              disabled={!busy}
              onClick={() => {
                setPlaying(false);
                setStep(result!.frames.length - 1);
              }}
            >
              마지막으로 ⇥
            </button>
          </div>
          <AuthScene
            data={signupSceneState(view, result?.frames || [], step)}
            frames={result?.frames || []}
            step={step}
            run={runVersion}
            playing={playing}
            onShowSource={() => setSourceOpen(true)}
            onSelectStep={(index) => {
              setStep(index);
              setPlaying(false);
              setSourceOpen(true);
            }}
          >
            <div className="signup-current">
              <span>
                {current?.node || "이메일 인증 · 중복 가입 방지 · SSO"}
              </span>
              <strong>
                {current?.title || "이메일 소유 확인에서 시작합니다."}
              </strong>
              <p>
                {current?.detail ||
                  "접수 → 이메일 확인 → 가입 확정, 각 단계의 변화를 확인하세요."}
              </p>
            </div>
          </AuthScene>
          <ol className="signup-steps">
            {result?.frames.map((frame, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setPlaying(false);
                    setStep(i);
                  }}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {frame.title}
                  <small>{frame.node}</small>
                </button>
              </li>
            ))}
          </ol>
          <div
            className={
              "signup-result " + (result && result.status >= 400 ? "error" : "")
            }
            role="status"
            data-testid="signup-result"
          >
            <b>
              {busy
                ? "처리 단계 재생 중"
                : result
                  ? `${result.status || "응답 유실"} · ${result.code}`
                  : "요청 대기"}
            </b>
            <p>
              {busy
                ? "다음 단계 또는 마지막으로 버튼으로 이동하세요."
                : result?.message ||
                  "인증 메일을 요청하고 실제 처리 경계를 살펴보세요."}
            </p>
          </div>
          <button
            className="signup-source-toggle"
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen(!sourceOpen)}
          >
            현재 단계의 실제 소스 {sourceOpen ? "닫기 −" : "열기 +"}
            <small>{model.revision.slice(0, 7)}</small>
          </button>
          {sourceOpen && source && (
            <div className="signup-source">
              <a
                href={href(source.file, source.line)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.file.split("/").at(-1)}:{source.line} · GitHub ↗
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
                SHA-256 {model.hashes[source.file as keyof typeof model.hashes]}
              </small>
            </div>
          )}
        </section>
        <aside
          className={
            "signup-data signup-pane " + (tab === "data" ? "selected" : "")
          }
        >
          <section className="signup-panel">
            <div className="signup-panel-head">
              <h2>선택 단계의 데이터</h2>
              <span>SIMULATION</span>
            </div>
            <div className="signup-metrics">
              <div>
                <span>신규 계정</span>
                <b data-testid="signup-account-count">
                  {view.accounts.length - 1}
                </b>
              </div>
              <div>
                <span>확인 메일</span>
                <b>{view.mail.length}</b>
              </div>
              <div>
                <span>외부 신원</span>
                <b data-testid="signup-identity-count">
                  {view.identities.length}
                </b>
              </div>
              <div>
                <span>동의 행</span>
                <b>{(view.accounts.length - 1) * 2}</b>
              </div>
            </div>
            <p className="signup-note">
              실습 기준 계정 1개는 신규 수에서 제외합니다. SSO 가입은 비밀번호
              행을 만들지 않습니다.
            </p>
            <dl>
              <div>
                <dt>가입 흐름</dt>
                <dd>
                  {shown.state} · {shown.method}
                </dd>
              </div>
              <div>
                <dt>이메일 증명</dt>
                <dd>{remaining(shown.verifiedUntil, view.now)}</dd>
              </div>
              <div>
                <dt>로그인 권한</dt>
                <dd>{shown.login ? "계정 #" + shown.login : "없음"}</dd>
              </div>
              <div>
                <dt>미확정 연결</dt>
                <dd>
                  {shown.link
                    ? "계정 #" + shown.link.target + "에 결속"
                    : "없음"}
                </dd>
              </div>
            </dl>
            <h3>계정</h3>
            <div className="signup-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>이메일</th>
                    <th>가입 수단</th>
                  </tr>
                </thead>
                <tbody>
                  {view.accounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.email}</td>
                      <td>{a.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>발송 작업</h3>
            <div className="signup-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>메일</th>
                    <th>세대</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {view.mail.map((m) => (
                    <tr key={m.id}>
                      <td>#{m.id}</td>
                      <td>{m.generation}</td>
                      <td>{m.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!view.mail.length && (
                <p className="signup-empty">발송 작업이 없습니다.</p>
              )}
            </div>
            <h3>외부 신원</h3>
            {view.identities.length ? (
              view.identities.map((id, i) => (
                <div className="signup-identity" key={i}>
                  <b>계정 #{id.account}</b>
                  <span>
                    {id.issuer.split("/").at(-1)} / {id.subject}
                  </span>
                </div>
              ))
            ) : (
              <p className="signup-empty">연결된 외부 신원이 없습니다.</p>
            )}
          </section>
          <section className="signup-panel">
            <h2>장애와 정책 실험</h2>
            <p className="signup-note">
              복구 뒤 같은 요청을 다시 확인하세요. SMTP 장애 중에도 요청은
              outbox에 남을 수 있습니다.
            </p>
            <div className="signup-faults">
              {(
                [
                  ["redis", "Redis", state.redisUp],
                  ["db", "DB", state.dbUp],
                  ["smtp", "SMTP", state.smtpUp],
                ] as const
              ).map(([id, label, up]) => (
                <button
                  key={id}
                  disabled={busy}
                  onClick={() => run(id)}
                  aria-pressed={!up}
                >
                  {label} {up ? "정상 → 차단" : "차단 → 복구"}
                </button>
              ))}
              <button
                disabled={busy}
                onClick={() => run("smtpLoss")}
                aria-pressed={state.smtpLoss}
              >
                다음 SMTP 접수 응답 유실 {state.smtpLoss ? "ON" : "OFF"}
              </button>
            </div>
            <ul className="signup-rules">
              <li>가입 흐름 30분 · 링크·증명 10분</li>
              <li>재발송 60초 · 흐름당 3회</li>
              <li>최근 인증 5분 · 이메일 자동 연결 금지</li>
              <li>COMMIT 후 응답 유실은 같은 결과로 복구</li>
            </ul>
            <a
              href={href("docs/DESIGN.md")}
              target="_blank"
              rel="noopener noreferrer"
            >
              전체 상세설계 보기 ↗
            </a>
          </section>
        </aside>
      </div>
      <section className="signup-principles">
        <div>
          <span>01 / OWNERSHIP</span>
          <h3>확인 증명과 로그인은 다릅니다.</h3>
          <p>
            링크를 열기만 해서는 소비하지 않습니다. 증명은 가입
            흐름·이메일·세대·만료에 결속됩니다.
          </p>
        </div>
        <div>
          <span>02 / CONSISTENCY</span>
          <h3>유일 제약이 경쟁의 승자를 정합니다.</h3>
          <p>
            서버가 둘이어도 계정·자격정보·동의·결과는 한 번 확정합니다. Redis
            잠금만으로 정합성을 보장하지 않습니다.
          </p>
        </div>
        <div>
          <span>03 / IDENTITY</span>
          <h3>신원은 issuer와 subject로 구분합니다.</h3>
          <p>
            같은 이메일은 자동 병합의 근거가 아닙니다. 기존 로그인·최근 재확인과
            외부 증명 뒤 명시적으로 연결합니다.
          </p>
        </div>
      </section>
      <p className="signup-final-note">
        실제 SMTP 접수는 인터넷 도착·읽음과 구분합니다. 여러 서비스의 RP 간
        SSO(T01~T04)는 후속 범위입니다. 부하·운영 가용성 검증은 포함하지
        않습니다.
      </p>
    </main>
  );
}

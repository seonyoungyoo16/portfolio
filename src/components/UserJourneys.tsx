import { useState } from "react";
import { ActionJourney, type JourneyStep } from "./LabWorkbench";
import {
  fixturePassword,
  type LoginState,
  type Action as LoginAction,
  type Device,
} from "../login-demo";
import {
  ownFlow,
  verified,
  type SignupState,
  type Action as SignupAction,
  type Input as SignupInput,
} from "../signup-demo";
import type {
  State as PaymentState,
  Action as PaymentAction,
  Input as PaymentInput,
} from "../payment-demo";
import type { ChatClient } from "../chat-demo";
type Common = {
  busy: boolean;
  result?: string;
  onReset: () => void;
  lastAction: string;
};

export function LoginJourney(
  p: Common & {
    state: LoginState;
    device: Device;
    onRun: (actions: LoginAction[], label: string) => void;
  },
) {
  const [email, setEmail] = useState("demo@lab.test"),
    [password, setPassword] = useState(fixturePassword),
    [remember, setRemember] = useState(true);
  const b = p.state.browsers[p.device],
    signed = b.authenticated;
  const steps: JourneyStep[] = [
    {
      title: "로그인하기",
      description:
        "실습 계정으로 로그인하세요. 로그인 유지에 체크하면 브라우저를 다시 열 때도 인증을 복원할 수 있습니다.",
      ready: true,
      complete: signed,
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onRun(
              [
                {
                  kind: "login",
                  password: email === "demo@lab.test" ? password : "invalid",
                  remember,
                },
              ],
              "아이디와 비밀번호로 로그인하기",
            );
          }}
        >
          <label>
            이메일
            <input
              aria-label="체험 로그인 이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={p.busy}
            />
          </label>
          <label>
            비밀번호
            <input
              aria-label="체험 로그인 비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={p.busy}
            />
          </label>
          <label className="lab-inline-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={p.busy}
            />
            로그인 상태 유지하기
          </label>
          <button type="submit" className="lab-primary" disabled={p.busy}>
            로그인하기 →
          </button>
          <p className="lab-journey-note">
            공개 실습 계정입니다. 개인 비밀번호를 입력하지 마세요.
          </p>
        </form>
      ),
    },
    {
      title: "내 정보 확인하기",
      description:
        "로그인한 사용자만 볼 수 있는 내 정보를 엽니다. 서버가 쿠키와 Redis 세션, DB의 발급 상태를 확인하는 경로를 보세요.",
      ready: signed,
      complete: p.lastAction === "내 정보 열기",
      content: (
        <>
          <p className="lab-journey-note">
            현재 기기: {signed ? "로그인됨" : "로그인 필요"}
          </p>
          <button
            type="button"
            className="lab-primary"
            disabled={p.busy || !signed}
            onClick={() => p.onRun([{ kind: "me" }], "내 정보 열기")}
          >
            내 정보 열기 →
          </button>
        </>
      ),
    },
    {
      title: "브라우저 다시 열기",
      description:
        "브라우저 종료로 세션 쿠키가 사라진 상황을 체험합니다. 유지 쿠키가 남아 있으면 새 세션과 쿠키로 자동 복원합니다.",
      ready: !!b.sid || !!b.remember,
      complete: p.lastAction === "브라우저를 닫고 다시 열기" && signed,
      content: (
        <>
          <p className="lab-journey-note">
            로그인 유지:{" "}
            {b.remember
              ? "사용 중 · 이전 자격정보를 교체하며 복원"
              : "사용 안 함 · 다시 로그인해야 합니다."}
          </p>
          <button
            type="button"
            className="lab-primary"
            disabled={p.busy}
            onClick={() =>
              p.onRun(
                [{ kind: "close" }, { kind: "restore" }],
                "브라우저를 닫고 다시 열기",
              )
            }
          >
            브라우저를 닫고 다시 열기 →
          </button>
        </>
      ),
    },
    {
      title: "로그아웃하기",
      description:
        "현재 기기의 로그인과 로그인 유지를 종료합니다. DB에서 먼저 폐기하고 Redis를 정리한 뒤 쿠키를 지우는 순서를 확인하세요.",
      ready: !!b.sid || !!b.remember,
      complete: p.lastAction === "현재 기기에서 로그아웃하기" && !signed,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy || (!b.sid && !b.remember)}
          onClick={() =>
            p.onRun([{ kind: "logout" }], "현재 기기에서 로그아웃하기")
          }
        >
          로그아웃하기 →
        </button>
      ),
    },
  ];
  return (
    <ActionJourney
      title="로그인부터 다시 방문까지"
      steps={steps}
      busy={p.busy}
      result={p.result}
      onReset={p.onReset}
    />
  );
}

export function SignupJourney(
  p: Common & {
    state: SignupState;
    onRun: (actions: SignupAction[], input: SignupInput, label: string) => void;
  },
) {
  const [email, setEmail] = useState("new@lab.test"),
    [name, setName] = useState("신규 회원"),
    [terms, setTerms] = useState(false),
    [mode, setMode] = useState("email");
  const flow = ownFlow(p.state),
    mail = [...p.state.mail]
      .reverse()
      .find(
        (m) =>
          m.flow === p.state.active &&
          m.received > 0 &&
          m.generation === flow.generation,
      );
  const emailSteps: JourneyStep[] = [
    {
      title: "인증 메일 받기",
      description:
        "가입할 이메일로 인증 메일을 요청합니다. 202 접수 뒤 별도 작업자가 메일을 보내는 흐름까지 재생합니다.",
      ready: true,
      complete: !!mail,
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onRun(
              ["request", "deliver"],
              { email },
              "가입 이메일로 인증 메일 요청하기",
            );
          }}
        >
          <label>
            이메일
            <input
              aria-label="체험 가입 이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={p.busy}
            />
          </label>
          <button type="submit" className="lab-primary" disabled={p.busy}>
            인증 메일 보내기 →
          </button>
          <p className="lab-journey-note">
            실제 이메일 대신 이 화면의 실습 메일함으로 전달됩니다.
          </p>
        </form>
      ),
    },
    {
      title: "메일의 인증 링크 열기",
      description:
        "받은 메일에서 인증 링크를 엽니다. 이 시점에는 확인 화면만 열리고 이메일 소유 증명은 아직 확정되지 않습니다.",
      ready: !!mail,
      complete: p.state.selectedMail === mail?.id,
      content: (
        <>
          <p className="lab-journey-note">
            {mail
              ? `인증 메일 #${mail.id} · ${flow.email}`
              : "먼저 인증 메일을 받아 주세요."}
          </p>
          <button
            type="button"
            className="lab-primary"
            disabled={p.busy || !mail}
            onClick={() =>
              p.onRun(
                ["open"],
                { mail: mail?.id },
                "받은 메일의 인증 링크 열기",
              )
            }
          >
            메일에서 인증 링크 열기 →
          </button>
        </>
      ),
    },
    {
      title: "이메일 확인하기",
      description:
        "확인 버튼을 눌러 이메일 소유 증명을 확정합니다. 일회용 토큰과 가입 문맥을 DB에서 검증하는 단계를 확인하세요.",
      ready: p.state.selectedMail !== null,
      complete: verified(p.state),
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy || p.state.selectedMail === null}
          onClick={() => p.onRun(["verify"], {}, "내 이메일임을 확인하기")}
        >
          내 이메일이 맞아요 →
        </button>
      ),
    },
    {
      title: "가입 완료하기",
      description:
        "이메일 확인 뒤 회원 정보를 확정합니다. 같은 이메일이나 재전송이 계정을 중복 생성하지 못하도록 DB에서 처리합니다.",
      ready: verified(p.state) || flow.state === "COMPLETED",
      complete: flow.state === "COMPLETED",
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onRun(
              ["complete"],
              { name, terms },
              "이메일 확인 후 회원가입 완료하기",
            );
          }}
        >
          <label>
            이름
            <input
              aria-label="체험 가입 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={p.busy || flow.state === "COMPLETED"}
            />
          </label>
          <label className="lab-inline-check">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              disabled={p.busy}
            />
            실습용 필수 약관 확인
          </label>
          <button
            type="submit"
            className="lab-primary"
            disabled={p.busy || !terms || flow.state === "COMPLETED"}
          >
            회원가입 완료하기 →
          </button>
          <p className="lab-journey-note">
            가입 완료와 로그인은 별개입니다. 공개 체험은 비밀번호를 수집하지
            않습니다.
          </p>
        </form>
      ),
    },
  ];
  const linkSteps: JourneyStep[] = [
    {
      title: "기존 계정 로그인",
      description:
        "내 계정에 다른 로그인 수단을 추가합니다. 먼저 기존 계정의 소유자임을 확인합니다.",
      ready: true,
      complete: !!flow.login,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy}
          onClick={() => p.onRun(["login"], {}, "기존 계정으로 로그인하기")}
        >
          기존 실습 계정으로 로그인 →
        </button>
      ),
    },
    {
      title: "외부 계정으로 본인 확인",
      description:
        "외부 인증 공급자에서 본인 확인을 마칩니다. 이메일이 같아도 아직 기존 계정에 자동 연결하지 않습니다.",
      ready: !!flow.login,
      complete: !!flow.link,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy || !flow.login}
          onClick={() =>
            p.onRun(
              ["link"],
              { provider: "main", user: "match" },
              "외부 로그인 계정의 소유자 확인하기",
            )
          }
        >
          외부 계정으로 본인 확인 →
        </button>
      ),
    },
    {
      title: "이 계정에 연결하기",
      description:
        "확인한 외부 신원을 현재 계정에 명시적으로 연결합니다. 최근 인증과 외부 신원 소유권을 함께 검사합니다.",
      ready: !!flow.link,
      complete: p.state.identities.length > 0,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy || !flow.link}
          onClick={() =>
            p.onRun(
              ["confirmLink"],
              {},
              "확인한 외부 계정을 내 계정에 연결하기",
            )
          }
        >
          내 계정에 연결하기 →
        </button>
      ),
    },
  ];
  return (
    <>
      <div
        className="lab-journey-choice"
        role="group"
        aria-label="가입 체험 선택"
      >
        <button
          aria-pressed={mode === "email"}
          disabled={p.busy}
          onClick={() => setMode("email")}
        >
          이메일로 가입
        </button>
        <button
          aria-pressed={mode === "link"}
          disabled={p.busy}
          onClick={() => setMode("link")}
        >
          외부 계정 연결
        </button>
      </div>
      <ActionJourney
        key={mode}
        title={
          mode === "email" ? "이메일로 회원가입하기" : "로그인 수단 추가하기"
        }
        steps={mode === "email" ? emailSteps : linkSteps}
        busy={p.busy}
        result={p.result}
        onReset={p.onReset}
      />
    </>
  );
}

export function PaymentJourney(
  p: Common & {
    state: PaymentState;
    onRun: (action: PaymentAction, input: PaymentInput, label: string) => void;
  },
) {
  const [amount, setAmount] = useState("3000"),
    [full, setFull] = useState(false),
    s = p.state;
  const remaining = s.captured - s.canceled;
  const steps: JourneyStep[] = [
    {
      title: "상품 주문하기",
      description:
        "10,000원 실습 상품을 주문합니다. 주문이 생겨도 아직 결제되지는 않습니다.",
      ready: true,
      complete: s.accepted,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy}
          onClick={() => p.onRun("order", {}, "10,000원 상품 주문하기")}
        >
          10,000원 상품 주문하기 →
        </button>
      ),
    },
    {
      title: "결제 수단 인증하기",
      description:
        "결제사에서 결제 수단을 인증합니다. 인증 완료와 실제 승인은 별개의 단계입니다.",
      ready: s.accepted,
      complete: s.authorized,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy || !s.accepted}
          onClick={() =>
            p.onRun("authenticate", {}, "결제사에서 결제 수단 인증하기")
          }
        >
          실습 결제 수단 인증하기 →
        </button>
      ),
    },
    {
      title: "결제하기",
      description:
        "결제를 확정합니다. 중복 게이트를 거쳐 PG 원장이 먼저 기록되고 상점 원장이 뒤따르는 순서를 보세요.",
      ready: s.authorized,
      complete: s.captured > 0,
      content: (
        <button
          type="button"
          className="lab-primary"
          disabled={p.busy || !s.authorized}
          onClick={() => p.onRun("confirm", {}, "주문 금액 결제하기")}
        >
          {s.captured ? "같은 결제 다시 요청하기" : "10,000원 결제하기"} →
        </button>
      ),
    },
    {
      title: "결제 취소하기",
      description:
        "부분 취소 또는 남은 금액 전액 취소를 요청합니다. 취소 예약과 PG·상점 원장의 확정을 나누어 보여줍니다.",
      ready: s.captured > 0,
      complete: s.canceled > 0,
      content: (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onRun(
              "cancel",
              { amount: full ? remaining : Number(amount) },
              full ? "남은 결제 금액 전액 취소하기" : "결제 금액 일부 취소하기",
            );
          }}
        >
          <p className="lab-journey-note">
            현재 결제 잔액: {remaining.toLocaleString("ko-KR")}원
          </p>
          <label className="lab-inline-check">
            <input
              type="checkbox"
              checked={full}
              onChange={(e) => setFull(e.target.checked)}
              disabled={p.busy}
            />
            남은 금액 모두 취소
          </label>
          {!full && (
            <label>
              취소할 금액
              <input
                aria-label="체험 취소 금액"
                type="number"
                min="1"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={p.busy}
              />
            </label>
          )}
          <button
            type="submit"
            className="lab-primary"
            disabled={p.busy || remaining <= 0}
          >
            {full ? "남은 금액 전액 취소하기" : "입력한 금액 취소하기"} →
          </button>
        </form>
      ),
    },
  ];
  return (
    <ActionJourney
      title="주문부터 결제 취소까지"
      steps={steps}
      busy={p.busy}
      result={p.result}
      onReset={p.onReset}
    />
  );
}

export function ChatJourney(p: {
  clients: ChatClient[];
  draft: string;
  busy: boolean;
  onConnect: (index: number) => void;
  onDraft: (text: string) => void;
  onSend: () => void;
}) {
  const [a, b] = p.clients,
    latestA = a.messages.at(-1)?.id || 0,
    latestB = b.messages.at(-1)?.id || 0;
  const compose = (offline = false) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        p.onSend();
      }}
    >
      <label>
        보낼 메시지
        <textarea
          aria-label="체험 채팅 메시지"
          value={p.draft}
          onChange={(e) => p.onDraft(e.target.value)}
          disabled={p.busy || !a.connected}
          placeholder={
            offline ? "다시 접속하면 읽을 메시지를 남겨 보세요." : "안녕하세요!"
          }
        />
      </label>
      <button
        type="submit"
        className="lab-primary"
        disabled={p.busy || !a.connected || !p.draft.trim()}
      >
        {offline ? "오프라인인 상대에게 보내기" : "참가자 A에서 메시지 보내기"}{" "}
        →
      </button>
    </form>
  );
  const inbox = (
    <div className="lab-chat-inbox">
      <b>참가자 B의 대화 화면 · {b.connected ? "접속 중" : "접속 끊김"}</b>
      {b.messages.slice(-4).map((m) => (
        <p key={m.id}>{m.body}</p>
      ))}
      {!b.messages.length && <p>아직 받은 메시지가 없습니다.</p>}
    </div>
  );
  const steps: JourneyStep[] = [
    {
      title: "같은 대화방에 입장하기",
      description:
        "두 참가자를 순서대로 연결합니다. WebSocket 연결과 서버 대화 조회가 각각 어디에서 실행되는지 보세요.",
      ready: true,
      complete: a.connected && b.connected,
      content: (
        <>
          <button
            type="button"
            className="lab-primary"
            disabled={p.busy || a.connected}
            onClick={() => p.onConnect(0)}
          >
            참가자 A 입장하기 →
          </button>
          <button
            type="button"
            className="lab-primary"
            disabled={p.busy || !a.connected || b.connected}
            onClick={() => p.onConnect(1)}
          >
            참가자 B 입장하기 →
          </button>
        </>
      ),
    },
    {
      title: "메시지 보내기",
      description:
        "참가자 A가 보낸 메시지가 저장되고 B에게 전달됩니다. 서버의 저장 응답과 상대의 읽음은 별개입니다.",
      ready: a.connected && b.connected,
      complete: latestA > 0 && latestB === latestA,
      content: (
        <>
          {compose()}
          {inbox}
        </>
      ),
    },
    {
      title: "연결을 끊고 메시지 남기기",
      description:
        "B가 잠시 나간 동안 메시지를 남겨 보세요. 상대에게 즉시 전달되지는 않아도 서버의 대화 기록은 남습니다.",
      ready: a.connected,
      complete: !b.connected && latestA > latestB,
      content: (
        <>
          {b.connected ? (
            <button
              type="button"
              className="lab-primary"
              disabled={p.busy}
              onClick={() => p.onConnect(1)}
            >
              참가자 B 잠시 나가기 →
            </button>
          ) : (
            compose(true)
          )}
          {inbox}
        </>
      ),
    },
    {
      title: "다시 접속해서 대화 받기",
      description:
        "B가 돌아오면 서버에 보관된 대화를 조회해 받습니다. DB → 서버 → B의 흐름과 대화 조회 소스를 확인하세요.",
      ready: !b.connected || latestB === latestA,
      complete: b.connected && latestA > 0 && latestB === latestA,
      content: (
        <>
          <button
            type="button"
            className="lab-primary"
            disabled={p.busy || b.connected}
            onClick={() => p.onConnect(1)}
          >
            참가자 B 다시 입장하기 →
          </button>
          {inbox}
        </>
      ),
    },
  ];
  return (
    <ActionJourney
      title="메시지를 보내고 다시 받기"
      steps={steps}
      busy={p.busy}
      result={`A ${a.connected ? "접속 중" : "연결 전"} · B ${b.connected ? "접속 중" : "연결 전"} · B가 받은 메시지 ${b.messages.length}개`}
      onReset={() => {}}
    />
  );
}

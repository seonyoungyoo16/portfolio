import { useEffect, useState, type ReactNode } from "react";
import "../lab-workbench.css";

export default function LabWorkbench({
  guide,
  children,
  busy,
  onFinish,
  shared = false,
  onModeChange,
  environment,
  onFlow,
  hasResult,
}: {
  guide: ReactNode;
  children: ReactNode;
  busy: boolean;
  onFinish: () => void;
  shared?: boolean;
  onModeChange?: () => void;
  environment?: string;
  onFlow?: () => void;
  hasResult?: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  return (
    <div className="lab-workbench" data-mode={advanced ? "advanced" : "user"}>
      <div className="lab-mode" role="group" aria-label="체험 방식">
        <button
          type="button"
          aria-pressed={!advanced}
          onClick={() => {
            setAdvanced(false);
            onModeChange?.();
          }}
        >
          사용자로 체험하기
        </button>
        <button
          type="button"
          aria-pressed={advanced}
          onClick={() => {
            setAdvanced(true);
            onModeChange?.();
          }}
        >
          직접 실험하기
        </button>
      </div>
      {environment && !advanced && (
        <p className="lab-environment">
          실험 조건 적용 중: {environment}
          <small>‘직접 실험하기’에서 정상 조건으로 되돌릴 수 있습니다.</small>
        </p>
      )}
      {busy && (
        <div className="lab-playing" role="status">
          <span>방금 한 행동의 처리 경로를 재생하고 있어요.</span>
          <button type="button" onClick={onFinish}>
            결과 바로 보기
          </button>
        </div>
      )}
      <div className="lab-user" hidden={advanced}>
        {guide}
        {hasResult && onFlow && (
          <button type="button" className="lab-open-flow" onClick={onFlow}>
            처리 흐름·소스 보기 →
          </button>
        )}
      </div>
      <div className="lab-technical" hidden={!shared && !advanced}>
        {children}
      </div>
    </div>
  );
}

export type JourneyStep = {
  title: string;
  description: string;
  ready: boolean;
  complete: boolean;
  content: ReactNode;
  repeatable?: boolean;
  completionText?: string;
};
export function ActionJourney({
  title,
  steps,
  busy,
  result,
  onReset,
  status,
}: {
  title: string;
  steps: JourneyStep[];
  busy: boolean;
  result?: string;
  onReset: () => void;
  status?: number;
}) {
  const [selected, setSelected] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    if (!result) {
      setSelected(0);
      setCompleted(new Set());
    }
  }, [result]);
  const index = Math.min(selected, steps.length - 1),
    step = steps[index];
  useEffect(() => {
    if (!busy && step.complete)
      setCompleted((previous) =>
        previous.has(index) ? previous : new Set([...previous, index]),
      );
  }, [busy, step.complete, index]);
  return (
    <section className="lab-journey" aria-label={title}>
      <header>
        <div>
          <small>USER EXPERIENCE</small>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onReset();
            setSelected(0);
            setCompleted(new Set());
          }}
        >
          처음부터
        </button>
      </header>
      <p className="lab-howto">
        번호 순서대로 행동해 보세요. 오른쪽에서 처리 경로와 해당 소스가 함께
        바뀝니다.
      </p>
      <ol className="lab-journey-steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              aria-current={index === i ? "step" : undefined}
              disabled={busy || !s.ready}
              onClick={() => setSelected(i)}
            >
              <span>
                {(s.complete || completed.has(i)) && !busy ? "✓" : i + 1}
              </span>
              {s.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="lab-journey-action">
        <small>
          STEP {index + 1} / {steps.length}
        </small>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        {step.complete && !busy && !step.repeatable ? (
          <p className="lab-step-complete">
            {step.completionText ||
              (index === steps.length - 1
                ? "이 체험을 마쳤어요. ‘처음부터’로 다시 시작할 수 있습니다."
                : "이 행동을 완료했어요. 다음 행동으로 이어가세요.")}
          </p>
        ) : (
          step.content
        )}
      </div>
      {result && (
        <p
          className="lab-action-result"
          role="status"
          data-outcome={
            status === 0
              ? "uncertain"
              : status !== undefined && status >= 400
                ? "error"
                : "success"
          }
        >
          <b>{busy ? "흐름 재생 중" : "방금 행동의 결과"}</b>
          {busy
            ? "처리 경로를 먼저 확인한 뒤 다음 행동으로 진행하세요."
            : result}
        </p>
      )}
      {!busy &&
        step.complete &&
        index < steps.length - 1 &&
        steps[index + 1].ready && (
          <button
            type="button"
            className="lab-next"
            onClick={() => setSelected(index + 1)}
          >
            다음: {steps[index + 1].title} →
          </button>
        )}
    </section>
  );
}

export function UserActionTrace({
  action,
  request,
}: {
  action: string;
  request?: string;
}) {
  return (
    <div className="lab-action-trace">
      <span>방금 한 행동</span>
      <strong>{action || "왼쪽에서 첫 번째 행동을 시작하세요."}</strong>
      {request && <code>{request}</code>}
    </div>
  );
}

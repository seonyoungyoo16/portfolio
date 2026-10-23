import type { ReactNode } from "react";
import "../scene-views.css";

export function SceneRoles({ roles }: { roles: string[] }) {
  return (
    <div className="lab-scene-roles" aria-label="처리 흐름의 역할">
      {roles.map((role, index) => (
        <span key={role}>
          <small>{String(index + 1).padStart(2, "0")}</small>
          {role}
        </span>
      ))}
    </div>
  );
}

export function SceneSource({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="lab-source-action"
      onClick={() => {
        onClick();
        requestAnimationFrame(() =>
          document
            .querySelector(
              ".login-source, .signup-source, .payment-source, .chat-source-panel",
            )
            ?.scrollIntoView({
              block: "nearest",
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            }),
        );
      }}
    >
      현재 단계 소스 ↗
    </button>
  );
}

export function SceneCaption({
  route,
  step,
  total,
  children,
}: {
  route: string;
  step: number;
  total: number;
  children?: ReactNode;
}) {
  return (
    <div className="lab-scene-caption">
      <div className="lab-scene-route">
        <span>{route}</span>
        <small>
          {total
            ? `${String(step + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`
            : "READY"}
        </small>
      </div>
      {children}
    </div>
  );
}

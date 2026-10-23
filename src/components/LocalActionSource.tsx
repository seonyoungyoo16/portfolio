import data from "../generated/interaction-source.json";
type Entry = { file: string; line: number; lines: string[]; sha256: string };
export const interactionRevision = data.revision;
export default function LocalActionSource({
  project,
  action,
}: {
  project: "login" | "signup";
  action?: string;
}) {
  const source = (data.sources as Record<string, Entry>)[
    `${project}.${action}`
  ];
  return (
    <div
      className={`${project}-source lab-local-source`}
      data-source-kind="browser"
    >
      <p>
        브라우저 시뮬레이션 내부 동작입니다. 이 단계에서 인증·가입 서버를
        호출하지 않습니다.
      </p>
      {source ? (
        <>
          <a
            href={`${data.repo}/blob/${data.revision}/${source.file}#L${source.line}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.file}:{source.line} · 브라우저 구현 원본 ↗
          </a>
          <pre>
            {source.lines.map((line, i) => (
              <div key={i}>
                <span>{source.line + i}</span>
                <code>{line || " "}</code>
              </div>
            ))}
          </pre>
        </>
      ) : (
        <p>이 단계의 브라우저 구현 소스를 준비하고 있습니다.</p>
      )}
    </div>
  );
}

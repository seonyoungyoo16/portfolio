import { sceneViews, viewDescriptions, type SceneView } from "../scene-view";
import "../scene-views.css";
type Props = {
  value: SceneView;
  onChange: (view: SceneView) => void;
  stations: { id: string; label: string }[];
  station: string;
  onStation: (id: string) => void;
  disabled?: boolean;
};
export default function SceneViews({
  value,
  onChange,
  stations,
  station,
  onStation,
  disabled,
}: Props) {
  const index = Math.max(
    0,
    stations.findIndex((n) => n.id === station),
  );
  const cycle = (direction: number) =>
    onStation(
      stations[(index + direction + stations.length) % stations.length].id,
    );
  return (
    <div className="lab-scene-controls">
      <div className="lab-scene-views" role="group" aria-label="3D View 선택">
        <span>
          VIEW <small>{viewDescriptions[value]}</small>
        </span>
        {sceneViews.map((v) => (
          <button
            type="button"
            className="lab-view-button"
            key={v}
            aria-pressed={value === v}
            title={viewDescriptions[v]}
            onClick={() => onChange(v)}
            disabled={disabled}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {value === "station" && (
        <div
          className="lab-scene-station"
          role="group"
          aria-label="확대할 요소 선택"
        >
          <button
            type="button"
            aria-label="이전 요소"
            onClick={() => cycle(-1)}
          >
            ←
          </button>
          <select
            aria-label="확대할 요소"
            value={station}
            onChange={(e) => onStation(e.target.value)}
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" aria-label="다음 요소" onClick={() => cycle(1)}>
            →
          </button>
        </div>
      )}
    </div>
  );
}

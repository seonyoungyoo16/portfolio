import type { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

export const sceneViews = [
  "overview",
  "side",
  "top",
  "station",
  "flight",
] as const;
export type SceneView = (typeof sceneViews)[number];
export type Point3 = [number, number, number];
export const viewDescriptions: Record<SceneView, string> = {
  overview: "전체 구조",
  side: "측면 구조",
  top: "위에서 본 연결",
  station: "요소별 확대",
  flight: "현재 요청 따라가기",
};
export function scenePose(
  view: SceneView,
  focus: Point3,
  packet: Point3,
  overview?: { position: Point3; target: Point3 },
) {
  const target: Point3 =
    view === "flight"
      ? packet
      : view === "station"
        ? [focus[0], focus[1] + 0.55, focus[2]]
        : overview?.target || [0, 0, -0.6];
  const position: Point3 =
    view === "station"
      ? [target[0] + 3, target[1] + 2.5, target[2] + 5]
      : view === "flight"
        ? [target[0] + 2.3, target[1] + 2, target[2] + 4]
        : view === "side"
          ? [12, 5, 10]
          : view === "top"
            ? [0, 18, 0.01]
            : overview?.position || [0, 10, 15];
  return {
    position,
    target,
    zoom: view === "station" ? 2.2 : view === "flight" ? 2.6 : 1,
  };
}
export function applySceneCamera(
  camera: OrthographicCamera | PerspectiveCamera,
  view: SceneView,
  focus: Vector3,
  packet: Vector3,
  width: number,
  height: number,
  span = 5.8,
  overview?: { position: Point3; target: Point3 },
  minHalfHeight = 3.8,
) {
  const pose = scenePose(
    view,
    focus.toArray() as Point3,
    packet.toArray() as Point3,
    overview,
  );
  camera.position.set(...pose.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...pose.target);
  if ("isOrthographicCamera" in camera) {
    const half = Math.max(span, (minHalfHeight * width) / Math.max(height, 1));
    camera.left = -half;
    camera.right = half;
    camera.top = (half * height) / Math.max(width, 1);
    camera.bottom = -camera.top;
    camera.zoom = pose.zoom;
  } else {
    camera.aspect = width / Math.max(height, 1);
    camera.zoom = view === "station" ? 1.2 : view === "flight" ? 1.1 : 1;
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return pose;
}

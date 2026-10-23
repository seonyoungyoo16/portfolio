import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { authNodeStep, type AuthSceneState, type Tone } from "../auth-scene";
import { applySceneCamera, type SceneView } from "../scene-view";
import SceneViews from "./SceneViews";
import { SceneRoles, SceneSource, SceneCaption } from "./SceneFlow";
import "../auth-three.css";
type Props = {
  data: AuthSceneState;
  frames: { node: string }[];
  step: number;
  run: number;
  playing: boolean;
  onSelectStep: (index: number) => void;
  onShowSource: () => void;
  children?: ReactNode;
};
const ink: Record<Tone, number> = {
  blue: 0x8fcaff,
  mint: 0x8ed8b4,
  amber: 0xe9bc79,
  red: 0xf19b91,
  muted: 0x4d6575,
};
export default function AuthScene(props: Props) {
  const root = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    engine = useRef<{ update: () => void } | null>(null);
  const [mode, setMode] = useState<SceneView>("overview"),
    [station, setStation] = useState(props.data.nodes[0].id),
    [failed, setFailed] = useState(false),
    [epoch, setEpoch] = useState(0);
  latest.current = props;
  const viewpoint = useRef({ mode, station });
  viewpoint.current = { mode, station };
  const choose = (id: string) => {
    setStation(id);
    const p = latest.current,
      index = authNodeStep(p.frames, id, p.step);
    if (index >= 0) p.onSelectStep(index);
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    const host = root.current,
      canvasHost = stage.current;
    if (!host || !canvasHost) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      host.dataset.ready = "fallback";
      return;
    }
    setFailed(false);
    host.dataset.ready = "true";
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasHost.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-5.8, 5.8, 4, -4, 0.1, 80);
    scene.add(new THREE.HemisphereLight(0xdcefff, 0x152235, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(-4, 9, 7);
    scene.add(sun);
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures: THREE.Texture[] = [],
      pickables: THREE.Object3D[] = [];
    const material = (color: number, glow = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.48,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: glow,
      });
      materials.add(m);
      return m;
    };
    const shell = material(0x38516a),
      screen = material(0x122635),
      edge = material(0x526d82),
      muted = material(ink.muted);
    const palette = Object.fromEntries(
      Object.entries(ink).map(([name, color]) => [name, material(color, 0.12)]),
    ) as Record<Tone, THREE.MeshStandardMaterial>;
    const mesh = (
      g: THREE.BufferGeometry,
      m: THREE.Material,
      parent: THREE.Object3D = scene,
    ) => {
      geometries.add(g);
      const o = new THREE.Mesh(g, m);
      parent.add(o);
      return o;
    };
    const box = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material = shell,
    ) => {
      const o = mesh(new RoundedBoxGeometry(w, h, d, 2, 0.04), m, parent);
      o.position.set(x, y, z);
      return o;
    };
    const rowGeometry = new THREE.BoxGeometry(0.72, 0.08, 0.36);
    geometries.add(rowGeometry);
    const rowMaterial = material(0xffffff, 0.1),
      dummy = new THREE.Object3D();
    const nodes = new Map<
      string,
      {
        group: THREE.Group;
        ring: THREE.Mesh;
        ringKey: number;
        halo: THREE.Mesh;
        rows: THREE.InstancedMesh;
        lights: THREE.Mesh[];
        sprite: THREE.Sprite;
      }
    >();
    for (const datum of latest.current.data.nodes) {
      const group = new THREE.Group();
      group.position.set(...datum.position);
      const primary =
        datum.shape === "browser" ||
        datum.shape === "server" ||
        datum.shape === "database";
      group.scale.setScalar(primary ? 1.25 : 0.88);
      scene.add(group);
      box(group, 1.9, 0.1, 1.65, 0, -0.12, 0, screen);
      const halo = mesh(
        new THREE.TorusGeometry(0.93, 0.025, 8, 48),
        palette.mint,
        group,
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.03;
      const lights: THREE.Mesh[] = [];
      if (datum.shape === "browser") {
        box(group, 1.35, 0.9, 0.14, -0.12, 0.72, 0);
        box(group, 1.14, 0.68, 0.03, -0.12, 0.72, 0.09, screen);
        box(group, 0.12, 0.45, 0.1, -0.12, 0.16, 0);
        box(group, 0.75, 0.08, 0.45, -0.12, -0.02, 0.1);
        lights.push(
          box(group, 0.8, 0.08, 0.025, -0.12, 0.83, 0.12, palette.blue),
        );
        const cookie = mesh(
          new THREE.CylinderGeometry(0.17, 0.17, 0.07, 20),
          palette.blue,
          group,
        );
        cookie.rotation.x = Math.PI / 2;
        cookie.position.set(0.79, 0.95, 0.13);
        cookie.userData.cookie = true;
        lights.push(cookie);
      } else if (datum.shape === "server") {
        for (const x of [-0.38, 0.38]) {
          box(group, 0.61, 1.25, 0.65, x, 0.56, 0);
          for (let i = 0; i < 3; i++) {
            box(group, 0.49, 0.24, 0.04, x, 0.95 - i * 0.34, 0.36, screen);
            lights.push(
              box(
                group,
                0.07,
                0.04,
                0.03,
                x + 0.14,
                0.95 - i * 0.34,
                0.4,
                palette.mint,
              ),
            );
          }
        }
      } else if (datum.shape === "mail") {
        box(group, 1.4, 0.9, 0.22, 0, 0.65, 0, edge);
        box(group, 1.25, 0.75, 0.025, 0, 0.65, 0.13, screen);
        const points = [
          new THREE.Vector3(-0.6, 0.97, 0.16),
          new THREE.Vector3(0, 0.54, 0.16),
          new THREE.Vector3(0.6, 0.97, 0.16),
        ];
        const lineMaterial = new THREE.LineBasicMaterial({ color: ink.amber });
        materials.add(lineMaterial);
        const g = new THREE.BufferGeometry().setFromPoints(points);
        geometries.add(g);
        const fold = new THREE.Line(g, lineMaterial);
        group.add(fold);
        lights.push(box(group, 0.6, 0.06, 0.03, 0, 0.43, 0.16, palette.amber));
      } else if (datum.shape === "identity") {
        const identity = mesh(
          new THREE.IcosahedronGeometry(0.5, 1),
          palette.amber,
          group,
        );
        identity.position.y = 0.75;
        lights.push(identity);
        for (const angle of [0, Math.PI / 2]) {
          const ring = mesh(
            new THREE.TorusGeometry(0.7, 0.025, 8, 48),
            edge,
            group,
          );
          ring.position.y = 0.75;
          ring.rotation.y = angle;
          ring.rotation.x = 0.4;
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const disk = mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 0.2, 32),
            i === 2 ? edge : shell,
            group,
          );
          disk.position.y = 0.12 + i * 0.24;
        }
        lights.push(box(group, 0.35, 0.06, 0.03, 0, 0.36, 0.56, palette.mint));
      }
      if (datum.gate) {
        for (const x of [-0.72, 0.72])
          lights.push(
            box(group, 0.07, 1.25, 0.09, x, 0.57, 0.56, palette.blue),
          );
        lights.push(box(group, 1.5, 0.07, 0.09, 0, 1.17, 0.56, palette.blue));
      }
      const rows = new THREE.InstancedMesh(rowGeometry, rowMaterial, 6);
      rows.frustumCulled = false;
      rows.count = 0;
      group.add(rows);
      const ring = mesh(
        new THREE.TorusGeometry(0.78, 0.045, 8, 64),
        muted,
        group,
      );
      ring.position.y = -0.02;
      ring.rotation.x = -Math.PI / 2;
      const text = document.createElement("canvas");
      text.width = 384;
      text.height = 96;
      const ctx = text.getContext("2d")!;
      ctx.fillStyle = "#122534ee";
      ctx.fillRect(0, 0, 384, 96);
      ctx.fillStyle = "#d1e5f1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 60px sans-serif";
      ctx.fillText(datum.id.toUpperCase(), 192, 48);
      const texture = new THREE.CanvasTexture(text);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      const labelMaterial = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
      });
      materials.add(labelMaterial);
      const sprite = new THREE.Sprite(labelMaterial);
      sprite.scale.set(1.8, 0.45, 1);
      sprite.position.set(0, 1.8, 0);
      group.add(sprite);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh && o !== halo && o !== ring) {
          o.userData.node = datum.id;
          pickables.push(o);
        }
      });
      nodes.set(datum.id, {
        group,
        ring,
        ringKey: -1,
        halo,
        rows,
        lights,
        sprite,
      });
    }
    const wires: THREE.Mesh[] = [];
    const curveBetween = (a: string, b: string) => {
      const start = nodes
          .get(a)!
          .group.position.clone()
          .add(new THREE.Vector3(0, 1.6, 0)),
        end = nodes
          .get(b)!
          .group.position.clone()
          .add(new THREE.Vector3(0, 1.6, 0)),
        mid = start.clone().lerp(end, 0.5);
      mid.y += 0.9;
      return new THREE.QuadraticBezierCurve3(start, mid, end);
    };
    for (const [a, b] of latest.current.data.edges) {
      const primary =
        (a.toLowerCase() === "browser" && b.toLowerCase() === "server") ||
        (a.toLowerCase() === "server" &&
          ["database", "db"].includes(b.toLowerCase()));
      const wire = mesh(
        new THREE.TubeGeometry(
          curveBetween(a, b),
          28,
          primary ? 0.025 : 0.016,
          6,
          false,
        ),
        primary ? palette.blue : muted,
      );
      wire.userData.edge = [a, b];
      wire.userData.primary = primary;
      const arrow = mesh(new THREE.ConeGeometry(0.11, 0.29, 12), palette.blue);
      arrow.position.copy(curveBetween(a, b).getPointAt(0.68));
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        curveBetween(a, b).getTangentAt(0.68),
      );
      wire.userData.arrow = arrow;
      wires.push(wire);
    }
    const packetMaterial = material(ink.amber, 0.35),
      packet = box(scene, 0.28, 0.18, 0.38, 0, 0, 0, packetMaterial);
    packet.visible = false;
    const failure = new THREE.Group();
    scene.add(failure);
    for (const angle of [-Math.PI / 4, Math.PI / 4])
      box(failure, 0.5, 0.06, 0.06, 0, 0, 0, palette.red).rotation.z = angle;
    failure.visible = false;
    const curveForPath = (path: string[]) => {
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < path.length; i++)
        curve.add(curveBetween(path[i - 1], path[i]));
      return curve;
    };
    const grid = new THREE.GridHelper(12, 12, 0x365266, 0x365266);
    grid.position.set(0, -0.22, -0.5);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    materials.add(grid.material as THREE.Material);
    geometries.add(grid.geometry);
    scene.add(grid);
    let width = 0,
      height = 0,
      raf = 0,
      visible = true,
      lost = false,
      destroyed = false,
      key = "",
      progress = 1,
      lastPlaying = false,
      startTime = 0,
      startProgress = 0,
      route: THREE.Curve<THREE.Vector3> | null = null;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function draw() {
      if (lost || destroyed || !visible || width <= 0 || height <= 0) return;
      const p = latest.current,
        cam = viewpoint.current,
        focus =
          nodes.get(cam.station)?.group.position ||
          nodes.values().next().value!.group.position;
      applySceneCamera(
        camera,
        cam.mode,
        focus,
        packet.visible ? packet.position : focus,
        width,
        height,
        5.8,
        { position: [0, 10, 15], target: [0, 0.35, -0.6] },
        2.6,
      );
      host!.dataset.camera = camera.position
        .toArray()
        .map((n) => n.toFixed(3))
        .join(",");
      host!.dataset.cameraTarget =
        cam.mode === "flight"
          ? (packet.visible ? packet.position : focus).toArray().join(",")
          : cam.station;
      for (const [id, node] of nodes)
        node.sprite.visible =
          (cam.mode !== "station" && cam.mode !== "flight") ||
          id === cam.station;
      renderer.render(scene, camera);
      host!.dataset.renderCount = String(
        Number(host!.dataset.renderCount || 0) + 1,
      );
    }
    function paint() {
      const p = latest.current;
      host!.dataset.progress = progress.toFixed(3);
      host!.dataset.motion = p.playing && !motion.matches ? "playing" : "still";
      packet.visible = !!route;
      const interrupted = p.data.trace?.kind === "failure";
      const travel = interrupted ? Math.min(progress, 0.52) : progress;
      failure.visible = !!route && interrupted && progress >= 0.52;
      if (route) {
        packet.position.copy(route.getPointAt(travel));
        if (failure.visible) {
          failure.position.copy(packet.position);
          failure.quaternion.copy(camera.quaternion);
          packet.visible = false;
        }
        packet.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          route.getTangentAt(Math.min(travel, 0.999)),
        );
      }
      const path = p.data.route;
      if (path)
        for (const wire of wires) {
          const [a, b] = wire.userData.edge as [string, string];
          const segment = Math.min(
              path.length - 2,
              Math.floor(travel * (path.length - 1)),
            ),
            from = path[segment],
            to = path[segment + 1];
          const arrow = wire.userData.arrow as THREE.Mesh;
          const selected = (a === from && b === to) || (b === from && a === to);
          if (selected) {
            const curve = curveBetween(from, to);
            arrow.position.copy(curve.getPointAt(0.68));
            arrow.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              curve.getTangentAt(0.68),
            );
          }
        }
      draw();
    }
    function animate(now: number) {
      raf = 0;
      if (destroyed || lost || !visible) return;
      progress = Math.min(1, startProgress + (now - startTime) / 700);
      paint();
      if (progress < 1 && latest.current.playing && !motion.matches)
        raf = requestAnimationFrame(animate);
    }
    function update() {
      if (destroyed || lost) return;
      cancelAnimationFrame(raf);
      raf = 0;
      const p = latest.current,
        next = p.run + ":" + p.data.key,
        changed = key !== next;
      if (changed) {
        key = next;
        progress = p.playing && !motion.matches ? 0 : 1;
        route = p.data.route ? curveForPath(p.data.route) : null;
      }
      for (const datum of p.data.nodes) {
        const n = nodes.get(datum.id)!;
        n.halo.visible = p.data.node === datum.id;
        n.lights.forEach((m) => {
          m.material = palette[datum.tone];
          if (m.userData.cookie) m.visible = datum.count > 0;
        });
        n.rows.count = datum.items.length;
        for (let i = 0; i < datum.items.length; i++) {
          dummy.position.set(
            datum.shape === "browser" ? 0.7 : 0,
            (datum.shape === "browser" ? 0.4 : 0.8) + i * 0.105,
            datum.shape === "mail" ? 0.3 : 0,
          );
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          n.rows.setMatrixAt(i, dummy.matrix);
          n.rows.setColorAt(i, new THREE.Color(ink[datum.items[i]]));
        }
        n.rows.instanceMatrix.needsUpdate = true;
        n.rows.computeBoundingSphere();
        if (n.rows.instanceColor) n.rows.instanceColor.needsUpdate = true;
        const ratio = Math.max(0, Math.min(1, datum.fraction ?? 0));
        n.ring.visible = datum.fraction !== undefined && ratio > 0;
        if (n.ringKey !== ratio) {
          geometries.delete(n.ring.geometry);
          n.ring.geometry.dispose();
          n.ring.geometry = new THREE.TorusGeometry(
            0.8,
            0.055,
            8,
            64,
            Math.max(0.001, ratio) * Math.PI * 2,
          );
          geometries.add(n.ring.geometry);
          n.ringKey = ratio;
        }
        n.ring.material = palette[datum.tone];
      }
      for (const wire of wires) {
        const [a, b] = wire.userData.edge as [string, string],
          r = p.data.route;
        const selected =
          r &&
          r.some(
            (node, i) =>
              i > 0 &&
              ((r[i - 1] === a && node === b) ||
                (r[i - 1] === b && node === a)),
          );
        wire.material = selected
          ? palette.amber
          : r || !wire.userData.primary
            ? muted
            : palette.blue;
        const arrow = wire.userData.arrow as THREE.Mesh;
        arrow.material = wire.material;
        const curve = curveBetween(a, b);
        arrow.position.copy(curve.getPointAt(0.68));
        arrow.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          curve.getTangentAt(0.68),
        );
      }
      if (!changed && p.playing && !lastPlaying && progress >= 1) progress = 0;
      paint();
      if (p.playing && !motion.matches && progress < 1 && visible) {
        startTime = performance.now();
        startProgress = progress;
        raf = requestAnimationFrame(animate);
      }
      lastPlaying = p.playing;
    }
    const resize = new ResizeObserver(() => {
      width = canvasHost.clientWidth;
      height = canvasHost.clientHeight;
      if (width > 0 && height > 0) {
        renderer.setSize(width, height, false);
        update();
      }
    });
    resize.observe(canvasHost);
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (!visible) {
          cancelAnimationFrame(raf);
          raf = 0;
        } else update();
      },
      { threshold: 0.01 },
    );
    intersection.observe(host);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const click = (event: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(pickables)[0];
      if (hit) chooseRef.current(hit.object.userData.node);
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      host.dataset.ready = "fallback";
      setFailed(true);
    };
    const onRestored = () => setEpoch((n) => n + 1);
    renderer.domElement.addEventListener("click", click);
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    renderer.domElement.addEventListener("webglcontextrestored", onRestored);
    motion.addEventListener("change", update);
    engine.current = { update };
    update();
    return () => {
      destroyed = true;
      engine.current = null;
      cancelAnimationFrame(raf);
      resize.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", update);
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onRestored,
      );
      nodes.forEach((n) => n.rows.dispose());
      textures.forEach((t) => t.dispose());
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [epoch]);
  useEffect(
    () => engine.current?.update(),
    [props.data, props.playing, props.run, mode, station],
  );
  return (
    <div
      className="auth-three"
      ref={root}
      role="group"
      aria-label={
        props.data.project === "login"
          ? "로그인 세션과 로그인 유지 3D View"
          : "이메일 인증·가입·SSO 연결 3D View"
      }
      data-scene-project={props.data.project}
      data-view={mode}
      data-station={station}
      data-source={props.data.source}
      data-step={props.step}
      data-route={props.data.trace?.path.join(">") || ""}
      data-effect-kind={props.data.trace?.kind || "ready"}
      data-source-role={props.data.trace?.sourceRole || "ready"}
    >
      <SceneRoles
        roles={
          props.data.project === "login"
            ? ["사용자 · 기기", "인증 서버 A·B", "세션 DB · Redis"]
            : ["사용자 · 가입", "가입 서버 A·B", "계정 DB · 연계"]
        }
      />
      <div className="lab-scene-stage-wrap">
        <div className="auth-three-stage" ref={stage} />
        <SceneSource onClick={props.onShowSource} />
      </div>
      {failed && (
        <p className="auth-three-fallback" role="status">
          3D를 표시할 수 없습니다. 요소·처리 단계·실제 소스에서 같은 상태를
          확인하세요.
        </p>
      )}
      <SceneCaption
        route={
          props.data.route
            ? props.data.route
                .map(
                  (id) =>
                    props.data.nodes.find((n) => n.id === id)?.label || id,
                )
                .join(" → ")
            : "요청 실행 → 처리 경로 → 데이터 변화"
        }
        step={props.step}
        total={props.frames.length}
      >
        {props.data.trace && (
          <p className="lab-trace-operation">
            {props.data.trace.operation}
            <small>
              {props.data.trace.sourceRole === "browser"
                ? "브라우저 내부 구현 소스 · 인증/가입 서버 호출 없음"
                : props.data.trace.sourceRole === "configuration"
                  ? "요청이 통과하는 실제 서버 설정"
                  : props.data.trace.sourceRole === "observation"
                    ? "HTTP 응답 완료를 기록하는 실제 처리 로그 코드"
                    : "해당 처리 경계의 실제 구현 소스"}
            </small>
          </p>
        )}
        {props.children}
      </SceneCaption>
      <SceneViews
        value={mode}
        onChange={setMode}
        stations={props.data.nodes}
        station={station}
        onStation={setStation}
        disabled={failed}
      />
      <div className="auth-three-nodes">
        {props.data.nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className="auth-three-node"
            data-auth-node={node.id}
            data-count={node.count}
            data-fraction={node.fraction ?? ""}
            data-tone={node.tone}
            aria-pressed={props.data.node === node.id}
            aria-label={node.label + " 처리 단계·실제 소스 보기"}
            onClick={() => choose(node.id)}
          >
            <b>{node.label}</b>
            <small>{node.detail}</small>
          </button>
        ))}
      </div>
      <div className="auth-three-summary">
        {props.data.summary.map((text) => (
          <span key={text}>{text}</span>
        ))}
        <small>요소 선택 → 해당 처리 단계·실제 소스 · 주황색 = 현재 경로</small>
      </div>
    </div>
  );
}

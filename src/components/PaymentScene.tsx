import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Frame, Node, State } from "../payment-demo";
import SceneViews from "./SceneViews";
import { SceneRoles, SceneSource, SceneCaption } from "./SceneFlow";
import { applySceneCamera, type SceneView } from "../scene-view";
import "../project-view-layout.css";
import {
  paymentNodes,
  paymentNodeStep,
  paymentRing,
  paymentRoute,
} from "../payment-scene";

type Props = {
  view: State;
  frames: Frame[];
  step: number;
  playing: boolean;
  run: number;
  onSelectStep: (step: number) => void;
  onShowSource: () => void;
  children?: ReactNode;
};
const names: Record<Node, string> = {
  Browser: "브라우저",
  Server: "상점 서버",
  Redis: "Redis",
  DB: "상점 DB",
  PG: "독립 PG",
  "PG DB": "PG DB",
};
const colors = {
  shell: 0x36566a,
  screen: 0x112a39,
  edge: 0x52778a,
  wire: 0x355668,
  capture: 0x8ed8b4,
  cancel: 0xffb27b,
  reserved: 0xe7c269,
  query: 0x9fc5ef,
  error: 0xf09a88,
};
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

// The scene consumes selected snapshots. It never changes financial state or submits requests.
export default function PaymentScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    canvasHost = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    engine = useRef<{ update: () => void } | null>(null),
    [failed, setFailed] = useState(false),
    [epoch, setEpoch] = useState(0),
    [mode, setMode] = useState<SceneView>("overview"),
    [station, setStation] = useState<Node>("Browser");
  const viewpoint = useRef({ mode, station });
  viewpoint.current = { mode, station };
  latest.current = props;
  const current = props.frames[props.step],
    visual = current?.visual,
    ring = paymentRing(props.view),
    gate = props.frames
      .slice(0, props.step + 1)
      .reverse()
      .find((f) => f.visual?.kind === "dedupe")?.visual,
    active = visual?.to || current?.node,
    requestCount = gate?.packets || visual?.packets || 1;
  const choose = (node: Node, transaction?: string) => {
    setStation(node);
    const p = latest.current,
      index = paymentNodeStep(p.frames, node, p.step, transaction);
    if (index >= 0) p.onSelectStep(index);
  };
  const selectRef = useRef(choose);
  selectRef.current = choose;
  useEffect(() => {
    const target = host.current,
      canvasTarget = canvasHost.current;
    if (!target || !canvasTarget) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      target.dataset.ready = "fallback";
      return;
    }
    setFailed(false);
    target.dataset.ready = "true";
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasTarget.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-5.8, 5.8, 4, -4, 0.1, 60);
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0, -0.6);
    scene.add(new THREE.HemisphereLight(0xe2f2ff, 0x10212b, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-4, 9, 7);
    scene.add(sun);
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      pickables: THREE.Object3D[] = [];
    const standard = (color: number, glow = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.18,
        emissive: color,
        emissiveIntensity: glow,
      });
      materials.add(m);
      return m;
    };
    const shell = standard(colors.shell),
      screen = standard(colors.screen),
      edge = standard(colors.edge),
      capture = standard(colors.capture, 0.1),
      cancel = standard(colors.cancel, 0.1),
      reserved = standard(colors.reserved, 0.1),
      packetMat = standard(colors.capture, 0.35);
    const mesh = (
      g: THREE.BufferGeometry,
      m: THREE.Material,
      parent: THREE.Object3D = scene,
    ) => {
      geometries.add(g);
      const obj = new THREE.Mesh(g, m);
      parent.add(obj);
      return obj;
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
      const obj = mesh(new RoundedBoxGeometry(w, h, d, 2, 0.035), m, parent);
      obj.position.set(x, y, z);
      return obj;
    };
    const positions: Record<Node, THREE.Vector3> = {
      Browser: new THREE.Vector3(-3.8, 0, 1.5),
      Server: new THREE.Vector3(0, 0, 1.5),
      DB: new THREE.Vector3(3.8, 0, 1.5),
      Redis: new THREE.Vector3(-3.8, 0, -3),
      PG: new THREE.Vector3(0, 0, -3),
      "PG DB": new THREE.Vector3(3.8, 0, -3),
    };
    const nodes = {} as Record<
      Node,
      {
        group: THREE.Group;
        halo: THREE.Mesh;
        ring: THREE.Group;
        rows?: THREE.InstancedMesh;
      }
    >;
    const rowGeometry = new THREE.BoxGeometry(0.67, 0.09, 0.38);
    geometries.add(rowGeometry);
    const rowMaterial = standard(0xffffff, 0.1);
    for (const id of paymentNodes) {
      const group = new THREE.Group();
      group.position.copy(positions[id]);
      scene.add(group);
      const ringGroup = new THREE.Group();
      group.add(ringGroup);
      ringGroup.position.y = -0.08;
      const haloMat = new THREE.MeshBasicMaterial({
        color: colors.capture,
        transparent: true,
        opacity: 0.17,
      });
      materials.add(haloMat);
      const halo = mesh(new THREE.RingGeometry(0.73, 0.9, 48), haloMat, group);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.12;
      halo.visible = false;
      nodes[id] = { group, halo, ring: ringGroup };
      if (id === "Browser") {
        box(group, 1.4, 0.9, 0.13, 0, 0.6, 0);
        box(group, 1.18, 0.66, 0.04, 0, 0.6, 0.09, screen);
        box(group, 0.13, 0.44, 0.15, 0, -0.04, 0);
        box(group, 0.75, 0.08, 0.45, 0, -0.22, 0.1);
        box(group, 0.65, 0.05, 0.03, 0, 0.6, 0.13, capture);
      } else if (id === "DB" || id === "PG DB" || id === "Redis") {
        for (let i = 0; i < 3; i++) {
          const disk = mesh(
            new THREE.CylinderGeometry(0.51, 0.51, 0.18, 36),
            shell,
            group,
          );
          disk.position.y = 0.07 + i * 0.23;
        }
        const cap = mesh(
          new THREE.CylinderGeometry(0.51, 0.51, 0.035, 36),
          screen,
          group,
        );
        cap.position.y = 0.63;
        if (id !== "Redis") {
          const rows = new THREE.InstancedMesh(rowGeometry, rowMaterial, 8);
          rows.frustumCulled = false;
          rows.count = 0;
          group.add(rows);
          nodes[id].rows = rows;
          rows.userData.node = id;
          rows.userData.ledger = true;
          pickables.push(rows);
        }
      } else {
        box(group, 0.94, 1.2, 0.66, 0, 0.42, 0);
        for (let i = 0; i < 3; i++) {
          box(group, 0.77, 0.22, 0.04, 0, 0.8 - i * 0.32, 0.36, screen);
          box(group, 0.08, 0.045, 0.03, 0.25, 0.8 - i * 0.32, 0.4, capture);
        }
      }
      group.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj !== halo &&
          obj !== nodes[id].rows
        ) {
          obj.userData.node = id;
          pickables.push(obj);
        }
      });
    }
    const gateGroup = new THREE.Group();
    gateGroup.position
      .copy(positions.Server)
      .add(new THREE.Vector3(-0.94, 0, 0.1));
    scene.add(gateGroup);
    const gateParts = [
      box(gateGroup, 0.08, 1.35, 0.12, 0, 0.54, -0.3, edge),
      box(gateGroup, 0.08, 1.35, 0.12, 0, 0.54, 0.3, edge),
      box(gateGroup, 0.08, 0.1, 0.72, 0, 1.2, 0, edge),
    ];
    gateParts.forEach((p) => {
      p.userData.gate = true;
      pickables.push(p);
    });
    const grid = new THREE.GridHelper(12, 12, colors.wire, colors.wire);
    grid.position.set(0, -0.25, -0.5);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.17;
    materials.add(grid.material as THREE.Material);
    geometries.add(grid.geometry);
    scene.add(grid);
    const tubes: THREE.Mesh[] = [];
    const lineMat = new THREE.MeshBasicMaterial({
      color: colors.wire,
      transparent: true,
      opacity: 0.8,
    });
    materials.add(lineMat);
    for (const [a, b] of [
      ["Browser", "Server"],
      ["Server", "Redis"],
      ["Server", "DB"],
      ["Server", "PG"],
      ["PG", "PG DB"],
    ] as [Node, Node][]) {
      const start = positions[a].clone().add(new THREE.Vector3(0, 1.1, 0)),
        end = positions[b].clone().add(new THREE.Vector3(0, 1.1, 0)),
        mid = start.clone().lerp(end, 0.5);
      mid.y += 0.4;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const arrow = mesh(
        new THREE.ConeGeometry(0.085, 0.24, 12),
        standard(colors.query),
      );
      arrow.position.copy(curve.getPointAt(0.68));
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        curve.getTangentAt(0.68),
      );
      tubes.push(
        mesh(new THREE.TubeGeometry(curve, 32, 0.014, 6, false), lineMat),
      );
    }
    const packet = mesh(
      new RoundedBoxGeometry(0.23, 0.14, 0.3, 2, 0.02),
      packetMat,
    );
    packet.visible = false;
    const activePath = mesh(new THREE.BufferGeometry(), packetMat);
    const direction = mesh(new THREE.ConeGeometry(0.1, 0.28, 12), packetMat);
    activePath.visible = direction.visible = false;
    const crowdGeometry = new THREE.BoxGeometry(0.16, 0.1, 0.23);
    geometries.add(crowdGeometry);
    const crowd = new THREE.InstancedMesh(crowdGeometry, capture, 24);
    crowd.count = 0;
    crowd.frustumCulled = false;
    scene.add(crowd);
    const dummy = new THREE.Object3D();
    const faultGroup = new THREE.Group();
    const faultMat = new THREE.MeshBasicMaterial({ color: colors.error });
    materials.add(faultMat);
    const x1 = box(faultGroup, 0.62, 0.055, 0.055, 0, 0, 0, faultMat);
    x1.rotation.z = Math.PI / 4;
    const x2 = box(faultGroup, 0.62, 0.055, 0.055, 0, 0, 0, faultMat);
    x2.rotation.z = -Math.PI / 4;
    scene.add(faultGroup);
    faultGroup.visible = false;
    const queryMat = new THREE.LineDashedMaterial({
      color: colors.query,
      dashSize: 0.1,
      gapSize: 0.1,
    });
    materials.add(queryMat);
    let queryLine: THREE.Line | undefined;
    let width = 0,
      height = 0,
      raf = 0,
      visible = true,
      destroyed = false,
      lost = false,
      lastKey = "",
      signature = "",
      progress = 1,
      lastPlaying = false,
      startTime = 0,
      startProgress = 0,
      route: THREE.Curve<THREE.Vector3> | undefined;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function makeRoute() {
      const f = latest.current.frames[latest.current.step],
        path = paymentRoute(f);
      if (path.length < 2) return undefined;
      const points = path.map((n) =>
        positions[n].clone().add(new THREE.Vector3(0, 1.1, 0)),
      );
      if (f.visual?.kind === "dedupe")
        points[0] = gateGroup.position
          .clone()
          .add(new THREE.Vector3(-0.5, 0.55, 0));
      if (points.length === 2) {
        const mid = points[0].clone().lerp(points[1], 0.5);
        mid.y += 0.38;
        return new THREE.QuadraticBezierCurve3(points[0], mid, points[1]);
      }
      return new THREE.CatmullRomCurve3(points, false, "centripetal");
    }
    function ringUpdate(
      group: THREE.Group,
      segments: ReturnType<typeof paymentRing>["segments"],
      approved: number,
    ) {
      for (const child of [...group.children]) {
        const g = (child as THREE.Mesh).geometry;
        geometries.delete(g);
        g.dispose();
        group.remove(child);
      }
      if (!approved) {
        const t = mesh(
          new THREE.TorusGeometry(0.75, 0.022, 8, 64),
          edge,
          group,
        );
        t.rotation.x = -Math.PI / 2;
        return;
      }
      let cursor = 0;
      for (const s of segments) {
        const outer = s.outer,
          radius = outer ? 0.98 : 0.75,
          part = mesh(
            new THREE.TorusGeometry(
              radius,
              s.kind === "reserved" ? 0.065 : 0.045,
              8,
              72,
              Math.min(1, s.share) * Math.PI * 2,
            ),
            s.kind === "canceled"
              ? cancel
              : s.kind === "reserved"
                ? reserved
                : capture,
            group,
          );
        part.rotation.x = -Math.PI / 2;
        part.rotation.z = outer ? 0 : -cursor;
        if (!outer) cursor += s.share * Math.PI * 2;
      }
    }
    function snapshots() {
      const p = latest.current,
        s = p.view,
        next = JSON.stringify([
          s.ledger,
          s.transactions,
          s.captured,
          s.canceled,
          s.reserved,
        ]);
      if (signature === next) return;
      signature = next;
      const r = paymentRing(s);
      ringUpdate(nodes.DB.ring, r.segments, r.approved);
      const pgRing = paymentRing({
        captured: s.pgCaptured,
        canceled: s.pgCanceled,
        reserved: 0,
      });
      ringUpdate(nodes["PG DB"].ring, pgRing.segments, pgRing.approved);
      for (const [id, list] of [
        ["DB", s.ledger],
        ["PG DB", s.transactions],
      ] as const) {
        const rows = nodes[id].rows!,
          shown = list.slice(-8);
        rows.count = shown.length;
        for (let i = 0; i < shown.length; i++) {
          dummy.position.set(0, 0.72 + i * 0.105, 0);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          rows.setMatrixAt(i, dummy.matrix);
          rows.setColorAt(
            i,
            new THREE.Color(
              shown[i].kind === "CAPTURE" ? colors.capture : colors.cancel,
            ),
          );
        }
        rows.instanceMatrix.needsUpdate = true;
        rows.computeBoundingSphere();
        if (rows.instanceColor) rows.instanceColor.needsUpdate = true;
        rows.userData.transactions = shown.map((t) => t.id);
      }
    }
    function labels() {
      for (const n of paymentNodes) {
        const label = target!.querySelector<HTMLElement>(
          '[data-scene-node="' + n + '"]',
        );
        if (!label) continue;
        const top = positions[n]
          .clone()
          .add(
            new THREE.Vector3(0, n === "DB" || n === "PG DB" ? 1.95 : 1.65, 0),
          )
          .project(camera);
        label.style.left = ((top.x + 1) * width) / 2 + "px";
        label.style.top =
          canvasTarget!.getBoundingClientRect().top -
          target!.getBoundingClientRect().top +
          ((-top.y + 1) * height) / 2 +
          "px";
      }
    }
    function draw() {
      if (destroyed || lost || width <= 0 || height <= 0 || !visible) return;
      const cam = viewpoint.current,
        focus = positions[cam.station];
      applySceneCamera(
        camera,
        cam.mode,
        focus,
        route ? route.getPointAt(progress) : focus,
        width,
        height,
      );
      target!.dataset.camera = camera.position
        .toArray()
        .map((n) => n.toFixed(3))
        .join(",");
      renderer.render(scene, camera);
      target!.dataset.renderCount = String(
        Number(target!.dataset.renderCount || 0) + 1,
      );
      labels();
    }
    function applyProgress(t: number) {
      const p = latest.current,
        f = p.frames[p.step],
        v = f?.visual;
      target!.dataset.progress = t.toFixed(3);
      target!.dataset.motion =
        p.playing && !motion.matches ? "playing" : "still";
      packet.visible = !!route && v?.kind !== "dedupe";
      crowd.count = 0;
      faultGroup.visible = false;
      if (!v || !route) {
        packet.visible = false;
        return;
      }
      const blocked = v.kind === "blocked",
        dropped = !!v.lost,
        point = route.getPointAt(Math.min(blocked ? 0.52 : 1, t));
      packet.position.copy(point);
      packet.material = packetMat;
      packetMat.color.setHex(
        v.kind === "query"
          ? colors.query
          : v.operation?.startsWith("cancel") ||
              v.operation?.startsWith("compensate")
            ? colors.cancel
            : colors.capture,
      );
      packetMat.emissive.copy(packetMat.color);
      packet.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        route.getTangentAt(Math.min(t, 0.999)),
      );
      if ((blocked || dropped) && t > 0.5) {
        faultGroup.visible = true;
        faultGroup.position.copy(route.getPointAt(0.52));
        faultGroup.quaternion.copy(camera.quaternion);
        if (dropped) packet.visible = false;
      }
      if ((v.packets || 1) > 1 || v.kind === "dedupe") {
        packet.visible = false;
        crowd.count = Math.min(v.packets || 1, 24);
        for (let i = 0; i < crowd.count; i++) {
          const u = Math.max(0, Math.min(1, t * 1.4 - i * 0.022)),
            point = route.getPointAt(u);
          dummy.position
            .copy(point)
            .add(
              new THREE.Vector3(
                0,
                (i % 4) * 0.075,
                (Math.floor(i / 4) - 2) * 0.045,
              ),
            );
          dummy.rotation.set(0, 0, 0);
          const admitted = v.kind !== "dedupe" || i < (v.forwarded || 0);
          dummy.scale.setScalar(
            v.kind === "dedupe" && !admitted && u > 0.75 ? 0.001 : 1,
          );
          dummy.updateMatrix();
          crowd.setMatrixAt(i, dummy.matrix);
        }
        crowd.instanceMatrix.needsUpdate = true;
      }
    }
    function animate(now: number) {
      raf = 0;
      if (destroyed || lost || !visible) return;
      progress = Math.min(1, startProgress + (now - startTime) / 580);
      applyProgress(progress);
      draw();
      if (progress < 1 && latest.current.playing && !motion.matches)
        raf = requestAnimationFrame(animate);
    }
    function update() {
      if (destroyed || lost) return;
      const p = latest.current,
        key =
          p.run + ":" + p.step + ":" + (p.frames[p.step]?.source || "ready");
      cancelAnimationFrame(raf);
      raf = 0;
      snapshots();
      const changed = key !== lastKey;
      if (changed) {
        lastKey = key;
        progress = p.playing && !motion.matches ? 0 : 1;
        route = makeRoute();
        const visual = p.frames[p.step]?.visual;
        activePath.visible = !!route && visual?.kind !== "query";
        direction.visible = !!route;
        geometries.delete(activePath.geometry);
        activePath.geometry.dispose();
        const blocked = visual?.kind === "blocked" || visual?.lost;
        const shown =
          route && blocked
            ? new THREE.CatmullRomCurve3(
                Array.from({ length: 21 }, (_, i) =>
                  route!.getPointAt((i / 20) * 0.52),
                ),
              )
            : route;
        activePath.geometry = shown
          ? new THREE.TubeGeometry(shown, 40, 0.025, 8, false)
          : new THREE.BufferGeometry();
        geometries.add(activePath.geometry);
        if (route) {
          direction.position.copy(route.getPointAt(blocked ? 0.4 : 0.68));
          direction.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            route.getTangentAt(blocked ? 0.4 : 0.68),
          );
        }
        if (queryLine) {
          scene.remove(queryLine);
          queryLine.geometry.dispose();
          geometries.delete(queryLine.geometry);
          queryLine = undefined;
        }
        if (route && p.frames[p.step]?.visual?.kind === "query") {
          const g = new THREE.BufferGeometry().setFromPoints(
            route.getPoints(48),
          );
          geometries.add(g);
          queryLine = new THREE.Line(g, queryMat);
          queryLine.computeLineDistances();
          scene.add(queryLine);
        }
      }
      const current = p.frames[p.step],
        highlight = current?.visual?.to || current?.node;
      for (const n of paymentNodes) nodes[n].halo.visible = n === highlight;
      if (!changed && p.playing && !lastPlaying && progress >= 1) progress = 0;
      applyProgress(progress);
      draw();
      if (p.playing && !motion.matches && progress < 1 && visible) {
        startTime = performance.now();
        startProgress = progress;
        raf = requestAnimationFrame(animate);
      }
      lastPlaying = p.playing;
    }
    const resize = new ResizeObserver(() => {
      width = target.clientWidth;
      height = canvasTarget.clientHeight;
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      const half = Math.max(5.8, (3.8 * width) / height);
      camera.left = -half;
      camera.right = half;
      camera.top = (half * height) / width;
      camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
      update();
    });
    resize.observe(canvasTarget);
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
    intersection.observe(target);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const click = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(pickables)[0];
      if (!hit) return;
      const p = latest.current;
      if (hit.object.userData.gate) {
        const i = p.frames
          .map((f, i) => (f.visual?.kind === "dedupe" ? i : -1))
          .filter((i) => i >= 0)
          .at(-1);
        if (i !== undefined) p.onSelectStep(i);
        return;
      }
      const node = hit.object.userData.node as Node,
        transaction =
          hit.instanceId === undefined
            ? undefined
            : hit.object.userData.transactions?.[hit.instanceId];
      selectRef.current(node, transaction);
    };
    renderer.domElement.addEventListener("click", click);
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      setFailed(true);
      target.dataset.ready = "fallback";
    };
    const onRestored = () => setEpoch((n) => n + 1);
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
      nodes.DB.rows?.dispose();
      nodes["PG DB"].rows?.dispose();
      crowd.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [epoch]);
  useEffect(
    () => engine.current?.update(),
    [
      props.view,
      props.frames,
      props.step,
      props.playing,
      props.run,
      mode,
      station,
    ],
  );
  return (
    <div
      ref={host}
      className="payment-three"
      role="group"
      aria-label="결제 요청 패킷·중복 게이트·상점과 PG 원장·취소 예약 링"
      data-source={current?.source || "ready"}
      data-selected-step={props.step}
      data-ring-approved={ring.approved}
      data-ring-canceled={ring.canceled}
      data-ring-reserved={ring.reserved}
      data-overbooked={ring.overbooked}
      data-packets={visual?.packets || 1}
      data-forwarded={gate?.forwarded ?? ""}
      data-view={mode}
      data-station={station}
    >
      <SceneRoles
        roles={["사용자 · 결제 요청", "상점 서버 · 원장", "독립 PG · 원장"]}
      />
      <div className="lab-scene-stage-wrap">
        <div className="payment-three-stage" ref={canvasHost} />
        <SceneSource onClick={props.onShowSource} />
      </div>
      <div className="payment-three-labels">
        {paymentNodes.map((node) => (
          <button
            key={node}
            data-scene-node={node}
            className={"payment-node " + (active === node ? "active" : "")}
            disabled={paymentNodeStep(props.frames, node, props.step) < 0}
            onClick={() => choose(node)}
            aria-label={names[node] + " 처리 단계와 실제 소스 보기"}
          >
            <b>{names[node]}</b>
            {node === "DB" || node === "PG DB" ? (
              <span
                data-testid={
                  node === "DB" ? "scene-merchant-ledger" : "scene-pg-ledger"
                }
              >
                원장{" "}
                {node === "DB"
                  ? props.view.ledger.length
                  : props.view.transactions.length}
                건
              </span>
            ) : node === "Server" ? (
              <span>
                승인 작업{" "}
                {props.view.ops.filter((o) => o.kind === "CONFIRM").length}개
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {failed && (
        <p className="payment-three-fallback" role="status">
          3D 화면을 표시할 수 없습니다. 아래 단계·금액·실제 소스에서 같은 상태를
          확인할 수 있습니다.
        </p>
      )}
      <SceneCaption
        route={
          visual?.from && visual?.to
            ? `${names[visual.from]} → ${names[visual.to]}`
            : current?.node
              ? names[current.node]
              : "결제 요청 → 중복 게이트 → 상점·PG 원장"
        }
        step={props.step}
        total={props.frames.length}
      >
        {props.children}
      </SceneCaption>
      <SceneViews
        value={mode}
        onChange={setMode}
        stations={paymentNodes.map((id) => ({ id, label: names[id] }))}
        station={station}
        onStation={(id) => setStation(id as Node)}
        disabled={failed}
      />
      <div className="payment-three-summary">
        <span className="payment-gate-state" data-testid="payment-gate-state">
          {gate
            ? `요청 ${requestCount}개 → 신규 작업 ${gate.forwarded}개 · 중복 ${requestCount - (gate.forwarded || 0)}개 합류`
            : "같은 구매 의도 → canonical 승인 작업 하나"}
        </span>
        <span className="payment-ring-state" data-testid="payment-ring-state">
          <i className="available" />
          잔여 {won(ring.available)} <i className="canceled" />
          확정 취소 {won(ring.canceled)} <i className="reserved" />
          예약 {won(ring.reserved)}
        </span>
        {(ring.overbooked || props.view.sync === "REVIEW") && (
          <span className="payment-ring-review">
            REVIEW · 실제 취소와 미해결 예약을 함께 보존
          </span>
        )}
        {(props.view.ledger.length > 8 ||
          props.view.transactions.length > 8) && (
          <span>
            입체 원장은 최근 8건을 표시합니다. 전체 거래는 거래 비교에서
            확인하세요.
          </span>
        )}
      </div>
    </div>
  );
}

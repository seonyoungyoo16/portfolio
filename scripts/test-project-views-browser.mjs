import { chromium, expect } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import loginModel from "../src/generated/login-source.json" with { type: "json" };
import signupModel from "../src/generated/signup-source.json" with { type: "json" };
const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:5191/",
  published = new URL(base).hostname.endsWith("github.io"),
  out = path.join(
    "docs/project-view-verification",
    published ? "published" : "local",
  );
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage();
context.setDefaultTimeout(15000);
const checks = [],
  errors = [],
  requests = [],
  layouts = [],
  images = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/\/(api|lab|webhooks|oidc)\//.test(new URL(r.url()).pathname))
    requests.push(r.url());
});
const selector = {
  login: '.auth-three[data-scene-project="login"]',
  signup: '.auth-three[data-scene-project="signup"]',
  chat: ".chat-three-experience",
  payment: ".payment-three",
};
let project = "login";
const scene = () => page.locator(selector[project]);
async function go(p) {
  project = p;
  await page.goto(base + "#project/" + p);
  const flow = page.getByRole("tab", { name: "흐름·소스", exact: true });
  if (await flow.isVisible()) await flow.click();
  await expect(scene().locator("canvas")).toHaveCount(1);
  await scene().scrollIntoViewIfNeeded();
  const ready = p === "chat" ? scene().locator(".chat-three-scene") : scene();
  await expect(ready).toHaveAttribute("data-ready", "true");
}
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
};
const view = async (name) => {
  const settings = scene().locator("details.lab-scene-controls");
  if (!(await settings.evaluate((e) => e.open)))
    await settings.locator("summary").click();
  await scene().getByRole("button", { name, exact: true }).click();
  await expect(scene()).toHaveAttribute("data-view", name.toLowerCase());
};
const finish = async () => {
  await page
    .getByRole("button", { name: "마지막으로 ⇥", exact: true })
    .evaluate((b) => {
      if (!b.disabled) b.click();
    });
  await expect(page.getByTestId(project + "-result")).not.toContainText(
    "처리 단계 재생 중",
  );
};
const act = async (label) => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await finish();
};
const authNode = (id) => scene().locator(`[data-auth-node="${id}"]`);
const sourceMatch = async () => {
  const key = await scene().getAttribute("data-source"),
    m = project === "login" ? loginModel : signupModel,
    s = m.sources[key];
  expect(s, "frozen source " + key).toBeTruthy();
  await expect(page.locator(`.${project}-source>a`)).toHaveAttribute(
    "href",
    `${m.repo}/blob/${m.revision}/${s.file}#L${s.line}`,
  );
};
const snapshot = async () =>
  page.evaluate((p) => {
    const root = document.querySelector(
      p === "chat"
        ? ".chat-three-experience"
        : p === "payment"
          ? ".payment-three"
          : ".auth-three",
    );
    return {
      source: root.getAttribute("data-source"),
      step:
        root.getAttribute("data-step") ||
        root.getAttribute("data-selected-step"),
      counts: [...root.querySelectorAll("[data-auth-node]")].map((n) => [
        n.dataset.authNode,
        n.dataset.count,
        n.dataset.fraction,
      ]),
      financial:
        p === "payment"
          ? [
              root.dataset.ringApproved,
              root.dataset.ringCanceled,
              root.dataset.ringReserved,
            ]
          : null,
      chat:
        p === "chat"
          ? [
              localStorage.getItem("chat-lab:v1"),
              sessionStorage.getItem("chat-lab:outbox:v1"),
            ]
          : null,
    };
  }, project);
try {
  await check(
    "flow-first UI: roles → scene → current step → collapsed auxiliary View, with working source access",
    async () => {
      for (const p of ["login", "signup", "chat", "payment"]) {
        await go(p);
        await expect(scene().locator(".lab-scene-roles > span")).toHaveCount(3);
        await expect(
          scene().locator("details.lab-scene-controls"),
        ).not.toHaveAttribute("open", "");
        const order = await scene().evaluate((root) => {
          const top = (selector) =>
            root.querySelector(selector).getBoundingClientRect().top;
          return [
            top(".lab-scene-roles"),
            top("canvas"),
            top(".lab-scene-caption"),
            top(".lab-scene-controls"),
          ];
        });
        expect(order.every((n, i) => !i || n > order[i - 1])).toBe(true);
        const before = await snapshot();
        await scene()
          .getByRole("button", { name: "현재 단계 소스 ↗", exact: true })
          .click();
        const source = page.locator(
          p === "chat" ? ".chat-source-panel > a" : `.${p}-source > a`,
        );
        await expect(source).toBeVisible();
        await expect(source).toHaveAttribute(
          "href",
          /github\.com\/.*\/blob\/[a-f0-9]{40}\//,
        );
        await expect(scene()).toHaveAttribute("data-view", "overview");
        expect(await snapshot()).toEqual(before);
        await scene().screenshot({
          path: path.join(out, `${p}-flow-first.png`),
        });
      }
    },
  );
  for (const p of ["login", "signup", "chat", "payment"]) {
    await check(
      `${p}: all five View presets move the actual camera and rendered geometry without changing state`,
      async () => {
        await go(p);
        const before = await snapshot(),
          hashes = [],
          poses = [];
        for (const name of ["Overview", "Side", "Top", "Station", "Flight"]) {
          await view(name);
          await expect(
            scene().getByRole("button", { name, exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
          const camera =
            p === "chat" ? scene().locator(".chat-three-scene") : scene();
          await expect(camera).toHaveAttribute("data-camera", /.+,.*,/);
          await page.waitForTimeout(70);
          poses.push(await camera.getAttribute("data-camera"));
          hashes.push(
            crypto
              .createHash("sha256")
              .update(await scene().locator("canvas").screenshot())
              .digest("hex"),
          );
          await scene().screenshot({
            path: path.join(out, `${p}-${name.toLowerCase()}.png`),
          });
        }
        expect(new Set(poses).size).toBe(5);
        expect(new Set(hashes).size).toBe(5);
        const renderer =
          p === "chat" ? scene().locator(".chat-three-scene") : scene();
        await page.waitForTimeout(100);
        const draws = await renderer.getAttribute("data-render-count");
        await page.waitForTimeout(160);
        expect(await renderer.getAttribute("data-render-count")).toBe(draws);
        expect(await snapshot()).toEqual(before);
        images.push({ project: p, poses, canvasHashes: hashes });
        await view("Overview");
      },
    );
  }
  await check(
    "login: PREPARING has no browser cookie, Redis stores before activation, exact Java source follows",
    async () => {
      await go("login");
      await act("로그인하고 흐름 보기 →");
      await page
        .locator(".login-steps button")
        .filter({ hasText: "기기 인증과 PREPARING 커밋" })
        .click();
      await expect(authNode("browser")).toHaveAttribute("data-count", "0");
      await expect(authNode("database")).toHaveAttribute("data-count", "1");
      await sourceMatch();
      await page
        .locator(".login-steps button")
        .filter({ hasText: "공유 세션 저장" })
        .click();
      await expect(authNode("redis")).toHaveAttribute("data-count", "1");
      await expect(authNode("redis")).toHaveAttribute("data-fraction", "1");
      await expect(authNode("browser")).toHaveAttribute("data-count", "0");
      await sourceMatch();
      await finish();
      await expect(authNode("browser")).toHaveAttribute("data-count", "2");
      await scene().screenshot({ path: path.join(out, "login-issued.png") });
    },
  );
  await check(
    "login: a real 3D database pick keeps the whole flow visible and opens its processing source",
    async () => {
      await view("Overview");
      const r = await scene().locator("canvas").boundingBox(),
        half = Math.max(5.8, (2.6 * r.width) / r.height),
        camera = new OrthographicCamera(
          -half,
          half,
          (half * r.height) / r.width,
          (-half * r.height) / r.width,
          0.1,
          80,
        );
      camera.position.set(0, 10, 15);
      camera.lookAt(0, 0.35, -0.6);
      camera.updateMatrixWorld();
      const point = new Vector3(3.7, 0.5, 0.7).project(camera);
      await page.mouse.click(
        r.x + ((point.x + 1) * r.width) / 2,
        r.y + ((1 - point.y) * r.height) / 2,
      );
      await expect(scene()).toHaveAttribute("data-view", "overview");
      await expect(scene()).toHaveAttribute("data-station", "database");
      await sourceMatch();
      await expect(page.locator(".login-source>a")).toContainText(
        "AuthService.java",
      );
      await finish();
    },
  );
  await check(
    "login: TTL expiry rotation revocation and outage use the selected snapshot only",
    async () => {
      await act("+30분");
      await expect(authNode("redis")).toHaveAttribute("data-fraction", "0");
      await expect(authNode("database")).toHaveAttribute("data-count", "1");
      await act("로그인 복원");
      await expect(authNode("browser")).toContainText("g1");
      await act("Redis 정상 → 차단");
      await expect(authNode("redis")).toHaveAttribute("data-tone", "red");
      await expect(authNode("database")).toHaveAttribute("data-count", "2");
      await act("Redis 차단 → 복구");
      await act("현재 기기 로그아웃");
      await expect(authNode("browser")).toHaveAttribute("data-count", "0");
    },
  );
  await check(
    "login: Flight follows a moving packet and pause freezes its selected position",
    async () => {
      await act("실험 초기화 ↺");
      await act("로그인하고 흐름 보기 →");
      await scene().locator("details.lab-scene-controls > summary").focus();
      await page.keyboard.press("Enter");
      await page
        .locator(".login-steps button")
        .filter({ hasText: "공유 세션 저장" })
        .click();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await view("Flight");
      await page
        .getByRole("button", { name: "흐름 재생", exact: true })
        .click();
      await expect
        .poll(async () => Number(await scene().getAttribute("data-progress")))
        .toBeGreaterThan(0.03);
      const before = await scene().getAttribute("data-camera");
      await page.waitForTimeout(100);
      expect(await scene().getAttribute("data-camera")).not.toBe(before);
      await page
        .getByRole("button", { name: "흐름 일시 정지", exact: true })
        .click();
      const stopped = await scene().getAttribute("data-camera");
      await page.waitForTimeout(140);
      expect(await scene().getAttribute("data-camera")).toBe(stopped);
      await finish();
      await page.emulateMedia({ reducedMotion: "reduce" });
    },
  );
  await check(
    "signup: SMTP receipt email proof and atomic account commit remain visually distinct",
    async () => {
      await go("signup");
      await act("인증 메일 요청");
      await expect(authNode("SMTP")).toHaveAttribute("data-count", "0");
      await expect(authNode("Browser")).toHaveAttribute("data-count", "0");
      await act("메일 작업자 실행");
      await expect(authNode("SMTP")).toHaveAttribute("data-count", "1");
      await expect(authNode("Browser")).toHaveAttribute("data-count", "0");
      await page
        .locator(".signup-mails article")
        .last()
        .getByRole("button")
        .click();
      await finish();
      await act("이메일 확인 POST");
      await expect(authNode("Browser")).toHaveAttribute("data-count", "1");
      await expect(authNode("DB")).toHaveAttribute("data-count", "1");
      await page.getByLabel("필수 약관 동의", { exact: true }).check();
      await act("가입 확정하고 흐름 보기 →");
      await expect(authNode("DB")).toHaveAttribute("data-count", "2");
      await expect(authNode("Server")).toContainText("자동 로그인 없음");
      await authNode("DB").click();
      await sourceMatch();
      await scene().screenshot({
        path: path.join(out, "signup-account-gate.png"),
      });
    },
  );
  await check(
    "signup: SSO proof has no linked identity until explicit confirmation",
    async () => {
      await act("실험 초기화 ↺");
      await page.getByLabel("공급자 실습 신원").selectOption("match");
      await act("기존 계정 로그인");
      await act("외부 신원 연결 시작");
      await expect(authNode("IdP")).toHaveAttribute("data-count", "0");
      await expect(authNode("IdP")).toHaveAttribute("data-tone", "amber");
      await act("확인한 외부 신원 연결 확정");
      await expect(authNode("IdP")).toHaveAttribute("data-count", "1");
      await expect(authNode("IdP")).toHaveAttribute("data-tone", "mint");
      await authNode("IdP").click();
      await sourceMatch();
      await scene().screenshot({ path: path.join(out, "signup-sso-link.png") });
    },
  );
  await check(
    "signup: unavailable SMTP retains outbox and never creates an ownership proof",
    async () => {
      await act("실험 초기화 ↺");
      await act("인증 메일 요청");
      await act("SMTP 정상 → 차단");
      await act("메일 작업자 실행");
      await expect(authNode("SMTP")).toHaveAttribute("data-tone", "red");
      await expect(authNode("SMTP")).toContainText("outbox 유지");
      await expect(authNode("Browser")).toHaveAttribute("data-count", "0");
      await expect(authNode("DB")).toHaveAttribute("data-count", "1");
    },
  );
  await check(
    "payment: changing View preserves separate PG and merchant snapshot amounts",
    async () => {
      await go("payment");
      await act("주문 생성");
      await act("PG 인증");
      await act("결제 확정 →");
      await page
        .locator(".payment-steps button")
        .filter({ hasText: "독립 PG 승인/취소 거래 커밋" })
        .click();
      const before = await snapshot();
      await expect(scene().getByTestId("scene-pg-ledger")).toContainText("1건");
      await expect(scene().getByTestId("scene-merchant-ledger")).toContainText(
        "0건",
      );
      for (const name of ["Top", "Side", "Station", "Flight"]) {
        await view(name);
        expect(await snapshot()).toEqual(before);
      }
      await finish();
      await expect(scene()).toHaveAttribute("data-ring-approved", "10000");
    },
  );
  await check(
    "chat: camera focus opens the existing database source and Kafka offers its own stations",
    async () => {
      await go("chat");
      await view("Station");
      await scene()
        .locator(".chat-view-nodes button")
        .filter({ hasText: "대화 DB" })
        .click();
      await expect(page.locator(".chat-source-panel")).toBeVisible();
      await expect(page.locator(".chat-source-panel>a")).toHaveAttribute(
        "href",
        /springboot-chat-lab\/blob\//,
      );
      await page.getByRole("radio", { name: /Kafka/ }).check();
      await view("Station");
      await scene()
        .getByLabel("확대할 요소", { exact: true })
        .selectOption("broker");
      await expect(scene()).toHaveAttribute("data-station", "broker");
      await expect(
        scene().getByLabel("확대할 요소", { exact: true }).locator("option"),
      ).toHaveCount(6);
      await scene().screenshot({
        path: path.join(out, "chat-kafka-station.png"),
      });
    },
  );
  await check(
    "four projects keep all five camera controls usable at 320 390 768 1440 1800 widths",
    async () => {
      for (const width of [320, 390, 768, 1440, 1800]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const p of ["login", "signup", "chat", "payment"]) {
          await go(p);
          for (const name of ["Top", "Station", "Overview"]) {
            await view(name);
            if (name === "Station")
              await scene()
                .getByRole("button", { name: "다음 요소", exact: true })
                .click();
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            p + " overflow at " + width,
          ).toBe(true);
          const buttons = await scene()
            .locator(".lab-view-button")
            .evaluateAll((ns) =>
              ns.map((n) => n.getBoundingClientRect().toJSON()),
            );
          for (let i = 1; i < buttons.length; i++)
            expect(buttons[i].left >= buttons[i - 1].right - 1).toBe(true);
          layouts.push({
            project: p,
            width,
            sceneWidth: await scene().evaluate((e) => e.clientWidth),
          });
          if (width === 390 || width === 1440) {
            await scene().locator("details.lab-scene-controls > summary").click();
            await scene().screenshot({
              path: path.join(out, `${p}-responsive-${width}.png`),
            });
          }
        }
      }
    },
  );
  await check(
    "reduced motion and keyboard navigation retain source access",
    async () => {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await go("login");
      await act("로그인하고 흐름 보기 →");
      await scene().locator("details.lab-scene-controls > summary").focus();
      await page.keyboard.press("Enter");
      await scene().getByRole("button", { name: "Top", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(scene()).toHaveAttribute("data-view", "top");
      await authNode("database").focus();
      await page.keyboard.press("Enter");
      await expect(scene()).toHaveAttribute("data-view", "top");
      await expect(scene()).toHaveAttribute("data-motion", "still");
      await sourceMatch();
    },
  );
  await check(
    "context loss and restoration preserve selected login snapshot with one renderer",
    async () => {
      await scene()
        .locator("canvas")
        .evaluate((c) => {
          const e = c.getContext("webgl2").getExtension("WEBGL_lose_context");
          if (!e) throw Error("Context loss extension missing");
          window.restoreLabView = () => e.restoreContext();
          e.loseContext();
        });
      await expect(scene()).toHaveAttribute("data-ready", "fallback");
      await expect(scene().locator(".auth-three-fallback")).toBeVisible();
      await expect(authNode("database")).toHaveAttribute("data-count", "1");
      await page.waitForTimeout(180);
      await page.evaluate(() => window.restoreLabView());
      await expect(scene()).toHaveAttribute("data-ready", "true");
      await expect(scene().locator("canvas")).toHaveCount(1);
      await sourceMatch();
    },
  );
  await check(
    "all projects keep processing and source UI available without WebGL",
    async () => {
      const fallback = await chromium.launch({ args: ["--disable-webgl"] });
      try {
        const p = await fallback.newPage({
          viewport: { width: 390, height: 1000 },
        });
        for (const name of ["login", "signup", "chat", "payment"]) {
          await p.goto(base + "#project/" + name);
          const flow = p.getByRole("tab", { name: "흐름·소스", exact: true });
          if (await flow.isVisible()) await flow.click();
          const root = p.locator(selector[name]),
            ready = name === "chat" ? root.locator(".chat-three-scene") : root;
          await expect(ready).toHaveAttribute("data-ready", "fallback");
          await expect(root.locator(".lab-view-button:disabled")).toHaveCount(
            5,
          );
          await expect(root.locator('[class$="fallback"]')).toBeVisible();
          if (name === "chat") {
            const toggle = p.locator(".chat-source-toggle");
            if ((await toggle.getAttribute("aria-expanded")) === "false")
              await toggle.click();
            await expect(p.locator(".chat-source-panel>a")).toBeVisible();
          } else await expect(p.locator(`.${name}-source>a`)).toBeVisible();
          await root.screenshot({
            path: path.join(out, `${name}-fallback-390.png`),
          });
        }
      } finally {
        await fallback.close();
      }
    },
  );
  await check(
    "chat: camera switches during connection and sending retain one stored and delivered message",
    async () => {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await go("chat");
      for (const actor of [0, 1]) {
        const client = page.locator(`.client-${actor}`);
        await client
          .getByRole("button", { name: "다시 접속", exact: true })
          .click();
        await view("Top");
        await view("Flight");
        await expect(client.getByRole("textbox")).toBeEnabled({
          timeout: 30000,
        });
      }
      const body = "View 전환 중에도 한 번만 저장";
      await page.getByLabel("참가자 A 메시지 입력", { exact: true }).fill(body);
      await page
        .getByRole("button", { name: "참가자 A 보내기", exact: true })
        .click();
      await view("Station");
      await scene()
        .getByLabel("확대할 요소", { exact: true })
        .selectOption("database");
      await scene()
        .locator(".chat-view-nodes button")
        .filter({ hasText: "대화 DB" })
        .click();
      await expect(
        page.locator(".client-1 .chat-bubble").filter({ hasText: body }),
      ).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator(".chat-db-count strong")).toHaveText("1 rows");
      await expect(
        page.locator(".client-0 .chat-bubble").filter({ hasText: body }),
      ).toHaveCount(1);
      await scene().screenshot({
        path: path.join(out, "chat-live-message.png"),
      });
    },
  );
  await check(
    "board View controls and uniform project cards remain available",
    async () => {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(base + "#project/board");
      await expect(page.locator(".schema-camera button")).toHaveCount(6);
      await expect(page.locator(".schema-visual canvas")).toHaveCount(1);
      await page.goto(base + "#projects");
      await expect(page.locator(".project-list>.featured-project")).toHaveCount(
        5,
      );
    },
  );
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  fs.writeFileSync(
    path.join(out, "browser.json"),
    JSON.stringify(
      {
        status: "passed",
        verifiedAt: new Date().toISOString(),
        base,
        checks,
        images,
        layouts,
        pageErrors: errors,
        backendRequests: requests,
        scope:
          "Public simulation View and source linkage; existing real backend evidence is separate. Chromium viewports, not physical devices.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${checks.length} project View browser groups passed at ${base}`);
} catch (error) {
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}

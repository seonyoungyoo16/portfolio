import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openExperiments } from "./lab-browser-helpers.mjs";
import crypto from "node:crypto";
const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:5190/";
const out = path.join(
  "docs/payment-three-verification",
  base.includes("github.io") ? "published" : "local",
);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  }),
  page = await context.newPage();
context.setDefaultTimeout(15000);
const checks = [],
  errors = [],
  layout = [];
page.on("pageerror", (e) => errors.push(e.message));
const scene = page.locator(".payment-three"),
  source = page.locator(".payment-source>a"),
  steps = page.locator(".payment-steps button"),
  result = page.getByTestId("payment-result");
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
};
const finish = async () => {
  await page
    .getByRole("button", { name: "마지막으로 ⇥", exact: true })
    .evaluate((b) => {
      if (!b.disabled) b.click();
    });
  await expect(result).not.toContainText("처리 단계 재생 중");
};
const act = async (name) => {
  await openExperiments(page);
  await page.getByRole("button", { name, exact: true }).click();
  await finish();
};
const auth = async () => {
  await act("실험 초기화 ↺");
  await act("주문 생성");
  await act("PG 인증");
};
const paid = async () => {
  await auth();
  await act("결제 확정 →");
};
const frame = async (text) => {
  await steps.filter({ hasText: text }).click();
};
const attr = async (name, value) =>
  expect(scene).toHaveAttribute(name, String(value));
const tab = async (name) => {
  if (await page.getByRole("tab", { name, exact: true }).isVisible())
    await page.getByRole("tab", { name, exact: true }).click();
};
const noOverlap = async () =>
  scene.locator(".payment-node").evaluateAll((nodes) => {
    const rs = nodes.map((n) => n.getBoundingClientRect()),
      p = nodes[0].closest(".payment-three").getBoundingClientRect();
    return (
      rs.every(
        (r) =>
          r.left >= p.left - 1 && r.right <= p.right + 1 && r.top >= p.top - 1,
      ) &&
      rs.every((a, i) =>
        rs
          .slice(i + 1)
          .every(
            (b) =>
              a.right <= b.left + 1 ||
              b.right <= a.left + 1 ||
              a.bottom <= b.top + 1 ||
              b.bottom <= a.top + 1,
          ),
      )
    );
  });
try {
  await page.goto(base + "#project/payment");
  await check(
    "real WebGL canvas initializes and keeps native source controls",
    async () => {
      await expect(scene).toHaveAttribute("data-ready", "true");
      await expect(scene.locator("canvas")).toHaveCount(1);
      await expect(scene.locator(".payment-node")).toHaveCount(6);
      const info = await scene.locator("canvas").evaluate((c) => {
        const gl = c.getContext("webgl2");
        return {
          webgl: !!gl,
          version: gl?.getParameter(gl.VERSION),
          width: c.width,
          height: c.height,
        };
      });
      expect(info.webgl).toBe(true);
      expect(info.width).toBeGreaterThan(0);
      layout.push({ renderer: info });
    },
  );
  await check(
    "24 packets converge to one new canonical approval and one real displayed source",
    async () => {
      await auth();
      await act("같은 승인 24개 동시 요청");
      await frame("승인 요청 24개 → canonical 작업 1개");
      await attr("data-packets", 24);
      await attr("data-forwarded", 1);
      await attr("data-source", "PaymentService.confirm");
      await expect(page.getByTestId("payment-gate-state")).toContainText(
        "중복 23개 합류",
      );
      await expect(scene.locator('[data-scene-node="Server"]')).toContainText(
        "승인 작업 1개",
      );
      await expect(source).toHaveAttribute("href", /PaymentService.java#L/);
      await scene.screenshot({ path: path.join(out, "duplicate-gate.png") });
      await finish();
    },
  );
  await check(
    "replayed approval joins the existing operation without a second PG ledger row",
    async () => {
      await act("같은 승인 24개 동시 요청");
      await frame("같은 승인 요청은 기존 canonical 작업");
      await attr("data-forwarded", 0);
      await expect(page.getByTestId("scene-pg-ledger")).toHaveText("원장 1건");
      await expect(page.getByTestId("payment-gate-state")).toContainText(
        "중복 24개 합류",
      );
      await finish();
    },
  );
  await check(
    "PG commit and merchant commit have different visible rows and exact source selections",
    async () => {
      await paid();
      await frame("독립 PG 승인/취소 거래 커밋");
      await expect(page.getByTestId("scene-pg-ledger")).toHaveText("원장 1건");
      await expect(page.getByTestId("scene-merchant-ledger")).toHaveText(
        "원장 0건",
      );
      await attr("data-ring-approved", 0);
      await attr("data-source", "Psp.commitOperation");
      await scene.screenshot({
        path: path.join(out, "pg-before-merchant.png"),
      });
      await frame("PG 거래 유일성 검사");
      await expect(page.getByTestId("scene-merchant-ledger")).toHaveText(
        "원장 1건",
      );
      await attr("data-ring-approved", 10000);
      await attr("data-source", "PaymentProcessor.apply");
      await expect(source).toHaveAttribute("href", /PaymentProcessor.java#L/);
      await finish();
    },
  );
  await check(
    "a raycast on the actual PG ledger plate selects the frame where that transaction appeared",
    async () => {
      const label = await scene
          .locator('[data-scene-node="PG DB"]')
          .boundingBox(),
        canvas = await scene.locator("canvas").boundingBox();
      const x = label.x + label.width / 2,
        y =
          label.y +
          label.height / 2 +
          (1.23 * (15 / Math.sqrt(325)) * canvas.width) / 11.6;
      await page.mouse.click(x, y);
      await attr("data-source", "Psp.commitOperation");
      await expect(
        page.locator('.payment-steps [aria-current="step"]'),
      ).toContainText("독립 PG 승인/취소 거래 커밋");
      await scene.locator('[data-scene-node="DB"]').click();
      await attr("data-source", "PaymentService.confirm");
      await expect(source).toHaveAttribute("href", /PaymentService.java#L/);
      await finish();
      await scene.locator('[data-scene-node="DB"]').click();
      await attr("data-source", "PaymentProcessor.apply");
      await expect(source).toHaveAttribute("href", /PaymentProcessor.java#L/);
      await finish();
    },
  );
  await check(
    "request packets change real rendered pixels while playing and stop when paused",
    async () => {
      await frame("고정 작업 식별자·동일 PG 멱등 키 전송");
      await scene.scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "재생 ▷", exact: true }).click();
      await expect
        .poll(async () => Number(await scene.getAttribute("data-progress")))
        .toBeGreaterThan(0.05);
      const hash = async () =>
        crypto
          .createHash("sha256")
          .update(await scene.locator("canvas").screenshot())
          .digest("hex");
      const first = await hash();
      await page.waitForTimeout(110);
      const second = await hash();
      expect(first).not.toBe(second);
      await page
        .getByRole("button", { name: "일시 정지 Ⅱ", exact: true })
        .click();
      const progress = await scene.getAttribute("data-progress");
      await page.waitForTimeout(160);
      expect(await scene.getAttribute("data-progress")).toBe(progress);
      await finish();
    },
  );
  await check(
    "replay at the final step starts from the first request snapshot",
    async () => {
      await page.getByRole("button", { name: "재생 ▷", exact: true }).click();
      await attr("data-selected-step", 0);
      await attr("data-source", "RequestFilter.request");
      await page
        .getByRole("button", { name: "일시 정지 Ⅱ", exact: true })
        .click();
      await finish();
    },
  );
  await check(
    "cancel reservation ring is pending before either cancellation ledger is committed",
    async () => {
      await act("부분 취소 요청");
      await frame("취소 금액 예약·작업·job 동일 트랜잭션 커밋");
      await attr("data-ring-reserved", 3000);
      await attr("data-ring-canceled", 0);
      await attr("data-source", "PaymentService.reserveCancel");
      await expect(page.getByTestId("scene-pg-ledger")).toHaveText("원장 1건");
      await scene.screenshot({
        path: path.join(out, "cancel-reservation.png"),
      });
      await finish();
      await attr("data-ring-canceled", 3000);
      await attr("data-ring-reserved", 0);
    },
  );
  await check(
    "lost PG cancellation response keeps R and both independent ledger facts",
    async () => {
      await paid();
      await page.getByLabel("결제 장애 주입").selectOption("pg-response");
      await act("부분 취소 요청");
      await attr("data-ring-reserved", 3000);
      await attr("data-ring-canceled", 0);
      await expect(page.getByTestId("scene-pg-ledger")).toHaveText("원장 2건");
      await expect(page.getByTestId("scene-merchant-ledger")).toHaveText(
        "원장 1건",
      );
      await frame("PG 커밋 후 HTTP 응답 유실");
      await attr("data-source", "Psp.commitOperation");
      await scene.screenshot({ path: path.join(out, "lost-response.png") });
      await finish();
    },
  );
  await check(
    "recovery query keeps pending R until merchant apply and does not add another PG transaction",
    async () => {
      await page.getByLabel("결제 장애 주입").selectOption("none");
      await act("조회·복구 실행");
      await frame("현재 PG 거래를 다시 조회");
      await attr("data-source", "Psp.query");
      await attr("data-ring-reserved", 3000);
      await frame("PG 거래 유일성 검사");
      await attr("data-ring-reserved", 0);
      await attr("data-ring-canceled", 3000);
      await expect(page.getByTestId("scene-pg-ledger")).toHaveText("원장 2건");
      await expect(page.getByTestId("scene-merchant-ledger")).toHaveText(
        "원장 2건",
      );
      await finish();
    },
  );
  await check(
    "REVIEW keeps external canceled 5000 and unresolved reserved 7000 visible together",
    async () => {
      await paid();
      await page.getByLabel("결제 장애 주입").selectOption("pg-connect");
      await page.getByLabel("결제 부분 취소 금액").fill("7000");
      await act("부분 취소 요청");
      await page.getByLabel("결제 부분 취소 금액").fill("5000");
      await act("PG 외부 취소");
      await page.getByLabel("결제 장애 주입").selectOption("none");
      await act("조회·복구 실행");
      await attr("data-overbooked", true);
      await attr("data-ring-canceled", 5000);
      await attr("data-ring-reserved", 7000);
      await expect(scene.locator(".payment-ring-review")).toBeVisible();
      await scene.screenshot({
        path: path.join(out, "review-reservation.png"),
      });
    },
  );
  await check(
    "320 390 768 1440 1800 widths keep nodes separate and mobile flow/source usable",
    async () => {
      for (const width of [320, 390, 768, 1440, 1800]) {
        await page.setViewportSize({ width, height: 1000 });
        await tab("흐름·소스");
        await scene.scrollIntoViewIfNeeded();
        await expect.poll(noOverlap).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        if (width < 701)
          await expect(page.locator(".payment-panel:visible")).toHaveCount(1);
        layout.push({
          paymentWidth: width,
          sceneWidth: await scene.evaluate((e) => e.clientWidth),
        });
        if (width === 390 || width === 1440)
          await page
            .locator(".payment-flow")
            .screenshot({ path: path.join(out, `flow-${width}.png`) });
      }
    },
  );
  await check(
    "five project cards have the same widths, column ratios, and uniform vertical gaps",
    async () => {
      await page.goto(base + "#projects");
      await expect(page.locator(".project-list>.featured-project")).toHaveCount(
        5,
      );
      for (const width of [320, 390, 768, 1440, 1800]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.fonts.ready);
        const cards = await page
          .locator(".project-list>.featured-project")
          .evaluateAll((ns) =>
            ns.map((n) => ({
              r: n.getBoundingClientRect().toJSON(),
              cols: getComputedStyle(n).gridTemplateColumns,
            })),
          );
        expect(
          Math.max(...cards.map((c) => c.r.width)) -
            Math.min(...cards.map((c) => c.r.width)),
        ).toBeLessThan(1);
        const gaps = cards.slice(1).map((c, i) => c.r.top - cards[i].r.bottom);
        for (const gap of gaps)
          expect(Math.abs(gap - (width <= 800 ? 20 : 24))).toBeLessThan(1);
        expect(new Set(cards.map((c) => c.cols)).size).toBe(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        layout.push({ homeWidth: width, cards, gaps });
        if (width === 390 || width === 1440)
          await page
            .locator(".project-list")
            .screenshot({ path: path.join(out, `cards-${width}.png`) });
      }
    },
  );
  await check(
    "reduced motion uses a still selected snapshot and native keyboard source navigation",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(base + "#project/payment");
      await expect(scene).toHaveAttribute("data-ready", "true");
      await auth();
      await paid();
      await frame("독립 PG 승인/취소 거래 커밋");
      await attr("data-progress", "1.000");
      const button = scene.locator('[data-scene-node="DB"]');
      await button.focus();
      await page.keyboard.press("Enter");
      await attr("data-source", "PaymentService.confirm");
      await expect(source).toBeVisible();
      await finish();
    },
  );
  await check(
    "WebGL context loss preserves controls and restores a single synchronized canvas",
    async () => {
      await scene.locator("canvas").evaluate((c) => {
        const ext = c.getContext("webgl2").getExtension("WEBGL_lose_context");
        if (!ext) throw Error("Missing context loss test extension");
        window.restorePaymentContext = () => ext.restoreContext();
        ext.loseContext();
      });
      await expect(scene).toHaveAttribute("data-ready", "fallback");
      await expect(scene.locator(".payment-three-fallback")).toBeVisible();
      await page.waitForTimeout(180);
      await page.evaluate(() => window.restorePaymentContext());
      await expect(scene).toHaveAttribute("data-ready", "true");
      await expect(scene.locator("canvas")).toHaveCount(1);
      await attr("data-ring-approved", 10000);
    },
  );
  await check(
    "route unmount and revisit rebuild a single fresh renderer",
    async () => {
      await page.goto(base + "#projects");
      await page.locator('a.featured-project[href="#project/payment"]').click();
      await expect(scene).toHaveAttribute("data-ready", "true");
      await expect(scene.locator("canvas")).toHaveCount(1);
      await attr("data-ring-approved", 0);
      await attr("data-source", "ready");
    },
  );
  await check(
    "disabled WebGL retains functional flow controls and actual source",
    async () => {
      const fallbackBrowser = await chromium.launch({
        args: ["--disable-webgl"],
      });
      try {
        const p = await fallbackBrowser.newPage({
          viewport: { width: 390, height: 1000 },
        });
        await p.goto(base + "#project/payment");
        await openExperiments(p);
        await p.getByRole("tab", { name: "흐름·소스", exact: true }).click();
        await expect(p.locator(".payment-three")).toHaveAttribute(
          "data-ready",
          "fallback",
        );
        await expect(p.locator(".payment-three-fallback")).toBeVisible();
        await p.getByRole("tab", { name: "결제·취소", exact: true }).click();
        await p.getByRole("button", { name: "주문 생성", exact: true }).click();
        await p.getByRole("tab", { name: "흐름·소스", exact: true }).click();
        await p
          .getByRole("button", { name: "마지막으로 ⇥", exact: true })
          .evaluate((b) => {
            if (!b.disabled) b.click();
          });
        await p.locator('[data-scene-node="DB"]').click();
        await expect(p.locator(".payment-source>a")).toHaveAttribute(
          "href",
          /PaymentService.java#L/,
        );
        await p
          .locator(".payment-three")
          .screenshot({ path: path.join(out, "fallback-390.png") });
      } finally {
        await fallbackBrowser.close();
      }
    },
  );
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(out, "browser.json"),
    JSON.stringify(
      {
        status: "passed",
        verifiedAt: new Date().toISOString(),
        base,
        checks,
        layout,
        pageErrors: errors,
        scope:
          "Public browser simulation visualization; independent backend's frozen verification is separate.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${checks.length} Three.js and project layout browser groups passed at ${base}`,
  );
} catch (error) {
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}

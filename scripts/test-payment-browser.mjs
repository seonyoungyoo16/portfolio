import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import model from "../src/generated/payment-source.json" with { type: "json" };
const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:5190/",
  published = new URL(base).hostname.endsWith("github.io"),
  out = path.join(
    "docs/payment-verification",
    published ? "published" : "local",
  );
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage(),
  checks = [],
  errors = [],
  requests = [],
  links = new Set();
context.setDefaultTimeout(12000);
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/\/(api|lab|webhooks|v1)\//.test(new URL(r.url()).pathname))
    requests.push(new URL(r.url()).pathname);
});
const result = page.getByTestId("payment-result"),
  balance = page.getByTestId("payment-balance"),
  ledger = page.getByTestId("payment-ledger-count"),
  pgCount = page.getByTestId("payment-pg-count");
async function finish() {
  await page
    .getByRole("button", { name: "마지막으로 ⇥", exact: true })
    .evaluate((b) => {
      if (!b.disabled) b.click();
    });
  await expect(result).not.toContainText("처리 단계 재생 중");
  const link = await page.locator(".payment-source>a").getAttribute("href");
  if (link) links.add(link);
}
async function act(name, code) {
  await page.getByRole("button", { name, exact: true }).click();
  await finish();
  if (code) await expect(result).toContainText(code);
}
async function reset() {
  await page
    .getByRole("button", { name: "실험 초기화 ↺", exact: true })
    .click();
  await expect(result).toContainText("요청 대기");
}
async function auth() {
  await reset();
  await act("주문 생성", "ORDER_CREATED");
  await act("PG 인증", "AUTHORIZED_ONLY");
}
async function paid() {
  await auth();
  await act("결제 확정 →", "CONFIRM_SUCCEEDED");
}
async function fault(value) {
  await page.getByLabel("결제 장애 주입").selectOption(value);
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
try {
  await check(
    "five cards, payment route and explicit static versus actual boundary",
    async () => {
      await page.goto(base);
      await expect(page.locator("a.featured-project")).toHaveCount(5);
      await page.locator('a.featured-project[href="#project/payment"]').click();
      await expect(page.locator(".payment-project h1")).toContainText(
        "끝까지 확인",
      );
      await expect(page.locator(".payment-boundary")).toContainText(
        "브라우저 시뮬레이션",
      );
      await expect(page.locator(".payment-evidence")).toContainText(
        "12 SQL / API + 64 Browser",
      );
      await expect(page.locator("header nav a").last()).toHaveAttribute(
        "href",
        model.repo,
      );
    },
  );
  await check(
    "order snapshot and authentication produce zero PG capture",
    async () => {
      await auth();
      await expect(pgCount).toHaveText("0");
      await expect(ledger).toHaveText("0");
      await expect(page.getByTestId("payment-order-state")).toHaveText("OPEN");
    },
  );
  await check(
    "PG commit frame precedes merchant ledger and links independent PSP source",
    async () => {
      await act("결제 확정 →");
      await page
        .locator(".payment-steps button")
        .filter({ hasText: "독립 PG 승인/취소 거래 커밋" })
        .click();
      await expect(pgCount).toHaveText("1");
      await expect(ledger).toHaveText("0");
      await expect(page.locator(".payment-source>a")).toContainText(
        "psp/server.mjs",
      );
      links.add(await page.locator(".payment-source>a").getAttribute("href"));
      await finish();
      await expect(ledger).toHaveText("1");
    },
  );
  await check("different client key reuses canonical approval", async () => {
    await act("새 키로 같은 승인", "CANONICAL_SUCCEEDED");
    await expect(pgCount).toHaveText("1");
    await expect(ledger).toHaveText("1");
  });
  await check("mutated browser amount is rejected before PG", async () => {
    await auth();
    await act("승인 금액 변조", "400");
    await expect(pgCount).toHaveText("0");
  });
  await check("Redis outage rejects new durable operation", async () => {
    await auth();
    await fault("redis");
    await act("결제 확정 →", "503");
    await expect(pgCount).toHaveText("0");
    await expect(ledger).toHaveText("0");
  });
  await check("PG arrival failure then same operation recovery", async () => {
    await auth();
    await fault("pg-connect");
    await act("결제 확정 →", "UNKNOWN");
    await expect(pgCount).toHaveText("0");
    await fault("none");
    await act("조회·복구 실행", "RECONCILED");
    await expect(pgCount).toHaveText("1");
    await expect(ledger).toHaveText("1");
  });
  await check(
    "lost PG response preserves remote capture and recovers one ledger entry",
    async () => {
      await auth();
      await fault("pg-response");
      await act("결제 확정 →", "UNKNOWN");
      await expect(pgCount).toHaveText("1");
      await expect(ledger).toHaveText("0");
      await fault("none");
      await act("조회·복구 실행");
      await expect(ledger).toHaveText("1");
      await act("웹훅 재전달");
      await expect(ledger).toHaveText("1");
    },
  );
  await check(
    "DB apply outage produces no local partial ledger or outbox",
    async () => {
      await auth();
      await fault("db-apply");
      await act("결제 확정 →", "UNKNOWN");
      await expect(ledger).toHaveText("0");
      await expect(page.locator(".payment-counts")).toContainText(
        "상점 outbox0",
      );
      await fault("none");
      await act("조회·복구 실행");
      await expect(ledger).toHaveText("1");
    },
  );
  await check(
    "3000 plus 2000 partial refunds and final remaining full refund",
    async () => {
      await paid();
      await act("부분 취소 요청", "CANCEL_SUCCEEDED");
      await expect(balance).toContainText("C 3,000원");
      await page.getByLabel("결제 부분 취소 금액").fill("2000");
      await act("부분 취소 요청");
      await expect(balance).toContainText("C 5,000원");
      await act("남은 금액 전액 취소");
      await expect(balance).toContainText("A 10,000원 · C 10,000원");
      await expect(page.getByTestId("payment-order-state")).toHaveText(
        "CLOSED",
      );
    },
  );
  await check(
    "same cancel replay and stale version new key do not duplicate",
    async () => {
      await paid();
      await act("부분 취소 요청");
      await act("같은 취소 재전송", "CANCEL_REPLAY_SUCCEEDED");
      await act("낡은 버전 취소", "409");
      await expect(pgCount).toHaveText("2");
      await expect(balance).toContainText("C 3,000원");
    },
  );
  await check(
    "invalid cancellation and owner substitution are rejected",
    async () => {
      await paid();
      await page.getByLabel("결제 부분 취소 금액").fill("0");
      await act("부분 취소 요청", "400");
      await page.getByLabel("결제 부분 취소 금액").fill("10001");
      await act("부분 취소 요청", "409");
      await page.getByLabel("결제 실습 사용자").selectOption("B");
      await act("남은 금액 전액 취소", "403");
      await expect(pgCount).toHaveText("1");
    },
  );
  await check(
    "late capture after closure has one compensation and zero balance",
    async () => {
      await auth();
      await fault("pg-response");
      await act("결제 확정 →");
      await act("주문 종료 요청", "CLOSE_REQUESTED");
      await expect(page.getByTestId("payment-order-state")).toHaveText(
        "CLOSING",
      );
      await fault("none");
      await act("조회·복구 실행");
      await expect(page.getByTestId("payment-order-state")).toHaveText(
        "CLOSED",
      );
      await expect(pgCount).toHaveText("2");
      await expect(balance).toContainText("C 10,000원");
    },
  );
  await check(
    "external cancellation never settles own unknown reservation by amount",
    async () => {
      await paid();
      await fault("pg-connect");
      await page.getByLabel("결제 부분 취소 금액").fill("7000");
      await act("부분 취소 요청", "UNKNOWN");
      await page.getByLabel("결제 부분 취소 금액").fill("5000");
      await act("PG 외부 취소");
      await fault("none");
      await act("조회·복구 실행", "REVIEW_REQUIRED");
      await expect(page.getByTestId("payment-reserved")).toContainText(
        "7,000원",
      );
      await expect(balance).toContainText("C 5,000원");
      await expect(page.locator(".payment-balance")).toContainText("REVIEW");
    },
  );
  await check(
    "browser response loss and duplicate webhook retain one financial fact",
    async () => {
      await auth();
      await page.getByLabel("상점 응답 유실", { exact: true }).check();
      await act("결제 확정 →", "RESPONSE_LOST");
      await page.getByLabel("상점 응답 유실", { exact: true }).uncheck();
      await act("웹훅 재전달");
      await act("웹훅 재전달");
      await expect(ledger).toHaveText("1");
      await act("영수증 소비·재생", "PROJECTION_CURRENT");
    },
  );
  await check(
    "all 37 source anchors, actual popup target and raw file hashes",
    async () => {
      for (const key of Object.keys(model.sources)) {
        await page.getByLabel("결제 실제 소스 선택").selectOption(key);
        const s = model.sources[key];
        await expect(page.locator(".payment-source>a")).toHaveAttribute(
          "href",
          model.repo + "/blob/" + model.revision + "/" + s.file + "#L" + s.line,
        );
        await expect(page.locator(".payment-source pre")).toContainText(
          s.lines.find((l) => l.trim()) || "",
        );
        links.add(await page.locator(".payment-source>a").getAttribute("href"));
      }
      const popupEvent = context.waitForEvent("page");
      await page.locator(".payment-source>a").click();
      const popup = await popupEvent;
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      expect(popup.url()).toContain(
        model.repo + "/blob/" + model.revision + "/",
      );
      await popup.close();
      for (const [file, hash] of Object.entries(model.hashes)) {
        const url =
          "https://raw.githubusercontent.com/seonyoungyoo16/springboot-payment-lab/" +
          model.revision +
          "/" +
          file;
        let r;
        for (let i = 0; i < 3; i++) {
          r = await context.request.get(url);
          if (r.status() === 200) break;
          await page.waitForTimeout(1000);
        }
        expect(r.status()).toBe(200);
        expect(
          crypto
            .createHash("sha256")
            .update(await r.body())
            .digest("hex"),
        ).toBe(hash);
      }
    },
  );
  await check(
    "responsive service flow source data at four viewport sizes",
    async () => {
      await reset();
      for (const width of [390, 768, 1440, 1800]) {
        await page.setViewportSize({ width, height: 1100 });
        for (const tab of ["결제·취소", "흐름·소스", "거래 비교"]) {
          if (width === 390) {
            await page.getByRole("tab", { name: tab, exact: true }).click();
            expect(
              await page
                .locator(".payment-workspace>.payment-panel:visible")
                .count(),
            ).toBe(1);
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
        }
        if (width === 390) {
          await page
            .getByRole("tab", { name: "결제·취소", exact: true })
            .click();
          await page.getByLabel("결제 부분 취소 금액").focus();
          await expect(page.getByLabel("결제 부분 취소 금액")).toBeFocused();
        }
        await page.screenshot({
          path: path.join(out, width + ".png"),
          fullPage: true,
        });
      }
    },
  );
  await check(
    "existing board chat login signup routes and no backend calls",
    async () => {
      for (const [route, selector] of [
        ["board", ".board-demo-section"],
        ["chat", ".chat-clients"],
        ["login", ".login-project"],
        ["signup", ".signup-project"],
      ]) {
        await page.goto(base + "#project/" + route);
        await expect(page.locator(selector)).toBeVisible();
      }
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
    },
  );
  expect(checks).toHaveLength(18);
  fs.writeFileSync(
    path.join(out, "browser.json"),
    JSON.stringify(
      {
        status: "passed",
        completedAt: new Date().toISOString(),
        base,
        scope:
          "static portfolio simulation; independent actual backend 64 browser and 12 SQL/API linked separately",
        sourceRevision: model.revision,
        checks,
        sourceLinks: [...links],
        unexpectedBackendRequests: requests,
        pageErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    checks.length + " payment portfolio browser groups passed at " + base,
  );
} catch (e) {
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(out, "failure.json"),
    JSON.stringify({ checks, errors, error: String(e) }, null, 2),
  );
  throw e;
} finally {
  await context.close();
  await browser.close();
}

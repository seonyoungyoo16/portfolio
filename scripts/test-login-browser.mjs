import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:5188/";
const published = new URL(base).hostname.endsWith("github.io");
const output = path.resolve(
  "docs/login-verification",
  published ? "published" : "local",
);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
context.setDefaultTimeout(12000);
const page = await context.newPage(),
  errors = [],
  checks = [],
  sourceLinks = new Set();
page.on("pageerror", (e) => errors.push(e.message));
const result = page.getByTestId("login-result");
const go = async () => {
  await page.goto(base + "#project/login");
  await expect(page.locator(".login-project")).toBeVisible();
};
const reset = async () => {
  await page
    .getByRole("button", { name: "실험 초기화 ↺", exact: true })
    .click();
  await expect(result).toContainText("요청 대기");
};
async function complete() {
  const last = page.getByRole("button", { name: "마지막으로 ⇥", exact: true });
  if (await last.isEnabled()) await last.click();
  await expect(result).not.toContainText("처리 단계 재생 중");
  sourceLinks.add(await page.locator(".login-source>a").getAttribute("href"));
}
async function act(label, code) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await complete();
  if (code) await expect(result).toContainText(code);
}
const login = async () => act("로그인하고 흐름 보기 →", "200 · AUTHENTICATED");
async function check(name, test) {
  await test();
  checks.push(name);
  console.log("PASS " + name);
}
try {
  await check("home card and project navigation", async () => {
    await page.goto(base);
    await expect(page.locator("a.featured-project")).toHaveCount(3);
    await page.locator('a[href="#project/login"].featured-project').click();
    await expect(page.locator(".login-project h1")).toContainText(
      "인증은 계속",
    );
    await expect(page.locator(".login-boundary")).toContainText(
      "브라우저 시뮬레이션",
    );
    await expect(page.locator(".login-evidence")).toContainText(
      "20 API + 41 브라우저",
    );
  });
  await check("wrong password creates no authentication record", async () => {
    await page.getByLabel("로그인 비밀번호", { exact: true }).fill("wrong");
    await act("로그인하고 흐름 보기 →", "401 · AUTHENTICATION_FAILED");
    await expect(page.locator(".login-data")).toContainText(
      "발급 기록이 없습니다.",
    );
    await page
      .getByLabel("로그인 비밀번호", { exact: true })
      .fill("Lab!2026Pass");
  });
  await check(
    "PREPARING → Redis → ACTIVE snapshots and exact source",
    async () => {
      await login();
      await page
        .locator(".login-steps button")
        .filter({ hasText: "기기 인증과 PREPARING 커밋" })
        .click();
      await expect(page.locator(".login-data")).toContainText("PREPARING");
      await expect(page.locator(".login-account")).toContainText("세션 없음");
      await expect(page.locator(".login-source>a")).toContainText(
        "AuthService.java:113",
      );
      await page
        .locator(".login-steps button")
        .filter({ hasText: "공유 세션 저장" })
        .click();
      await expect(page.locator(".login-data")).toContainText("1800s");
      await expect(page.locator(".login-account")).toContainText("세션 없음");
      await expect(page.locator(".login-source pre")).toContainText(
        "Math.min(p.idle(), remaining)",
      );
      await complete();
      await expect(page.locator(".login-account")).toContainText("로그인됨");
    },
  );
  await check(
    "A login → B protected request shares Redis session",
    async () => {
      await page.getByRole("button", { name: "서버 B", exact: true }).click();
      await act("보호 요청", "200 · SESSION_VALID");
      await expect(page.locator(".login-scene")).toContainText("SERVER B");
      await expect(page.locator(".login-account")).toContainText("SID-2");
    },
  );
  await check("idle expiry and fixed remember rotation", async () => {
    await act("+30분", "CLOCK_ADVANCED");
    await act("보호 요청", "401");
    await act("로그인 복원", "AUTHENTICATED");
    await expect(page.locator(".login-data")).toContainText("generation 1");
    await expect(page.locator(".login-data")).toContainText("D+14 00:00:00");
  });
  await check(
    "simultaneous tabs single rotation; grace and stale replay",
    async () => {
      await act("세션 쿠키 없이 재방문", "BROWSER_REVISIT");
      await act("동시에 두 탭 복원", "CONCURRENT_200_409");
      await expect(page.locator(".login-data")).toContainText("generation 2");
      await act("이전 토큰 재사용", "409 · RESTORE_ALREADY_PROCESSED");
      await act("+1분", "CLOCK_ADVANCED");
      await act("이전 토큰 재사용", "401 · REMEMBER_STALE");
      await act("보호 요청", "200 · SESSION_VALID");
    },
  );
  await check(
    "recent password confirmation then all-device revocation",
    async () => {
      await act("전체 기기 로그아웃", "403 · REAUTH_REQUIRED");
      await act("비밀번호 재확인", "204 · REAUTHENTICATED");
      await page.getByRole("button", { name: "기기 B", exact: true }).click();
      await login();
      await page.getByRole("button", { name: "기기 A", exact: true }).click();
      await act("전체 기기 로그아웃", "204 · LOGGED_OUT");
      await page.getByRole("button", { name: "기기 B", exact: true }).click();
      await act("보호 요청", "401");
      await act("로그인 복원", "401 · AUTH_REVOKED");
    },
  );
  await check("ordinary login cannot restore after revisit", async () => {
    await reset();
    await page.getByLabel("로그인 유지 · 고정 14일", { exact: true }).uncheck();
    await login();
    await act("세션 쿠키 없이 재방문", "BROWSER_REVISIT");
    await act("로그인 복원", "401 · REMEMBER_INVALID");
    await page.getByLabel("로그인 유지 · 고정 14일", { exact: true }).check();
  });
  await check("remember expiry requires a password login", async () => {
    await reset();
    await login();
    await act("세션 쿠키 없이 재방문", "BROWSER_REVISIT");
    await act("+14일", "CLOCK_ADVANCED");
    await act("로그인 복원", "401 · REMEMBER_EXPIRED");
  });
  await check("expired-session logout revokes remembered grant", async () => {
    await reset();
    await login();
    await act("+30분", "CLOCK_ADVANCED");
    await act("현재 기기 로그아웃", "204 · LOGGED_OUT");
    await expect(page.locator(".login-data")).toContainText("폐기");
    await expect(page.locator(".login-account")).toContainText("유지 없음");
  });
  await check(
    "activation failure retains PREPARING without successful cookie",
    async () => {
      await reset();
      await act("ACTIVE 직전 중단", "503 · ACTIVATION_INTERRUPTED");
      await expect(page.locator(".login-data")).toContainText("PREPARING");
      await expect(page.locator(".login-account")).toContainText("세션 없음");
      await act("보호 요청", "401");
    },
  );
  await check(
    "lost restore response forces password login after grace",
    async () => {
      await reset();
      await login();
      await act("세션 쿠키 없이 재방문", "BROWSER_REVISIT");
      await act("유지 복원 응답 유실", "RESPONSE_LOST");
      await expect(page.locator(".login-data")).toContainText("generation 0");
      await act("+1분", "CLOCK_ADVANCED");
      await act("로그인 복원", "401 · REMEMBER_STALE");
      await act("현재 기기 로그아웃", "204 · LOGGED_OUT");
      await expect(page.locator(".login-data")).toContainText("폐기");
    },
  );
  await check(
    "Redis and DB outages show unknown status then recover",
    async () => {
      await reset();
      await login();
      for (const name of ["Redis", "DB"]) {
        await act(name + " 정상 → 차단", "NETWORK_CHANGED");
        await expect(page.locator(".login-account")).toContainText(
          "인증 상태 확인 불가",
        );
        await act("보호 요청", "503 · AUTH_UNAVAILABLE");
        await act(name + " 차단 → 복구", "NETWORK_CHANGED");
        await act("보호 요청", "200 · SESSION_VALID");
      }
    },
  );
  await check(
    "revocation survives cleanup failure and stale Redis restore",
    async () => {
      await reset();
      await login();
      await act("폐기 후 Redis 정리 실패", "LOGGED_OUT_CLEANUP_PENDING");
      await expect(page.locator(".login-data")).toContainText("1건");
      await act("Redis 차단 → 복구", "NETWORK_CHANGED");
      await act("폐기된 Redis 키 복구", "STALE_RESTORED");
      await act("보호 요청", "401 · AUTH_REVOKED");
      await act("정리 재시도", "CLEANUP_DONE");
      await expect(page.locator(".login-data")).toContainText("0건");
    },
  );
  await check("source toggle, replay and documentation links", async () => {
    await reset();
    await login();
    const source = page.locator(".login-source>a");
    await expect(source).toHaveAttribute(
      "href",
      /springboot-login-lab\/blob\/[0-9a-f]{40}\/.+#L\d+/,
    );
    await page
      .getByRole("button", { name: /현재 단계의 실제 소스 닫기/ })
      .click();
    await expect(source).toHaveCount(0);
    await page
      .getByRole("button", { name: /현재 단계의 실제 소스 열기/ })
      .click();
    await expect(source).toBeVisible();
    await page.getByRole("button", { name: "흐름 재생", exact: true }).click();
    await page
      .getByRole("button", { name: "흐름 일시 정지", exact: true })
      .click();
    await complete();
    await expect(page.locator(".login-real-lab a")).toHaveCount(3);
  });
  await check(
    "desktop and tablet layouts without horizontal overflow",
    async () => {
      for (const width of [1800, 1440, 768]) {
        await page.setViewportSize({ width, height: 1100 });
        await expect(page.locator(".login-service")).toBeVisible();
        await expect(page.locator(".login-flow")).toBeVisible();
        await expect(page.locator(".login-data")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        if (width === 1440)
          await page.screenshot({
            path: path.join(output, "desktop.png"),
            fullPage: true,
          });
      }
    },
  );
  await check(
    "mobile tabs isolate panels; source and data stay readable",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [name, visible] of [
        ["체험", ".login-service"],
        ["흐름·소스", ".login-flow"],
        ["데이터", ".login-data"],
      ]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await expect(page.locator(visible)).toBeVisible();
        for (const pane of [".login-service", ".login-flow", ".login-data"])
          if (pane !== visible)
            await expect(page.locator(pane)).not.toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await page.screenshot({
          path: path.join(
            output,
            "mobile-" +
              (name === "체험"
                ? "service"
                : name === "데이터"
                  ? "data"
                  : "flow") +
              ".png",
          ),
          fullPage: true,
        });
      }
    },
  );
  await check("existing board and chat routes still run", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "#project/board");
    await expect(page.locator(".board-demo-section")).toBeVisible();
    await expect(page.locator(".schema-visual canvas")).toBeVisible();
    await page.goto(base + "#project/chat");
    await expect(page.locator(".chat-clients")).toBeVisible();
    await page
      .locator(".client-0")
      .getByRole("button", { name: "다시 접속", exact: true })
      .click();
    await expect(page.locator(".client-0")).toContainText("온라인", {
      timeout: 15000,
    });
    await expect(page.locator(".chat-flow-pane")).toBeVisible();
  });
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(output, "browser.json"),
    JSON.stringify(
      {
        status: "passed",
        completedAt: new Date().toISOString(),
        base,
        scope:
          "GitHub Pages browser simulation; actual backend evidence linked separately",
        checks,
        sourceLinks: [...sourceLinks],
        pageErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${checks.length} browser groups passed at ${base}`);
} catch (error) {
  await page.screenshot({
    path: path.join(output, "failure.png"),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(output, "failure.json"),
    JSON.stringify({ checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}

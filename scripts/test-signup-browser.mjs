import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import model from "../src/generated/signup-source.json" with { type: "json" };
const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:5188/",
  published = new URL(base).hostname.endsWith("github.io"),
  out = path.join(
    "docs/signup-verification",
    published ? "published" : "local",
  );
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true }),
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
  if (/\/(api|lab|oidc)\//.test(new URL(r.url()).pathname))
    requests.push(new URL(r.url()).pathname);
});
const result = page.getByTestId("signup-result"),
  count = page.getByTestId("signup-account-count"),
  identity = page.getByTestId("signup-identity-count");
async function finish() {
  const last = page.getByRole("button", { name: "마지막으로 ⇥", exact: true });
  await last.evaluate((button) => {
    if (!button.disabled) button.click();
  });
  await expect(result).not.toContainText("처리 단계 재생 중");
  const link = await page.locator(".signup-source>a").getAttribute("href");
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
async function verify(email = "new@lab.test") {
  await page.getByLabel("가입 이메일", { exact: true }).fill(email);
  await act("인증 메일 요청", "202");
  await act("메일 작업자 실행");
  const mails = page.locator(".signup-mails article");
  await mails.last().getByRole("button").click();
  await finish();
  await act("이메일 확인 POST", "EMAIL_VERIFIED");
}
async function complete(code = "201") {
  await page.getByLabel("필수 약관 동의", { exact: true }).check();
  await act("가입 확정하고 흐름 보기 →", code);
}
async function selectBrowser(value) {
  await page.getByLabel("가입 브라우저 문맥").selectOption(value);
  await finish();
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
try {
  await check(
    "five project cards, signup route, explicit boundary and fixed actual evidence",
    async () => {
      await page.goto(base);
      await expect(page.locator("a.featured-project")).toHaveCount(5);
      await page.locator('a.featured-project[href="#project/signup"]').click();
      await expect(page.locator(".signup-project h1")).toContainText(
        "하나의 계정",
      );
      await expect(page.locator(".signup-boundary")).toContainText(
        "브라우저 시뮬레이션",
      );
      await expect(page.locator(".signup-evidence")).toContainText(
        "12 SQL / API + 50 Browser",
      );
      await expect(page.locator("header nav a").last()).toHaveAttribute(
        "href",
        model.repo,
      );
    },
  );
  await check(
    "email queue, SMTP reception, GET and explicit POST remain separate",
    async () => {
      await expect(page.getByLabel("가입 표시 이름")).toHaveCount(0);
      await act("인증 메일 요청", "202");
      await expect(page.locator(".signup-mailbox")).toContainText(
        "수신 메일이 없습니다",
      );
      await expect(count).toHaveText("0");
      await act("메일 작업자 실행");
      await act("메일 #1 링크 열기", "CONFIRMATION_REQUIRED");
      await expect(page.getByLabel("가입 표시 이름")).toHaveCount(0);
      await act("이메일 확인 POST", "EMAIL_VERIFIED");
      await expect(page.getByLabel("가입 표시 이름")).toBeVisible();
      await expect(count).toHaveText("0");
    },
  );
  await check(
    "atomic signup, no automatic login and same request replay",
    async () => {
      await complete();
      await expect(count).toHaveText("1");
      await expect(page.locator(".signup-data")).toContainText(
        "로그인 권한없음",
      );
      await act("같은 가입 요청 재전송", "200");
      await expect(count).toHaveText("1");
    },
  );
  await check(
    "independent context cannot consume the copied mail link",
    async () => {
      await reset();
      await act("인증 메일 요청");
      await act("메일 작업자 실행");
      await selectBrowser("1");
      await act("메일 #1 링크 열기");
      await act("이메일 확인 POST", "403");
      await selectBrowser("0");
      await act("메일 #1 링크 열기");
      await act("이메일 확인 POST", "200");
    },
  );
  await check("resend cooldown and old generation refusal", async () => {
    await reset();
    await act("인증 메일 요청");
    await act("메일 작업자 실행");
    await act("인증 메일 요청", "429");
    await act("60초 경과");
    await act("인증 메일 요청", "202");
    await act("메일 작업자 실행");
    await act("메일 #1 링크 열기");
    await act("이메일 확인 POST", "410");
    await act("메일 #2 링크 열기");
    await act("이메일 확인 POST", "200");
  });
  await check(
    "address change invalidates proof and blocks account form",
    async () => {
      await reset();
      await verify();
      await page
        .getByLabel("가입 이메일", { exact: true })
        .fill("changed@lab.test");
      await act("이메일 수정 반영", "EMAIL_CHANGED");
      await expect(page.getByLabel("가입 표시 이름")).toHaveCount(0);
      await expect(count).toHaveText("0");
    },
  );
  await check(
    "two independently verified flows conflict at the shared email constraint",
    async () => {
      await reset();
      await verify("same@lab.test");
      await selectBrowser("1");
      await verify("same@lab.test");
      await complete();
      await selectBrowser("0");
      await complete("409");
      await expect(count).toHaveText("1");
      await expect(page.locator(".signup-data")).toContainText(
        "로그인 권한없음",
      );
    },
  );
  await check(
    "committed signup recovers after response connection loss",
    async () => {
      await reset();
      await verify();
      await page.getByLabel("가입 커밋 후 응답 연결 유실").check();
      await complete("RESPONSE_LOST");
      await expect(count).toHaveText("1");
      await act("가입 결과 확인", "RESULT_RECOVERED");
      await act("같은 가입 요청 재전송", "200");
      await expect(count).toHaveText("1");
    },
  );
  await check(
    "SMTP acknowledgement loss permits duplicate mail but single verification/account",
    async () => {
      await reset();
      await act("인증 메일 요청");
      await act("다음 SMTP 접수 응답 유실 OFF");
      await act("메일 작업자 실행");
      await expect(page.locator(".signup-data")).toContainText(
        "DELIVERY_UNKNOWN",
      );
      await act("메일 작업자 실행");
      await expect(page.locator(".signup-mails article")).toContainText(
        "수신 2회",
      );
      await act("메일 #1 링크 열기");
      await act("이메일 확인 POST");
      await complete();
      await expect(count).toHaveText("1");
    },
  );
  await check(
    "SMTP outage preserves outbox and recovery delivers",
    async () => {
      await reset();
      await act("SMTP 정상 → 차단");
      await act("인증 메일 요청", "202");
      await act("메일 작업자 실행");
      await expect(page.locator(".signup-mailbox")).toContainText(
        "수신 메일이 없습니다",
      );
      await act("SMTP 차단 → 복구");
      await act("메일 작업자 실행");
      await expect(page.locator(".signup-mails article")).toHaveCount(1);
    },
  );
  await check(
    "Redis and DB outages produce 503 without a phantom account",
    async () => {
      await reset();
      await act("Redis 정상 → 차단");
      await act("인증 메일 요청", "503");
      await expect(count).toHaveText("0");
      await act("Redis 차단 → 복구");
      await verify();
      await act("DB 정상 → 차단");
      await complete("503");
      await expect(count).toHaveText("0");
      await act("DB 차단 → 복구");
      await complete();
      await expect(count).toHaveText("1");
    },
  );
  await check(
    "SSO defaults to own email verification and OIDC identity ownership",
    async () => {
      await reset();
      await act("SSO로 가입 계속", "PROVIDER_PROOF_READY");
      await expect(page.getByLabel("가입 표시 이름")).toHaveCount(0);
      await verify("alice@lab.test");
      await complete();
      await expect(identity).toHaveText("1");
      await expect(page.locator(".signup-data table").first()).toContainText(
        "OIDC",
      );
    },
  );
  await check(
    "same provider email never silently links an existing local account",
    async () => {
      await reset();
      await page.getByLabel("공급자 실습 신원").selectOption("match");
      await act("SSO로 가입 계속");
      await verify("existing@lab.test");
      await complete("409");
      await expect(count).toHaveText("0");
      await expect(identity).toHaveText("0");
    },
  );
  await check(
    "existing login, external proof and final explicit link preserve account",
    async () => {
      await reset();
      await page.getByLabel("공급자 실습 신원").selectOption("match");
      await act("기존 계정 로그인");
      await act("외부 신원 연결 시작", "LINK_PROOF_READY");
      await expect(identity).toHaveText("0");
      await act("확인한 외부 신원 연결 확정", "IDENTITY_LINKED");
      await expect(identity).toHaveText("1");
      await expect(count).toHaveText("0");
    },
  );
  await check(
    "logout and recent-auth expiry reject pending identity links",
    async () => {
      await reset();
      await act("기존 계정 로그인");
      await act("외부 신원 연결 시작");
      await act("기존 계정 로그아웃");
      await act("확인한 외부 신원 연결 확정", "403");
      await act("기존 계정 로그인");
      await act("외부 신원 연결 시작");
      await act("10분 1초 경과");
      await act("확인한 외부 신원 연결 확정", "REAUTH_REQUIRED");
      await act("기존 수단 재확인");
      await act("외부 신원 연결 시작");
      await act("확인한 외부 신원 연결 확정", "200");
    },
  );
  await check(
    "only explicitly trusted main skips email; expired proof refuses signup",
    async () => {
      await reset();
      await page.getByLabel("main의 email_verified 명시 신뢰").check();
      await finish();
      await page.getByLabel("가입 외부 인증 공급자").selectOption("team");
      await act("SSO로 가입 계속");
      await expect(page.getByLabel("가입 표시 이름")).toHaveCount(0);
      await page.getByLabel("가입 외부 인증 공급자").selectOption("main");
      await act("SSO로 가입 계속");
      await expect(page.getByLabel("가입 표시 이름")).toBeVisible();
      await act("10분 1초 경과");
      await expect(page.getByLabel("가입 표시 이름")).toHaveCount(0);
      await expect(count).toHaveText("0");
    },
  );
  await check(
    "flow snapshots, fixed-commit source popup navigation and published source SHA-256",
    async () => {
      await reset();
      await verify();
      await complete();
      const steps = page.locator(".signup-steps button");
      await steps.filter({ hasText: "계정 · 이메일 · 자격정보" }).click();
      await expect(page.locator(".signup-source>a")).toContainText(
        "SignupService.java",
      );
      await expect(page.locator(".signup-source pre")).toContainText(
        "INSERT INTO accounts",
      );
      const link = await page.locator(".signup-source>a").getAttribute("href");
      links.add(link);
      expect(link).toContain("/blob/" + model.revision + "/");
      const popupPromise = context.waitForEvent("page");
      await page.locator(".signup-source>a").click();
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      expect(popup.url()).toBe(link);
      await popup.close();
      await finish();
      for (const file of [
        "docs/verification/COVERAGE.md",
        model.sources["SignupService.complete"].file,
      ]) {
        const uri = `https://raw.githubusercontent.com/seonyoungyoo16/springboot-signup-lab/${model.revision}/${file}`;
        const r = await context.request.get(uri);
        expect(r.status()).toBe(200);
        if (model.hashes[file])
          expect(
            crypto
              .createHash("sha256")
              .update(await r.body())
              .digest("hex"),
          ).toBe(model.hashes[file]);
      }
    },
  );
  await check(
    "responsive panels at 390/768/1440/1800 and existing project routes",
    async () => {
      await reset();
      for (const width of [390, 768, 1440, 1800]) {
        await page.setViewportSize({ width, height: 1100 });
        for (const tab of ["서비스", "흐름·소스", "데이터"]) {
          if (width === 390) {
            await page.getByRole("tab", { name: tab, exact: true }).click();
            expect(await page.locator(".signup-pane:visible").count()).toBe(1);
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
        }
        if (width === 390) {
          await page.getByRole("tab", { name: "서비스", exact: true }).click();
          await page.screenshot({
            path: path.join(out, "mobile.png"),
            fullPage: true,
          });
        }
      }
      await page.screenshot({
        path: path.join(out, "desktop.png"),
        fullPage: true,
      });
      for (const [route, selector] of [
        ["board", ".board-demo-section"],
        ["chat", ".chat-clients"],
        ["login", ".login-project"],
      ]) {
        await page.goto(base + "#project/" + route);
        await expect(page.locator(selector)).toBeVisible();
      }
    },
  );
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  fs.writeFileSync(
    path.join(out, "browser.json"),
    JSON.stringify(
      {
        status: "passed",
        completedAt: new Date().toISOString(),
        base,
        scope:
          "static portfolio experience; actual backend 50 cases linked separately",
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
  console.log(checks.length + " portfolio browser groups passed at " + base);
} catch (error) {
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(out, "failure.json"),
    JSON.stringify({ checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
function href(file) {
  return model.repo + "/blob/" + model.revision + "/" + file;
}

import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import login from "../src/generated/login-source.json" with { type: "json" };
import signup from "../src/generated/signup-source.json" with { type: "json" };
import local from "../src/generated/interaction-source.json" with { type: "json" };
const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:5191/";
const out = path.join(
  "docs/user-journey-verification",
  new URL(base).hostname.endsWith("github.io") ? "published" : "local",
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
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/\/(api|lab|webhooks|oidc)\//.test(new URL(r.url()).pathname))
    requests.push(r.url());
});
let project = "login";
const guide = () => page.locator(".lab-user .lab-journey");
const scene = () =>
  page.locator(
    project === "payment"
      ? ".payment-three"
      : project === "chat"
        ? ".chat-three-experience"
        : ".auth-three",
  );
const goto = async (p) => {
  project = p;
  const url=base+"#project/"+p;
  if(page.url()===url)await page.reload();else await page.goto(url);
  await expect(guide()).toBeVisible();
};
const finish = async () => {
  for (let i = 0; i < 12; i++) {
    const fast = page.getByRole("button", {
      name: "결과 바로 보기",
      exact: true,
    });
    if (await fast.isVisible()) {
      await fast.click();
      await page.waitForTimeout(project === "chat" ? 500 : 20);
    } else {
      await page.waitForTimeout(100);
      if (!(await fast.isVisible())) return;
    }
  }
  throw Error("Flow did not reach terminal state");
};
const act = async (name) => {
  await guide().getByRole("button", { name, exact: true }).click();
  await finish();
};
const next = async (name) =>
  guide()
    .getByRole("button", { name: "다음: " + name + " →", exact: true })
    .click();
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
};
const sourceMatch = async () => {
  const key = await scene().getAttribute("data-source");
  const item = key.startsWith("browser:")
    ? local.sources[key.slice(8)]
    : (project === "login" ? login : signup).sources[key];
  const model = key.startsWith("browser:")
    ? local
    : project === "login"
      ? login
      : signup;
  expect(item, "reviewed source " + key).toBeTruthy();
  await expect(page.locator("." + project + "-source > a")).toHaveAttribute(
    "href",
    `${model.repo}/blob/${model.revision}/${item.file}#L${item.line}`,
  );
};
try {
  await check(
    "four projects start with the same ordered user actions; technical controls are absent from the basic surface",
    async () => {
      for (const p of ["login", "signup", "payment", "chat"]) {
        await goto(p);
        await expect(
          page.getByRole("button", { name: "사용자로 체험하기", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".lab-technical")).toBeHidden();
        await expect(guide().locator(".lab-journey-steps li")).toHaveCount(4);
        await expect(
          guide().locator(".lab-journey-steps button").first(),
        ).toHaveAttribute("aria-current", "step");
        expect(await guide().locator("select").count()).toBe(0);
        await page.screenshot({
          path: path.join(out, p + "-initial-1440.png"),
          fullPage: true,
        });
      }
    },
  );
  await check(
    "login user journey: login → profile → browser revisit with rotation → logout, each action reaches its own source",
    async () => {
      await goto("login");
      await act("로그인하기 →");
      await expect(page.getByTestId("login-result")).toContainText(
        "AUTHENTICATED",
      );
      await expect(page.locator(".lab-action-trace")).toContainText(
        "아이디와 비밀번호로 로그인하기",
      );
      await sourceMatch();
      await next("내 정보 확인하기");
      await act("내 정보 열기 →");
      await expect(page.getByTestId("login-result")).toContainText(
        "SESSION_VALID",
      );
      await sourceMatch();
      await next("브라우저 다시 열기");
      await guide()
        .getByRole("button", {
          name: "브라우저를 닫고 다시 열기 →",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "흐름 일시 정지", exact: true })
        .click();
      await page.locator(".login-steps button").first().click();
      await expect(scene()).toHaveAttribute("data-route", "browser");
      await expect(scene()).toHaveAttribute("data-source-role", "browser");
      await sourceMatch();
      await expect(page.locator(".login-source")).toContainText(
        "browser.sid = null",
      );
      await page
        .locator(".login-steps button")
        .filter({ hasText: "POST /api/auth/restore" })
        .click();
      await expect(scene()).toHaveAttribute("data-route", "browser>server");
      await sourceMatch();
      await page
        .getByRole("button", { name: "마지막으로 ⇥", exact: true })
        .click();
      await expect(page.getByTestId("login-result")).toContainText(
        "AUTHENTICATED",
      );
      await expect(scene().locator('[data-auth-node="browser"]')).toContainText(
        "g1",
      );
      await next("로그아웃하기");
      await act("로그아웃하기 →");
      await expect(page.getByTestId("login-result")).toContainText(
        "LOGGED_OUT",
      );
      await expect(
        scene().locator('[data-auth-node="browser"]'),
      ).toHaveAttribute("data-count", "0");
      await sourceMatch();
      await page.screenshot({
        path: path.join(out, "login-complete.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "each login processing boundary lights the actual rendered connection and matches the exact frozen implementation",
    async () => {
      await goto("login");
      await act("로그인하기 →");
      for (const [title, route, link] of [
        ["비밀번호 해시 검증", "server>database>server", "database>server"],
        [
          "기기 인증과 PREPARING 커밋",
          "server>database>server",
          "database>server",
        ],
        ["공유 세션 저장", "server>redis>server", "redis>server"],
        [
          "폐기·버전 재확인 후 ACTIVE 커밋",
          "server>database>server",
          "database>server",
        ],
        ["보호 쿠키 수신", "server>browser", "server>browser"],
      ]) {
        await page
          .locator(".login-steps button")
          .filter({ hasText: title })
          .click();
        await expect(scene()).toHaveAttribute("data-route", route);
        await expect(scene()).toHaveAttribute("data-active-link", link);
        await expect(scene()).toHaveAttribute(
          "data-packet-position",
          /^-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+$/,
        );
        await sourceMatch();
      }
      await page
        .locator(".login-workspace")
        .evaluate((e) => e.scrollIntoView({ block: "start" }));
      await page.screenshot({
        path: path.join(out, "login-action-flow-source.png"),
      });
    },
  );
  await check(
    "wrong password and no remember-me lead to understandable errors and do not unlock later actions",
    async () => {
      await goto("login");
      await guide()
        .getByLabel("체험 로그인 비밀번호", { exact: true })
        .fill("wrong");
      await act("로그인하기 →");
      await expect(page.getByTestId("login-result")).toContainText("401");
      await expect(guide().locator(".lab-action-result")).toHaveAttribute(
        "data-outcome",
        "error",
      );
      await expect(guide().locator(".lab-next")).toHaveCount(0);
      await guide()
        .getByLabel("체험 로그인 비밀번호", { exact: true })
        .fill("Lab!2026Pass");
      await guide()
        .getByLabel("로그인 상태 유지하기", { exact: true })
        .uncheck();
      await act("로그인하기 →");
      await next("내 정보 확인하기");
      await act("내 정보 열기 →");
      await next("브라우저 다시 열기");
      await act("브라우저를 닫고 다시 열기 →");
      await expect(page.getByTestId("login-result")).toContainText("401");
      await expect(guide().locator(".lab-next")).toHaveCount(0);
      await expect(
        scene().locator('[data-auth-node="browser"]'),
      ).toHaveAttribute("data-count", "0");
    },
  );
  await check(
    "changing the next test device does not rewrite the previous action actor or its source",
    async () => {
      await goto("login");
      await act("로그인하기 →");
      const before = await scene().getAttribute("data-source");
      await page
        .getByRole("button", { name: "직접 실험하기", exact: true })
        .click();
      await page.getByRole("button", { name: "기기 B", exact: true }).click();
      await expect(scene().locator('[data-auth-node="browser"]')).toContainText(
        "기기 A",
      );
      await expect(scene()).toHaveAttribute("data-source", before);
      await page
        .getByRole("button", { name: "보호 요청", exact: true })
        .click();
      await page
        .getByRole("button", { name: "마지막으로 ⇥", exact: true })
        .click();
      await expect(scene().locator('[data-auth-node="browser"]')).toContainText(
        "기기 B",
      );
      await expect(page.getByTestId("login-result")).toContainText("401");
      await sourceMatch();
    },
  );
  await check(
    "signup user journey keeps queued mail, SMTP reception, link opening, verification POST and account commit separate",
    async () => {
      await goto("signup");
      await guide()
        .getByLabel("체험 가입 이메일", { exact: true })
        .fill("guided-new@lab.test");
      await act("인증 메일 보내기 →");
      await expect(page.getByTestId("signup-account-count")).toHaveText("0");
      await expect(scene().locator('[data-auth-node="SMTP"]')).toContainText(
        "접수 1회",
      );
      await expect(scene().locator('[data-auth-node="Browser"]')).toContainText(
        "증명 없음",
      );
      await next("메일의 인증 링크 열기");
      await act("메일에서 인증 링크 열기 →");
      await expect(scene()).toHaveAttribute("data-route", "Browser");
      await sourceMatch();
      await expect(page.locator(".signup-source")).toContainText(
        "s.selectedMail",
      );
      await expect(page.getByTestId("signup-account-count")).toHaveText("0");
      await next("이메일 확인하기");
      await act("내 이메일이 맞아요 →");
      await expect(page.getByTestId("signup-result")).toContainText(
        "EMAIL_VERIFIED",
      );
      await expect(page.getByTestId("signup-account-count")).toHaveText("0");
      await sourceMatch();
      await next("가입 완료하기");
      await guide()
        .getByLabel("실습용 필수 약관 확인", { exact: true })
        .check();
      await act("회원가입 완료하기 →");
      await expect(page.getByTestId("signup-account-count")).toHaveText("1");
      await expect(page.getByTestId("signup-result")).toContainText(
        "ACCOUNT_CREATED",
      );
      await expect(page.locator(".signup-data")).toContainText(
        "guided-new@lab.test",
      );
      await sourceMatch();
      await expect(page.locator(".signup-data")).toContainText("로그인 권한");
      await page.screenshot({
        path: path.join(out, "signup-complete.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "SSO user journey requires existing login, external proof and explicit linking as three actions",
    async () => {
      await goto("signup");
      await page
        .getByRole("button", { name: "외부 계정 연결", exact: true })
        .click();
      await act("기존 실습 계정으로 로그인 →");
      await next("외부 계정으로 본인 확인");
      await act("외부 계정으로 본인 확인 →");
      await expect(page.getByTestId("signup-identity-count")).toHaveText("0");
      await next("이 계정에 연결하기");
      await act("내 계정에 연결하기 →");
      await expect(page.getByTestId("signup-identity-count")).toHaveText("1");
      await expect(page.getByTestId("signup-result")).toContainText(
        "IDENTITY_LINKED",
      );
      await sourceMatch();
    },
  );
  await check(
    "payment user journey: order and authentication do not capture; pay once then partial and full cancellation conserve amounts",
    async () => {
      await goto("payment");
      await act("10,000원 상품 주문하기 →");
      await expect(scene()).toHaveAttribute("data-ring-approved", "0");
      await next("결제 수단 인증하기");
      await act("실습 결제 수단 인증하기 →");
      await expect(scene()).toHaveAttribute("data-ring-approved", "0");
      await next("결제하기");
      await act("10,000원 결제하기 →");
      await expect(scene()).toHaveAttribute("data-ring-approved", "10000");
      await next("결제 취소하기");
      await act("입력한 금액 취소하기 →");
      await expect(scene()).toHaveAttribute("data-ring-canceled", "3000");
      await guide().getByLabel("남은 금액 모두 취소", { exact: true }).check();
      await act("남은 금액 전액 취소하기 →");
      await expect(scene()).toHaveAttribute("data-ring-canceled", "10000");
      await expect(scene()).toHaveAttribute("data-ring-reserved", "0");
      await page.screenshot({
        path: path.join(out, "payment-complete.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "chat user journey uses every real state phase when finishing quickly: join, one stored/delivered message, offline send and history recovery",
    async () => {
      await goto("chat");
      await act("참가자 A 입장하기 →");
      await act("참가자 B 입장하기 →");
      await next("메시지 보내기");
      await guide()
        .getByLabel("체험 채팅 메시지", { exact: true })
        .fill("첫 번째 사용자 메시지");
      await act("참가자 A에서 메시지 보내기 →");
      await expect(guide().locator(".lab-chat-inbox")).toContainText(
        "첫 번째 사용자 메시지",
      );
      let db = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("chat-lab:v1")),
      );
      expect(
        db.messages.filter((m) => m.body === "첫 번째 사용자 메시지"),
      ).toHaveLength(1);
      await next("연결을 끊고 메시지 남기기");
      await act("참가자 B 잠시 나가기 →");
      await guide()
        .getByLabel("체험 채팅 메시지", { exact: true })
        .fill("돌아오면 읽을 메시지");
      await act("오프라인인 상대에게 보내기 →");
      await expect(guide().locator(".lab-chat-inbox")).not.toContainText(
        "돌아오면 읽을 메시지",
      );
      await next("다시 접속해서 대화 받기");
      await act("참가자 B 다시 입장하기 →");
      await expect(guide().locator(".lab-chat-inbox")).toContainText(
        "돌아오면 읽을 메시지",
      );
      db = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("chat-lab:v1")),
      );
      expect(db.messages).toHaveLength(2);
      await page.screenshot({
        path: path.join(out, "chat-complete.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "basic and technical modes change only controls, preserving scenario data and selected source",
    async () => {
      for (const p of ["login", "signup", "payment"]) {
        await goto(p);
        const before = await scene().getAttribute("data-source");
        await page
          .getByRole("button", { name: "직접 실험하기", exact: true })
          .click();
        await expect(page.locator(".lab-user")).toBeHidden();
        await expect(page.locator(".lab-technical")).toBeVisible();
        await page
          .getByRole("button", { name: "사용자로 체험하기", exact: true })
          .click();
        await expect(scene()).toHaveAttribute("data-source", before);
      }
    },
  );
  await check(
    "a mobile action provides a direct processing/source entry without losing the user journey",
    async () => {
      await page.setViewportSize({ width: 390, height: 1000 });
      await goto("login");
      await act("로그인하기 →");
      await page
        .getByRole("button", { name: "처리 흐름·소스 보기 →", exact: true })
        .click();
      await expect(scene()).toBeVisible();
      await sourceMatch();
      await page.getByRole("tab", { name: "체험", exact: true }).click();
      await expect(
        guide().getByRole("button", {
          name: "다음: 내 정보 확인하기 →",
          exact: true,
        }),
      ).toBeVisible();
    },
  );
  await check(
    "guided controls and scene fit 320/390/768/1440; mobile users can switch to the processing/source panel",
    async () => {
      for (const width of [320, 390, 768, 1440])
        for (const p of ["login", "signup", "payment", "chat"]) {
          await page.setViewportSize({ width, height: 1000 });
          await goto(p);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            p + " " + width + " overflow",
          ).toBe(true);
          if (width === 390) {
            await guide().screenshot({
              path: path.join(out, p + "-guide-390.png"),
            });
            const flow = page.getByRole("tab", {
              name: "흐름·소스",
              exact: true,
            });
            if (await flow.isVisible()) await flow.click();
            await expect(scene()).toBeVisible();
            await scene().screenshot({
              path: path.join(out, p + "-flow-390.png"),
            });
          }
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
        verifiedAt: new Date().toISOString(),
        base,
        checks,
        pageErrors: errors,
        backendRequests: requests,
        scope:
          "Guided browser simulation and actual frozen source mapping, not a real backend I/O run",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${checks.length} guided user journey groups passed at ${base}`);
} catch (error) {
  await page
    .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}

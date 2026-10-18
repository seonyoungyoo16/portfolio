import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = process.argv[2] || "../springboot-signup-lab",
  revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  read = (file) =>
    execFileSync("git", ["show", revision + ":" + file], {
      cwd: root,
      encoding: "utf8",
    }).replace(/\r\n/g, "\n");
const files = execFileSync("git", ["ls-tree", "-r", "--name-only", revision], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n");
const sources = {},
  hashes = {};
for (const file of files.filter(
  (f) => f.endsWith(".java") || f === "scripts/gateway.mjs",
)) {
  const text = read(file),
    lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/flow:([\w.]+)/);
    if (m) {
      const count =
        {
          "SignupService.complete": 165,
          "SignupService.requestEmail": 120,
          "SignupService.verify": 78,
          "OidcService.link": 100,
          "OidcService.validate": 100,
          "MailWorker.send": 70,
        }[m[1]] || 36;
      sources[m[1]] = {
        file,
        line: i + 2,
        lines: lines.slice(i + 1, i + 1 + count),
      };
      hashes[file] = crypto.createHash("sha256").update(text).digest("hex");
    }
  }
}
const browser = JSON.parse(read("docs/verification/browser-summary.json")),
  backend = JSON.parse(read("docs/verification/backend-summary.json"));
assert.equal(browser.status, "passed");
assert.equal(browser.tests.length, 50);
assert.ok(browser.tests.every((t) => t.status === "passed"));
assert.equal(backend.passed, 12);
const model = {
  repo: "https://github.com/seonyoungyoo16/springboot-signup-lab",
  revision,
  verification: {
    at: browser.finishedAt,
    browser: browser.tests.length,
    backend: backend.passed,
    anchors: Object.keys(sources).length,
  },
  policy: {
    flow: 1800,
    link: 600,
    proof: 600,
    cooldown: 60,
    emailLimit: 5,
    ipLimit: 20,
    flowLimit: 3,
    recent: 300,
  },
  sources,
  hashes,
};
fs.writeFileSync(
  "src/generated/signup-source.json",
  JSON.stringify(model, null, 2) + "\n",
);
console.log(
  `Exported ${Object.keys(sources).length} signup source anchors at ${revision.slice(0, 7)}`,
);

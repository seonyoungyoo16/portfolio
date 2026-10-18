import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = process.argv[2] || "../springboot-payment-lab",
  revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  read = (file) =>
    execFileSync("git", ["show", revision + ":" + file], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 4000000,
    }).replace(/\r\n/g, "\n");
const files = execFileSync("git", ["ls-tree", "-r", "--name-only", revision], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n"),
  sources = {},
  hashes = {};
for (const file of files.filter(
  (f) =>
    f.endsWith(".java") ||
    ["psp/server.mjs", "scripts/gateway.mjs", "frontend/main.tsx"].includes(f),
)) {
  const raw = read(file),
    lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/flow:([\w.]+)/);
    if (m) {
      sources[m[1]] = { file, line: i + 2, lines: lines.slice(i + 1, i + 61) };
      hashes[file] = crypto.createHash("sha256").update(raw).digest("hex");
    }
  }
}
const browser = JSON.parse(read("docs/verification/browser.json")),
  backend = JSON.parse(read("docs/verification/backend.json"));
assert.equal(browser.status, "passed");
assert.equal(browser.tests.length, 64);
assert(browser.tests.every((t) => t.status === "passed"));
assert.equal(backend.status, "passed");
assert.equal(backend.tests.length, 12);
assert(backend.tests.every((t) => t.status === "passed"));
assert.equal(Object.keys(sources).length, 37);
fs.writeFileSync(
  "src/generated/payment-source.json",
  JSON.stringify(
    {
      repo: "https://github.com/seonyoungyoo16/springboot-payment-lab",
      revision,
      verification: {
        at: browser.finishedAt,
        browser: 64,
        backend: 12,
        anchors: Object.keys(sources).length,
      },
      sources,
      hashes,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Exported " +
    Object.keys(sources).length +
    " payment source anchors at " +
    revision.slice(0, 7),
);

import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const model = JSON.parse(
    fs.readFileSync("src/generated/signup-source.json", "utf8"),
  ),
  root = process.argv[2] || "../springboot-signup-lab",
  contents = {};
for (const [file, hash] of Object.entries(model.hashes)) {
  const text = execFileSync("git", ["show", model.revision + ":" + file], {
    cwd: root,
    encoding: "utf8",
  }).replace(/\r\n/g, "\n");
  assert.equal(
    crypto.createHash("sha256").update(text).digest("hex"),
    hash,
    file,
  );
  contents[file] = text;
}
for (const [key, s] of Object.entries(model.sources))
  assert.deepEqual(
    contents[s.file].split("\n").slice(s.line - 1, s.line - 1 + s.lines.length),
    s.lines,
    key,
  );
const report = JSON.parse(
  execFileSync(
    "git",
    ["show", model.revision + ":docs/verification/browser-summary.json"],
    { cwd: root, encoding: "utf8" },
  ),
);
assert.equal(report.status, "passed");
assert.equal(report.tests.length, 50);
assert.ok(report.tests.every((t) => t.status === "passed"));
assert.equal(model.verification.backend, 12);
console.log(
  `Verified ${Object.keys(model.sources).length} signup excerpts and ${Object.keys(model.hashes).length} hashes at ${model.revision}`,
);

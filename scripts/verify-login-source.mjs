import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const model = JSON.parse(
  fs.readFileSync("src/generated/login-source.json", "utf8"),
);
const root = process.argv[2] || "../springboot-login-lab";
const contents = {};
for (const [file, hash] of Object.entries(model.hashes)) {
  const content = execFileSync("git", ["show", `${model.revision}:${file}`], {
    cwd: root,
    encoding: "utf8",
  }).replace(/\r\n/g, "\n");
  assert.equal(
    crypto.createHash("sha256").update(content).digest("hex"),
    hash,
    file,
  );
  contents[file] = content;
}
for (const [key, source] of Object.entries(model.sources))
  assert.deepEqual(
    contents[source.file]
      .split("\n")
      .slice(source.line - 1, source.line - 1 + source.lines.length),
    source.lines,
    key,
  );
const coverage = JSON.parse(
  execFileSync(
    "git",
    ["show", `${model.revision}:docs/verification/coverage.json`],
    { cwd: root, encoding: "utf8" },
  ),
);
assert.equal(coverage.status, "passed");
assert.equal(model.verification.browser, 41);
assert.equal(model.verification.design, 40);
assert.deepEqual(model.policy, {
  idle: 1800,
  absolute: 28800,
  remember: 1209600,
  recent: 300,
  grace: 5,
});
console.log(
  `Verified ${Object.keys(model.sources).length} excerpts and ${Object.keys(model.hashes).length} hashes at ${model.revision}`,
);

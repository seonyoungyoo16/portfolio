import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const model = JSON.parse(
    fs.readFileSync("src/generated/payment-source.json", "utf8"),
  ),
  root = process.argv[2] || "../springboot-payment-lab",
  read = (file) =>
    execFileSync("git", ["show", model.revision + ":" + file], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 4000000,
    }).replace(/\r\n/g, "\n");
for (const [file, hash] of Object.entries(model.hashes))
  assert.equal(
    crypto.createHash("sha256").update(read(file)).digest("hex"),
    hash,
    file,
  );
for (const [key, s] of Object.entries(model.sources))
  assert.deepEqual(
    read(s.file)
      .split("\n")
      .slice(s.line - 1, s.line - 1 + s.lines.length),
    s.lines,
    key,
  );
for (const [name, count] of [
  ["browser", 64],
  ["backend", 12],
]) {
  const report = JSON.parse(read("docs/verification/" + name + ".json"));
  assert.equal(report.status, "passed");
  assert.equal(report.tests.length, count);
  assert(report.tests.every((t) => t.status === "passed"));
}
assert.equal(Object.keys(model.sources).length, 37);
console.log(
  "37 payment source excerpts, hashes and frozen 64 browser + 12 backend records verified",
);

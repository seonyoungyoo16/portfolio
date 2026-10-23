import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const model = JSON.parse(
  fs.readFileSync("src/generated/interaction-source.json", "utf8"),
);
assert.match(model.revision, /^[a-f0-9]{40}$/);
assert.equal(Object.keys(model.sources).length, 13);
const remoteFiles = new Map();
const remote = process.argv.includes("--remote");
for (const [key, source] of Object.entries(model.sources)) {
  const text = execFileSync(
    "git",
    ["show", `${model.revision}:${source.file}`],
    { encoding: "utf8" },
  ).replaceAll("\r\n", "\n");
  assert.equal(
    crypto.createHash("sha256").update(text).digest("hex"),
    source.sha256,
    key,
  );
  assert.deepEqual(
    text
      .split("\n")
      .slice(source.line - 1, source.line - 1 + source.lines.length),
    source.lines,
    key,
  );
  assert(source.lines[0].trim().startsWith("if ("), key);
  if (remote) {
    if (!remoteFiles.has(source.file)) {
      const url = `https://raw.githubusercontent.com/seonyoungyoo16/portfolio/${model.revision}/${source.file}`;
      const response = await fetch(url);
      assert.equal(response.status, 200, url);
      remoteFiles.set(source.file, (await response.text()).replaceAll("\r\n", "\n"));
    }
    assert.equal(remoteFiles.get(source.file), text, key + " public source");
  }
}
const proof = { status: "passed", verifiedAt: new Date().toISOString(), revision: model.revision,
  branches: Object.keys(model.sources), files: [...new Set(Object.values(model.sources).map(s => s.file))],
  remote, scope: "Exact source text and frozen line anchors; not backend I/O" };
fs.mkdirSync("docs/user-journey-verification", { recursive: true });
fs.writeFileSync(`docs/user-journey-verification/interaction-source${remote ? "-remote" : ""}.json`, JSON.stringify(proof, null, 2) + "\n");
console.log(
  `Verified 13 browser action branches and exact frozen file/line hashes at ${model.revision}${remote ? " including published GitHub source" : ""}`,
);

import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const model = JSON.parse(
  fs.readFileSync("src/generated/login-source.json", "utf8"),
);
const base = `https://raw.githubusercontent.com/seonyoungyoo16/springboot-login-lab/${model.revision}/`;
const checks = await Promise.all(
  Object.entries(model.hashes).map(async ([file, sha256]) => {
    const response = await fetch(base + file, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, file);
    const content = (await response.text()).replace(/\r\n/g, "\n");
    assert.equal(
      crypto.createHash("sha256").update(content).digest("hex"),
      sha256,
      file,
    );
    return { file, status: response.status, sha256 };
  }),
);
for (const file of [
  "README.md",
  "docs/DESIGN.md",
  "docs/verification/RESULTS.md",
]) {
  const response = await fetch(base + file, {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, file);
  checks.push({ file, status: response.status });
}
fs.mkdirSync("docs/login-verification", { recursive: true });
fs.writeFileSync(
  "docs/login-verification/remote-source.json",
  JSON.stringify(
    {
      status: "passed",
      completedAt: new Date().toISOString(),
      revision: model.revision,
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Public source: ${checks.length} URLs verified; ${Object.keys(model.hashes).length} file hashes match`,
);

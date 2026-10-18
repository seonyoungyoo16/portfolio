import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const base =
    process.env.PORTFOLIO_URL || "https://seonyoungyoo16.github.io/portfolio/",
  expected = JSON.parse(fs.readFileSync("dist/release.json", "utf8"));
let release;
for (let i = 0; i < 18; i++) {
  const r = await fetch(base + "release.json?verify=" + Date.now(), {
    cache: "no-store",
  });
  if (r.ok) {
    release = await r.json();
    if (release.source === expected.source) break;
  }
  if (i === 17) throw Error("Published source does not match this build");
  await new Promise((r) => setTimeout(r, 5000));
}
assert.equal(release.signupSource, expected.signupSource);
const resources = [];
for (const [file, hash] of Object.entries(expected.hashes)) {
  const r = await fetch(
    base + file + (file === "index.html" ? "?verify=" + Date.now() : ""),
    { cache: "no-store" },
  );
  assert.equal(r.status, 200, file);
  const actual = crypto
    .createHash("sha256")
    .update(Buffer.from(await r.arrayBuffer()))
    .digest("hex");
  assert.equal(actual, hash, file);
  resources.push({ file, status: r.status, sha256: actual });
}
fs.mkdirSync("docs/signup-verification/published", { recursive: true });
fs.writeFileSync(
  "docs/signup-verification/published/release.json",
  JSON.stringify(
    {
      status: "passed",
      verifiedAt: new Date().toISOString(),
      base,
      release,
      resources,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Published source, signup revision and " +
    resources.length +
    " resource hashes match",
);

import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const base =
    process.env.PORTFOLIO_URL || "https://seonyoungyoo16.github.io/portfolio/",
  expected = JSON.parse(fs.readFileSync(process.env.PORTFOLIO_RELEASE_FILE || "dist/release.json", "utf8"));
let release;
for (let i = 0; i < 18; i++) {
  const r = await fetch(base + "release.json?verify=" + Date.now(), {
    cache: "no-store",
  });
  if (r.ok) {
    release = await r.json();
    if (release.source === expected.source) break;
  }
  if (i === 17) throw Error("Published revision does not match this build");
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
for (const key of [
  "source",
  "paymentSource",
  "signupSource",
  "loginSource",
  "chatSource",
  "interactionSource",
  "todoSource",
  "todoDemoSource",
])
  assert.equal(release[key], expected[key], key);
const resources = [];
for (const [file, hash] of Object.entries(expected.hashes)) {
  const r = await fetch(base + file + "?verify=" + Date.now(), {
    cache: "no-store",
  });
  assert.equal(r.status, 200, file);
  const sha256 = crypto
    .createHash("sha256")
    .update(Buffer.from(await r.arrayBuffer()))
    .digest("hex");
  assert.equal(sha256, hash, file);
  resources.push({ file, status: r.status, sha256 });
}
fs.mkdirSync("docs/payment-verification/published", { recursive: true });
fs.writeFileSync(
  "docs/payment-verification/published/release.json",
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
  "Published portfolio, all 4 backend revisions, Todo and browser interaction revisions plus " +
    resources.length +
    " resource hashes match",
);

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.resolve(process.argv[2] || "../springboot-login-lab");
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const read = (file) =>
  execFileSync("git", ["show", `${revision}:${file}`], {
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
function add(key, file, line, count = 22) {
  const content = read(file);
  hashes[file] = crypto.createHash("sha256").update(content).digest("hex");
  sources[key] = {
    file,
    line,
    lines: content.split("\n").slice(line - 1, line - 1 + count),
  };
}
for (const file of files.filter(
  (file) => file.endsWith(".java") || file === "scripts/gateway.mjs",
)) {
  read(file)
    .split("\n")
    .forEach((line, i) => {
      const m = line.match(/flow:([\w.]+)/);
      if (m) add(m[1], file, i + 2);
    });
}
const java = "backend/src/main/java/dev/portfolio/loginlab/";
const excerptLengths = {
  "AuthService.prepare": 32,
  "AuthService.activate": 40,
  "AuthService.guard": 50,
  "AuthOperations.reauthenticate": 33,
};
for (const [key, count] of Object.entries(excerptLengths)) {
  const source = sources[key];
  add(key, source.file, source.line, count);
}
for (const [key, file, needle, count] of [
  [
    "SessionStore.ttl",
    java + "SessionStore.java",
    "  public void saveAuthenticated(",
    15,
  ],
  ["Policy", java + "Policy.java", "  public static Policy of(", 11],
  ["AuthOperations.recent", java + "AuthOperations.java", "  void recent(", 6],
  ["Gateway.network", "scripts/gateway.mjs", "function tcp(", 32],
  ["SessionStore.raw", java + "SessionStore.java", "  public Session raw(", 23],
  [
    "AuthService.restore.lock",
    java + "AuthService.java",
    '              Map<String, Object> u = db.one("SELECT * FROM users WHERE id=? FOR UPDATE", uid),',
    18,
  ],
  [
    "AuthService.restore",
    java + "AuthService.java",
    "              String sent = hash(parts[1]);",
    31,
  ],
  [
    "AuthOperations.revoke",
    java + "AuthOperations.java",
    "              if (all) {",
    28,
  ],
  [
    "AuthOperations.expiredLogout",
    java + "AuthOperations.java",
    "              String sent = AuthService.hash(parts[1]);",
    25,
  ],
  [
    "AuthController.login",
    java + "AuthController.java",
    '  @PostMapping("/api/auth/login")',
    6,
  ],
  [
    "AuthController.restore",
    java + "AuthController.java",
    '  @PostMapping("/api/auth/restore")',
    5,
  ],
  [
    "AuthController.me",
    java + "AuthController.java",
    '  @GetMapping("/api/auth/me")',
    5,
  ],
  [
    "AuthController.logout",
    java + "AuthController.java",
    '  @PostMapping("/api/auth/logout")',
    8,
  ],
  [
    "AuthController.all",
    java + "AuthController.java",
    '  @PostMapping("/api/auth/logout-all")',
    7,
  ],
  [
    "AuthController.reauth",
    java + "AuthController.java",
    '  @PostMapping("/api/auth/reauthenticate")',
    7,
  ],
]) {
  const line =
    read(file)
      .split("\n")
      .findIndex((text) => text.includes(needle)) + 1;
  if (!line) throw Error("Missing source: " + key);
  add(key, file, line, count);
}
const policy = read(java + "Policy.java").match(
  /default -> new Policy\((\d+), (\d+), (\d+), (\d+), (\d+),/,
);
if (!policy) throw Error("Policy extraction failed");
const coverage = JSON.parse(read("docs/verification/coverage.json")),
  backend = JSON.parse(read("docs/verification/backend.json"));
const model = {
  repo: "https://github.com/seonyoungyoo16/springboot-login-lab",
  revision,
  policy: {
    idle: +policy[1],
    absolute: +policy[2],
    remember: +policy[3],
    recent: +policy[4],
    grace: +policy[5],
  },
  verification: {
    at: coverage.completedAt,
    backend: backend.passed,
    browser: coverage.browserScenarios,
    design: coverage.passingDesignScenarios,
    anchors: coverage.sourceAnchors,
  },
  sources,
  hashes,
};
fs.writeFileSync(
  "src/generated/login-source.json",
  JSON.stringify(model, null, 2) + "\n",
);
console.log(
  `Exported ${Object.keys(sources).length} source excerpts at ${revision.slice(0, 7)}`,
);

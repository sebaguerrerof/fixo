import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const root = process.cwd().replaceAll("\\", "/");
const paths = [...new Set(execFileSync("git", ["-c", `safe.directory=${root}`, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))];
const rules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Supabase secret", /sb_secret_[A-Za-z0-9_-]{20,}/],
  ["GitHub token", /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/],
  ["literal JWT", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
];
const localValues = existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/)
  .map(line => line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)).filter(Boolean)
  .map(match => [match[1], match[2].replace(/^['"]|['"]$/g, "")]).filter(([,value]) => value.length > 15) : [];
const findings = [];
for (const path of paths) {
  if (/^\.env(?!\.example$)/.test(path) || path.startsWith(".vercel/")) findings.push({ path, rule:"sensitive file" });
  if (!existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  for (const [label, pattern] of rules) if (pattern.test(content)) findings.push({ path, rule:label });
  for (const [name, value] of localValues) if (content.includes(value)) findings.push({ path, rule:`local environment value: ${name}` });
}
console.log(JSON.stringify({ checked:paths.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;

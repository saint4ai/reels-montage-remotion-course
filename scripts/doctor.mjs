import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const checks = [];
const major = Number(process.versions.node.split(".")[0]);
checks.push([major >= 20, `Node.js ${process.versions.node} (нужен 20+)`]);
checks.push([existsSync("node_modules/remotion"), "Remotion установлен"]);
checks.push([existsSync("project/project.json"), "project/project.json найден"]);
checks.push([existsSync("src/index.ts"), "точка входа Remotion найдена"]);

try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  checks.push([true, "ffmpeg найден"]);
} catch {
  checks.push([false, "ffmpeg не найден"]);
}

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "OK" : "FAIL"}  ${label}`);
  failed ||= !ok;
}

if (failed) {
  console.error("\nИсправьте FAIL перед началом монтажа.");
  process.exit(1);
}

console.log("\nОкружение готово. Следующий шаг: npm run studio");


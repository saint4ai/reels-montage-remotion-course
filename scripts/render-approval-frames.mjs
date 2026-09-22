import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const project = JSON.parse(readFileSync("project/project.json", "utf8"));
const version = process.argv[2] || "layout-v001";
if (!/^layout-v\d{3}$/.test(version)) {
  console.error("Версия должна выглядеть так: layout-v001");
  process.exit(1);
}

const outputDir = path.join("reviews", version);
mkdirSync(outputDir, { recursive: true });
const lastFrame = Math.max(0, Math.round(project.durationSeconds * project.fps) - 1);
const frames = [];

for (let second = 0; second < project.durationSeconds; second += 2) {
  frames.push(Math.round(second * project.fps));
}
if (!frames.includes(lastFrame)) frames.push(lastFrame);

const manifest = [];
for (const [index, frame] of frames.entries()) {
  const number = String(index + 1).padStart(3, "0");
  const seconds = frame / project.fps;
  const filename = `K${number}-${seconds.toFixed(2).replace(".", "-")}s.png`;
  const target = path.join(outputDir, filename);
  console.log(`К${number}  ${seconds.toFixed(2)} сек`);
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["remotion", "still", "src/index.ts", "Reel", target, `--frame=${frame}`],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  manifest.push({ id: `K${number}`, frame, seconds, file: filename });
}

writeFileSync(
  path.join(outputDir, "manifest.json"),
  JSON.stringify({ version, project: "project/project.json", frames: manifest }, null, 2) + "\n",
);
console.log(`\nГотово: ${outputDir}`);


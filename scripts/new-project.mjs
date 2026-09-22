import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
  console.error("Использование: npm run new -- my-reel");
  process.exit(1);
}

const target = path.join("work", slug);
if (existsSync(target)) {
  console.error(`Проект уже существует: ${target}`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const name of ["brief.json", "storyboard.json", "reference-profile.md"]) {
  cpSync(path.join("templates", name), path.join(target, name));
}
mkdirSync(path.join(target, "assets"), { recursive: true });
console.log(`Создан ${target}`);


// Проверка текстов инструкций без сети: npm run docs:test
// Что держим: ядро правил одинаково в CLAUDE.md и AGENTS.md; роутер ролей узнаёт новые названия чатов и старые триггеры из раздаток;
// ученик не видит старых названий («Монтажёр», «Скриптолог», «Instagram-автоматизатор») кроме пометок «старое»; ни один текст не требует
// положить ключ в файл (решение владельца курса, 11.10.2026: ключ вставляется прямо в чат); длинных тире в текстах нет;
// пути к файлам, которые называют главные документы, существуют; для Codex есть отдельные шаги.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// все .md внутри папки (без вложенных картинок и кода)
function mdIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), {withFileTypes: true})) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!['img', 'node_modules', '.venv', '.pytest_cache'].includes(e.name)) walk(rel); }
      else if (e.name.endsWith('.md')) out.push(rel);
    }
  };
  walk(dir);
  return out;
}

// тексты, которые видит ученик или читает его агент
const TEXT_FILES = [
  'README.md', 'START-HERE.md', 'CLAUDE.md', 'AGENTS.md', 'assistant/README.md',
  ...mdIn('docs'), ...mdIn('.claude/skills'), ...mdIn('team'), ...mdIn('templates'),
  ...mdIn('assistant/knowledge'), ...mdIn('assistant/prompts'),
].filter((f, i, a) => a.indexOf(f) === i && exists(f));

const core = (rel) => {
  const s = read(rel);
  const a = s.indexOf('<!-- ядро:начало -->'), b = s.indexOf('<!-- ядро:конец -->');
  assert.ok(a >= 0 && b > a, `${rel}: нет блока «ядро»`);
  return s.slice(a, b);
};

test('ядро правил одинаково в CLAUDE.md и AGENTS.md', () => {
  assert.equal(core('CLAUDE.md'), core('AGENTS.md'));
});

test('роутер ролей: новые названия, старые триггеры из раздаток и пути навыков', () => {
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    const t = core(f);
    for (const s of [
      '«Монтаж Reels»', '«Скрипты для Reels»', '«Instagram AI-менеджер»',
      'Ты Скриптолог этой папки', 'Ты Instagram-автоматизатор этой папки', 'Ты Монтажёр',
      '.claude/skills/onai-montage/SKILL.md', '.claude/skills/onai-scriptolog/SKILL.md', '.claude/skills/onai-automator/SKILL.md',
      'Ещё 2 чата я создам сам', 'инструментом правки файла', 'git check-ignore', 'выкладывай', 'npm run board:open',
    ]) assert.ok(t.includes(s), `${f}: в ядре нет «${s}»`);
  }
  // первая фраза ученика в Codex из раздатки Вебинара
  const phrase = 'Я работаю в Codex, а не в Claude Desktop: шаги и картинки про Claude Desktop пропускай, подписка Claude мне не нужна. Ещё 2 чата я создам сам.';
  assert.ok(read('README.md').includes(phrase), 'README.md: нет первой фразы для Codex');
  assert.ok(read('docs/guides/codex.md').includes(phrase), 'codex.md: нет первой фразы для Codex');
  const agents = read('AGENTS.md');
  for (const s of ['Я работаю в Codex', 'docs/guides/codex.md', 'Подписка Claude не нужна', 'GPT-6.1 Sol', 'Подтверждать за меня']) assert.ok(agents.includes(s), `AGENTS.md: нет «${s}»`);
  assert.ok(read('CLAUDE.md').includes('@.claude/skills/onai-team/SKILL.md'), 'CLAUDE.md: нет подключения общего навыка');
});

test('первые сообщения чатов в team/prompts называют роль и навык', () => {
  const sc = read('team/prompts/scriptolog.md'), au = read('team/prompts/automator.md');
  assert.ok(sc.startsWith('Ты чат «Скрипты для Reels» этой папки'));
  assert.ok(sc.includes('.claude/skills/onai-scriptolog/SKILL.md') && sc.includes('раздела 1'));
  assert.ok(au.startsWith('Ты чат «Instagram AI-менеджер» этой папки'));
  assert.ok(au.includes('.claude/skills/onai-automator/SKILL.md') && au.includes('раздела 1'));
});

test('ученик не видит старых названий чатов (кроме пометок «старое название»)', () => {
  const MARK = /стар(ое|ые|ый|ых)|прежн|бывш|триггер|так теперь называется/i;
  const OLD = /Монтажёр\w*|Скриптолог\w*|Instagram-автоматизатор\w*|[Аа]втоматизатор\w*/;
  const bad = [];
  for (const f of TEXT_FILES) {
    read(f).split('\n').forEach((line, i) => { if (OLD.test(line) && !MARK.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`); });
  }
  // картинки инструкций рисует код: тоже без старых названий
  read('src/guides/GuideShots.tsx').split('\n').forEach((line, i) => { if (OLD.test(line)) bad.push(`src/guides/GuideShots.tsx:${i + 1}`); });
  assert.deepEqual(bad, []);
});

test('ни один текст не требует положить ключ в файл или не вставлять его в чат', () => {
  const SAFE = /парол|карт|код из письма|приватн|SSH|скриншот|сторис|публичн/i;
  const bad = [];
  for (const f of TEXT_FILES) {
    read(f).split('\n').forEach((line, i) => {
      const where = `${f}:${i + 1}: ${line.trim().slice(0, 110)}`;
      if (/Ключ лежит в файле|Ключ в чат не вставля|Ключи в чат не вставля|никогда не вставляй в чат с агентом|Открой Блокнот, вставь ключ/i.test(line)) bad.push(where);
      if (/key\.txt/.test(line) && !/стар(ый|ому|ом)|уже лежит|--service|--from-file|имена|set_env/i.test(line)) bad.push(where);
      if (/ключ[^.\n]{0,40}в чат(?:е)? не вставл/i.test(line) && !SAFE.test(line)) bad.push(where);
    });
  }
  assert.deepEqual(bad, []);
});

test('в текстах для людей нет длинных тире', () => {
  const bad = TEXT_FILES.filter((f) => read(f).includes('—'));
  assert.deepEqual(bad, []);
});

test('пути к файлам, которые называют главные документы, существуют', () => {
  const MAIN = ['README.md', 'START-HERE.md', 'CLAUDE.md', 'AGENTS.md', 'docs/SCENARIO.md', 'docs/guides/codex.md', '.claude/skills/onai-team/SKILL.md', 'team/prompts/scriptolog.md', 'team/prompts/automator.md'];
  const RE = /(?:docs|team|templates|\.claude\/skills|assistant|scripts|tools)\/[A-Za-z0-9_\-./]*[A-Za-z0-9_-]\.(?:md|mjs|py|toml|json|sh)\b/g;
  const missing = [];
  for (const f of MAIN) {
    for (const m of read(f).match(RE) ?? []) {
      if (!exists(m) && !exists(`assistant/${m.replace(/^assistant\//, '')}`)) missing.push(`${f}: ${m}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('доски форматов и гайд patterns.md на месте, навыки на них ссылаются', () => {
  for (const f of ['public/style-previews/formats.jpg', 'public/style-previews/styles.jpg', 'public/style-previews/business.jpg', 'docs/guides/patterns.md']) assert.ok(exists(f), `нет ${f}`);
  for (const f of ['.claude/skills/onai-business/SKILL.md', '.claude/skills/onai-montage/SKILL.md']) assert.ok(read(f).includes('business.jpg'), `${f}: нет доски business.jpg`);
  for (const f of ['CLAUDE.md', 'AGENTS.md']) assert.ok(core(f).includes('business.jpg'), `${f}: в ядре нет доски business.jpg`);
  assert.ok(read('.claude/skills/onai-montage/SKILL.md').includes('docs/guides/patterns.md'), 'onai-montage: нет отсылки к patterns.md');
});

test('для Codex есть отдельные шаги: проект, модель, права, новый чат, переименование', () => {
  const t = read('docs/guides/codex.md');
  for (const s of ['GPT-6.1 Sol', 'Высокое', 'Подтверждать за меня', 'Рабочее дерево', 'Этот компьютер', 'Новый чат', 'team/prompts/scriptolog.md', 'team/prompts/automator.md', 'дважды нажми', 'Plus', '20 $']) {
    assert.ok(t.includes(s), `codex.md: нет «${s}»`);
  }
  const readme = read('README.md');
  assert.ok(readme.includes('ChatGPT Plus (20 $ в месяц)') && readme.includes('GPT-6.1 Sol'), 'README.md: нет строки подписки и модели для Codex');
  assert.ok(read('.claude/skills/onai-team/SKILL.md').includes('docs/guides/codex.md'), 'onai-team: нет отсылки к codex.md');
  assert.ok(read('.claude/skills/onai-montage/SKILL.md').includes('docs/guides/codex.md'), 'onai-montage: нет отсылки к codex.md');
});

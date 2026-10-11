// Проверка озвучки без сети и без ключа: npm run voice:test
// Поддельный fetch отвечает вместо ElevenLabs, раскодирование звука подменено (кроме одного теста с настоящим ffmpeg).
// Проверяем: нарезку на фразы, разбор SCRIPT.md, тайминги слов и склейку, кэш (повтор и правка одной фразы), запасную модель,
// отказ без ключа и без голоса, что ключ идёт только в заголовок запросов, защиту чужого voice.wav, проверку распознаванием, список голосов.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  alignmentWords, assemble, briefLang, briefVoice, cacheKey, cleanText, compareSpeech, diffTokens, ElevenError, encodeWav, explain,
  extractScriptText, formatDiff, hasFfmpeg, isModelProblem, main, parseArgs, readKey, splitPhrases, ttsBody,
} from './voice.mjs';

const KEY = 'test-key-not-real-123456';
const VOICE = 'AbCdEfGhIjKlMnOpQrSt';
const SCRIPT_MD = `# Демо: сценарий

Статус: утверждён

## Текст для суфлёра

\`\`\`
Напиши в таблице, что посчитать. Она посчитает сама. Это Claude, 20 долларов в месяц.
\`\`\`

## Первые 3 секунды

- Хук: «нет»
`;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json', ...headers}});

// ответ ElevenLabs на фразу: каждая буква звучит 0,05 с, речь начинается на 0,2 с, после неё 0,6 с тишины
const align = (t) => {
  const chars = [...t];
  return {characters: chars, character_start_times_seconds: chars.map((_, i) => +(0.2 + i * 0.05).toFixed(3)),
    character_end_times_seconds: chars.map((_, i) => +(0.2 + (i + 1) * 0.05).toFixed(3))};
};
function ttsAnswer(text, spoken = text) {
  const dur = 0.2 + [...spoken].length * 0.05 + 0.6;
  return {audio_base64: Buffer.from(JSON.stringify({dur})).toString('base64'), alignment: align(text), normalized_alignment: align(spoken)};
}
const decode = (buf, sr) => new Float32Array(Math.round(JSON.parse(buf.toString()).dur * sr)).fill(0.5);

// поддельная сеть: записывает запросы и отвечает как ElevenLabs
function fakeNet(opts = {}) {
  const calls = [];
  const state = {tts: 0, ...opts};
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    const call = {url: u, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body};
    calls.push(call);
    if (u.includes('/text-to-speech/')) {
      const body = JSON.parse(init.body);
      call.json = body;
      state.tts++;
      if (state.rateLimitFirst && state.tts === 1) return json({detail: {status: 'too_many_concurrent_requests', message: 'wait'}}, 429);
      if (state.noV4 && body.model_id === 'eleven_v4') return json({detail: {status: 'model_not_found', message: 'The model eleven_v4 is not available on your plan'}}, 400);
      if (state.quotaAt && state.tts === state.quotaAt) return json({detail: {status: 'quota_exceeded', message: `You have 10 credits remaining, while 50 credits are required. ${KEY}`}}, 401);
      return json(ttsAnswer(body.text, state.spoken?.[body.text]), 200, {'x-character-count': String(body.text.length)});
    }
    if (u.endsWith('/v1/user/subscription')) return state.subscription ? json(state.subscription) : json({detail: {status: 'missing_permissions', message: 'нет права'}}, 401);
    if (u.endsWith('/v1/speech-to-text')) {
      call.form = {model: init.body.get('model_id'), lang: init.body.get('language_code'), fileName: init.body.get('file')?.name};
      if (state.sttDenied) return json({detail: {status: 'missing_permissions', message: 'speech_to_text'}}, 401);
      return json({text: state.sttText ?? 'Напиши в таблице что посчитать Она посчитает сама Это Claude 20 долларов в месяц'});
    }
    if (u.includes('/v2/voices')) {
      if (state.voicesDenied) return json({detail: {status: 'missing_permissions', message: 'The API key is missing the permission voices_read'}}, 401);
      return json({voices: [{voice_id: VOICE, name: 'Диктор', category: 'premade', labels: {gender: 'female', accent: 'russian'}, verified_languages: [{language: 'ru'}], preview_url: 'https://storage.example/preview.mp3'}], has_more: false});
    }
    return json({}, 404);
  };
  return {fetchImpl, calls, state};
}

function project({script = SCRIPT_MD, brief, briefJson} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test-'));
  fs.mkdirSync(path.join(dir, 'work', 'demo'), {recursive: true});
  if (script !== null) fs.writeFileSync(path.join(dir, 'work', 'demo', 'SCRIPT.md'), script);
  if (brief) { fs.mkdirSync(path.join(dir, 'work', '_profile'), {recursive: true}); fs.writeFileSync(path.join(dir, 'work', '_profile', 'brief.md'), brief); }
  if (briefJson) fs.writeFileSync(path.join(dir, 'work', 'demo', 'brief.json'), JSON.stringify(briefJson));
  return dir;
}
const run = async (dir, argv, net, env = {ELEVENLABS_API_KEY: KEY}) => {
  const logs = [];
  const code = await main(argv, {env, cwd: dir, fetchImpl: net.fetchImpl, decode, log: (s) => logs.push(String(s)), sleep: async () => {}});
  return {code, logs, text: logs.join('\n')};
};
const ttsCalls = (net) => net.calls.filter((c) => c.url.includes('/text-to-speech/'));
const allFiles = (dir) => fs.readdirSync(dir, {recursive: true, withFileTypes: true}).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name));
const wavSeconds = (file) => { const b = fs.readFileSync(file); return b.readUInt32LE(40) / 2 / b.readUInt32LE(24); };

// ---------- чистые функции ----------

test('фразы: знаки конца, кавычки, «т. д.», абзацы, цифра в начале предложения', () => {
  assert.deepEqual(splitPhrases('Раз. Два! Три? Четыре…'), ['Раз.', 'Два!', 'Три?', 'Четыре…']);
  assert.deepEqual(splitPhrases('Это стоит 3.5 доллара. Включая т. д. и так далее.'), ['Это стоит 3.5 доллара.', 'Включая т. д. и так далее.']);
  assert.deepEqual(splitPhrases('Напиши «СЛОВО». Пришлю инструкцию.'), ['Напиши «СЛОВО».', 'Пришлю инструкцию.']);
  assert.deepEqual(splitPhrases('Первая\nстрока. Вторая.\n\nТретья без точки'), ['Первая строка.', 'Вторая.', 'Третья без точки']);
  assert.deepEqual(splitPhrases('Готово. 5 минут и всё.'), ['Готово.', '5 минут и всё.']);
  assert.deepEqual(splitPhrases('  \n\n '), []);
});

test('SCRIPT.md: текст из блока кода, без блока кода раздел целиком, нет раздела: null, шаблон не пропускается', () => {
  assert.equal(extractScriptText(SCRIPT_MD), 'Напиши в таблице, что посчитать. Она посчитает сама. Это Claude, 20 долларов в месяц.');
  assert.equal(extractScriptText('## Текст для суфлера\n\nОдин **жирный** абзац.\nВторая строка.\n\n## Дальше\nне это'), 'Один жирный абзац.\nВторая строка.');
  assert.equal(extractScriptText('# Название\n\nтекста нет'), null);
  assert.equal(extractScriptText('## Текст для суфлёра\n\n```\n<Весь текст одним блоком>\n```\n'), '<Весь текст одним блоком>');
  assert.equal(extractScriptText('## Текст для суфлёра\n\nВступление.\n\n````\nТекст внутри.\n```\nвложенные кавычки\n````\n'), 'Текст внутри.\n\nвложенные кавычки'); // блок из четырёх кавычек закрывается четырьмя, лишнюю разметку убирает cleanText
  assert.equal(cleanText('  `код`  и​ __жирный__  '), 'код и жирный');
});

test('анкета: ID голоса и язык озвучки, шаблонные строки игнорируются', () => {
  assert.equal(briefVoice(`- ID голоса: ${VOICE}`), VOICE);
  assert.equal(briefVoice(`ID голоса (из ElevenLabs): \`${VOICE}\``), VOICE);
  assert.equal(briefVoice('ID голоса: <вставить ID из ElevenLabs>'), null);
  assert.equal(briefVoice('ID голоса: пока не выбран'), null);
  assert.equal(briefLang('Язык озвучки: EN'), 'en');
  assert.equal(briefLang('Язык озвучки: <ru или en>'), null);
});

test('параметры: проверка значений и лишних аргументов', () => {
  const o = parseArgs(['demo', '--voice', VOICE, '--redo', '2,4', '--pause', '0.5', '--no-check']);
  assert.equal(o.slug, 'demo'); assert.deepEqual(o.redo, [2, 4]); assert.equal(o.pause, 0.5); assert.equal(o.check, false); assert.equal(o.model, 'eleven_v4');
  assert.throws(() => parseArgs(['demo', '--voice', 'коротко']), /ID голоса/);
  assert.throws(() => parseArgs(['demo', '--redo', '0']), /--redo/);
  assert.throws(() => parseArgs(['demo', '--pause', '9']), /--pause/);
  assert.throws(() => parseArgs(['demo', 'other']), /лишний/);
  assert.throws(() => parseArgs(['..\\evil']), /имя ролика/);
  assert.throws(() => parseArgs(['demo', '--bad']), /неизвестный/);
  assert.throws(() => parseArgs(['demo', '--voice']), /нужно значение/);
});

test('ключ: из окружения, иначе из .env (кавычки снимаются), иначе null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-key-'));
  assert.equal(readKey({env: {}, cwd: dir}), null);
  fs.writeFileSync(path.join(dir, '.env'), '# комментарий\nELEVENLABS_API_KEY="abc123"\n');
  assert.equal(readKey({env: {}, cwd: dir}), 'abc123');
  assert.equal(readKey({env: {ELEVENLABS_API_KEY: ' fromenv '}, cwd: dir}), 'fromenv');
});

test('слова фразы: подписи из текста сценария, время из ответа; запасные пути для произнесённого текста', () => {
  const phrase = 'Это 20 долларов.';
  const a = alignmentWords({alignment: align(phrase), normalized_alignment: align('Это двадцать долларов.')}, phrase);
  assert.equal(a.source, 'text');
  assert.deepEqual(a.words.map((w) => w.text), ['Это', '20', 'долларов.']);
  assert.equal(a.words[0].start, 0.2); assert.equal(a.words[0].end, 0.35);
  // alignment ответа не про наш текст: берём произнесённое, число слов совпало, подписи остаются из сценария, время из произнесённого
  const b = alignmentWords({alignment: align('другое'), normalized_alignment: align('Это двадцать долларов.')}, phrase);
  assert.equal(b.source, 'text');
  assert.deepEqual(b.words.map((w) => w.text), ['Это', '20', 'долларов.']);
  assert.ok(Math.abs(b.words[1].end - b.words[1].start - 0.4) < 1e-9, 'у слова «двадцать» время по восьми буквам');
  // число слов разное («2026» произнесено тремя словами): подписи из произнесённого
  const c = alignmentWords({alignment: null, normalized_alignment: align('в две тысячи двадцать шестом')}, 'в 2026-м');
  assert.equal(c.source, 'spoken');
  assert.equal(c.words.length, 5);
  assert.throws(() => alignmentWords({}, 'фраза'), /тайминги/);
});

test('склейка: резка в паузах, мягкие края, пауза между фразами, время слов сдвинуто', () => {
  const sr = 1000;
  const one = new Float32Array(2000).fill(1);
  const two = new Float32Array(1500).fill(1);
  const r = assemble([
    {samples: one, words: [{text: 'а', start: 0.2, end: 0.5}, {text: 'б', start: 0.6, end: 0.9}]},
    {samples: two, words: [{text: 'в', start: 0.1, end: 0.4}]},
  ], {sr});
  // фраза 1: от 0,13 до 1,18 с (1050 отсчётов), пауза 0,3 с, фраза 2: от 0,03 до 0,68 с (650 отсчётов)
  assert.equal(r.samples.length, 2000);
  assert.equal(r.samples[0], 0); assert.equal(r.samples[1049], 0);
  assert.equal(r.samples[500], 1);
  assert.ok(r.samples.slice(1050, 1350).every((x) => x === 0), 'между фразами тишина');
  assert.equal(r.samples[1350], 0); assert.equal(r.samples[1700], 1);
  assert.deepEqual(r.words, [{text: 'а', start: 0.07, end: 0.37}, {text: 'б', start: 0.47, end: 0.77}, {text: 'в', start: 1.42, end: 1.72}]);
  assert.deepEqual(r.wordPhrase, [0, 0, 1]);
  assert.equal(r.phrases[1].start, 1.35);
  // пустые слова (нет таймингов): берётся весь звук фразы
  const e = assemble([{samples: new Float32Array(500).fill(1), words: []}], {sr});
  assert.equal(e.samples.length, 500);
});

test('WAV: заголовок и отсчёты 16 бит', () => {
  const wav = encodeWav(new Float32Array([0, 0.5, -1, 2]), 48000);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 48000); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 8); assert.equal(wav.length, 52);
  assert.equal(wav.readInt16LE(46), 16384); assert.equal(wav.readInt16LE(48), -32767); assert.equal(wav.readInt16LE(50), 32767);
});

test('сравнение с распознанным: числа и названия отдельно, знаки и ё не мешают', () => {
  const words = [{text: 'Это', start: 0.1}, {text: 'Claude,', start: 0.5}, {text: '20', start: 3.0}, {text: 'долларов.', start: 3.4}, {text: 'ЕЩЁ', start: 5.0}];
  const phraseOf = [0, 0, 1, 1, 2];
  assert.deepEqual(compareSpeech(words, phraseOf, 'Это Claude 20 долларов еще.'), []);
  const d = compareSpeech(words, phraseOf, 'Это клод двадцать долларов еще');
  assert.equal(d.length, 2);
  assert.deepEqual([d[0].phrase, d[0].exp, d[0].got, d[0].number], [1, ['claude'], ['клод'], false]);
  assert.deepEqual([d[1].phrase, d[1].exp, d[1].got, d[1].number], [2, ['20'], ['двадцать'], true]);
  const lines = formatDiff(d);
  assert.match(lines[0], /фраза 1 \(0,5 с\): в тексте «claude», услышано «клод»/);
  assert.match(lines[1], /фраза 2 \(3,0 с\), число: в тексте «20», услышано «двадцать»/);
  // пропуск и вставка; склеенные слова не считаются расхождением
  assert.equal(diffTokens(['а', 'б', 'в'], ['а', 'в']).length, 1);
  assert.deepEqual(diffTokens(['ии', 'агент'], ['ииагент']), []);
  assert.deepEqual(diffTokens(['а'], ['а', 'лишнее'])[0].exp, []);
});

test('ошибки ElevenLabs: объяснения без ключа, признак проблемы с моделью', () => {
  const quota = new ElevenError(401, 'quota_exceeded', `мало кредитов ${KEY}`);
  assert.match(explain(quota, {key: KEY}), /Кредиты ElevenLabs.*закончились/);
  assert.ok(!explain(quota, {key: KEY}).includes(KEY));
  assert.match(explain(new ElevenError(401, 'invalid_api_key', 'x')), /не принял ключ/);
  assert.match(explain(new ElevenError(401, 'missing_permissions', 'tts')), /Text to Speech.*Voices: Read/);
  assert.match(explain(new ElevenError(402, 'paid_plan_required', 'x')), /бесплатном тарифе/);
  assert.match(explain(new ElevenError(404, 'voice_not_found', 'x')), /Голос не найден/);
  assert.match(explain(new ElevenError(0, 'network', 'нет связи с ElevenLabs')), /Проверь интернет/);
  assert.equal(isModelProblem(new ElevenError(400, 'model_not_found', 'The model eleven_v4 is not available')), true);
  assert.equal(isModelProblem(new ElevenError(422, '', 'unknown model_id')), true);
  assert.equal(isModelProblem(new ElevenError(401, 'missing_permissions', 'no models access')), false);
  assert.equal(isModelProblem(new ElevenError(404, 'voice_not_found', 'x')), false);
  assert.equal(isModelProblem(new Error('model')), false);
});

test('тело запроса: язык есть у eleven_v4 и нет у eleven_multilingual_v2, соседние фразы обрезаются', () => {
  const v4 = ttsBody({text: 'Раз.', model: 'eleven_v4', lang: 'ru', previous: 'А'.repeat(900), next: undefined});
  assert.equal(v4.language_code, 'ru'); assert.equal(v4.apply_text_normalization, 'on'); assert.equal(v4.previous_text.length, 400);
  assert.ok(!('next_text' in v4));
  assert.deepEqual(v4.voice_settings, {stability: 0.5, similarity_boost: 0.75});
  assert.ok(!('language_code' in ttsBody({text: 'Раз.', model: 'eleven_multilingual_v2', lang: 'ru'})));
  assert.notEqual(cacheKey({voice: VOICE, model: 'eleven_v4', lang: 'ru', text: 'а'}), cacheKey({voice: VOICE, model: 'eleven_v4', lang: 'ru', text: 'б'}));
  assert.notEqual(cacheKey({voice: VOICE, model: 'eleven_v4', lang: 'ru', text: 'а'}), cacheKey({voice: VOICE, model: 'eleven_multilingual_v2', lang: 'ru', text: 'а'}));
});

// ---------- сценарий целиком ----------

test('сухой запуск: фразы и число знаков, сеть не нужна, ключ не нужен', async () => {
  const dir = project();
  const net = fakeNet();
  const r = await run(dir, ['demo', '--dry-run'], net, {});
  assert.equal(r.code, 0);
  assert.equal(net.calls.length, 0);
  assert.match(r.text, /3 фраз/);
  assert.match(r.text, /1\. Напиши в таблице, что посчитать\./);
  assert.match(r.text, /Голос пока не выбран/);
  assert.match(r.text, /Ключа ELEVENLABS_API_KEY пока нет/);
  assert.ok(!fs.existsSync(path.join(dir, 'public')), 'сухой запуск ничего не пишет');
});

test('нет ключа, нет голоса, нет сценария, шаблон вместо текста: понятный отказ, сеть не тронута', async () => {
  const net = fakeNet();
  let r = await run(project(), ['demo', '--voice', VOICE], net, {});
  assert.equal(r.code, 1); assert.match(r.text, /Нет ключа ElevenLabs.*\.env/);
  r = await run(project(), ['demo'], net);
  assert.equal(r.code, 1); assert.match(r.text, /Не выбран голос.*--list/);
  r = await run(project({script: null}), ['demo', '--voice', VOICE], net);
  assert.equal(r.code, 1); assert.match(r.text, /Нет сценария/);
  r = await run(project({script: '# Название\n'}), ['demo', '--voice', VOICE], net);
  assert.equal(r.code, 1); assert.match(r.text, /нет раздела «Текст для суфлёра»/);
  r = await run(project({script: '## Текст для суфлёра\n\n```\n<Весь текст одним блоком, без пустых строк>\n```\n'}), ['demo', '--voice', VOICE], net);
  assert.equal(r.code, 1); assert.match(r.text, /текст ещё не написан/);
  assert.equal(net.calls.length, 0);
});

test('озвучка: запросы по фразам, ключ только в заголовке, voice.wav и words.json в формате расшифровки', async () => {
  const dir = project();
  const net = fakeNet({subscription: {tier: 'starter', character_count: 100, character_limit: 30000}});
  const r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 0, r.text);
  const tts = ttsCalls(net);
  assert.equal(tts.length, 3);
  for (const c of tts) {
    assert.ok(c.url.startsWith(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`));
    assert.equal(c.headers['xi-api-key'], KEY);
    assert.equal(c.json.model_id, 'eleven_v4'); assert.equal(c.json.language_code, 'ru'); assert.equal(c.json.apply_text_normalization, 'on');
  }
  assert.ok(!('previous_text' in tts[0].json)); assert.equal(tts[0].json.next_text, 'Она посчитает сама.');
  assert.equal(tts[1].json.previous_text, 'Напиши в таблице, что посчитать.'); assert.equal(tts[1].json.next_text, 'Это Claude, 20 долларов в месяц.');
  assert.ok(!('next_text' in tts[2].json));
  assert.match(r.text, /Тариф starter: израсходовано 100 из 30000/);
  // выходные файлы
  const wavFile = path.join(dir, 'public', 'work', 'demo', 'voice.wav');
  const words = JSON.parse(fs.readFileSync(path.join(dir, 'work', 'demo', 'words.json'), 'utf8'));
  assert.deepEqual(Object.keys(words[0]), ['text', 'start', 'end']);
  assert.deepEqual(words.map((w) => w.text).slice(0, 5), ['Напиши', 'в', 'таблице,', 'что', 'посчитать.']);
  assert.ok(words.some((w) => w.text === '20'), 'цифры остаются цифрами');
  assert.equal(words.length, 'Напиши в таблице, что посчитать. Она посчитает сама. Это Claude, 20 долларов в месяц.'.split(' ').length);
  for (let i = 0; i < words.length; i++) {
    assert.ok(Number.isInteger(Math.round(words[i].start * 100)) && words[i].end > words[i].start, 'слово с положительной длительностью');
    if (i) assert.ok(words[i].start >= words[i - 1].end, 'слова идут по порядку');
  }
  assert.equal(wavFile.endsWith('voice.wav'), true);
  const dur = wavSeconds(wavFile);
  assert.ok(dur > words[words.length - 1].end && dur < words[words.length - 1].end + 0.5, `длительность ${dur}`);
  assert.match(r.text, /VOICE = 'work\/demo\/voice\.wav'/);
  // ключ нигде, кроме заголовка
  assert.ok(!r.text.includes(KEY));
  for (const f of allFiles(dir)) assert.ok(!fs.readFileSync(f).includes(KEY), `ключ в файле ${f}`);
  assert.ok(net.calls.every((c) => !c.url.includes(KEY)));
});

test('кэш: повтор бесплатен, --redo берёт одну фразу, правка текста одной фразы озвучивает только её', async () => {
  const dir = project();
  const net = fakeNet();
  await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(ttsCalls(net).length, 3);
  let r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 0); assert.equal(ttsCalls(net).length, 3); assert.match(r.text, /Нужно озвучить 0 из 3/);
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check', '--redo', '2'], net);
  assert.equal(ttsCalls(net).length, 4); assert.equal(ttsCalls(net)[3].json.text, 'Она посчитает сама.');
  fs.writeFileSync(path.join(dir, 'work', 'demo', 'SCRIPT.md'), SCRIPT_MD.replace('20 долларов', '30 долларов'));
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(ttsCalls(net).length, 5); assert.equal(ttsCalls(net)[4].json.text, 'Это Claude, 30 долларов в месяц.');
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check', '--fresh'], net);
  assert.equal(ttsCalls(net).length, 8);
  r = await run(dir, ['demo', '--voice', VOICE, '--redo', '9'], net);
  assert.equal(r.code, 2);
});

test('модели нет на тарифе: переход на eleven_multilingual_v2 со всеми фразами и сообщение об этом', async () => {
  const dir = project();
  const net = fakeNet({noV4: true});
  const r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 0, r.text);
  const tts = ttsCalls(net);
  assert.deepEqual(tts.map((c) => c.json.model_id), ['eleven_v4', 'eleven_multilingual_v2', 'eleven_multilingual_v2', 'eleven_multilingual_v2']);
  assert.ok(tts.slice(1).every((c) => !('language_code' in c.json)), 'у запасной модели языка в запросе нет');
  assert.match(r.text, /Модель eleven_v4 недоступна.*Перехожу на eleven_multilingual_v2/);
  assert.match(r.text, /Модель eleven_multilingual_v2, голос/);
  assert.match(r.text, /запасной моделью/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'work', 'demo', 'words.json'), 'utf8')).length, 14);
});

test('голос из анкеты, язык из brief.json ролика', async () => {
  const dir = project({brief: `## Голос озвучки\n- ID голоса: ${VOICE}\n- Язык озвучки: ru\n`, briefJson: {language: 'en'}});
  const net = fakeNet();
  const r = await run(dir, ['demo', '--no-check'], net);
  assert.equal(r.code, 0, r.text);
  assert.ok(ttsCalls(net)[0].url.includes(`/text-to-speech/${VOICE}/`));
  assert.equal(ttsCalls(net)[0].json.language_code, 'en');
  const r2 = await run(project({brief: 'Язык озвучки: kk\nID голоса: ' + VOICE}), ['demo', '--no-check'], fakeNet());
  assert.match(r2.text, /язык kk/);
});

test('429 повторяется после паузы', async () => {
  const net = fakeNet({rateLimitFirst: true});
  const r = await run(project(), ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 0, r.text);
  assert.equal(ttsCalls(net).length, 4);
});

test('кредиты кончились на второй фразе: объяснение без ключа, первая фраза в кэше, повтор докончит', async () => {
  const dir = project();
  const net = fakeNet({quotaAt: 2});
  let r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 1);
  assert.match(r.text, /Кредиты ElevenLabs на этот период закончились/);
  assert.match(r.text, /Озвученные фразы сохранены/);
  assert.ok(!r.text.includes(KEY), 'ключ из ответа сервера стёрт');
  assert.ok(!fs.existsSync(path.join(dir, 'public', 'work', 'demo', 'voice.wav')));
  net.state.quotaAt = 0;
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 0, r.text);
  assert.equal(ttsCalls(net).length, 4, 'повтор озвучил только вторую и третью фразы');
});

test('чужой voice.wav (запись ученика) и правленный words.json не затираются без --force', async () => {
  const dir = project();
  const wav = path.join(dir, 'public', 'work', 'demo', 'voice.wav');
  fs.mkdirSync(path.dirname(wav), {recursive: true});
  fs.writeFileSync(wav, 'моя запись');
  const net = fakeNet();
  let r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 1);
  assert.match(r.text, /сделан не этим скриптом/);
  assert.match(r.text, /--force/);
  assert.equal(net.calls.length, 0, 'кредиты не потрачены');
  assert.equal(fs.readFileSync(wav, 'utf8'), 'моя запись');
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check', '--force'], net);
  assert.equal(r.code, 0, r.text);
  assert.equal(fs.readFileSync(wav).toString('ascii', 0, 4), 'RIFF');
  // свои прошлые файлы заменяются без вопросов, правка words.json вручную останавливает
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 0, r.text);
  const wordsFile = path.join(dir, 'work', 'demo', 'words.json');
  fs.writeFileSync(wordsFile, fs.readFileSync(wordsFile, 'utf8').replace('Напиши', 'Напишите'));
  r = await run(dir, ['demo', '--voice', VOICE, '--no-check'], net);
  assert.equal(r.code, 1);
  assert.match(r.text, /words\.json/);
});

test('проверка распознаванием: расхождения списком; нет права Speech to Text: пропуск без ошибки', async () => {
  const net = fakeNet({sttText: 'Напиши в таблице что посчитать. Она посчитает сама. Это клод двадцать долларов в месяц.'});
  let r = await run(project(), ['demo', '--voice', VOICE], net);
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /расхождений 2/);
  assert.match(r.text, /фраза 3 \(\d+,\d с\): в тексте «claude», услышано «клод»/);
  assert.match(r.text, /фраза 3 \(\d+,\d с\), число: в тексте «20», услышано «двадцать»/);
  const stt = net.calls.find((c) => c.url.endsWith('/v1/speech-to-text'));
  assert.deepEqual(stt.form, {model: 'scribe_v2', lang: 'ru', fileName: 'voice.wav'});
  assert.equal(stt.headers['xi-api-key'], KEY);
  r = await run(project(), ['demo', '--voice', VOICE], fakeNet());
  assert.equal(r.code, 0); assert.match(r.text, /расхождений с текстом нет/);
  r = await run(project(), ['demo', '--voice', VOICE], fakeNet({sttDenied: true}));
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /Проверка распознаванием пропущена: ключу не хватает права Speech to Text/);
});

test('список голосов и подсказка, если у ключа нет права читать голоса', async () => {
  const net = fakeNet();
  let r = await run(project(), ['--list', '--search', 'диктор', '--lang', 'ru'], net);
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, new RegExp(`${VOICE}  Диктор \\[premade\\]  female, russian, языки: ru`));
  assert.ok(r.text.includes('\n    образец: https://storage.example/preview.mp3'));
  const url = net.calls[0].url;
  assert.ok(url.startsWith('https://api.elevenlabs.io/v2/voices?') && url.includes('search=%D0%B4') && url.includes('language=ru') && url.includes('page_size=100'));
  r = await run(project(), ['--list'], fakeNet({voicesDenied: true}));
  assert.equal(r.code, 1);
  assert.match(r.text, /не хватает права читать голоса.*Voices: Read/s);
  assert.match(r.text, /Copy voice ID/);
  r = await run(project(), ['--list'], fakeNet(), {});
  assert.equal(r.code, 1); assert.match(r.text, /Нет ключа/);
});

test('настоящий ffmpeg раскодирует mp3 и склейка выдаёт wav нужной длины', {skip: !hasFfmpeg() && 'ffmpeg не найден'}, async () => {
  const mp3 = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', '-ac', '1', '-b:a', '128k', '-f', 'mp3', 'pipe:1'], {maxBuffer: 1 << 26}).stdout;
  assert.ok(mp3.length > 1000);
  const text = 'Привет мир.';
  const net = fakeNet();
  net.fetchImpl = async (url, init = {}) => {
    if (String(url).includes('/text-to-speech/')) return json({audio_base64: mp3.toString('base64'), alignment: align(text), normalized_alignment: align(text)});
    return json({}, 404);
  };
  const dir = project({script: `## Текст для суфлёра\n\n\`\`\`\n${text}\n\`\`\`\n`});
  const logs = [];
  const code = await main(['demo', '--voice', VOICE, '--no-check'], {env: {ELEVENLABS_API_KEY: KEY}, cwd: dir, fetchImpl: net.fetchImpl, log: (s) => logs.push(s), sleep: async () => {}});
  assert.equal(code, 0, logs.join('\n'));
  // речь с 0,2 до 0,75 с: резка от 0,13 до 1,03 с, то есть около 0,9 с
  const dur = wavSeconds(path.join(dir, 'public', 'work', 'demo', 'voice.wav'));
  assert.ok(Math.abs(dur - 0.9) < 0.1, `длительность ${dur}`);
});

// Покадровая съёмка живого веб-интерфейса (виртуальное время timesnap): плавные кадры даже там, где браузер в WSL
// рисует WebGL программно и медленно. Первое применение — ролик 29 «Джарвис» (26.09.2026), у проекта не было демо-видео.
//
//   node scripts/capture-ui.cjs <config.json>
//   { "url": "http://localhost:5180/", "width": 1440, "height": 1180, "fps": 30, "seconds": 10, "out": "frames/boot",
//     "prepare": "window.__jarvis.applyUi({accent: '#ff2e3e'})", "keys": ["Space"] }
//
// prepare — JS в странице до начала съёмки (таймеры внутри идут по виртуальному времени, их можно ставить на секунды
// речи); keys — клавиши, нажатые перед съёмкой. Потом: ffmpeg -framerate <fps> -i <out>/f-%05d.png -c:v libx264 -crf 14 -pix_fmt yuv420p clip.mp4
// timesnap ставится разово во временную папку: PUPPETEER_SKIP_DOWNLOAD=1 npm i timesnap --ignore-scripts, затем NODE_PATH=<папка>/node_modules.
// Чужой проект запускать только фронтендом, зависимости — npm ci --ignore-scripts, без доступа к аккаунтам.
const fs = require('fs');
const timesnap = require('timesnap');
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const CH = `${__dirname}/../node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell`;
fs.mkdirSync(c.out, {recursive: true});
timesnap({
  url: c.url, viewport: {width: c.width, height: c.height}, fps: c.fps, duration: c.seconds, outputDirectory: c.out, outputPattern: 'f-%05d.png',
  executablePath: CH, startDelay: c.startDelay ?? 2, quiet: true,
  launchArguments: ['--no-sandbox', '--use-angle=swiftshader-webgl', '--use-gl=angle', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  preparePage: async (page) => {
    if (c.prepare) await page.evaluate(c.prepare);
    for (const k of c.keys ?? []) await page.keyboard.press(k);
  },
}).then(() => console.log(`готово: ${c.out}`)).catch((e) => { console.error(e.message); process.exit(1); });

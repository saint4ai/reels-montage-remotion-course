# 1.1 Рабочее место и первый запуск

## Что нужно на компьютере

| Что | Зачем | Как поставить (делает агент, владелец только разрешает) |
|---|---|---|
| Claude Code (подписка Pro или Max) или Codex (подписка ChatGPT Plus, 20 $) | агент, который монтирует | приложение Claude для компьютера, вкладка Code (`docs/guides/claude-desktop.md`); или Codex в приложении ChatGPT (`docs/guides/codex.md`) |
| Node.js 20+ | Remotion и скрипты | см. «Порядок установки» ниже |
| ffmpeg и ffprobe | звук, проверка файлов, листы кадров | см. «Порядок установки» ниже |
| 8+ ГБ свободного места | модель расшифровки (~1,5 ГБ), рендеры | |
| Chrome для рендера | скачивается сам при первом кадре (~90 МБ) | |

Модель агента: самая сильная из доступных, высокое усилие рассуждения (если в программе есть такой переключатель). Монтаж это много мелких решений, слабая модель ошибается в геометрии. В Codex это GPT-6.1 Sol с усилием «Высокое» и правами «Подтверждать за меня» (`docs/guides/codex.md`, шаг 3); Astra на Plus хватает ненадолго, Luna для монтажа слабая.

## Порядок установки

Чего не хватает, показывает `npm run doctor`. Ставь сам по порядку, владельца о способе не спрашивай: macOS через Homebrew, Windows через winget. Нет Node: сначала пакетный менеджер, потом Node, потом `npm install`, потом `npm run doctor` ещё раз.

### macOS

1. Нет Homebrew: сам ввести пароль ты не можешь, поэтому открой владельцу приложение «Терминал» с готовой командой установки с brew.sh:
   `osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""'`
   Перед этим напиши владельцу текст про пароль из навыка, раздел 1, шаг 3. Владелец вводит пароль входа в Mac и нажимает Enter (установщик иногда просит нажать Enter ещё раз: «Press RETURN»). Жди, пока появится `/opt/homebrew/bin/brew` (Apple Silicon) или `/usr/local/bin/brew` (Intel), дальше вызывай brew по полному пути.
2. Ставь одной командой только то, чего нет: `brew install node ffmpeg python@3.13`. Git: `xcode-select --install`, владелец нажмёт «Установить» в открывшемся окне.
3. Запасной путь без Homebrew (владелец отказался или установка не удалась): Python через uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`, затем `uv python install 3.13`), ffmpeg и ffprobe готовыми сборками в `~/.local/bin` (evermeet.cx: сборки для Intel, на Apple Silicon они идут через Rosetta, macOS сама предложит её поставить).

### Windows

Ставь по одной команде, только недостающее: `winget install OpenJS.NodeJS.LTS`, `winget install Gyan.FFmpeg`, `winget install Python.Python.3.13`, `winget install Git.Git`. Нет winget (часть Windows 10): скачай установщики с nodejs.org, gyan.dev, python.org и git-scm.com и запусти их, владелец нажимает «Далее». После winget обнови PATH (см. «Первый запуск» ниже).

## Первый запуск (агент делает сам)

Windows: после `winget install` окно агента помнит старый PATH, и новая программа «не найдена». В той же команде обнови PATH: `$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')`, либо вызови программу по полному пути, либо попроси владельца перезапустить приложение. В PowerShell `npm` может ругаться на отключённые сценарии: вызывай `npm.cmd` и `npx.cmd`.

1. `npm install`. Конфликт зависимостей уже закрыт файлом `.npmrc` (`legacy-peer-deps`), не удаляй его.
2. `npm run doctor`. Всё OK, иначе чинить. WARN (Git Bash, ssh) монтажу не мешает: они нужны при установке ассистента на сервер.
3. `npm run studio`: откроется браузер со студией. Папки слева:
   - **Styles**: демо девяти стилей в двух форматах (Reels 9:16 и YouTube 16:9);
   - **Projects**: ролики пути А;
   - **Reels**: свои ролики пути Б, там уже есть `example-custom` из шаблона;
   - **Template**: сценарный холст;
   - **Kit**: демо блоков;
   - **QA**: `FitTest`.
4. Пробный лист кадров: `npm run frames -- example-custom`. Показать владельцу `reviews/example-custom-v001/sheet.jpg`.
5. Контроль проверки: `npm run qa -- FitTest` обязан закончиться `FIT FAIL`. Если прошёл, проверка переполнений сломана, чинить до работы.

## Что объяснить владельцу после запуска

- Студия нужна для просмотра, правки агент вносит в код.
- Лист кадров это главный инструмент согласования. Правки даются по номеру: «К004: заголовок мельче, лицо обрезано».
- Рендер идёт на процессоре. Ноутбук средней мощности: 720p около 15–25 минут на минуту ролика, 2K около 30–45, 4K до полутора часов.
  Нагрузку держим низкой (2 потока), компьютером можно пользоваться.

## Где что лежит у проекта

- `work/<slug>/`: бриф, карта монтажа, пакет на выкладку, отчёт. Это «папка ролика».
- `public/work/<slug>/`: записи (`speaker.mp4`, `voice.wav`), скриншоты, записи экрана. В git не уходят.
- `src/projects/<slug>.ts` (путь А) или `src/reels/<slug>/` (путь Б): код ролика.
- `reviews/<id>-vNNN/`: листы кадров по версиям. `out/`: рендеры.

## Запись владельца: как принять файл

- Телефонное видео (HEVC, 4K, 60 fps) перекодировать в H.264 **со звуком**: путь А берёт голос из `speaker.mp4`, без звука черновик выйдет немым.
  `ffmpeg -i IMG.MOV -vf "scale='min(1440,iw)':-2" -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 public/work/<slug>/speaker.mp4`.
  Запись меньше 1440×2560 (например 1080×1920) не растягивай: движок сам впишет её в рамку. Есть видеокарта NVIDIA: `-c:v h264_nvenc -preset p5 -b:v 14M` вместо libx264, в разы быстрее.
  Для финала 4K исходник в 2160×3840 (`scale=2160:3840`, crf 17), иначе 4K будет растянутым 2K.
- Голос отдельно, только для расшифровки слов: `ffmpeg -i IMG.MOV -vn -ac 2 -ar 48000 public/work/<slug>/voice.wav`.
- Узнать размер, fps и длительность: `ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of compact <файл>`.

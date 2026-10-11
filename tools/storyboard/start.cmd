@echo off
rem Доска раскадровки (Windows): двойной клик запускает сервер и открывает браузер. Остановить: закрыть это окно.
rem Файл лежит в tools\storyboard\ проекта, поэтому корень проекта на два уровня выше.
cd /d "%~dp0..\.."
rem браузер открывается через 2 секунды: к этому времени сервер уже слушает порт
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4321"
node tools\storyboard\server.mjs --port 4321
rem сервер вышел с ошибкой (например, порт занят): окно остаётся, чтобы была видна причина
if errorlevel 1 pause

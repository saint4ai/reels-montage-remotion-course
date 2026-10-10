/**
 * Приёмник заявок ассистента в Google Таблицу.
 *
 * Как поставить: docs/guides/google-sheets-leads.md. Коротко:
 *   1. В Google Таблице: Расширения > Apps Script, вставь этот файл целиком вместо старого кода.
 *   2. Слева Настройки проекта > Свойства скрипта > Добавить свойство: имя SECRET, значение это LEADS_WEBHOOK_SECRET из assistant/.env.
 *   3. Начать развертывание > Новое развертывание > тип «Веб-приложение»:
 *      выполнять от своего имени, доступ «Все» (адрес невозможно угадать, а секрет не пускает чужих).
 *   4. Адрес веб-приложения (заканчивается на /exec) сохрани в Загрузки\google-sheets-key.txt, агент положит его в .env как LEADS_WEBHOOK_URL.
 *
 * Что принимает: POST с JSON {time, channel, name, nick, need, contact, dialog, secret}.
 * Ассистент шлёт такой запрос рядом с сообщением в Telegram. Запрос {test: true, secret} только проверяет связь, строку не добавляет.
 */

var SHEET_NAME = 'Заявки';
var HEADERS = ['Время', 'Канал', 'Имя', 'Ник', 'Что нужно', 'Контакт', 'Диалог'];
var MAX_LEN = 500;

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    // Без секрета в свойствах скрипт ничего не пишет: лучше отказать, чем принять строки от кого угодно.
    if (!secret) return reply_({ok: false, error: 'в свойствах скрипта нет SECRET'});
    if (data.secret !== secret) return reply_({ok: false, error: 'секрет не совпал'});
    if (data.test) return reply_({ok: true, test: true});

    var lock = LockService.getScriptLock();
    lock.waitLock(10000); // две заявки подряд не должны писать в одну строку
    try {
      var sheet = sheet_();
      sheet.appendRow([
        formatTime_(data.time),
        safe_(data.channel),
        safe_(data.name),
        safe_(data.nick),
        safe_(data.need),
        safe_(data.contact),
        safe_(data.dialog)
      ]);
    } finally {
      lock.releaseLock();
    }
    return reply_({ok: true});
  } catch (err) {
    return reply_({ok: false, error: String(err).slice(0, 200)});
  }
}

// Открытие адреса в браузере: просто сообщение, что скрипт жив. Данных не отдаёт.
function doGet() {
  return reply_({ok: true, info: 'Приёмник заявок работает. Заявки сюда приходят POST-запросом.'});
}

function sheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

// Время приходит в UTC, в таблицу пишем в поясе самой таблицы (Файл > Настройки > Часовой пояс).
function formatTime_(value) {
  var moment = value ? new Date(value) : new Date();
  if (isNaN(moment.getTime())) moment = new Date();
  return Utilities.formatDate(moment, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd.MM.yyyy HH:mm');
}

// Текст человека попадает в ячейку. Строку, которая начинается с = + - @, таблица приняла бы за формулу: ставим апостроф, и это просто текст.
function safe_(value) {
  var text = value === null || value === undefined ? '' : String(value).slice(0, MAX_LEN);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function reply_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

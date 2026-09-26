# AAMIR-SFX — манифест звукового пака

Источник: AAMIR.VFX (пакет Александра 25.09.2026), конвертировано в wav 48k stereo

| Новое имя | Исходное имя | Длительность | Тип по звучанию | Заметки |
|---|---|---|---|---|
| aamir-chime.wav | Chime.mp3 | 1.33 с | ui / chime, fall — звон с затуханием | mp3 48k stereo; peak −11.8 dB; энергия в первых 30%, хвост тихий |
| aamir-click.wav | Click.wav | 0.96 с | ui / click, short-hit — резкий удар, быстрый спад | исходник wav 96k f32 stereo; peak 0.0 dB; спад −16→−53→−71 dB |
| aamir-confirm.wav | Confirm.mp3 | 3.50 с | ui / confirm, fall — мотив подтверждения с длинным хвостом | mp3 48k stereo; peak −7.3 dB; вся энергия в первых 30% |
| aamir-crispy-click.wav | Crispy Click.mp3 | 2.10 с | ui / click, short-hit + тишина в хвосте (звук только в начале) | mp3 48k stereo; peak −14.2 dB; середина и конец — цифровая тишина |
| aamir-glass.wav | Glass.mp3 | 2.74 с | ui / glass ting, fall — стеклянный звон, ring decay | mp3 48k stereo; peak −11.6 dB; плавный спад −26→−36→−75 dB |
| aamir-notification.wav | Notification.mp3 | 2.59 с | ui / notification, fall — мелодия уведомления с затуханием | mp3 48k stereo; peak −11.7 dB |
| aamir-select.wav | Select.mp3 | 0.62 с | ui / select, short-hit blip — тихая атака, пик в середине | mp3 48k stereo; peak −9.1 dB |
| aamir-ui-pop.wav | UI pop.mp3 | 0.46 с | ui / pop, short-hit — вся энергия в первых 30% | mp3 48k stereo; peak −0.5 dB; самый громкий короткий |

Тех. заметки: все файлы pcm_s16le, 48 кГц, stereo; моно-источников в паке не было; нормализация не применялась (пики −0.0…−14.2 dB, тише −30 dB peak нет) — громкость ставится в монтаже (×0.37). Огибающие сняты ffmpeg volumedetect по трём отрезкам (0–30% / середина / 70–100%).

Инцидент приёмки: в момент записи (25.09 14:57) базовые имена параллельно занимались посторонним процессом, aamir-chime.wav временно существовал как «.wav»; имена выверены атомарными mv -n, итоговый набор стабильен (проверено повторным листингом).
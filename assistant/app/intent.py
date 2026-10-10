"""«Лёгкий РОП»: что человеку нужно прямо сейчас.

Три намерения:
    material  пришёл за материалом по кодовому слову или не может его запустить;
    service   спрашивает про услуги, цену, запись;
    question  обычный вопрос.

Решает код по спискам слов из config/assistant.toml, без отдельного запроса к модели.
Намерение попадает в инструкцию: тому, кто пришёл за помощью, продажу не навязываем,
а услугу предлагаем мягко и один раз, только когда интерес есть."""

from __future__ import annotations

from app import clock

MATERIAL, SERVICE, QUESTION = "material", "service", "question"
# после выдачи материала короткие вопросы почти всегда про него
RECENT_MATERIAL_HOURS = 24


def had_recent_material(last_material_at: str | None) -> bool:
    moment = clock.parse(last_material_at)
    return bool(moment and (clock.now() - moment).total_seconds() < RECENT_MATERIAL_HOURS * 3600)


def detect(text: str, *, recent_material: bool, words: dict) -> str:
    low = (text or "").lower().replace("ё", "е") + " "
    service = [w.lower().replace("ё", "е") for w in words.get("service", [])]
    material = [w.lower().replace("ё", "е") for w in words.get("material", [])]
    if any(w in low for w in service):
        return SERVICE
    if any(w in low for w in material):
        return MATERIAL
    # «спасибо» и «а где ссылка» после выдачи материала это тоже разговор про материал
    if recent_material and len(low.split()) <= 8:
        return MATERIAL
    return QUESTION

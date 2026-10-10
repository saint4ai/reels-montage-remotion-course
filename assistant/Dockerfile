FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY config ./config
COPY prompts ./prompts
COPY knowledge ./knowledge

# Служба работает не от root. База лежит в /data (том Docker)
RUN useradd --create-home --uid 1000 assistant && mkdir -p /data && chown -R assistant /data
USER assistant

EXPOSE 8000
# Один процесс: фоновые циклы живут внутри него, а база SQLite рассчитана на одного писателя
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

# ── Stage 1: Build React UI ───────────────────────────────────────────────────
FROM node:20-slim AS web-builder

WORKDIR /web
COPY interfaces/web/package.json interfaces/web/package-lock.json* ./
RUN npm install --silent
COPY interfaces/web/ ./
RUN npm run build


# ── Stage 2: Python API server ────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Inject the built web UI from stage 1
COPY --from=web-builder /web/dist ./interfaces/web/dist

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]

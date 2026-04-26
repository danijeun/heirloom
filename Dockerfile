# --- Stage 1: build the React/Vite frontend ---
FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- Stage 2: Python runtime serving FastAPI + static dist ---
FROM python:3.11-slim AS runtime

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif1 libde265-0 libjpeg62-turbo zlib1g libwebp7 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server/ ./server/
COPY --from=web-builder /web/dist ./web/dist

# Keep the runtime unbuffered; Railway injects app env like PORT and DATABASE_URL.
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

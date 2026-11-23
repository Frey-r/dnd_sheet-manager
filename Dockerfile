# Multi-stage build: React SPA + Go server in one image (openspec/specs/lan-deployment.md §2).

FROM node:22-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS api
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY migrations/ ./migrations/
COPY pkg/ ./pkg/
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app && mkdir -p /data/uploads && chown -R app /data
WORKDIR /app
COPY --from=api /out/server ./server
COPY --from=web /src/frontend/dist ./frontend/dist
COPY config.yaml ./config.yaml
ENV FRONTEND_DIST=/app/frontend/dist \
    UPLOAD_DIR=/data/uploads \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8080
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD wget -qO- http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["./server"]

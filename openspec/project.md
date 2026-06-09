# Project Configuration & Architectural Rules

```yaml
schema: spec-driven
name: dnd-campaign-manager
description: |
  Gestor de campañas de Dungeons & Dragons.
  Tech stack: Backend en Go (Gin), Frontend en React, PostgreSQL (Docker) con pgvector,
  Redis para Pub/Sub, Ollama local (RAG).
  Despliegue: Local expuesto por Cloudflare Tunnel.
```

## Rules

### Spec Rules
- Usar palabras clave RFC 2119 (`SHALL`, `MUST`, `SHOULD`, `MAY`, `MUST NOT`).
- Incluir escenarios `GIVEN` / `WHEN` / `THEN` para la lógica de reglas de D&D.
- Architecture: Go maneja concurrencia de WebSockets, Redis distribuye mensajes y PostgreSQL guarda estado relacional y vectores.

### Compliance
- Toda especificación derivada hereda estas reglas.
- El incumplimiento de `MUST` / `SHALL` bloquea el merge.
- Los specs son la fuente de verdad para implementación y testing.

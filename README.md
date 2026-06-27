# ZONA·CERO

Battle royale 2D top-down para web móvil, con **servidor autoritativo**.
Monorepo (pnpm workspaces + Turborepo + TypeScript).

> Portado de la POC (`br-topdown-poc.html`, todo en cliente) a una arquitectura
> cliente-servidor autoritativa (Doc 2). La POC es la **especificación de las
> reglas**; aquí la lógica se ejecuta en el **servidor**, no en el navegador.

## Estado: Milestone 1 — movimiento autoritativo

Implementado:

- **`packages/shared`** — reglas puras compartidas (constantes en tiempo real,
  `protocol`, `rng`, `rules/movement`). Cliente y servidor importan el **mismo** código.
- **`apps/game-server`** — Colyseus + tick loop fijo **30 Hz**. Consume inputs
  buffered, integra movimiento, clampa al mundo, registra `lastSeq` por jugador.
  Salas por enlace (`filterBy(["name"])`) + bots de wander.
- **`apps/client`** — Vite + React (shell meta) + Canvas 2D vanilla. Joystick,
  **predicción + reconciliación** del propio, **interpolación** (~100 ms) de remotos.

Sin combate, zona dinámica, loot, economía ni login todavía (M2+).

## Arranque local

```bash
pnpm install

# Terminal 1 — game server (ws://localhost:2567)
pnpm dev:server

# Terminal 2 — cliente (http://localhost:5173)
pnpm dev:client
```

Abre `http://localhost:5173/?room=sala-1` en **dos pestañas**:

- Tu personaje se mueve **predicho** (instantáneo).
- El otro se mueve **interpolado** (suave).
- En el borde del mundo, el servidor **clampa** (se ve la reconciliación).
- Añade `?lag=100` para validar el control bajo ~100 ms de latencia simulada.

## Stack de plataforma (Firebase / Google Cloud) — M2+

| Capa | Servicio |
|------|----------|
| Hosting web | Firebase Hosting (build de Vite) |
| Auth | Firebase Auth (anónimo → Google/Apple/email) |
| Persistencia | Cloud Firestore |
| Economía/backend | Cloud Functions (callable, TS) |
| **Game server** | **Cloud Run** (contenedor Colyseus — NO Firebase) |

El game server NO va en Firebase: Functions/Firestore no sostienen un tick loop
de 30 Hz ni WebSockets persistentes. Ver `docs/architecture.md`.

## Workspace

```
packages/shared      @zonacero/shared   reglas puras (núcleo del portado)
apps/game-server     @zonacero/game-server   Colyseus autoritativo → Cloud Run
apps/client          @zonacero/client    Vite+React+Canvas → Firebase Hosting
```

# CLAUDE.md — Contexto del proyecto ZONA·CERO

> Este archivo lo lee Claude Code automáticamente al abrir el repo. Da el
> contexto necesario para continuar el trabajo sin re-explicarlo. Mantenerlo
> actualizado al cerrar cada milestone.

## Qué es

**ZONA·CERO** es un battle royale 2D top-down para **web móvil** (Nakama Studio).
Existe una **POC** (un único HTML, Canvas 2D, toda la lógica en cliente @~60fps)
que es la **especificación funcional de las reglas** (valores de armas, zona,
loot, economía, IA). El objetivo de producción es **portar esa lógica a un
servidor autoritativo** (anti-trampas), con arte placeholder hasta Fase 2.

Principio rector (Doc 2 de arquitectura): **cliente-servidor autoritativo**. El
cliente envía **intenciones** (input), nunca resultados (posición/daño). El
servidor valida y decide. La POC NO sirve como base de producción (sin
autoridad, sin sincronización, sin persistencia), pero SÍ como spec de reglas.

## Decisiones cerradas (no re-litigar)

- **Cliente**: Vite + React (pantallas meta) + **Canvas 2D vanilla TS** (partida).
- **Plataforma**: **Firebase / Google Cloud** para hosting, auth, DB, economía.
- **Excepción crítica**: el **game server autoritativo NO va en Firebase**. Va en
  **Cloud Run** (contenedor Colyseus). Functions/Firestore son serverless y no
  sostienen un tick loop de 30 Hz ni WebSockets persistentes.
- **Anti-patrón prohibido**: usar Firestore/Realtime DB como *netcode*. El netcode
  es **WebSocket ↔ Colyseus autoritativo**. Firebase solo cubre meta, persistencia,
  auth, economía y hosting.
- **Netcode**: tick fijo autoritativo + predicción de cliente + interpolación de
  entidades remotas. Proyectiles con viaje (no hitscan con lag-compensation aún).
- **Transporte**: WebSocket (TCP) para el MVP. WebRTC/WebTransport más adelante.

## Estructura del monorepo

pnpm workspaces + Turborepo + TypeScript. Raíz = monorepo.

```
packages/shared      @zonacero/shared       NÚCLEO DEL PORTADO — reglas puras
  src/constants.ts     constantes en TIEMPO REAL (px/s, dt, TICK_HZ=30)
  src/protocol.ts      InputCommand, Vec2, JoinOptions, nombres de mensaje
  src/rng.ts           SeededRng (mulberry32) determinista/auditable
  src/types.ts         tipos de dominio
  src/rules/movement.ts  integrateMovement (PURA: integración + clamp)
                       [M2: rules/combat.ts, zone.ts, loot.ts, economy.ts, ai.ts]

apps/game-server     @zonacero/game-server  Colyseus autoritativo → Cloud Run
  src/index.ts         bootstrap; define("match").filterBy(["name"])
  src/config.ts        PORT, tamaños de sala, nº de bots
  src/rooms/MatchRoom.ts            tick loop 30 Hz, buffer de inputs, spawn, lifecycle
  src/rooms/schema/MatchState.ts    @colyseus/schema: Player{ x,y,aim,lastSeq,isBot }
  src/sim/bots.ts      BotController (M1: solo wander) [M2: combate/loot]
  Dockerfile           build desde la raíz del monorepo

apps/client          @zonacero/client       Vite+React+Canvas → Firebase Hosting
  src/main.tsx         entry (sin StrictMode: evita doble WebSocket en dev)
  src/meta/App.tsx     shell React: Home con sala por enlace [M2: login/tienda/...]
  src/game/NetClient.ts        colyseus.js joinOrCreate("match",{name})
  src/game/InputController.ts  joystick virtual (pointer events)
  src/game/prediction.ts       Predictor: apply() + reconcile()
  src/game/interpolation.ts    InterpolationBuffer (~100 ms detrás)
  src/game/Renderer.ts         Canvas 2D: grid, borde, zona estática, entidades
  src/game/GameScreen.tsx      orquesta red+input+predicción/interpolación+render

functions/           Firebase Cloud Functions (TS) — economía + resultados [M2, aún no existe]
docs/architecture.md  resumen del Doc 2 aplicado al repo
```

## Cómo ejecutar / verificar

Requisitos: Node 20+, pnpm.

```bash
pnpm install
pnpm dev:server     # game server  -> ws://localhost:2567
pnpm dev:client     # cliente Vite  -> http://localhost:5173

pnpm -r typecheck   # typecheck de los 3 paquetes
pnpm --filter @zonacero/client build   # build de producción del cliente
```

**Prueba manual (acceptance M1):** abre `http://localhost:5173/?room=sala-1` en
**dos pestañas**. Cada una ve su jugador **predicho** (instantáneo) y al otro
**interpolado** (suave). En el borde del mundo, el servidor **clampa**
(reconciliación visible). `?lag=100` simula ~100 ms de latencia de subida.

## Reglas del portado (cómo convertir la POC)

1. **Frame-based → tiempo real**: la POC usa valores "por frame" @60fps. Regla de
   conversión: `valor_px/frame * 60 = px/seg`, y el desplazamiento por paso es
   `velocidad(px/s) * dt(s)`. Así es independiente del framerate y **determinista
   entre cliente y servidor** (imprescindible para reconciliar). Tick fijo 30 Hz.
2. **Reglas → funciones PURAS en `packages/shared`** (sin red, sin DOM, sin estado
   global). Cliente y servidor importan el MISMO código → coinciden. Ej: cliente
   y servidor usan `integrateMovement` idéntica para predicción/autoridad.
3. **Economía SIEMPRE en servidor** (Cloud Functions, txn Firestore atómica). El
   cliente NUNCA calcula monedas.
4. **RNG sembrado** por partida en el servidor (loot/posiciones auditables).
5. **Loadout** desde Firestore, **validado contra el inventario poseído** (anti-trampa).
6. Nº de jugadores **parametrizable** por sala (`targetPlayers`/`maxPlayers`).
7. Sin colisiones de mapa todavía.

## Estado actual y roadmap

### ✅ Milestone 1 — Movimiento autoritativo (HECHO)
Monorepo + `shared` (movimiento) + game server (tick 30 Hz, inputs buffered,
clamp, lastSeq, salas por enlace, bots de wander) + cliente (joystick, predicción
+ reconciliación, interpolación, renderer mínimo). Verificado end-to-end.
**M1 no incluye**: combate, zona dinámica, loot, economía ni login.

### ▶ Milestone 2 — Combate autoritativo + wiring de Firebase (SIGUIENTE)
- **shared**: `rules/combat.ts` (disparo/spread, `applyDamage` con escudo,
  cooldown/recarga `reloadTotal`), ampliar `protocol` (fire/swap/useItem, eventos
  de hit en snapshot), `constants` (WEAPONS — re-expresar `cd`/`reload`/`range`
  de frames a segundos, mantener `dmg`/`mag`/`spd`/`spread`/`pellets`).
- **game-server**: balas (viaje/colisión/daño) en el tick; cooldown/recarga;
  muerte/espectador/victoria; **join autenticado** (verificar ID token con
  Firebase Admin SDK) + cargar loadout validado; al terminar **reportar a Cloud
  Functions** (`submitMatchResult`).
- **client**: input de disparo + swap; render de balas; HUD (vida/escudo/munición);
  meta React con **Firebase Auth** (anónimo → vincular).
- **Firebase**: `firebase.json`/`.firebaserc`/`firestore.rules`/indexes;
  `functions/` (callable `buyItem` con txn atómica, `submitMatchResult`); deploy
  del game server a **Cloud Run**; Hosting del cliente.
- Empezar M2 con 1 arma (pistola) antes de añadir el resto.

### Milestone 3+ — zona dinámica, loot/cajas, economía completa, IA de combate, flota (GKE+Agones/Edgegap/Hathora), arte (Fase 2).

## Mapeo POC → producción (referencia rápida del HTML)

| Concepto POC (función/var)                   | Dónde va en producción |
|----------------------------------------------|------------------------|
| `WEAPONS`, `SKINS`, `ITEMS`                   | `shared/constants.ts` (cd/reload/range en seg) |
| `moveEnt` + escalado por `joy.mag`           | `shared/rules/movement.ts` ✅ |
| `shoot`/`startReload`/`tickReload`           | `shared/rules/combat.ts` + tick del server |
| `applyDamage` (escudo)                        | `shared/rules/combat.ts` |
| zona (`zone`, shrink, daño)                   | `shared/rules/zone.ts` + tick |
| `rollCrateReward`/`giveLoot`/cajas/supply    | `shared/rules/loot.ts` (RNG inyectado) + server |
| `botThink`/`botPerceive`/`BOT_VISION`        | `shared/rules/ai.ts` + `sim/bots.ts` |
| recompensa `showEnd` + monedas zona caliente | `shared/rules/economy.ts` (cálculo) + Cloud Functions (escritura) |
| `profile` (coins/inventory/loadout)          | Firestore + Firebase Auth |
| `draw`/`drawMinimap`                         | `client/game/Renderer.ts` |

> Fuentes de verdad incluidas en el repo (consúltalas antes de portar mecánicas):
> - `docs/reference/br-topdown-poc.html` — POC: spec de las REGLAS de juego.
> - `docs/reference/doc2-arquitectura-produccion.md` — Doc 2: ARQUITECTURA de producción.
> - `docs/reference/plan-fase1.md` — plan original de la Fase 1 (milestones).

## Convenciones

- Comentarios y nombres de dominio en **español** (coherente con el código actual).
- TypeScript estricto. Imports con extensión `.js` en código TS (NodeNext/Bundler ESM).
- Las **reglas de juego** viven en `packages/shared` como funciones puras y se
  comparten; NUNCA duplicar lógica de simulación entre cliente y servidor.
- El cliente jamás es autoritativo: no calcula daño, posición final ajena ni monedas.
- `@colyseus/schema` define el estado sincronizado; añadir campos ahí cuando deban
  viajar al cliente. Estado interno no sincronizado (p. ej. wander de bots) fuera del schema.
- Versionado Colyseus: línea **0.15.x** en server + `colyseus.js` **0.15.x** en
  cliente + `@colyseus/schema` **2.x** (deben ser compatibles entre sí).

## Git

- Rama de trabajo actual: `claude/code-session-setup-fxdq8w`. Repo: `aizetachan/battlechan`.
- Commitea por entregable con mensajes claros en español. No abrir PR salvo que el usuario lo pida.

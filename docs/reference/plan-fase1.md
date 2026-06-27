# Plan — ZONA·CERO · Fase 1 MVP (arquitectura de producción, stack Firebase)

## Contexto

ZONA·CERO es un battle royale 2D top-down para web móvil (Nakama Studio). Existe una **POC**
(`br-topdown-poc.html`, Canvas 2D, todo en cliente @~60fps) que es la **especificación funcional de
las reglas**, y un **Documento 2** que define la **arquitectura de producción**: cliente-servidor
**autoritativo** (Colyseus/TS), netcode con predicción + interpolación, salas por enlace con relleno
de bots, cuentas/economía y persistencia. El objetivo de la Fase 1 es **portar la lógica de la POC a
un servidor autoritativo**, con arte placeholder hasta Fase 2. No se escribe todo el código de golpe:
se valida por entregables.

### ⚠️ Bloqueo de sesión a resolver antes de implementar
- **Repo destino: `aizetachan/battlechan`** (decidido por el usuario).
- **Esta sesión está enganchada a `aizetachan/geonalyzer`**: el working dir, la rama
  `claude/zona-cero-production-arch-fvo8j8` y el acceso de GitHub apuntan ahí. `git ls-remote` a
  `battlechan` devuelve **403** y las tools de GitHub están scoped a `geonalyzer`.
- **Acción requerida**: lanzar una sesión de Claude Code apuntando a `aizetachan/battlechan`
  (y pasarle la POC, el Doc 2 y este plan). Este documento está escrito para ser ejecutable tal cual
  en esa sesión.

### Decisiones cerradas con el usuario
- **Cliente**: **Vite + React** (pantallas meta) + **Canvas 2D vanilla TS** (partida).
- **Stack de plataforma: Firebase / Google Cloud** (cuenta Google existente) para hosting, auth,
  DB, storage y economía. **Excepción**: el game server autoritativo NO va en Firebase (ver análisis).
- **Primer entregable**: **game server + movimiento autoritativo** (sin combate todavía).

### Ajustes asumidos en el portado
1. **Frame-based → tiempo real**: constantes de la POC (en frames @60fps) re-expresadas en px/seg y
   segundos; tick de simulación **fijo 30 Hz** con `dt`.
2. Nº de jugadores **parametrizable** por sala (`targetPlayers`/`maxPlayers`).
3. **Economía** calculada en servidor (recompensa de `showEnd` + monedas de zona caliente) y escrita
   en Firestore vía Cloud Functions; el cliente nunca calcula monedas.
4. **RNG sembrado** por partida en el servidor (loot/posiciones deterministas y auditables).
5. **Loadout** cargado de Firestore y **validado contra el inventario poseído** (anti-trampa).
6. **Sin colisiones de mapa** todavía.

---

## Análisis: encaje de Firebase / Google Cloud

| Capa | Servicio | Rol |
|------|----------|-----|
| Hosting web | **Firebase Hosting** | Sirve el build de Vite (cliente React+Canvas) + CDN |
| Login/identidad | **Firebase Auth** | Anónimo (invitado) → vincular Google/Apple/email. Cumple Doc 6.1 |
| Persistencia | **Cloud Firestore** | profiles, inventory, loadout, purchases, matches, match_players (sustituye a PostgreSQL) |
| Economía/lógica backend | **Cloud Functions (callable, TS)** | Compras de tienda con **transacción Firestore atómica**; ingestión de resultados de partida (sustituye al backend propio) |
| Assets | **Cloud Storage** | Sprites/skins (Fase 2 con Magnific) |
| Estado caliente | **Memorystore (Redis GCP)** | Solo si hace falta (Fase 2). En MVP: estado en memoria del game server |
| **Game server autoritativo** | **Cloud Run (contenedor Colyseus)** | Tick loop 30 Hz + WebSocket. **NO Firebase** |

**Por qué el game server NO va en Firebase.** Functions/Firestore son serverless y orientados a
peticiones cortas: no sostienen un **tick loop de 30 Hz** ni **WebSockets persistentes** de una
partida. Solución dentro del ecosistema Google: **Cloud Run** (soporta WebSocket, timeouts largos),
con un contenedor Colyseus. Para flota/autoescalado en Fase 2: GKE+Agones / Edgegap / Hathora (Doc 5.1).

**Anti-patrón a evitar.** No usar Firestore/Realtime Database como *netcode*: rompería la autoridad
del servidor y el anti-cheat (clientes escribiendo estado), y es lento/caro para 30 Hz. El netcode es
**WebSocket ↔ Colyseus autoritativo**; Firebase solo cubre meta, persistencia, auth, economía y hosting.

**Flujo de auth.** Cliente hace login con Firebase Auth → obtiene **ID token** → lo envía al unirse a
la sala Colyseus → el game server lo **verifica con Firebase Admin SDK** → carga el loadout desde
Firestore (validado). Reglas de Firestore: el cliente solo **lee** su perfil; coins/inventory solo los
escriben Functions/Admin (economía autoritativa, Doc 6.3/7).

---

## Estructura de repositorio (monorepo en la raíz de `battlechan`)

pnpm workspaces + Turborepo + TypeScript.

```
/ (raíz = monorepo ZONA·CERO)
  package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
  firebase.json  .firebaserc  firestore.rules  firestore.indexes.json
  apps/
    client/             # Vite+React+Canvas → deploy a Firebase Hosting
      src/
        meta/           # React: Login, Home, Lobby(room link), Shop, Character, Drop, End
        game/           # Canvas vanilla TS: Renderer, InputController, NetClient,
                        #   prediction, interpolation, GameScreen.tsx
        firebase/       # init de Firebase Auth/Firestore en cliente
    game-server/        # Colyseus+TS autoritativo → contenedor Cloud Run
      Dockerfile
      src/
        index.ts  config.ts            # TICK_HZ=30, tamaños de sala, snapshot rate
        rooms/MatchRoom.ts             # tick loop, join(verifica ID token), bot fill, lifecycle, reporte
        rooms/schema/MatchState.ts     # @colyseus/schema: players, bots, bullets, crates, zone...
        sim/step.ts  sim/bots.ts       # tick autoritativo + IA portada
        firebase/admin.ts              # Admin SDK: verificar token, escribir resultados
  functions/            # Firebase Cloud Functions (TS): economía + resultados de partida
    src/index.ts        # callable: buyItem (txn atómica), submitMatchResult
  packages/shared/      # @zonacero/shared — NÚCLEO DEL PORTADO (client + server lo importan)
    src/
      constants.ts      # WEAPONS, SKINS, ITEMS, WORLD, MAX_ITEMS, MAX_WEAPONS, radios, BOT_VISION, velocidades (tiempo real)
      types.ts  protocol.ts  rng.ts
      rules/ movement.ts combat.ts zone.ts loot.ts economy.ts ai.ts   # funciones puras
  docs/architecture.md
```

> Si en battlechan ya hay contenido, se integra el monorepo sin romperlo (o se mueve a `legacy/`),
> a confirmar al ver ese repo.

---

## Plan de portado (qué va dónde)

- **SHARED (`packages/shared`)** — reglas puras (sin red ni DOM): constantes re-expresadas en tiempo
  real; funciones puras extraídas del HTML: `applyDamage` (escudo), disparo/spread, duración de
  recarga (`reloadTotal`), shrink+daño de zona, `rollCrateReward` (RNG inyectado), `applyPassive`,
  fórmula de recompensa (`showEnd`), `d2`; `types`/`protocol`/`rng`.
- **SERVER (`apps/game-server`)** — fuente de verdad: tick loop 30 Hz consumiendo inputs buffered;
  movimiento+clamp, balas (viaje/colisión/daño), cooldown/recarga, zona, cajas (jugador+bot), supply,
  monedas de zona caliente, muerte/victoria; IA de bots + relleno; loadout validado; salas por enlace
  con join autenticado (Admin SDK); al terminar reporta a Cloud Functions; snapshots ~30 Hz vía schema.
- **CLIENT (`apps/client`)** — render+input+predicción/interpolación: input →
  `InputCommand{seq,move,fire,useItem,swap}`; predicción del jugador propio + reconciliación;
  interpolación de remotos (~100 ms); port de `draw`/`drawMinimap`; meta en React; economía vía
  Functions/Firestore (el cliente nunca calcula monedas).

---

## Primer entregable (Milestone 1) — Game server + movimiento autoritativo

Local, sin Firebase todavía (Hosting/Auth/Firestore/Functions entran en M2):

1. **Andamiaje del monorepo** (pnpm + turbo, tsconfig base, READMEs de arranque).
2. **`packages/shared`** (subconjunto de movimiento): `constants.ts` (WORLD, radios, velocidad base
   px/seg, `TICK_HZ`), `types.ts`, `protocol.ts` (`InputCommand` + `Snapshot`), `rng.ts`,
   `rules/movement.ts` (integración + clamp puros con `dt`).
3. **`apps/game-server`** (Colyseus): bootstrap + `MatchRoom` conectable por `roomId`/enlace; **tick
   loop fijo 30 Hz**; `MatchState` (players: id,x,y,aim,lastSeq); **movimiento autoritativo** (integra
   inputs, clampa al mundo, devuelve último `seq`); 1–2 **bots de wander** para probar interpolación;
   broadcast de snapshots ~30 Hz.
4. **`apps/client`** (Vite+React+Canvas): shell React + `GameScreen` con canvas; `NetClient`
   (colyseus.js) une sala por enlace; `InputController` (joystick); **predicción + reconciliación** del
   propio; **interpolación** de remotos; `Renderer` mínimo (grid, círculo de zona estático, entidades).

> Sin combate, zona dinámica, loot, economía ni login en M1.

---

## Verificación (Milestone 1)

1. `pnpm install`; `pnpm --filter game-server dev` y `pnpm --filter client dev`.
2. Abrir el **enlace de sala** en **dos pestañas**: ambos se ven moverse — el propio **predicho**
   (instantáneo), el otro **interpolado** (suave).
3. Mover al borde del mundo → el server **clampa** (se ve la corrección/reconciliación).
4. Con **~100 ms de latencia simulada**: control propio responsivo sin rubber-banding; bot de wander
   fluido.
5. Logs del server con posiciones autoritativas y `lastSeq` avanzando; tick 30 Hz estable con 2–3
   clientes + bots.

**Aceptación**: dos clientes reales conectados por enlace, movimiento con control de una mano,
servidor autoritativo sobre la posición, predicción+interpolación bajo latencia. Validado, se acuerda
el **Milestone 2** (combate autoritativo: proyectiles + daño con 1 arma) y el **wiring de Firebase**
(Hosting, Auth, Firestore, Functions, deploy del game server a Cloud Run).

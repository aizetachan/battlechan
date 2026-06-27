# Arquitectura — ZONA·CERO (producción)

Resumen ejecutable del Doc 2 aplicado a este repo. Cliente-servidor
**autoritativo**: el cliente envía intenciones, el servidor decide.

## Netcode (Doc 2 §3)

- **Tick fijo autoritativo** en el servidor (30 Hz). Cada tick: recoge inputs
  buffered, avanza la simulación, y `@colyseus/schema` emite snapshots (~30 Hz).
- **El cliente envía comandos de input** (`InputCommand{seq, move, dt}`), nunca
  posiciones ni daño.
- **Predicción + reconciliación**: el cliente aplica su input localmente ya, y al
  llegar el snapshot autoritativo descarta los inputs con `seq <= lastSeq` y
  reaplica los pendientes sobre la posición del servidor. Cliente y servidor usan
  la MISMA función pura (`@zonacero/shared/rules/movement`) → coinciden.
- **Interpolación** de remotos: se renderizan ~100 ms por detrás, interpolando
  entre los dos snapshots que rodean ese instante.
- **Transporte**: WebSocket (TCP) para el MVP. WebRTC/WebTransport en optimización.

## Por qué el game server NO va en Firebase

Cloud Functions / Firestore son serverless y orientados a peticiones cortas: no
sostienen un tick loop de 30 Hz ni WebSockets persistentes durante una partida.
Solución dentro de Google Cloud: **Cloud Run** (WebSocket, timeouts largos) con
un contenedor Colyseus. Flota/autoescalado en Fase 2: GKE+Agones / Edgegap / Hathora.

**Anti-patrón:** usar Firestore/Realtime DB como netcode rompería la autoridad
del servidor y el anti-cheat, y es lento/caro a 30 Hz.

## Flujo de auth (M2)

Cliente → login con Firebase Auth → **ID token** → lo envía al unirse a la sala
Colyseus → el game server lo **verifica con Firebase Admin SDK** → carga el
loadout desde Firestore (validado contra el inventario poseído). Reglas de
Firestore: el cliente solo **lee** su perfil; coins/inventory solo los escriben
Functions/Admin (economía autoritativa).

## Mapa del portado

| Capa | Paquete | Contenido |
|------|---------|-----------|
| Reglas puras | `packages/shared` | constantes (tiempo real), protocolo, RNG sembrado, movimiento. M2: combate, zona, loot, economía, IA. |
| Autoridad | `apps/game-server` | tick loop, `MatchState`, integración de inputs, bots. M2: balas/daño, zona, loot, join autenticado, reporte a Functions. |
| Presentación | `apps/client` | render+input, predicción/interpolación. M2: meta React (login/tienda), economía vía Functions. |

## Conversión de constantes (frame → tiempo real)

La POC corre a ~60 fps con valores "por frame". Aquí: `px/frame * 60 = px/seg`,
y el desplazamiento por paso es `velocidad(px/s) * dt(s)`. Así la simulación es
independiente del framerate y determinista entre cliente y servidor.

## Roadmap

- **M1 (hecho):** monorepo + movimiento autoritativo (predicción/interpolación).
- **M2:** combate autoritativo (proyectiles + daño, 1 arma) + wiring de Firebase
  (Hosting, Auth, Firestore, Functions) y deploy del game server a Cloud Run.
- **M3+:** zona dinámica, loot/cajas, economía completa, IA de combate, flota.

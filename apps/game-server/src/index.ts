// =====================================================================
// Bootstrap del game server autoritativo (Colyseus + WebSocket).
//
// Se despliega como contenedor en Cloud Run (NO Firebase) — ver plan §Análisis.
// Las salas "por enlace" se agrupan con filterBy(["name"]): dos clientes que
// usen el mismo `name` caen en la misma sala (joinOrCreate).
// =====================================================================

import { createServer } from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PORT } from "./config.js";
import { MatchRoom } from "./rooms/MatchRoom.js";

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: createServer(),
  }),
});

gameServer.define("match", MatchRoom).filterBy(["name"]);

gameServer
  .listen(PORT)
  .then(() => console.log(`⚡ ZONA·CERO game server escuchando en :${PORT}`))
  .catch((err) => {
    console.error("No se pudo arrancar el game server:", err);
    process.exit(1);
  });

// =====================================================================
// Estado sincronizado de la partida (@colyseus/schema).
//
// Colyseus serializa este árbol y envía deltas a los clientes ~SNAPSHOT_HZ.
// En M1 solo movimiento: posición, orientación (aim) y el último input
// procesado por jugador (lastSeq) para la reconciliación en cliente.
// =====================================================================

import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") aim = 0;
  /** Último InputCommand.seq aplicado por el servidor (server reconciliation). */
  @type("uint32") lastSeq = 0;
  @type("boolean") isBot = false;
}

export class MatchState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

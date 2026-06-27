// =====================================================================
// NetClient — conexión al game server Colyseus por enlace de sala.
//
// joinOrCreate("match", { name }) + filterBy(["name"]) en el servidor:
// dos clientes con el mismo `name` caen en la MISMA sala (sala por enlace).
// =====================================================================

import { Client, Room } from "colyseus.js";
import type { InputCommand, JoinOptions } from "@zonacero/shared";
import { MSG_INPUT } from "@zonacero/shared";

const SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? "ws://localhost:2567";

export class NetClient {
  private client: Client;
  room: Room | null = null;

  constructor() {
    this.client = new Client(SERVER_URL);
  }

  async join(opts: JoinOptions): Promise<Room> {
    this.room = await this.client.joinOrCreate("match", opts);
    return this.room;
  }

  sendInput(cmd: InputCommand) {
    this.room?.send(MSG_INPUT, cmd);
  }

  get sessionId(): string | undefined {
    return this.room?.sessionId;
  }

  leave() {
    this.room?.leave();
    this.room = null;
  }
}

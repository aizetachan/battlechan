// =====================================================================
// MatchRoom — sala de partida AUTORITATIVA.
//
// - Tick loop fijo a TICK_HZ: consume inputs buffered, integra movimiento,
//   clampa al mundo, registra el último seq procesado por jugador.
// - Salas "por enlace": agrupadas por `name` (filterBy en index.ts).
// - Bots de wander para validar interpolación en cliente.
//
// M1: solo movimiento. Sin combate, zona, loot, economía ni auth.
// (El join autenticado con Firebase Admin SDK y el reporte de resultados
//  a Cloud Functions entran en M2.)
// =====================================================================

import { Room, Client } from "@colyseus/core";
import {
  INPUT_DT,
  PLAYER_R,
  PLAYER_SPEED,
  SNAPSHOT_HZ,
  TICK_DT,
  TICK_HZ,
  WORLD,
  integrateMovement,
  type InputCommand,
} from "@zonacero/shared";
import { MSG_INPUT } from "@zonacero/shared";
import { SeededRng } from "@zonacero/shared";
import { M1_BOT_COUNT, MAX_PLAYERS } from "../config.js";
import { BotController } from "../sim/bots.js";
import { MatchState, Player } from "./schema/MatchState.js";

interface JoinOptions {
  name?: string;
  idToken?: string;
}

export class MatchRoom extends Room<MatchState> {
  maxClients = MAX_PLAYERS;

  private rng = new SeededRng(0x1234abcd);
  private bots!: BotController;
  /** Cola de inputs por sessionId, drenada cada tick. */
  private inputQueues = new Map<string, InputCommand[]>();
  private botIds: string[] = [];

  /**
   * Zona de aparición compartida (M1): jugadores y bots aparecen agrupados
   * para que se vean en pantalla y se aprecie predicción vs interpolación.
   * En M2 esto se sustituye por la pantalla de salto (drop) de la POC.
   */
  private readonly spawn = { x: WORLD.w * 0.5, y: WORLD.h * 0.7 };

  onCreate(options: JoinOptions) {
    this.setMetadata({ name: options.name ?? "default" });
    this.setState(new MatchState());

    // Semilla por partida (auditable). En M2 vendrá del matchmaker.
    this.rng = new SeededRng(this.deriveSeed(options.name ?? "default"));
    this.bots = new BotController(this.rng);

    this.onMessage(MSG_INPUT, (client, cmd: InputCommand) => {
      if (!this.sanitizeInput(cmd)) return;
      const q = this.inputQueues.get(client.sessionId);
      if (q) q.push(cmd);
    });

    // Snapshots ~SNAPSHOT_HZ.
    this.setPatchRate(1000 / SNAPSHOT_HZ);

    // Bots de wander (M1).
    for (let i = 0; i < M1_BOT_COUNT; i++) this.spawnBot();

    // Tick autoritativo fijo.
    this.setSimulationInterval((deltaMs) => this.tick(deltaMs / 1000), 1000 / TICK_HZ);

    console.log(
      `[MatchRoom ${this.roomId}] creada (name=${options.name ?? "default"}) · ` +
        `tick ${TICK_HZ}Hz · bots ${M1_BOT_COUNT}`,
    );
  }

  onJoin(client: Client, options: JoinOptions) {
    // M2: verificar idToken con Firebase Admin SDK y cargar loadout.
    const p = new Player();
    p.id = client.sessionId;
    p.isBot = false;
    // Aparición agrupada (M1) para que los jugadores compartan pantalla.
    p.x = this.spawn.x + this.rng.range(-220, 220);
    p.y = this.spawn.y + this.rng.range(-220, 220);
    p.aim = -Math.PI / 2;
    this.state.players.set(client.sessionId, p);
    this.inputQueues.set(client.sessionId, []);
    console.log(`[MatchRoom ${this.roomId}] +jugador ${client.sessionId}`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.inputQueues.delete(client.sessionId);
    console.log(`[MatchRoom ${this.roomId}] -jugador ${client.sessionId}`);
  }

  onDispose() {
    console.log(`[MatchRoom ${this.roomId}] dispuesta`);
  }

  // ------------------------------------------------------------------
  // Tick autoritativo
  // ------------------------------------------------------------------
  private tick(_dt: number) {
    // 1) Jugadores: drena y aplica inputs buffered de forma determinista.
    this.state.players.forEach((p) => {
      if (p.isBot) return;
      const q = this.inputQueues.get(p.id);
      if (!q || q.length === 0) return;

      for (const cmd of q) {
        const next = integrateMovement(
          p.x,
          p.y,
          cmd.move.x,
          cmd.move.y,
          PLAYER_SPEED,
          cmd.dt,
          PLAYER_R,
          WORLD.w,
          WORLD.h,
        );
        p.x = next.x;
        p.y = next.y;
        // Orientación: hacia el movimiento si lo hay.
        if (Math.hypot(cmd.move.x, cmd.move.y) > 0.01) {
          p.aim = Math.atan2(cmd.move.y, cmd.move.x);
        }
        p.lastSeq = cmd.seq;
      }
      q.length = 0;
    });

    // 2) Bots: wander a paso de tick fijo.
    for (const id of this.botIds) {
      const b = this.state.players.get(id);
      if (b) this.bots.step(b, TICK_DT);
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  private spawnBot() {
    const id = `bot_${this.botIds.length + 1}`;
    const b = new Player();
    b.id = id;
    b.isBot = true;
    // M1: bots cerca de la zona de aparición para que sean visibles.
    this.bots.spawn(b, { x: this.spawn.x, y: this.spawn.y, radius: 320 });
    this.state.players.set(id, b);
    this.botIds.push(id);
  }

  /** Valida el input para que un cliente no pueda inyectar valores absurdos. */
  private sanitizeInput(cmd: InputCommand): boolean {
    if (!cmd || typeof cmd.seq !== "number" || !cmd.move) return false;
    if (!Number.isFinite(cmd.move.x) || !Number.isFinite(cmd.move.y)) return false;
    // Clampa magnitud a [0,1] y dt a un rango razonable (anti-cheat básico).
    cmd.move.x = Math.max(-1, Math.min(1, cmd.move.x));
    cmd.move.y = Math.max(-1, Math.min(1, cmd.move.y));
    cmd.dt =
      Number.isFinite(cmd.dt) && cmd.dt > 0
        ? Math.min(cmd.dt, INPUT_DT * 3)
        : INPUT_DT;
    return true;
  }

  private deriveSeed(name: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}

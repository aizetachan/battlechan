// =====================================================================
// Predicción del jugador propio + reconciliación con el servidor.
//
// Doc 2 §3.3: el cliente aplica su input localmente de inmediato (predicción)
// y, al llegar el snapshot autoritativo, corrige reaplicando los inputs aún
// no confirmados (server reconciliation). Usa EXACTAMENTE la misma función
// pura de movimiento que el servidor (@zonacero/shared) para que coincidan.
// =====================================================================

import {
  PLAYER_R,
  PLAYER_SPEED,
  WORLD,
  integrateMovement,
  type InputCommand,
} from "@zonacero/shared";

export class Predictor {
  /** Posición predicha del jugador propio. */
  x = 0;
  y = 0;
  aim = -Math.PI / 2;

  /** Inputs enviados aún no confirmados por el servidor. */
  private pending: InputCommand[] = [];

  /** Inicializa con la posición autoritativa inicial. */
  reset(x: number, y: number, aim: number) {
    this.x = x;
    this.y = y;
    this.aim = aim;
    this.pending = [];
  }

  /** Aplica un input recién muestreado: predice localmente y lo memoriza. */
  apply(cmd: InputCommand) {
    this.pending.push(cmd);
    const next = integrateMovement(
      this.x,
      this.y,
      cmd.move.x,
      cmd.move.y,
      PLAYER_SPEED,
      cmd.dt,
      PLAYER_R,
      WORLD.w,
      WORLD.h,
    );
    this.x = next.x;
    this.y = next.y;
    if (Math.hypot(cmd.move.x, cmd.move.y) > 0.01) {
      this.aim = Math.atan2(cmd.move.y, cmd.move.x);
    }
  }

  /**
   * Reconcilia con la posición autoritativa: descarta los inputs ya aplicados
   * por el servidor (seq <= lastSeq) y reaplica los pendientes sobre ella.
   */
  reconcile(authX: number, authY: number, lastSeq: number) {
    this.pending = this.pending.filter((c) => c.seq > lastSeq);

    let x = authX;
    let y = authY;
    let aim = this.aim;
    for (const cmd of this.pending) {
      const next = integrateMovement(
        x,
        y,
        cmd.move.x,
        cmd.move.y,
        PLAYER_SPEED,
        cmd.dt,
        PLAYER_R,
        WORLD.w,
        WORLD.h,
      );
      x = next.x;
      y = next.y;
      if (Math.hypot(cmd.move.x, cmd.move.y) > 0.01) {
        aim = Math.atan2(cmd.move.y, cmd.move.x);
      }
    }
    this.x = x;
    this.y = y;
    this.aim = aim;
  }
}

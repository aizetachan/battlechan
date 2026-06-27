// =====================================================================
// IA de bots — versión M1: solo WANDER (deambular) para probar interpolación.
//
// Portado reducido de la POC: heading que deriva suavemente (`roamA`) y se
// aleja de los bordes del mundo. La IA de combate/perseguir loot llega en M2+.
// Estado interno fuera del schema (no necesita sincronizarse).
// =====================================================================

import {
  BOT_R,
  BOT_SPEED,
  SeededRng,
  WORLD,
  integrateMovement,
} from "@zonacero/shared";
import type { Player } from "../rooms/schema/MatchState.js";

interface WanderState {
  roamA: number;
  /** Segundos restantes antes de re-elegir heading. */
  timer: number;
}

export class BotController {
  private wander = new Map<string, WanderState>();

  constructor(private rng: SeededRng) {}

  spawn(player: Player): void {
    player.x = this.rng.range(150, WORLD.w - 150);
    player.y = this.rng.range(150, WORLD.h - 150);
    player.aim = this.rng.range(0, Math.PI * 2);
    this.wander.set(player.id, {
      roamA: this.rng.range(0, Math.PI * 2),
      timer: this.rng.range(1.2, 2.7),
    });
  }

  remove(id: string): void {
    this.wander.delete(id);
  }

  /** Avanza un bot un paso de simulación (dt en segundos). */
  step(player: Player, dt: number): void {
    let w = this.wander.get(player.id);
    if (!w) {
      w = { roamA: this.rng.range(0, Math.PI * 2), timer: 1.5 };
      this.wander.set(player.id, w);
    }

    w.timer -= dt;
    if (w.timer <= 0) {
      // POC: re-elige cada ~70..160 frames -> ~1.2..2.7 s, gira aleatoriamente.
      w.timer = this.rng.range(1.2, 2.7);
      w.roamA += this.rng.range(-0.9, 0.9);
    }

    let hx = Math.cos(w.roamA);
    let hy = Math.sin(w.roamA);

    // Aleja de los bordes (POC: margin 240).
    const margin = 240;
    if (player.x < margin) hx += 0.8;
    if (player.x > WORLD.w - margin) hx -= 0.8;
    if (player.y < margin) hy += 0.8;
    if (player.y > WORLD.h - margin) hy -= 0.8;

    const hm = Math.hypot(hx, hy) || 1;
    // POC deambula al 70% de la velocidad.
    const moveX = (hx / hm) * 0.7;
    const moveY = (hy / hm) * 0.7;

    const next = integrateMovement(
      player.x,
      player.y,
      moveX,
      moveY,
      BOT_SPEED,
      dt,
      BOT_R,
      WORLD.w,
      WORLD.h,
    );
    player.x = next.x;
    player.y = next.y;
    player.aim = Math.atan2(moveY, moveX);
  }
}

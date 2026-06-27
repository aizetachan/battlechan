// =====================================================================
// Renderer mínimo (M1) — Canvas 2D vanilla.
//
// Port reducido del `draw` de la POC: rejilla, borde del mundo, círculo de
// zona ESTÁTICO (la zona dinámica llega en M2), y entidades (propio predicho,
// remotos interpolados) con línea de orientación. Arte placeholder.
// =====================================================================

import { PLAYER_R, WORLD } from "@zonacero/shared";
import type { InterpView } from "./interpolation.js";

export interface Camera {
  x: number;
  y: number;
}

export interface View {
  w: number;
  h: number;
}

// Zona estática de muestra (centro del mundo).
const ZONE = { cx: WORLD.w / 2, cy: WORLD.h / 2, r: 1600 };

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private view: View,
  ) {}

  setView(w: number, h: number) {
    this.view = { w, h };
  }

  draw(
    cam: Camera,
    self: { x: number; y: number; aim: number },
    remotes: InterpView[],
  ) {
    const { ctx } = this;
    const { w: VW, h: VH } = this.view;

    // Fondo.
    ctx.clearRect(0, 0, VW, VH);
    ctx.fillStyle = "#0e131c";
    ctx.fillRect(0, 0, VW, VH);

    // Rejilla (POC: 80px).
    ctx.strokeStyle = "rgba(255,255,255,.045)";
    ctx.lineWidth = 1;
    const g = 80;
    const sx = -(cam.x % g);
    const sy = -(cam.y % g);
    ctx.beginPath();
    for (let x = sx; x < VW; x += g) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VH);
    }
    for (let y = sy; y < VH; y += g) {
      ctx.moveTo(0, y);
      ctx.lineTo(VW, y);
    }
    ctx.stroke();

    // Borde del mundo.
    ctx.strokeStyle = "rgba(126,231,135,.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(-cam.x, -cam.y, WORLD.w, WORLD.h);

    // Zona estática (referencia visual M1).
    const zx = ZONE.cx - cam.x;
    const zy = ZONE.cy - cam.y;
    ctx.beginPath();
    ctx.arc(zx, zy, ZONE.r, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff6b8a";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Remotos (interpolados).
    for (const e of remotes) {
      this.drawEntity(e.x - cam.x, e.y - cam.y, e.aim, e.isBot ? "#9fb3c8" : "#7ee787", false);
    }

    // Propio (predicho) — siempre encima, en verde brillante.
    this.drawEntity(self.x - cam.x, self.y - cam.y, self.aim, "#7ee787", true);
  }

  private drawEntity(x: number, y: number, aim: number, color: string, isSelf: boolean) {
    const { ctx } = this;
    const r = PLAYER_R;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelf ? "#dfffe6" : "rgba(0,0,0,.35)";
    ctx.stroke();
    // Línea de orientación.
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(aim) * (r + 11), y + Math.sin(aim) * (r + 11));
    ctx.strokeStyle = isSelf ? "#dfffe6" : "rgba(255,255,255,.85)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

/** Cámara que sigue al objetivo y se clampa al mundo (como la POC). */
export function clampCamera(cam: Camera, view: View) {
  cam.x = Math.max(0, Math.min(Math.max(0, WORLD.w - view.w), cam.x));
  cam.y = Math.max(0, Math.min(Math.max(0, WORLD.h - view.h), cam.y));
}

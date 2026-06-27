// =====================================================================
// Interpolación de entidades remotas (Doc 2 §3.4).
//
// Los demás jugadores/bots se renderizan ~INTERP_DELAY_MS por detrás del
// "ahora", interpolando entre los dos snapshots que rodean ese instante.
// Resultado: movimiento suave aunque la red llegue a saltos.
// =====================================================================

import { INTERP_DELAY_MS } from "@zonacero/shared";

interface Sample {
  t: number; // tiempo local de recepción (ms)
  x: number;
  y: number;
  aim: number;
}

export interface InterpView {
  x: number;
  y: number;
  aim: number;
  isBot: boolean;
}

export class InterpolationBuffer {
  private buffers = new Map<string, Sample[]>();
  private isBot = new Map<string, boolean>();
  private seen = new Set<string>();

  /** Registra una muestra de una entidad remota recibida del servidor. */
  addSample(id: string, isBot: boolean, x: number, y: number, aim: number, now: number) {
    let buf = this.buffers.get(id);
    if (!buf) {
      buf = [];
      this.buffers.set(id, buf);
    }
    // Evita muestras duplicadas exactas (sin cambio de posición/orientación).
    const last = buf[buf.length - 1];
    if (last && last.x === x && last.y === y && last.aim === aim) return;

    buf.push({ t: now, x, y, aim });
    this.isBot.set(id, isBot);
    // Conserva un pequeño histórico.
    if (buf.length > 60) buf.shift();
  }

  /** Marca el conjunto de ids vivos este frame para poder limpiar los que se van. */
  beginFrame() {
    this.seen.clear();
  }
  mark(id: string) {
    this.seen.add(id);
  }
  endFrame() {
    for (const id of this.buffers.keys()) {
      if (!this.seen.has(id)) {
        this.buffers.delete(id);
        this.isBot.delete(id);
      }
    }
  }

  /** Devuelve la pose interpolada de cada entidad en `now`. */
  view(now: number): Array<InterpView & { id: string }> {
    const renderTime = now - INTERP_DELAY_MS;
    const out: Array<InterpView & { id: string }> = [];

    for (const [id, buf] of this.buffers) {
      if (buf.length === 0) continue;
      const isBot = this.isBot.get(id) ?? false;

      // Antes del primer sample disponible -> usa el más antiguo.
      if (renderTime <= buf[0].t) {
        out.push({ id, x: buf[0].x, y: buf[0].y, aim: buf[0].aim, isBot });
        continue;
      }
      // Después del último -> usa el más reciente (extrapolación nula).
      const lastS = buf[buf.length - 1];
      if (renderTime >= lastS.t) {
        out.push({ id, x: lastS.x, y: lastS.y, aim: lastS.aim, isBot });
        continue;
      }
      // Encuentra el par [a, b] que rodea renderTime e interpola.
      for (let i = 0; i < buf.length - 1; i++) {
        const a = buf[i];
        const b = buf[i + 1];
        if (renderTime >= a.t && renderTime <= b.t) {
          const span = b.t - a.t || 1;
          const f = (renderTime - a.t) / span;
          out.push({
            id,
            x: a.x + (b.x - a.x) * f,
            y: a.y + (b.y - a.y) * f,
            aim: lerpAngle(a.aim, b.aim, f),
            isBot,
          });
          break;
        }
      }
    }
    return out;
  }
}

/** Interpola ángulos por el camino corto. */
function lerpAngle(a: number, b: number, f: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

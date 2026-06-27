// =====================================================================
// Reglas de movimiento — funciones PURAS (sin red, sin estado global).
//
// Portadas de la POC (`moveEnt` + el escalado de velocidad por joystick).
// El servidor las usa como fuente de verdad; el cliente las usa idénticas
// para predicción + reconciliación. Mismo código => misma posición.
// =====================================================================

import { MIN_MOVE_MAG } from "../constants.js";

export interface Position {
  x: number;
  y: number;
}

/**
 * Integra un paso de movimiento y clampa al mundo.
 *
 * POC equivalente:
 *   sp = base * (mag>0 ? max(mag,0.35) : 0)
 *   e.x += (mvx/m)*sp ; clamp a [r, WORLD-r]
 * pero expresado en tiempo real: desplazamiento = velocidad(px/s) * dt(s).
 *
 * @param moveX  componente X de dirección*magnitud, en [-1, 1]
 * @param moveY  componente Y de dirección*magnitud, en [-1, 1]
 * @param speed  velocidad máxima en px/seg
 * @param dt     paso temporal en segundos
 */
export function integrateMovement(
  x: number,
  y: number,
  moveX: number,
  moveY: number,
  speed: number,
  dt: number,
  radius: number,
  worldW: number,
  worldH: number,
): Position {
  let nx = x;
  let ny = y;

  const mag = Math.hypot(moveX, moveY);
  if (mag > 0.01) {
    // La velocidad efectiva nunca baja de MIN_MOVE_MAG mientras hay input,
    // y se satura en la magnitud máxima (1).
    const eff = speed * Math.min(Math.max(mag, MIN_MOVE_MAG), 1);
    nx = x + (moveX / mag) * eff * dt;
    ny = y + (moveY / mag) * eff * dt;
  }

  // Clamp autoritativo al interior del mundo (sin colisiones de mapa en M1).
  nx = Math.max(radius, Math.min(worldW - radius, nx));
  ny = Math.max(radius, Math.min(worldH - radius, ny));

  return { x: nx, y: ny };
}

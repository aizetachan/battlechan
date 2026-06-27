// =====================================================================
// RNG sembrado y determinista (mulberry32).
//
// La POC usa Math.random() (no auditable). En producción el servidor siembra
// el RNG por partida para que loot/posiciones sean deterministas y auditables
// (plan §4). Aquí solo el núcleo; loot/posiciones llegan en M2+.
// =====================================================================

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    // Asegura un entero de 32 bits distinto de 0.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Siguiente flotante en [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flotante en [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entero en [min, max). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }
}

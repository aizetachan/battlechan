// =====================================================================
// Tipos compartidos de dominio (sin red ni DOM).
// =====================================================================

export type EntityKind = "player" | "bot";

/** Vista mínima de una entidad para render/interpolación en cliente. */
export interface EntitySnapshot {
  id: string;
  x: number;
  y: number;
  aim: number;
  isBot: boolean;
}

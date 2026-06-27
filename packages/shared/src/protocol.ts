// =====================================================================
// Protocolo cliente <-> servidor.
//
// Principio (Doc 2 §3.2): el cliente envía INTENCIONES (comandos de input),
// nunca resultados (posiciones/daño). El servidor valida y aplica.
// =====================================================================

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Comando de input que el cliente envía cada input-tick.
 * `move` es dirección * magnitud, con componentes en [-1, 1].
 * `dt` es el tiempo (s) que representa este comando — el servidor lo usa
 * para integrar de forma determinista y el cliente lo re-aplica al reconciliar.
 */
export interface InputCommand {
  seq: number;
  move: Vec2;
  dt: number;
  fire?: boolean;
  useItem?: boolean;
  swap?: boolean;
}

/** Mensajes (canales) de Colyseus. */
export const MSG_INPUT = "input";

/** Opciones que el cliente pasa al unirse a una sala. */
export interface JoinOptions {
  /** Identificador de sala por enlace (room link). */
  name: string;
  /** Token de Firebase Auth (M2+). En M1 es opcional. */
  idToken?: string;
}

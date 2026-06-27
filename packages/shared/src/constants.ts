// =====================================================================
// Constantes del juego — re-expresadas en TIEMPO REAL (px/seg, segundos).
//
// La POC corre su lógica a ~60 fps usando valores "por frame". Aquí esos
// valores se convierten a magnitudes independientes del framerate para que
// el servidor autoritativo (tick fijo) y el cliente (predicción) coincidan.
//
// Conversión usada: <valor px/frame> * 60 = px/seg.
// =====================================================================

/** Frecuencia del tick de simulación autoritativo en el servidor. */
export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;

/** Frecuencia a la que el servidor emite snapshots (patch rate de Colyseus). */
export const SNAPSHOT_HZ = 30;

/** Frecuencia a la que el cliente muestrea input y lo envía al servidor. */
export const INPUT_HZ = 30;
export const INPUT_DT = 1 / INPUT_HZ;

/** Buffer de interpolación de entidades remotas (ms detrás del "ahora"). */
export const INTERP_DELAY_MS = 100;

/** Dimensiones del mundo (idénticas a la POC). */
export const WORLD = { w: 4200, h: 6300 } as const;

/** Radios de entidad (idénticos a la POC). */
export const PLAYER_R = 16;
export const BOT_R = 16;

// --- Velocidades (POC: px/frame @60fps -> px/seg) ---
/** Jugador: POC `base = 3.4` px/frame. */
export const PLAYER_SPEED = 3.4 * 60; // 204 px/s
/** Bot: POC `moveEnt(b,...,2.5)`. */
export const BOT_SPEED = 2.5 * 60; // 150 px/s

/**
 * Magnitud mínima de movimiento. En la POC, mientras el joystick está activo,
 * la velocidad nunca baja de 0.35 del máximo (`Math.max(joy.mag,0.35)`).
 */
export const MIN_MOVE_MAG = 0.35;

/** Nº de jugadores parametrizable por sala (Doc 2: 10–30 reales). */
export const DEFAULT_TARGET_PLAYERS = 10;
export const DEFAULT_MAX_PLAYERS = 30;

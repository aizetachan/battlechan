// Configuración del game server. Las constantes de simulación viven en
// @zonacero/shared para que cliente y servidor compartan exactamente los
// mismos valores.

import { DEFAULT_MAX_PLAYERS, DEFAULT_TARGET_PLAYERS } from "@zonacero/shared";

export const PORT = Number(process.env.PORT ?? 2567);

/** Tamaño de sala (parametrizable por sala vía opciones de join en el futuro). */
export const TARGET_PLAYERS = Number(
  process.env.TARGET_PLAYERS ?? DEFAULT_TARGET_PLAYERS,
);
export const MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? DEFAULT_MAX_PLAYERS);

/** Nº de bots de wander para probar interpolación en M1. */
export const M1_BOT_COUNT = Number(process.env.BOT_COUNT ?? 2);

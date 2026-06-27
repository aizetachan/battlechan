// =====================================================================
// App — shell de pantallas meta (React).
//
// M1: Home mínima con "sala por enlace". Pega/comparte ?room=<id> en la URL
// y dos pestañas caen en la misma partida. Login/Tienda/Personaje (Firebase)
// llegan en M2+.
// =====================================================================

import { useState } from "react";
import { GameScreen } from "../game/GameScreen.js";

function readRoomFromUrl(): string {
  const p = new URLSearchParams(window.location.search);
  return p.get("room") ?? "";
}
function readLagFromUrl(): number {
  const p = new URLSearchParams(window.location.search);
  return Number(p.get("lag") ?? 0) || 0;
}

export function App() {
  const [room, setRoom] = useState<string>(readRoomFromUrl());
  const [playing, setPlaying] = useState(false);
  const lag = readLagFromUrl();

  if (playing && room) {
    return (
      <GameScreen
        roomName={room}
        fakeLagMs={lag}
        onExit={() => setPlaying(false)}
      />
    );
  }

  const join = () => {
    const name = room.trim() || "sala-1";
    setRoom(name);
    const url = new URL(window.location.href);
    url.searchParams.set("room", name);
    window.history.replaceState({}, "", url);
    setPlaying(true);
  };

  return (
    <div className="home">
      <h1 className="logo">
        ZONA<span>·CERO</span>
      </h1>
      <p className="tagline">
        Battle royale · servidor autoritativo · Milestone 1 (movimiento)
      </p>

      <label className="field">
        <span>Sala (enlace)</span>
        <input
          value={room}
          placeholder="sala-1"
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
      </label>

      <button className="btn-primary" onClick={join}>
        JUGAR
      </button>

      <p className="help">
        Abre esta misma URL (con <code>?room=</code>) en dos pestañas para
        verte moverte: el propio <b>predicho</b>, el otro <b>interpolado</b>.
        Añade <code>?lag=100</code> para simular latencia.
      </p>
    </div>
  );
}

// =====================================================================
// GameScreen — orquesta red + input + predicción/interpolación + render.
//
// Loop de input a INPUT_HZ (muestrea joystick, predice, envía).
// Loop de render a rAF (reconcilia el propio, interpola remotos, dibuja).
// =====================================================================

import { useEffect, useRef } from "react";
import {
  INPUT_DT,
  INPUT_HZ,
  WORLD,
  type InputCommand,
} from "@zonacero/shared";
import { NetClient } from "./NetClient.js";
import { InputController } from "./InputController.js";
import { Predictor } from "./prediction.js";
import { InterpolationBuffer } from "./interpolation.js";
import { Renderer, clampCamera, type Camera } from "./Renderer.js";

interface Props {
  roomName: string;
  /** Latencia simulada de subida (ms) para validar predicción bajo lag. */
  fakeLagMs?: number;
  onExit: () => void;
}

export function GameScreen({ roomName, fakeLagMs = 0, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joyRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const input = new InputController(joyRef.current!, knobRef.current!);
    const predictor = new Predictor();
    const interp = new InterpolationBuffer();
    const net = new NetClient();

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const view = { w: 360, h: 640 };
    const renderer = new Renderer(ctx, view);
    const cam: Camera = { x: 0, y: 0 };

    let seq = 0;
    let initialized = false;
    let disposed = false;
    let inputTimer: number | undefined;
    let raf = 0;

    function resize() {
      const r = canvas.getBoundingClientRect();
      view.w = Math.max(1, r.width);
      view.h = Math.max(1, r.height);
      canvas.width = Math.round(view.w * DPR);
      canvas.height = Math.round(view.h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      renderer.setView(view.w, view.h);
    }
    window.addEventListener("resize", resize);
    resize();

    function setStatus(s: string) {
      if (statusRef.current) statusRef.current.textContent = s;
    }

    // --- conexión ---
    setStatus(`Conectando a sala "${roomName}"…`);
    net
      .join({ name: roomName })
      .then(() => {
        setStatus(`En sala "${roomName}" · ${net.sessionId}`);
        startInputLoop();
      })
      .catch((err) => {
        console.error(err);
        setStatus(`Error de conexión: ${err?.message ?? err}`);
      });

    // --- loop de input (INPUT_HZ) ---
    function startInputLoop() {
      inputTimer = window.setInterval(() => {
        if (disposed || !net.room) return;
        seq++;
        const cmd: InputCommand = {
          seq,
          move: { x: input.move.x, y: input.move.y },
          dt: INPUT_DT,
        };
        predictor.apply(cmd);
        if (fakeLagMs > 0) {
          window.setTimeout(() => net.sendInput(cmd), fakeLagMs);
        } else {
          net.sendInput(cmd);
        }
      }, 1000 / INPUT_HZ);
    }

    // --- loop de render (rAF) ---
    function frame() {
      raf = requestAnimationFrame(frame);
      if (disposed) return;
      const now = performance.now();
      const state: any = net.room?.state;
      const myId = net.sessionId;

      if (state?.players && myId) {
        const me = state.players.get(myId);
        if (me) {
          if (!initialized) {
            predictor.reset(me.x, me.y, me.aim);
            cam.x = me.x - view.w / 2;
            cam.y = me.y - view.h / 2;
            clampCamera(cam, view);
            initialized = true;
          } else {
            // Reconciliación con la posición autoritativa.
            predictor.reconcile(me.x, me.y, me.lastSeq);
          }
        }

        // Remotos -> buffer de interpolación.
        interp.beginFrame();
        state.players.forEach((p: any, id: string) => {
          if (id === myId) return;
          interp.mark(id);
          interp.addSample(id, p.isBot, p.x, p.y, p.aim, now);
        });
        interp.endFrame();
      }

      // Cámara sigue al propio (suave, como la POC: 0.12).
      cam.x += (predictor.x - view.w / 2 - cam.x) * 0.12;
      cam.y += (predictor.y - view.h / 2 - cam.y) * 0.12;
      clampCamera(cam, view);

      const remotes = interp.view(now);
      renderer.draw(cam, { x: predictor.x, y: predictor.y, aim: predictor.aim }, remotes);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      if (inputTimer) clearInterval(inputTimer);
      cancelAnimationFrame(raf);
      input.destroy();
      net.leave();
    };
  }, [roomName, fakeLagMs]);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      <div ref={statusRef} className="game-status" />
      <button className="game-exit" onClick={onExit}>
        ‹ Salir
      </button>
      <div ref={joyRef} className="joy">
        <div ref={knobRef} className="knob" />
      </div>
      <div className="world-hint">
        Mundo {WORLD.w}×{WORLD.h} · servidor autoritativo
      </div>
    </div>
  );
}

// =====================================================================
// InputController — joystick virtual de una mano (control móvil).
//
// Portado de la POC: base = centro del elemento, radio máx 52px, devuelve
// dirección*magnitud normalizada en [-1,1]. El consumidor lo muestrea cada
// input-tick y lo manda como InputCommand.move.
// =====================================================================

const MAX_RADIUS = 52;

export class InputController {
  private active = false;
  private pid: number | null = null;
  private baseX = 0;
  private baseY = 0;

  /** Vector de movimiento actual (dirección * magnitud), componentes en [-1,1]. */
  move = { x: 0, y: 0 };

  constructor(
    private base: HTMLElement,
    private knob: HTMLElement,
  ) {
    base.addEventListener("pointerdown", this.onDown);
    base.addEventListener("pointermove", this.onMove);
    base.addEventListener("pointerup", this.onUp);
    base.addEventListener("pointercancel", this.onUp);
  }

  destroy() {
    this.base.removeEventListener("pointerdown", this.onDown);
    this.base.removeEventListener("pointermove", this.onMove);
    this.base.removeEventListener("pointerup", this.onUp);
    this.base.removeEventListener("pointercancel", this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.active = true;
    this.pid = e.pointerId;
    const r = this.base.getBoundingClientRect();
    this.baseX = r.left + r.width / 2;
    this.baseY = r.top + r.height / 2;
    try {
      this.base.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    this.onMove(e);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.pid) return;
    e.preventDefault();
    let dx = e.clientX - this.baseX;
    let dy = e.clientY - this.baseY;
    const m = Math.hypot(dx, dy);
    if (m > MAX_RADIUS) {
      dx = (dx / m) * MAX_RADIUS;
      dy = (dy / m) * MAX_RADIUS;
    }
    this.move.x = dx / MAX_RADIUS;
    this.move.y = dy / MAX_RADIUS;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pid) return;
    this.active = false;
    this.pid = null;
    this.move.x = 0;
    this.move.y = 0;
    this.knob.style.transform = "translate(0, 0)";
  };
}

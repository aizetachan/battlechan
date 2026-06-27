# Referencias (fuentes de verdad)

Documentos originales del proyecto, incluidos para que cualquier sesión de
Claude Code (o persona) pueda consultarlos sin adjuntarlos.

- **`br-topdown-poc.html`** — La POC: un único HTML con toda la lógica en cliente
  (Canvas 2D @~60fps). Es la **especificación funcional de las reglas** (armas,
  zona, loot, economía, IA, controles). NO es base de producción; la lógica se
  porta a un servidor autoritativo. Ábrelo en un navegador para verlo jugar.
- **`doc2-arquitectura-produccion.md`** — Documento 2: define la **arquitectura
  de producción** (cliente-servidor autoritativo, netcode, flotas, persistencia).
  Extraído del .docx original (las tablas pueden verse aplanadas).
- **`plan-fase1.md`** — El plan de la Fase 1 MVP con el stack Firebase y el
  desglose por milestones que estamos siguiendo.

> Resumen aplicado al repo: ver `../architecture.md`. Contexto de trabajo para
> Claude: ver `../../CLAUDE.md` (raíz).

# Documento 2 — Arquitectura de producción (extraído de .docx)

> Texto extraído automáticamente del .docx original; el formato de tablas puede haberse aplanado.

ZONA·CERO
Arquitectura de producción — Multijugador online en tiempo real
Documento 2 — Cómo construir el juego correctamente
Nakama Studio
Documento técnico orientado a desarrolladores

Premisas de producto (confirmadas)
Jugadores por partida: 10–30 jugadores reales
Composición: A futuro solo reales; primeras versiones con bots de relleno + modo solo-contra-bots
Entrada a la partida: Por enlace de sala (room link). Matchmaking automático más adelante
Modelo de servidor: Servidor autoritativo (anti-trampas)
Prioridad: Calidad y escalabilidad primero; el coste es secundario
Plataforma: Solo web (navegador móvil/PC). Apps nativas quizá más adelante
Cuentas: Sí: login con progreso, monedas y compras guardadas
Pagos: Economía interna por ahora; sin dinero real

Índice
TOC \h \o "1-2"


1. Por qué la POC no sirve como base de producción
La POC es un único archivo cliente donde toda la lógica (movimiento, daño, loot, IA) se ejecuta en el navegador del jugador. Eso es ideal para iterar, pero incompatible con un producto multijugador competitivo por tres razones:
Sin autoridad: si el cliente decide su propio daño y posición, cualquiera puede hacer trampas modificando el JavaScript.
Sin sincronización: no existe un estado compartido entre jugadores; cada navegador vive su propia partida.
Sin persistencia real: el progreso vive en memoria y se pierde al recargar.
La lógica de juego de la POC sí es reutilizable como especificación de las reglas (valores de armas, comportamiento de zona, economía). Lo que cambia es dónde se ejecuta: pasa del cliente a un servidor autoritativo.
2. Visión general de la arquitectura
Arquitectura cliente-servidor autoritativa con servidores de partida dedicados, orquestados por servicios de backend para cuentas, salas y economía.
2.1 Componentes
Componente
Responsabilidad
Naturaleza
Cliente (web)
Render, input, predicción e interpolación. NO decide reglas.
Navegador (Canvas/WebGL)
Game Server (autoritativo)
Simula la partida: física, daño, loot, zona, victoria. Fuente de verdad.
Proceso por sala/partida
Realtime transport
Transporte de baja latencia cliente↔game server.
WebSocket / WebRTC / WebTransport
Matchmaker / Lobby
Crea salas, genera enlaces, asigna jugadores a un game server.
Servicio backend
Orquestador de flotas
Arranca/apaga game servers bajo demanda y escala.
Agones / Nakama / Edgegap / custom
Auth & Cuentas
Login, identidad, sesión (JWT).
Servicio backend + DB
Perfil & Economía
Monedas, inventario, compras, progresión.
Servicio backend + DB
Base de datos
Persistencia de cuentas, inventario, economía.
PostgreSQL + Redis
2.2 Diagrama lógico (flujo)
Cliente (web)   │  login (JWT)            ┌────────────────────┐   ├───────────────────────▶│  Auth & Cuentas     │──▶ PostgreSQL   │                        └────────────────────┘   │  crear/unirse sala     ┌────────────────────┐   ├───────────────────────▶│ Matchmaker / Lobby │   │   (room link)          └─────────┬──────────┘   │                                  │ asigna   │                                  ▼   │  WebSocket/UDP         ┌────────────────────┐   └═══════════════════════▶│  GAME SERVER        │ (autoritativo)      inputs ───▶            │  - tick loop 20-30Hz│      ◀─── snapshots         │  - física, daño     │                            │  - zona, loot, IA   │                            └─────────┬──────────┘                                      │ al terminar: resultados                                      ▼                            ┌────────────────────┐                            │ Perfil & Economía   │──▶ PostgreSQL/Redis                            └────────────────────┘
3. Netcode: el corazón del juego
Un battle royale en tiempo real exige un modelo de red bien definido. Recomendación: servidor autoritativo con tick fijo + predicción de cliente + interpolación de entidades.
3.1 Bucle autoritativo por tick
El game server corre un bucle de simulación a tick fijo (recomendado 20–30 Hz para top-down; suficiente y económico en ancho de banda).
Cada tick: recoge inputs recibidos, avanza la simulación (movimiento, balas, daño, zona, loot), y genera un snapshot del estado.
El servidor es la única fuente de verdad: el cliente nunca decide si un disparo acierta.
3.2 El cliente envía intenciones, no resultados
El cliente transmite comandos de input (dirección del joystick, disparar sí/no, usar item), no posiciones ni daños. El servidor valida y aplica.
// Cliente → Servidor (cada tick de input){ seq: 1423, move:{x:0.8,y:-0.3}, fire:true, useItem:false, t:clientTime }// Servidor → Cliente (snapshot, cada tick de red){ tick: 9120, you:{x,y,hp,shield,ammo}, ents:[ {id,x,y,kind}, ... ],  zone:{cx,cy,r}, events:[ {type:'hit',target,dmg}, ... ] }
3.3 Predicción de cliente (client-side prediction)
Para que el control se sienta instantáneo pese a la latencia, el cliente aplica su propio input localmente de inmediato (predice su movimiento).
Cuando llega el snapshot autoritativo, reconcilia: si hay discrepancia, corrige su posición (server reconciliation) reaplicando los inputs no confirmados.
3.4 Interpolación de entidades remotas
Los demás jugadores/bots se renderizan interpolando entre los dos últimos snapshots recibidos (buffer de ~100 ms), para que se muevan suave aunque la red llegue a saltos.
Combinado: tu personaje va predicho (responde ya), los demás van interpolados (van suaves).
3.5 Compensación de latencia en disparos
Para el sniper/hitscan conviene lag compensation: el servidor reconstruye dónde estaba el objetivo en el momento del disparo según la latencia del tirador.
Alternativa más simple para empezar: balas como proyectiles con viaje (como ya hace la POC), que toleran mejor la latencia sin lag compensation compleja.
3.6 Transporte
Opción
Pros
Contras
Recomendación
WebSocket (TCP)
Simple, soportado en todo navegador
TCP head-of-line blocking bajo pérdida
Empezar aquí (MVP)
WebRTC DataChannel (UDP)
UDP no fiable/ordenado, ideal real-time
Setup (ICE/STUN/TURN) complejo
Fase de optimización
WebTransport (QUIC)
Moderno, UDP fiable parcial, multiplexado
Soporte de navegador aún irregular
Vigilar a futuro
Para 10–30 jugadores top-down a 20–30 Hz, WebSocket es perfectamente viable para el lanzamiento y simplifica enormemente. Migrar a WebRTC/WebTransport es una optimización posterior, no un bloqueante.
4. Salas, enlaces y matchmaking
4.1 Entrada por enlace (room link)
Un jugador crea una sala desde el lobby; el backend genera un roomId único y un enlace (p. ej. zonacero.gg/r/AB12CD).
El enlace se comparte; quien lo abre (logueado) entra a la sala.
La sala muestra jugadores conectados, modo (con bots de relleno / solo-bots) y un botón de inicio.
Al iniciar, el matchmaker reserva un game server, le pasa la lista de jugadores y reparte la dirección de conexión a los clientes.
4.2 Relleno con bots y modo solo-contra-bots
Si la sala no llega al mínimo, el game server instancia bots (la misma IA de la POC, pero ejecutada en el servidor) hasta completar el cupo objetivo.
Modo solo-contra-bots: una sala de 1 humano donde el resto son bots. Útil para onboarding y para jugar sin esperar.
La IA de bots vive en el servidor: así no hay diferencia de autoridad entre bots y humanos y se evita el cheating.
4.3 Matchmaking automático (fase posterior)
Cola de emparejamiento que agrupa jugadores sueltos por región/latencia y nivel.
Reutiliza la misma infraestructura de salas; solo cambia cómo se llena la sala (cola en vez de enlace).
5. Escalabilidad y orquestación
El patrón clave: un proceso de game server por partida. Escalar = arrancar más procesos, no hacer uno más grande.
5.1 Orquestación de flota
Game servers efímeros: nacen al empezar una partida y mueren al acabar.
Un orquestador gestiona el ciclo de vida y el autoescalado según demanda.
Opciones: Agones (sobre Kubernetes), Nakama (Heroic Labs), Edgegap, Hathora, o Colyseus para un enfoque más ligero en Node.
5.2 Frameworks de servidor de juego recomendados
Framework
Lenguaje
Encaje con ZONA·CERO
Colyseus
Node/TS
Muy directo si el equipo es JS. Salas, estado sincronizado y schema listos. Ideal MVP.
Nakama
Go (server) + SDKs
Completo: auth, matchmaking, economía, leaderboards integrados. Más batería incluida.
Agones + custom
Cualquiera
Máximo control y escalado sobre Kubernetes. Más trabajo de plataforma.
SpacetimeDB / Rivet
Varios
Alternativas modernas a vigilar.
Recomendación práctica para arrancar rápido con calidad: Colyseus (servidor de partidas en TypeScript, comparte lenguaje con el cliente y permite portar la lógica de la POC casi 1:1) + un backend propio para cuentas y economía. Si se prioriza tener todo integrado desde el día uno, Nakama es la alternativa con más servicios de serie.
5.3 Despliegue regional (latencia)
Desplegar game servers en varias regiones y conectar al jugador a la más cercana minimiza el ping.
Empezar por una región (la principal del público objetivo) y añadir regiones según crezca la base.
6. Cuentas, persistencia y economía
6.1 Autenticación
Login con email/contraseña y/o OAuth (Google, Apple) para fricción mínima en web.
Sesión mediante JWT; el token se valida tanto en el backend como al unirse a un game server.
Opcional: cuenta invitado (device id) que luego se vincula a un login real sin perder progreso.
6.2 Modelo de datos (esquema inicial)
users        (id, email, auth_provider, created_at, last_login)profiles     (user_id, level, xp, coins, display_name, equipped_skin)inventory    (user_id, item_id, type, qty)        // armas/skins/items en propiedadloadout      (user_id, weapon_slots[], passive_item, consumable)purchases    (id, user_id, item_id, price, ts)    // log económico (auditoría)matches      (id, room_id, mode, started_at, ended_at)match_players(match_id, user_id, placement, kills, coins_earned)
6.3 Economía autoritativa (anti-trampas)
Las monedas y compras se calculan y validan en el servidor, nunca en el cliente.
Al terminar la partida, el game server reporta resultados (puesto, bajas, monedas de zona caliente) al servicio de economía, que actualiza el saldo.
Las compras de tienda son transacciones de servidor: comprueban saldo, descuentan y otorgan el item atómicamente.
PostgreSQL para datos persistentes; Redis para estado caliente (sesiones, saldos en vuelo, salas activas).
6.4 Pagos reales (futuro)
La economía interna se diseña desde ya con una capa de "fuente de monedas" abstracta, de modo que añadir compra de monedas con dinero real (Stripe u otra pasarela) más adelante no obligue a rehacer el sistema.
7. Anti-cheat y seguridad
Autoridad de servidor: el cliente nunca es fuente de verdad de daño, posición, loot ni economía.
Validación de inputs: el servidor descarta movimientos imposibles (velocidad fuera de rango, disparos sin munición, teletransportes).
Rate limiting y sanity checks en cada comando de red.
La IA de bots corre en servidor: imposible distinguir o explotar diferencias de autoridad.
Comunicación cifrada (WSS/HTTPS) extremo a extremo.
Tokens de sesión con expiración; el game server verifica el JWT al admitir a cada jugador.
8. Cómo portar la lógica de la POC
La POC ya contiene, en la práctica, la especificación de reglas del juego. El trabajo de producción es mover esa lógica del cliente al servidor y dejar en el cliente solo render + input.
Lógica en la POC (cliente)
Destino en producción
Movimiento, colisiones, velocidad
Game server (tick autoritativo)
Disparo, daño, balas, alcance
Game server
Zona que se cierra + daño fuera
Game server
Cajas, suministros, zona caliente
Game server
IA de bots (percepción local)
Game server (idéntica lógica)
Valores de armas/items (balance)
Config compartida servidor (fuente única)
Render, cámara, minimapa, HUD
Cliente (sobre snapshots)
Joystick, botones, Pointer Events
Cliente (genera comandos de input)
Skins, tienda, inventario (UI)
Cliente UI + backend economía
Persistencia en memoria
Backend + PostgreSQL/Redis
Estrategia recomendada: extraer las constantes y funciones puras de reglas de la POC a un módulo compartido (mismo lenguaje en cliente y servidor si se usa Colyseus/TS), usado por el servidor para simular y por el cliente solo para predicción local.
9. Stack recomendado (resumen)
Capa
Recomendación MVP
Alternativa / escala
Cliente render
Canvas 2D o PixiJS (WebGL)
PixiJS para más efectos/partículas
Lenguaje cliente
TypeScript
—
Game server
Colyseus (Node/TS)
Nakama (Go) / Agones+custom
Transporte
WebSocket (WSS)
WebRTC DataChannel / WebTransport
Orquestación
Colyseus + contenedores
Agones sobre Kubernetes
Auth
Backend propio (JWT) + OAuth
Servicio gestionado de identidad
Backend economía
Node/TS API
Integrado en Nakama
DB persistente
PostgreSQL
+ réplicas de lectura
Estado caliente
Redis
Redis cluster
Hosting
Cloud con multi-región
Edge regional (Edgegap/Hathora)
10. Hoja de ruta sugerida
Fase 1 — MVP online jugable
Game server autoritativo (Colyseus) con la lógica de la POC portada.
Cliente con predicción + interpolación sobre WebSocket.
Salas por enlace + relleno de bots + modo solo-contra-bots.
Login básico y persistencia de monedas/inventario.
Una sola región.
Fase 2 — Producto
Arte definitivo (producción visual con Magnific) e identidad sonora.
Economía y tienda completas, validadas en servidor.
Autoescalado de flota y despliegue multi-región.
Pulido de game feel y balance.
Fase 3 — Crecimiento
Matchmaking automático por cola.
Optimización de transporte (WebRTC/WebTransport) y lag compensation.
Pagos reales sobre la capa económica ya preparada.
Posibles apps nativas reutilizando el backend.

11. Conclusión
ZONA·CERO está validado como juego. El salto a producción no consiste en "añadir multijugador" al archivo actual, sino en reubicar la lógica ya diseñada dentro de una arquitectura cliente-servidor autoritativa: el servidor simula y manda, el cliente predice y dibuja.
Con un game server autoritativo (Colyseus como punto de partida recomendado), salas por enlace con relleno de bots, login con persistencia y economía validada en servidor, el juego cumple los requisitos de calidad, escalabilidad y anti-trampas marcados. El balance, las reglas y la IA ya existen en la POC y se reutilizan casi íntegros; lo que se construye nuevo es la capa de red, cuentas e infraestructura.

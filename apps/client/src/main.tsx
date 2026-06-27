import { createRoot } from "react-dom/client";
import { App } from "./meta/App.js";
import "./styles.css";

// Nota: sin StrictMode a propósito — su doble montaje de efectos en dev
// abriría dos conexiones WebSocket a la sala.
createRoot(document.getElementById("root")!).render(<App />);

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @zonacero/shared se consume como SOURCE TypeScript (no pre-bundlear).
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@zonacero/shared"],
  },
  server: {
    port: 5173,
    host: true,
  },
});

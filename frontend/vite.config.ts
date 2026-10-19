import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Escucha en todas las interfaces de red (no solo localhost) para poder
    // probar la app desde el celular u otro dispositivo en la misma Wi-Fi.
    host: true,
  },
});

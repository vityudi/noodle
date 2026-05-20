import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      "/api": { target: "http://backend:8080", changeOrigin: true },
      "/mcp": { target: "http://backend:8080" },
      "/schema": { target: "http://backend:8080", changeOrigin: true },
    },
  },
});

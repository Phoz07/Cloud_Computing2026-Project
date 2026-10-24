import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";
import { headPlugin } from "./server/head-plugin.ts";


// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // every workspace reads the root .env
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../.."), "");
  return {
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      // per-URL title and Open Graph tags (server/head.ts)
      headPlugin({
        origin: env.BETTER_AUTH_URL || "http://localhost:5173",
        eventServiceUrl: env.EVENT_SERVICE_URL || "http://localhost:3002",
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      port: 5173,
      proxy: {
        "/api/auth": "http://localhost:3001",
        "/api/events": "http://localhost:3002",
        // ws: the event page's live seats (/api/regis/events/:eventId/availability/live)
        "/api/regis": { target: "http://localhost:3003", ws: true },
        "/api/payment": "http://localhost:3004",
        // stored files: /files/<key> -> the event-assets bucket (only public/* is readable)
        "/files": {
          target: "http://localhost:9000",
          rewrite: (path) => path.replace(/^\/files/, "/event-assets"),
        },
      },
    },
  };
})

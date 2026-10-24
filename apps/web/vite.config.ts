import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
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
})

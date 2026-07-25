import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Load environment variables immediately into process.env before importing API router
const loadedEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, loadedEnv);

import apiApp from "./api/index.js";

function honoDevApiPlugin() {
  return {
    name: "hono-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith("/api")) {
          try {
            const protocol = req.socket.encrypted ? "https" : "http";
            const host = req.headers.host || "localhost:5173";
            const fullUrl = `${protocol}://${host}${req.url}`;

            let body = null;
            if (req.method !== "GET" && req.method !== "HEAD") {
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              body = Buffer.concat(chunks);
            }

            const headers = new Headers();
            for (const [key, val] of Object.entries(req.headers)) {
              if (Array.isArray(val)) {
                val.forEach((v) => headers.append(key, v));
              } else if (val !== undefined) {
                headers.set(key, val);
              }
            }

            const webReq = new Request(fullUrl, {
              method: req.method,
              headers,
              body,
            });

            const response = await apiApp.fetch(webReq);
            res.statusCode = response.status;
            response.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });

            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err) {
            console.error("Vite API Middleware error:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal Server Error" }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), honoDevApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});

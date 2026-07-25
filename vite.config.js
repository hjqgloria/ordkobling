import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const loadedEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, loadedEnv);

import validateHandler from "./api/validate.js";
import leaderboardHandler from "./api/leaderboard.js";

function devApiPlugin() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/api/validate")) {
          return validateHandler(req, res);
        }
        if (req.url && req.url.startsWith("/api/leaderboard")) {
          return leaderboardHandler(req, res);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});

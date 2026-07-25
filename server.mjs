import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import api from "./api/index.js";

const app = new Hono();

// Mount API routes
app.route("/api", api);

// Serve static files from production build directory
app.use("/*", serveStatic({ root: "./dist" }));

// Fallback to SPA index.html
app.get("*", serveStatic({ path: "./dist/index.html" }));

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`Server starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

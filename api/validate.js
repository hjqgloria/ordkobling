import { Hono } from "hono";

const app = new Hono();

app.get("*", async (c) => {
  const word = c.req.query("word")?.toLowerCase().trim();

  if (!word || word.length < 2 || word.length > 20 || !/^[a-zæøå]+$/i.test(word)) {
    return c.json({ valid: false });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const API_BASE = process.env.DICTIONARY_API_URL || 'https://ord.uib.no/api/articles';

    const res = await fetch(`${API_BASE}?w=${encodeURIComponent(word)}&dict=bm,nn&scope=ei`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    const hasBm = Array.isArray(data.articles?.bm) && data.articles.bm.length > 0;
    const hasNn = Array.isArray(data.articles?.nn) && data.articles.nn.length > 0;
    return c.json({ valid: hasBm || hasNn });
  } catch (error) {
    console.error('Dictionary validation error:', error);
    return c.json({ valid: false });
  }
});

// Standard Node.js (req, res) handler for Vercel & local server
export default async function handler(req, res) {
  try {
    const protocol = req.socket?.encrypted ? "https" : "http";
    const host = req.headers.host || "localhost";
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
    for (const [key, val] of Object.entries(req.headers || {})) {
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

    const response = await app.fetch(webReq);
    res.statusCode = response.status;
    response.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Vite/Vercel API error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}

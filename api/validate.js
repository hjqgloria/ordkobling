import { Hono } from "hono";
import { checkWord } from "../lib/dictionary.js";

const app = new Hono();

app.get("*", async (c) => {
  const word = c.req.query("word")?.toLowerCase().trim();

  if (!word || word.length < 2 || word.length > 20 || !/^[a-zæøå]+$/i.test(word)) {
    return c.json({ valid: false });
  }

  const result = await checkWord(word);
  if (result.status === "ok") {
    return c.json({ valid: result.valid });
  }

  // Dictionary is unavailable - do NOT report the word as invalid.
  console.error("Dictionary unavailable (circuitOpen: %s)", result.circuitOpen);
  return c.json({ valid: false, error: "dictionary_unavailable", retryAfter: result.retryAfter }, 503);
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

import { Hono } from "hono";
import redis from "../lib/redis.js";

const api = new Hono();

const ALLTIME_KEY = "ordkobling:leaderboard";
const DAILY_PREFIX = "ordkobling:daily:";
const DAILY_TTL = 60 * 60 * 48; // 48h
const TOP_N = 10;

function osloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dailyKey(date = new Date()) {
  return `${DAILY_PREFIX}${osloDateKey(date)}`;
}

const PROFANITY = [
  'fuck', 'shit', 'bitch', 'asshole', 'damn', 'bollocks', 'arse', 'crap'
];

function containsProfanity(s) {
  if (!s) return false;
  const lower = s.toLowerCase();
  return PROFANITY.some(w => lower.includes(w));
}

async function topScores(key) {
  let result;
  if (typeof redis.zrange === 'function') {
    result = await redis.zrange(key, 0, TOP_N - 1, { rev: true, withScores: true });
  } else {
    result = await redis.sendCommand(["ZREVRANGE", key, "0", String(TOP_N - 1), "WITHSCORES"]);
  }
  const out = [];
  for (let i = 0; i < (result || []).length; i += 2) {
    out.push({ name: result[i], score: Number(result[i + 1]) || 0 });
  }
  return out;
}

async function addHighScore(key, score, member) {
  if (typeof redis.zadd === 'function') {
    await redis.zadd(key, { gt: true }, { score, member });
  } else {
    await redis.sendCommand(["ZADD", key, "GT", score.toString(), member]);
  }
}

async function expire(key, seconds) {
  if (typeof redis.expire === 'function') {
    await redis.expire(key, seconds);
  } else {
    await redis.sendCommand(["EXPIRE", key, String(seconds)]);
  }
}

// Validation endpoint handler
api.get("/validate", async (c) => {
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

// Leaderboard GET handler
api.get("/leaderboard", async (c) => {
  try {
    const date = osloDateKey();
    const [daily, allTime] = await Promise.all([
      topScores(dailyKey()),
      topScores(ALLTIME_KEY),
    ]);
    return c.json({ date, daily, allTime });
  } catch (error) {
    console.error("Leaderboard GET error", error);
    return c.json({ error: "Failed to load leaderboard" }, 500);
  }
});

// Leaderboard POST handler
api.post("/leaderboard", async (c) => {
  try {
    const body = await c.req.json();

    let rawName = String(body.name || "").trim();
    const score = Number(body.score);

    if (!Number.isFinite(score) || score <= 0 || score > 1000000) {
      return c.json({ error: "Invalid score" }, 400);
    }

    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const ip = clientIp.split(',')[0].trim();
    const rateKey = `rate:${ip}`;
    try {
      let count;
      if (typeof redis.incr === 'function') {
        count = await redis.incr(rateKey);
        if (count === 1) await expire(rateKey, 60);
      } else {
        count = await redis.sendCommand(['INCR', rateKey]);
        if (count === 1) await redis.sendCommand(['EXPIRE', rateKey, '60']);
      }
      if (count > 10) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    } catch (e) {
      console.warn('Rate limiter failed', e);
    }

    try {
      rawName = rawName.normalize('NFKC');
    } catch (e) {}

    let name = rawName.replace(/\s+/g, ' ').replace(/[\p{C}]/gu, '').trim();
    name = name.replace(/[^\p{L}\p{N}\-_. ]+/gu, '');
    name = name.replace(/\s{2,}/g, ' ');
    if (!name) return c.json({ error: 'Invalid name' }, 400);
    name = name.slice(0, 32);

    if (name.length === 0) return c.json({ error: 'Invalid name' }, 400);

    if (containsProfanity(name)) {
      return c.json({ error: "Name contains restricted content" }, 400);
    }

    const lookupName = name.toLowerCase();
    const dKey = dailyKey();
    await addHighScore(dKey, score, lookupName);
    await expire(dKey, DAILY_TTL);
    await addHighScore(ALLTIME_KEY, score, lookupName);

    return c.json({ ok: true, name });
  } catch (error) {
    console.error("Leaderboard POST error", error);
    return c.json({ error: "Failed to submit score" }, 500);
  }
});

import { handle } from "hono/vercel";

// Create main app supporting both /api prefix and root paths
const app = new Hono();
app.route("/api", api);
app.route("/", api);

export const handler = handle(app);
export default app;

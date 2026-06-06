import { NextResponse } from "next/server";
import redis from "@/lib/redis";

const ALLTIME_KEY = "ordkobling:leaderboard";
const DAILY_PREFIX = "ordkobling:daily:";
const DAILY_TTL = 60 * 60 * 48; // 48h — the per-day key only needs to outlive its own day
const TOP_N = 10;

// Current puzzle day (YYYY-MM-DD) in Europe/Oslo, computed server-side so the
// client cannot post into a different day's board.
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

// Minimal profanity list — extend as needed. Stored here to avoid extra dependencies.
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'asshole', 'damn', 'bollocks', 'arse', 'crap'
];

function containsProfanity(s) {
  if (!s) return false;
  const lower = s.toLowerCase();
  return PROFANITY.some(w => lower.includes(w));
}

// Read the top entries of a sorted set (highest first) as [{ name, score }].
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

// Add a score keeping only the player's highest (ZADD ... GT).
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

export async function GET() {
  try {
    const date = osloDateKey();
    const [daily, allTime] = await Promise.all([
      topScores(dailyKey()),
      topScores(ALLTIME_KEY),
    ]);
    return NextResponse.json({ date, daily, allTime });
  } catch (error) {
    console.error("Leaderboard GET error", error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Basic extraction
    let rawName = String(body.name || "").trim();
    const score = Number(body.score);

    // Validate score is a finite positive integer and within a sane bound
    if (!Number.isFinite(score) || score <= 0 || score > 1000000) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    // Simple rate limiting per IP: allow up to 10 submissions per minute
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const rateKey = `rate:${ip}`;
    try {
      let c;
      if (typeof redis.incr === 'function') {
        c = await redis.incr(rateKey);
        if (c === 1) await expire(rateKey, 60);
      } else {
        c = await redis.sendCommand(['INCR', rateKey]);
        if (c === 1) await redis.sendCommand(['EXPIRE', rateKey, '60']);
      }
      if (c > 10) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }
    } catch (e) {
      // If Redis rate-limiter fails, continue but log
      console.warn('Rate limiter failed', e);
    }

    // Sanitize name: normalize, remove control characters and limit allowed chars to letters, numbers, space, - _ .
    try {
      rawName = rawName.normalize('NFKC');
    } catch (e) {}
    // Remove newline/control chars
    let name = rawName.replace(/\s+/g, ' ').replace(/[\p{C}]/gu, '').trim();
    // Keep only reasonable characters
    name = name.replace(/[^\p{L}\p{N}\-_. ]+/gu, '');
    // Collapse multiple spaces
    name = name.replace(/\s{2,}/g, ' ');
    // Enforce max length
    if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    name = name.slice(0, 32);

    // Defensive: final check
    if (name.length === 0) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

    if (containsProfanity(name)) {
      return NextResponse.json({ error: "Name contains restricted content" }, { status: 400 });
    }

    // Treat "User" and "user" as the same person for the score key/member.
    const lookupName = name.toLowerCase();

    // Daily board (resets each Oslo day via key name + TTL) and all-time best board.
    const dKey = dailyKey();
    await addHighScore(dKey, score, lookupName);
    await expire(dKey, DAILY_TTL);
    await addHighScore(ALLTIME_KEY, score, lookupName);

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error("Leaderboard POST error", error);
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
  }
}

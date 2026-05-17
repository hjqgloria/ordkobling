import { NextResponse } from "next/server";
import redis from "@/lib/redis";

const LEADERBOARD_KEY = "ordkobling:leaderboard";

// Minimal profanity list — extend as needed. Stored here to avoid extra dependencies.
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'asshole', 'damn', 'bollocks', 'arse', 'crap'
];

function containsProfanity(s) {
  if (!s) return false;
  const lower = s.toLowerCase();
  return PROFANITY.some(w => lower.includes(w));
}

export async function GET() {
  try {
    let result;
    if (typeof redis.zrange === 'function') {
      result = await redis.zrange(LEADERBOARD_KEY, 0, 9, { rev: true, withScores: true });
    } else {
      result = await redis.sendCommand(["ZREVRANGE", LEADERBOARD_KEY, "0", "9", "WITHSCORES"]);
    }

    const leaderboard = [];
    for (let i = 0; i < (result || []).length; i += 2) {
      leaderboard.push({
        name: result[i],
        score: Number(result[i + 1]) || 0,
      });
    }
    return NextResponse.json({ leaderboard });
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
        if (c === 1 && typeof redis.expire === 'function') {
          await redis.expire(rateKey, 60);
        } else if (c === 1) {
          await redis.sendCommand(['EXPIRE', rateKey, '60']);
        }
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
    
    // If you want "User" and "user" to be the same person, 
    // use a lowercase version for the Redis key/member.
    const lookupName = name.toLowerCase();

    let currentScoreRaw;
    if (typeof redis.zscore === 'function') {
      currentScoreRaw = await redis.zscore(LEADERBOARD_KEY, lookupName);
    } else {
      currentScoreRaw = await redis.sendCommand(["ZSCORE", LEADERBOARD_KEY, lookupName]);
    }
    const currentScore = currentScoreRaw ? Number(currentScoreRaw) : null;
    if (currentScore === null || score > currentScore) {
      if (typeof redis.zadd === 'function') {
        await redis.zadd(LEADERBOARD_KEY, { score, member: lookupName });
      } else {
        await redis.sendCommand(["ZADD", LEADERBOARD_KEY, score.toString(), lookupName]);
      }
    }

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error("Leaderboard POST error", error);
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
  }
}

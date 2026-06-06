// Prefer the official SDK client when possible because it exposes convenient
// high-level methods (zrange, zscore, zadd, incr, expire, etc.). Fall back
// to a minimal REST adapter only if the SDK cannot be initialized.

import { Redis } from "@upstash/redis";

function makeErrorStub(msg) {
  return {
    sendCommand: async () => {
      throw new Error(msg);
    },
  };
}

let baseUrl = null;
let token = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  baseUrl = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  token = process.env.UPSTASH_REDIS_REST_TOKEN;
} else if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  baseUrl = process.env.KV_REST_API_URL.replace(/\/$/, '');
  token = process.env.KV_REST_API_TOKEN;
} else if (process.env.REDIS_URL) {
  try {
    const u = new URL(process.env.REDIS_URL);
    const maybeToken = u.password || u.username || '';
    baseUrl = `https://${u.hostname}`;
    token = maybeToken || null;
  } catch (e) {
    // leave baseUrl null
  }
}

let adapterOrClient = null;
try {
  // Prefer the URL/token we resolved above (covers UPSTASH_* and Vercel KV_*).
  // Only fall back to fromEnv(), which reads UPSTASH_REDIS_REST_* exclusively,
  // when we couldn't resolve credentials ourselves.
  if (baseUrl && token) {
    adapterOrClient = new Redis({ url: baseUrl, token });
  } else if (typeof Redis?.fromEnv === 'function') {
    adapterOrClient = Redis.fromEnv();
  }
} catch (e) {
  adapterOrClient = null;
}

if (!adapterOrClient) {
  if (baseUrl && token) {
    const sendCommand = async (cmdArray) => {
      const url = `${baseUrl}/command`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cmd: cmdArray }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (json && (json.error || json.message)) || `Upstash responded with ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }
      return json && json.result;
    };
    adapterOrClient = { sendCommand };
  } else {
    adapterOrClient = makeErrorStub("Upstash Redis environment variables are not configured or invalid.");
  }
}

export default adapterOrClient;

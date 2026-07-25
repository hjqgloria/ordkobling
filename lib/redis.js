import { Redis } from "@upstash/redis";

let cachedClient = null;

function getRedisClient() {
  if (cachedClient) return cachedClient;

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

  if (baseUrl && token) {
    cachedClient = new Redis({ url: baseUrl, token });
    return cachedClient;
  }

  if (typeof Redis?.fromEnv === 'function' && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      cachedClient = Redis.fromEnv();
      return cachedClient;
    } catch (e) {
      // fall back
    }
  }

  if (baseUrl && token) {
    cachedClient = {
      sendCommand: async (cmdArray) => {
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
      },
    };
    return cachedClient;
  }

  return {
    sendCommand: async () => {
      throw new Error("Upstash Redis environment variables are not configured or invalid.");
    },
  };
}

// Lazy proxy so environment variables are resolved when Redis commands are actually executed
const redisProxy = new Proxy({}, {
  get(_target, prop) {
    const client = getRedisClient();
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

export default redisProxy;

// Circuit breaker for the Ordbøkene dictionary API.
//
// When the upstream API is down we don't want every word lookup to wait for
// the full retry cycle. After a failed lookup we "open the circuit" and fail
// fast for a cooldown period. The first real request after the cooldown acts
// as the recovery probe — no separate health-check endpoint needed.

const API_BASE = process.env.DICTIONARY_API_URL || "https://ord.uib.no/api/articles";

const PROBE_COOLDOWN_MS = 60_000; // fail-fast window after an outage is detected
const RETRY_DELAY_MS = 400;
const TIMEOUT_MS = 5000;

let downUntil = 0; // timestamp until which the API is assumed down (0 = up)

export async function checkWord(word) {
  const now = Date.now();

  // Circuit open: skip the upstream call entirely and fail fast. The first
  // request after the cooldown expires becomes the recovery probe.
  if (now < downUntil) {
    return {
      status: "down",
      circuitOpen: true,
      retryAfter: Math.max(1, Math.ceil((downUntil - now) / 1000)),
    };
  }

  const url = `${API_BASE}?w=${encodeURIComponent(word)}&dict=bm,nn&scope=ei`;

  // One retry: transient 5xx/timeout errors from the dictionary API are common and brief.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) continue; // upstream error -> retry once
      const data = await res.json();
      const hasBm = Array.isArray(data.articles?.bm) && data.articles.bm.length > 0;
      const hasNn = Array.isArray(data.articles?.nn) && data.articles.nn.length > 0;
      downUntil = 0; // upstream answered — circuit closed
      return { status: "ok", valid: hasBm || hasNn };
    } catch (error) {
      // network error / timeout / invalid JSON -> retry
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Both attempts failed — open the circuit.
  downUntil = Date.now() + PROBE_COOLDOWN_MS;
  console.error("Dictionary unavailable after retries; circuit open for %dms", PROBE_COOLDOWN_MS);
  return { status: "down", circuitOpen: false, retryAfter: Math.ceil(PROBE_COOLDOWN_MS / 1000) };
}

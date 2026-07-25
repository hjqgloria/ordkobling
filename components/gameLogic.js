import BONUS_WORDS from "./bonus_words.json";

export const LETTER_SCORES = {
  A:1,B:4,C:10,D:1,E:1,F:4,G:3,H:3,I:1,J:4,K:2,L:1,
  M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:3,V:4,W:8,Y:5,Z:10,Æ:6,Ø:5,Å:4
};

export const VOWELS = "AEIOUYÆØÅ".split("");
export const CONSONANTS = "BDFGHJKLMNPRSTV".split("");
export const COMMON_PAIRS = ["ER","EN","ET","ST","NG","AR","OR","AN","IN","RE","LE","NE","DE","TE","SE","ME"];
export const ROWS = 10, COLS = 10, TOTAL = ROWS * COLS;
export const TILE = 26, GAP = 12;

// Norwegian special characters worth an extra reward on top of their letter value.
export const SPECIAL_CHARS = ["Æ", "Ø", "Å"];
export const SPECIAL_CHAR_BONUS = 3; // points per æ/ø/å in a word
// Length bonus added to the raw letter sum, indexed by word length.
// Lengths >= 8 use LONG_WORD_BONUS so longer words reliably outscore short ones.
export const LENGTH_BONUS = { 3: 0, 4: 2, 5: 5, 6: 9, 7: 14 };
export const LONG_WORD_BONUS = 20;
export const HIDDEN_WORD_BONUS = 10; // bonus for matching a hidden "bonus word"

// Seedable PRNG (mulberry32) so a given seed always produces the same sequence.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 32-bit hash of a string, used to turn a date into a PRNG seed.
export function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// The current puzzle day as a YYYY-MM-DD string in Europe/Oslo, so every player
// shares the same board and it rolls over at midnight Norwegian time.
export function osloDateKey(date = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Build the deterministic shared grid for a given puzzle day.
export function dailyGrid(dateKey = osloDateKey()) {
  return genGrid(mulberry32(hashStr(dateKey)));
}

export function shuffle(array, rng = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function genGrid(rng = Math.random) {
  const grid = new Array(TOTAL).fill(null);
  const protectedIndices = new Set();

  // Step 0: Inject up to 3 random bonus words
  const eligibleWords = BONUS_WORDS.filter(w => w.replace(/\s/g, "").length <= COLS);
  const selectedWords = [];
  
  if (eligibleWords.length > 0) {
    const indices = new Set();
    const maxSelect = Math.min(3, eligibleWords.length);
    let indexSafety = 0;
    while (indices.size < maxSelect && indexSafety < 100) {
      indexSafety++;
      indices.add(Math.floor(rng() * eligibleWords.length));
    }
    indices.forEach(idx => selectedWords.push(eligibleWords[idx].replace(/\s/g, "").toUpperCase()));
  }

  shuffle(selectedWords, rng);
  let placedCount = 0;
  
  for (const word of selectedWords) {
    if (placedCount >= 3) break;
    let wordPlaced = false;

    // Try to place the word in a straight line (Horizontal, Vertical, or Diagonal)
    for (let attempt = 0; attempt < 100; attempt++) {
      if (wordPlaced) break;

      const dr = Math.floor(rng() * 3) - 1; // -1, 0, 1
      const dc = Math.floor(rng() * 3) - 1; // -1, 0, 1
      if (dr === 0 && dc === 0) continue; // Avoid no movement

      const r = Math.floor(rng() * ROWS);
      const c = Math.floor(rng() * COLS);
      const endR = r + dr * (word.length - 1);
      const endC = c + dc * (word.length - 1);

      if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;

      const targetIndices = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const idx = (r + dr * i) * COLS + (c + dc * i);
        if (grid[idx] !== null || protectedIndices.has(idx)) { ok = false; break; }
        targetIndices.push(idx);
      }

      if (ok) {
        targetIndices.forEach((idx, i) => { grid[idx] = word[i]; protectedIndices.add(idx); });
        placedCount++;
        wordPlaced = true;
      }
    }
  }

  // Step 2: place common Norwegian pairs in random adjacent spots
  const pairCount = Math.floor(TOTAL / 7);
  const usedPairs = new Set();
  let attempts = 0;
  while (usedPairs.size < pairCount && attempts < 200) {
    attempts++;
    const pair = COMMON_PAIRS[Math.floor(rng() * COMMON_PAIRS.length)];
    const r = Math.floor(rng() * ROWS);
    const c = Math.floor(rng() * (COLS - 1));
    const i = r * COLS + c;
    const j = i + 1;
    const key = `${i}-${j}`;
    if (!usedPairs.has(key) && grid[i] === null && grid[j] === null) {
      grid[i] = pair[0];
      grid[j] = pair[1];
      usedPairs.add(key);
    }
  }

  // Step 3: Fill remaining with checkerboard of vowels and consonants
  const vowelPool = [];
  const consonantPool = [];
  while (vowelPool.length < TOTAL) vowelPool.push(...VOWELS);
  while (consonantPool.length < TOTAL) consonantPool.push(...CONSONANTS);
  shuffle(vowelPool, rng);
  shuffle(consonantPool, rng);

  let vi = 0, ci = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (grid[i] !== null) continue;
      grid[i] = (r + c) % 2 === 0 ? vowelPool[vi++] : consonantPool[ci++];
    }
  }

  // Step 4: guarantee at least 5 of each Norwegian char
  SPECIAL_CHARS.forEach(ch => {
    let count = grid.filter(l => l === ch).length;
    if (count >= 5) return;
    const candidates = [];
    grid.forEach((l, i) => {
      if (l && "AEIOU".includes(l) && !usedPairs.has(`${i}-${i + 1}`) && !protectedIndices.has(i)) candidates.push(i);
    });
    shuffle(candidates, rng);
    for (let i = 0; i < candidates.length && count < 5; i++) {
      grid[candidates[i]] = ch;
      count++;
    }
  });

  return grid;
}

export const cellCenter = (i) => ({
  x: (i % COLS) * (TILE + GAP) + TILE / 2,
  y: Math.floor(i / COLS) * (TILE + GAP) + TILE / 2,
});

export const cellFromPoint = (x, y) => {
  const step = TILE + GAP;
  const col = Math.floor(x / step);
  const row = Math.floor(y / step);
  
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;

  // Calculate center of the tile
  const cx = col * step + TILE / 2;
  const cy = row * step + TILE / 2;
  const dist = Math.hypot(x - cx, y - cy);

  // Only trigger if the pointer is within the letter's radius (with a small buffer)
  // This prevents accidentally "clipping" neighbors during diagonal drags.
  return dist < TILE * 0.8 ? row * COLS + col : -1;
};

export function adj(a, b) {
  if (a === b || a < 0 || b < 0) return false;
  const ar = Math.floor(a / COLS), ac = a % COLS;
  const br = Math.floor(b / COLS), bc = b % COLS;
  const rowDiff = Math.abs(ar - br);
  const colDiff = Math.abs(ac - bc);
  // Returns true if the cells are neighbors (Horizontal, Vertical, OR Diagonal)
  return rowDiff <= 1 && colDiff <= 1;
}

// Raw letter value of a word (rare letters like Æ/Ø/Å/W/Z already score high).
export function wordScore(word) {
  return word.split("").reduce((s, c) => s + (LETTER_SCORES[c] || 1), 0);
}

// Length component, escalating so longer words reliably beat short rare-letter ones.
export function lengthBonus(length) {
  if (length >= 8) return LONG_WORD_BONUS;
  return LENGTH_BONUS[length] || 0;
}

// Extra reward for the Norwegian special characters æ/ø/å.
export function specialBonus(word) {
  let n = 0;
  for (const ch of word.toUpperCase()) {
    if (SPECIAL_CHARS.includes(ch)) n++;
  }
  return n * SPECIAL_CHAR_BONUS;
}

// Bonus for matching one of the hidden "bonus words" (drives the bonus chime).
// Uses a 70% match ratio to allow Norwegian word forms (er/en/et)
// while preventing short words from getting undeserved bonus points.
export function calculateBonus(word) {
  const wordLower = word.toLowerCase();

  const hasBonusMatch = BONUS_WORDS.some(bw => {
    const bwLower = bw.toLowerCase();
    if (bwLower === wordLower) return true; // exact match always works

    // Must be a prefix/suffix (handles Norwegian word forms like -en, -er, -et)
    const isPrefix = wordLower.startsWith(bwLower) || bwLower.startsWith(wordLower);
    if (!isPrefix) return false;

    // Require the shorter word to be at least 70% of the longer word
    const shorter = Math.min(wordLower.length, bwLower.length);
    const longer = Math.max(wordLower.length, bwLower.length);
    const matchRatio = shorter / longer;

    return matchRatio >= 0.7;
  });

  return hasBonusMatch ? HIDDEN_WORD_BONUS : 0;
}

// Full score breakdown for a word: letters + length + special chars + hidden bonus.
export function scoreWord(word) {
  const letters = wordScore(word);
  const length = lengthBonus(word.length);
  const special = specialBonus(word);
  const hidden = calculateBonus(word);
  return {
    letters,
    length,
    special,
    hidden,
    total: letters + length + special + hidden,
    isHiddenBonus: hidden > 0,
  };
}

export async function validateWord(word) {
  try {
    const res = await fetch(`/api/validate?word=${encodeURIComponent(word)}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data && data.valid);
  } catch (err) {
    console.error("validateWord error:", err);
    return false;
  }
}

export function getSVGPoint(svg, e) {
  const pt = svg.createSVGPoint();
  // Handle both MouseEvents and TouchEvents
  const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  pt.x = touch.clientX;
  pt.y = touch.clientY;

  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
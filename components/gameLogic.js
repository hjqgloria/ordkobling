import BONUS_WORDS from "./bonus_words.json";

export const LETTER_SCORES = {
  A:1,B:4,C:10,D:1,E:1,F:4,G:3,H:3,I:1,J:4,K:2,L:1,
  M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:3,V:4,W:8,Y:5,Z:10,Æ:6,Ø:5,Å:4
};

export const VOWELS = "AEIOUYÆØÅ".split("");
export const CONSONANTS = "BDDFGHJKLMNPRSTV".split("");
export const COMMON_PAIRS = ["ER","EN","ET","ST","NG","AR","OR","AN","IN","RE","LE","NE","DE","TE","SE","ME"];
export const ROWS = 10, COLS = 10, TOTAL = ROWS * COLS;
export const TILE = 26, GAP = 12;

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function genGrid() {
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
      indices.add(Math.floor(Math.random() * eligibleWords.length));
    }
    indices.forEach(idx => selectedWords.push(eligibleWords[idx].replace(/\s/g, "").toUpperCase()));
  }

  shuffle(selectedWords);
  let placedCount = 0;
  
  for (const word of selectedWords) {
    if (placedCount >= 3) break;
    let wordPlaced = false;

    // Try to place the word in a straight line (Horizontal, Vertical, or Diagonal)
    for (let attempt = 0; attempt < 100; attempt++) {
      if (wordPlaced) break;

      const dr = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      const dc = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      if (dr === 0 && dc === 0) continue; // Avoid no movement

      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
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

  // Step 1: place common Norwegian pairs in random adjacent spots
  const pairCount = Math.floor(TOTAL / 7);
  const usedPairs = new Set();
  let attempts = 0;
  while (usedPairs.size < pairCount && attempts < 200) {
    attempts++;
    const pair = COMMON_PAIRS[Math.floor(Math.random() * COMMON_PAIRS.length)];
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * (COLS - 1));
    const i = r * COLS + c;
    const j = i + 1;
    const key = `${i}-${j}`;
    if (!usedPairs.has(key) && grid[i] === null && grid[j] === null) {
      grid[i] = pair[0];
      grid[j] = pair[1];
      usedPairs.add(key);
    }
  }

  // Step 1: Fill remaining with checkerboard of vowels and consonants
  const vowelPool = [];
  const consonantPool = [];
  while (vowelPool.length < TOTAL) vowelPool.push(...VOWELS);
  while (consonantPool.length < TOTAL) consonantPool.push(...CONSONANTS);
  shuffle(vowelPool);
  shuffle(consonantPool);

  let vi = 0, ci = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (grid[i] !== null) continue;
      grid[i] = (r + c) % 2 === 0 ? vowelPool[vi++] : consonantPool[ci++];
    }
  }

  // Step 3: guarantee at least 5 of each Norwegian char
  ["Æ", "Ø", "Å"].forEach(ch => {
    let count = grid.filter(l => l === ch).length;
    if (count >= 5) return;
    const candidates = [];
    grid.forEach((l, i) => {
      if (l && "AEIOU".includes(l) && !usedPairs.has(`${i}-${i + 1}`) && !protectedIndices.has(i)) candidates.push(i);
    });
    shuffle(candidates);
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

export function wordScore(word) {
  return word.split("").reduce((s, c) => s + (LETTER_SCORES[c] || 1), 0);
}

export function calculateBonus(word) {
  const isHidden = BONUS_WORDS.includes(word.toUpperCase());
  return (word.length >= 8 ? 5 : 0) + (isHidden ? 10 : 0);
}

export async function validateWord(word) {
  const res = await fetch(`/api/validate?word=${encodeURIComponent(word)}`);
  const data = await res.json();
  return data.valid;
}

export function getSVGPoint(svg, e) {
  const pt = svg.createSVGPoint();
  // Handle both MouseEvents and TouchEvents
  const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  pt.x = touch.clientX;
  pt.y = touch.clientY;

  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import BONUS_WORDS from "./bonus_words.json";

const LETTER_SCORES = {
  A:1,B:4,C:10,D:1,E:1,F:4,G:3,H:3,I:1,J:4,K:2,L:1,
  M:2,N:1,O:2,P:4,R:1,S:1,T:1,U:3,V:4,W:8,Y:5,Z:10,Æ:6,Ø:5,Å:4
};

const VOWELS = "AEIOUYÆØÅ".split("");
const CONSONANTS = "BDDFGHJKLMNPRSTV".split("");
const COMMON_PAIRS = ["ER","EN","ET","ST","NG","AR","OR","AN","IN","RE","LE","NE","DE","TE","SE","ME"];
const ROWS = 10, COLS = 10, TOTAL = ROWS * COLS;
const TILE = 26, GAP = 12;

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
    const horizontal = Math.random() > 0.5;
    const maxR = horizontal ? ROWS : Math.max(1, ROWS - word.length);
    const maxC = horizontal ? Math.max(1, COLS - word.length) : COLS;
    const r = Math.floor(Math.random() * maxR);
    const c = Math.floor(Math.random() * maxC);
    
    // Check if space is clear
    let canPlace = true;
    for (let i = 0; i < word.length; i++) {
      const idx = horizontal ? (r * COLS + (c + i)) : ((r + i) * COLS + c);
      if (grid[idx] !== null) { canPlace = false; break; }
    }

    if (canPlace) {
      for (let i = 0; i < word.length; i++) {
        const idx = horizontal ? (r * COLS + (c + i)) : ((r + i) * COLS + c);
        grid[idx] = word[i];
        protectedIndices.add(idx);
      }
      placedCount++;
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

  // Step 2: place common Norwegian pairs in random adjacent spots
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

const cellCenter = (i) => ({
  x: (i % COLS) * (TILE + GAP) + TILE / 2,
  y: Math.floor(i / COLS) * (TILE + GAP) + TILE / 2,
});

const cellFromPoint = (x, y) => {
  const c = Math.floor(x / (TILE + GAP));
  const r = Math.floor(y / (TILE + GAP));
  return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? r * COLS + c : -1;
};

export function adj(a, b) {
  const ar = Math.floor(a/COLS), ac = a%COLS;
  const br = Math.floor(b/COLS), bc = b%COLS;
  return Math.abs(ar-br) <= 1 && Math.abs(ac-bc) <= 1 && a !== b;
}

export function wordScore(word) {
  return word.split("").reduce((s, c) => s + (LETTER_SCORES[c] || 1), 0);
}

export function calculateBonus(word) {
  const isHidden = BONUS_WORDS.includes(word.toUpperCase());
  return (word.length >= 8 ? 5 : 0) + (isHidden ? 10 : 0);
}

async function validateWord(word) {
  const res = await fetch(`/api/validate?word=${encodeURIComponent(word)}`);
  const data = await res.json();
  return data.valid;
}

export default function WordGame() {
  const [grid, setGrid] = useState(() => genGrid());
  const [path, setPath] = useState([]);
  const [found, setFound] = useState([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [phase, setPhase] = useState("start");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok");
  const [checking, setChecking] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [tada, setTada] = useState(null);
  const dragging = useRef(false);
  const svgRef = useRef(null);
  const msgTimer = useRef(null);
  const validationCache = useRef({});

  useEffect(() => {
    const saved = localStorage.getItem("ordkobling-best");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("ordkobling-best", score.toString());
    }
  }, [score, highScore]);

  useEffect(() => {
    if (phase !== "play") return;
    if (timeLeft <= 0) { setPhase("over"); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  const showMsg = (text, type = "ok") => {
    clearTimeout(msgTimer.current);
    setMsg(text); setMsgType(type);
    msgTimer.current = setTimeout(() => setMsg(""), 2000);
  };

  const word = path.map(i => grid[i]).join("");

  const submitWord = useCallback(async (w) => {
    if (w.length < 3) return;

    if (found.find(f => f.word === w)) {
      showMsg("Allerede funnet!", "warn");
      return;
    }

    // Check client-side cache first for instant results
    if (validationCache.current[w] !== undefined) {
      handleValidationResult(w, validationCache.current[w]);
      return;
    }

    setChecking(true);
    try {
      const ok = await validateWord(w.toLowerCase());
      validationCache.current[w] = ok;
      handleValidationResult(w, ok);
    } catch {
      showMsg("Feil – prøv igjen", "bad");
    }
    setChecking(false);
  }, [grid, found]);

  const handleValidationResult = (w, ok) => {
    if (ok) {
      const baseScore = wordScore(w);
      const s = baseScore + calculateBonus(w);
      setFound(prev => [...prev, { word: w, score: s }]);
      setScore(prev => prev + s);

      if (w.length > 10) {
        setTada(w);
        setTimeout(() => setTada(null), 3000);
      }
      showMsg(w.length >= 8 ? `BONUSORD! +${s} poeng! ★` : `+${s} poeng! ✓`, "ok");
    } else {
      showMsg(`"${w}" er ikke et ord`, "bad");
    }
  };

  const getSVGPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * (svg.viewBox.baseVal.width / rect.width),
      y: (touch.clientY - rect.top) * (svg.viewBox.baseVal.height / rect.height),
    };
  };

  const onStart = (e) => {
    if (phase !== "play" || checking) return;
    e.preventDefault();
    const p = getSVGPoint(e);
    const { x, y } = p;
    const idx = cellFromPoint(x, y);
    if (idx < 0) return;
    dragging.current = true;
    const center = cellCenter(idx);
    const dist = Math.hypot(x - center.x, y - center.y);
    if (dist < (TILE + GAP) * 0.6) {
      setPath([idx]);
      setPointerPos(p);
    }
  };

  const onMove = (e) => {
    if (!dragging.current || checking) return;
    e.preventDefault();
    const p = getSVGPoint(e);
    const { x, y } = p;
    setPointerPos(p);

    setPath(prev => {
      if (prev.length === 0) return prev;
      const lastIdx = prev[prev.length - 1];
      const threshold = (TILE + GAP) * 0.45;

      // Check for backtracking
      if (prev.length > 1) {
        const secondLast = prev[prev.length - 2];
        const center = cellCenter(secondLast);
        if (Math.hypot(x - center.x, y - center.y) < threshold) return prev.slice(0, -1);
      }

      // Magnetic Snap: Look at all 8 neighbors of the last cell
      const r = Math.floor(lastIdx / COLS), c = lastIdx % COLS;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            const nIdx = nr * COLS + nc;
            if (prev.includes(nIdx)) continue;
            const center = cellCenter(nIdx);
            if (Math.hypot(x - center.x, y - center.y) < threshold) return [...prev, nIdx];
          }
        }
      }
      return prev;
    });
  };

  const onEnd = () => {
    if (!dragging.current) return;
    const finalWord = word; // Captured from the derived 'word' variable
    dragging.current = false;
    setPath([]);
    setPointerPos(null);
    if (finalWord.length >= 3) {
      submitWord(finalWord);
    }
  };

  const W = COLS * (TILE + GAP) - GAP; // 368
  const H = ROWS * (TILE + GAP) - GAP; // 368

  const startGame = (newGrid = false) => {
    setScore(0);
    if (newGrid) setGrid(genGrid());
    setPath([]); setFound([]); setTimeLeft(120);
    setMsg(""); setPhase("play");
  };

  const btnClass = "bg-paper text-ink rounded-full px-7 py-3 text-[15px] font-bold transition-transform active:scale-95 cursor-pointer";
  const btnSecondaryClass = "bg-transparent text-[#888] border border-[#444] rounded-full px-5 py-3 text-[13px] transition-colors hover:bg-white/5 cursor-pointer";

  return (
    <div className="overflow-y-auto bg-ink min-h-screen flex flex-col items-center p-3 pb-10 font-sans select-none">

      <h1 className="text-paper text-xl font-bold mb-2 tracking-widest">
        ORDKOBLING
      </h1>

      {phase === "start" && (
        <div className="bg-[#1e1e1e] rounded-2xl p-6 max-w-[340px] text-center text-[#ccc] mt-4">
          <p className="text-[15px] leading-relaxed mb-2.5">
            Koble bokstavene ved å dra linjer – på kryss og tvers. Finn lange bonusord for ekstra poeng!
          </p>
          <p className="text-[13px] text-[#888] mb-5">
            Minst 3 bokstaver · 8+ bokstaver gir bonus · 2 minutter
          </p>
          <button onClick={() => startGame(false)} className={btnClass}>Start spill</button>
        </div>
      )}

      {phase === "over" && (
        <div className="bg-[#1e1e1e] rounded-2xl p-6 max-w-[340px] text-center text-[#ccc] mt-4">
          <p className="text-2xl font-bold text-paper mb-1">Tid ute!</p>
          <p className="text-[34px] font-extrabold text-bonus mb-2">{score} poeng</p>
          {score >= highScore && score > 0 && <p className="text-[#fbbf24] text-xs font-bold -mt-2 mb-2">NY REKORD!</p>}
          <p className="text-sm text-[#888] mb-3.5">{found.length} ord funnet</p>
          {found.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto text-left">
              {[...found].sort((a, b) => b.score - a.score || b.word.length - a.word.length).map((f, i) => (
                <span key={i} className="inline-block bg-[#2a2a2a] rounded-lg px-2.5 py-1 m-1 text-xs text-paper">
                  {f.word} <span className="text-bonus">({f.score})</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2.5 justify-center">
            <button onClick={() => startGame(false)} className={btnClass}>Spill igjen</button>
            <button onClick={() => startGame(true)} className={btnSecondaryClass}>Nytt rutenett</button>
          </div>
        </div>
      )}

      {phase === "play" && (<>
        <div className="w-full flex justify-between items-center mb-1.5 max-w-[368px]">
          <div className="text-paper text-xl font-bold">
            {score} <span className="text-xs text-[#888] font-normal">poeng</span>
            <div className="text-[10px] text-[#fbbf24] font-normal -mt-0.5">BEST: {highScore}</div>
          </div>
          <div className="h-8 flex items-center justify-center flex-1 px-2">
            {checking ? <span className="text-[#888] text-[13px]">Sjekker...</span>
              : msg ? <span className={`text-sm font-semibold ${msgType === "ok" ? "text-bonus" : msgType === "warn" ? "text-amber-400" : "text-red-400"}`}>{msg}</span>
              : word.length > 0 ? <span className="text-paper text-lg font-bold tracking-widest">{word}</span>
              : <span className="text-[#555] text-xs">Dra for å lage ord</span>}
          </div>
          <span className={`text-xl font-bold ${timeLeft > 40 ? "text-bonus" : timeLeft > 15 ? "text-amber-400" : "text-red-400"}`}>{timeLeft}s</span>
        </div>

        <div className="bg-black rounded-xl p-1.5 touch-none relative">
          {tada && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 rounded-xl pointer-events-none">
              <div className="text-6xl mb-2.5">🎉</div>
              <div className="text-[#fbbf24] text-[28px] font-black text-center drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
                FANTASTISK!<br/>{tada}
              </div>
            </div>
          )}
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H}
            onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
            onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
            className={`block ${checking ? "cursor-wait" : "cursor-default"}`}>

            {path.length > 1 && path.slice(0, -1).map((idx, i) => {
              const a = cellCenter(idx), b = cellCenter(path[i + 1]);
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-[#f59e0b] stroke-[4.5] stroke-round opacity-90" />;
            })}

            {dragging.current && path.length > 0 && pointerPos && (
              <line x1={cellCenter(path[path.length - 1]).x} y1={cellCenter(path[path.length - 1]).y}
                x2={pointerPos.x} y2={pointerPos.y}
                className="stroke-[#f59e0b] stroke-[3] [stroke-dasharray:4_2] opacity-60" />
            )}

            {grid.map((letter, i) => {
              const x = (i % COLS) * (TILE + GAP), y = Math.floor(i / COLS) * (TILE + GAP);
              const inPath = path.includes(i), isLast = path[path.length - 1] === i;
              const canConnect = !inPath && path.length > 0 && adj(path[path.length - 1], i) && dragging.current;
              return (
                <g key={i} transform={`translate(${x},${y})`}>
                  <rect width={TILE} height={TILE} rx={8} className={`stroke-1 ${
                    isLast ? "fill-[#f59e0b] stroke-black" : 
                    inPath ? "fill-[#fbbf24] stroke-[#444]" : 
                    canConnect ? "fill-[#d1d5db] stroke-transparent" : "fill-paper stroke-transparent"
                  }`} />
                  <text x={TILE/2} y={TILE/2+1} textAnchor="middle" dominantBaseline="central"
                    className="text-[16px] font-extrabold fill-black font-sans">{letter}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="w-full mt-2 max-w-[368px]">
          <div className="text-[#555] text-[11px] mb-1">{found.length} ord funnet</div>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {found.map((f, i) => (
              <span key={i} className="bg-[#1e1e1e] border border-[#333] rounded-[20px] px-2 py-0.5 text-[11px] text-[#ccc]">
                {f.word} <span className="text-bonus">{f.score}</span>
              </span>
            ))}
          </div>
        </div>
      </>)}

      <footer className="mt-auto pt-10 text-center">
        <p className="text-[11px] text-[#555] max-w-[280px] leading-relaxed">
          Ordboksdata er levert av Universitetet i Bergen og Språkrådet.
        </p>
      </footer>
    </div>
  );
}
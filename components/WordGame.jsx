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

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function genGrid() {
  const grid = new Array(TOTAL).fill(null);

  // 1. Lag et grunnleggende rutenett med vokaler og konsonanter (checkerboard)
  const vowelPool = [];
  const consonantPool = [];
  while (vowelPool.length < TOTAL) vowelPool.push(...VOWELS);
  while (consonantPool.length < TOTAL) consonantPool.push(...CONSONANTS);
  shuffle(vowelPool);
  shuffle(consonantPool);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r * COLS + c] = (r + c) % 2 === 0 ? vowelPool.pop() : consonantPool.pop();
    }
  }

  // 2. Erstatt tilfeldige vokaler med Æ, Ø, Å for å sikre norske tegn
  ["Æ", "Ø", "Å"].forEach(ch => {
    const vowelIndices = [];
    grid.forEach((l, i) => { if ("AEIOU".includes(l)) vowelIndices.push(i); });
    shuffle(vowelIndices);
    for (let i = 0; i < 5 && i < vowelIndices.length; i++) {
      grid[vowelIndices[i]] = ch;
    }
  });

  // 3. Velg ut 3 bonusord og overskriv rutenettet med disse
  const protectedIndices = new Set();
  const wordsToPlace = [];
  const bIndices = new Set();
  while (bIndices.size < 3 && bIndices.size < BONUS_WORDS.length) {
    bIndices.add(Math.floor(Math.random() * BONUS_WORDS.length));
  }
  bIndices.forEach(idx => wordsToPlace.push(BONUS_WORDS[idx].trim().toUpperCase()));

  wordsToPlace.forEach(word => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const horizontal = Math.random() > 0.5;
      const r = Math.floor(Math.random() * (horizontal ? ROWS : ROWS - word.length + 1));
      const c = Math.floor(Math.random() * (horizontal ? COLS - word.length + 1 : COLS));
      
      const targetIndices = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const idx = horizontal ? (r * COLS + (c + i)) : ((r + i) * COLS + c);
        // Sjekk at vi ikke overskriver et annet bonusord
        if (protectedIndices.has(idx)) { ok = false; break; }
        targetIndices.push(idx);
      }

      if (ok) {
        targetIndices.forEach((idx, i) => {
          grid[idx] = word[i];
          protectedIndices.add(idx);
        });
        break; // Ordet er plassert, gå til neste ord
      }
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

function adj(a, b) {
  const ar = Math.floor(a/COLS), ac = a%COLS;
  const br = Math.floor(b/COLS), bc = b%COLS;
  return Math.abs(ar-br) <= 1 && Math.abs(ac-bc) <= 1 && a !== b;
}

function wordScore(word) {
  return word.split("").reduce((s, c) => s + (LETTER_SCORES[c] || 1), 0);
}

async function validateWord(word) {
  const res = await fetch(`/api/validate?word=${encodeURIComponent(word)}`);
  const data = await res.json();
  return data.valid;
}

export default function WordGame() {
  const [grid, setGrid] = useState(genGrid);
  const [path, setPath] = useState([]);
  const [found, setFound] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [phase, setPhase] = useState("start");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok");
  const [checking, setChecking] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const dragging = useRef(false);
  const svgRef = useRef(null);
  const msgTimer = useRef(null);

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

  const submitWord = useCallback(async (p) => {
    const w = p.map(i => grid[i]).join("");
    if (w.length < 3) return;
    
    if (found.find(f => f.word === w)) {
      showMsg("Allerede funnet!", "warn");
      return;
    }

    setChecking(true);
    try {
      const ok = await validateWord(w.toLowerCase());
      if (ok) {
        const s = wordScore(w);
        setFound(prev => [...prev, { word: w, score: s }]);
        setScore(prev => prev + s);
        showMsg(w.length >= 8 ? `BONUSORD! +${s} poeng! ★` : `+${s} poeng! ✓`, "ok");
      } else {
        showMsg(`"${w}" er ikke et ord`, "bad");
      }
    } catch {
      showMsg("Feil – prøv igjen", "bad");
    }
    setChecking(false);
  }, [grid, found]);

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
    
    // Synchronously reset state to prevent double-submission from overlapping events
    const finalPath = path.slice();
    dragging.current = false;
    setPath([]);
    setPointerPos(null);

    if (finalPath.length >= 3) {
      submitWord(finalPath);
    }
  };

  const W = COLS * (TILE + GAP) - GAP;
  const H = ROWS * (TILE + GAP) - GAP;
  const msgColor = msgType === "ok" ? "#4ade80" : msgType === "warn" ? "#fbbf24" : "#f87171";
  const timerColor = timeLeft > 40 ? "#4ade80" : timeLeft > 15 ? "#fbbf24" : "#f87171";

  const startGame = (newGrid = false) => {
    if (newGrid) setGrid(genGrid());
    setPath([]); setFound([]); setScore(0); setTimeLeft(120);
    setMsg(""); setPhase("play");
  };

  const btnStyle = {
    background: "#f5f0dc", color: "#111", border: "none",
    borderRadius: 50, padding: "12px 28px", fontSize: 15,
    fontWeight: 700, cursor: "pointer",
  };
  const btn2Style = {
    background: "transparent", color: "#888", border: "1px solid #444",
    borderRadius: 50, padding: "12px 20px", fontSize: 13, cursor: "pointer",
  };

  return (
    <div style={{ overflowY:"auto", background:"#111", minHeight:"100vh", display:"flex",
      flexDirection:"column", alignItems:"center", padding:"12px 8px 40px",
      fontFamily:"system-ui,sans-serif", userSelect:"none" }}>

      <h1 style={{ color:"#f5f0dc", fontSize:20, fontWeight:700, margin:"0 0 8px", letterSpacing:1 }}>
        ORDKOBLING
      </h1>

      {phase === "start" && (
        <div style={{ background:"#1e1e1e", borderRadius:16, padding:24,
          maxWidth:340, textAlign:"center", color:"#ccc", marginTop:16 }}>
          <p style={{ fontSize:15, lineHeight:1.6, margin:"0 0 10px" }}>
            Koble bokstavene ved å dra linjer – på kryss og tvers. Finn lange bonusord for ekstra poeng!
          </p>
          <p style={{ fontSize:13, color:"#888", margin:"0 0 20px" }}>
            Minst 3 bokstaver · 8+ bokstaver gir bonus · 2 minutter
          </p>
          <button onClick={() => startGame(false)} style={btnStyle}>Start spill</button>
        </div>
      )}

      {phase === "over" && (
        <div style={{ background:"#1e1e1e", borderRadius:16, padding:24,
          maxWidth:340, textAlign:"center", color:"#ccc", marginTop:16 }}>
          <p style={{ fontSize:26, fontWeight:700, color:"#f5f0dc", margin:"0 0 4px" }}>Tid ute!</p>
          <p style={{ fontSize:34, fontWeight:800, color:"#4ade80", margin:"0 0 8px" }}>{score} poeng</p>
          <p style={{ fontSize:14, color:"#888", margin:"0 0 14px" }}>{found.length} ord funnet</p>
          {found.length > 0 && (
            <div style={{ marginBottom:16, maxHeight:160, overflowY:"auto", textAlign:"left" }}>
              {found.map((f, i) => (
                <span key={i} style={{ display:"inline-block", background:"#2a2a2a",
                  borderRadius:8, padding:"3px 10px", margin:"3px", fontSize:12, color:"#f5f0dc" }}>
                  {f.word} <span style={{ color:"#4ade80" }}>({f.score})</span>
                </span>
              ))}
            </div>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={() => startGame(false)} style={btnStyle}>Spill igjen</button>
            <button onClick={() => startGame(true)} style={btn2Style}>Nytt rutenett</button>
          </div>
        </div>
      )}

      {phase === "play" && (<>
        <div style={{ width:"100%", maxWidth:W, display:"flex",
          justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <div style={{ color:"#f5f0dc", fontSize:20, fontWeight:700 }}>
            {score} <span style={{ fontSize:12, color:"#888", fontWeight:400 }}>poeng</span>
          </div>
          <div style={{ height:32, display:"flex", alignItems:"center",
            justifyContent:"center", flex:1, padding:"0 8px" }}>
            {checking ? <span style={{ color:"#888", fontSize:13 }}>Sjekker...</span>
              : msg ? <span style={{ color:msgColor, fontSize:14, fontWeight:600 }}>{msg}</span>
              : word.length > 0 ? <span style={{ color:"#f5f0dc", fontSize:18, fontWeight:700, letterSpacing:2 }}>{word}</span>
              : <span style={{ color:"#555", fontSize:12 }}>Dra for å lage ord</span>}
          </div>
          <span style={{ fontSize:20, fontWeight:700, color:timerColor }}>{timeLeft}s</span>
        </div>

        <div style={{ background:"#000", borderRadius:10, padding:6, touchAction:"none" }}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H}
            onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
            onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
            style={{ display:"block", cursor:checking ? "wait" : "default" }}>

            {path.length > 1 && path.slice(0, -1).map((idx, i) => {
              const a = cellCenter(idx), b = cellCenter(path[i + 1]);
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#f59e0b" strokeWidth={4.5} strokeLinecap="round" opacity={0.9} />;
            })}

            {dragging.current && path.length > 0 && pointerPos && (
              <line x1={cellCenter(path[path.length - 1]).x} y1={cellCenter(path[path.length - 1]).y}
                x2={pointerPos.x} y2={pointerPos.y}
                stroke="#f59e0b" strokeWidth={3} strokeDasharray="4 2" opacity={0.6} />
            )}

            {grid.map((letter, i) => {
              const x = (i % COLS) * (TILE + GAP), y = Math.floor(i / COLS) * (TILE + GAP);
              const inPath = path.includes(i), isLast = path[path.length - 1] === i;
              const canConnect = !inPath && path.length > 0 && adj(path[path.length - 1], i) && dragging.current;
              return (
                <g key={i} transform={`translate(${x},${y})`}>
                  <rect width={TILE} height={TILE} rx={8}
                    fill={isLast ? "#f59e0b" : inPath ? "#fbbf24" : canConnect ? "#d1d5db" : "#f5f0dc"}
                    stroke={isLast ? "#000" : inPath ? "#444" : "transparent"}
                    strokeWidth={1} />
                  <text x={TILE/2} y={TILE/2+1} textAnchor="middle" dominantBaseline="central"
                    fontSize={16} fontWeight={800} fill="#000"
                    fontFamily="system-ui,sans-serif">{letter}</text>
                  <text x={TILE-5} y={TILE-4} textAnchor="middle" dominantBaseline="auto"
                    fontSize={7} fill="#555">{LETTER_SCORES[letter] || 1}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ width:"100%", maxWidth:W, marginTop:8 }}>
          <div style={{ color:"#555", fontSize:11, marginBottom:4 }}>{found.length} ord funnet</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, maxHeight:160, overflowY:"auto" }}>
            {found.map((f, i) => (
              <span key={i} style={{ background:"#1e1e1e", border:"1px solid #333",
                borderRadius:20, padding:"2px 8px", fontSize:11, color:"#ccc" }}>
                {f.word} <span style={{ color:"#4ade80" }}>{f.score}</span>
              </span>
            ))}
          </div>
        </div>
      </>)}
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from "react";
import { dailyGrid, scoreWord, validateWord, adj, cellFromPoint, getSVGPoint, osloDateKey } from "./gameLogic";

export function useGameState() {
  const [grid, setGrid] = useState([]);
  const [path, setPath] = useState([]);
  const [found, setFound] = useState([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [dailyLeaderboard, setDailyLeaderboard] = useState([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState([]);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState("start");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok");
  const [checking, setChecking] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);
  const [tada, setTada] = useState(null);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [mounted, setMounted] = useState(false);
  const foundWordSound = useRef(null);
  const invalidWordSound = useRef(null);
  const tadaSound = useRef(null);
  const bonusSound = useRef(null);
  const gameFinishSound = useRef(null);
  const dragging = useRef(false);
  const svgRef = useRef(null);
  const msgTimer = useRef(null);
  const validationCache = useRef(new Map());
  const hasUnlockedAudio = useRef(false);

  const playSound = useCallback((audioRef) => {
    if (!isSoundOn || !audioRef.current) return;
    try {
      const sound = audioRef.current.cloneNode();
      sound.currentTime = 0;
      sound.play().catch((err) => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((e) => console.warn("Audio playback blocked:", e));
        }
      });
    } catch (e) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => console.warn("Audio playback blocked:", err));
      }
    }
  }, [isSoundOn]);

  useEffect(() => {
    setMounted(true);
    setGrid(dailyGrid());
    // The local "REKORD" is the best on TODAY'S board only — it resets at Oslo
    // midnight. We store { date, score } and ignore it once the day rolls over.
    const saved = localStorage.getItem("ordkobling-best");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.date === osloDateKey() && Number.isFinite(parsed.score)) {
          setHighScore(parsed.score);
        }
      } catch {
        // Old/invalid format — start fresh for today.
      }
    }
    const savedName = localStorage.getItem("ordkobling-player-name");
    if (savedName) setPlayerName(savedName);
  }, []);

  useEffect(() => {
    // Initialize Audio objects once when component mounts
    foundWordSound.current = new Audio('/sounds/word_found.mp3');
    invalidWordSound.current = new Audio('/sounds/invalid_word.mp3');
    tadaSound.current = new Audio('/sounds/tada.mp3');
    bonusSound.current = new Audio('/sounds/bonus_pling.mp3');
    gameFinishSound.current = new Audio('/sounds/game_finish.mp3');
  }, []);

  useEffect(() => {
    if (phase !== "play") return;
    if (timeLeft <= 0) {
      setPhase("over");
      // Check for new record at the end of the game
      if (score > highScore && score > 0) {
        setIsNewRecord(true);
        localStorage.setItem("ordkobling-best", JSON.stringify({ date: osloDateKey(), score }));
        // Delay updating the record line state to show the transition
        setTimeout(() => {
          setHighScore(score);
        }, 1500);
      }
      dragging.current = false;
      playSound(gameFinishSound);
      return;
    }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, isSoundOn, score, highScore]);

  const showMsg = useCallback((text, type = "ok") => {
    clearTimeout(msgTimer.current);
    setMsg(text); setMsgType(type);
    msgTimer.current = setTimeout(() => setMsg(""), 2000);
  }, []); // No dependencies as msgTimer.current is a ref and setMsg/setMsgType are stable setters

  const word = path.map(i => grid[i]).join("");

  const handleValidationResult = useCallback((w, ok) => {
    if (ok) {
      const { total: totalScore, isHiddenBonus } = scoreWord(w);
      const isLong = w.length >= 8;
      setFound(prev => [...prev, { word: w, score: totalScore, bonus: isHiddenBonus }]);
      setScore(s => s + totalScore);
      setPath([]);
      if (isHiddenBonus || isLong) {
        playSound(bonusSound);
      } else {
        playSound(foundWordSound);
      }
      if (isLong) {
        setTada(w);
        playSound(tadaSound);
        setTimeout(() => setTada(null), 3000);
      }
      const label = isLong ? "BONUSORD! " : isHiddenBonus ? "SKJULT ORD! " : "";
      showMsg(`${label}+${totalScore} poeng! ${isLong || isHiddenBonus ? "★" : "✓"}`, "ok");
    } else {
      setPath([]);
      playSound(invalidWordSound);
      showMsg(`"${w}" er ikke et ord`, "bad");
    }
  }, [showMsg, playSound]);

  const submitWord = useCallback(async (w) => {
    if (w.length < 3) return;

    if (found.find(f => f.word === w)) {
      showMsg("Allerede funnet!", "warn");
      playSound(invalidWordSound);
      setPath([]);
      return;
    }

    // Check client-side cache first for instant results
    if (validationCache.current.has(w)) {
      handleValidationResult(w, validationCache.current.get(w));
      return;
    }

    setChecking(true);
    try {
      const ok = await validateWord(w.toLowerCase());
      validationCache.current.set(w, ok);
      if (validationCache.current.size > 500) {
        validationCache.current.delete(validationCache.current.keys().next().value);
      }
      handleValidationResult(w, ok);
    } catch {
      showMsg("Feil – prøv igjen", "bad");
    }
    setChecking(false);
  }, [found, handleValidationResult, playSound]);

  const startGame = () => {
    setScore(0);
    setIsNewRecord(false);
    setSubmitted(false);
    // The grid is the shared daily board, so it stays the same across replays.
    setPath([]); setFound([]); setTimeLeft(120);
    setMsg(""); setPhase("play");
    setPointerPos(null);
    dragging.current = false;
  };

  const onStart = () => startGame();

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setDailyLeaderboard(data.daily || []);
      setAllTimeLeaderboard(data.allTime || []);
    } catch (e) {
      console.error('Failed to load leaderboard', e);
      setDailyLeaderboard([]);
      setAllTimeLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchLeaderboard();
  }, [mounted, fetchLeaderboard]);

  // Keep the local REKORD in sync with the player's best on TODAY'S server
  // board, so a returning player isn't falsely told a lower score is a new
  // record. Runs while the board/name are known (i.e. before a game ends).
  useEffect(() => {
    const me = playerName.trim().toLowerCase();
    if (!me) return;
    const mine = dailyLeaderboard.find(e => String(e.name).toLowerCase() === me);
    if (mine && Number.isFinite(mine.score)) {
      setHighScore(prev => Math.max(prev, mine.score));
    }
  }, [dailyLeaderboard, playerName]);

  const submitToLeaderboard = async (name) => {
    const resolvedName = (name || playerName || "").trim();
    if (!resolvedName || score <= 0) return;

    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        body: JSON.stringify({ name: resolvedName, score }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Submit failed');
      setPlayerName(resolvedName);
      localStorage.setItem("ordkobling-player-name", resolvedName);
      setSubmitted(true); // Hide the input after submission
      fetchLeaderboard();
    } catch (e) {
      console.error("Submission failed", e);
      showMsg('Kunne ikke sende topplisten', 'bad');
    }
  };

  const onPointerDown = (e) => {
    if (phase !== "play") return;
    if (e.cancelable) e.preventDefault();

    // iOS Audio Unlock: Play and immediately pause all sounds on the first user interaction.
    // This "blesses" the audio objects so they can be played later, even in async callbacks.
    if (!hasUnlockedAudio.current) {
      [foundWordSound, invalidWordSound, tadaSound, bonusSound, gameFinishSound].forEach(ref => {
        if (ref.current) {
          ref.current.play().then(() => {
            ref.current.pause();
            ref.current.currentTime = 0;
          }).catch(() => {});
        }
      });
      hasUnlockedAudio.current = true;
    }

    const svg = svgRef.current;
    if (!svg) return;
    const pt = getSVGPoint(svg, e);
    const idx = cellFromPoint(pt.x, pt.y);
    if (idx >= 0) {
      dragging.current = true;
      setPath([idx]);
      setPointerPos(pt);
    }
  };

  // Update the path for a cell the pointer moved over. Extracted from
  // onPointerMove so the path logic can be unit-tested without an SVG event.
  const onMove = useCallback((idx) => {
    // Ignore if out of bounds or same as the current last cell in path
    if (idx < 0 || idx === path[path.length - 1]) return;

    if (path.includes(idx)) {
      const existing = path.indexOf(idx);
      // Allow backtracking to shorten the path
      setPath(path.slice(0, existing + 1));
      return;
    }

    if (path.length > 0 && !adj(path[path.length - 1], idx)) return;
    setPath([...path, idx]);
  }, [path]);

  const onPointerMove = (e) => {
    if (!dragging.current || phase !== "play") return;
    if (e.cancelable) e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = getSVGPoint(svg, e);
    setPointerPos(pt);
    onMove(cellFromPoint(pt.x, pt.y));
  };

  const onPointerUp = (e) => {
    if (phase !== "play") return;
    if (e && e.cancelable) e.preventDefault();
    dragging.current = false;
    if (path.length >= 3) submitWord(word);
    else setPath([]);
  };

  const onToggleSound = () => {
    setIsSoundOn(!isSoundOn);
  };

  return {
    grid,
    path,
    setPath,
    found,
    score,
    highScore,
    playerName,
    setPlayerName,
    dailyLeaderboard,
    allTimeLeaderboard,
    isNewRecord,
    submitted,
    timeLeft,
    phase,
    setPhase,
    msg,
    msgType,
    checking,
    pointerPos,
    setPointerPos,
    tada,
    setTada,
    isSoundOn,
    mounted,
    foundWordSound,
    invalidWordSound,
    tadaSound,
    bonusSound,
    gameFinishSound,
    dragging,
    svgRef,
    msgTimer,
    validationCache,
    showMsg,
    word,
    submitToLeaderboard,
    submitWord,
    handleValidationResult,
    onStart,
    onPointerDown,
    onPointerMove,
    onMove,
    onPointerUp,
    onToggleSound,
    startGame
  };
}
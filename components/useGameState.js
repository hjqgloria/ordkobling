import { useState, useEffect, useRef, useCallback } from "react";
import { genGrid, wordScore, calculateBonus, validateWord, adj, cellFromPoint, getSVGPoint } from "./gameLogic";

export function useGameState() {
  const [grid, setGrid] = useState([]);
  const [path, setPath] = useState([]);
  const [found, setFound] = useState([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isNewRecord, setIsNewRecord] = useState(false);
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
    // Resetting currentTime is crucial for iOS to restart the sound immediately
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => {
      console.warn("Audio playback blocked or failed:", err);
    });
  }, [isSoundOn]);

  useEffect(() => {
    setMounted(true);
    setGrid(genGrid());
    const saved = localStorage.getItem("ordkobling-best");
    if (saved) setHighScore(parseInt(saved, 10));
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
        localStorage.setItem("ordkobling-best", score.toString());
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
      const baseScore = wordScore(w);
      const bonus = calculateBonus(w);
      const totalScore = baseScore + bonus;
      setFound(prev => [...prev, { word: w, score: totalScore, bonus }]);
      setScore(s => s + totalScore);
      setPath([]);
      if (bonus > 0) {
        playSound(bonusSound);
      } else {
        playSound(foundWordSound);
      }
      if (w.length >= 8) {
        setTada(w);
        playSound(tadaSound);
        setTimeout(() => setTada(null), 3000);
      }
      showMsg(w.length >= 8 ? `BONUSORD! +${totalScore} poeng! ★` : `+${totalScore} poeng! ✓`, "ok");
    } else {
      setPath([]);
      playSound(invalidWordSound);
      showMsg(`"${w}" er ikke et ord`, "bad");
    }
  }, [wordScore, calculateBonus, showMsg, playSound]);

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

  const startGame = (newGrid = false) => {
    setScore(0);
    setIsNewRecord(false);
    if (newGrid) setGrid(genGrid());
    setPath([]); setFound([]); setTimeLeft(120);
    setMsg(""); setPhase("play");
    setPointerPos(null);
    dragging.current = false;
  };

  const onStart = () => startGame(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (e) {
      console.error('Failed to load leaderboard', e);
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchLeaderboard();
  }, [mounted, fetchLeaderboard]);

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
      setIsNewRecord(false); // Hide the input after submission
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

  const onPointerMove = (e) => {
    if (!dragging.current || phase !== "play") return;
    if (e.cancelable) e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = getSVGPoint(svg, e);
    setPointerPos(pt);
    const idx = cellFromPoint(pt.x, pt.y);
    
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
    leaderboard,
    isNewRecord,
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
    onPointerUp,
    onToggleSound,
    startGame
  };
}
export function PlayHeader({ score, highScore, checking, msg, msgType, word, timeLeft, isSoundOn, onToggleSound }) {
  return (
    <div className="w-full flex justify-between items-center mb-1.5 max-w-[368px]">
      <div className="text-paper text-xl font-bold">
        {score} <span className="text-xs text-[#888] font-normal">poeng</span>
        <div className="text-[10px] text-[#fbbf24] font-normal -mt-0.5">BEST: {highScore}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center h-8 px-2">
        <div className="flex items-center justify-center flex-1">
          {checking ? <span className="text-[#888] text-[13px]">Sjekker...</span>
            : msg ? <span className={`text-sm font-semibold ${msgType === "ok" ? "text-bonus" : msgType === "warn" ? "text-amber-400" : "text-red-400"}`}>{msg}</span>
            : word.length > 0 ? <span className="text-paper text-lg font-bold tracking-widest">{word}</span>
            : <span className="text-[#555] text-xs">Dra for å lage ord</span>}
        </div>
        <button onClick={onToggleSound} className="text-[10px] text-[#888] hover:text-paper mt-0.5">
          Lyd: {isSoundOn ? "PÅ" : "AV"}
        </button>
      </div>
      <span className={`text-xl font-bold ${timeLeft > 40 ? "text-bonus" : timeLeft > 15 ? "text-amber-400" : "text-red-400"}`}>{timeLeft}s</span>
    </div>
  );
}

export function PlayList({ found }) {
  return (
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
  );
}

function Leaderboard({ title, entries }) {
  if (!entries?.length) return null;
  return (
    <div className="mb-4 p-3 bg-black/20 rounded-xl border border-white/5">
      <p className="text-[10px] font-bold text-[#888] uppercase tracking-tighter mb-2 text-left">{title}</p>
      {entries.map((entry, i) => (
        <div key={i} className="flex justify-between text-[11px] border-b border-white/5 py-1 last:border-0">
          <span className="text-paper truncate mr-2">{i + 1}. {entry.name}</span>
          <span className="text-bonus font-mono">{entry.score}</span>
        </div>
      ))}
    </div>
  );
}

export default function GameStatus({
  phase,
  score,
  highScore,
  playerName,
  dailyLeaderboard,
  allTimeLeaderboard,
  submitted,
  isNewRecord,
  timeLeft,
  msg,
  msgType,
  checking,
  word,
  found,
  isSoundOn,
  onToggleSound,
  onStart,
  startGame,
  submitToLeaderboard,
  setPlayerName
}) {
  const btnClass = "bg-paper text-ink rounded-full px-7 py-3 text-[15px] font-bold transition-transform active:scale-95 cursor-pointer";

  if (phase === "start") {
    return (
      <div className="bg-[#1e1e1e] rounded-2xl p-6 max-w-[340px] text-center text-[#ccc] mt-4">
        <p className="text-[11px] font-bold text-[#fbbf24] uppercase tracking-widest mb-2">Dagens brett</p>
        <p className="text-[15px] leading-relaxed mb-2.5">
          Alle spiller det samme brettet i dag! Koble bokstavene ved å dra linjer – på kryss og tvers. Lange ord og æ/ø/å gir ekstra poeng.
        </p>
        <p className="text-[13px] text-[#888] mb-5">
          Minst 3 bokstaver · lengre ord gir mer · nytt brett hver dag
        </p>
        <button onClick={onStart} className={btnClass}>Start spill</button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="bg-[#1e1e1e] rounded-2xl p-6 max-w-[340px] text-center text-[#ccc] mt-4">
        <p className="text-2xl font-bold text-paper mb-1">Tid ute!</p>
        <div className="text-[11px] text-[#fbbf24] font-bold tracking-widest mb-2">REKORD: {highScore}</div>
        <p className="text-[34px] font-extrabold text-bonus mb-2">{score} poeng</p>
        
        {isNewRecord && !submitted && (
          <div className="mb-4 animate-in fade-in zoom-in duration-300">
            <p className="text-[#fbbf24] text-xs font-bold mb-2 uppercase">Ny dagsrekord! Send inn til dagens toppliste</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              submitToLeaderboard(playerName || e.target.playerName.value);
            }} className="flex gap-2">
              <input
                name="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
                minLength={2}
                required
                placeholder="Ditt navn"
                className="bg-ink border border-[#444] rounded-lg px-3 py-2 text-xs text-paper flex-1 outline-none focus:border-bonus"
              />
              <button type="submit" className="bg-bonus text-ink text-[10px] font-bold px-3 rounded-lg">Send</button>
            </form>
          </div>
        )}

        {submitted && (
          <p className="text-bonus text-xs font-bold mb-4">Sendt inn! ★</p>
        )}

        <p className="text-sm text-[#888] mb-3.5">{found.length} ord funnet</p>

        <Leaderboard title="Dagens toppliste" entries={dailyLeaderboard} />
        <Leaderboard title="Tidenes beste" entries={allTimeLeaderboard} />

        {found.length > 0 && (
          <div className="mb-4 max-h-32 overflow-y-auto text-left opacity-60">
            {[...found].sort((a, b) => b.score - a.score || b.word.length - a.word.length).map((f, i) => (
              <span key={i} className="inline-block bg-[#2a2a2a] rounded-lg px-2.5 py-1 m-1 text-xs text-paper">
                {f.word} <span className="text-bonus">({f.score})</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2.5 justify-center">
          <button onClick={() => startGame()} className={btnClass}>Spill igjen</button>
        </div>
      </div>
    );
  }

  return null;
}
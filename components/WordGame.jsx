"use client";
import { useGameState } from "./useGameState";
import GameBoard from "./GameBoard";
import GameStatus, { PlayHeader, PlayList } from "./GameStatus";

export default function WordGame() {
  const gameState = useGameState();

  if (!gameState.mounted) return <div className="bg-ink min-h-screen" />;

  return (
    <div className="overflow-y-auto bg-ink min-h-screen flex flex-col items-center p-3 pb-10 font-sans select-none">
      <h1 className="text-paper text-xl font-bold mb-2 tracking-widest">
        ORDKOBLING
      </h1>

      {gameState.phase === "play" && (
        <>
          <PlayHeader
            score={gameState.score}
            highScore={Math.max(gameState.score, gameState.highScore)}
            checking={gameState.checking}
            msg={gameState.msg}
            msgType={gameState.msgType}
            word={gameState.word}
            timeLeft={gameState.timeLeft}
            isSoundOn={gameState.isSoundOn}
            onToggleSound={gameState.onToggleSound}
          />

          <GameBoard
            grid={gameState.grid}
            path={gameState.path}
            pointerPos={gameState.pointerPos}
            dragging={gameState.dragging}
            svgRef={gameState.svgRef}
            onPointerDown={gameState.onPointerDown}
            onPointerMove={gameState.onPointerMove}
            onPointerUp={gameState.onPointerUp}
            checking={gameState.checking}
            tada={gameState.tada}
          />

          <PlayList found={gameState.found} />
        </>
      )}

      <GameStatus
        phase={gameState.phase}
        score={gameState.score}
        highScore={gameState.highScore}
        isNewRecord={gameState.isNewRecord}
        timeLeft={gameState.timeLeft}
        msg={gameState.msg}
        msgType={gameState.msgType}
        checking={gameState.checking}
        word={gameState.word}
        found={gameState.found}
        isSoundOn={gameState.isSoundOn}
        onToggleSound={gameState.onToggleSound}
        onStart={gameState.onStart}
        startGame={gameState.startGame}
      />

      <footer className="mt-auto pt-10 text-center">
        <p className="text-[11px] text-[#555] max-w-[280px] leading-relaxed">
          Ordboksdata er levert av Universitetet i Bergen og Språkrådet.
        </p>
      </footer>
    </div>
  );
}
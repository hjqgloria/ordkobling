import { cellCenter, ROWS, COLS, TILE, GAP, adj } from "./gameLogic";

export default function GameBoard({ grid, path, pointerPos, dragging, svgRef, onPointerDown, onPointerMove, onPointerUp, checking, tada }) {
  const W = COLS * (TILE + GAP) - GAP;
  const H = ROWS * (TILE + GAP) - GAP;

  return (
    <div className="bg-black rounded-xl p-1.5 touch-none relative">
      {tada && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10 rounded-xl pointer-events-none">
          <div className="text-6xl mb-2.5">🎉</div>
          <div className="text-[#fbbf24] text-[28px] font-black text-center drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
            FANTASTISK!<br/>{tada}
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        className={`block ${checking ? "cursor-wait" : "cursor-default"}`}
      >
        {path.length > 1 && path.slice(0, -1).map((idx, i) => {
          const a = cellCenter(idx), b = cellCenter(path[i + 1]);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-[#f59e0b] stroke-[4.5] stroke-round opacity-90" />;
        })}

        {dragging.current && path.length > 0 && pointerPos && (
          <line
            x1={cellCenter(path[path.length - 1]).x}
            y1={cellCenter(path[path.length - 1]).y}
            x2={pointerPos.x}
            y2={pointerPos.y}
            className="stroke-[#f59e0b] stroke-[3] [stroke-dasharray:4_2] opacity-60"
          />
        )}

        {grid.map((letter, i) => {
          const x = (i % COLS) * (TILE + GAP), y = Math.floor(i / COLS) * (TILE + GAP);
          const inPath = path.includes(i), isLast = path[path.length - 1] === i;
          const canConnect = !inPath && path.length > 0 && adj(path[path.length - 1], i) && dragging.current;
          return (
            <g key={i} transform={`translate(${x},${y})`}>
              <rect
                width={TILE}
                height={TILE}
                rx={8}
                className={`stroke-1 ${
                  isLast ? "fill-[#f59e0b] stroke-black" :
                  inPath ? "fill-[#fbbf24] stroke-[#444]" :
                  canConnect ? "fill-[#d1d5db] stroke-transparent" : "fill-paper stroke-transparent"
                }`}
              />
              <text
                x={TILE/2}
                y={TILE/2+1}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[16px] font-extrabold fill-black font-sans"
              >
                {letter}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
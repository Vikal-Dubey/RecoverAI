export default function ComparisonBar({ label, aValue, bValue, format = (v) => v, higherIsBetter = true }) {
  const numA = Number(aValue) || 0;
  const numB = Number(bValue) || 0;
  const max = Math.max(numA, numB) || 1;
  const aWins = higherIsBetter ? numA >= numB : numA <= numB;

  return (
    <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border-soft space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted font-medium">{label}</span>
        {aWins && (
          <span className="text-[11px] font-semibold text-accent flex items-center gap-1">
            <span>✓</span> RecoverAI advantage
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {/* RecoverAI Arm */}
        <div className="flex items-center gap-3 text-xs">
          <span className="w-20 font-semibold text-text">RecoverAI</span>
          <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(5, (numA / max) * 100))}%` }}
            />
          </div>
          <span className="w-24 text-right font-mono font-medium text-text">{format(aValue)}</span>
        </div>

        {/* Baseline Arm */}
        <div className="flex items-center gap-3 text-xs">
          <span className="w-20 text-muted">Baseline</span>
          <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-muted-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(5, (numB / max) * 100))}%` }}
            />
          </div>
          <span className="w-24 text-right font-mono text-muted">{format(bValue)}</span>
        </div>
      </div>
    </div>
  );
}
export default function ComparisonBar({ label, aValue, bValue, format = (v) => v, higherIsBetter = true }) {
  const max = Math.max(aValue, bValue) || 1;
  const aWins = higherIsBetter ? aValue >= bValue : aValue <= bValue;

  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-20 text-xs font-medium text-indigo-700">RecoverAI</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(aValue / max) * 100}%` }} />
          </div>
          <span className="w-28 text-xs text-right font-medium text-gray-800">{format(aValue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 text-xs font-medium text-gray-500">Baseline</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 rounded-full" style={{ width: `${(bValue / max) * 100}%` }} />
          </div>
          <span className="w-28 text-xs text-right font-medium text-gray-800">{format(bValue)}</span>
        </div>
      </div>
      {aWins && <div className="text-[11px] text-green-600 mt-0.5">✓ RecoverAI wins</div>}
    </div>
  );
}
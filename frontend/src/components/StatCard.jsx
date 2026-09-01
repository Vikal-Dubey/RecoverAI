export default function StatCard({ label, value, sublabel, accent = 'text-text', className = '' }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-4 ${className}`}>
      <div className="text-xs font-medium text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold font-mono tracking-tight mt-1.5 ${accent}`}>{value}</div>
      {sublabel && <div className="text-xs text-muted-2 mt-1">{sublabel}</div>}
    </div>
  );
}
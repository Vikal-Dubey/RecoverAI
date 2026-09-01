const STATUS_STYLES = {
  RECOVERED: 'bg-accent-dim text-accent',
  FAILED: 'bg-danger-dim text-danger',
  ESCALATED: 'bg-warn-dim text-warn',
  STOPPED: 'bg-surface-2 text-muted',
  RECOVERING: 'bg-warn-dim text-warn',
};

export default function StatusBadge({ status }) {
  const norm = (status || '').toUpperCase();
  const style = STATUS_STYLES[norm] || 'bg-surface-2 text-muted';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${style}`}>
      {norm || 'UNKNOWN'}
    </span>
  );
}
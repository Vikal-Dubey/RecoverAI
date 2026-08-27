const STATUS_STYLES = {
  FAILED: 'bg-red-100 text-red-700',
  RECOVERING: 'bg-amber-100 text-amber-700',
  RECOVERED: 'bg-green-100 text-green-700',
  ESCALATED: 'bg-purple-100 text-purple-700',
  STOPPED: 'bg-gray-200 text-gray-600',
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
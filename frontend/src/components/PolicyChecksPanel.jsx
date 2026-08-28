import Card from './Card';

export default function PolicyChecksPanel({ checks }) {
  if (!checks || checks.length === 0) {
    return (
      <Card title="Policy Engine Checks">
        <p className="text-sm text-gray-400">No policy checks recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Policy Engine Checks">
      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                check.passed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {check.passed ? '✓' : '!'}
            </span>
            <div>
              <span className="text-sm font-medium text-gray-800">{check.ruleName}</span>
              <p className="text-xs text-gray-500">{check.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
import Card from './Card';

const RULE_GROUPS = {
  MAX_RETRIES: 'Safety',
  HARD_DECLINE_CHECK: 'Safety',
  RECOVERY_WINDOW: 'Safety',
  MIN_RETRY_INTERVAL: 'Safety',
  NOTIFICATION_LIMIT: 'Safety',
  EXPIRED_CARD_CHECK: 'Business',
  HIGH_VALUE_CHECK: 'Business',
};

export default function PolicyChecksPanel({ checks }) {
  if (!checks || checks.length === 0) {
    return (
      <Card title="Policy Engine Checks">
        <p className="text-sm text-gray-400">No policy checks recorded yet.</p>
      </Card>
    );
  }

  const groups = { Safety: [], Business: [] };
  for (const check of checks) {
    const group = RULE_GROUPS[check.ruleName] || 'Business';
    groups[group].push(check);
  }

  return (
    <Card title="Policy Engine Checks">
      {['Safety', 'Business'].map((groupName) =>
        groups[groupName].length > 0 ? (
          <div key={groupName} className="mb-3 last:mb-0">
            <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
              {groupName} Rules
            </span>
            <ul className="space-y-2 mt-1.5">
              {groups[groupName].map((check) => (
                <li key={check.id} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
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
          </div>
        ) : null
      )}
    </Card>
  );
}
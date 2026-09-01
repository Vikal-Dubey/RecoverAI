import Card from './Card';
import { formatFailureReason } from '../utils/format';

const RULE_FRIENDLY_NAMES = {
  MAX_RETRIES: 'Retry limit allowed',
  HARD_DECLINE_CHECK: 'Failure type recoverable',
  RECOVERY_WINDOW: 'Recovery window valid',
  MIN_RETRY_INTERVAL: 'Retry interval compliant',
  NOTIFICATION_LIMIT: 'Notification limit valid',
  EXPIRED_CARD_CHECK: 'Card validity check',
  HIGH_VALUE_CHECK: 'Transaction value threshold',
};

export default function PolicyChecksPanel({ checks = [] }) {
  if (!checks || checks.length === 0) {
    return (
      <Card title="Policy Check" subtitle="AI recommends. Policy controls.">
        <p className="text-xs text-muted">No policy checks recorded yet.</p>
      </Card>
    );
  }

  const allPassed = checks.every((c) => c.passed);
  const displayChecks = checks.slice(0, 4);

  return (
    <Card
      title="Policy Check"
      subtitle="AI recommends. Policy controls."
      action={
        <span
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
            allPassed
              ? 'bg-accent-dim text-accent'
              : 'bg-warn-dim text-warn'
          }`}
        >
          {allPassed ? 'APPROVED' : 'ENFORCED'}
        </span>
      }
    >
      <div className="space-y-2.5">
        <div className="space-y-2">
          {displayChecks.map((check) => {
            const label = RULE_FRIENDLY_NAMES[check.ruleName] || formatFailureReason(check.ruleName);
            return (
              <div
                key={check.id || check.ruleName}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`font-bold mt-0.5 ${
                      check.passed ? 'text-accent' : 'text-warn'
                    }`}
                  >
                    {check.passed ? '✓' : '!'}
                  </span>
                  <div>
                    <span className="text-text font-medium">{label}</span>
                    {check.reason && (
                      <p className="text-muted text-[11px] mt-0.5">{check.reason}</p>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-mono font-medium shrink-0 ${
                    check.passed ? 'text-accent' : 'text-warn'
                  }`}
                >
                  {check.passed ? 'Passed' : 'Flagged'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
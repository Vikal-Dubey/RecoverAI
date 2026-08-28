import Card from './Card';

function buildTimelineEvents(payment) {
  const events = [];

  for (const log of payment.auditLogs || []) {
    events.push({ time: log.timestamp, label: log.event, detail: log.details });
  }

  for (const attempt of payment.recoveryAttempts || []) {
    if (attempt.scheduledAt) {
      events.push({
        time: attempt.scheduledAt,
        label: 'RETRY_SCHEDULED',
        detail: attempt.outcome ? `Outcome: ${attempt.outcome}` : 'Pending execution',
      });
    }
  }

  events.sort((a, b) => new Date(a.time) - new Date(b.time));
  return events;
}

export default function Timeline({ payment }) {
  const events = buildTimelineEvents(payment);

  if (events.length === 0) {
    return (
      <Card title="Timeline">
        <p className="text-sm text-gray-400">No events recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Timeline">
      <ol className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
              {i < events.length - 1 && <span className="w-px flex-1 bg-gray-200" />}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{e.label}</span>
                <span className="text-xs text-gray-400">
                  {new Date(e.time).toLocaleString()}
                </span>
              </div>
              {e.detail && <p className="text-xs text-gray-500 mt-0.5">{e.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
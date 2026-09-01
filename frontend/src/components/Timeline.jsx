import Card from './Card';
import { formatTime, formatFailureReason } from '../utils/format';

function formatEventLabel(event) {
  if (!event) return 'Event recorded';
  const norm = event.toUpperCase();
  if (norm.includes('FAILED') && norm.includes('PAYMENT')) return 'Payment failed';
  if (norm.includes('DECISION') || norm.includes('AI_')) return 'AI decision generated';
  if (norm.includes('POLICY') && (norm.includes('APPROVED') || norm.includes('EVALUATED'))) return 'Policy approved action';
  if (norm.includes('RETRY_EXECUTED') || norm.includes('EXECUTE')) return 'Recovery executed';
  if (norm.includes('SUCCEEDED') || norm.includes('RECOVERED')) return 'Payment recovered';
  if (norm.includes('NOTIFIED') || norm.includes('NOTIFICATION')) return 'Customer notified';
  if (norm.includes('ESCALATED')) return 'Escalated to human';
  if (norm.includes('STOPPED')) return 'Recovery stopped';
  return formatFailureReason(event);
}

function buildTimelineEvents(payment) {
  const events = [];

  for (const log of payment.auditLogs || []) {
    events.push({
      id: log.id || `log-${log.timestamp}`,
      time: log.timestamp,
      label: formatEventLabel(log.event),
      detail: log.details,
    });
  }

  for (const attempt of payment.recoveryAttempts || []) {
    if (attempt.executedAt) {
      events.push({
        id: attempt.id || `attempt-${attempt.executedAt}`,
        time: attempt.executedAt,
        label: attempt.outcome === 'success' ? 'Payment recovered' : 'Recovery attempt executed',
        detail: attempt.outcome ? `Outcome: ${attempt.outcome}` : null,
      });
    } else if (attempt.scheduledAt) {
      events.push({
        id: attempt.id || `attempt-${attempt.scheduledAt}`,
        time: attempt.scheduledAt,
        label: 'Recovery scheduled',
        detail: null,
      });
    }
  }

  // If no explicit audit log for creation, add initial failure trigger
  if (payment.createdAt && !events.some((e) => e.label.toLowerCase().includes('failed'))) {
    events.push({
      id: `init-${payment.createdAt}`,
      time: payment.createdAt,
      label: 'Payment failed',
      detail: null,
    });
  }

  // Sort ascending for chronological event list
  events.sort((a, b) => new Date(a.time) - new Date(b.time));
  return events;
}

export default function Timeline({ payment }) {
  if (!payment) return null;
  const events = buildTimelineEvents(payment);

  return (
    <Card title="Activity">
      {events.length === 0 ? (
        <p className="text-xs text-muted">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {events.map((e, i) => (
            <div key={e.id || i} className="flex items-baseline gap-3 text-xs">
              <span className="font-mono text-muted text-[11px] shrink-0">
                {formatTime(e.time)}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-text">{e.label}</span>
                {e.detail && (
                  <span className="text-muted-2 text-[11px] ml-1.5 truncate">({e.detail})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
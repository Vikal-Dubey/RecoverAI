import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { formatFailureReason } from '../utils/format';

function summarize(result) {
  if (!result?.decision || !result?.payment) return null;
  const { payment, decision, policyResult, actionResult } = result;

  let outcome;
  if (policyResult.action === 'notify_customer') {
    outcome = actionResult?.selfResolved
      ? 'Customer self-resolved after notification'
      : 'Notified — awaiting customer action';
  } else if (policyResult.action === 'stop') {
    outcome = actionResult?.reason || 'Recovery stopped';
  } else if (policyResult.action === 'escalate') {
    outcome = actionResult?.reason || 'Escalated to human review';
  } else {
    outcome = decision.retryAfterMinutes
      ? `Retry scheduled in ${decision.retryAfterMinutes} min`
      : 'Retry scheduled';
  }

  return {
    id: `${payment.id}-${Date.now()}`,
    paymentId: payment.id,
    customer: payment.customer?.name || 'Customer',
    action: formatFailureReason(policyResult.action),
    outcome,
    time: new Date(),
  };
}

export default function ActivityFeed() {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  useSocketEvent(
    'recovery:completed',
    (result) => {
      const entry = summarize(result);
      if (entry) setEvents((prev) => [entry, ...prev].slice(0, 8));
    }
  );

  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Live Activity</h3>
      <ul className="space-y-2 max-h-56 overflow-y-auto">
        {events.map((e) => (
          <li
            key={e.id}
            onClick={() => navigate(`/payments/${e.paymentId}`)}
            className="text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-gray-50 rounded px-1.5 -mx-1.5 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{e.customer}</span>
              <span className="text-xs text-gray-400">{e.time.toLocaleTimeString()}</span>
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {e.action} — {e.outcome}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
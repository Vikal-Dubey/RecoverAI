import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { formatFailureReason, formatTime } from '../utils/format';

function summarize(type, data) {
  if (!data) return null;

  if (type === 'recovery:completed') {
    const p = data.payment || data;
    const isSuccess = data.outcome === 'success' || p?.status === 'RECOVERED';
    const isEscalated = p?.status === 'ESCALATED' || data.policyResult?.action === 'escalate';

    let icon = '⚡';
    let text = 'Payment processed';
    let iconClass = 'text-accent';

    if (isSuccess) {
      icon = '✓';
      text = `Payment recovered — ${p.customer?.name || 'Customer'}`;
      iconClass = 'text-accent';
    } else if (isEscalated) {
      icon = '↗';
      text = `Escalated to human — ${p.customer?.name || 'Customer'}`;
      iconClass = 'text-warn';
    } else {
      icon = '✕';
      text = `Recovery stopped — ${p.customer?.name || 'Customer'}`;
      iconClass = 'text-muted';
    }

    return {
      id: `evt-${p.id || Date.now()}-${Math.random()}`,
      paymentId: p.id,
      icon,
      iconClass,
      text,
      time: new Date(),
    };
  }

  if (type === 'recovery:decision') {
    const p = data.payment || data;
    const decision = data.decision || data.proposal;
    return {
      id: `dec-${p?.id || Date.now()}-${Math.random()}`,
      paymentId: p?.id,
      icon: '⚡',
      iconClass: 'text-warn',
      text: `AI decision: ${decision?.strategy ? formatFailureReason(decision.strategy) : 'Evaluated'} — ${p?.customer?.name || 'Customer'}`,
      time: new Date(),
    };
  }

  if (type === 'payment:failed') {
    return {
      id: `fail-${data.paymentId || Date.now()}-${Math.random()}`,
      paymentId: data.paymentId,
      icon: '✕',
      iconClass: 'text-danger',
      text: `Payment failed — ${data.customerName || 'Customer'}`,
      time: new Date(),
    };
  }

  return null;
}

export default function ActivityFeed() {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();

  const addEvent = useCallback((type, data) => {
    const entry = summarize(type, data);
    if (entry) {
      setEvents((prev) => [entry, ...prev].slice(0, 4));
    }
  }, []);

  useSocketEvent('recovery:completed', (data) => addEvent('recovery:completed', data));
  useSocketEvent('recovery:decision', (data) => addEvent('recovery:decision', data));
  useSocketEvent('payment:failed', (data) => addEvent('payment:failed', data));

  if (events.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-3.5 mb-6 text-xs transition">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-medium text-text">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>Live Activity</span>
        </div>
        <span className="text-[11px] font-mono text-muted-2">Real-time</span>
      </div>

      <div className="space-y-1.5">
        {events.map((e) => (
          <div
            key={e.id}
            onClick={() => e.paymentId && navigate(`/payments/${e.paymentId}`)}
            className={`flex items-center justify-between py-1 px-2 rounded-lg bg-surface-2/60 border border-border-soft transition ${
              e.paymentId ? 'cursor-pointer hover:border-border hover:bg-surface-2' : ''
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className={`font-bold ${e.iconClass}`}>{e.icon}</span>
              <span className="text-text truncate">{e.text}</span>
            </div>
            <span className="font-mono text-muted-2 text-[11px] shrink-0 ml-3">
              {formatTime(e.time)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
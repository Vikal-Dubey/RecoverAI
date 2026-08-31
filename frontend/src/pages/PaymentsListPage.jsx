import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPayments, simulateFailure } from '../api/payments';
import StatusBadge from '../components/StatusBadge';
import DashboardStats from '../components/DashboardStats';
import { formatINR, formatFailureReason, computeRiskTier } from '../utils/format';
import socket from '../api/socket';
import { useSocketEvent } from '../hooks/useSocketEvent';

const FAILURE_TYPES = [
  'insufficient_funds',
  'network_error',
  'bank_timeout',
  'temporary_decline',
  'expired_card',
  'hard_decline',
];

const FILTERS = [
  { label: 'All', status: null, notified: false },
  { label: 'Failed', status: 'FAILED', notified: false },
  { label: 'Notified', status: 'FAILED', notified: true },
  { label: 'Recovered', status: 'RECOVERED', notified: false },
  { label: 'Escalated', status: 'ESCALATED', notified: false },
  { label: 'Stopped', status: 'STOPPED', notified: false },
];

export default function PaymentsListPage() {
  const [payments, setPayments] = useState([]);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [failureType, setFailureType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPayments({ status: activeFilter.status, notified: activeFilter.notified });
        if (!ignore) setPayments(data);
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [activeFilter]);

  const reloadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPayments({ status: activeFilter.status, notified: activeFilter.notified });
      setPayments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useSocketEvent('recovery:completed', reloadPayments);
  useSocketEvent('recovery:decision', reloadPayments);

  useEffect(() => {
    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  async function handleSimulate() {
    setSimulating(true);
    setError(null);
    try {
      await simulateFailure(failureType || undefined);
      await reloadPayments();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div>
      <DashboardStats />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeFilter.label === f.label
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>

          <select
            value={failureType}
            onChange={(e) => setFailureType(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 bg-white"
          >
            <option value="">Any failure type</option>
            {FAILURE_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {formatFailureReason(ft)}
              </option>
            ))}
          </select>

          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {simulating ? 'Simulating…' : 'Simulate Failure'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading payments…</div>
      ) : payments.length === 0 ? (
        <div className="text-gray-400 text-sm py-8 text-center">No payments found.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Amount</th>
                <th className="text-left px-4 py-2.5">Customer Risk</th>
                <th className="text-left px-4 py-2.5">Failure Reason</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Notified</th>
                <th className="text-left px-4 py-2.5">AI Action</th>
                <th className="text-left px-4 py-2.5">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const latest = p.agentDecisions?.[0];
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/payments/${p.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">{p.customer.name}</td>
                    <td className="px-4 py-3">{formatINR(p.amount)}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const tier = computeRiskTier(p.customer);
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>
                            {tier.short}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatFailureReason(p.failureReason)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      {p.notificationCount > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {p.notificationCount}x sent
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {latest ? formatFailureReason(latest.strategy) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {latest ? `${Math.round(latest.confidence * 100)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
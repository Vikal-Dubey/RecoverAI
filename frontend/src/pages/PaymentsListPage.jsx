import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPayments, simulateFailure } from '../api/payments';
import StatusBadge from '../components/StatusBadge';
import { formatINR, formatFailureReason } from '../utils/format';
import DashboardStats from '../components/DashboardStats';

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Recovered', value: 'RECOVERED' },
  { label: 'Escalated', value: 'ESCALATED' },
  { label: 'Stopped', value: 'STOPPED' },
];

export default function PaymentsListPage() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPayments(filter);
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
  }, [filter]);

  async function reloadPayments() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPayments(filter);
      setPayments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulate() {
    setSimulating(true);
    try {
      await simulateFailure();
      await reloadPayments();
    } catch (err) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div>
      <DashboardStats />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                filter === f.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {simulating ? 'Simulating…' : 'Simulate Failure'}
        </button>
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
                <th className="text-left px-4 py-2.5">Failure Reason</th>
                <th className="text-left px-4 py-2.5">Status</th>
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
                    <td className="px-4 py-3 text-gray-600">
                      {formatFailureReason(p.failureReason)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
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
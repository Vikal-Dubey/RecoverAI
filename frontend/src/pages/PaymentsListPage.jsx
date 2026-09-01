import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import DashboardStats from '../components/DashboardStats';
import { formatINR, formatFailureReason, computeRiskTier } from '../utils/format';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { getPayments, simulateFailure, simulateMany } from '../api/payments';

const FAILURE_TYPES = [
  'insufficient_funds',
  'network_error',
  'bank_timeout',
  'temporary_decline',
  'expired_card',
  'hard_decline',
];

const FILTERS = [
  { label: 'All', status: null },
  { label: 'Failed', status: 'FAILED' },
  { label: 'Recovered', status: 'RECOVERED' },
  { label: 'Escalated', status: 'ESCALATED' },
  { label: 'Stopped', status: 'STOPPED' },
];

export default function PaymentsListPage() {
  const [payments, setPayments] = useState([]);
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [failureTypeFilter, setFailureTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [simFailureType, setSimFailureType] = useState('insufficient_funds');
  const [simulating, setSimulating] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Batch simulation state
  const [bulkSimulating, setBulkSimulating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const data = await getPayments({ status: activeFilter.status });
      setPayments(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPayments({ status: activeFilter.status });
        if (!ignore) setPayments(data);
      } catch (err) {
        if (!ignore) setError(err.response?.data?.error || err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [activeFilter]);

  useSocketEvent('recovery:completed', loadData);
  useSocketEvent('recovery:decision', loadData);
  useSocketEvent('payment:failed', loadData);

  // Simulation handlers
  async function handleSimulateSubmit(e) {
    if (e) e.preventDefault();
    setSimulating(true);
    setModalError(null);
    try {
      await simulateFailure(simFailureType || undefined);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setModalError(err.response?.data?.error || err.message);
    } finally {
      setSimulating(false);
    }
  }

  async function handleSimulateMany() {
    setBulkSimulating(true);
    setError(null);
    setBulkProgress({ done: 0, total: 8 });
    try {
      await simulateMany(8, failureTypeFilter || undefined, (done, total) =>
        setBulkProgress({ done, total })
      );
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkSimulating(false);
      setBulkProgress(null);
    }
  }

  // Filtered payments by search and failure reason
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (failureTypeFilter && p.failureReason !== failureTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.customer?.name?.toLowerCase().includes(q);
        const idMatch = p.id?.toLowerCase().includes(q);
        const reasonMatch = p.failureReason?.toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !reasonMatch) return false;
      }
      return true;
    });
  }, [payments, failureTypeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">Recovery Inbox</h1>
          <p className="text-xs text-muted mt-1">
            Monitor failed payments and let RecoverAI determine the best recovery action.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-bg text-xs font-semibold shadow transition"
          >
            Simulate Failure
          </button>
          <button
            type="button"
            onClick={handleSimulateMany}
            disabled={bulkSimulating || simulating}
            className="px-3.5 py-2 rounded-lg bg-surface-2 hover:bg-surface-2/80 text-text border border-border text-xs font-medium transition disabled:opacity-50"
          >
            {bulkSimulating ? `Running (${bulkProgress?.done || 0}/${bulkProgress?.total || 8})` : 'Batch (8x)'}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <DashboardStats />

      {/* Filters and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payments..."
              className="w-full pl-3 pr-8 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-muted-2 focus:outline-none focus:border-accent transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-xs hover:text-text"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Pills + Failure Type dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-surface border border-border p-1 rounded-lg">
              {FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    activeFilter.label === f.label
                      ? 'bg-surface-2 text-text font-semibold shadow-sm'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={failureTypeFilter}
              onChange={(e) => setFailureTypeFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 text-text bg-surface focus:outline-none focus:border-accent transition"
            >
              <option value="">All Failure Reasons</option>
              {FAILURE_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {formatFailureReason(ft)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-danger-dim/30 border border-danger/30 text-danger text-xs">
          {error}
        </div>
      )}

      {/* Payments Table */}
      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-xs text-muted">
          Loading payments...
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-xs text-muted">
          No payments found.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-muted font-medium">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Failure Reason</th>
                <th className="text-left px-4 py-3 font-medium">Risk</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">AI Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {filteredPayments.map((p) => {
                const latestDecision = p.agentDecisions?.[0];
                const risk = computeRiskTier(p.customer);

                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/payments/${p.id}`)}
                    className="cursor-pointer hover:bg-surface-2/60 transition"
                  >
                    <td className="px-4 py-3 font-medium text-text">
                      {p.customer?.name || 'Customer'}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-text">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatFailureReason(p.failureReason)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${risk.color}`}>
                        {risk.short}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {latestDecision ? formatFailureReason(latestDecision.strategy) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Simple Simulation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-5 shadow-2xl text-text space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-soft">
              <h3 className="text-sm font-bold text-text">Simulate Payment Failure</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-text text-xs"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-lg bg-danger-dim text-danger text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSimulateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Failure Type</label>
                <select
                  value={simFailureType}
                  onChange={(e) => setSimFailureType(e.target.value)}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 text-text bg-surface-2 focus:outline-none focus:border-accent"
                >
                  {FAILURE_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {formatFailureReason(ft)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Customer</label>
                <input
                  type="text"
                  disabled
                  value="Targeted from available failure pool"
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 text-muted-2 bg-surface-2/40 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Amount</label>
                <input
                  type="text"
                  disabled
                  value="Original transaction amount"
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 text-muted-2 bg-surface-2/40 font-mono cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-muted hover:text-text hover:bg-surface-2 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-bg text-xs font-semibold transition disabled:opacity-50"
                >
                  {simulating ? 'Simulating...' : 'Simulate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
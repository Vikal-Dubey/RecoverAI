import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPaymentDetail, executeRecovery, simulatePaymentFailure } from '../api/payments';
import StatusBadge from '../components/StatusBadge';
import RecoveryStepper from '../components/RecoveryStepper';
import DiagnosisPanel from '../components/DiagnosisPanel';
import PolicyChecksPanel from '../components/PolicyChecksPanel';
import CustomerRiskPanel from '../components/CustomerRiskPanel';
import Timeline from '../components/Timeline';
import { formatINR, formatFailureReason } from '../utils/format';
import { useSocketEvent } from '../hooks/useSocketEvent';

const FAILURE_TYPES = [
  'insufficient_funds',
  'network_error',
  'bank_timeout',
  'temporary_decline',
  'expired_card',
  'hard_decline',
];

export default function PaymentDetailPage() {
  const { id } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [liveStage, setLiveStage] = useState(null);

  // Simulation State
  const [simulating, setSimulating] = useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [selectedFailureReason, setSelectedFailureReason] = useState('');
  const [simError, setSimError] = useState(null);

  // Synchronization guard to prevent older REST response from overwriting newer socket state
  const lastSocketUpdateTimeRef = useRef(0);

  const loadPayment = useCallback(async () => {
    try {
      const fetchTime = Date.now();
      const data = await getPaymentDetail(id);
      if (fetchTime >= lastSocketUpdateTimeRef.current) {
        setPayment(data);
        if (!selectedFailureReason) {
          setSelectedFailureReason(data.failureReason);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [id, selectedFailureReason]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    async function initialLoad() {
      try {
        const data = await getPaymentDetail(id);
        if (!ignore) {
          setPayment(data);
          setSelectedFailureReason(data.failureReason);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || err.message);
          setLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleRealtimeUpdate = useCallback(
    (result) => {
      const updatedPaymentId = result?.payment?.id || result?.paymentId || result?.id;
      if (updatedPaymentId === id) {
        lastSocketUpdateTimeRef.current = Date.now();
        setLiveStage(null);
        loadPayment();
      }
    },
    [id, loadPayment]
  );

  const handleDecisionEvent = useCallback(
    (result) => {
      const updatedPaymentId = result?.payment?.id || result?.paymentId;
      if (updatedPaymentId === id) {
        lastSocketUpdateTimeRef.current = Date.now();
        setLiveStage('decision');
        loadPayment();
      }
    },
    [id, loadPayment]
  );

  const handleExecutingEvent = useCallback(
    (result) => {
      if (result?.paymentId === id) {
        lastSocketUpdateTimeRef.current = Date.now();
        setLiveStage('executing');
      }
    },
    [id]
  );

  useSocketEvent('recovery:completed', handleRealtimeUpdate);
  useSocketEvent('recovery:decision', handleDecisionEvent);
  useSocketEvent('recovery:executing', handleExecutingEvent);

  async function handleManualExecute() {
    setExecuting(true);
    setError(null);
    try {
      await executeRecovery(id);
      await loadPayment();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setExecuting(false);
    }
  }

  async function handleSimulate(reason) {
    setSimulating(true);
    setSimError(null);
    setLiveStage('analyzing');
    try {
      await simulatePaymentFailure(id, reason || payment.failureReason);
      setIsSimModalOpen(false);
      await loadPayment();
    } catch (err) {
      setSimError(err.response?.data?.error || err.message);
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 bg-surface rounded animate-pulse" />
        <div className="h-28 bg-surface border border-border rounded-xl animate-pulse" />
        <div className="h-20 bg-surface border border-border rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-56 bg-surface border border-border rounded-xl animate-pulse" />
          <div className="h-56 bg-surface border border-border rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="p-8 text-center bg-surface border border-danger-dim rounded-xl text-text space-y-3">
        <h3 className="text-sm font-bold text-danger">Unable to load payment</h3>
        <p className="text-xs text-muted">{error}</p>
        <Link
          to="/"
          className="inline-block px-3.5 py-1.5 rounded-lg bg-surface-2 text-text text-xs hover:bg-border transition"
        >
          ← Return to Recovery Inbox
        </Link>
      </div>
    );
  }

  if (!payment) return null;

  const latestDecision = payment.agentDecisions?.[0];
  const isActionable = (payment.status === 'FAILED' || payment.status === 'RECOVERING') && payment.recoveryAttempts?.some((a) => !a.executedAt);

  return (
    <div className="space-y-6">
      {/* Navigation link */}
      <div>
        <Link
          to="/"
          className="text-xs text-muted hover:text-text inline-flex items-center gap-1.5 transition"
        >
          <span>←</span> Back to Inbox
        </Link>
      </div>

      {/* Payment Header Card */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-text">
              {payment.customer?.name || 'Customer'}
            </h2>
            {payment.customer?.email && (
              <>
                <span className="text-muted-2">·</span>
                <span className="text-xs text-muted font-mono">{payment.customer.email}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
            <span className="font-mono">Payment ID: {payment.id}</span>
            <span className="text-muted-2">·</span>
            <span>{formatFailureReason(payment.failureReason)}</span>
          </div>
        </div>

        <div className="flex items-center sm:items-end flex-col gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono text-text">
              {formatINR(payment.amount)}
            </span>
            <StatusBadge status={payment.status} />
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isActionable && (
              <button
                type="button"
                onClick={handleManualExecute}
                disabled={executing || simulating}
                className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-bg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {executing ? 'Executing...' : 'Execute Recovery'}
              </button>
            )}

            <div className="inline-flex rounded-lg shadow-sm">
              <button
                type="button"
                onClick={() => handleSimulate(payment.failureReason)}
                disabled={simulating || executing}
                className="px-3.5 py-1.5 rounded-l-lg bg-surface-2 hover:bg-surface-2/80 text-text border border-border text-xs font-medium transition disabled:opacity-50 inline-flex items-center gap-1.5"
                title={`Simulate failure with ${formatFailureReason(payment.failureReason)}`}
              >
                <span>⚡</span>
                <span>{simulating ? 'Simulating...' : 'Simulate This Failure'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFailureReason(payment.failureReason);
                  setIsSimModalOpen(true);
                }}
                disabled={simulating || executing}
                className="px-2 py-1.5 rounded-r-lg bg-surface-2 hover:bg-surface-2/80 text-text border-t border-r border-b border-border text-xs font-medium transition disabled:opacity-50 hover:text-accent"
                title="Change failure reason or customize simulation"
              >
                ⚙
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Error display */}
      {simError && (
        <div className="p-3 rounded-lg bg-danger-dim/30 border border-danger/30 text-danger text-xs flex items-center justify-between">
          <span>{simError}</span>
          <button
            type="button"
            onClick={() => setSimError(null)}
            className="text-muted hover:text-text text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Custom Simulation Modal */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-5 shadow-2xl text-text space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-soft">
              <h3 className="text-sm font-bold text-text">Simulate Payment Failure</h3>
              <button
                type="button"
                onClick={() => setIsSimModalOpen(false)}
                className="text-muted hover:text-text text-xs"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSimulate(selectedFailureReason);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Customer</label>
                <input
                  type="text"
                  disabled
                  value={`${payment.customer?.name || 'Customer'} (${payment.customer?.email || 'N/A'})`}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 text-text bg-surface-2/40 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Amount</label>
                <input
                  type="text"
                  disabled
                  value={formatINR(payment.amount)}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 text-text bg-surface-2/40 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-medium">Failure Reason Scenario</label>
                <select
                  value={selectedFailureReason}
                  onChange={(e) => setSelectedFailureReason(e.target.value)}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 text-text bg-surface-2 focus:outline-none focus:border-accent"
                >
                  {FAILURE_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {formatFailureReason(ft)} {ft === payment.failureReason ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted mt-1">
                  Select a failure type to test how the AI agent and policy engine handle this customer.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setIsSimModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-muted hover:text-text hover:bg-surface-2 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-bg text-xs font-semibold transition disabled:opacity-50"
                >
                  {simulating ? 'Simulating...' : 'Run Simulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Stepper (Full Width) */}
      <RecoveryStepper payment={payment} liveStage={liveStage} />

      {/* 2 x 2 Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DiagnosisPanel decision={latestDecision} />
        <PolicyChecksPanel checks={latestDecision?.policyChecks} />
        <CustomerRiskPanel customer={payment.customer} />
        <Timeline payment={payment} />
      </div>
    </div>
  );
}
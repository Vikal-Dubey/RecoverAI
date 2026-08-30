import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPaymentDetail } from '../api/payments';
import StatusBadge from '../components/StatusBadge';
import DiagnosisPanel from '../components/DiagnosisPanel';
import PolicyChecksPanel from '../components/PolicyChecksPanel';
import Timeline from '../components/Timeline';
import Card from '../components/Card';
import { formatINR, formatFailureReason } from '../utils/format';
import { useSocketEvent } from '../hooks/useSocketEvent';
import CustomerRiskPanel from '../components/CustomerRiskPanel';

export default function PaymentDetailPage() {
  const { id } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPaymentDetail(id);
        if (!ignore) setPayment(data);
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
  }, [id]);

  const loadPayment = useCallback(async () => {
    try {
      const data = await getPaymentDetail(id);
      setPayment(data);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  const handleRealtimeUpdate = useCallback(
    (result) => {
      if (result?.payment?.id === id) loadPayment();
    },
    [id, loadPayment]
  );

  useSocketEvent('recovery:completed', handleRealtimeUpdate);
  useSocketEvent('recovery:decision', handleRealtimeUpdate);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-28 bg-white rounded-lg border border-gray-200 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-white rounded-lg border border-gray-200 animate-pulse" />
          <div className="h-64 bg-white rounded-lg border border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }
  if (error) return <div className="text-red-600 text-sm py-8 text-center">{error}</div>;
  if (!payment) return null;

  const latestDecision = payment.agentDecisions?.[0];

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to Inbox
      </Link>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{payment.customer.name}</h2>
            <p className="text-sm text-gray-500">{payment.customer.email}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">
              {formatINR(payment.amount)}
            </div>
            <StatusBadge status={payment.status} />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-6 text-sm text-gray-600">
          <span>Failure: {formatFailureReason(payment.failureReason)}</span>
          <span>Method: {payment.method.toUpperCase()}</span>
          <span>Retries: {payment.retryCount}</span>
          <span>Notifications: {payment.notificationCount}</span>
          {payment.agentState && (
            <span>State: {formatFailureReason(payment.agentState.currentState)}</span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DiagnosisPanel decision={latestDecision} />
        <PolicyChecksPanel checks={latestDecision?.policyChecks} />
        <CustomerRiskPanel customer={payment.customer} />
      </div>

      <Timeline payment={payment} />
    </div>
  );
}
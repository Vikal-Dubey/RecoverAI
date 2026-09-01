import Card from './Card';
import { formatINRRupees, computeRiskTier } from '../utils/format';

export default function CustomerRiskPanel({ customer }) {
  if (!customer) {
    return (
      <Card title="Customer">
        <p className="text-xs text-muted">No customer data available.</p>
      </Card>
    );
  }

  const tier = computeRiskTier(customer);

  return (
    <Card title="Customer">
      <div className="space-y-3.5">
        <div>
          <div className="text-base font-bold text-text">{customer.name}</div>
          {customer.email && (
            <div className="text-xs text-muted font-mono mt-0.5">{customer.email}</div>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-border-soft text-xs">
          {customer.ltv != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted">LTV</span>
              <span className="font-mono font-medium text-text">{formatINRRupees(customer.ltv)}</span>
            </div>
          )}

          {tier.rate != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted">Success Rate</span>
              <span className="font-mono font-medium text-text">{Math.round(tier.rate * 100)}%</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-muted">Risk</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${tier.color}`}>
              {tier.short}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
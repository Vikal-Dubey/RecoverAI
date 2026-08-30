import Card from './Card';
import { formatINRRupees, computeRiskTier } from '../utils/format';

export default function CustomerRiskPanel({ customer }) {
  if (!customer) return null;
  const total = customer.successCount + customer.failCount;
  const tier = computeRiskTier(customer);

  return (
    <Card title="Customer Profile">
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Lifetime Value</span>
          <span className="font-medium text-gray-900">{formatINRRupees(customer.ltv)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Success Rate</span>
          <span className="font-medium text-gray-900">
            {Math.round(tier.rate * 100)}% ({customer.successCount}/{total})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Risk Tier</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>
            {tier.label}
          </span>
        </div>
      </div>
    </Card>
  );
}
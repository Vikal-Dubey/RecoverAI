import Card from './Card';
import { formatFailureReason } from '../utils/format';

export default function DiagnosisPanel({ decision }) {
  if (!decision) {
    return (
      <Card title="AI Diagnosis">
        <p className="text-sm text-gray-400">No decision recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card title="AI Diagnosis">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Strategy</span>
          <span className="text-sm font-medium text-gray-900">
            {formatFailureReason(decision.strategy)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Confidence</span>
          <span className="text-sm font-medium text-gray-900">
            {Math.round(decision.confidence * 100)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Recoverability Score</span>
          <span className="text-sm font-medium text-gray-900">
            {Math.round(decision.recoverabilityScore * 100)}%
          </span>
        </div>
        {decision.retryAfterMinutes != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Retry Delay</span>
            <span className="text-sm font-medium text-gray-900">
              {decision.retryAfterMinutes} min
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">Reasoning</span>
          <p className="text-sm text-gray-700 mt-1">{decision.reasoning}</p>
        </div>

        {decision.alternativesConsidered?.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Alternatives Considered</span>
            <ul className="mt-1 space-y-1.5">
              {decision.alternativesConsidered.map((alt, i) => (
                <li key={i} className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">
                    {formatFailureReason(alt.action)}
                  </span>{' '}
                  — {alt.rejectedBecause}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
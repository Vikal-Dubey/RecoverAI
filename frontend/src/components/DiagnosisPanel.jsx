import { useState } from 'react';
import Card from './Card';
import { formatFailureReason } from '../utils/format';

export default function DiagnosisPanel({ decision }) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!decision) {
    return (
      <Card title="AI Recommendation">
        <p className="text-xs text-muted">Waiting for AI recommendation...</p>
      </Card>
    );
  }

  const confidencePct = decision.confidence != null ? Math.round(decision.confidence * 100) : null;
  const hasAlternatives = decision.alternativesConsidered && decision.alternativesConsidered.length > 0;

  return (
    <Card title="AI Recommendation">
      <div className="space-y-4">
        {/* Strategy Title */}
        <div>
          <div className="text-base font-bold text-text">
            {formatFailureReason(decision.strategy)}
          </div>
          {decision.retryAfterMinutes != null && decision.retryAfterMinutes > 0 && (
            <div className="text-xs text-muted mt-0.5">
              Scheduled after +{decision.retryAfterMinutes} min
            </div>
          )}
        </div>

        {/* Confidence Row — Only if confidence is non-null */}
        {confidencePct != null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Confidence</span>
              <span className="font-mono text-text font-medium">{confidencePct}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        )}

        {/* Reasoning / Why? — Only if reasoning exists */}
        {decision.reasoning && (
          <div className="pt-2 border-t border-border-soft">
            <span className="text-xs font-semibold text-muted block mb-1">Why?</span>
            <p className="text-xs text-text leading-relaxed font-sans">
              {decision.reasoning}
            </p>
          </div>
        )}

        {/* Customer Hinglish message preview if available */}
        {decision.customerMessage && (
          <div className="p-3 rounded-lg bg-surface-2 border border-border-soft text-xs">
            <span className="text-muted text-[11px] block mb-1 font-medium">Customer Communication</span>
            <p className="text-text italic">"{decision.customerMessage}"</p>
          </div>
        )}

        {/* Collapsible Alternatives Considered */}
        {hasAlternatives && (
          <div className="pt-2 border-t border-border-soft">
            <button
              type="button"
              onClick={() => setShowAlternatives((prev) => !prev)}
              className="text-xs text-muted hover:text-text flex items-center gap-1 transition"
            >
              <span>{showAlternatives ? '⌃' : '⌄'}</span>
              <span>{showAlternatives ? 'Hide alternatives' : 'View alternatives'}</span>
            </button>

            {showAlternatives && (
              <div className="mt-2.5 space-y-1.5 pl-2 border-l border-border">
                {decision.alternativesConsidered.map((alt, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium text-text">{formatFailureReason(alt.action)}</span>
                    <span className="text-muted ml-1.5">— {alt.rejectedBecause}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
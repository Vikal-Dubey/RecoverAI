/**
 * Evaluates an AI-proposed recovery action against deterministic safety rules.
 * @param {object} payment - the Payment record
 * @param {object} proposal - { strategy, retryAfterMinutes, recoverabilityScore }
 * @returns {{ approved: boolean, action: string, checks: Array }}
 */
export function evaluatePolicy(payment, proposal) {
  const checks = [];
  let approved = true;
  let action = proposal.strategy;

  // Rule 1: Max retries
  const maxRetriesPassed = payment.retryCount < 3;
  checks.push({ rule: 'MAX_RETRIES', passed: maxRetriesPassed, reason: `Retry count: ${payment.retryCount}` });
  if (!maxRetriesPassed) {
    approved = false;
    action = 'stop';
  }

  // Rule 2: Hard decline never retried
  const isHardDecline = payment.failureReason === 'hard_decline';
  checks.push({ rule: 'FAILURE_TYPE', passed: !isHardDecline, reason: payment.failureReason });
  if (isHardDecline) {
    approved = false;
    action = 'stop';
  }

  // Rule 3: Expired card — block retry, notify instead
  if (payment.failureReason === 'expired_card') {
    checks.push({ rule: 'EXPIRED_CARD', passed: false, reason: 'Card expired — cannot retry, notify customer' });
    approved = true; // still "approved" but the action changes
    action = 'notify_customer';
  }

  // Rule 4: Recovery window (7 days from creation)
  const daysSinceFailure = (Date.now() - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24);
  const withinWindow = daysSinceFailure <= 7;
  checks.push({ rule: 'RECOVERY_WINDOW', passed: withinWindow, reason: `${daysSinceFailure.toFixed(1)} days since failure` });
  if (!withinWindow) {
    approved = false;
    action = 'stop';
  }

  // Rule 5: High-value payment escalation (example threshold: ₹5000 = 500000 paise)
  const isHighValue = payment.amount > 500000;
  checks.push({ rule: 'HIGH_VALUE_CHECK', passed: !isHighValue, reason: `Amount: ${payment.amount}` });
  if (isHighValue && approved) {
    action = 'escalate';
  }

  return { approved, action, checks };
}
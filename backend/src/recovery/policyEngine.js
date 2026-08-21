const MAX_RETRIES = 3;
const MIN_RETRY_INTERVAL_MINUTES = 30;
const RECOVERY_WINDOW_DAYS = 7;
const HIGH_VALUE_THRESHOLD = 500000; // paise, i.e. ₹5000
const MAX_NOTIFICATIONS_PER_24H = 2;

/**
 * Evaluates an AI-proposed recovery action against deterministic safety rules.
 * Returns which checks passed/failed as informational context — a "failed"
 * check here often means a rule correctly intervened, not a system error.
 */
export function evaluatePolicy(payment, proposal) {
  const checks = [];
  let action = proposal.strategy;
  let approved = true;

  const isHardDecline = payment.failureReason === 'hard_decline';
  const isExpiredCard = payment.failureReason === 'expired_card';
  const daysSinceFailure = (Date.now() - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24);
  const isHighValue = payment.amount > HIGH_VALUE_THRESHOLD;

  // Rule 1: Max retries
  const withinRetryLimit = payment.retryCount < MAX_RETRIES;
  checks.push({ rule: 'MAX_RETRIES', passed: withinRetryLimit, reason: `Retry count: ${payment.retryCount}/${MAX_RETRIES}` });

  // Rule 2: Hard decline is non-recoverable, always stop
  checks.push({ rule: 'HARD_DECLINE_CHECK', passed: !isHardDecline, reason: isHardDecline ? 'Hard decline — non-recoverable' : 'Not a hard decline' });

  // Rule 3: Expired card cannot be retried automatically — must notify instead
  checks.push({ rule: 'EXPIRED_CARD_CHECK', passed: !isExpiredCard, reason: isExpiredCard ? 'Expired card requires customer action' : 'Card not expired' });

  // Rule 4: Recovery window — stop pursuing after 7 days
  const withinWindow = daysSinceFailure <= RECOVERY_WINDOW_DAYS;
  checks.push({ rule: 'RECOVERY_WINDOW', passed: withinWindow, reason: `${daysSinceFailure.toFixed(1)} of ${RECOVERY_WINDOW_DAYS} days used` });

  // Rule 5: Minimum interval between retries (prevents hammering the bank/customer)
  let intervalOk = true;
  if (payment.lastRetryAt) {
    const minutesSinceLastRetry = (Date.now() - new Date(payment.lastRetryAt)) / (1000 * 60);
    intervalOk = minutesSinceLastRetry >= MIN_RETRY_INTERVAL_MINUTES;
    checks.push({ rule: 'MIN_RETRY_INTERVAL', passed: intervalOk, reason: `${minutesSinceLastRetry.toFixed(0)} of ${MIN_RETRY_INTERVAL_MINUTES} min elapsed` });
  } else {
    checks.push({ rule: 'MIN_RETRY_INTERVAL', passed: true, reason: 'No prior retry' });
  }

  // Rule 6: High-value payments require human escalation, not auto-retry
  checks.push({ rule: 'HIGH_VALUE_CHECK', passed: !isHighValue, reason: `Amount ${payment.amount} paise` });

  // Rule 7: Notification rate limit — don't spam the customer
  let notificationOk = true;
  if (payment.lastNotifiedAt) {
    const hoursSinceLastNotify = (Date.now() - new Date(payment.lastNotifiedAt)) / (1000 * 60 * 60);
    const withinDay = hoursSinceLastNotify < 24;
    notificationOk = !(withinDay && payment.notificationCount >= MAX_NOTIFICATIONS_PER_24H);
    checks.push({ rule: 'NOTIFICATION_LIMIT', passed: notificationOk, reason: `${payment.notificationCount}/${MAX_NOTIFICATIONS_PER_24H} sent in 24h` });
  } else {
    checks.push({ rule: 'NOTIFICATION_LIMIT', passed: true, reason: 'No prior notification' });
  }

  // --- Decide final action based on rule outcomes, in priority order ---
  if (isHardDecline || !withinWindow || !withinRetryLimit) {
    action = 'stop';
    approved = true; // "approved" to stop — a deliberate, policy-driven halt
  } else if (isExpiredCard) {
    action = notificationOk ? 'notify_customer' : 'stop';
    approved = true;
  } else if (isHighValue) {
    action = 'escalate';
    approved = true;
  } else if ((action === 'retry_now' || action === 'retry_delayed') && !intervalOk) {
    // AI wanted to retry too soon — policy delays it instead of blocking outright
    action = 'retry_delayed';
    approved = true;
  } else if (action === 'notify_customer' && !notificationOk) {
    action = 'stop';
    approved = false;
  }

  return { approved, action, checks };
}
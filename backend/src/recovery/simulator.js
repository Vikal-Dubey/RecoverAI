// Probability of a successful retry, by failure type and attempt number
const RETRY_PROBABILITIES = {
  network_error: [0.8, 0.9],
  bank_timeout: [0.7, 0.85],
  insufficient_funds: [0.4, 0.65, 0.8],
  temporary_decline: [0.5, 0.7, 0.85],
  expired_card: [0], // never recoverable via retry
  hard_decline: [0], // never recoverable
};

const NOTIFICATION_SUCCESS_PROBABILITIES = {
  insufficient_funds: 0.45,   // customer adds funds
  expired_card: 0.55,         // customer updates card details
  temporary_decline: 0.35,
  bank_timeout: 0.30,
  network_error: 0.30,
  hard_decline: 0.05,         // rarely resolvable even with contact
};

/**
 * Simulates whether a notified customer resolves the payment themselves.
 * @param {string} failureReason
 * @returns {{ success: boolean, probability: number }}
 */

export function simulateNotificationOutcome(failureReason) {
  const probability = NOTIFICATION_SUCCESS_PROBABILITIES[failureReason] ?? 0.2;
  const success = Math.random() < probability;
  return { success, probability };
}

/**
 * Simulates the outcome of a retry attempt.
 * @param {string} failureReason
 * @param {number} attemptNumber - 1-indexed retry attempt
 * @returns {{ success: boolean, probability: number }}
 */

export function simulateRetryOutcome(failureReason, attemptNumber) {
  const probs = RETRY_PROBABILITIES[failureReason] || [0.3];
  const probability = probs[attemptNumber - 1] ?? probs[probs.length - 1];
  const success = Math.random() < probability;
  return { success, probability };
}

/**
 * Classifies a failure reason as soft, hard, or non-recoverable.
 * @param {string} failureReason
 */
export function classifyFailure(failureReason) {
  if (['expired_card', 'hard_decline'].includes(failureReason)) {
    return 'hard';
  }
  return 'soft';
}
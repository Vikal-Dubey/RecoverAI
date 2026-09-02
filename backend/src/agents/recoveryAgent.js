import { GoogleGenAI } from '@google/genai';
import { getPaymentDetails, getCustomerHistory, getRecoveryHistory } from './agentTools.js';
import { RECOVERY_AGENT_SYSTEM_PROMPT } from './prompts.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
].filter(Boolean);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRuleBasedProposal(payment) {
  const reason = payment.failureReason;
  if (['network_error', 'temporary_decline'].includes(reason)) {
    return {
      strategy: 'retry_now',
      retryAfterMinutes: 0,
      recoverabilityScore: 0.85,
      confidence: 0.9,
      reasoning: 'Transient technical glitch detected; instant retry recommended.',
      alternativesConsidered: [
        { action: 'retry_delayed', rejectedBecause: 'Transient issue usually clears immediately' },
        { action: 'notify_customer', rejectedBecause: 'No customer intervention needed for network glitch' },
      ],
      customerMessage: null,
    };
  }

  if (reason === 'bank_timeout') {
    return {
      strategy: 'retry_delayed',
      retryAfterMinutes: 15,
      recoverabilityScore: 0.75,
      confidence: 0.85,
      reasoning: 'Bank gateway timeout detected; schedule delayed retry after 15 minutes.',
      alternativesConsidered: [
        { action: 'retry_now', rejectedBecause: 'Bank server might still be under load' },
        { action: 'stop', rejectedBecause: 'High probability of recovery after bank stabilizes' },
      ],
      customerMessage: null,
    };
  }

  if (['insufficient_funds', 'expired_card'].includes(reason)) {
    return {
      strategy: 'notify_customer',
      retryAfterMinutes: null,
      recoverabilityScore: 0.6,
      confidence: 0.85,
      reasoning: 'Customer action required to update payment method or add funds.',
      alternativesConsidered: [
        { action: 'retry_now', rejectedBecause: 'Will fail again without customer action' },
        { action: 'stop', rejectedBecause: 'Customer may pay once informed' },
      ],
      customerMessage:
        reason === 'insufficient_funds'
          ? 'Hi, aapke payment attempt me insufficient funds ki wajah se fail hua. Kripya apna balance check karein aur retry karein.'
          : 'Hi, aapka card expire ho chuka hai. Kripya updated card details se payment complete karein.',
    };
  }

  return {
    strategy: 'stop',
    retryAfterMinutes: null,
    recoverabilityScore: 0.1,
    confidence: 0.95,
    reasoning: 'Card issuer returned permanent hard decline.',
    alternativesConsidered: [
      { action: 'retry_now', rejectedBecause: 'Permanent decline cannot be recovered automatically' },
      { action: 'notify_customer', rejectedBecause: 'Payment method is permanently invalid' },
    ],
    customerMessage: null,
  };
}

/** Calls Gemini with fallback models and retry on 429, 503, and network timeouts. */
async function callGeminiWithRetry(userPrompt, maxRetries = 2) {
  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: { systemInstruction: RECOVERY_AGENT_SYSTEM_PROMPT },
        });
      } catch (err) {
        lastError = err;
        const status = err?.status;
        const msg = err?.message || '';
        const isRateLimited = status === 429 || /RESOURCE_EXHAUSTED/i.test(msg);
        const isOverloaded = status === 503 || /high demand|UNAVAILABLE/i.test(msg);
        const isNotFound = status === 404 || /NOT_FOUND|no longer available/i.test(msg);
        const isTimeoutOrNetwork =
          /timeout|HeadersTimeoutError|UND_ERR_HEADERS_TIMEOUT|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg) ||
          err?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT';

        // Deprecated/unsupported model: immediately try next candidate model
        if (isNotFound) {
          console.warn(`[Gemini] Model ${model} not available (404), trying next fallback.`);
          break;
        }

        // Server high demand (503): immediately try next candidate model
        if (isOverloaded) {
          console.warn(`[Gemini] Model ${model} is experiencing high demand (503). Switching to fallback model.`);
          break;
        }

        // Rate limit (429) or transient timeout: retry with backoff
        if ((isRateLimited || isTimeoutOrNetwork) && attempt < maxRetries) {
          const match = /retryDelay":"(\d+)s/.exec(msg);
          const suggestedSeconds = match ? parseInt(match[1], 10) : null;
          const waitMs = suggestedSeconds ? suggestedSeconds * 1000 + 1000 : (2 ** attempt) * 2000;

          console.log(
            `[Gemini] ${model} ${isRateLimited ? 'rate limited' : 'timed out'}, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(waitMs);
          attempt++;
          continue;
        }

        // Otherwise break and try the next model
        break;
      }
    }
  }

  throw lastError;
}

export async function analyzePayment(paymentId) {
  const payment = await getPaymentDetails(paymentId);
  const customerHistory = await getCustomerHistory(payment.customerId);
  const recoveryHistory = await getRecoveryHistory(paymentId);

  const userPrompt = `
  Payment: ${JSON.stringify({
    amount: payment.amount,
    currency: payment.currency,
    failureReason: payment.failureReason,
    method: payment.method,
    retryCount: payment.retryCount,
    createdAt: payment.createdAt,
  })}

Customer History: ${JSON.stringify(customerHistory)}

Recovery History: ${JSON.stringify(recoveryHistory)}
`;

  let proposal;
  try {
    const response = await callGeminiWithRetry(userPrompt);
    const text = response.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const raw = JSON.parse(text);

    proposal = {
      strategy: raw?.strategy?.action || 'stop',
      retryAfterMinutes: typeof raw?.strategy?.delayMinutes === 'number' ? raw.strategy.delayMinutes : null,
      recoverabilityScore: typeof raw?.recoverabilityScore === 'number' ? raw.recoverabilityScore : 0.5,
      confidence: typeof raw?.diagnosis?.confidence === 'number' ? raw.diagnosis.confidence : 0.8,
      reasoning: raw?.reasoning || 'AI payment recovery analysis completed.',
      alternativesConsidered: Array.isArray(raw?.alternativesConsidered) ? raw.alternativesConsidered : [],
      customerMessage: raw?.customerMessage ?? null,
    };
  } catch (err) {
    console.warn(`[Gemini] Failed to generate AI decision (${err?.status || err?.message}). Using resilient fallback strategy.`);
    proposal = getRuleBasedProposal(payment);
  }

  return { payment, proposal };
}
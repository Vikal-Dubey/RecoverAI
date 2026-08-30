import { GoogleGenAI } from '@google/genai';
import { getPaymentDetails, getCustomerHistory, getRecoveryHistory } from './agentTools.js';
import { RECOVERY_AGENT_SYSTEM_PROMPT } from './prompts.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calls Gemini with retry-on-429 backoff, since the free tier is rate-limited to 5 req/min. */
async function callGeminiWithRetry(userPrompt, maxRetries = 4) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: userPrompt,
        config: { systemInstruction: RECOVERY_AGENT_SYSTEM_PROMPT },
      });
    } catch (err) {
      const is429 = err?.status === 429 || /RESOURCE_EXHAUSTED/.test(err?.message || '');
      if (!is429 || attempt === maxRetries) throw err;

      // Try to read the server's suggested retry delay, else back off exponentially
      const match = /retryDelay":"(\d+)s/.exec(err?.message || '');
      const suggestedSeconds = match ? parseInt(match[1], 10) : null;
      const waitMs = suggestedSeconds ? suggestedSeconds * 1000 + 1000 : (2 ** attempt) * 3000;

      console.log(`[Gemini] Rate limited, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(waitMs);
      attempt++;
    }
  }
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

  const response = await callGeminiWithRetry(userPrompt);
  const text = response.text.trim().replace(/^```json\s*|\s*```$/g, '');
  const raw = JSON.parse(text);

  const proposal = {
    strategy: raw.strategy.action,
    retryAfterMinutes: raw.strategy.delayMinutes,
    recoverabilityScore: raw.recoverabilityScore,
    confidence: raw.diagnosis.confidence,
    reasoning: raw.reasoning,
    alternativesConsidered: raw.alternativesConsidered,
    customerMessage: raw.customerMessage ?? null,
  };

  return { payment, proposal };
}
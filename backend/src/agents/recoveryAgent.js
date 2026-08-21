import { GoogleGenAI } from '@google/genai';
import { getPaymentDetails, getCustomerHistory, getRecoveryHistory } from './agentTools.js';
import { RECOVERY_AGENT_SYSTEM_PROMPT } from './prompts.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: userPrompt,
    config: { systemInstruction: RECOVERY_AGENT_SYSTEM_PROMPT },
  });

  const text = response.text.trim().replace(/^```json\s*|\s*```$/g, '');
  const raw = JSON.parse(text);

  // Flatten into the shape the rest of the app expects
  const proposal = {
    strategy: raw.strategy.action,
    retryAfterMinutes: raw.strategy.delayMinutes,
    recoverabilityScore: raw.recoverabilityScore,
    confidence: raw.diagnosis.confidence,
    reasoning: raw.reasoning,
    alternativesConsidered: raw.alternativesConsidered,
  };

  return { payment, proposal };
}
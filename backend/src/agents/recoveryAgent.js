import { GoogleGenAI } from '@google/genai';
import { getPaymentDetails, getCustomerHistory, getRecoveryHistory } from './agentTools.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are a payment recovery strategist for a fintech company.
Given a failed payment's details, customer history, and recovery history, propose the best recovery action.
Respond ONLY with valid JSON, no other text, in this exact shape:
{
  "strategy": "retry_now" | "retry_delayed" | "notify_customer" | "escalate" | "stop",
  "retryAfterMinutes": number or null,
  "recoverabilityScore": number between 0 and 1,
  "confidence": number between 0 and 1,
  "reasoning": "one to two sentence explanation"
}`;

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
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const text = response.text.trim().replace(/^```json\s*|\s*```$/g, '');
  const proposal = JSON.parse(text);

  return { payment, proposal };
}
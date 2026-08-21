import { prisma } from '../lib/prismaClient.js';
import { analyzePayment } from '../agents/recoveryAgent.js';
import { evaluatePolicy } from '../recovery/policyEngine.js';
import { scheduleRetry, notifyCustomer, escalateToHuman, stopRecovery } from '../agents/agentTools.js';

export async function handlePaymentFailedEvent(webhookPayload) {
  const { payment: paymentData } = webhookPayload.payload;

  // Step 1: Find the payment (in real use, gateway sends payment ID; here we assume it exists in DB)
  const payment = await prisma.payment.findUnique({ where: { id: paymentData.id } });
  if (!payment) throw new Error('Payment not found');

  await prisma.agentState.upsert({
    where: { paymentId: payment.id },
    create: { paymentId: payment.id, currentState: 'ANALYZING' },
    update: { currentState: 'ANALYZING' },
  });

  // Step 2: Agent analyzes
  const { proposal } = await analyzePayment(payment.id);

  const decision = await prisma.agentDecision.create({
    data: {
      paymentId: payment.id,
      failureType: payment.failureReason,
      recoverabilityScore: proposal.recoverabilityScore,
      strategy: proposal.strategy,
      retryAfterMinutes: proposal.retryAfterMinutes,
      confidence: proposal.confidence,
      reasoning: proposal.reasoning,
      alternativesConsidered: proposal.alternativesConsidered,
    },
  });

  await prisma.agentState.update({
    where: { paymentId: payment.id },
    data: { currentState: 'DECISION_MADE' },
  });

  // Step 3: Policy engine checks
  const policyResult = evaluatePolicy(payment, proposal);

  for (const check of policyResult.checks) {
    await prisma.policyCheck.create({
      data: { decisionId: decision.id, ruleName: check.rule, passed: check.passed, reason: check.reason },
    });
  }

  await prisma.agentState.update({
    where: { paymentId: payment.id },
    data: { currentState: 'POLICY_CHECKED' },
  });

  // Step 4: Execute based on policy-approved action
  switch (policyResult.action) {
    case 'retry_now':
    case 'retry_delayed':
      await scheduleRetry(payment.id, decision.id, proposal.retryAfterMinutes || 0);
      await prisma.agentState.update({ where: { paymentId: payment.id }, data: { currentState: 'ACTION_SCHEDULED' } });
      break;
    case 'notify_customer':
      await notifyCustomer(payment.id);
      break;
    case 'escalate':
      await escalateToHuman(payment.id, policyResult.checks.find(c => !c.passed)?.reason || 'Policy escalation');
      break;
    case 'stop':
      await stopRecovery(payment.id, policyResult.checks.find(c => !c.passed)?.reason || 'Policy stop');
      break;
  }

  return { payment, decision, policyResult };
}
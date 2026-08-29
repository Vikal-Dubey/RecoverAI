import { prisma } from '../lib/prismaClient.js';
import { analyzePayment } from '../agents/recoveryAgent.js';
import { evaluatePolicy } from '../recovery/policyEngine.js';
import { scheduleRetry, notifyCustomer, escalateToHuman, stopRecovery } from '../agents/agentTools.js';

export async function handlePaymentFailedEvent(webhookPayload) {
  const { payment: paymentData } = webhookPayload.payload;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentData.id },
    include: { customer: true }, // needed so the dashboard can show who this is
  });
  if (!payment) throw new Error('Payment not found');

  await prisma.agentState.upsert({
    where: { paymentId: payment.id },
    create: { paymentId: payment.id, currentState: 'ANALYZING' },
    update: { currentState: 'ANALYZING' },
  });

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

  let actionResult = null;

  switch (policyResult.action) {
    case 'retry_now':
    case 'retry_delayed':
      actionResult = await scheduleRetry(payment.id, decision.id, proposal.retryAfterMinutes || 0);
      await prisma.agentState.update({ where: { paymentId: payment.id }, data: { currentState: 'ACTION_SCHEDULED' } });
      break;
    case 'notify_customer':
      actionResult = await notifyCustomer(payment.id, payment.failureReason);
      await prisma.agentState.update({ where: { paymentId: payment.id }, data: { currentState: 'COMPLETED' } });
      break;
    case 'escalate':
      actionResult = await escalateToHuman(payment.id, policyResult.reason || 'Policy escalation');
      await prisma.agentState.update({ where: { paymentId: payment.id }, data: { currentState: 'ESCALATED' } });
      break;
    case 'stop':
      actionResult = await stopRecovery(payment.id, policyResult.reason || 'Policy stop');
      await prisma.agentState.update({ where: { paymentId: payment.id }, data: { currentState: 'STOPPED' } });
      break;
  }

  return { payment, decision, policyResult, actionResult };
}
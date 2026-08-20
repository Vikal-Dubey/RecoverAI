import { prisma } from '../lib/prismaClient.js';
import { simulateRetryOutcome } from './simulator.js';

/**
 * Executes a scheduled retry attempt: runs the simulator, records the outcome,
 * and advances the payment's state accordingly.
 */
export async function executeRetryAttempt(recoveryAttemptId) {
  const attempt = await prisma.recoveryAttempt.findUnique({
    where: { id: recoveryAttemptId },
    include: { payment: true },
  });
  if (!attempt) throw new Error('Recovery attempt not found');

  const payment = attempt.payment;
  const nextAttemptNumber = payment.retryCount + 1;

  const { success, probability } = simulateRetryOutcome(payment.failureReason, nextAttemptNumber);

  await prisma.recoveryAttempt.update({
    where: { id: recoveryAttemptId },
    data: {
      executedAt: new Date(),
      outcome: success ? 'success' : 'failed',
    },
  });

  await prisma.auditLog.create({
    data: {
      paymentId: payment.id,
      event: success ? 'RETRY_SUCCEEDED' : 'RETRY_FAILED',
      details: `Attempt #${nextAttemptNumber}, probability ${probability}`,
    },
  });

    if (success) {
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'RECOVERED', recoveredAt: new Date(), retryCount: nextAttemptNumber },
    });
    await prisma.agentState.update({
      where: { paymentId: payment.id },
      data: { currentState: 'COMPLETED' },
    });
    return { outcome: 'success', payment: updatedPayment };
  } else {
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { retryCount: nextAttemptNumber },
    });
    await prisma.agentState.update({
      where: { paymentId: payment.id },
      data: { currentState: 'RESULT_RECEIVED' },
    });
    return { outcome: 'failed', payment: updatedPayment };
  }
}
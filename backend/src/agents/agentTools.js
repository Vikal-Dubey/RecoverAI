import { prisma } from '../lib/prismaClient.js';
import { simulateNotificationOutcome } from '../recovery/simulator.js';

export async function getPaymentDetails(paymentId) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: { customer: true },
  });
}

export async function getCustomerHistory(customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  const payments = await prisma.payment.findMany({ where: { customerId } });

  const successRate = customer.successCount + customer.failCount > 0
    ? customer.successCount / (customer.successCount + customer.failCount)
    : 0;

  return {
    successCount: customer.successCount,
    failCount: customer.failCount,
    successRate,
    ltv: customer.ltv,
    totalPayments: payments.length,
  };
}

export async function getRecoveryHistory(paymentId) {
  return prisma.recoveryAttempt.findMany({
    where: { paymentId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function scheduleRetry(paymentId, decisionId, delayMinutes) {
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  await prisma.payment.update({
    where: { id: paymentId },
    data: { lastRetryAt: new Date() },
  });
  return prisma.recoveryAttempt.create({
    data: { paymentId, decisionId, scheduledAt },
  });
}

export async function notifyCustomer(paymentId, failureReason) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      lastNotifiedAt: new Date(),
      notificationCount: { increment: 1 },
    },
  });

  const { success, probability } = simulateNotificationOutcome(failureReason);

  await prisma.auditLog.create({
    data: {
      paymentId,
      event: 'CUSTOMER_NOTIFIED',
      details: `Customer notified (modeled self-resolution chance: ${Math.round(probability * 100)}%)`,
    },
  });

  if (success) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'RECOVERED', recoveredAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        paymentId,
        event: 'CUSTOMER_SELF_RESOLVED',
        details: 'Customer resolved the issue themselves after notification',
      },
    });
  }

  console.log(`[NOTIFY] Payment ${paymentId} — self-resolved: ${success}`);
  return { notified: true, selfResolved: success, probability };
}

export async function escalateToHuman(paymentId, reason) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'ESCALATED' },
  });

  await prisma.auditLog.create({
    data: { paymentId, event: 'ESCALATED', details: reason },
  });

  console.log(`[ESCALATE] Payment ${paymentId} escalated: ${reason}`);
  return { escalated: true, reason };
}

export async function stopRecovery(paymentId, reason) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'STOPPED' },
  });

  await prisma.auditLog.create({
    data: { paymentId, event: 'RECOVERY_STOPPED', details: reason },
  });

  console.log(`[STOP] Recovery stopped for payment ${paymentId}: ${reason}`);
  return { stopped: true, reason };
}
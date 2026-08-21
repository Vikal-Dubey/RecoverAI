import { prisma } from '../lib/prismaClient.js';

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

export async function notifyCustomer(paymentId) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      lastNotifiedAt: new Date(),
      notificationCount: { increment: 1 },
    },
  });
  console.log(`[NOTIFY] Customer notified for payment ${paymentId}`);
  return { notified: true };
}

export async function escalateToHuman(paymentId, reason) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'ESCALATED' },
  });
  console.log(`[ESCALATE] Payment ${paymentId} escalated: ${reason}`);
}

export async function stopRecovery(paymentId, reason) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'STOPPED' },
  });
  console.log(`[STOP] Recovery stopped for payment ${paymentId}: ${reason}`);
}
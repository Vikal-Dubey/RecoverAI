import { prisma } from '../lib/prismaClient.js';
import { faker } from '@faker-js/faker';
import { analyzePayment } from '../agents/recoveryAgent.js';
import { evaluatePolicy } from './policyEngine.js';
import { simulateRetryOutcome, simulateNotificationOutcome } from './simulator.js';

const FAILURE_REASONS = [
  'insufficient_funds',
  'network_error',
  'bank_timeout',
  'temporary_decline',
  'expired_card',
  'hard_decline'
];

const METHODS = ['card', 'upi', 'netbanking'];
const MAX_ATTEMPTS = 3;

const decisionCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, retries = 3, delayMs = 4000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;

      console.log(
        `[DB] Query failed (${err.code || err.message}), retrying in ${delayMs}ms...`
      );

      await sleep(delayMs);
    }
  }
}

async function getCachedOrFreshDecision(payment) {
  const cacheKey = payment.failureReason;

  if (decisionCache.has(cacheKey)) {
    return decisionCache.get(cacheKey);
  }

  const { proposal } = await analyzePayment(payment.id);

  decisionCache.set(cacheKey, proposal);

  return proposal;
}

// Create the same payment scenarios for both experiment arms
async function createPaymentSpecs(count) {
  const customers = await withRetry(() =>
    prisma.customer.findMany({ take: 100 })
  );

  if (!customers.length) {
    throw new Error('No customers found. Cannot create experiment payments.');
  }

  const specs = [];

  for (let i = 0; i < count; i++) {
    const customer = faker.helpers.arrayElement(customers);

    specs.push({
      amount: faker.number.int({ min: 9900, max: 499900 }),
      currency: 'INR',
      customerId: customer.id,
      failureReason: faker.helpers.arrayElement(FAILURE_REASONS),
      method: faker.helpers.arrayElement(METHODS),
    });
  }

  return specs;
}

// Materialize the same specs into a specific experiment arm
async function materializePayments(specs, batchId, arm) {
  const payments = [];

  for (const spec of specs) {
    const payment = await withRetry(() =>
      prisma.payment.create({
        data: {
          ...spec,
          status: 'FAILED',
          experimentBatchId: batchId,
          experimentArm: arm,
        },
      })
    );

    payments.push(payment);
  }

  return payments;
}

async function runRecoverAIOnPayment(payment) {
  let current = payment;
  let attempts = 0;
  let escalated = false;
  let contacted = 0;
  let finalAction = 'unknown';

  while (attempts < MAX_ATTEMPTS) {
    const proposal = await getCachedOrFreshDecision(current);
    const policyResult = evaluatePolicy(current, proposal);

    finalAction = policyResult.action;

    if (policyResult.action === 'stop') {
      break;
    }

    if (policyResult.action === 'escalate') {
      escalated = true;
      break;
    }

    if (policyResult.action === 'notify_customer') {
      contacted++;

      current = await withRetry(() =>
        prisma.payment.update({
          where: { id: current.id },
          data: {
            notificationCount: { increment: 1 },
            lastNotifiedAt: new Date(),
          },
        })
      );

      const { success } = simulateNotificationOutcome(
        current.failureReason
      );

      if (success) {
        current = await withRetry(() =>
          prisma.payment.update({
            where: { id: current.id },
            data: {
              status: 'RECOVERED',
              recoveredAt: new Date(),
            },
          })
        );

        return {
          recovered: true,
          amount: current.amount,
          attempts,
          escalated,
          contacted,
          failureReason: current.failureReason,
          finalAction,
        };
      }

      break;
    }

    attempts++;

    const { success } = simulateRetryOutcome(
      current.failureReason,
      attempts
    );

    if (success) {
      current = await withRetry(() =>
        prisma.payment.update({
          where: { id: current.id },
          data: {
            status: 'RECOVERED',
            recoveredAt: new Date(),
            retryCount: attempts,
            lastRetryAt: new Date(),
          },
        })
      );

      return {
        recovered: true,
        amount: current.amount,
        attempts,
        escalated,
        contacted,
        failureReason: current.failureReason,
        finalAction,
      };
    }

    current = await withRetry(() =>
      prisma.payment.update({
        where: { id: current.id },
        data: {
          retryCount: attempts,
          lastRetryAt: new Date(),
        },
      })
    );
  }

  return {
    recovered: false,
    amount: current.amount,
    attempts,
    escalated,
    contacted,
    failureReason: current.failureReason,
    finalAction,
  };
}

async function runBaselineOnPayment(payment) {
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    const { success } = simulateRetryOutcome(
      payment.failureReason,
      attempts
    );

    if (success) {
      await withRetry(() =>
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'RECOVERED',
            recoveredAt: new Date(),
            retryCount: attempts,
          },
        })
      );

      return {
        recovered: true,
        amount: payment.amount,
        attempts,
        escalated: false,
        contacted: 0,
      };
    }
  }

  await withRetry(() =>
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        retryCount: attempts,
      },
    })
  );

  return {
    recovered: false,
    amount: payment.amount,
    attempts,
    escalated: false,
    contacted: 0,
  };
}

function buildFailureTypeBreakdown(results) {
  const breakdown = {};

  for (const r of results) {
    const reason = r.failureReason ?? 'unknown';

    if (!breakdown[reason]) {
      breakdown[reason] = {
        count: 0,
        totalAttempts: 0,
        recovered: 0,
        notified: 0,
      };
    }

    const b = breakdown[reason];

    b.count += 1;
    b.totalAttempts += r.attempts;

    if (r.recovered) {
      b.recovered += 1;
    }

    if (r.finalAction === 'notify_customer') {
      b.notified += 1;
    }
  }

  for (const reason in breakdown) {
    const b = breakdown[reason];

    b.avgAttempts = +(b.totalAttempts / b.count).toFixed(2);
    b.recoveryRate = +(b.recovered / b.count).toFixed(2);
  }

  return breakdown;
}

function aggregate(results, payments) {
  const revenueAtRisk = payments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const recovered = results.filter((r) => r.recovered);

  const revenueRecovered = recovered.reduce(
    (sum, r) => sum + r.amount,
    0
  );

  const totalAttempts = results.reduce(
    (sum, r) => sum + r.attempts,
    0
  );

  const escalations = results.filter(
    (r) => r.escalated
  ).length;

  const contacts = results.reduce(
    (sum, r) => sum + r.contacted,
    0
  );

  return {
    paymentsTested: results.length,
    revenueAtRisk,
    revenueRecovered,
    recoveryRate: results.length
      ? recovered.length / results.length
      : 0,
    avgAttempts: results.length
      ? totalAttempts / results.length
      : 0,
    escalations,
    customerContacts: contacts,
  };
}

export async function runExperiment(sampleSize = 40) {
  await withRetry(() => prisma.customer.count());

  decisionCache.clear();

  const batchId = `exp_${Date.now()}`;

  // Generate ONE set of payment scenarios.
  // Both arms will receive the exact same underlying failures.
  const specs = await createPaymentSpecs(sampleSize);

  // Materialize identical scenarios into both experiment arms.
  const recoverAIPayments = await materializePayments(
    specs,
    batchId,
    'recoverai'
  );

  const baselinePayments = await materializePayments(
    specs,
    batchId,
    'baseline'
  );

  const recoverAIResults = [];

  for (const p of recoverAIPayments) {
    recoverAIResults.push(
      await runRecoverAIOnPayment(p)
    );
  }

  const baselineResults = [];

  for (const p of baselinePayments) {
    baselineResults.push(
      await runBaselineOnPayment(p)
    );
  }

  const recoverAIStats = aggregate(
    recoverAIResults,
    recoverAIPayments
  );

  const baselineStats = aggregate(
    baselineResults,
    baselinePayments
  );

  return {
    batchId,
    sampleSize,

    recoverAI: {
      ...recoverAIStats,
      failureTypeBreakdown:
        buildFailureTypeBreakdown(recoverAIResults),
    },

    baseline: baselineStats,

    incrementalRevenue:
      recoverAIStats.revenueRecovered -
      baselineStats.revenueRecovered,
  };
}
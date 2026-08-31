import { prisma } from '../src/lib/prismaClient.js';
import { faker } from '@faker-js/faker';

const FAILURE_REASONS = [
  'insufficient_funds',
  'network_error',
  'bank_timeout',
  'temporary_decline',
  'expired_card',
  'hard_decline',
];

const METHODS = ['card', 'upi', 'netbanking'];

async function clearExistingData() {
  console.log('Clearing existing data...');
  // Delete in FK-safe order: children before parents
  await prisma.policyCheck.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.recoveryAttempt.deleteMany();
  await prisma.agentDecision.deleteMany();
  await prisma.agentState.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  console.log('Cleared.');
}

async function main() {
  await clearExistingData();
  console.log('Seeding database...');

  // Hand-crafted "hero" customers for a clean demo narrative
  const heroCustomers = await Promise.all([
    prisma.customer.create({
      data: { name: 'Rahul Sharma', email: 'rahul.sharma@example.com', successCount: 18, failCount: 1, ltv: 42000 },
    }),
    prisma.customer.create({
      data: { name: 'Priya Nair', email: 'priya.nair@example.com', successCount: 2, failCount: 6, ltv: 3200 },
    }),
    prisma.customer.create({
      data: { name: 'Arjun Mehta', email: 'arjun.mehta@example.com', successCount: 25, failCount: 0, ltv: 68000 },
    }),
  ]);

  // Random customers as before
  const customers = [...heroCustomers];
  for (let i = 0; i < 97; i++) {
    const successCount = faker.number.int({ min: 0, max: 20 });
    const failCount = faker.number.int({ min: 0, max: 8 });
    const customer = await prisma.customer.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        successCount,
        failCount,
        ltv: faker.number.float({ min: 500, max: 50000, fractionDigits: 2 }),
      },
    });
    customers.push(customer);
  }
  console.log(`Created ${customers.length} customers`);

  // Guaranteed hero-story payments — one per failure type, on hero customers, high enough to matter
  const heroPayments = [
    { customer: heroCustomers[0], failureReason: 'network_error', amount: 320000 },   // Rahul — high LTV, transient failure, should retry+recover
    { customer: heroCustomers[1], failureReason: 'insufficient_funds', amount: 45000 }, // Priya — low success rate, notify path
    { customer: heroCustomers[2], failureReason: 'hard_decline', amount: 890000 },     // Arjun — high value, terminal failure → escalate/stop story
  ];

  for (const hp of heroPayments) {
    await prisma.payment.create({
      data: {
        amount: hp.amount,
        currency: 'INR',
        customerId: hp.customer.id,
        status: 'FAILED',
        failureReason: hp.failureReason,
        method: faker.helpers.arrayElement(METHODS),
        retryCount: 0,
      },
    });
  }
  console.log(`Created ${heroPayments.length} hero-story payments`);

  // Random payments as before
  let paymentCount = 0;
  for (let i = 0; i < 300; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const failureReason = faker.helpers.arrayElement(FAILURE_REASONS);
    await prisma.payment.create({
      data: {
        amount: faker.number.int({ min: 9900, max: 900000 }),
        currency: 'INR',
        customerId: customer.id,
        status: 'FAILED',
        failureReason,
        method: faker.helpers.arrayElement(METHODS),
        retryCount: 0,
      },
    });
    paymentCount++;
  }
  console.log(`Created ${paymentCount} additional payments`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
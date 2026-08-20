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

async function main() {
  console.log('Seeding database...');

  // 1. Create customers
  const customers = [];
  for (let i = 0; i < 100; i++) {
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

  // 2. Create failed payments (simulating recurring/subscription failures)
  let paymentCount = 0;
  for (let i = 0; i < 300; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const failureReason = faker.helpers.arrayElement(FAILURE_REASONS);

    await prisma.payment.create({
      data: {
        amount: faker.number.int({ min: 9900, max: 499900 }), // in paise
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
  console.log(`Created ${paymentCount} failed payments`);

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
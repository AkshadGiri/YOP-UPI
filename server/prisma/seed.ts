import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

/**
 * Demo seed data (Section 23 of the spec).
 *
 * Uses upsert throughout so re-running `npm run seed` is safe and
 * idempotent — it won't create duplicates or crash on a unique constraint.
 * To fully wipe and reseed from scratch, use `npm run prisma:reset`, which
 * drops the database, re-applies migrations, and re-runs this script.
 *
 * DEMO_PASSWORD and DEMO_PIN below are intentionally weak/predictable —
 * this is seed data for a local demo, never used outside DEMO_MODE.
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_PIN = '1234';

const ARGON2_OPTS = {
  memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
  timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
  parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
};

type SeedBankAccount = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  balance: number;
  isPrimary: boolean;
};

type SeedUser = {
  name: string;
  phone: string;
  email: string;
  upiId: string;
  walletBalance: number;
  bankAccounts: SeedBankAccount[];
};

const SEED_USERS: SeedUser[] = [
  {
    name: 'Akshad',
    phone: '9876543210',
    email: 'akshad@example.com',
    upiId: 'akshad@demo',
    walletBalance: 2000,
    bankAccounts: [
      {
        bankName: 'HDFC Bank',
        accountHolderName: 'Akshad',
        accountNumber: '50100112340001',
        ifsc: 'HDFC0001234',
        balance: 20000,
        isPrimary: true,
      },
      {
        bankName: 'State Bank of India',
        accountHolderName: 'Akshad',
        accountNumber: '30200087650002',
        ifsc: 'SBIN0005678',
        balance: 10000,
        isPrimary: false,
      },
    ],
  },
  {
    name: 'Rahul',
    phone: '9876000000',
    email: 'rahul@example.com',
    upiId: 'rahul@demo',
    walletBalance: 500,
    bankAccounts: [
      {
        bankName: 'HDFC Bank',
        accountHolderName: 'Rahul',
        accountNumber: '50100112340003',
        ifsc: 'HDFC0001234',
        balance: 15000,
        isPrimary: true,
      },
    ],
  },
  {
    name: 'Priya',
    phone: '9876111111',
    email: 'priya@example.com',
    upiId: 'priya@demo',
    walletBalance: 1000,
    bankAccounts: [
      {
        bankName: 'State Bank of India',
        accountHolderName: 'Priya',
        accountNumber: '30200087650004',
        ifsc: 'SBIN0005678',
        balance: 8000,
        isPrimary: true,
      },
    ],
  },
];

async function main() {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding demo data...');

  const passwordHash = await argon2.hash(DEMO_PASSWORD, ARGON2_OPTS);
  const pinHash = await argon2.hash(DEMO_PIN, ARGON2_OPTS);

  for (const seedUser of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { phone: seedUser.phone },
      update: {
        name: seedUser.name,
        email: seedUser.email,
        upiId: seedUser.upiId,
      },
      create: {
        name: seedUser.name,
        phone: seedUser.phone,
        email: seedUser.email,
        upiId: seedUser.upiId,
        passwordHash,
        pinHash,
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: seedUser.walletBalance },
      create: { userId: user.id, balance: seedUser.walletBalance },
    });

    for (const acc of seedUser.bankAccounts) {
      await prisma.bankAccount.upsert({
        where: { userId_accountNumber: { userId: user.id, accountNumber: acc.accountNumber } },
        update: {
          bankName: acc.bankName,
          accountHolderName: acc.accountHolderName,
          ifsc: acc.ifsc,
          balance: acc.balance,
          isPrimary: acc.isPrimary,
        },
        create: {
          userId: user.id,
          bankName: acc.bankName,
          accountHolderName: acc.accountHolderName,
          accountNumber: acc.accountNumber,
          ifsc: acc.ifsc,
          balance: acc.balance,
          isPrimary: acc.isPrimary,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`  ✓ ${seedUser.name} (${seedUser.upiId}) — wallet ₹${seedUser.walletBalance}`);
  }

  // eslint-disable-next-line no-console
  console.log('\n✅ Seed complete. Demo login credentials (DEMO_MODE only):');
  // eslint-disable-next-line no-console
  console.log(`   Password for all seed users: ${DEMO_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`   UPI PIN for all seed users:  ${DEMO_PIN}`);
  // eslint-disable-next-line no-console
  console.log(`   Mock OTP (any phone):        ${process.env.DEV_MOCK_OTP ?? '123456'}`);
  // eslint-disable-next-line no-console
  console.log('   Phones: 9876543210 (Akshad), 9876000000 (Rahul), 9876111111 (Priya)');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

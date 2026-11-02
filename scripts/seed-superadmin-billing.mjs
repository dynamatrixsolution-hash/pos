import { PrismaClient } from '../packages/db/client/index.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const envContent = readFileSync(path.resolve(process.cwd(), '.env.restro.local'), 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  if (line.trim() && !line.trimStart().startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      process.env[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }
}

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  console.log('Seeding Phase 1 Super Admin Billing, Modules, and Audit data...');

  const superAdmin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!superAdmin) {
    throw new Error('Super Admin user not found! Please ensure superadmin is seeded first.');
  }

  const demoBusiness = await db.business.findUnique({
    where: { slug: 'restroinn-demo' },
    include: { subscription: true },
  });

  if (demoBusiness) {
    await db.business.update({
      where: { id: demoBusiness.id },
      data: {
        status: 'ACTIVE',
      },
    });

    const bothModules = [
      'POS',
      'TABLES',
      'MENU',
      'KDS',
      'ROOMS',
      'RESERVATIONS',
      'HOUSEKEEPING',
      'FOLIOS',
      'ROOM_SERVICE',
    ];

    if (demoBusiness.subscription) {
      await db.subscription.update({
        where: { id: demoBusiness.subscription.id },
        data: {
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          billingCycle: 'ANNUAL',
          packageType: 'BOTH',
          enabledModules: bothModules,
          branchLimit: 5,
          userLimit: 25,
          customLimits: { roomsLimit: 100, tablesLimit: 50 },
        },
      });
    } else {
      await db.subscription.create({
        data: {
          businessId: demoBusiness.id,
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          billingCycle: 'ANNUAL',
          packageType: 'BOTH',
          enabledModules: bothModules,
          startDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
          endDate: new Date(Date.now() + 305 * 24 * 3600 * 1000),
          branchLimit: 5,
          userLimit: 25,
          customLimits: { roomsLimit: 100, tablesLimit: 50 },
        },
      });
    }

    // Seed sample invoices for demo business
    const inv1 = await db.subscriptionInvoice.upsert({
      where: { invoiceNumber: 'INV-SAAS-2026-001' },
      update: {},
      create: {
        businessId: demoBusiness.id,
        invoiceNumber: 'INV-SAAS-2026-001',
        amount: 36000.0,
        currency: 'NPR',
        status: 'PAID',
        billingPeriodStart: new Date(Date.now() - 60 * 24 * 3600 * 1000),
        billingPeriodEnd: new Date(Date.now() + 305 * 24 * 3600 * 1000),
        dueDate: new Date(Date.now() - 45 * 24 * 3600 * 1000),
        paidAt: new Date(Date.now() - 48 * 24 * 3600 * 1000),
        notes: 'Annual Enterprise SaaS Subscription (Hotel + Restaurant package)',
      },
    });

    await db.subscriptionPayment.create({
      data: {
        businessId: demoBusiness.id,
        invoiceId: inv1.id,
        amount: 36000.0,
        currency: 'NPR',
        paymentMethod: 'BANK_TRANSFER',
        reference: 'TXN-BANK-9988231',
        notes: 'Nabil Bank Wire Transfer verified by super admin',
        recordedById: superAdmin.id,
        recordedAt: new Date(Date.now() - 48 * 24 * 3600 * 1000),
      },
    });
  }

  // 2. Create Restaurant business: Himalayan Coffee Roasters
  const pwHash = await bcrypt.hash('Password123!', 10);
  let restaurantBiz = await db.business.findUnique({ where: { slug: 'himalayan-coffee' } });
  if (!restaurantBiz) {
    restaurantBiz = await db.business.create({
      data: {
        name: 'Himalayan Coffee Roasters',
        slug: 'himalayan-coffee',
        currency: 'NPR',
        email: 'manager@himalayancoffee.np',
        phone: '+977-1-4422331',
        address: 'Jhamsikhel, Lalitpur',
        status: 'ACTIVE',
        subscription: {
          create: {
            plan: 'STARTER',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            packageType: 'RESTAURANT',
            enabledModules: ['POS', 'TABLES', 'MENU', 'KDS'],
            startDate: new Date(Date.now() - 15 * 24 * 3600 * 1000),
            endDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
            branchLimit: 1,
            userLimit: 5,
          },
        },
        branches: {
          create: {
            name: 'Jhamsikhel Branch',
            isMain: true,
            isActive: true,
            address: 'Jhamsikhel, Lalitpur',
          },
        },
      },
    });

    const restOwner = await db.user.create({
      data: {
        businessId: restaurantBiz.id,
        name: 'Suman Shrestha',
        email: 'suman@himalayancoffee.np',
        passwordHash: pwHash,
        role: 'OWNER',
        phone: '+977-9841000111',
      },
    });

    const inv2 = await db.subscriptionInvoice.create({
      data: {
        businessId: restaurantBiz.id,
        invoiceNumber: 'INV-SAAS-2026-002',
        amount: 2500.0,
        currency: 'NPR',
        status: 'PAID',
        billingPeriodStart: new Date(Date.now() - 15 * 24 * 3600 * 1000),
        billingPeriodEnd: new Date(Date.now() + 15 * 24 * 3600 * 1000),
        dueDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        paidAt: new Date(Date.now() - 12 * 24 * 3600 * 1000),
        notes: 'Monthly Starter Subscription (Restaurant package)',
      },
    });

    await db.subscriptionPayment.create({
      data: {
        businessId: restaurantBiz.id,
        invoiceId: inv2.id,
        amount: 2500.0,
        currency: 'NPR',
        paymentMethod: 'ESEWA',
        reference: 'ESEWA-REF-442299',
        notes: 'eSewa Merchant payment confirmation',
        recordedById: superAdmin.id,
      },
    });
  }

  // 3. Create Hotel business: Pokhara Lakeside Suites (Pending invoice / Overdue renewal)
  let hotelBiz = await db.business.findUnique({ where: { slug: 'pokhara-lakeside' } });
  if (!hotelBiz) {
    hotelBiz = await db.business.create({
      data: {
        name: 'Pokhara Lakeside Suites',
        slug: 'pokhara-lakeside',
        currency: 'NPR',
        email: 'reservations@pokharasuites.com',
        phone: '+977-61-460111',
        address: 'Lakeside-6, Pokhara',
        status: 'ACTIVE',
        subscription: {
          create: {
            plan: 'PROFESSIONAL',
            status: 'OVERDUE',
            billingCycle: 'MONTHLY',
            packageType: 'HOTEL',
            enabledModules: ['ROOMS', 'RESERVATIONS', 'HOUSEKEEPING', 'FOLIOS'],
            startDate: new Date(Date.now() - 40 * 24 * 3600 * 1000),
            endDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
            gracePeriodDays: 7,
            branchLimit: 2,
            userLimit: 12,
            customLimits: { roomsLimit: 30 },
          },
        },
        branches: {
          create: {
            name: 'Lakeside Central',
            isMain: true,
            isActive: true,
            address: 'Lakeside-6, Pokhara',
          },
        },
      },
    });

    await db.user.create({
      data: {
        businessId: hotelBiz.id,
        name: 'Deepak Gurung',
        email: 'deepak@pokharasuites.com',
        passwordHash: pwHash,
        role: 'OWNER',
        phone: '+977-9856000222',
      },
    });

    await db.subscriptionInvoice.create({
      data: {
        businessId: hotelBiz.id,
        invoiceNumber: 'INV-SAAS-2026-003',
        amount: 5500.0,
        currency: 'NPR',
        status: 'OVERDUE',
        billingPeriodStart: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        billingPeriodEnd: new Date(Date.now() + 20 * 24 * 3600 * 1000),
        dueDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
        notes: 'Monthly Professional Subscription (Hotel package) - Overdue renewal notice dispatched',
      },
    });
  }

  // 4. Seed pending registration request
  await db.businessRegistrationRequest.upsert({
    where: { trackingCode: 'REQ-2026-98AB' },
    update: {},
    create: {
      trackingCode: 'REQ-2026-98AB',
      businessName: 'Lumbini Garden Retreat & Boutique',
      slug: 'lumbini-garden',
      businessType: 'HOTEL_RESTAURANT',
      currency: 'NPR',
      email: 'gm@lumbinigarden.com',
      phone: '+977-71-580123',
      address: 'Peace Zone, Lumbini',
      plan: 'PROFESSIONAL',
      billingCycle: 'ANNUAL',
      ownerName: 'Anil Shakya',
      ownerEmail: 'anil.shakya@gmail.com',
      ownerPhone: '+977-9801234567',
      passwordHash: pwHash,
      status: 'PENDING',
      selectedModules: ['POS', 'TABLES', 'ROOMS', 'RESERVATIONS', 'HOUSEKEEPING', 'FOLIOS'],
    },
  });

  // 5. Seed Platform Backup Records
  const countBackups = await db.platformBackupRecord.count();
  if (countBackups === 0) {
    await db.platformBackupRecord.createMany({
      data: [
        {
          backupFileName: 'restroinn_prod_db_20261101_040000.sql.gz',
          backupType: 'DATABASE_DUMP',
          sizeBytes: BigInt(48234496), // ~46 MB
          status: 'SUCCESS',
          verifiedRestore: true,
          restoreTestedAt: new Date(Date.now() - 8 * 3600 * 1000),
          restoreTestResult: 'PASS',
          restoreNotes: 'Automated test restoration into isolated scratch environment succeeded in 14.2s. Integrity checksum verified.',
          durationSec: 18,
          createdAt: new Date(Date.now() - 14 * 3600 * 1000),
        },
        {
          backupFileName: 'restroinn_prod_db_20261031_040000.sql.gz',
          backupType: 'DATABASE_DUMP',
          sizeBytes: BigInt(47812000),
          status: 'SUCCESS',
          verifiedRestore: true,
          restoreTestedAt: new Date(Date.now() - 32 * 3600 * 1000),
          restoreTestResult: 'PASS',
          restoreNotes: 'Automated test restoration verified tables, relations, and indexes.',
          durationSec: 17,
          createdAt: new Date(Date.now() - 38 * 3600 * 1000),
        },
      ],
    });
  }

  // 6. Seed Platform Audit Logs
  const countLogs = await db.platformAuditLog.count();
  if (countLogs === 0 && demoBusiness) {
    await db.platformAuditLog.createMany({
      data: [
        {
          actorId: superAdmin.id,
          actorRole: 'SUPER_ADMIN',
          action: 'PLAN_CHANGED',
          targetType: 'SUBSCRIPTION',
          targetId: demoBusiness.id,
          businessId: demoBusiness.id,
          reason: 'Initial platform onboarding enterprise upgrade',
          beforeState: { plan: 'STARTER', packageType: 'RESTAURANT' },
          afterState: { plan: 'ENTERPRISE', packageType: 'BOTH' },
          createdAt: new Date(Date.now() - 50 * 24 * 3600 * 1000),
        },
        {
          actorId: superAdmin.id,
          actorRole: 'SUPER_ADMIN',
          action: 'BACKUP_TESTED',
          targetType: 'SYSTEM',
          reason: 'Daily automated recovery rehearsal verification',
          beforeState: { lastTested: null },
          afterState: { status: 'PASS', durationSec: 14 },
          createdAt: new Date(Date.now() - 8 * 3600 * 1000),
        },
      ],
    });
  }

  // 7. Seed Support Notes
  const countNotes = await db.platformSupportNote.count();
  if (countNotes === 0 && demoBusiness) {
    await db.platformSupportNote.create({
      data: {
        businessId: demoBusiness.id,
        authorId: superAdmin.id,
        title: 'POS Terminal Calibration Assistance',
        content: 'Client requested guidance on setting up Epson TM-T88VI thermal receipt printer. Remote support session completed successfully.',
        category: 'TECHNICAL',
        priority: 'NORMAL',
        isResolved: true,
        resolvedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      },
    });
  }

  console.log('Phase 1 Super Admin Billing, Modules, and Audit data seeded successfully!');
}

main()
  .catch(e => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });


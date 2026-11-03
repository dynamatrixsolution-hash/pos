const fs = require('fs');
const path = require('path');

if (fs.existsSync('.env.restro.local')) {
  const envContent = fs.readFileSync('.env.restro.local', 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  }
}

const { PrismaClient } = require(path.resolve(__dirname, '../packages/db/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING PHASE 4 SUPPLIERS, PURCHASES & AP/AR DATA ---');

  const business = await prisma.business.findFirst({ where: { slug: 'restroinn-grand' } });
  if (!business) throw new Error('Business restroinn-grand not found');
  const branch = await prisma.branch.findFirst({ where: { businessId: business.id } });
  const user = await prisma.user.findFirst({ where: { businessId: business.id } });

  // 1. Create or Find Suppliers
  const supplierConfigs = [
    {
      name: 'Himalayan Fresh Meat & Poultry',
      contactName: 'Bikram Thapa',
      phone: '+977-9801234567',
      email: 'bikram@himalayanmeat.np',
      address: 'Kalimati Wholesale Meat Market, Kathmandu',
      balance: 18500.00 // Debt we owe
    },
    {
      name: 'Valley Organic Agro & Farm Produce',
      contactName: 'Sita Dahal',
      phone: '+977-9841890123',
      email: 'sita@valleyagro.np',
      address: 'Balkhu Agriculture Market, Kathmandu',
      balance: 6400.00 // Debt we owe
    },
    {
      name: 'Everest Flour Mills & Dairy Co.',
      contactName: 'Rajesh Agrawal',
      phone: '+977-9851098765',
      email: 'orders@everestflour.np',
      address: 'Hetauda Industrial Area / Teku Depot',
      balance: 0.00 // Fully paid
    },
    {
      name: 'Capital Beverage & Spirits Depot',
      contactName: 'Sunil Shrestha',
      phone: '+977-9813567890',
      email: 'sales@capitalbeverage.np',
      address: 'Lazimpat, Kathmandu',
      balance: 12000.00 // Debt we owe
    }
  ];

  const createdSuppliers = [];
  for (const cfg of supplierConfigs) {
    let s = await prisma.supplier.findFirst({
      where: { businessId: business.id, name: cfg.name }
    });
    if (!s) {
      s = await prisma.supplier.create({
        data: {
          businessId: business.id,
          name: cfg.name,
          contactName: cfg.contactName,
          phone: cfg.phone,
          email: cfg.email,
          address: cfg.address,
          balance: cfg.balance
        }
      });
      console.log(`✅ Created Supplier: ${s.name} (Outstanding AP Balance: NPR ${s.balance})`);

      // Create Ledger entry if balance > 0
      if (cfg.balance > 0) {
        await prisma.supplierLedger.create({
          data: {
            supplierId: s.id,
            type: 'PURCHASE',
            reference: 'INV-INITIAL',
            debit: 0,
            credit: cfg.balance,
            balance: cfg.balance,
            description: 'Opening procurement balance (Raw ingredients supplied on credit)'
          }
        });
      }
    } else {
      console.log(`✅ Found Supplier: ${s.name} (Balance: NPR ${s.balance})`);
    }
    createdSuppliers.push(s);
  }

  // 2. Link raw products to purchases
  const buffMeat = await prisma.product.findFirst({ where: { businessId: business.id, sku: 'RAW-BUFF-MINCE' } });
  const flour = await prisma.product.findFirst({ where: { businessId: business.id, sku: 'RAW-FLOUR-MOMO' } });
  const onions = await prisma.product.findFirst({ where: { businessId: business.id, sku: 'RAW-VEG-ONION' } });

  // Create a sample recent Purchase if none exists
  const existingPurchase = await prisma.purchase.findFirst({ where: { businessId: business.id } });
  if (!existingPurchase && buffMeat && flour && onions) {
    const meatSupplier = createdSuppliers[0];
    const purchase = await prisma.purchase.create({
      data: {
        businessId: business.id,
        branchId: branch.id,
        supplierId: meatSupplier.id,
        userId: user.id,
        purchaseNumber: 'PO-2026-001',
        invoiceNumber: 'HFM-9812',
        status: 'RECEIVED',
        paymentStatus: 'PARTIAL',
        subtotal: 25000.00,
        tax: 0,
        discount: 0,
        total: 25000.00,
        paidAmount: 6500.00,
        notes: 'Weekly fresh butchered buffalo meat & trimming delivery',
        purchaseItems: {
          create: [
            {
              productId: buffMeat.id,
              quantity: 50.0,
              price: 500.00
            }
          ]
        }
      }
    });
    console.log(`✅ Logged Purchase Order #${purchase.purchaseNumber} for ${meatSupplier.name}: Total NPR 25,000 (Paid NPR 6,500, Due NPR 18,500)`);
  }

  // 3. Ensure a Delivery order with pending Cash on Delivery (COD) is present for Accounts Receivable
  const pendingCodOrder = await prisma.restaurantOrder.findFirst({
    where: {
      businessId: business.id,
      orderType: 'DELIVERY',
      settlementStatus: { not: 'PAID' }
    }
  });

  if (!pendingCodOrder) {
    const codOrder = await prisma.restaurantOrder.create({
      data: {
        businessId: business.id,
        branchId: branch.id,
        orderNumber: 'RO-DELIV-COD-01',
        orderType: 'DELIVERY',
        acceptanceStatus: 'ACCEPTED',
        fulfillmentStatus: 'READY',
        settlementStatus: 'UNPAID', // Uncollected Cash On Delivery
        subtotal: 1280.00,
        taxTotal: 166.40,
        totalAmount: 1446.40,
        paidAmount: 0.00,
        notes: '[DELIVERY] Customer: Bipin Basnet | Phone: 9818990011 | Address: Sanepa Heights, Lalitpur | Rider: Kuber | Delivery Fee: 120 | Pending COD Collection',
        version: 1
      }
    });
    console.log(`✅ Logged Pending Delivery COD order for Accounts Receivable: #${codOrder.orderNumber} (Pending NPR ${codOrder.totalAmount})`);
  } else {
    console.log(`✅ Found Pending Delivery COD order: #${pendingCodOrder.orderNumber}`);
  }

  console.log('\n🎉 PHASE 4 SEEDING COMPLETE!');
}

main().catch(console.error).finally(() => prisma.$disconnect());


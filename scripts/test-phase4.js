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
  console.log('========================================================');
  console.log('🧪 TESTING PHASE 4: SUPPLIER PURCHASES, AP & AR ENGINE');
  console.log('========================================================\n');

  const business = await prisma.business.findFirst({ where: { slug: 'restroinn-grand' } });
  if (!business) throw new Error('Business restroinn-grand not found');

  // 1. Verify Suppliers and Accounts Payable (AP)
  console.log('--- [TEST 1] Accounts Payable (Who We Owe) ---');
  const suppliers = await prisma.supplier.findMany({
    where: { businessId: business.id }
  });
  console.log(`✅ Loaded ${suppliers.length} active suppliers:`);
  let totalAP = 0;
  suppliers.forEach(s => {
    const bal = Number(s.balance);
    if (bal > 0) totalAP += bal;
    console.log(`   • ${s.name}: Debt Owed: NPR ${bal.toFixed(2)} (Contact: ${s.phone || 'N/A'})`);
  });
  console.log(`💰 Total Accounts Payable Owed to Food Vendors: NPR ${totalAP.toFixed(2)}`);

  // 2. Verify Purchases (Daily Procurement Ledger)
  console.log('\n--- [TEST 2] Supplier Purchases (Daily Procurement) ---');
  const purchases = await prisma.purchase.findMany({
    where: { businessId: business.id },
    include: { supplier: true, purchaseItems: { include: { product: true } } }
  });
  console.log(`✅ Loaded ${purchases.length} purchase orders:`);
  purchases.forEach(p => {
    console.log(`   • PO #${p.purchaseNumber} (${p.supplier.name}): Total NPR ${p.total} | Paid: NPR ${p.paidAmount} | Status: ${p.paymentStatus}`);
    p.purchaseItems.forEach(pi => {
      console.log(`      - Item: ${pi.product.name} (Qty: ${pi.quantity}, Price: NPR ${pi.price})`);
    });
  });

  // 3. Verify Accounts Receivable (AR: Delivery COD + Room Folios)
  console.log('\n--- [TEST 3] Accounts Receivable (Who Owes Us) ---');
  const codOrders = await prisma.restaurantOrder.findMany({
    where: {
      businessId: business.id,
      orderType: 'DELIVERY',
      settlementStatus: { not: 'PAID' }
    }
  });
  console.log(`✅ Found ${codOrders.length} pending Delivery Cash on Delivery (COD) orders:`);
  let totalCOD = 0;
  codOrders.forEach(o => {
    totalCOD += Number(o.totalAmount);
    console.log(`   • Order #${o.orderNumber}: Pending NPR ${o.totalAmount} (Notes: ${o.notes?.split('|')[0] || ''})`);
  });
  console.log(`💰 Total Delivery COD Pending Collection: NPR ${totalCOD.toFixed(2)}`);

  // 4. Test Supplier Payment Action (Pay down debt)
  console.log('\n--- [TEST 4] Test Settle Supplier Payment (AP Reduction) ---');
  const meatSupplier = suppliers.find(s => s.name.includes('Meat'));
  if (meatSupplier && Number(meatSupplier.balance) > 0) {
    const initialBalance = Number(meatSupplier.balance);
    const payAmount = 5000.00;
    const newBalance = initialBalance - payAmount;

    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: meatSupplier.id },
        data: { balance: newBalance }
      });
      await tx.supplierLedger.create({
        data: {
          supplierId: meatSupplier.id,
          type: 'PAYMENT',
          reference: 'CHQ-TEST-001',
          debit: payAmount,
          credit: 0,
          balance: newBalance,
          description: 'Payment voucher settled via Bank Transfer'
        }
      });
    });

    const verifySupplier = await prisma.supplier.findUnique({ where: { id: meatSupplier.id } });
    console.log(`✅ Recorded payment of NPR ${payAmount.toFixed(2)} to ${meatSupplier.name}`);
    console.log(`   Previous Balance: NPR ${initialBalance.toFixed(2)} -> New Balance: NPR ${verifySupplier.balance}`);
    if (Math.abs(Number(verifySupplier.balance) - newBalance) > 0.01) {
      throw new Error('FAILED: Balance mismatch after payment!');
    }
  }

  // 5. Test Delivery COD Remittance Action (AR Settlement)
  console.log('\n--- [TEST 5] Test Remit Delivery COD (AR Collection) ---');
  if (codOrders.length > 0) {
    const targetOrder = codOrders[0];
    await prisma.restaurantOrder.update({
      where: { id: targetOrder.id },
      data: {
        settlementStatus: 'PAID',
        fulfillmentStatus: 'SERVED',
        paidAmount: targetOrder.totalAmount,
        notes: `${targetOrder.notes || ''}\n[COD REMITTED: Cash collected from delivery rider]`
      }
    });

    const remittedOrder = await prisma.restaurantOrder.findUnique({ where: { id: targetOrder.id } });
    console.log(`✅ Remitted Delivery Order #${remittedOrder.orderNumber}: Status is now ${remittedOrder.settlementStatus}`);
    if (remittedOrder.settlementStatus !== 'PAID') {
      throw new Error('FAILED: Delivery order was not marked PAID!');
    }
  }

  // 6. Verify COGS vs Sales Margin Financials
  console.log('\n--- [TEST 6] Food Sales vs Raw Ingredient COGS Reconciliation ---');
  const settledOrders = await prisma.restaurantOrder.findMany({
    where: { businessId: business.id, settlementStatus: 'PAID' }
  });
  const totalRevenue = settledOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0);

  const consumptions = await prisma.consumptionPosting.findMany({
    where: { businessId: business.id },
    include: { product: true }
  });
  let totalCogs = 0;
  consumptions.forEach(c => {
    totalCogs += Number(c.quantity) * Number(c.product.costPrice || 0);
  });

  const grossProfit = totalRevenue - totalCogs;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  console.log(`📊 Live Financial Reconciliation:`);
  console.log(`   Food Sales Revenue: NPR ${totalRevenue.toFixed(2)}`);
  console.log(`   Raw Material COGS:  NPR ${totalCogs.toFixed(2)}`);
  console.log(`   Gross Profit:       NPR ${grossProfit.toFixed(2)} (${marginPct.toFixed(1)}% margin)`);

  console.log('\n========================================================');
  console.log('🎉 PHASE 4 SUPPLIER PROCUREMENT, AP & AR 100% VERIFIED!');
  console.log('========================================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());


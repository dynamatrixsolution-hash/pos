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

// Load services
const { createOrAppendOrder, RestaurantOrderError } = require(path.resolve(__dirname, '../backend/src/lib/services/restaurant-order-service'));
const { routeOrderRoundToStations, advanceTicketStatus } = require(path.resolve(__dirname, '../backend/src/lib/services/kitchen-routing-service'));

async function main() {
  console.log('========================================================');
  console.log('🧪 TESTING PHASE 3: AUTOMATED INVENTORY LOCKOUT & DEPLETION');
  console.log('========================================================\n');

  const business = await prisma.business.findFirst({
    where: { slug: 'restroinn-grand' }
  });
  if (!business) throw new Error('Business not found');
  const branch = await prisma.branch.findFirst({ where: { businessId: business.id } });
  if (!branch) throw new Error('Branch not found');

  // Find Grand Himalayan Buff Momo
  const momoItem = await prisma.menuItem.findFirst({
    where: { businessId: business.id, name: 'Grand Himalayan Buff Momo' },
    include: {
      recipeVersions: {
        where: { isActive: true },
        include: { ingredients: { include: { product: true } } }
      }
    }
  });

  if (!momoItem || momoItem.recipeVersions.length === 0) {
    throw new Error('Grand Himalayan Buff Momo or its recipe not found');
  }

  const recipe = momoItem.recipeVersions[0];
  console.log(`✅ Loaded Recipe for "${momoItem.name}": Yield: ${recipe.yieldQuantity} ${recipe.yieldUnit}, Ingredients: ${recipe.ingredients.length}`);
  
  const buffMeatIng = recipe.ingredients.find(i => i.product.name.includes('Meat'));
  if (!buffMeatIng) throw new Error('Meat ingredient not found in recipe');

  console.log(`   Key Ingredient: ${buffMeatIng.product.name} (Requires ${buffMeatIng.quantity} ${buffMeatIng.unit} per plate)`);

  // -------------------------------------------------------------------------
  // TEST 1: STRICT INVENTORY LOCKOUT WHEN INGREDIENT STOCK IS 0
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 1] Inventory Lockout Check (Simulate Out-Of-Stock) ---');
  // Set meat stock to 0
  await prisma.productStock.upsert({
    where: {
      productId_branchId: { productId: buffMeatIng.productId, branchId: branch.id }
    },
    update: { quantity: 0 },
    create: { productId: buffMeatIng.productId, branchId: branch.id, quantity: 0 }
  });
  console.log(`📦 Forced stock of "${buffMeatIng.product.name}" to 0.00 kg`);

  let lockoutSucceeded = false;
  try {
    await createOrAppendOrder({
      businessId: business.id,
      branchId: branch.id,
      orderType: 'DINE_IN',
      items: [
        {
          menuItemId: momoItem.id,
          itemName: momoItem.name,
          basePrice: momoItem.basePrice,
          quantity: 2
        }
      ]
    });
  } catch (err) {
    if (err instanceof RestaurantOrderError) {
      lockoutSucceeded = true;
      console.log('🛡️ LOCKOUT INTERCEPTED ORDER SUCCESSFULLY!');
      console.log(`   Error status: ${err.statusCode}`);
      console.log(`   Reason: "${err.message}"`);
    } else {
      console.error('Unexpected error:', err);
    }
  }

  if (!lockoutSucceeded) {
    throw new Error('FAILED: Order was placed despite 0 meat stock!');
  }

  // -------------------------------------------------------------------------
  // TEST 2: REPLENISH INVENTORY AND PLACE ORDER
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 2] Replenish Stock & Place Valid Order ---');
  await prisma.productStock.update({
    where: {
      productId_branchId: { productId: buffMeatIng.productId, branchId: branch.id }
    },
    data: { quantity: 10.0 }
  });
  console.log(`📦 Replenished stock of "${buffMeatIng.product.name}" to 10.00 kg`);

  const orderResult = await createOrAppendOrder({
    businessId: business.id,
    branchId: branch.id,
    orderType: 'DINE_IN',
    items: [
      {
        menuItemId: momoItem.id,
        itemName: momoItem.name,
        basePrice: momoItem.basePrice,
        quantity: 2 // 2 plates of momo
      }
    ]
  });

  console.log(`✅ Order placed: Order #${orderResult.order.orderNumber}, Round #${orderResult.round.roundNumber}`);
  console.log(`   Subtotal: NPR ${orderResult.order.subtotal}, Total: NPR ${orderResult.order.totalAmount}`);

  // -------------------------------------------------------------------------
  // TEST 3: ROUTE TO KITCHEN AND AUTOMATED STOCK DEPLETION ON COOKING (READY)
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 3] Kitchen Routing & Automated Stock Depletion ---');
  const tickets = await routeOrderRoundToStations({
    businessId: business.id,
    roundId: orderResult.round.id
  });

  console.log(`👨‍🍳 Routed to kitchen: Created ${tickets.length} ticket(s)`);
  const ticket = tickets[0];
  console.log(`   Ticket #${ticket.ticketNumber} | Status: ${ticket.status} | Lines: ${ticket.lines.length}`);

  // Advance ticket status to READY
  console.log(`🍳 Chef marks ticket #${ticket.ticketNumber} as READY...`);
  await advanceTicketStatus({
    businessId: business.id,
    ticketId: ticket.id,
    newStatus: 'READY'
  });

  // Verify updated stock
  const postStock = await prisma.productStock.findFirst({
    where: { productId: buffMeatIng.productId, branchId: branch.id }
  });

  // Expected deduction: 2 plates * 0.25 kg * (1 + 5% wastage) = 0.525 kg
  // Starting: 10.00 kg -> Expected: 9.475 kg
  const expectedRemaining = 10.0 - (2 * 0.25 * 1.05);
  console.log(`📊 Stock Verification for "${buffMeatIng.product.name}":`);
  console.log(`   Initial: 10.000 kg`);
  console.log(`   Current: ${postStock.quantity} kg`);
  console.log(`   Expected: ${expectedRemaining.toFixed(3)} kg`);

  if (Math.abs(postStock.quantity - expectedRemaining) > 0.001) {
    throw new Error(`FAILED: Stock discrepancy! Expected ${expectedRemaining}, got ${postStock.quantity}`);
  }
  console.log(`✅ EXACT INGREDIENT DEDUCTION CONFIRMED! Deducted ${(10.0 - postStock.quantity).toFixed(3)} kg`);

  // Verify ConsumptionPosting
  const postings = await prisma.consumptionPosting.findMany({
    where: { businessId: business.id, ticketLineId: ticket.lines[0].id },
    include: { product: true }
  });
  console.log(`✅ Verified ${postings.length} ConsumptionPosting records logged for ticket line:`);
  postings.forEach(p => {
    console.log(`   • ${p.product.name}: -${p.quantity} ${p.unit}`);
  });

  // -------------------------------------------------------------------------
  // TEST 4: IDEMPOTENCY CHECK (Advancing to SERVED should NOT deduct twice)
  // -------------------------------------------------------------------------
  console.log('\n--- [TEST 4] Idempotency Check ---');
  await advanceTicketStatus({
    businessId: business.id,
    ticketId: ticket.id,
    newStatus: 'SERVED'
  });

  const finalStock = await prisma.productStock.findFirst({
    where: { productId: buffMeatIng.productId, branchId: branch.id }
  });
  console.log(`   Stock after SERVED: ${finalStock.quantity} kg (Must stay ${expectedRemaining.toFixed(3)} kg)`);
  if (Math.abs(finalStock.quantity - expectedRemaining) > 0.001) {
    throw new Error('FAILED: Double deduction occurred on SERVED!');
  }
  console.log('✅ Idempotency passed! No double deduction.');

  console.log('\n========================================================');
  console.log('🎉 PHASE 3 AUTOMATED INVENTORY ENGINE 100% VERIFIED!');
  console.log('========================================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());


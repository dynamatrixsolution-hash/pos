import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // 0. Clear existing data to make seed re-runnable
  console.log("Clearing existing data...");
  try { await prisma.customerLedger.deleteMany({}); } catch (e) {}
  try { await prisma.supplierLedger.deleteMany({}); } catch (e) {}
  try { await prisma.payment.deleteMany({}); } catch (e) {}
  try { await prisma.saleItem.deleteMany({}); } catch (e) {}
  try { await prisma.saleReturn.deleteMany({}); } catch (e) {}
  try { await prisma.sale.deleteMany({}); } catch (e) {}
  try { await prisma.purchaseItem.deleteMany({}); } catch (e) {}
  try { await prisma.purchaseReturn.deleteMany({}); } catch (e) {}
  try { await prisma.purchase.deleteMany({}); } catch (e) {}
  try { await prisma.expense.deleteMany({}); } catch (e) {}
  try { await prisma.expenseCategory.deleteMany({}); } catch (e) {}
  try { await prisma.income.deleteMany({}); } catch (e) {}
  try { await prisma.incomeCategory.deleteMany({}); } catch (e) {}
  try { await prisma.openingStock.deleteMany({}); } catch (e) {}
  try { await prisma.batch.deleteMany({}); } catch (e) {}
  try { await prisma.productStock.deleteMany({}); } catch (e) {}
  try { await prisma.product.deleteMany({}); } catch (e) {}
  try { await prisma.category.deleteMany({}); } catch (e) {}
  try { await prisma.brand.deleteMany({}); } catch (e) {}
  try { await prisma.unit.deleteMany({}); } catch (e) {}
  try { await prisma.customer.deleteMany({}); } catch (e) {}
  try { await prisma.supplier.deleteMany({}); } catch (e) {}
  try { await prisma.auditLog.deleteMany({}); } catch (e) {}
  try { await prisma.notification.deleteMany({}); } catch (e) {}
  try { await prisma.user.deleteMany({}); } catch (e) {}
  try { await prisma.branch.deleteMany({}); } catch (e) {}
  try { await prisma.subscription.deleteMany({}); } catch (e) {}
  try { await prisma.business.deleteMany({}); } catch (e) {}

  // 1. Create Business
  const business = await prisma.business.upsert({
    where: { slug: "dynapos-retail-demo" },
    update: {},
    create: {
      name: "DynaPOS Retail Demo",
      slug: "dynapos-retail-demo",
      phone: "+1-555-0199",
      email: "info@dynapos.com",
      address: "123 Main St, New York, NY",
      currency: "USD",
      taxConfig: { taxName: "VAT", rate: 10 },
      settings: {},
    },
  });

  console.log(`Business created/found: ${business.name} (${business.id})`);

  // 2. Create Subscription
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      plan: "ENTERPRISE",
      status: "ACTIVE",
      startDate: new Date(),
      endDate: oneYearFromNow,
      userLimit: 50,
      branchLimit: 10,
    },
  });

  console.log("Subscription activated.");

  // 3. Create Branches
  const mainBranch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Downtown Supermarket",
      phone: "+1-555-0200",
      address: "456 Broadway, New York, NY",
      isMain: true,
    },
  });

  const warehouseBranch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Queens Warehouse",
      phone: "+1-555-0300",
      address: "789 Industry Blvd, Queens, NY",
      isMain: false,
    },
  });

  console.log(`Branches created: ${mainBranch.name}, ${warehouseBranch.name}`);

  // 4. Create Platform Business and Super Admin (hashed password: "superadmin123")
  const salt = bcrypt.genSaltSync(10);
  const superAdminHash = bcrypt.hashSync("superadmin123", salt);
  const ownerHash = bcrypt.hashSync("admin123", salt);
  const cashierHash = bcrypt.hashSync("cashier123", salt);

  const platformBusiness = await prisma.business.upsert({
    where: { slug: "platform-admin" },
    update: {},
    create: {
      name: "DynaPOS Platform Admin",
      slug: "platform-admin",
      phone: "+1-800-555-0100",
      email: "admin@dynapos.com",
      address: "DynaPOS Headquarters",
      currency: "USD",
      taxConfig: { taxName: "VAT", rate: 0 },
      settings: {},
    },
  });

  await prisma.subscription.upsert({
    where: { businessId: platformBusiness.id },
    update: {},
    create: {
      businessId: platformBusiness.id,
      plan: "ENTERPRISE",
      status: "ACTIVE",
      startDate: new Date(),
      endDate: oneYearFromNow,
      userLimit: 100,
      branchLimit: 20,
    },
  });

  const platformBranch = await prisma.branch.create({
    data: {
      businessId: platformBusiness.id,
      name: "Platform HQ",
      phone: "+1-800-555-0100",
      address: "DynaPOS HQ",
      isMain: true,
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@dynapos.com" },
    update: {},
    create: {
      businessId: platformBusiness.id,
      branchId: platformBranch.id,
      name: "System Super Admin",
      email: "superadmin@dynapos.com",
      passwordHash: superAdminHash,
      role: "SUPER_ADMIN",
      phone: "+1-800-555-0100",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@dynapos.com" },
    update: {},
    create: {
      businessId: business.id,
      branchId: mainBranch.id,
      name: "Alex Owner",
      email: "owner@dynapos.com",
      passwordHash: ownerHash,
      role: "OWNER",
      phone: "+1-555-0401",
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: "cashier@dynapos.com" },
    update: {},
    create: {
      businessId: business.id,
      branchId: mainBranch.id,
      name: "Jane Cashier",
      email: "cashier@dynapos.com",
      passwordHash: cashierHash,
      role: "CASHIER",
      phone: "+1-555-0402",
    },
  });

  console.log(`Users created: ${superAdmin.email} (Super Admin), ${owner.email} (Owner), ${cashier.email} (Cashier)`);

  // 5. Create Categories
  const produce = await prisma.category.create({
    data: { businessId: business.id, name: "Fresh Produce" },
  });

  const dairyBakery = await prisma.category.create({
    data: { businessId: business.id, name: "Dairy & Bakery" },
  });

  const beveragesSnacks = await prisma.category.create({
    data: { businessId: business.id, name: "Beverages & Snacks" },
  });

  const groceries = await prisma.category.create({
    data: { businessId: business.id, name: "Groceries" },
  });

  const household = await prisma.category.create({
    data: { businessId: business.id, name: "Household Goods" },
  });

  const pharmacy = await prisma.category.create({
    data: { businessId: business.id, name: "Pharmacy" },
  });

  // 6. Create Brands
  const genericBrand = await prisma.brand.create({
    data: { businessId: business.id, name: "Generic/Organic" },
  });

  const dynabrand = await prisma.brand.create({
    data: { businessId: business.id, name: "DynaBrand Retail" },
  });

  // 7. Create Units
  const pcsUnit = await prisma.unit.create({
    data: { businessId: business.id, name: "Pcs" },
  });

  const kgUnit = await prisma.unit.create({
    data: { businessId: business.id, name: "Kg" },
  });

  console.log("Supermarket Categories, Brands, and Units created.");

  // 8. Create Supermarket Products
  // Produce (Weight based)
  const bananasProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: produce.id,
      brandId: genericBrand.id,
      unitId: kgUnit.id,
      name: "Organic Bananas",
      sku: "PRO-BAN-001",
      barcode: "000000000001",
      description: "Fresh organic yellow bananas sold by weight",
      costPrice: 0.8,
      sellingPrice: 1.89,
      wholesalePrice: 1.5,
      alertQuantity: 50,
    },
  });

  const tomatoesProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: produce.id,
      brandId: genericBrand.id,
      unitId: kgUnit.id,
      name: "Roma Tomatoes",
      sku: "PRO-TOM-002",
      barcode: "000000000002",
      description: "Vine-ripened red tomatoes sold by weight",
      costPrice: 1.2,
      sellingPrice: 2.99,
      wholesalePrice: 2.5,
      alertQuantity: 30,
    },
  });

  const potatoesProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: produce.id,
      brandId: genericBrand.id,
      unitId: kgUnit.id,
      name: "Russet Potatoes",
      sku: "PRO-POT-003",
      barcode: "000000000003",
      description: "Baking russet potatoes sold by weight",
      costPrice: 0.5,
      sellingPrice: 1.29,
      wholesalePrice: 0.9,
      alertQuantity: 80,
    },
  });

  // Dairy & Bakery (Unit items)
  const milkProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: dairyBakery.id,
      brandId: dynabrand.id,
      unitId: pcsUnit.id,
      name: "Whole Milk 1 Gallon",
      sku: "DRY-MLK-001",
      barcode: "000000000004",
      description: "Vitamin D pasteurized whole milk gallon",
      costPrice: 2.1,
      sellingPrice: 3.89,
      wholesalePrice: 3.2,
      alertQuantity: 25,
    },
  });

  const breadProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: dairyBakery.id,
      brandId: dynabrand.id,
      unitId: pcsUnit.id,
      name: "Sliced White Bread",
      sku: "BKY-BRD-002",
      barcode: "000000000005",
      description: "Soft sliced sandwich bread pack",
      costPrice: 1.1,
      sellingPrice: 2.49,
      wholesalePrice: 2.0,
      alertQuantity: 30,
    },
  });

  const yogurtProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: dairyBakery.id,
      brandId: genericBrand.id,
      unitId: pcsUnit.id,
      name: "Greek Yogurt 500g",
      sku: "DRY-YGT-003",
      barcode: "000000000006",
      description: "Plain Greek Yogurt cup",
      costPrice: 0.7,
      sellingPrice: 1.59,
      wholesalePrice: 1.2,
      alertQuantity: 40,
    },
  });

  // Beverages & Snacks
  const cokeProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: beveragesSnacks.id,
      brandId: genericBrand.id,
      unitId: pcsUnit.id,
      name: "Coca-Cola 12-Pack",
      sku: "BEV-COK-001",
      barcode: "000000000007",
      description: "Classic Coca-Cola soda cans",
      costPrice: 4.0,
      sellingPrice: 6.99,
      wholesalePrice: 5.5,
      alertQuantity: 15,
    },
  });

  const chipsProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: beveragesSnacks.id,
      brandId: genericBrand.id,
      unitId: pcsUnit.id,
      name: "Salted Potato Chips",
      sku: "SNK-CHP-002",
      barcode: "000000000008",
      description: "Crispy salted classic chips family size",
      costPrice: 1.5,
      sellingPrice: 3.29,
      wholesalePrice: 2.5,
      alertQuantity: 30,
    },
  });

  // Household
  const detergentProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: household.id,
      brandId: dynabrand.id,
      unitId: pcsUnit.id,
      name: "Laundry Liquid Detergent",
      sku: "HSH-DET-001",
      barcode: "000000000012",
      description: "Liquid fabric detergent clean breeze scent",
      costPrice: 6.5,
      sellingPrice: 12.99,
      wholesalePrice: 10.0,
      alertQuantity: 10,
    },
  });

  // Pharmacy (Expiry & batch tracking enabled)
  const aspirinProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: pharmacy.id,
      brandId: genericBrand.id,
      unitId: pcsUnit.id,
      name: "Aspirin 81mg (100 Tabs)",
      sku: "MED-ASP-081",
      barcode: "880303030303",
      description: "Low dose safety coated aspirin for daily therapy",
      costPrice: 4.2,
      sellingPrice: 8.5,
      wholesalePrice: 6.0,
      alertQuantity: 10,
      batchTracking: true,
      expiryTracking: true,
    },
  });

  console.log("Supermarket Products created.");

  // 9. Create Product Stocks
  await prisma.productStock.createMany({
    data: [
      { productId: bananasProduct.id, branchId: mainBranch.id, quantity: 500 },
      { productId: bananasProduct.id, branchId: warehouseBranch.id, quantity: 2000 },
      { productId: tomatoesProduct.id, branchId: mainBranch.id, quantity: 300 },
      { productId: potatoesProduct.id, branchId: mainBranch.id, quantity: 800 },
      { productId: milkProduct.id, branchId: mainBranch.id, quantity: 120 },
      { productId: milkProduct.id, branchId: warehouseBranch.id, quantity: 500 },
      { productId: breadProduct.id, branchId: mainBranch.id, quantity: 150 },
      { productId: yogurtProduct.id, branchId: mainBranch.id, quantity: 90 },
      { productId: cokeProduct.id, branchId: mainBranch.id, quantity: 80 },
      { productId: chipsProduct.id, branchId: mainBranch.id, quantity: 140 },
      { productId: detergentProduct.id, branchId: mainBranch.id, quantity: 45 },
      { productId: aspirinProduct.id, branchId: mainBranch.id, quantity: 30 },
    ],
  });

  // 10. Create Batches for Aspirin (batch tracking enabled)
  const expiryDate1 = new Date();
  expiryDate1.setFullYear(expiryDate1.getFullYear() + 2);
  const expiryDate2 = new Date();
  expiryDate2.setFullYear(expiryDate2.getFullYear() + 1);

  await prisma.batch.createMany({
    data: [
      {
        productId: aspirinProduct.id,
        branchId: mainBranch.id,
        batchNumber: "ASP-B01",
        quantity: 20,
        costPrice: 4.2,
        sellingPrice: 8.5,
        expiryDate: expiryDate1,
      },
      {
        productId: aspirinProduct.id,
        branchId: mainBranch.id,
        batchNumber: "ASP-B02",
        quantity: 10,
        costPrice: 4.5,
        sellingPrice: 9.0,
        expiryDate: expiryDate2,
      },
    ],
  });

  console.log("Stocks & Batches created.");

  // 11. Create Demo Customer & Supplier
  const walkInCustomer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: "Walk-in Customer",
      phone: "0000000000",
      customerType: "RETAIL",
    },
  });

  const regularCustomer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: "John Customer",
      email: "john@customer.com",
      phone: "+1-555-0810",
      address: "777 Park Ave, New York, NY",
      customerType: "WHOLESALE",
      creditLimit: 1000.0,
      balance: 150.0,
    },
  });

  const demoSupplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: "Global Distributor Inc.",
      contactName: "Michael Supplier",
      email: "sales@globaldist.com",
      phone: "+1-555-0900",
      address: "100 Logistics Rd, Newark, NJ",
      balance: 500.0,
    },
  });

  // Seed customer ledger entry
  await prisma.customerLedger.create({
    data: {
      customerId: regularCustomer.id,
      type: "SALE",
      reference: "INV-2026-0001",
      debit: 150.0,
      credit: 0.0,
      balance: 150.0,
      description: "Initial wholesale credit invoice purchase",
    },
  });

  // Seed supplier ledger entry
  await prisma.supplierLedger.create({
    data: {
      supplierId: demoSupplier.id,
      type: "PURCHASE",
      reference: "PO-2026-0001",
      debit: 0.0,
      credit: 500.0,
      balance: 500.0,
      description: "Inbound stock invoice credit PO",
    },
  });

  console.log("Customer & Supplier seeding completed.");

  // 12. Create Expense Categories & Expenses
  console.log("Seeding historical expenses and incomes...");
  const rentCategory = await prisma.expenseCategory.create({
    data: { businessId: business.id, name: "Rent & Utilities" },
  });

  const salaryCategory = await prisma.expenseCategory.create({
    data: { businessId: business.id, name: "Salaries" },
  });

  const rentExpense = await prisma.expense.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      categoryId: rentCategory.id,
      userId: owner.id,
      amount: 1200.0,
      reference: "VOUCH-RENT-001",
      description: "Main branch shop monthly rent payment",
    },
  });

  const salaryExpense = await prisma.expense.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      categoryId: salaryCategory.id,
      userId: owner.id,
      amount: 2500.0,
      reference: "VOUCH-SAL-001",
      description: "Staff monthly salary payout",
    },
  });

  // 13. Create Income Categories & Incomes
  const recycleCategory = await prisma.incomeCategory.create({
    data: { businessId: business.id, name: "Recycling / Scrap Sales" },
  });

  const scrapIncome = await prisma.income.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      categoryId: recycleCategory.id,
      userId: owner.id,
      amount: 150.0,
      reference: "INC-REC-001",
      description: "Sale of cardboard packing boxes",
    },
  });

  // 14. Create Historical Sales & SaleItems
  console.log("Seeding historical transactions (sales & purchases)...");
  
  // Sale 1: Walk-in customer cash sale
  const sale1 = await prisma.sale.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      customerId: walkInCustomer.id,
      userId: cashier.id,
      invoiceNumber: "INV-2026-1001",
      status: "COMPLETED",
      subtotal: 48.78,
      discount: 2.0,
      tax: 4.68,
      total: 51.46,
      paidAmount: 51.46,
      paymentStatus: "PAID",
    },
  });

  await prisma.saleItem.createMany({
    data: [
      {
        saleId: sale1.id,
        productId: bananasProduct.id,
        quantity: 5,
        price: bananasProduct.sellingPrice,
        total: 5 * bananasProduct.sellingPrice,
      },
      {
        saleId: sale1.id,
        productId: milkProduct.id,
        quantity: 10,
        price: milkProduct.sellingPrice,
        total: 10 * milkProduct.sellingPrice,
      },
    ],
  });

  // Sale 2: Regular customer card sale
  const sale2 = await prisma.sale.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      customerId: regularCustomer.id,
      userId: cashier.id,
      invoiceNumber: "INV-2026-1002",
      status: "COMPLETED",
      subtotal: 82.90,
      discount: 0.0,
      tax: 8.29,
      total: 91.19,
      paidAmount: 91.19,
      paymentStatus: "PAID",
    },
  });

  await prisma.saleItem.createMany({
    data: [
      {
        saleId: sale2.id,
        productId: detergentProduct.id,
        quantity: 5,
        price: detergentProduct.sellingPrice,
        total: 5 * detergentProduct.sellingPrice,
      },
      {
        saleId: sale2.id,
        productId: cokeProduct.id,
        quantity: 3,
        price: cokeProduct.sellingPrice,
        total: 3 * cokeProduct.sellingPrice,
      },
    ],
  });

  // 15. Create Historical Purchases & PurchaseItems
  // Purchase 1: Stock intake from Global Supplier
  const purchase1 = await prisma.purchase.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      supplierId: demoSupplier.id,
      userId: owner.id,
      purchaseNumber: "PUR-2026-1001",
      status: "RECEIVED",
      subtotal: 155.0,
      discount: 0.0,
      tax: 15.5,
      total: 170.5,
      paidAmount: 170.5,
      paymentStatus: "PAID",
    },
  });

  await prisma.purchaseItem.createMany({
    data: [
      {
        purchaseId: purchase1.id,
        productId: milkProduct.id,
        quantity: 50,
        price: milkProduct.costPrice,
        total: 50 * milkProduct.costPrice,
      },
      {
        purchaseId: purchase1.id,
        productId: tomatoesProduct.id,
        quantity: 41,
        price: tomatoesProduct.costPrice,
        total: 41 * tomatoesProduct.costPrice,
      },
    ],
  });

  // 16. Seed Cash Flow / Payment Records
  console.log("Seeding core cashflow registers...");
  
  // Sale payments (RECEIVED)
  await prisma.payment.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      saleId: sale1.id,
      userId: cashier.id,
      amount: 51.46,
      method: "CASH",
      type: "RECEIVED",
      receiptNumber: "REC-2026-1001",
      remarks: "Cash sale register settlement",
    },
  });

  await prisma.payment.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      saleId: sale2.id,
      userId: cashier.id,
      amount: 91.19,
      method: "CARD",
      type: "RECEIVED",
      receiptNumber: "REC-2026-1002",
      remarks: "Card payment swipe order",
    },
  });

  // Purchase payment (SENT)
  await prisma.payment.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      purchaseId: purchase1.id,
      userId: owner.id,
      amount: 170.5,
      method: "BANK_TRANSFER",
      type: "SENT",
      receiptNumber: "VOUCH-PUR-1001",
      remarks: "Bank wire payment to Global Distributor",
    },
  });

  // Direct standalone income collections (RECEIVED)
  await prisma.payment.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      userId: owner.id,
      amount: 150.0,
      method: "CASH",
      type: "RECEIVED",
      receiptNumber: "REC-INC-1001",
      remarks: "Recycling / Scrap Sales: cardboard box disposal",
    },
  });

  // Direct standalone expense payments (SENT)
  await prisma.payment.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      userId: owner.id,
      amount: 1200.0,
      method: "BANK_TRANSFER",
      type: "SENT",
      receiptNumber: "REC-EXP-1001",
      remarks: "Rent & Utilities: Main shop monthly rent",
    },
  });

  await prisma.payment.create({
    data: {
      businessId: business.id,
      branchId: mainBranch.id,
      userId: owner.id,
      amount: 2500.0,
      method: "BANK_TRANSFER",
      type: "SENT",
      receiptNumber: "REC-EXP-1002",
      remarks: "Salaries: Staff payroll payout",
    },
  });

  console.log("Historical data seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

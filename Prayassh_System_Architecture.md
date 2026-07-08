# Prayassh POS & ERP — Production-Ready System Architecture

This document provides complete system architecture documentation, PostgreSQL database schemas, entity relationship diagrams, Swagger route specifications, and detailed deployment guides for the production-ready **Prayassh** POS and ERP SaaS platform.

---

## 1. Production PostgreSQL Prisma Schema

The database model is defined below using the PostgreSQL datasource provider. All models include UUID primary keys, multi-tenant grouping fields (\`businessId\`, \`branchId\`, \`warehouseId\`), tracking timestamps (\`createdAt\`, \`updatedAt\`), and soft-delete fields (\`deletedAt\`) to ensure audit integrity.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ----------------------------------------------------
// MULTI-TENANCY & CORE IDENTITY
// ----------------------------------------------------

model Business {
  id               String            @id @default(uuid()) @db.Uuid
  name             String
  slug             String            @unique
  logo             String?
  phone            String?
  email            String?
  address          String?
  currency         String            @default("USD")
  taxConfig        Json?             // { taxName: "VAT", rate: 15 }
  settings         Json?             // Custom metadata options
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?         @db.Timestamp

  subscription     Subscription?
  branches         Branch[]
  users            User[]
  categories       Category[]
  brands           Brand[]
  units            Unit[]
  products         Product[]
  customers        Customer[]
  suppliers        Supplier[]
  sales            Sale[]
  purchases        Purchase[]
  payments         Payment[]
  saleReturns      SaleReturn[]
  purchaseReturns  PurchaseReturn[]
  expenseCategories ExpenseCategory[]
  expenses         Expense[]
  incomeCategories  IncomeCategory[]
  incomes           Income[]
  stockTransfers   StockTransfer[]
  auditLogs        AuditLog[]
  notifications    Notification[]
  openingStocks    OpeningStock[]
}

model Subscription {
  id           String    @id @default(uuid()) @db.Uuid
  businessId   String    @unique @db.Uuid
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  plan         String    @default("FREE") // FREE, BASIC, PREMIUM, ENTERPRISE
  status       String    @default("ACTIVE") // ACTIVE, EXPIRED, CANCELLED
  startDate    DateTime  @default(now())
  endDate      DateTime
  userLimit    Int       @default(3)
  branchLimit  Int       @default(1)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Branch {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  phone      String?
  address    String?
  isMain     Boolean    @default(false)
  isActive   Boolean    @default(true)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  users                User[]
  productStocks        ProductStock[]
  batches              Batch[]
  sales                Sale[]
  purchases            Purchase[]
  expenses             Expense[]
  incomes              Income[]
  stockTransfersSource StockTransfer[] @relation("SourceBranch")
  stockTransfersTarget StockTransfer[] @relation("TargetBranch")
  customers            Customer[]
  openingStocks        OpeningStock[]
  payments             Payment[]
}

model User {
  id              String     @id @default(uuid()) @db.Uuid
  businessId      String     @db.Uuid
  business        Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId        String?    @db.Uuid
  branch          Branch?    @relation(fields: [branchId], references: [id], onDelete: SetNull)
  name            String
  email           String     @unique
  passwordHash    String
  role            String     @default("CASHIER") // ADMIN (Business Owner), VENDOR (Manager), CASHIER
  phone           String?
  isActive        Boolean    @default(true)
  allowedDeviceId String?    // Locked terminal UUID
  deviceName      String?    // E.g. "Chrome on Windows"
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?  @db.Timestamp

  sales           Sale[]     @relation("CashierSales")
  purchases       Purchase[] @relation("PurchasingAgent")
  auditLogs       AuditLog[]
  notifications   Notification[]
}

// ----------------------------------------------------
// TAXONOMY & PRODUCT INVENTORY
// ----------------------------------------------------

model Category {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  products   Product[]
}

model Brand {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  products   Product[]
}

model Unit {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String     // E.g. "Pcs", "Kg", "Ltr"
  shortName  String
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  products   Product[]
}

model Product {
  id             String          @id @default(uuid()) @db.Uuid
  businessId     String          @db.Uuid
  business       Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  categoryId     String?         @db.Uuid
  category       Category?       @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  brandId        String?         @db.Uuid
  brand          Brand?          @relation(fields: [brandId], references: [id], onDelete: SetNull)
  unitId         String?         @db.Uuid
  unit           Unit?           @relation(fields: [unitId], references: [id], onDelete: SetNull)
  name           String
  sku            String          @unique
  barcode        String?
  image          String?
  costPrice      DoublePrecision @default(0.0)
  sellingPrice   DoublePrecision @default(0.0)
  mrp            DoublePrecision @default(0.0)
  alertQuantity  Float           @default(5.0)
  batchTracking  Boolean         @default(false)
  expiryTracking Boolean         @default(false)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  deletedAt      DateTime?       @db.Timestamp

  stocks         ProductStock[]
  batches        Batch[]
  saleItems      SaleItem[]
  purchaseItems  PurchaseItem[]
  openingStocks  OpeningStock[]
}

model ProductStock {
  id          String    @id @default(uuid()) @db.Uuid
  productId   String    @db.Uuid
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  branchId    String    @db.Uuid
  branch      Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  warehouseId String?   @db.Uuid
  quantity    Float     @default(0.0)
  rackNumber  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Batch {
  id          String    @id @default(uuid()) @db.Uuid
  productId   String    @db.Uuid
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  branchId    String    @db.Uuid
  branch      Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  batchNumber String
  quantity    Float     @default(0.0)
  costPrice   DoublePrecision @default(0.0)
  sellingPrice DoublePrecision @default(0.0)
  expiryDate  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// ----------------------------------------------------
// CONTACTS & TRANSACTIONS
// ----------------------------------------------------

model Customer {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId   String?    @db.Uuid
  branch     Branch?    @relation(fields: [branchId], references: [id], onDelete: SetNull)
  name       String
  phone      String?
  email      String?
  address    String?
  balance    DoublePrecision @default(0.0)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  sales      Sale[]
  payments   Payment[]
}

model Supplier {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  phone      String?
  email      String?
  address    String?
  balance    DoublePrecision @default(0.0)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  purchases  Purchase[]
  payments   Payment[]
}

model Sale {
  id            String      @id @default(uuid()) @db.Uuid
  businessId    String      @db.Uuid
  business      Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String      @db.Uuid
  branch        Branch      @relation(fields: [branchId], references: [id], onDelete: Cascade)
  warehouseId   String?     @db.Uuid
  customerId    String?     @db.Uuid
  customer      Customer?   @relation(fields: [customerId], references: [id], onDelete: SetNull)
  cashierId     String      @db.Uuid
  cashier       User        @relation("CashierSales", fields: [cashierId], references: [id])
  invoiceNumber String      @unique
  subtotal      DoublePrecision
  discount      DoublePrecision @default(0.0)
  tax           DoublePrecision @default(0.0)
  total         DoublePrecision
  paidAmount    DoublePrecision @default(0.0)
  paymentStatus String      @default("PAID") // PAID, PARTIAL, UNPAID
  paymentMethod String      @default("CASH") // CASH, QR, CARD, BANK
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  deletedAt     DateTime?   @db.Timestamp

  items         SaleItem[]
  payments      Payment[]
  returns       SaleReturn[]
}

model SaleItem {
  id        String   @id @default(uuid()) @db.Uuid
  saleId    String   @db.Uuid
  sale      Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId String   @db.Uuid
  product   Product  @relation(fields: [productId], references: [id])
  quantity  Float
  price     DoublePrecision
  total     DoublePrecision
}

model Purchase {
  id            String      @id @default(uuid()) @db.Uuid
  businessId    String      @db.Uuid
  business      Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId      String      @db.Uuid
  branch        Branch      @relation(fields: [branchId], references: [id], onDelete: Cascade)
  warehouseId   String?     @db.Uuid
  supplierId    String      @db.Uuid
  supplier      Supplier    @relation(fields: [supplierId], references: [id])
  agentId       String      @db.Uuid
  agent         User        @relation("PurchasingAgent", fields: [agentId], references: [id])
  invoiceNumber String      @unique
  subtotal      DoublePrecision
  discount      DoublePrecision @default(0.0)
  tax           DoublePrecision @default(0.0)
  total         DoublePrecision
  paidAmount    DoublePrecision @default(0.0)
  paymentStatus String      @default("UNPAID")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  deletedAt     DateTime?   @db.Timestamp

  items         PurchaseItem[]
  payments      Payment[]
  returns       PurchaseReturn[]
}

model PurchaseItem {
  id         String   @id @default(uuid()) @db.Uuid
  purchaseId String   @db.Uuid
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  productId  String   @db.Uuid
  product    Product  @relation(fields: [productId], references: [id])
  quantity   Float
  costPrice  DoublePrecision
  total      DoublePrecision
}

// ----------------------------------------------------
// CASHFLOW, LEDGERS & EXPENSES
// ----------------------------------------------------

model Payment {
  id              String    @id @default(uuid()) @db.Uuid
  businessId      String    @db.Uuid
  business        Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId        String?   @db.Uuid
  branch          Branch?   @relation(fields: [branchId], references: [id], onDelete: SetNull)
  customerId      String?   @db.Uuid
  customer        Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  supplierId      String?   @db.Uuid
  supplier        Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  saleId          String?   @db.Uuid
  sale            Sale?     @relation(fields: [saleId], references: [id], onDelete: SetNull)
  purchaseId      String?   @db.Uuid
  purchase        Purchase? @relation(fields: [purchaseId], references: [id], onDelete: SetNull)
  receiptNumber   String    @unique
  paymentType     String    // RECEIVED (Income Register), SENT (Expense Register)
  paymentMethod   String    // CASH, QR, CARD, BANK
  amount          DoublePrecision
  referenceNumber String?
  remarks         String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? @db.Timestamp
}

model ExpenseCategory {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  expenses   Expense[]
}

model Expense {
  id          String          @id @default(uuid()) @db.Uuid
  businessId  String          @db.Uuid
  business    Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId    String          @db.Uuid
  branch      Branch          @relation(fields: [branchId], references: [id], onDelete: Cascade)
  categoryId  String          @db.Uuid
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  voucherNo   String          @unique
  amount      DoublePrecision
  description String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  deletedAt   DateTime?       @db.Timestamp
}

model IncomeCategory {
  id         String     @id @default(uuid()) @db.Uuid
  businessId String     @db.Uuid
  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name       String
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?  @db.Timestamp

  incomes    Income[]
}

model Income {
  id          String          @id @default(uuid()) @db.Uuid
  businessId  String          @db.Uuid
  business    Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  branchId    String          @db.Uuid
  branch      Branch          @relation(fields: [branchId], references: [id], onDelete: Cascade)
  categoryId  String          @db.Uuid
  category    IncomeCategory  @relation(fields: [categoryId], references: [id])
  receiptNo   String          @unique
  amount      DoublePrecision
  description String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  deletedAt   DateTime?       @db.Timestamp
}

// ----------------------------------------------------
// WAREHOUSING, MOVEMENT & RETURNS
// ----------------------------------------------------

model StockTransfer {
  id             String    @id @default(uuid()) @db.Uuid
  businessId     String    @db.Uuid
  business       Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  sourceBranchId String    @db.Uuid
  sourceBranch   Branch    @relation("SourceBranch", fields: [sourceBranchId], references: [id])
  targetBranchId String    @db.Uuid
  targetBranch   Branch    @relation("TargetBranch", fields: [targetBranchId], references: [id])
  transferNo     String    @unique
  status         String    @default("PENDING") // PENDING, SENT, RECEIVED, CANCELLED
  notes          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model OpeningStock {
  id           String    @id @default(uuid()) @db.Uuid
  businessId   String    @db.Uuid
  business     Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  productId    String    @db.Uuid
  product      Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  branchId     String    @db.Uuid
  branch       Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  quantity     Float
  purchaseRate DoublePrecision
  sellingPrice DoublePrecision
  mrp          DoublePrecision
  batchNumber  String?
  expiryDate   DateTime?
  rackNumber   String?
  notes        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model SaleReturn {
  id         String   @id @default(uuid()) @db.Uuid
  saleId     String   @db.Uuid
  sale       Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  returnNo   String   @unique
  amount     DoublePrecision
  reason     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model PurchaseReturn {
  id         String   @id @default(uuid()) @db.Uuid
  purchaseId String   @db.Uuid
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  returnNo   String   @unique
  amount     DoublePrecision
  reason     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// ----------------------------------------------------
// AUDITING, ALERTS & SYSTEM CONFIGS
// ----------------------------------------------------

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  businessId String   @db.Uuid
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId     String?  @db.Uuid
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  role       String
  action     String   // E.g. LOGIN, PRODUCT_CREATE, INVOICE_PRINT, DISCOUNT_GIVEN
  module     String   // E.g. AUTH, INVENTORY, SALES, SETTINGS
  details    String
  device     String?  // UUID or browser identifier
  ipAddress  String?
  createdAt  DateTime @default(now())
}

model Notification {
  id         String   @id @default(uuid()) @db.Uuid
  businessId String   @db.Uuid
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId     String?  @db.Uuid
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  title      String
  message    String
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```

---

## 2. Entity Relationship Diagram (ERD)

The following Mermaid diagram outlines the relational mapping of the Prayassh POS & ERP database tables:

```mermaid
erDiagram
    Business ||--|| Subscription : "has"
    Business ||--o{ Branch : "owns"
    Business ||--o{ User : "employs"
    Business ||--o{ Product : "catalog"
    Business ||--o{ Category : "groups"
    Business ||--o{ Unit : "measures"
    Business ||--o{ Customer : "bills"
    Business ||--o{ Supplier : "buys_from"
    Business ||--o{ Sale : "records"
    Business ||--o{ Purchase : "intakes"
    Business ||--o{ Payment : "tracks_cash"
    Business ||--o{ Expense : "logs_costs"
    Business ||--o{ AuditLog : "audits"

    Branch ||--o{ User : "houses"
    Branch ||--o{ ProductStock : "holds"
    Branch ||--o{ Batch : "tracks"
    Branch ||--o{ Sale : "originates"
    Branch ||--o{ Purchase : "receives"
    Branch ||--o{ Expense : "spends"

    Product ||--o{ ProductStock : "quantified_in"
    Product ||--o{ Batch : "batched_by"
    Product ||--o{ SaleItem : "sold_via"
    Product ||--o{ PurchaseItem : "bought_via"
    Product ||--o{ OpeningStock : "initialized_by"
    Category ||--o{ Product : "classifies"
    Brand ||--o{ Product : "labels"
    Unit ||--o{ Product : "rates"

    Customer ||--o{ Sale : "places"
    Customer ||--o{ Payment : "makes"
    Supplier ||--o{ Purchase : "supplies"
    Supplier ||--o{ Payment : "receives"

    Sale ||--o{ SaleItem : "details"
    Sale ||--o{ Payment : "funds"
    Sale ||--o{ SaleReturn : "reverses"

    Purchase ||--o{ PurchaseItem : "details"
    Purchase ||--o{ Payment : "funds"
    Purchase ||--o{ PurchaseReturn : "reverses"

    ExpenseCategory ||--o{ Expense : "classifies"
    IncomeCategory ||--o{ Income : "classifies"
    User ||--o{ AuditLog : "triggers"
```

---

## 3. Swagger OpenAPI Route Specifications

The REST APIs are mounted under \`/api/v1/\` and served at \`/api/docs\`.

### 3.1 Global Endpoint Paths
* **Authentication Modules**
  * \`POST /api/v1/auth/register\`: Sets up a Business entity and an Admin Owner profile.
  * \`POST /api/v1/auth/login\`: Validates email, password, and browser UUID; returns a JWT token.
  * \`POST /api/v1/auth/device-check\`: Pre-authorization check verifying browser fingerprint.
* **Products & Taxonomy**
  * \`GET /api/v1/products\`: Returns paginated, filtered, and searchable product lists.
  * \`POST /api/v1/products\`: Standard product CRUD (restricted to Owner and Manager).
  * \`PUT /api/v1/products/{id}\`: Updates SKU, prices, barcodes, and tracking triggers.
  * \`DELETE /api/v1/products/{id}\`: Soft-deletes a product catalog entry.
* **POS & Sales**
  * \`POST /api/v1/sales\`: Completes checkout invoices. Deducts item quantities from branch stocks, syncs batch totals, registers payments in the cashier session, and records a \`RECEIVED\` payment ledger.
  * \`GET /api/v1/sales\`: Retrieves transaction histories.
* **Accounting Cash Book (Payments)**
  * \`GET /api/v1/payments\`: Displays consolidated cash flows.
    * Query param \`type=RECEIVED\`: Sales collections, balance clearance dues, and custom incomes.
    * Query param \`type=SENT\`: Supplier payables, purchases, rent, salaries, utilities, and expenses.
* **Expenses**
  * \`POST /api/v1/expenses\`: Records operating costs, generating vouchers.
* **Reports Aggregation**
  * \`GET /api/v1/reports/daily\`: Returns daily sales, VAT taxes, collections, expenses, and profits.
  * \`GET /api/v1/reports/inventory\`: Compiles stock values, batch timelines, and movement history reports.

---

## 4. Production Database Seeding Script (\`prisma/seed.ts\`)

To seed the PostgreSQL database with structural metadata, initial branches, and demo roles, execute the following typescript seed code. Save this code at [seed.ts](file:///c:/Users/ACER/OneDrive/Desktop/dynapos-main/prisma/seed.ts) and run it using the instructions in Section 5.

```typescript
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Prayassh system database seeding...");

  // 1. Setup Business Tenant
  const business = await prisma.business.upsert({
    where: { slug: "Prayassh-enterprise" },
    update: {},
    create: {
      name: "Prayassh HQ Enterprise",
      slug: "Prayassh-enterprise",
      phone: "+1-800-555-0100",
      email: "hq@Prayassh.com",
      address: "Prayassh Headquarters, Suite 100",
      currency: "USD",
      taxConfig: { taxName: "VAT", rate: 13.0 },
    },
  });

  // 2. Setup Subscription Plan
  const dateLimit = new Date();
  dateLimit.setFullYear(dateLimit.getFullYear() + 2); // 2 Year license
  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      plan: "ENTERPRISE",
      status: "ACTIVE",
      startDate: new Date(),
      endDate: dateLimit,
      userLimit: 100,
      branchLimit: 20,
    },
  });

  // 3. Create Branches & Warehouses
  const mainBranch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Main Retail Outlet (Branch 01)",
      address: "100 Broadway Ave, New York",
      isMain: true,
    },
  });

  const warehouseBranch = await prisma.branch.create({
    data: {
      businessId: business.id,
      name: "Queens Distribution Warehouse",
      address: "500 Logistics Way, Queens",
      isMain: false,
    },
  });

  // 4. Generate Standard User Accounts (Pass: admin123, cashier123, manager123)
  const salt = bcrypt.genSaltSync(10);
  const passOwner = bcrypt.hashSync("admin123", salt);
  const passManager = bcrypt.hashSync("manager123", salt);
  const passCashier = bcrypt.hashSync("cashier123", salt);

  const owner = await prisma.user.upsert({
    where: { email: "owner@Prayassh.com" },
    update: {},
    create: {
      businessId: business.id,
      branchId: mainBranch.id,
      name: "John Owner",
      email: "owner@Prayassh.com",
      passwordHash: passOwner,
      role: "OWNER",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@Prayassh.com" },
    update: {},
    create: {
      businessId: business.id,
      branchId: warehouseBranch.id,
      name: "Sarah Manager",
      email: "manager@Prayassh.com",
      passwordHash: passManager,
      role: "MANAGER",
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: "cashier@Prayassh.com" },
    update: {},
    create: {
      businessId: business.id,
      branchId: mainBranch.id,
      name: "Alex Cashier",
      email: "cashier@Prayassh.com",
      passwordHash: passCashier,
      role: "CASHIER",
    },
  });

  // 5. Taxonomy seeding
  const catRetail = await prisma.category.create({
    data: { businessId: business.id, name: "Electronics" },
  });
  const unitPcs = await prisma.unit.create({
    data: { businessId: business.id, name: "Pieces", shortName: "Pcs" },
  });

  // 6. Product catalog item
  const product = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: catRetail.id,
      unitId: unitPcs.id,
      name: "Wireless barcode Scanner Pro",
      sku: "WSCAN-PRO-001",
      barcode: "8801234567890",
      costPrice: 45.0,
      sellingPrice: 95.0,
      mrp: 120.0,
      alertQuantity: 3,
    },
  });

  // 7. Branch Stock levels
  await prisma.productStock.create({
    data: {
      productId: product.id,
      branchId: mainBranch.id,
      quantity: 15,
      rackNumber: "Rack A-3",
    },
  });

  // 8. Opening stock transaction logs
  await prisma.openingStock.create({
    data: {
      businessId: business.id,
      productId: product.id,
      branchId: mainBranch.id,
      quantity: 15,
      purchaseRate: 45.0,
      sellingPrice: 95.0,
      mrp: 120.0,
      notes: "Initial inventory setup",
    },
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 5. Development Installation Guide

Follow these steps to set up and run the system locally:

### 5.1 Prerequisites
* Install Node.js (version 20 or higher).
* Install Docker and Docker Compose (to run the PostgreSQL database container).

### 5.2 Step-by-Step Installation
1. **Clone and Install Dependencies**:
   ```bash
   git clone <repository-url>
   cd dynapos-main
   npm install --legacy-peer-deps
   ```
2. **Start the Database Container**:
   Spin up the PostgreSQL server using the Docker Compose file:
   ```bash
   docker-compose up -d
   ```
3. **Environment Setup**:
   Create a `.env` file in the root folder and configure the database link, NextAuth variables, and security keys:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dynapos?schema=public"
   NEXTAUTH_SECRET="your-production-secret-key-32chars"
   AUTH_URL="https://localhost:3000"
   NEXTAUTH_URL="https://localhost:3000"
   ```
4. **Push Database Schema & Generate Prisma Client**:
   Run the Prisma migration tool to generate table structures on PostgreSQL:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. **Run the Database Seeder**:
   Insert initial branches, products, taxonomic models, and user role templates:
   ```bash
   npm run seed
   ```
6. **Start the Local HTTPS Server**:
   Start the development server with secure HTTPS configurations:
   ```bash
   npm run dev:https
   ```
   Open **`https://localhost:3000`** in your browser. Proced past the experimental local certificate warning to access the login terminal.

---

## 6. Production Deployment Guide

Follow these steps to deploy Prayassh to production:

### 6.1 Database Deployment
Deploy your PostgreSQL database using a managed database provider (e.g. AWS RDS, Neon Postgres, Supabase, or a hosted Docker engine). Ensure that backup systems, replication nodes, and connection pooling tools (like PgBouncer) are configured to scale with high concurrent POS requests.

### 6.2 Application Deployment (Docker Build)
Prayassh can be compiled and deployed anywhere using Docker. Create the following standard deployment `Dockerfile` in your root folder:

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "start"]
```

Build and run your docker container with the production environment variables:
```bash
docker build -t Prayassh-app .
docker run -d -p 3000:3000 --env-file .env.production Prayassh-app
```

### 6.3 Secure Production Variables
In production, make sure the following environment parameters are set:
* `DATABASE_URL`: Production PostgreSQL connection string (including connection pooling settings).
* `NEXTAUTH_SECRET`: Random 32-byte cryptographic key.
* `AUTH_URL` / `NEXTAUTH_URL`: Absolute secure domain URL of your platform (e.g., `https://Prayassh.com`).
* Configure your reverse proxy (e.g., NGINX, Cloudflare, or Traefik) to manage incoming requests, enforce strict SSL certificates, filter malicious queries, and route client traffic securely.

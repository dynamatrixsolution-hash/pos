import { db } from "@/lib/db";
import { CommerceError, requireStaff, reconcilePayment, settlementStatus, money } from "@/lib/commerce-policy";
import { commerceTransaction, resolveBranch, checkBranch } from "@/lib/commerce-transaction";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const paymentCreateSchema = z.object({
  type: z.enum(["RECEIVED", "SENT"]),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  saleId: z.string().uuid().optional().nullable(),
  purchaseId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than zero"),
  method: z.enum(["CASH", "CARD", "FONE_PAY", "ESEWA", "KHALTI", "NEPAL_PAY", "CREDIT"]).default("CASH"),
  reference: z.string().optional().nullable(),
  paymentSource: z.literal("STAFF_RECORDED").optional(),
  receiptNumber: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  createdAt: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "RECEIVED";
  const customerId = searchParams.get("customerId");
  const supplierId = searchParams.get("supplierId");
  const branchId = searchParams.get("branchId") || undefined;
  const method = searchParams.get("method");
  const search = searchParams.get("search") || "";
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  try {
    const activeBranchId = await checkBranch(context, branchId);


    const paymentWhere: any = {
      businessId: context.businessId,
      type,
    };

    if (activeBranchId) {
      paymentWhere.branchId = activeBranchId;
    }

    if (type === "RECEIVED" && customerId) paymentWhere.customerId = customerId;
    if (type === "SENT" && supplierId) paymentWhere.supplierId = supplierId;
    if (method) paymentWhere.method = method;

    if (startDateStr || endDateStr) {
      paymentWhere.createdAt = {};
      if (startDateStr) {
        paymentWhere.createdAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        paymentWhere.createdAt.lte = end;
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      paymentWhere.OR = [
        { reference: { contains: q } },
        { receiptNumber: { contains: q } },
        { remarks: { contains: q } },
        { customer: { name: { contains: q } } },
        { supplier: { name: { contains: q } } },
        { sale: { invoiceNumber: { contains: q } } },
        { purchase: { purchaseNumber: { contains: q } } },
      ];
    }

    let mergedList: any[] = [];

    if (type === "RECEIVED") {
      const payments = await db.payment.findMany({
        where: paymentWhere,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          sale: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      mergedList.push(...payments.map(p => ({ ...p, isIncomeRecord: false })));

      const shouldFetchIncomes = !customerId && (!method || method === "CASH");
      if (shouldFetchIncomes) {
        const incomeWhere: any = {
          businessId: context.businessId,
          deletedAt: null,
        };
        if (activeBranchId) incomeWhere.branchId = activeBranchId;
        if (startDateStr || endDateStr) {
          incomeWhere.createdAt = {};
          if (startDateStr) incomeWhere.createdAt.gte = new Date(startDateStr);
          if (endDateStr) {
            const end = new Date(endDateStr);
            end.setHours(23, 59, 59, 999);
            incomeWhere.createdAt.lte = end;
          }
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          incomeWhere.OR = [
            { reference: { contains: q } },
            { description: { contains: q } },
            { category: { name: { contains: q } } },
          ];
        }

        const incomes = await db.income.findMany({
          where: incomeWhere,
          include: {
            category: { select: { name: true } },
            branch: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });

        mergedList.push(...incomes.map(inc => ({
          id: inc.id,
          businessId: inc.businessId,
          saleId: null,
          purchaseId: null,
          customerId: null,
          supplierId: null,
          branchId: inc.branchId,
          userId: inc.userId,
          amount: inc.amount,
          method: "CASH",
          reference: inc.reference,
          receiptNumber: inc.reference || `INC-${inc.id.slice(0, 8).toUpperCase()}`,
          remarks: inc.description || `Income: ${inc.category.name}`,
          type: "RECEIVED",
          createdAt: inc.createdAt,
          customer: { id: "", name: `Other Income: ${inc.category.name}`, phone: null },
          branch: inc.branch,
          user: inc.user,
          sale: null,
          isIncomeRecord: true,
        })));
      }
    } else {
      const payments = await db.payment.findMany({
        where: paymentWhere,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          purchase: { select: { id: true, purchaseNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      mergedList.push(...payments.map(p => ({ ...p, isExpenseRecord: false })));

      const shouldFetchExpenses = !supplierId && (!method || method === "CASH");
      if (shouldFetchExpenses) {
        const expenseWhere: any = {
          businessId: context.businessId,
          deletedAt: null,
        };
        if (activeBranchId) expenseWhere.branchId = activeBranchId;
        if (startDateStr || endDateStr) {
          expenseWhere.createdAt = {};
          if (startDateStr) expenseWhere.createdAt.gte = new Date(startDateStr);
          if (endDateStr) {
            const end = new Date(endDateStr);
            end.setHours(23, 59, 59, 999);
            expenseWhere.createdAt.lte = end;
          }
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          expenseWhere.OR = [
            { reference: { contains: q } },
            { description: { contains: q } },
            { category: { name: { contains: q } } },
          ];
        }

        const expenses = await db.expense.findMany({
          where: expenseWhere,
          include: {
            category: { select: { name: true } },
            branch: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });

        mergedList.push(...expenses.map(exp => ({
          id: exp.id,
          businessId: exp.businessId,
          saleId: null,
          purchaseId: null,
          customerId: null,
          supplierId: null,
          branchId: exp.branchId,
          userId: exp.userId,
          amount: exp.amount,
          method: "CASH",
          reference: exp.reference,
          receiptNumber: exp.reference || `EXP-${exp.id.slice(0, 8).toUpperCase()}`,
          remarks: exp.description || `Expense: ${exp.category.name}`,
          type: "SENT",
          createdAt: exp.createdAt,
          supplier: { id: "", name: `Expense: ${exp.category.name}`, phone: null },
          branch: exp.branch,
          user: exp.user,
          purchase: null,
          isExpenseRecord: true,
        })));
      }
    }

    mergedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const totalCount = mergedList.length;
    const paginatedList = mergedList.slice(skip, skip + limit);

    return NextResponse.json({
      payments: paginatedList,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("GET payments error:", error);
    return NextResponse.json({ error: error instanceof CommerceError ? error.message : "Failed to fetch payments" }, { status: error instanceof CommerceError ? error.status : 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  try {
    requireStaff(context, true);
    const body = await request.json();
    const parsed = paymentCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
    const data = parsed.data;
    const result = await commerceTransaction(request, context, "PAYMENT", body, async tx => {
      const branchId = await resolveBranch(tx, context, data.branchId);
      if (data.method === "CREDIT") throw new CommerceError("Credit is not a collected payment");
      reconcilePayment({ paidAmount: data.amount, paymentMethod: data.method, paymentReference: data.reference, paymentSource: data.paymentSource }, data.amount, context);
      if (data.saleId && data.purchaseId) throw new CommerceError("Payment may target only one invoice");
      if (data.type === "RECEIVED" && (data.supplierId || data.purchaseId)) throw new CommerceError("Invalid received payment target");
      if (data.type === "SENT" && (data.customerId || data.saleId)) throw new CommerceError("Invalid sent payment target");
      let customerId = data.customerId || null;
      let supplierId = data.supplierId || null;
      if (data.saleId) {
        const sale = await tx.sale.findFirst({ where: { id: data.saleId, businessId: context.businessId, branchId, deletedAt: null, isActive: true, status: "COMPLETED" } });
        if (!sale) throw new CommerceError("Invoice access denied", 403);
        if (customerId && customerId !== sale.customerId) throw new CommerceError("Customer does not match invoice");
        customerId = sale.customerId;
        if (data.amount > sale.total - sale.paidAmount + 0.005) throw new CommerceError("Payment exceeds invoice outstanding balance");
        const paidAmount = money(sale.paidAmount + data.amount);
        await tx.sale.update({ where: { id: sale.id }, data: { paidAmount, paymentStatus: settlementStatus(sale.total, paidAmount) } });
      }
      if (data.purchaseId) {
        const purchase = await tx.purchase.findFirst({ where: { id: data.purchaseId, businessId: context.businessId, branchId, deletedAt: null, status: "RECEIVED" } });
        if (!purchase) throw new CommerceError("Invoice access denied", 403);
        if (supplierId && supplierId !== purchase.supplierId) throw new CommerceError("Supplier does not match invoice");
        supplierId = purchase.supplierId;
        if (data.amount > purchase.total - purchase.paidAmount + 0.005) throw new CommerceError("Payment exceeds invoice outstanding balance");
        const paidAmount = money(purchase.paidAmount + data.amount);
        await tx.purchase.update({ where: { id: purchase.id }, data: { paidAmount, paymentStatus: settlementStatus(purchase.total, paidAmount) } });
      }
      if (!customerId && !supplierId && !data.saleId && !data.purchaseId) throw new CommerceError("A payment target is required");
      const receiptNumber = data.receiptNumber || `${data.type === "RECEIVED" ? "REC" : "VOU"}-${randomUUID()}`;
      if (customerId) {
        const customer = await tx.customer.findFirst({ where: { id: customerId, businessId: context.businessId, deletedAt: null } });
        if (!customer || (customer.branchId && customer.branchId !== branchId)) throw new CommerceError("Customer access denied", 403);
        if (data.amount > customer.balance + 0.005) throw new CommerceError("Payment exceeds customer outstanding balance");
        const balance = money(customer.balance - data.amount);
        await tx.customer.update({ where: { id: customer.id }, data: { balance } });
        await tx.customerLedger.create({ data: { customerId, type: "PAYMENT", reference: receiptNumber, credit: data.amount, balance, description: data.remarks } });
      }
      if (supplierId) {
        const supplier = await tx.supplier.findFirst({ where: { id: supplierId, businessId: context.businessId, deletedAt: null } });
        if (!supplier) throw new CommerceError("Supplier access denied", 403);
        if (data.amount > supplier.balance + 0.005) throw new CommerceError("Payment exceeds supplier outstanding balance");
        const balance = money(supplier.balance - data.amount);
        await tx.supplier.update({ where: { id: supplier.id }, data: { balance } });
        await tx.supplierLedger.create({ data: { supplierId, type: "PAYMENT", reference: receiptNumber, debit: data.amount, balance, description: data.remarks } });
      }
      const payment = await tx.payment.create({ data: {
        businessId: context.businessId, branchId, userId: context.userId, customerId, supplierId,
        saleId: data.saleId, purchaseId: data.purchaseId, amount: data.amount,
        method: data.method, source: "STAFF_RECORDED", type: data.type,
        reference: data.reference, receiptNumber, remarks: data.remarks,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      }, include: { customer: true, supplier: true, branch: true, user: { select: { name: true } } } });
      await tx.auditLog.create({ data: {
        businessId: context.businessId, branchId, userId: context.userId, role: context.role,
        action: "CREATE", module: "PAYMENT", details: "Staff-recorded payment (not provider verified)",
        newValue: JSON.parse(JSON.stringify(payment)),
      } });
      return payment;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof CommerceError ? error.message : "Payment failed" }, { status: error instanceof CommerceError ? error.status : 400 });
  }
}

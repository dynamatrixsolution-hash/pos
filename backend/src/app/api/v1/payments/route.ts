import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";

const paymentCreateSchema = z.object({
  type: z.enum(["RECEIVED", "SENT"]),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  saleId: z.string().uuid().optional().nullable(),
  purchaseId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be greater than zero"),
  method: z.enum(["CASH", "CARD", "QR", "BANK_TRANSFER", "CREDIT"]).default("CASH"),
  reference: z.string().optional().nullable(),
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
    let activeBranchId = branchId;
    if (["CASHIER", "MANAGER"].includes(context.role) && context.branchId) {
      activeBranchId = context.branchId;
    }

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
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Cashier cannot add manual sent/received payments unless allowed.
  // In most enterprise systems, Manager and above can record manual payments. Let's allow Manager/Owner.
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const body = await request.json();
    const result = paymentCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;
    const activeBranchId = data.branchId || context.branchId;

    if (!activeBranchId) {
      return NextResponse.json({ error: "Branch context is required" }, { status: 400 });
    }

    const paymentResult = await db.$transaction(async (tx) => {
      // 1. Generate Receipt/Voucher Number
      const prefix = data.type === "RECEIVED" ? "REC" : "VOU";
      const today = data.createdAt ? new Date(data.createdAt) : new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      
      const count = await tx.payment.count({
        where: {
          businessId: context.businessId,
          type: data.type,
          createdAt: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lte: new Date(today.setHours(23, 59, 59, 999)),
          },
        },
      });

      const receiptNumber = data.receiptNumber || `${prefix}-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      // 2. Create the Payment
      const payment = await tx.payment.create({
        data: {
          businessId: context.businessId,
          customerId: data.customerId || null,
          supplierId: data.supplierId || null,
          saleId: data.saleId || null,
          purchaseId: data.purchaseId || null,
          branchId: activeBranchId,
          userId: context.userId,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          receiptNumber,
          remarks: data.remarks || null,
          type: data.type,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        },
        include: {
          customer: true,
          supplier: true,
          branch: true,
          user: { select: { name: true } },
        },
      });

      // 3. Customer outstanding balance deduction (RECEIVED)
      if (data.type === "RECEIVED" && data.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: data.customerId, businessId: context.businessId },
        });

        if (!customer) {
          throw new Error("Customer not found");
        }

        const newBalance = customer.balance - data.amount;
        await tx.customer.update({
          where: { id: customer.id },
          data: { balance: newBalance },
        });

        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            type: "PAYMENT",
            reference: receiptNumber,
            debit: 0,
            credit: data.amount,
            balance: newBalance,
            description: data.remarks || `Standalone payment received against receipt ${receiptNumber}`,
            createdAt: payment.createdAt,
          },
        });
      }

      // 4. Supplier balance deduction (SENT)
      if (data.type === "SENT" && data.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: data.supplierId, businessId: context.businessId },
        });

        if (!supplier) {
          throw new Error("Supplier not found");
        }

        const newBalance = supplier.balance - data.amount;
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { balance: newBalance },
        });

        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            type: "PAYMENT",
            reference: receiptNumber,
            debit: data.amount,
            credit: 0,
            balance: newBalance,
            description: data.remarks || `Standalone payment sent to supplier against voucher ${receiptNumber}`,
            createdAt: payment.createdAt,
          },
        });
      }

      // 5. Audit Log creation
      await tx.auditLog.create({
        data: {
          businessId: context.businessId,
          userId: context.userId,
          role: context.role,
          branchId: activeBranchId,
          action: "CREATE",
          module: "PAYMENT",
          details: `${data.type} Payment created: ${receiptNumber}, Amount: ${data.amount}, Method: ${data.method}`,
          newValue: JSON.parse(JSON.stringify(payment)),
          ipAddress,
          deviceInfo,
        },
      });

      return payment;
    });

    return NextResponse.json(paymentResult, { status: 201 });
  } catch (error: any) {
    console.error("POST payment error:", error);
    return NextResponse.json({ error: error.message || "Failed to save payment" }, { status: 500 });
  }
}

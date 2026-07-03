import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const businessId = context.businessId;

    const [
      business,
      branches,
      categories,
      brands,
      units,
      products,
      productStocks,
      batches,
      customers,
      suppliers,
      sales,
      saleItems,
      purchases,
      purchaseItems,
      payments,
      expenses,
      auditLogs,
    ] = await Promise.all([
      db.business.findUnique({ where: { id: businessId } }),
      db.branch.findMany({ where: { businessId } }),
      db.category.findMany({ where: { businessId } }),
      db.brand.findMany({ where: { businessId } }),
      db.unit.findMany({ where: { businessId } }),
      db.product.findMany({ where: { businessId } }),
      db.productStock.findMany({ where: { branch: { businessId } } }),
      db.batch.findMany({ where: { branch: { businessId } } }),
      db.customer.findMany({ where: { businessId } }),
      db.supplier.findMany({ where: { businessId } }),
      db.sale.findMany({ where: { businessId } }),
      db.saleItem.findMany({ where: { sale: { businessId } } }),
      db.purchase.findMany({ where: { businessId } }),
      db.purchaseItem.findMany({ where: { purchase: { businessId } } }),
      db.payment.findMany({ where: { businessId } }),
      db.expense.findMany({ where: { businessId } }),
      db.auditLog.findMany({ where: { businessId } }),
    ]);

    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      businessId,
      data: {
        business,
        branches,
        categories,
        brands,
        units,
        products,
        productStocks,
        batches,
        customers,
        suppliers,
        sales,
        saleItems,
        purchases,
        purchaseItems,
        payments,
        expenses,
        auditLogs,
      },
    };

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="dynapos-backup-${business?.slug}-${new Date().toISOString().split("T")[0]}.json"`);
    headers.set("Content-Type", "application/json");

    await db.auditLog.create({
      data: {
        businessId,
        userId: context.userId,
        role: context.role,
        action: "CREATE",
        module: "BACKUP",
        details: `Backup exported successfully.`,
        ipAddress,
        deviceInfo,
      },
    });

    return new Response(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("GET settings backup error:", error);
    return NextResponse.json({ error: "Failed to generate backup export file" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  if (context.role !== "OWNER" && context.role !== "SUPER_ADMIN") {
    return roleErrorResponse();
  }

  const headers = request.headers;
  const xForwardedFor = headers.get("x-forwarded-for");
  const ipAddress = xForwardedFor ? xForwardedFor.split(",")[0].trim() : (headers.get("x-real-ip") || "127.0.0.1");
  const deviceInfo = headers.get("user-agent") || "Unknown Device";

  try {
    const backupJson = await request.json();
    if (!backupJson || backupJson.version !== "1.0" || !backupJson.data) {
      return NextResponse.json({ error: "Invalid backup file structure or version mismatch." }, { status: 400 });
    }

    const {
      products,
      categories,
      brands,
      units,
      customers,
      suppliers,
      sales,
      purchases,
      expenses,
    } = backupJson.data;

    const businessId = context.businessId;

    // Restore inside transaction
    await db.$transaction(async (tx) => {
      // Clear existing records in proper dependency order
      await tx.payment.deleteMany({ where: { businessId } });
      await tx.saleItem.deleteMany({ where: { sale: { businessId } } });
      await tx.sale.deleteMany({ where: { businessId } });
      await tx.purchaseItem.deleteMany({ where: { purchase: { businessId } } });
      await tx.purchase.deleteMany({ where: { businessId } });
      await tx.expense.deleteMany({ where: { businessId } });
      await tx.productStock.deleteMany({ where: { branch: { businessId } } });
      await tx.batch.deleteMany({ where: { branch: { businessId } } });
      await tx.product.deleteMany({ where: { businessId } });
      
      // Clean categories, brands, units, customers, suppliers
      await tx.category.deleteMany({ where: { businessId } });
      await tx.brand.deleteMany({ where: { businessId } });
      await tx.unit.deleteMany({ where: { businessId } });
      await tx.customer.deleteMany({ where: { businessId } });
      await tx.supplier.deleteMany({ where: { businessId } });

      // Import categories, brands, units, customers, suppliers
      if (categories?.length) {
        await tx.category.createMany({
          data: categories.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })),
        });
      }
      if (brands?.length) {
        await tx.brand.createMany({
          data: brands.map((b: any) => ({ ...b, createdAt: new Date(b.createdAt), updatedAt: new Date(b.updatedAt) })),
        });
      }
      if (units?.length) {
        await tx.unit.createMany({
          data: units.map((u: any) => ({ ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt) })),
        });
      }
      if (customers?.length) {
        await tx.customer.createMany({
          data: customers.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) })),
        });
      }
      if (suppliers?.length) {
        await tx.supplier.createMany({
          data: suppliers.map((s: any) => ({ ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) })),
        });
      }

      // Import products and stock levels
      if (products?.length) {
        for (const prod of products) {
          const { productStocks: stks, batches: btch, ...prodData } = prod;
          await tx.product.create({
            data: {
              ...prodData,
              createdAt: new Date(prodData.createdAt),
              updatedAt: new Date(prodData.updatedAt),
              productStocks: stks ? {
                createMany: {
                  data: stks.map((s: any) => ({
                    branchId: s.branchId,
                    quantity: s.quantity,
                    createdAt: new Date(s.createdAt),
                    updatedAt: new Date(s.updatedAt),
                  })),
                },
              } : undefined,
              batches: btch ? {
                createMany: {
                  data: btch.map((b: any) => ({
                    branchId: b.branchId,
                    batchNumber: b.batchNumber,
                    quantity: b.quantity,
                    costPrice: b.costPrice,
                    sellingPrice: b.sellingPrice,
                    expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
                    createdAt: new Date(b.createdAt),
                    updatedAt: new Date(b.updatedAt),
                  })),
                },
              } : undefined,
            },
          });
        }
      }

      // Import sales & saleItems
      if (sales?.length) {
        for (const s of sales) {
          const { saleItems: items, ...sData } = s;
          await tx.sale.create({
            data: {
              ...sData,
              createdAt: new Date(sData.createdAt),
              updatedAt: new Date(sData.updatedAt),
              saleItems: {
                createMany: {
                  data: items.map((i: any) => ({
                    productId: i.productId,
                    batchNumber: i.batchNumber,
                    quantity: i.quantity,
                    costPrice: i.costPrice,
                    price: i.price,
                    discount: i.discount,
                    tax: i.tax,
                    total: i.total,
                  })),
                },
              },
            },
          });
        }
      }

      // Import purchases & purchaseItems
      if (purchases?.length) {
        for (const p of purchases) {
          const { purchaseItems: items, ...pData } = p;
          await tx.purchase.create({
            data: {
              ...pData,
              createdAt: new Date(pData.createdAt),
              updatedAt: new Date(pData.updatedAt),
              purchaseItems: {
                createMany: {
                  data: items.map((i: any) => ({
                    productId: i.productId,
                    batchNumber: i.batchNumber,
                    expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
                    quantity: i.quantity,
                    price: i.price,
                    total: i.total,
                  })),
                },
              },
            },
          });
        }
      }

      // Import expenses
      if (expenses?.length) {
        await tx.expense.createMany({
          data: expenses.map((e: any) => ({ ...e, createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt) })),
        });
      }

      // Import payments
      if (backupJson.data.payments?.length) {
        await tx.payment.createMany({
          data: backupJson.data.payments.map((pay: any) => ({ ...pay, createdAt: new Date(pay.createdAt) })),
        });
      }

      // Write audit log
      await tx.auditLog.create({
        data: {
          businessId,
          userId: context.userId,
          role: context.role,
          action: "RESTORE",
          module: "BACKUP",
          details: `Imported database restore file version ${backupJson.version} successfully.`,
          ipAddress,
          deviceInfo,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Database restored successfully." });
  } catch (error: any) {
    console.error("POST settings restore error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse or restore backup data" }, { status: 500 });
  }
}

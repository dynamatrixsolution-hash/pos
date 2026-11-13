import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const productUpdateSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  wholesalePrice: z.number().nonnegative().optional(),
  alertQuantity: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  unitName: z.string().optional().nullable(),
  batchTracking: z.boolean().optional(),
  expiryTracking: z.boolean().optional(),
  isVatItem: z.boolean().optional(),
  image: z.string().optional().nullable(),
  isRestaurantDish: z.boolean().optional(),
  itemType: z.enum(["MENU_DISH", "KITCHEN_STOCK", "RETAIL"]).optional(),
  prepTimeMinutes: z.number().optional().nullable(),
  kitchenStation: z.string().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  const { id } = await params;

  try {
    const product = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
      include: {
        category: true,
        subcategory: true,
        brand: true,
        unit: true,
        productStocks: {
          where: context.role === "CASHIER" && context.branchId ? { branchId: context.branchId } : undefined,
        },
        batches: {
          where: {
            deletedAt: null,
            branchId: context.role === "CASHIER" && context.branchId ? context.branchId : undefined,
          },
        },
        menuItems: {
          include: {
            section: { select: { id: true, name: true } },
            recipeVersions: {
              where: { isActive: true },
              include: {
                ingredients: {
                  include: {
                    product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error("GET product details error:", error);
    return NextResponse.json({ error: "Failed to fetch product details" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from modifying products
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const result = productUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.format() },
        { status: 400 }
      );
    }

    // Verify product belongs to user's business
    const existingProduct = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const {
      isRestaurantDish,
      itemType,
      unitName,
      prepTimeMinutes,
      kitchenStation,
      ...rawProductUpdateData
    } = result.data;

    const productUpdateData: any = { ...rawProductUpdateData };

    if (!productUpdateData.unitId && unitName && unitName.trim()) {
      const cleanUnit = unitName.trim();
      let matchedUnit = await db.unit.findFirst({
        where: {
          businessId: context.businessId,
          name: { equals: cleanUnit, mode: "insensitive" },
          deletedAt: null,
        },
      });
      if (!matchedUnit) {
        matchedUnit = await db.unit.create({
          data: {
            businessId: context.businessId,
            name: cleanUnit,
          },
        });
      }
      productUpdateData.unitId = matchedUnit.id;
    }

    const updatedProduct = await db.product.update({
      where: { id },
      data: productUpdateData,
    });

    const isDish = isRestaurantDish ?? (itemType === "MENU_DISH" ? true : undefined);

    if (isDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isDish) {
        let targetMenuItemId = existingMenuItem?.id;
        if (existingMenuItem) {
          await db.menuItem.update({
            where: { id: existingMenuItem.id },
            data: {
              name: updatedProduct.name,
              description: updatedProduct.description,
              basePrice: updatedProduct.sellingPrice,
              taxRate: updatedProduct.isVatItem ? 13 : 0,
              imageUrl: updatedProduct.image,
              isAvailable: true,
              prepTimeMinutes: prepTimeMinutes || existingMenuItem.prepTimeMinutes,
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            let menu = await db.menu.findFirst({
              where: { businessId: context.businessId },
            });
            if (!menu) {
              menu = await db.menu.create({
                data: { businessId: context.businessId, name: "Main Dining Menu" },
              });
            }
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                menuId: menu.id,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          const createdMi = await db.menuItem.create({
            data: {
              businessId: context.businessId,
              sectionId: section.id,
              productId: id,
              name: updatedProduct.name,
              description: updatedProduct.description,
              basePrice: updatedProduct.sellingPrice,
              taxRate: updatedProduct.isVatItem ? 13 : 0,
              imageUrl: updatedProduct.image,
              isAvailable: true,
              isKitchenItem: true,
              prepTimeMinutes: prepTimeMinutes || 15,
            },
          });
          targetMenuItemId = createdMi.id;
        }

        if (targetMenuItemId && kitchenStation && kitchenStation.trim()) {
          const cleanStationName = kitchenStation.trim();
          const targetBranchId =
            context.branchId ||
            (await db.branch.findFirst({ where: { businessId: context.businessId }, select: { id: true } }))?.id;
          if (targetBranchId) {
            let station = await db.kitchenStation.findFirst({
              where: {
                businessId: context.businessId,
                branchId: targetBranchId,
                name: { equals: cleanStationName, mode: "insensitive" },
              },
            });
            if (!station) {
              const codeBase = cleanStationName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6) || "STN";
              station = await db.kitchenStation.create({
                data: {
                  businessId: context.businessId,
                  branchId: targetBranchId,
                  name: cleanStationName,
                  code: `${codeBase}-${Math.floor(10 + Math.random() * 89)}`,
                },
              });
            }
            await db.stationRoute.deleteMany({
              where: { businessId: context.businessId, menuItemId: targetMenuItemId },
            });
            await db.stationRoute.create({
              data: {
                businessId: context.businessId,
                stationId: station.id,
                menuItemId: targetMenuItemId,
                priority: 10,
              },
            });
          }
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "PRODUCT",
      actionType: "UPDATE",
      details: `Updated product details for product: ${updatedProduct.name}`,
      oldValue: existingProduct,
      newValue: updatedProduct,
      request,
    });

    if (existingProduct.isVatItem !== (updatedProduct as any).isVatItem) {
      await logActivity({
        userId: context.userId,
        businessId: context.businessId,
        role: context.role,
        moduleName: "TAXATION",
        actionType: "PRODUCT_TAX_UPDATE",
        details: `Nepal Compliance - Product "${updatedProduct.name}" tax settings updated: Taxable=${(updatedProduct as any).isVatItem}`,
        oldValue: { isVatItem: existingProduct.isVatItem },
        newValue: { isVatItem: (updatedProduct as any).isVatItem },
        request,
      });
    }

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error("PUT product details error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export const PATCH = PUT;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  // Block Cashiers from deleting products
  if (context.role === "CASHIER") {
    return roleErrorResponse();
  }

  const { id } = await params;

  try {
    const existingProduct = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Soft delete the product
    await db.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await logActivity({
      userId: context.userId,
      businessId: context.businessId,
      role: context.role,
      moduleName: "PRODUCT",
      actionType: "DELETE",
      details: `Product "${existingProduct.name}" deleted (soft delete)`,
      oldValue: existingProduct,
      request,
    });

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("DELETE product error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}

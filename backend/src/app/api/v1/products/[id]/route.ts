import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

const productUpdateSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional(),
  costPrice: z.number().min(1, "Cost price must be at least 1").optional(),
  sellingPrice: z.number().min(1, "Selling price must be at least 1").optional(),
  wholesalePrice: z.number().nonnegative().optional(),
  alertQuantity: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  subcategoryId: z.string().uuid().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  batchTracking: z.boolean().optional(),
  expiryTracking: z.boolean().optional(),
  isVatItem: z.boolean().optional(),
  image: z.string().optional().nullable(),
  isRestaurantDish: z.boolean().optional(),
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
      },
    });

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

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

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { isRestaurantDish, ...productUpdateData } = result.data;
    const updatedProduct = await db.product.update({
      where: { id },
      data: productUpdateData,
    });

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: 'asc' },
          });
          if (!section) {
            let menu = await db.menu.findFirst({
              where: { businessId: context.businessId },
            });
            if (!menu) {
              menu = await db.menu.create({
                data: { businessId: context.businessId, name: 'Main Dining Menu' },
              });
            }
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                menuId: menu.id,
                name: 'Kitchen Dishes',
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
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

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

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

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }
    }

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error("PUT product details error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

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
    // Verify product belongs to business
    const existingProduct = await db.product.findFirst({
      where: {
        id,
        businessId: context.businessId,
        deletedAt: null,
      },
    });

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

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

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
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
      actionType: "DELETE",
      details: `Product "${existingProduct.name}" deleted (soft delete)`,
      oldValue: existingProduct,
      request,
    });

    if (isRestaurantDish !== undefined) {
      const existingMenuItem = await db.menuItem.findFirst({
        where: { businessId: context.businessId, productId: id },
      });
      if (isRestaurantDish) {
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
            },
          });
        } else {
          let section = await db.menuSection.findFirst({
            where: { businessId: context.businessId },
            orderBy: { displayOrder: "asc" },
          });
          if (!section) {
            section = await db.menuSection.create({
              data: {
                businessId: context.businessId,
                name: "Kitchen Dishes",
                displayOrder: 0,
              },
            });
          }
          await db.menuItem.create({
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
            },
          });
        }
      } else if (existingMenuItem) {
        await db.menuItem.update({
          where: { id: existingMenuItem.id },
          data: { isAvailable: false },
        });
      }
    }

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("DELETE product error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}

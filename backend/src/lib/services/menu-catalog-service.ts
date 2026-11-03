import { db } from "@/lib/db";
import { Prisma } from "@dynapos/db";
import { toDecimal, money } from "@/lib/services/decimal-math";
import { createAuditEvent } from "@/lib/audit-event";

export class MenuCatalogError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "MenuCatalogError";
    this.statusCode = statusCode;
  }
}

export interface CreateMenuInput {
  businessId: string;
  branchId?: string | null;
  name: string;
  description?: string;
  availableFrom?: string;
  availableTo?: string;
  displayOrder?: number;
}

export interface CreateSectionInput {
  businessId: string;
  menuId: string;
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface CreateMenuItemInput {
  businessId: string;
  sectionId: string;
  productId?: string;
  name: string;
  description?: string;
  basePrice: number | string | Prisma.Decimal;
  taxRate?: number | string | Prisma.Decimal;
  imageUrl?: string;
  isAvailable?: boolean;
  isKitchenItem?: boolean;
  prepTimeMinutes?: number;
  displayOrder?: number;
  modifierGroupIds?: string[];
}

export interface CreateModifierGroupInput {
  businessId: string;
  name: string;
  displayName?: string;
  minSelections?: number;
  maxSelections?: number;
  options: {
    name: string;
    priceDelta: number | string | Prisma.Decimal;
    displayOrder?: number;
    isAvailable?: boolean;
  }[];
}

/**
 * Create a new Menu
 */
export async function createMenu(input: CreateMenuInput) {
  return await db.menu.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId || null,
      name: input.name,
      description: input.description || null,
      availableFrom: input.availableFrom || null,
      availableTo: input.availableTo || null,
      displayOrder: input.displayOrder ?? 0,
    },
  });
}

/**
 * Create a section inside a Menu
 */
export async function createMenuSection(input: CreateSectionInput) {
  const menu = await db.menu.findFirst({
    where: { id: input.menuId, businessId: input.businessId },
  });
  if (!menu) throw new MenuCatalogError("Menu not found", 404);

  return await db.menuSection.create({
    data: {
      businessId: input.businessId,
      menuId: input.menuId,
      name: input.name,
      description: input.description || null,
      displayOrder: input.displayOrder ?? 0,
    },
  });
}

/**
 * Get or create a default menu section
 */
export async function getOrCreateDefaultSection(businessId: string, sectionName: string = "Kitchen Dishes") {
  let section = await db.menuSection.findFirst({
    where: { businessId, name: sectionName },
  });
  if (section) return section;

  let menu = await db.menu.findFirst({
    where: { businessId },
    orderBy: { displayOrder: "asc" },
  });
  if (!menu) {
    menu = await db.menu.create({
      data: {
        businessId,
        name: "Main Dining Menu",
        displayOrder: 0,
      },
    });
  }

  section = await db.menuSection.create({
    data: {
      businessId,
      menuId: menu.id,
      name: sectionName,
      displayOrder: 0,
    },
  });

  return section;
}

/**
 * Create a Menu Item with optional modifier groups attached
 */
export async function createMenuItem(input: CreateMenuItemInput) {
  const section = await db.menuSection.findFirst({
    where: { id: input.sectionId, businessId: input.businessId },
  });
  if (!section) throw new MenuCatalogError("Menu section not found", 404);

  const basePriceDec = money(input.basePrice);
  const taxRateDec = input.taxRate !== undefined ? toDecimal(input.taxRate) : new Prisma.Decimal(0);

  return await db.$transaction(async (tx) => {
    let productId = input.productId || null;
    if (!productId) {
      let cat = await tx.category.findFirst({
        where: { businessId: input.businessId, name: section.name },
      });
      if (!cat) {
        cat = await tx.category.create({
          data: { businessId: input.businessId, name: section.name },
        });
      }
      const sku = "MENU-" + input.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      const product = await tx.product.create({
        data: {
          businessId: input.businessId,
          categoryId: cat.id,
          name: input.name,
          sku,
          description: input.description,
          costPrice: basePriceDec.mul(0.4),
          sellingPrice: basePriceDec,
          wholesalePrice: basePriceDec,
          alertQuantity: 0,
          batchTracking: false,
          expiryTracking: false,
          isVatItem: true,
        },
      });
      productId = product.id;

      const branches = await tx.branch.findMany({
        where: { businessId: input.businessId },
      });
      for (const branch of branches) {
        await tx.productStock.create({
          data: {
            productId: product.id,
            branchId: branch.id,
            quantity: 999,
          },
        });
      }
    }

    const item = await tx.menuItem.create({
      data: {
        businessId: input.businessId,
        sectionId: input.sectionId,
        productId,
        name: input.name,
        description: input.description || null,
        basePrice: basePriceDec,
        taxRate: taxRateDec,
        imageUrl: input.imageUrl || null,
        isAvailable: input.isAvailable ?? true,
        isKitchenItem: input.isKitchenItem ?? true,
        prepTimeMinutes: input.prepTimeMinutes || null,
        displayOrder: input.displayOrder ?? 0,
      },
    });

    if (input.modifierGroupIds && input.modifierGroupIds.length > 0) {
      for (let i = 0; i < input.modifierGroupIds.length; i++) {
        const mgId = input.modifierGroupIds[i];
        await tx.menuItemModifierGroup.create({
          data: {
            businessId: input.businessId,
            menuItemId: item.id,
            modifierGroupId: mgId,
            displayOrder: i,
          },
        });
      }
    }

    return item;
  });
}

/**
 * Create a Modifier Group and its options
 */
export async function createModifierGroup(input: CreateModifierGroupInput) {
  return await db.$transaction(async (tx) => {
    const group = await tx.modifierGroup.create({
      data: {
        businessId: input.businessId,
        name: input.name,
        displayName: input.displayName || input.name,
        minSelections: input.minSelections ?? 0,
        maxSelections: input.maxSelections ?? 1,
      },
    });

    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i];
      await tx.modifierOption.create({
        data: {
          businessId: input.businessId,
          modifierGroupId: group.id,
          name: opt.name,
          priceDelta: money(opt.priceDelta),
          displayOrder: opt.displayOrder ?? i,
          isAvailable: opt.isAvailable ?? true,
        },
      });
    }

    return await tx.modifierGroup.findUnique({
      where: { id: group.id },
      include: { options: true },
    });
  });
}

/**
 * Fetch staff catalog for active branch with complete hierarchy:
 * Menus -> Sections -> Items (available) -> Modifier Groups -> Options
 */
export async function getStaffMenuCatalog(businessId: string, branchId?: string | null) {
  const menus = await db.menu.findMany({
    where: {
      businessId,
      isActive: true,
      OR: [
        { branchId: null },
        ...(branchId ? [{ branchId }] : []),
      ],
    },
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: { displayOrder: "asc" },
            include: {
              modifierGroups: {
                orderBy: { displayOrder: "asc" },
                include: {
                  modifierGroup: {
                    include: {
                      options: {
                        where: { isAvailable: true },
                        orderBy: { displayOrder: "asc" },
                      },
                    },
                  },
                },
              },
              recipeVersions: {
                where: { isActive: true },
                include: {
                  ingredients: {
                    include: {
                      product: {
                        include: {
                          productStocks: {
                            where: branchId ? { branchId } : {},
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Calculate ingredient-level out-of-stock (86'd) status for each item
  return menus.map((menu) => ({
    ...menu,
    sections: menu.sections.map((sec) => ({
      ...sec,
      items: sec.items.map((item) => {
        const outOfStockIngredients: string[] = [];
        if (item.recipeVersions && item.recipeVersions.length > 0) {
          const activeRecipe = item.recipeVersions[0];
          for (const ing of activeRecipe.ingredients) {
            const totalStock = (ing.product?.productStocks || []).reduce(
              (sum, s) => sum + s.quantity,
              0
            );
            const requiredQty = Number(ing.quantity) || 0;
            if (totalStock < requiredQty || totalStock <= 0) {
              outOfStockIngredients.push(ing.product?.name || "Ingredient");
            }
          }
        }
        return {
          ...item,
          isOutOfStock: outOfStockIngredients.length > 0,
          outOfStockIngredients,
        };
      }),
    })),
  }));
}

/**
 * Update an existing Menu Section (Category/Subcategory)
 */
export async function updateMenuSection(
  businessId: string,
  sectionId: string,
  data: { name?: string; description?: string; displayOrder?: number; isActive?: boolean }
) {
  const section = await db.menuSection.findFirst({
    where: { id: sectionId, businessId },
  });
  if (!section) throw new MenuCatalogError("Menu section not found", 404);

  return await db.menuSection.update({
    where: { id: sectionId },
    data: {
      name: data.name !== undefined ? data.name : undefined,
      description: data.description !== undefined ? data.description : undefined,
      displayOrder: data.displayOrder !== undefined ? data.displayOrder : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    },
  });
}

/**
 * Delete a Menu Section (and its items)
 */
export async function deleteMenuSection(businessId: string, sectionId: string) {
  const section = await db.menuSection.findFirst({
    where: { id: sectionId, businessId },
  });
  if (!section) throw new MenuCatalogError("Menu section not found", 404);

  return await db.menuSection.delete({
    where: { id: sectionId },
  });
}

/**
 * Update an existing Menu Item
 */
export async function updateMenuItem(
  businessId: string,
  itemId: string,
  data: {
    sectionId?: string;
    name?: string;
    description?: string | null;
    basePrice?: number | string | Prisma.Decimal;
    taxRate?: number | string | Prisma.Decimal;
    imageUrl?: string | null;
    isAvailable?: boolean;
    prepTimeMinutes?: number | null;
    modifierGroupIds?: string[];
  }
) {
  const item = await db.menuItem.findFirst({
    where: { id: itemId, businessId },
  });
  if (!item) throw new MenuCatalogError("Menu item not found", 404);

  return await db.$transaction(async (tx) => {
    const updated = await tx.menuItem.update({
      where: { id: itemId },
      data: {
        sectionId: data.sectionId !== undefined ? data.sectionId : undefined,
        name: data.name !== undefined ? data.name : undefined,
        description: data.description !== undefined ? data.description : undefined,
        basePrice: data.basePrice !== undefined ? money(data.basePrice) : undefined,
        taxRate: data.taxRate !== undefined ? toDecimal(data.taxRate) : undefined,
        imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : undefined,
        prepTimeMinutes: data.prepTimeMinutes !== undefined ? data.prepTimeMinutes : undefined,
      },
    });

    if (data.modifierGroupIds !== undefined) {
      await tx.menuItemModifierGroup.deleteMany({
        where: { menuItemId: itemId, businessId },
      });

      for (let i = 0; i < data.modifierGroupIds.length; i++) {
        await tx.menuItemModifierGroup.create({
          data: {
            businessId,
            menuItemId: itemId,
            modifierGroupId: data.modifierGroupIds[i],
            displayOrder: i,
          },
        });
      }
    }

    return updated;
  });
}

/**
 * Delete a Menu Item
 */
export async function deleteMenuItem(businessId: string, itemId: string) {
  const item = await db.menuItem.findFirst({
    where: { id: itemId, businessId },
  });
  if (!item) throw new MenuCatalogError("Menu item not found", 404);

  return await db.menuItem.delete({
    where: { id: itemId },
  });
}

/**
 * Get all Modifier Groups for a business
 */
export async function getModifierGroups(businessId: string) {
  return await db.modifierGroup.findMany({
    where: { businessId },
    include: {
      options: {
        orderBy: { displayOrder: "asc" },
      },
      menuItemLinks: {
        include: {
          menuItem: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Update a Modifier Group and replace options
 */
export async function updateModifierGroup(
  businessId: string,
  groupId: string,
  data: {
    name?: string;
    displayName?: string;
    minSelections?: number;
    maxSelections?: number;
    options?: {
      id?: string;
      name: string;
      priceDelta: number | string | Prisma.Decimal;
      isAvailable?: boolean;
    }[];
  }
) {
  const group = await db.modifierGroup.findFirst({
    where: { id: groupId, businessId },
  });
  if (!group) throw new MenuCatalogError("Modifier group not found", 404);

  return await db.$transaction(async (tx) => {
    const updated = await tx.modifierGroup.update({
      where: { id: groupId },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        displayName: data.displayName !== undefined ? data.displayName : undefined,
        minSelections: data.minSelections !== undefined ? data.minSelections : undefined,
        maxSelections: data.maxSelections !== undefined ? data.maxSelections : undefined,
      },
    });

    if (data.options !== undefined) {
      await tx.modifierOption.deleteMany({
        where: { modifierGroupId: groupId, businessId },
      });

      for (let i = 0; i < data.options.length; i++) {
        const opt = data.options[i];
        await tx.modifierOption.create({
          data: {
            businessId,
            modifierGroupId: groupId,
            name: opt.name,
            priceDelta: money(opt.priceDelta),
            displayOrder: i,
            isAvailable: opt.isAvailable ?? true,
          },
        });
      }
    }

    return await tx.modifierGroup.findUnique({
      where: { id: groupId },
      include: { options: true },
    });
  });
}

/**
 * Delete a Modifier Group
 */
export async function deleteModifierGroup(businessId: string, groupId: string) {
  const group = await db.modifierGroup.findFirst({
    where: { id: groupId, businessId },
  });
  if (!group) throw new MenuCatalogError("Modifier group not found", 404);

  return await db.modifierGroup.delete({
    where: { id: groupId },
  });
}



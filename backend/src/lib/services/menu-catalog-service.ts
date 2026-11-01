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
    const item = await tx.menuItem.create({
      data: {
        businessId: input.businessId,
        sectionId: input.sectionId,
        productId: input.productId || null,
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
  return await db.menu.findMany({
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
            },
          },
        },
      },
    },
  });
}


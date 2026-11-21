/**
 * Restaurant POS Domain Models & Types
 * Clean Architecture Model Layer
 */

export type OrderType = "DINE_IN" | "ROOM_SERVICE" | "TAKEAWAY" | "DELIVERY";
export type SpaceCategory = "ALL" | "TABLE" | "CABIN" | "VIP_ROOM" | "HALL" | "TAKEAWAY" | "DELIVERY";
export type SpaceStatus = "ALL" | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED";
export type DineInView = "SELECT_SPACE" | "MENU_POS";

export interface Floor {
  id: string;
  name: string;
  level: number;
}

export interface SpaceTable {
  id: string;
  tableNumber: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED";
  floorId?: string;
  floor?: Floor;
  currentSessionId?: string | null;
  tableSessions?: any[];
  qrLocations?: { id: string; publicCode: string }[];
  metadata?: {
    category?: "TABLE" | "CABIN" | "VIP_ROOM" | "HALL";
    shape?: string;
  };
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: ModifierOption[];
}

export interface MenuItemWithModifiers {
  id: string;
  name: string;
  code?: string;
  description?: string;
  basePrice: number | string;
  imageUrl?: string;
  categoryName?: string;
  subcategoryId?: string;
  modifierGroups?: ModifierGroup[];
  hasModifiers?: boolean;
  stationId?: string;
}

export interface SelectedModifier {
  modifierGroupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface DraftLine {
  item: MenuItemWithModifiers;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  notes: string;
  totalPrice: number;
  servingType?: "DINE_IN_PLATE" | "TAKEAWAY_PARCEL";
}

export interface ExistingRoundLine {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: string;
  total: string;
  acceptanceStatus?: string;
  fulfillmentStatus?: string;
  rejectionReason?: string;
  notes?: string;
  appliedModifiers?: any[];
}

export interface ExistingRound {
  id: string;
  roundNumber: number;
  notes?: string;
  lines: ExistingRoundLine[];
}

export interface ActiveTicket {
  id: string;
  ticketType: OrderType;
  title: string;
  subTitle: string;
  table?: SpaceTable;
  order?: any;
  orderNumber?: string;
  itemCount: number;
  totalAmount: number;
  roundCount: number;
  status: string;
  isCurrent: boolean;
}

export interface HotelStayOption {
  id: string;
  roomId: string;
  guestName: string;
  room?: {
    id: string;
    roomNumber: string;
    floor?: { name: string };
  };
}

export interface DeliveryDetails {
  customerName: string;
  phone: string;
  address: string;
  riderName: string;
  deliveryFee: string;
  packagingFee?: string;
  expressFee?: string;
  notes: string;
}

export interface TableCancellationTarget {
  tableId?: string;
  tableNumber?: string;
  title?: string;
  orderId?: string;
  sessionId?: string;
  itemCount: number;
  totalAmount: string;
}

export interface LineAdjustmentTarget {
  orderId: string;
  lineId: string;
  itemName: string;
  currentQty: number;
  notes?: string;
}

export interface MenuSection {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  items?: any[];
}

export interface MenuRecipeIngredient {
  id?: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    costPrice?: number | string;
    productStocks?: { quantity: number }[];
  };
  quantity: number | string;
  unit: string;
  wastagePercent: number | string;
}

export interface MenuRecipeVersion {
  id: string;
  versionNumber: number;
  yieldQuantity: number | string;
  yieldUnit: string;
  notes?: string | null;
  isActive: boolean;
  ingredients: MenuRecipeIngredient[];
}

export interface MenuItemDetail {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number | string;
  taxRate: number | string;
  imageUrl?: string | null;
  isAvailable: boolean;
  prepTimeMinutes?: number | null;
  sectionId: string;
  section?: { id: string; name: string };
  modifierGroups?: {
    modifierGroup: ModifierGroup;
  }[];
  recipeVersions?: MenuRecipeVersion[];
}



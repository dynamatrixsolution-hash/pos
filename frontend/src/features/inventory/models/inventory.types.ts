/**
 * Inventory Feature Domain Models
 * Clean Architecture Model Layer
 */

export interface InventoryItemStock {
  branchId: string;
  branchName: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryName: string;
  unitName: string;
  costPrice: number;
  sellingPrice: number;
  alertQuantity: number;
  totalQuantity: number;
  isLowStock: boolean;
  valuation: number;
  stocks: InventoryItemStock[];
}

export interface InventoryMetrics {
  totalValuation: number;
  lowStockCount: number;
  totalItems: number;
}

export interface BranchOption {
  id: string;
  name: string;
  isMain?: boolean;
}

export type InventorySection =
  | "overview"
  | "current-stock"
  | "stock-movements"
  | "stock-adjustments"
  | "batch-stock"
  | "damage-expiry"
  | "stock-value"
  | "movement-history";

export interface OpeningStockEntry {
  id: string;
  quantity: number;
  unitType: string;
  purchaseRate: number;
  sellingPrice: number;
  mrp: number;
  totalValue: number;
  batchNumber: string | null;
  expiryDate: string | null;
  manufacturingDate: string | null;
  rackNumber: string | null;
  remarks: string | null;
  approvalStatus: string;
  createdAt: string;
  productId: string;
  branchId: string;
  supplierId: string | null;
  product: {
    name: string;
    sku: string | null;
    barcode: string | null;
    category?: { name: string } | null;
    brand?: { name: string } | null;
  };
  branch: { name: string };
  supplier: { name: string } | null;
  enteredBy: { name: string };
  approvedBy: { name: string } | null;
}

export interface StockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  quantity: number;
  receivedQuantity?: number | null;
  costPrice?: number;
  remarks?: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit?: { name: string } | null;
  };
}

export type TransferStatus =
  | "PENDING"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranch: { id: string; name: string };
  destinationBranchId: string;
  destinationBranch: { id: string; name: string };
  status: TransferStatus;
  notes?: string | null;
  items: StockTransferItem[];
  createdBy?: { name: string } | null;
  approvedBy?: { name: string } | null;
  receivedBy?: { name: string } | null;
  createdAt: string;
  updatedAt: string;
}



export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  role: 'Admin' | 'StoreManager' | 'StoreUser' | 'DepartmentUser' | 'PurchaseUser' | 'Viewer';
  departmentId?: number;
  departmentName?: string;
  password?: string;
  permissions?: string[];
  isPrimaryAdmin?: boolean;
  signatureDataUrl?: string;
  visiblePassword?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Material {
  id: number;
  materialCode: string;
  materialName: string;
  categoryId?: number;
  categoryName?: string;
  defaultUom: string;
  reorderLevel: number;
  monthlyRequirement: number;
  userDepartmentId?: number;
  userDepartmentName?: string;
  standardPrice: number;
  revisedPrice: number;
  primarySupplierName?: string;
  currentStock: number;
  daysOfStock: number;
  dailyConsumptionRate: number;
  pendingPoQuantity: number;
  requiredPoQuantity: number;
  stockValue: number;
  stockStatus: 'Normal' | 'LowStock' | 'OutOfStock' | 'ExcessStock';
  isActive: boolean;
}

export interface MaterialCategory {
  id: number;
  name: string;
  description?: string;
}

export interface Department {
  id: number;
  name: string;
  code?: string;
}

export interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  isActive: boolean;
}

export interface StockLedgerEntry {
  id: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  categoryName: string;
  uom: string;
  transactionDate: string;
  transactionType: string;
  referenceType: string;
  referenceNumber?: string;
  batchNumber?: string;
  quantityIn: number;
  quantityOut: number;
  unitCost: number;
  totalCost: number;
  balanceQuantityAfter: number;
  notes?: string;
  remarks?: string;
  supplierName?: string;
  departmentName?: string;
  issuedTo?: string;
  createdByUsername?: string;
}

export interface MaterialBatch {
  id: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  categoryName: string;
  uom: string;
  batchNumber: string;
  unitPrice: number;
  inwardQuantity: number;
  issuedQuantity: number;
  currentStock: number;
  totalValuation: number;
  firstReceiptDate: string;
  latestReceiptDate: string;
  lastSupplierName?: string;
  remarks?: string;
  status: string;
}

export interface MaterialReceipt {
  id: number;
  grnNumber: string;
  receiptDate: string;
  supplierId?: number;
  supplierName?: string;
  poNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dcNumber?: string;
  vehicleNumber?: string;
  totalAmount: number;
  remarks?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedAt?: string;
  approvedBy?: string;
  receivedBy?: string;
  itemCount: number;
  items?: MaterialReceiptItem[];
}

export interface MaterialReceiptItem {
  id: number;
  materialId: number;
  materialCode?: string;
  materialName?: string;
  uom?: string;
  batchNumber?: string;
  receivedQuantity: number;
  unitPrice: number;
  totalAmount: number;
  remarks?: string;
}

export interface StoreRequisitionItem {
  id: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  categoryName?: string;
  defaultUom: string;
  batchNumber?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  currentStock: number;
  reorderLevel: number;
  stockStatus: string;
  unitPrice: number;
  totalCost: number;
  location?: string;
  itemRemarks?: string;
}

export interface StoreRequisition {
  id: number;
  requisitionNumber: string;
  requisitionDate: string;
  requiredDate?: string;
  departmentId?: number;
  departmentName?: string;
  requestedBy?: string;
  requestedByUserId?: number;
  requestedByUsername?: string;
  shift: string;
  purpose: string;
  jobOrderOrMachine?: string;
  status: 'Pending' | 'Allowed' | 'Denied' | 'Draft';
  totalEstimatedCost: number;
  remarks?: string;
  processedByUserId?: number;
  processedByUsername?: string;
  processedAt?: string;
  denialRemarks?: string;
  resultingIssueSlipNumber?: string;
  resultingMaterialIssueId?: number;
  supervisorSignature?: string;
  createdAt: string;
  updatedAt?: string;
  items: StoreRequisitionItem[];
}

export interface Supervisor {
  id: number;
  name: string;
  department: string;
  phone?: string;
  shift?: string;
  signatureDataUrl?: string;
}

export interface MaterialIssue {
  id: number;
  issueSlipNumber: string;
  issueDate: string;
  departmentId?: number;
  departmentName?: string;
  supervisorName?: string;
  supervisorSignature?: string;
  shift?: string;
  purpose?: string;
  issuedTo?: string;
  totalIssueCost: number;
  remarks?: string;
  issuedBy?: string;
  itemCount: number;
  items?: MaterialIssueItem[];
}

export interface MaterialIssueItem {
  id: number;
  materialId: number;
  materialCode?: string;
  materialName?: string;
  uom?: string;
  batchNumber?: string;
  requestedQuantity: number;
  issuedQuantity: number;
  unitCost: number;
  totalCost: number;
  location?: string;
  remarks?: string;
}

export interface PurchaseRequest {
  id: number;
  prNumber: string;
  requestDate: string;
  departmentId?: number;
  departmentName?: string;
  priority: 'Normal' | 'Urgent' | 'Emergency';
  requiredByDate?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'ConvertedToPO' | 'PartiallyReceived' | 'Completed' | 'Cancelled';
  purpose?: string;
  totalEstimatedValue: number;
  approvalRemarks?: string;
  createdBy?: string;
  approvedBy?: string;
  itemCount: number;
  items?: PurchaseRequestItem[];
}

export interface PurchaseRequestItem {
  id: number;
  materialId: number;
  materialCode?: string;
  materialName?: string;
  uom?: string;
  requestedQuantity: number;
  availableStockAtRequest: number;
  reorderLevelAtRequest: number;
  estimatedUnitPrice: number;
  totalAmount: number;
  preferredSupplierId?: number;
  preferredSupplierName?: string;
  purpose?: string;
  discountTerms?: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  poDate: string;
  supplierId?: number;
  supplierName?: string;
  purchaseRequestId?: number;
  prNumber?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  status: 'Draft' | 'Issued' | 'PartiallyReceived' | 'Completed' | 'Cancelled';
  totalAmount: number;
  totalPoQuantity: number;
  totalReceivedQuantity: number;
  totalPendingQuantity: number;
  createdBy?: string;
  itemCount: number;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: number;
  materialId: number;
  materialCode?: string;
  materialName?: string;
  uom?: string;
  poQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
  totalPrice: number;
  remarks?: string;
}

export interface CoreMaster {
  id: number;
  coreCode: string;
  coreName: string;
  uom: string;
  weightPerUnitKg: number;
  standardPrice: number;
  supplierId?: number;
  supplierName?: string;
  isActive: boolean;
}

export interface CoreDailyTracking {
  id: number;
  coreId: number;
  coreCode: string;
  coreName: string;
  trackingDate: string;
  plannedQuantity: number;
  actualQuantity: number;
  dispatchedQuantity: number;
  unitPrice: number;
  totalCost: number;
  varianceQuantity: number;
  achievementPercentage: number;
}

export interface CoreRejection {
  id: number;
  coreId?: number;
  coreOrMaterialName: string;
  rejectionDate: string;
  inwardDate?: string;
  invoiceNumber?: string;
  supplierId?: number;
  supplierName?: string;
  rejectedQuantity: number;
  reason?: string;
  remarks?: string;
  status: string;
}

export interface CylinderMaster {
  id: number;
  cylinderCode: string;
  cylinderName: string;
  gasType: string;
  capacity: string;
  defaultSupplierId?: number;
  defaultSupplierName?: string;
  currentFullStock: number;
  currentEmptyStock: number;
  isActive: boolean;
}

export interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  designation?: string;
  departmentId?: number;
  departmentName?: string;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  attendanceDate: string;
  status: 'P' | 'A' | 'H' | 'L';
  workingHours: number;
  overtimeHours: number;
  remarks?: string;
}

export interface CottonGloveConsumption {
  id: number;
  departmentId?: number;
  departmentName: string;
  supervisorName: string;
  manpowerCount: number;
  logDate: string;
  weekNumber: number;
  quantityIssued: number;
  remarks?: string;
}

export interface MaterialColourCode {
  id: number;
  materialId?: number;
  customerName: string;
  modelNumber: string;
  materialGrade: string;
  colour1: string;
  colour2?: string;
  remarks?: string;
}

export interface CostSaving {
  id: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  currentSupplier?: string;
  newSupplier?: string;
  currentSupplierPrice: number;
  newSupplierPrice: number;
  priceDifference: number;
  perMonthAveragePurchaseQty: number;
  monthlyCostSavings: number;
  remarks?: string;
}

export interface DashboardData {
  kpis: {
    totalMaterials: number;
    totalAvailableStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    todayReceiptsQuantity: number;
    todayReceiptsValue: number;
    todayIssuesQuantity: number;
    todayIssuesValue: number;
    currentMonthPurchaseValue: number;
    currentMonthConsumptionValue: number;
    pendingPrCount: number;
    pendingPoCount: number;
    totalProjectedMonthlySavings: number;
  };
  categoryDistribution: { categoryName: string; totalSpend: number; percentage: number }[];
  supplierDistribution: { supplierName: string; totalSpend: number; percentage: number }[];
  monthlyTrends: { month: string; purchaseAmount: number; consumptionAmount: number }[];
  topConsumedItems: { materialCode: string; materialName: string; quantity: number; cost: number }[];
  criticalAlerts: { materialCode: string; materialName: string; currentStock: number; reorderLevel: number; daysOfStock: number; uom: string }[];
}

export interface AuditLog {
  id: number;
  userId?: number;
  username?: string;
  action: string;
  entityName: string;
  recordId?: string;
  oldValues?: string;
  newValues?: string;
  timestamp: string;
  ipAddress?: string;
}

export interface SupplierPriceOption {
  supplierId: number;
  supplierName: string;
  price: number;
  isL1Lowest: boolean;
  isPreferred: boolean;
  effectiveDate?: string;
}

export interface LowStockRequisitionItem {
  materialId: number;
  materialCode: string;
  materialName: string;
  uom: string;
  categoryName: string;
  departmentName: string;
  currentStock: number;
  reorderLevel: number;
  deficitQuantity: number;
  recommendedQuantity: number;
  l1SupplierId?: number;
  l1SupplierName: string;
  l1UnitPrice: number;
  estimatedTotalValue: number;
  supplierPriceOptions: SupplierPriceOption[];
  hasPendingRequisition: boolean;
  pendingDocNumber?: string;
}

export interface AutoRequisitionResult {
  success: boolean;
  message: string;
  totalItemsProcessed: number;
  totalPrsCreated: number;
  totalPosCreated: number;
  totalEstimatedValue: number;
  createdPrNumbers: string[];
  createdPoNumbers: string[];
  logs: string[];
}



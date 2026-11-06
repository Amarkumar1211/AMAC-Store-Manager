namespace StoreManager.Api.Models;

public enum UserRole
{
    Admin,
    StoreManager,
    StoreUser,
    DepartmentUser,
    PurchaseUser,
    Viewer
}

public enum TransactionType
{
    Opening,
    Receipt,
    Issue,
    Adjustment,
    Return,
    Rejection
}

public enum ReferenceType
{
    OpeningBalance,
    GRN,
    IssueSlip,
    StockAdjustment,
    PurchaseOrder,
    SupplierRejection,
    ManualCorrection
}

public enum PrPriority
{
    Normal,
    Urgent,
    Emergency
}

public enum PrStatus
{
    Draft,
    Submitted,
    Approved,
    Rejected,
    ConvertedToPO,
    PartiallyReceived,
    Completed,
    Cancelled
}

public enum PoStatus
{
    Draft,
    Issued,
    PartiallyReceived,
    Completed,
    Cancelled
}

public enum AdjustmentType
{
    PhysicalCountSurplus,
    PhysicalCountDeficit,
    Damaged,
    Reclassification,
    ManualCorrection
}

public enum AttendanceStatus
{
    P, // Present
    A, // Absent
    H, // Holiday
    L  // Leave
}

/// <summary>
/// Type-safe status for Store Requisitions.
/// Stored as string in the database for human readability.
/// </summary>
public enum RequisitionStatus
{
    Pending,
    Allowed,
    Denied,
    Draft
}

using StoreManager.Api.Models;

namespace StoreManager.Api.DTOs;

public record LoginRequest(string Username, string Password);
public record UserDto(int Id, string Username, string FullName, string Role, string? Email = null, List<string>? Permissions = null, int? DepartmentId = null, string? DepartmentName = null);
public record LoginResponse(string Token, string Username, string FullName, string Role, int UserId, UserDto? User = null, List<string>? Permissions = null, int? DepartmentId = null, string? DepartmentName = null);
public record ChangePasswordRequest(string OldPassword, string NewPassword);
public record UserCreateDto(string Username, string Password, string FullName, string? Email, UserRole Role, List<string>? Permissions = null, int? DepartmentId = null, string? DepartmentName = null);
public record UserPermissionsUpdateRequest(List<string> Permissions);

public record MaterialDto(
    int Id,
    string MaterialCode,
    string MaterialName,
    int? CategoryId,
    string? CategoryName,
    string DefaultUom,
    decimal ReorderLevel,
    decimal MonthlyRequirement,
    int? UserDepartmentId,
    string? UserDepartmentName,
    decimal StandardPrice,
    decimal RevisedPrice,
    string? PrimarySupplierName,
    decimal CurrentStock,
    decimal DaysOfStock,
    decimal DailyConsumptionRate,
    decimal PendingPoQuantity,
    decimal RequiredPoQuantity,
    decimal StockValue,
    string StockStatus, // Normal, LowStock, OutOfStock, ExcessStock
    bool IsActive
);

public record CreateMaterialDto(
    string MaterialCode,
    string MaterialName,
    int? CategoryId,
    string DefaultUom,
    decimal MinStockLevel,
    decimal ReorderLevel,
    decimal MaxStockLevel,
    decimal MonthlyRequirement,
    int? UserDepartmentId,
    decimal StandardPrice,
    decimal RevisedPrice,
    string? PrimarySupplierName,
    decimal? OpeningStock = 0
);

public record SupplierDto(
    int Id,
    string SupplierName,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? GstNumber,
    bool IsActive
);

public record BatchDeleteSuppliersRequest(List<int> SupplierIds);
public record DeleteAllSuppliersRequest(bool InactiveOnly);


public record SupplierMaterialPriceDto(
    int Id,
    int SupplierId,
    string SupplierName,
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    decimal Price,
    decimal RevisedPrice,
    DateTime EffectiveDate,
    bool IsPreferred,
    string? Remarks
);

public record MaterialColourCodeDto(
    int Id,
    int? MaterialId,
    string CustomerName,
    string ModelNumber,
    string MaterialGrade,
    string Colour1,
    string? Colour2,
    string? Remarks
);

public record StockLedgerEntryDto(
    long Id,
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string CategoryName,
    string Uom,
    DateTime TransactionDate,
    string TransactionType,
    string ReferenceType,
    string? ReferenceNumber,
    string? BatchNumber,
    decimal QuantityIn,
    decimal QuantityOut,
    decimal UnitCost,
    decimal TotalCost,
    decimal BalanceQuantityAfter,
    string? Notes,
    string? CreatedByUsername
);

public record MaterialBatchDto(
    int Id,
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string CategoryName,
    string Uom,
    string BatchNumber,
    DateTime FirstReceiptDate,
    DateTime LatestReceiptDate,
    decimal InwardQuantity,
    decimal IssuedQuantity,
    decimal CurrentStock,
    decimal UnitPrice,
    decimal TotalValuation,
    int? LastSupplierId,
    string? LastSupplierName,
    string? Remarks
);

public record BatchLookupDto(
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string BatchNumber,
    decimal UnitPrice,
    decimal CurrentStock,
    decimal InwardQuantity,
    decimal IssuedQuantity,
    string? LastSupplierName,
    DateTime? LatestReceiptDate
);

public record CreateStockAdjustmentDto(
    int MaterialId,
    DateTime AdjustmentDate,
    AdjustmentType AdjustmentType,
    decimal PhysicalStock,
    string Reason
);

public record CreateReceiptItemDto(
    int MaterialId,
    decimal ReceivedQuantity,
    decimal UnitPrice,
    string? BatchNumber = null,
    string? Remarks = null
);

public record CreateReceiptDto(
    DateTime ReceiptDate,
    int? SupplierId,
    string? SupplierName,
    int? PurchaseOrderId,
    string? PoNumber,
    string? InvoiceNumber,
    DateTime? InvoiceDate,
    string? DcNumber,
    string? VehicleNumber,
    string? Remarks,
    List<CreateReceiptItemDto> Items
);

public record ApproveReceiptItemDto(
    int Id, // MaterialReceiptItemId
    decimal ReceivedQuantity,
    decimal UnitPrice,
    string? BatchNumber = null
);

public record ApproveReceiptDto(
    List<ApproveReceiptItemDto>? Items = null
);

public record CreateIssueItemDto(
    int MaterialId,
    decimal RequestedQuantity,
    decimal IssuedQuantity,
    string? BatchNumber = null,
    string? Location = null,
    string? Remarks = null
);

public record CreateIssueDto(
    DateTime IssueDate,
    int? DepartmentId,
    string? SupervisorName,
    string? Shift,
    string? Purpose,
    string? IssuedTo,
    string? Remarks,
    List<CreateIssueItemDto> Items
);

public record CreatePrItemDto(
    int MaterialId,
    decimal RequestedQuantity,
    decimal EstimatedUnitPrice,
    int? PreferredSupplierId,
    string? Purpose,
    string? DiscountTerms
);

public record CreatePurchaseRequestDto(
    DateTime RequestDate,
    int? DepartmentId,
    PrPriority Priority,
    DateTime? RequiredByDate,
    string? Purpose,
    List<CreatePrItemDto> Items
);

public record CreatePoItemDto(
    int MaterialId,
    decimal PoQuantity,
    decimal UnitPrice,
    string? Remarks
);

public record CreatePurchaseOrderDto(
    DateTime PoDate,
    int SupplierId,
    int? PurchaseRequestId,
    DateTime? ExpectedDeliveryDate,
    string? PaymentTerms,
    string? DeliveryAddress,
    string? Remarks,
    List<CreatePoItemDto> Items
);

using StoreManager.Api.Models;

namespace StoreManager.Api.DTOs;

public record CoreDto(
    int Id,
    string CoreCode,
    string CoreName,
    string Uom,
    decimal WeightPerUnitKg,
    decimal StandardPrice,
    int? SupplierId,
    string? SupplierName,
    bool IsActive
);

public record CreateCoreDto(
    string CoreCode,
    string CoreName,
    string Uom,
    decimal WeightPerUnitKg,
    decimal StandardPrice,
    int? SupplierId
);

public record CoreDailyTrackingDto(
    int Id,
    int CoreId,
    string CoreCode,
    string CoreName,
    DateTime TrackingDate,
    decimal PlannedQuantity,
    decimal ActualQuantity,
    decimal DispatchedQuantity,
    decimal UnitPrice,
    decimal TotalCost,
    decimal VarianceQuantity,
    decimal AchievementPercentage
);

public record CreateCoreDailyTrackingDto(
    int CoreId,
    DateTime TrackingDate,
    decimal PlannedQuantity,
    decimal ActualQuantity,
    decimal DispatchedQuantity,
    decimal UnitPrice
);

public record CoreRejectionDto(
    int Id,
    int? CoreId,
    string CoreOrMaterialName,
    DateTime RejectionDate,
    DateTime? InwardDate,
    string? InvoiceNumber,
    int? SupplierId,
    string? SupplierName,
    decimal RejectedQuantity,
    string? Reason,
    string? Remarks,
    string Status
);

public record CreateCoreRejectionDto(
    int? CoreId,
    string CoreOrMaterialName,
    DateTime RejectionDate,
    DateTime? InwardDate,
    string? InvoiceNumber,
    int? SupplierId,
    string? SupplierName,
    decimal RejectedQuantity,
    string? Reason,
    string? Remarks
);

public record CylinderDto(
    int Id,
    string CylinderCode,
    string CylinderName,
    string GasType,
    string Capacity,
    int? DefaultSupplierId,
    string? DefaultSupplierName,
    decimal CurrentFullStock,
    decimal CurrentEmptyStock,
    bool IsActive
);

public record CreateCylinderDto(
    string CylinderCode,
    string CylinderName,
    string GasType,
    string Capacity,
    int? DefaultSupplierId,
    decimal InitialFullStock,
    decimal InitialEmptyStock
);

public record CreateCylinderTransactionDto(
    int CylinderId,
    DateTime TransactionDate,
    int? SupplierId,
    decimal FullReceivedQty,
    decimal EmptyReturnedQty,
    decimal DailyConsumedQty,
    string? Remarks
);

public record EmployeeDto(
    int Id,
    string EmployeeCode,
    string FullName,
    string? Designation,
    int? DepartmentId,
    string? DepartmentName,
    bool IsActive
);

public record AttendanceRecordDto(
    int Id,
    int EmployeeId,
    string EmployeeCode,
    string FullName,
    string DepartmentName,
    DateTime AttendanceDate,
    AttendanceStatus Status,
    decimal WorkingHours,
    decimal OvertimeHours,
    string? Remarks
);

public record SaveAttendanceDto(
    int EmployeeId,
    DateTime AttendanceDate,
    AttendanceStatus Status,
    decimal WorkingHours,
    decimal OvertimeHours,
    string? Remarks
);

public record CottonGloveDto(
    int Id,
    int? DepartmentId,
    string DepartmentName,
    string SupervisorName,
    int ManpowerCount,
    DateTime LogDate,
    int WeekNumber,
    decimal QuantityIssued,
    string? Remarks
);

public record SaveCottonGloveDto(
    int? DepartmentId,
    string? DepartmentName,
    string SupervisorName,
    int ManpowerCount,
    DateTime LogDate,
    int WeekNumber,
    decimal QuantityIssued,
    string? Remarks
);

public record CostSavingDto(
    int Id,
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string? CurrentSupplier,
    string? NewSupplier,
    decimal CurrentSupplierPrice,
    decimal NewSupplierPrice,
    decimal PriceDifference,
    decimal PerMonthAveragePurchaseQty,
    decimal MonthlyCostSavings,
    string? Remarks
);

public record SaveCostSavingDto(
    int MaterialId,
    string? CurrentSupplier,
    string? NewSupplier,
    decimal CurrentSupplierPrice,
    decimal NewSupplierPrice,
    decimal PerMonthAveragePurchaseQty,
    string? Remarks
);

public record DashboardKpisDto(
    int TotalMaterials,
    decimal TotalAvailableStockValue,
    int LowStockCount,
    int OutOfStockCount,
    decimal TodayReceiptsQuantity,
    decimal TodayReceiptsValue,
    decimal TodayIssuesQuantity,
    decimal TodayIssuesValue,
    decimal CurrentMonthPurchaseValue,
    decimal CurrentMonthConsumptionValue,
    int PendingPrCount,
    int PendingPoCount,
    decimal TotalProjectedMonthlySavings
);

public record CategorySpendDto(string CategoryName, decimal TotalSpend, decimal Percentage);
public record SupplierSpendDto(string SupplierName, decimal TotalSpend, decimal Percentage);
public record MonthlyTrendDto(string Month, decimal PurchaseAmount, decimal ConsumptionAmount);
public record TopConsumedItemDto(string MaterialCode, string MaterialName, decimal Quantity, decimal Cost);
public record LowStockItemAlertDto(string MaterialCode, string MaterialName, decimal CurrentStock, decimal ReorderLevel, decimal DaysOfStock, string Uom);

public record DashboardResponseDto(
    DashboardKpisDto Kpis,
    List<CategorySpendDto> CategoryDistribution,
    List<SupplierSpendDto> SupplierDistribution,
    List<MonthlyTrendDto> MonthlyTrends,
    List<TopConsumedItemDto> TopConsumedItems,
    List<LowStockItemAlertDto> CriticalAlerts
);

public record MaterialReceiptTxDetailDto(
    int ReceiptId,
    string GrnNumber,
    DateTime ReceiptDate,
    string SupplierName,
    string? InvoiceNumber,
    decimal ReceivedQuantity,
    decimal UnitPrice,
    decimal TotalAmount,
    decimal BaselinePrice,
    decimal PriceDeflection,
    decimal DeflectionPercentage,
    string DeflectionType
);

public record MaterialPriceDeflectionDto(
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string CategoryName,
    string Uom,
    decimal StandardPrice,
    decimal OpeningStockQty,
    decimal OpeningValuation,
    decimal PeriodInwardQty,
    decimal PeriodInwardSpend,
    decimal AvgInwardPrice,
    decimal PeriodIssuedQty,
    decimal PeriodIssuedCost,
    decimal ClosingStockQty,
    decimal ClosingValuation,
    decimal PriceDeflectionAmount,
    decimal DeflectionPercentage,
    string DeflectionStatus,
    decimal TotalDeflectionCostImpact,
    decimal MinInwardPrice,
    decimal MaxInwardPrice,
    string? PrimarySupplier,
    List<MaterialReceiptTxDetailDto> Transactions
);

public record MaterialPriceDeflectionSummaryDto(
    DateTime FromDate,
    DateTime ToDate,
    int TotalMaterialsEvaluated,
    decimal TotalOpeningValuation,
    decimal TotalInwardQuantity,
    decimal TotalInwardSpend,
    decimal TotalIssuedQuantity,
    decimal TotalIssuedCost,
    decimal TotalClosingValuation,
    decimal NetDeflectionCostImpact,
    int PriceHikeItemsCount,
    int PriceDropItemsCount,
    int StableItemsCount,
    List<MaterialPriceDeflectionDto> Items
);

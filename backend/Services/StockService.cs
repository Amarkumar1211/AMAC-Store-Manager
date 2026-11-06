using Microsoft.EntityFrameworkCore;
using System.Data;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public interface IStockService
{
    Task<decimal> GetAvailableStockAsync(int materialId);
    Task<List<MaterialDto>> GetMaterialsStockSummaryAsync(string? search = null, int? categoryId = null, int? deptId = null, string? status = null);
    Task<MaterialDto?> GetMaterialDetailAsync(int materialId);
    Task<MaterialReceipt> ProcessReceiptAsync(CreateReceiptDto dto, int userId);
    Task<MaterialReceipt> ApproveReceiptAsync(int receiptId, int userId, ApproveReceiptDto dto = null);
    Task<MaterialReceipt> RejectReceiptAsync(int receiptId, int userId);
    Task<MaterialIssue> ProcessIssueAsync(CreateIssueDto dto, int userId);
    Task<StockAdjustment> ProcessAdjustmentAsync(CreateStockAdjustmentDto dto, int userId);
    Task<List<StockLedgerEntryDto>> GetStockLedgerAsync(int? materialId = null, DateTime? fromDate = null, DateTime? toDate = null);
}

public class StockService : IStockService
{
    private readonly StoreDbContext _context;
    private readonly ILogger<StockService> _logger;
    private readonly IRequisitionNotificationService _notificationService;

    public StockService(StoreDbContext context, ILogger<StockService> logger, IRequisitionNotificationService notificationService)
    {
        _context = context;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task<decimal> GetAvailableStockAsync(int materialId)
    {
        var lastEntry = await _context.StockLedgers
            .Where(s => s.MaterialId == materialId)
            .OrderByDescending(s => s.Id)
            .FirstOrDefaultAsync();

        return lastEntry?.BalanceQuantityAfter ?? 0;
    }

    public async Task<List<MaterialDto>> GetMaterialsStockSummaryAsync(string? search = null, int? categoryId = null, int? deptId = null, string? status = null)
    {
        var query = _context.Materials
            .Include(m => m.Category)
            .Include(m => m.UserDepartment)
            .Where(m => m.IsActive)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(m => m.MaterialCode.ToLower().Contains(s) || m.MaterialName.ToLower().Contains(s));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(m => m.CategoryId == categoryId.Value);
        }

        if (deptId.HasValue)
        {
            query = query.Where(m => m.UserDepartmentId == deptId.Value);
        }

        var materials = await query.ToListAsync();

        // Get latest balances for all materials
        var latestBalances = await _context.StockLedgers
            .GroupBy(s => s.MaterialId)
            .Select(g => new
            {
                MaterialId = g.Key,
                LatestBalance = g.OrderByDescending(x => x.Id).Select(x => x.BalanceQuantityAfter).FirstOrDefault()
            })
            .ToDictionaryAsync(x => x.MaterialId, x => x.LatestBalance);

        // Get pending PO quantities
        var pendingPos = await _context.PurchaseOrderItems
            .Include(p => p.PurchaseOrder)
            .Where(p => p.PurchaseOrder != null && p.PurchaseOrder.Status != PoStatus.Completed && p.PurchaseOrder.Status != PoStatus.Cancelled)
            .GroupBy(p => p.MaterialId)
            .Select(g => new { MaterialId = g.Key, PendingQty = g.Sum(x => x.PendingQuantity) })
            .ToDictionaryAsync(x => x.MaterialId, x => x.PendingQty);

        // Get consumption rates over last 30 days
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
        var consumptionData = await _context.StockLedgers
            .Where(s => s.TransactionType == TransactionType.Issue && s.TransactionDate >= thirtyDaysAgo)
            .GroupBy(s => s.MaterialId)
            .Select(g => new
            {
                MaterialId = g.Key,
                TotalIssued = g.Sum(x => x.QuantityOut),
                ActiveDays = g.Select(x => x.TransactionDate.Date).Distinct().Count()
            })
            .ToDictionaryAsync(x => x.MaterialId, x => new { x.TotalIssued, x.ActiveDays });

        var results = new List<MaterialDto>();

        foreach (var m in materials)
        {
            var currentStock = latestBalances.TryGetValue(m.Id, out var bal) ? bal : 0;
            var pendingPo = pendingPos.TryGetValue(m.Id, out var po) ? po : 0;

            decimal dailyConsumption = 0;
            if (consumptionData.TryGetValue(m.Id, out var cons) && cons.ActiveDays > 0)
            {
                dailyConsumption = cons.TotalIssued / cons.ActiveDays;
            }
            else if (m.MonthlyRequirement > 0)
            {
                // Configurable working days: read from SystemConfigurations, default = 26
                var wdConfig = await _context.SystemConfigurations
                    .Where(c => c.Key == "WorkingDaysPerMonth")
                    .Select(c => c.Value)
                    .FirstOrDefaultAsync();
                var workingDays = int.TryParse(wdConfig, out var wd) && wd > 0 ? (decimal)wd : 26m;
                dailyConsumption = m.MonthlyRequirement / workingDays;
            }

            decimal daysOfStock = dailyConsumption > 0 ? (currentStock / dailyConsumption) : (currentStock > 0 ? 999 : 0);
            decimal target22DaysStock = dailyConsumption * 22m;
            decimal requiredPo = Math.Max(0, (m.MonthlyRequirement + m.ReorderLevel) - currentStock - pendingPo);
            decimal stockValue = currentStock * (m.StandardPrice > 0 ? m.StandardPrice : m.RevisedPrice);

            string stockStatus = "Normal";
            if (currentStock <= 0) stockStatus = "OutOfStock";
            else if (currentStock < m.ReorderLevel) stockStatus = "LowStock";
            else if (daysOfStock > 60) stockStatus = "ExcessStock";

            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(stockStatus, status, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            results.Add(new MaterialDto(
                m.Id,
                m.MaterialCode,
                m.MaterialName,
                m.CategoryId,
                m.Category?.Name,
                m.DefaultUom,
                m.ReorderLevel,
                m.MonthlyRequirement,
                m.UserDepartmentId,
                m.UserDepartment?.Name,
                m.StandardPrice,
                m.RevisedPrice,
                m.PrimarySupplierName,
                currentStock,
                Math.Round(daysOfStock, 1),
                Math.Round(dailyConsumption, 2),
                pendingPo,
                requiredPo,
                Math.Round(stockValue, 2),
                stockStatus,
                m.IsActive
            ));
        }

        return results;
    }

    public async Task<MaterialDto?> GetMaterialDetailAsync(int materialId)
    {
        var list = await GetMaterialsStockSummaryAsync();
        return list.FirstOrDefault(m => m.Id == materialId);
    }

    public async Task<MaterialReceipt> ProcessReceiptAsync(CreateReceiptDto dto, int userId)
    {
        ValidateReceipt(dto);
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                // Safe sequential number: MAX(Id)+1 inside Serializable tx prevents duplicates
                var maxGrnId = await _context.MaterialReceipts.MaxAsync(r => (int?)r.Id) ?? 0;
                var grnNumber = $"GRN-{DateTime.UtcNow:yyyyMM}-{(maxGrnId + 1):D4}";

                var receipt = new MaterialReceipt
                {
                    GrnNumber = grnNumber,
                    ReceiptDate = dto.ReceiptDate,
                    SupplierId = dto.SupplierId,
                    SupplierName = dto.SupplierName,
                    PurchaseOrderId = dto.PurchaseOrderId,
                    PoNumber = dto.PoNumber,
                    InvoiceNumber = dto.InvoiceNumber,
                    InvoiceDate = dto.InvoiceDate,
                    DcNumber = dto.DcNumber,
                    VehicleNumber = dto.VehicleNumber,
                    Remarks = dto.Remarks,
                    ReceivedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                decimal grandTotal = 0;



                foreach (var itemDto in dto.Items)
                {
                    var itemTotal = itemDto.ReceivedQuantity * itemDto.UnitPrice;
                    grandTotal += itemTotal;

                    var cleanBatch = !string.IsNullOrWhiteSpace(itemDto.BatchNumber) ? itemDto.BatchNumber.Trim() : null;

                    receipt.Items.Add(new MaterialReceiptItem
                    {
                        MaterialId = itemDto.MaterialId,
                        BatchNumber = cleanBatch,
                        ReceivedQuantity = itemDto.ReceivedQuantity,
                        UnitPrice = itemDto.UnitPrice,
                        TotalAmount = itemTotal,
                        Remarks = itemDto.Remarks
                    });

                }

                receipt.TotalAmount = grandTotal;
                // Status defaults to "Pending"
                _context.MaterialReceipts.Add(receipt);

                // Audit log
                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    Action = "RECEIVE_PENDING",
                    EntityName = "MaterialReceipt",
                    RecordId = grnNumber,
                    NewValues = $"Supplier: {dto.SupplierName}, Items: {dto.Items.Count}, Total: {grandTotal}",
                    Timestamp = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                // Publish real-time notification
                _notificationService.PublishEvent(new RequisitionLiveEvent
                {
                    EventType = "RECEIPT_PENDING_APPROVAL",
                    RequisitionNumber = grnNumber,
                    Message = $"New Inward Material (GRN) from {dto.SupplierName} is waiting for Store Manager approval.",
                    RequestedBy = "Data Entry",
                    TotalEstimatedCost = grandTotal,
                    ItemsCount = dto.Items.Count
                });

                return receipt;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error processing receipt");
                throw;
            }
        });
    }

    public async Task<MaterialIssue> ProcessIssueAsync(CreateIssueDto dto, int userId)
    {
        ValidateIssue(dto);
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                // Safe sequential number: MAX(Id)+1 inside Serializable tx prevents duplicates
                var maxIssId = await _context.MaterialIssues.MaxAsync(i => (int?)i.Id) ?? 0;
                var issueSlipNo = $"ISS-{DateTime.UtcNow:yyyyMM}-{(maxIssId + 1):D4}";

                var issue = new MaterialIssue
                {
                    IssueSlipNumber = issueSlipNo,
                    IssueDate = dto.IssueDate,
                    DepartmentId = dto.DepartmentId,
                    SupervisorName = dto.SupervisorName,
                    Shift = dto.Shift,
                    Purpose = dto.Purpose,
                    IssuedTo = dto.IssuedTo,
                    Remarks = dto.Remarks,
                    IssuedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                decimal grandTotalCost = 0;

                // FIX #4: Maintain per-material running balance during this transaction
                // so that multiple items for the same material don't read a stale DB balance.
                var runningBalances = new Dictionary<int, decimal>();

                foreach (var itemDto in dto.Items)
                {
                    var material = await _context.Materials.FindAsync(itemDto.MaterialId);
                    if (material == null) throw new InvalidOperationException($"Material ID {itemDto.MaterialId} not found");

                    // Use in-memory running balance; fall back to DB only on first encounter of this material
                    if (!runningBalances.TryGetValue(itemDto.MaterialId, out var currentStock))
                    {
                        currentStock = await GetAvailableStockAsync(itemDto.MaterialId);
                    }

                    // Prevent negative stock
                    if (currentStock < itemDto.IssuedQuantity)
                    {
                        throw new InvalidOperationException($"Insufficient stock for material '{material.MaterialCode} - {material.MaterialName}'. Available: {currentStock} {material.DefaultUom}, Requested Issue: {itemDto.IssuedQuantity} {material.DefaultUom}. Negative stock is prevented.");
                    }

                    var cleanBatch = !string.IsNullOrWhiteSpace(itemDto.BatchNumber) ? itemDto.BatchNumber.Trim() : null;
                    var unitCost = material.StandardPrice > 0 ? material.StandardPrice : material.RevisedPrice;
                    string autoRemarks = itemDto.Remarks ?? "";

                    // FIFO Auto-Consumption Logic
                    var activeBatches = await _context.MaterialBatches
                        .Where(b => b.MaterialId == itemDto.MaterialId && b.CurrentStock > 0)
                        .OrderBy(b => b.FirstReceiptDate)
                        .ToListAsync();

                    if (!string.IsNullOrWhiteSpace(cleanBatch))
                    {
                        // Explicit batch specified
                        var batch = activeBatches.FirstOrDefault(b => b.BatchNumber.ToLower() == cleanBatch.ToLower());
                        if (batch != null)
                        {
                            if (batch.CurrentStock < itemDto.IssuedQuantity)
                            {
                                throw new InvalidOperationException($"Insufficient stock for Batch '{batch.BatchNumber}'. Available in batch: {batch.CurrentStock} {material.DefaultUom}, Requested Issue: {itemDto.IssuedQuantity} {material.DefaultUom}.");
                            }

                            batch.IssuedQuantity += itemDto.IssuedQuantity;
                            batch.CurrentStock -= itemDto.IssuedQuantity;
                            batch.TotalValuation = batch.CurrentStock * batch.UnitPrice;
                            batch.UpdatedAt = DateTime.UtcNow;

                            if (batch.UnitPrice > 0) unitCost = batch.UnitPrice;
                            
                            autoRemarks = $"FIFO Issue: Consumed {itemDto.IssuedQuantity} {material.DefaultUom} from Batch {batch.BatchNumber} (Recd: {batch.FirstReceiptDate:dd-MMM-yyyy}). {autoRemarks}";
                        }
                    }
                    else
                    {
                        // Auto-consume from oldest batches
                        decimal remainingToConsume = itemDto.IssuedQuantity;
                        var consumedDetails = new List<string>();

                        foreach (var batch in activeBatches)
                        {
                            if (remainingToConsume <= 0) break;

                            decimal consumeQty = Math.Min(remainingToConsume, batch.CurrentStock);
                            
                            batch.IssuedQuantity += consumeQty;
                            batch.CurrentStock -= consumeQty;
                            batch.TotalValuation = batch.CurrentStock * batch.UnitPrice;
                            batch.UpdatedAt = DateTime.UtcNow;
                            
                            remainingToConsume -= consumeQty;
                            
                            string bName = string.IsNullOrWhiteSpace(batch.BatchNumber) ? "NoBatch" : batch.BatchNumber;
                            consumedDetails.Add($"{consumeQty} {material.DefaultUom} from {bName}");
                            
                            // Approximate average cost
                            if (batch.UnitPrice > 0 && consumeQty == itemDto.IssuedQuantity) unitCost = batch.UnitPrice;
                        }

                        if (consumedDetails.Count > 0)
                        {
                            autoRemarks = $"FIFO Issue: Consumed -> {string.Join(", ", consumedDetails)}. {autoRemarks}";
                        }
                    }

                    var totalCost = itemDto.IssuedQuantity * unitCost;
                    grandTotalCost += totalCost;

                    issue.Items.Add(new MaterialIssueItem
                    {
                        MaterialId = itemDto.MaterialId,
                        BatchNumber = cleanBatch,
                        RequestedQuantity = itemDto.RequestedQuantity,
                        IssuedQuantity = itemDto.IssuedQuantity,
                        UnitCost = unitCost,
                        TotalCost = totalCost,
                        Location = itemDto.Location,
                        Remarks = autoRemarks
                    });

                    var newStock = currentStock - itemDto.IssuedQuantity;
                    runningBalances[itemDto.MaterialId] = newStock; // update in-memory running balance

                    var ledger = new StockLedger
                    {
                        MaterialId = itemDto.MaterialId,
                        TransactionDate = dto.IssueDate,
                        TransactionType = TransactionType.Issue,
                        ReferenceType = ReferenceType.IssueSlip,
                        ReferenceNumber = issueSlipNo,
                        BatchNumber = cleanBatch,
                        QuantityIn = 0,
                        QuantityOut = itemDto.IssuedQuantity,
                        UnitCost = unitCost,
                        TotalCost = totalCost,
                        BalanceQuantityAfter = newStock,
                        Notes = $"Issued to {dto.SupervisorName ?? "Dept"} (Shift: {dto.Shift ?? "General"}, Purpose: {dto.Purpose ?? "Production"}{(cleanBatch != null ? $", Batch: {cleanBatch}" : "")})",
                        CreatedByUserId = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.StockLedgers.Add(ledger);
                }

                issue.TotalIssueCost = grandTotalCost;
                _context.MaterialIssues.Add(issue);

                // Audit log
                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    Action = "ISSUE",
                    EntityName = "MaterialIssue",
                    RecordId = issueSlipNo,
                    NewValues = $"DeptId: {dto.DepartmentId}, Supervisor: {dto.SupervisorName}, Items: {dto.Items.Count}, Total Cost: {grandTotalCost}",
                    Timestamp = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return issue;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error processing issue");
                throw;
            }
        });
    }

    public async Task<StockAdjustment> ProcessAdjustmentAsync(CreateStockAdjustmentDto dto, int userId)
    {
        if (dto.MaterialId <= 0)
            throw new ArgumentException("A valid material is required.");
        if (dto.PhysicalStock < 0)
            throw new ArgumentException("Physical stock cannot be negative.");
        if (string.IsNullOrWhiteSpace(dto.Reason))
            throw new ArgumentException("An adjustment reason is required.");

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                var material = await _context.Materials.FindAsync(dto.MaterialId);
                if (material == null) throw new InvalidOperationException($"Material ID {dto.MaterialId} not found");

                var currentStock = await GetAvailableStockAsync(dto.MaterialId);
                var adjustmentQty = dto.PhysicalStock - currentStock;

                // Safe sequential number: MAX(Id)+1 inside Serializable tx prevents duplicates
                var maxAdjId = await _context.StockAdjustments.MaxAsync(a => (int?)a.Id) ?? 0;
                var adjNumber = $"ADJ-{DateTime.UtcNow:yyyyMM}-{(maxAdjId + 1):D4}";

                var adjustment = new StockAdjustment
                {
                    AdjustmentNumber = adjNumber,
                    MaterialId = dto.MaterialId,
                    AdjustmentDate = dto.AdjustmentDate,
                    AdjustmentType = dto.AdjustmentType,
                    SystemStock = currentStock,
                    PhysicalStock = dto.PhysicalStock,
                    AdjustmentQuantity = adjustmentQty,
                    Reason = dto.Reason,
                    ApprovedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.StockAdjustments.Add(adjustment);

                var unitCost = material.StandardPrice > 0 ? material.StandardPrice : material.RevisedPrice;

                var ledger = new StockLedger
                {
                    MaterialId = dto.MaterialId,
                    TransactionDate = dto.AdjustmentDate,
                    TransactionType = TransactionType.Adjustment,
                    ReferenceType = ReferenceType.StockAdjustment,
                    ReferenceNumber = adjNumber,
                    QuantityIn = adjustmentQty > 0 ? adjustmentQty : 0,
                    QuantityOut = adjustmentQty < 0 ? Math.Abs(adjustmentQty) : 0,
                    UnitCost = unitCost,
                    TotalCost = Math.Abs(adjustmentQty) * unitCost,
                    BalanceQuantityAfter = dto.PhysicalStock,
                    Notes = $"Physical stock correction: Was {currentStock}, Adjusted to {dto.PhysicalStock} ({dto.Reason})",
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.StockLedgers.Add(ledger);

                // FIX #1: Sync MaterialBatch records with the adjusted total.
                // Proportionally distribute the adjustment delta across all active batches.
                if (adjustmentQty != 0)
                {
                    var batches = await _context.MaterialBatches
                        .Where(b => b.MaterialId == dto.MaterialId && b.CurrentStock > 0)
                        .ToListAsync();

                    if (batches.Count > 0)
                    {
                        decimal totalBatchStock = batches.Sum(b => b.CurrentStock);
                        foreach (var batch in batches)
                        {
                            decimal proportion = totalBatchStock > 0
                                ? batch.CurrentStock / totalBatchStock
                                : 1m / batches.Count;
                            decimal batchDelta = Math.Round(adjustmentQty * proportion, 4);
                            batch.CurrentStock = Math.Max(0, batch.CurrentStock + batchDelta);
                            batch.TotalValuation = batch.CurrentStock * batch.UnitPrice;
                            batch.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                    // Note: if no active batches exist, the StockLedger remains the sole
                    // source of truth; batch-level data does not need to be reconciled.
                }

                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    Action = "ADJUST",
                    EntityName = "StockAdjustment",
                    RecordId = adjNumber,
                    OldValues = $"System Stock: {currentStock}",
                    NewValues = $"Physical Stock: {dto.PhysicalStock}, Difference: {adjustmentQty}, Reason: {dto.Reason}",
                    Timestamp = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return adjustment;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error processing stock adjustment");
                throw;
            }
        });
    }

    public async Task<List<StockLedgerEntryDto>> GetStockLedgerAsync(int? materialId = null, DateTime? fromDate = null, DateTime? toDate = null)
    {
        var query = _context.StockLedgers
            .Include(s => s.Material)
                .ThenInclude(m => m!.Category)
            .Include(s => s.CreatedByUser)
            .AsQueryable();

        if (materialId.HasValue)
        {
            query = query.Where(s => s.MaterialId == materialId.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(s => s.TransactionDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(s => s.TransactionDate <= toDate.Value);
        }

        var list = await query
            .OrderByDescending(s => s.TransactionDate)
            .ThenByDescending(s => s.Id)
            .Take(500)
            .ToListAsync();

        return list.Select(s => new StockLedgerEntryDto(
            s.Id,
            s.MaterialId,
            s.Material?.MaterialCode ?? "",
            s.Material?.MaterialName ?? "",
            s.Material?.Category?.Name ?? "Uncategorized",
            s.Material?.DefaultUom ?? "KG",
            s.TransactionDate,
            s.TransactionType.ToString(),
            s.ReferenceType.ToString(),
            s.ReferenceNumber,
            s.BatchNumber,
            s.QuantityIn,
            s.QuantityOut,
            s.UnitCost,
            s.TotalCost,
            s.BalanceQuantityAfter,
            s.Notes,
            s.CreatedByUser?.FullName ?? s.CreatedByUser?.Username
        )).ToList();
    }

    private static void ValidateReceipt(CreateReceiptDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("At least one receipt item is required.");

        foreach (var item in dto.Items)
        {
            if (item.MaterialId <= 0)
                throw new ArgumentException("Every receipt item must reference a valid material.");
            if (item.ReceivedQuantity <= 0)
                throw new ArgumentException("Received quantities must be greater than zero.");
            if (item.UnitPrice < 0)
                throw new ArgumentException("Unit prices cannot be negative.");
        }
    }

    private static void ValidateIssue(CreateIssueDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("At least one issue item is required.");

        foreach (var item in dto.Items)
        {
            if (item.MaterialId <= 0)
                throw new ArgumentException("Every issue item must reference a valid material.");
            if (item.RequestedQuantity <= 0 || item.IssuedQuantity <= 0)
                throw new ArgumentException("Requested and issued quantities must be greater than zero.");
            if (item.IssuedQuantity > item.RequestedQuantity)
                throw new ArgumentException("Issued quantity cannot exceed requested quantity.");
        }
    }

    public async Task<MaterialReceipt> ApproveReceiptAsync(int receiptId, int userId, ApproveReceiptDto dto = null)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                var receipt = await _context.MaterialReceipts
                    .Include(r => r.Items)
                    .FirstOrDefaultAsync(r => r.Id == receiptId);

                if (receipt == null)
                    throw new Exception("Receipt not found.");

                if (receipt.Status != "Pending")
                    throw new Exception($"Receipt cannot be approved because it is in {receipt.Status} state.");

                decimal grandTotal = 0;
                var runningBalances = new Dictionary<int, decimal>();

                foreach (var item in receipt.Items)
                {
                    // Apply any quantity/price edits from the DTO
                    if (dto?.Items != null)
                    {
                        var editItem = dto.Items.FirstOrDefault(i => i.Id == item.Id);
                        if (editItem != null)
                        {
                            item.ReceivedQuantity = editItem.ReceivedQuantity;
                            item.UnitPrice = editItem.UnitPrice;
                            if (editItem.BatchNumber != null)
                                item.BatchNumber = editItem.BatchNumber.Trim();
                            item.TotalAmount = item.ReceivedQuantity * item.UnitPrice;
                        }
                    }

                    var itemTotal = item.TotalAmount;
                    grandTotal += itemTotal;
                    var cleanBatch = !string.IsNullOrWhiteSpace(item.BatchNumber) ? item.BatchNumber.Trim() : null;

                    // Update stock ledger
                    if (!runningBalances.TryGetValue(item.MaterialId, out var currentStock))
                    {
                        currentStock = await GetAvailableStockAsync(item.MaterialId);
                    }
                    var newStock = currentStock + item.ReceivedQuantity;
                    runningBalances[item.MaterialId] = newStock;

                    var ledger = new StockLedger
                    {
                        MaterialId = item.MaterialId,
                        TransactionDate = receipt.ReceiptDate, // Keep original receipt date
                        TransactionType = TransactionType.Receipt,
                        ReferenceType = ReferenceType.GRN,
                        ReferenceNumber = receipt.GrnNumber,
                        BatchNumber = cleanBatch,
                        QuantityIn = item.ReceivedQuantity,
                        QuantityOut = 0,
                        UnitCost = item.UnitPrice,
                        TotalCost = itemTotal,
                        BalanceQuantityAfter = newStock,
                        Notes = $"GRN Inward Approved from {receipt.SupplierName ?? "Supplier"} (Inv: {receipt.InvoiceNumber ?? "N/A"}{(cleanBatch != null ? $", Batch: {cleanBatch}" : "")})",
                        CreatedByUserId = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.StockLedgers.Add(ledger);

                    // Update or Register Material Batch
                    var cleanBatchStr = cleanBatch ?? "";
                    MaterialBatch batch = null;

                    if (!string.IsNullOrWhiteSpace(cleanBatch))
                    {
                        batch = await _context.MaterialBatches
                            .FirstOrDefaultAsync(b => b.MaterialId == item.MaterialId && b.BatchNumber.ToLower() == cleanBatch.ToLower());
                    }

                    if (batch == null)
                    {
                        batch = new MaterialBatch
                        {
                            MaterialId = item.MaterialId,
                            BatchNumber = cleanBatchStr,
                            FirstReceiptDate = receipt.ReceiptDate,
                            LatestReceiptDate = receipt.ReceiptDate,
                            InwardQuantity = item.ReceivedQuantity,
                            IssuedQuantity = 0,
                            CurrentStock = item.ReceivedQuantity,
                            UnitPrice = item.UnitPrice,
                            TotalValuation = item.ReceivedQuantity * item.UnitPrice,
                            LastSupplierId = receipt.SupplierId,
                            LastSupplierName = receipt.SupplierName,
                            Remarks = item.Remarks,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.MaterialBatches.Add(batch);
                    }
                    else
                    {
                        batch.LatestReceiptDate = receipt.ReceiptDate;
                        batch.InwardQuantity += item.ReceivedQuantity;
                        batch.CurrentStock += item.ReceivedQuantity;
                        if (item.UnitPrice > 0)
                        {
                            batch.UnitPrice = item.UnitPrice; 
                        }
                        batch.TotalValuation = batch.CurrentStock * batch.UnitPrice;
                        batch.LastSupplierId = receipt.SupplierId ?? batch.LastSupplierId;
                        batch.LastSupplierName = receipt.SupplierName ?? batch.LastSupplierName;
                        batch.UpdatedAt = DateTime.UtcNow;
                    }

                    // PO Link Updates
                    if (receipt.PurchaseOrderId.HasValue)
                    {
                        var poItem = await _context.PurchaseOrderItems
                            .FirstOrDefaultAsync(p => p.PurchaseOrderId == receipt.PurchaseOrderId.Value && p.MaterialId == item.MaterialId);

                        if (poItem != null)
                        {
                            poItem.ReceivedQuantity += item.ReceivedQuantity;
                            poItem.PendingQuantity = Math.Max(0, poItem.PoQuantity - poItem.ReceivedQuantity);
                        }
                    }

                    // Master Price Update
                    var material = await _context.Materials.FindAsync(item.MaterialId);
                    if (material != null && item.UnitPrice > 0 && material.StandardPrice != item.UnitPrice)
                    {
                        if (receipt.SupplierId.HasValue && receipt.SupplierId.Value > 0)
                        {
                            var supplierExists = await _context.Suppliers.AnyAsync(s => s.Id == receipt.SupplierId.Value);
                            if (supplierExists)
                            {
                                _context.SupplierPriceHistories.Add(new SupplierPriceHistory
                                {
                                    SupplierId = receipt.SupplierId.Value,
                                    MaterialId = item.MaterialId,
                                    OldPrice = material.StandardPrice,
                                    NewPrice = item.UnitPrice,
                                    PriceDifference = item.UnitPrice - material.StandardPrice,
                                    PercentageChange = material.StandardPrice > 0 ? ((item.UnitPrice - material.StandardPrice) / material.StandardPrice * 100) : 0,
                                    ChangedDate = DateTime.UtcNow,
                                    Reason = $"GRN Inward Approved {receipt.GrnNumber}"
                                });
                            }
                        }
                        material.StandardPrice = item.UnitPrice;
                    }
                }

                receipt.TotalAmount = grandTotal;
                receipt.Status = "Approved";
                receipt.ApprovedByUserId = userId;
                receipt.ApprovedAt = DateTime.UtcNow;

                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    Action = "APPROVE_RECEIPT",
                    EntityName = "MaterialReceipt",
                    RecordId = receipt.GrnNumber,
                    NewValues = $"Approved items: {receipt.Items.Count}, Total: {grandTotal}",
                    Timestamp = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return receipt;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error approving receipt");
                throw;
            }
        });
    }

    public async Task<MaterialReceipt> RejectReceiptAsync(int receiptId, int userId)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            var receipt = await _context.MaterialReceipts.FindAsync(receiptId);
            if (receipt == null)
                throw new Exception("Receipt not found.");

            if (receipt.Status != "Pending")
                throw new Exception($"Receipt cannot be rejected because it is in {receipt.Status} state.");

            receipt.Status = "Rejected";
            receipt.ApprovedByUserId = userId; // Keep track of who rejected it
            receipt.ApprovedAt = DateTime.UtcNow;

            _context.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = "REJECT_RECEIPT",
                EntityName = "MaterialReceipt",
                RecordId = receipt.GrnNumber,
                NewValues = $"Rejected GRN",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return receipt;
        });
    }
}

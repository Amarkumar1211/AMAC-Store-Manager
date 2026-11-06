using Microsoft.EntityFrameworkCore;
using System.Data;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public interface IStoreRequisitionService
{
    Task<List<StoreRequisitionDto>> GetRequisitionsAsync(string? status = null, int? departmentId = null, string? search = null);
    Task<StoreRequisitionDto?> GetRequisitionByIdAsync(int id);
    Task<StoreRequisitionDto> CreateRequisitionAsync(CreateStoreRequisitionDto dto, int? userId = null);
    Task<StoreRequisitionDto> UpdateRequisitionAsync(int id, UpdateStoreRequisitionDto dto, int? userId = null);
    Task<(bool Success, string Message, StoreRequisitionDto? Requisition, string? IssueSlipNumber)> AllowRequisitionAsync(int id, AllowStoreRequisitionDto dto, int? userId = null);
    Task<(bool Success, string Message, StoreRequisitionDto? Requisition)> DenyRequisitionAsync(int id, DenyStoreRequisitionDto dto, int? userId = null);
    Task<bool> DeleteRequisitionAsync(int id, int? userId = null);
}

public class StoreRequisitionService : IStoreRequisitionService
{
    private readonly StoreDbContext _context;
    private readonly IStockService _stockService;
    private readonly IRequisitionNotificationService _notificationService;
    private readonly ILogger<StoreRequisitionService> _logger;

    public StoreRequisitionService(
        StoreDbContext context,
        IStockService stockService,
        IRequisitionNotificationService notificationService,
        ILogger<StoreRequisitionService> logger)
    {
        _context = context;
        _stockService = stockService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<List<StoreRequisitionDto>> GetRequisitionsAsync(string? status = null, int? departmentId = null, string? search = null)
    {
        var query = _context.StoreRequisitions
            .Include(r => r.Department)
            .Include(r => r.RequestedByUser)
            .Include(r => r.ProcessedByUser)
            .Include(r => r.Items)
                .ThenInclude(i => i.Material)
                    .ThenInclude(m => m!.Category)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<RequisitionStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(r => r.Status == parsedStatus);
            }
        }

        if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(r => r.DepartmentId == departmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r =>
                r.RequisitionNumber.ToLower().Contains(s) ||
                (r.RequestedBy != null && r.RequestedBy.ToLower().Contains(s)) ||
                (r.Purpose != null && r.Purpose.ToLower().Contains(s)) ||
                (r.Department != null && r.Department.Name.ToLower().Contains(s)) ||
                (r.ResultingIssueSlipNumber != null && r.ResultingIssueSlipNumber.ToLower().Contains(s)) ||
                r.Items.Any(i => i.Material != null && (i.Material.MaterialCode.ToLower().Contains(s) || i.Material.MaterialName.ToLower().Contains(s)))
            );
        }

        var list = await query.OrderByDescending(r => r.RequisitionDate).ToListAsync();
        var stockSummaryList = await _stockService.GetMaterialsStockSummaryAsync();
        var stockSummaryMap = stockSummaryList
            .GroupBy(s => s.Id)
            .ToDictionary(g => g.Key, g => g.First());

        return list.Select(r => MapToDto(r, stockSummaryMap)).ToList();
    }

    public async Task<StoreRequisitionDto?> GetRequisitionByIdAsync(int id)
    {
        var req = await _context.StoreRequisitions
            .Include(r => r.Department)
            .Include(r => r.RequestedByUser)
            .Include(r => r.ProcessedByUser)
            .Include(r => r.Items)
                .ThenInclude(i => i.Material)
                    .ThenInclude(m => m!.Category)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (req == null) return null;

        var stockSummaryList = await _stockService.GetMaterialsStockSummaryAsync();
        var stockSummaryMap = stockSummaryList
            .GroupBy(s => s.Id)
            .ToDictionary(g => g.Key, g => g.First());

        return MapToDto(req, stockSummaryMap);
    }

    public async Task<StoreRequisitionDto> CreateRequisitionAsync(CreateStoreRequisitionDto dto, int? userId = null)
    {
        if (dto.Items == null || dto.Items.Count == 0)
        {
            throw new ArgumentException("At least one material line item is required.");
        }

        if (dto.DepartmentId is <= 0)
            throw new ArgumentException("Department must be valid when supplied.");

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var today = DateTime.UtcNow;
            var prefix = $"SREQ-{today:yyyyMM}-";
            var countThisMonth = await _context.StoreRequisitions
                .CountAsync(r => r.RequisitionNumber.StartsWith(prefix));
            var reqNumber = $"{prefix}{(countThisMonth + 1):D4}";

        string? requesterName = dto.RequestedBy;
        if (string.IsNullOrWhiteSpace(requesterName) && userId.HasValue)
        {
            var u = await _context.Users.FindAsync(userId.Value);
            requesterName = u?.FullName ?? u?.Username;
        }

        var requisition = new StoreRequisition
        {
            RequisitionNumber = reqNumber,
            RequisitionDate = DateTime.UtcNow,
            RequiredDate = dto.RequiredDate,
            DepartmentId = dto.DepartmentId,
            RequestedBy = requesterName ?? "Department Staff",
            RequestedByUserId = userId,
            Shift = string.IsNullOrWhiteSpace(dto.Shift) ? "Shift A" : dto.Shift,
            Purpose = string.IsNullOrWhiteSpace(dto.Purpose) ? "Production Consumption" : dto.Purpose,
            JobOrderOrMachine = dto.JobOrderOrMachine,
            Status = RequisitionStatus.Pending,
            Remarks = dto.Remarks,
            SupervisorSignature = dto.SupervisorSignature,
            CreatedAt = DateTime.UtcNow
        };

        decimal totalEst = 0;
        foreach (var itemDto in dto.Items)
        {
            if (itemDto.RequestedQuantity <= 0)
                throw new ArgumentException("Requested quantities must be greater than zero.");

            var mat = await _context.Materials.FindAsync(itemDto.MaterialId);
            if (mat == null)
            {
                throw new ArgumentException($"Material with ID {itemDto.MaterialId} not found.");
            }

            var unitPrice = mat.StandardPrice > 0 ? mat.StandardPrice : mat.RevisedPrice;
            var lineTotal = itemDto.RequestedQuantity * unitPrice;
            totalEst += lineTotal;

            requisition.Items.Add(new StoreRequisitionItem
            {
                MaterialId = itemDto.MaterialId,
                BatchNumber = itemDto.BatchNumber,
                RequestedQuantity = itemDto.RequestedQuantity,
                ApprovedQuantity = itemDto.RequestedQuantity, // Defaults to requested
                UnitPrice = unitPrice,
                TotalCost = lineTotal,
                Location = itemDto.Location,
                ItemRemarks = itemDto.ItemRemarks
            });
        }

        requisition.TotalEstimatedCost = totalEst;

        _context.StoreRequisitions.Add(requisition);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "CREATE",
            EntityName = "StoreRequisition",
            RecordId = reqNumber,
            NewValues = $"Raised store requisition {reqNumber} for {requisition.Items.Count} item(s) totaling ₹{totalEst:N2}",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        var createdDto = (await GetRequisitionByIdAsync(requisition.Id))!;

        _notificationService.PublishEvent(new RequisitionLiveEvent
        {
            EventType = "REQUISITION_RAISED",
            RequisitionId = createdDto.Id,
            RequisitionNumber = createdDto.RequisitionNumber,
            DepartmentId = createdDto.DepartmentId,
            DepartmentName = createdDto.DepartmentName,
            RequestedBy = createdDto.RequestedBy,
            TotalEstimatedCost = createdDto.TotalEstimatedCost,
            Status = createdDto.Status.ToString(),
            ItemsCount = createdDto.Items.Count,
            Message = $"🔔 New Store Requisition {createdDto.RequisitionNumber} raised by {createdDto.DepartmentName ?? "Department"} ({createdDto.Items.Count} items, ₹{createdDto.TotalEstimatedCost:N2}) - Action Required!"
        });

            await tx.CommitAsync();
            return createdDto;
        });
    }

    public async Task<StoreRequisitionDto> UpdateRequisitionAsync(int id, UpdateStoreRequisitionDto dto, int? userId = null)
    {
        var requisition = await _context.StoreRequisitions
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (requisition == null)
        {
            throw new KeyNotFoundException($"Store requisition with ID {id} not found.");
        }

        if (requisition.Status != RequisitionStatus.Pending && requisition.Status != RequisitionStatus.Draft)
        {
            throw new InvalidOperationException($"Cannot modify a requisition that has already been {requisition.Status.ToString().ToLower()}.");
        }

        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("At least one material line item is required.");

        requisition.DepartmentId = dto.DepartmentId;
        requisition.RequiredDate = dto.RequiredDate;
        if (!string.IsNullOrWhiteSpace(dto.RequestedBy)) requisition.RequestedBy = dto.RequestedBy;
        if (!string.IsNullOrWhiteSpace(dto.Shift)) requisition.Shift = dto.Shift;
        if (!string.IsNullOrWhiteSpace(dto.Purpose)) requisition.Purpose = dto.Purpose;
        requisition.JobOrderOrMachine = dto.JobOrderOrMachine;
        requisition.Remarks = dto.Remarks;
        requisition.UpdatedAt = DateTime.UtcNow;

        // Clear existing items and replace
        _context.StoreRequisitionItems.RemoveRange(requisition.Items);
        requisition.Items.Clear();

        decimal totalEst = 0;
        foreach (var itemDto in dto.Items)
        {
            if (itemDto.RequestedQuantity <= 0 || itemDto.ApprovedQuantity < 0)
                throw new ArgumentException("Requested quantity must be greater than zero and approved quantity cannot be negative.");
            if (itemDto.ApprovedQuantity > itemDto.RequestedQuantity)
                throw new ArgumentException("Approved quantity cannot exceed requested quantity.");

            var mat = await _context.Materials.FindAsync(itemDto.MaterialId);
            if (mat == null) throw new ArgumentException($"Material with ID {itemDto.MaterialId} not found.");

            var unitPrice = mat.StandardPrice > 0 ? mat.StandardPrice : mat.RevisedPrice;
            var approvedQty = itemDto.ApprovedQuantity > 0 ? itemDto.ApprovedQuantity : itemDto.RequestedQuantity;
            var lineTotal = approvedQty * unitPrice;
            totalEst += lineTotal;

            requisition.Items.Add(new StoreRequisitionItem
            {
                StoreRequisitionId = requisition.Id,
                MaterialId = itemDto.MaterialId,
                BatchNumber = itemDto.BatchNumber,
                RequestedQuantity = itemDto.RequestedQuantity,
                ApprovedQuantity = approvedQty,
                UnitPrice = unitPrice,
                TotalCost = lineTotal,
                Location = itemDto.Location,
                ItemRemarks = itemDto.ItemRemarks
            });
        }

        requisition.TotalEstimatedCost = totalEst;

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "UPDATE",
            EntityName = "StoreRequisition",
            RecordId = requisition.RequisitionNumber,
            NewValues = $"Updated store requisition {requisition.RequisitionNumber} items and approved quantities.",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return (await GetRequisitionByIdAsync(requisition.Id))!;
    }

    public async Task<(bool Success, string Message, StoreRequisitionDto? Requisition, string? IssueSlipNumber)> AllowRequisitionAsync(
        int id, AllowStoreRequisitionDto dto, int? userId = null)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                var requisition = await _context.StoreRequisitions
                    .Include(r => r.Items)
                        .ThenInclude(i => i.Material)
                    .Include(r => r.Department)
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (requisition == null)
                {
                    return (false, $"Store requisition with ID {id} not found.", (StoreRequisitionDto?)null, (string?)null);
                }

                if (requisition.Status != RequisitionStatus.Pending)
                {
                    return (false, $"Requisition {requisition.RequisitionNumber} is already {requisition.Status} and cannot be processed again.", (StoreRequisitionDto?)null, (string?)null);
                }

                // Apply custom item overrides if provided by Store Manager
                if (dto.CustomApprovedItems != null && dto.CustomApprovedItems.Count > 0)
                {
                    foreach (var ov in dto.CustomApprovedItems)
                    {
                        if (ov.ApprovedQuantity < 0)
                        {
                            return (false, "Approved quantity cannot be negative.", (StoreRequisitionDto?)null, (string?)null);
                        }

                        var item = requisition.Items.FirstOrDefault(i => i.MaterialId == ov.MaterialId);
                        if (item != null)
                        {
                            if (ov.ApprovedQuantity > item.RequestedQuantity)
                            {
                                return (false, "Approved quantity cannot exceed requested quantity.", (StoreRequisitionDto?)null, (string?)null);
                            }

                            item.ApprovedQuantity = ov.ApprovedQuantity;
                            if (!string.IsNullOrWhiteSpace(ov.BatchNumber)) item.BatchNumber = ov.BatchNumber;
                            if (!string.IsNullOrWhiteSpace(ov.Location)) item.Location = ov.Location;
                            item.TotalCost = item.ApprovedQuantity * item.UnitPrice;
                        }
                    }
                }

                var itemsToIssue = requisition.Items.Where(i => i.ApprovedQuantity > 0).ToList();
                if (itemsToIssue.Count == 0)
                {
                    return (false, "No items with approved quantity > 0 to issue.", (StoreRequisitionDto?)null, (string?)null);
                }

                // Pre-check stock sufficiency for all approved items using StockLedger balance
                var preCheckBalances = new Dictionary<int, decimal>();
                var preCheckBatchBalances = new Dictionary<string, decimal>();

                foreach (var item in itemsToIssue)
                {
                    var mat = await _context.Materials.FindAsync(item.MaterialId);
                    if (mat == null)
                    {
                        return (false, $"Material ID {item.MaterialId} not found.", (StoreRequisitionDto?)null, (string?)null);
                    }

                    if (!preCheckBalances.TryGetValue(item.MaterialId, out var currentStock))
                    {
                        currentStock = await _stockService.GetAvailableStockAsync(item.MaterialId);
                    }
                    
                    if (currentStock < item.ApprovedQuantity)
                    {
                        return (false, $"Insufficient stock for '{mat.MaterialCode} - {mat.MaterialName}'. Available: {currentStock:N2} {mat.DefaultUom}, Approved to Issue: {item.ApprovedQuantity:N2} {mat.DefaultUom}. Negative stock is prevented.", (StoreRequisitionDto?)null, (string?)null);
                    }
                    preCheckBalances[item.MaterialId] = currentStock - item.ApprovedQuantity;

                    if (!string.IsNullOrWhiteSpace(item.BatchNumber))
                    {
                        string batchKey = $"{item.MaterialId}_{item.BatchNumber.ToLower()}";
                        if (!preCheckBatchBalances.TryGetValue(batchKey, out var currentBatchStock))
                        {
                            var batch = await _context.MaterialBatches
                                .FirstOrDefaultAsync(b => b.MaterialId == item.MaterialId && b.BatchNumber.ToLower() == item.BatchNumber.ToLower());
                            currentBatchStock = batch?.CurrentStock ?? 0;
                        }

                        if (currentBatchStock < item.ApprovedQuantity)
                        {
                            return (false, $"Insufficient batch stock for Batch '{item.BatchNumber}'. Available: {currentBatchStock:N2}, Approved: {item.ApprovedQuantity:N2}.", (StoreRequisitionDto?)null, (string?)null);
                        }
                        preCheckBatchBalances[batchKey] = currentBatchStock - item.ApprovedQuantity;
                    }
                }

                // Generate new Material Issue Slip
                var today = DateTime.UtcNow;
                var issueCount = await _context.MaterialIssues
                    .CountAsync(i => i.IssueSlipNumber.StartsWith($"ISS-{today:yyyyMM}-"));
                var issueSlipNo = $"ISS-{today:yyyyMM}-{(issueCount + 1):D4}";

                var materialIssue = new MaterialIssue
                {
                    IssueSlipNumber = issueSlipNo,
                    IssueDate = DateTime.UtcNow,
                    DepartmentId = requisition.DepartmentId,
                    SupervisorName = dto.SupervisorName ?? requisition.RequestedBy,
                    Shift = dto.Shift ?? requisition.Shift,
                    Purpose = requisition.Purpose ?? "Production Consumption",
                    IssuedTo = dto.IssuedTo ?? requisition.RequestedBy,
                    Remarks = string.IsNullOrWhiteSpace(dto.Remarks)
                        ? $"Issued against Requisition {requisition.RequisitionNumber}"
                        : $"Issued against Requisition {requisition.RequisitionNumber}. {dto.Remarks}",
                    SupervisorSignature = requisition.SupervisorSignature,
                    IssuedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                decimal totalIssueVal = 0;

                // FIX #3: Maintain per-material running balance during this transaction.
                // Without this, multiple items for the same material re-read a stale DB balance
                // and every entry after the first writes an incorrect BalanceQuantityAfter.
                var runningBalances = new Dictionary<int, decimal>();

                foreach (var item in itemsToIssue)
                {
                    var mat = await _context.Materials.FindAsync(item.MaterialId)
                        ?? throw new InvalidOperationException($"Material ID {item.MaterialId} not found.");
                    var unitCost = mat.StandardPrice > 0 ? mat.StandardPrice : mat.RevisedPrice;

                    // FIFO Auto-Consumption Logic (Copied from StockService)
                    var activeBatches = await _context.MaterialBatches
                        .Where(b => b.MaterialId == item.MaterialId && b.CurrentStock > 0)
                        .OrderBy(b => b.FirstReceiptDate)
                        .ToListAsync();

                    string autoRemarks = item.ItemRemarks ?? "";

                    if (!string.IsNullOrWhiteSpace(item.BatchNumber))
                    {
                        var batch = activeBatches.FirstOrDefault(b => b.BatchNumber.ToLower() == item.BatchNumber.ToLower());
                        if (batch != null)
                        {
                            batch.IssuedQuantity += item.ApprovedQuantity;
                            batch.CurrentStock -= item.ApprovedQuantity;
                            batch.TotalValuation = batch.CurrentStock * batch.UnitPrice;
                            batch.UpdatedAt = DateTime.UtcNow;
                            if (batch.UnitPrice > 0) unitCost = batch.UnitPrice;
                            
                            autoRemarks = $"FIFO Issue: Consumed {item.ApprovedQuantity} {mat.DefaultUom} from Batch {batch.BatchNumber}. {autoRemarks}";
                        }
                    }
                    else
                    {
                        // Auto-consume from oldest batches
                        decimal remainingToConsume = item.ApprovedQuantity;
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
                            consumedDetails.Add($"{consumeQty} {mat.DefaultUom} from {bName}");
                            
                            if (batch.UnitPrice > 0 && consumeQty == item.ApprovedQuantity) unitCost = batch.UnitPrice;
                        }

                        if (consumedDetails.Count > 0)
                        {
                            autoRemarks = $"FIFO Issue: Consumed -> {string.Join(", ", consumedDetails)}. {autoRemarks}";
                        }
                        item.ItemRemarks = autoRemarks; // Update remarks to include FIFO details
                    }

                    var lineCost = item.ApprovedQuantity * unitCost;
                    totalIssueVal += lineCost;

                    // Use in-memory running balance; fall back to DB only on first encounter
                    if (!runningBalances.TryGetValue(item.MaterialId, out var currentStock))
                    {
                        currentStock = await _stockService.GetAvailableStockAsync(item.MaterialId);
                    }
                    var newStock = currentStock - item.ApprovedQuantity;
                    runningBalances[item.MaterialId] = newStock;

                    // 1. Material Issue Item
                    materialIssue.Items.Add(new MaterialIssueItem
                    {
                        MaterialId = item.MaterialId,
                        BatchNumber = item.BatchNumber,
                        RequestedQuantity = item.RequestedQuantity,
                        IssuedQuantity = item.ApprovedQuantity,
                        UnitCost = unitCost,
                        TotalCost = lineCost,
                        Location = item.Location,
                        Remarks = item.ItemRemarks
                    });

                    // 2. Stock Ledger entry (Single Source of Truth)
                    _context.StockLedgers.Add(new StockLedger
                    {
                        MaterialId = item.MaterialId,
                        TransactionDate = DateTime.UtcNow,
                        TransactionType = TransactionType.Issue,
                        ReferenceType = ReferenceType.IssueSlip,
                        ReferenceNumber = issueSlipNo,
                        QuantityIn = 0,
                        QuantityOut = item.ApprovedQuantity,
                        UnitCost = unitCost,
                        TotalCost = lineCost,
                        BalanceQuantityAfter = newStock,
                        BatchNumber = item.BatchNumber,
                        Notes = $"Issued from Requisition {requisition.RequisitionNumber} - {requisition.Purpose}",
                        CreatedByUserId = userId
                    });
                }

                materialIssue.TotalIssueCost = totalIssueVal;
                _context.MaterialIssues.Add(materialIssue);
                await _context.SaveChangesAsync();

                // Update Store Requisition Status to Allowed
                requisition.Status = RequisitionStatus.Allowed;
                requisition.ProcessedByUserId = userId;
                requisition.ProcessedAt = DateTime.UtcNow;
                requisition.ResultingIssueSlipNumber = issueSlipNo;
                requisition.ResultingMaterialIssueId = materialIssue.Id;
                requisition.UpdatedAt = DateTime.UtcNow;

                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    Action = "APPROVE_AND_ISSUE",
                    EntityName = "StoreRequisition",
                    RecordId = requisition.RequisitionNumber,
                    NewValues = $"Allowed store requisition {requisition.RequisitionNumber}, created Issue Slip {issueSlipNo} for {itemsToIssue.Count} item(s) totaling ₹{totalIssueVal:N2}",
                    Timestamp = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                var updatedDto = await GetRequisitionByIdAsync(requisition.Id);

                if (updatedDto != null)
                {
                    _notificationService.PublishEvent(new RequisitionLiveEvent
                    {
                        EventType = "REQUISITION_ALLOWED",
                        RequisitionId = updatedDto.Id,
                        RequisitionNumber = updatedDto.RequisitionNumber,
                        DepartmentId = updatedDto.DepartmentId,
                        DepartmentName = updatedDto.DepartmentName,
                        RequestedBy = updatedDto.RequestedBy,
                        TotalEstimatedCost = updatedDto.TotalEstimatedCost,
                        Status = RequisitionStatus.Allowed.ToString(),
                        ItemsCount = updatedDto.Items.Count,
                        ResultingIssueSlipNumber = issueSlipNo,
                        Message = $"🎉 Requisition {updatedDto.RequisitionNumber} for {updatedDto.DepartmentName ?? "Department"} was APPROVED & ISSUED! (Issue Slip #{issueSlipNo})"
                    });
                }

                return (true, $"✅ Requisition {requisition.RequisitionNumber} ALLOWED! Issue Slip {issueSlipNo} created and stock deducted successfully.", updatedDto, issueSlipNo);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Failed to approve/issue requisition {Id}", id);
                return (false, "Error processing requisition. Please try again or contact support.", (StoreRequisitionDto?)null, (string?)null);
            }
        });
    }

    public async Task<(bool Success, string Message, StoreRequisitionDto? Requisition)> DenyRequisitionAsync(
        int id, DenyStoreRequisitionDto dto, int? userId = null)
    {
        var requisition = await _context.StoreRequisitions
            .FirstOrDefaultAsync(r => r.Id == id);

        if (requisition == null)
        {
            return (false, $"Store requisition with ID {id} not found.", null);
        }

        if (requisition.Status != RequisitionStatus.Pending)
        {
            return (false, $"Requisition {requisition.RequisitionNumber} is currently '{requisition.Status}' and cannot be denied.", null);
        }

        if (string.IsNullOrWhiteSpace(dto.DenialRemarks))
        {
            return (false, "A denial remark / reason is mandatory when denying a material requisition.", null);
        }

        requisition.Status = RequisitionStatus.Denied;
        requisition.DenialRemarks = dto.DenialRemarks.Trim();
        requisition.ProcessedByUserId = userId;
        requisition.ProcessedAt = DateTime.UtcNow;
        requisition.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "DENY",
            EntityName = "StoreRequisition",
            RecordId = requisition.RequisitionNumber,
            NewValues = $"Denied store requisition {requisition.RequisitionNumber}. Reason: {dto.DenialRemarks}",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        var updatedDto = await GetRequisitionByIdAsync(requisition.Id);

        if (updatedDto != null)
        {
            _notificationService.PublishEvent(new RequisitionLiveEvent
            {
                EventType = "REQUISITION_DENIED",
                RequisitionId = updatedDto.Id,
                RequisitionNumber = updatedDto.RequisitionNumber,
                DepartmentId = updatedDto.DepartmentId,
                DepartmentName = updatedDto.DepartmentName,
                RequestedBy = updatedDto.RequestedBy,
                TotalEstimatedCost = updatedDto.TotalEstimatedCost,
                Status = RequisitionStatus.Denied.ToString(),
                ItemsCount = updatedDto.Items.Count,
                DenialRemarks = updatedDto.DenialRemarks,
                Message = $"❌ Requisition {updatedDto.RequisitionNumber} for {updatedDto.DepartmentName ?? "Department"} was DENIED: {updatedDto.DenialRemarks}"
            });
        }

        return (true, $"❌ Requisition {requisition.RequisitionNumber} has been DENIED. Denial remark recorded.", updatedDto);
    }

    public async Task<bool> DeleteRequisitionAsync(int id, int? userId = null)
    {
        var requisition = await _context.StoreRequisitions
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (requisition == null) return false;

        if (requisition.Status == RequisitionStatus.Allowed)
        {
            throw new InvalidOperationException("Cannot delete a requisition that has already been allowed and issued to stock.");
        }

        _context.StoreRequisitionItems.RemoveRange(requisition.Items);
        _context.StoreRequisitions.Remove(requisition);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "DELETE",
            EntityName = "StoreRequisition",
            RecordId = requisition.RequisitionNumber,
            NewValues = $"Cancelled/deleted store requisition {requisition.RequisitionNumber}",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return true;
    }

    private static StoreRequisitionDto MapToDto(StoreRequisition r, Dictionary<int, MaterialDto> stockSummaryMap)
    {
        return new StoreRequisitionDto(
            r.Id,
            r.RequisitionNumber,
            r.RequisitionDate,
            r.RequiredDate,
            r.DepartmentId,
            r.Department?.Name,
            r.RequestedBy,
            r.RequestedByUserId,
            r.RequestedByUser?.Username,
            r.Shift ?? "Shift A",
            r.Purpose ?? "Production Consumption",
            r.JobOrderOrMachine,
            r.Status.ToString(),
            r.TotalEstimatedCost,
            r.Remarks,
            r.ProcessedByUserId,
            r.ProcessedByUser?.FullName ?? r.ProcessedByUser?.Username,
            r.ProcessedAt,
            r.DenialRemarks,
            r.ResultingIssueSlipNumber,
            r.ResultingMaterialIssueId,
            r.SupervisorSignature,
            r.CreatedAt,
            r.UpdatedAt,
            r.Items.Select(i =>
            {
                stockSummaryMap.TryGetValue(i.MaterialId, out var stockInfo);
                return new StoreRequisitionItemDto(
                    i.Id,
                    i.MaterialId,
                    i.Material?.MaterialCode ?? "",
                    i.Material?.MaterialName ?? "",
                    i.Material?.Category?.Name,
                    i.Material?.DefaultUom ?? "KG",
                    i.BatchNumber,
                    i.RequestedQuantity,
                    i.ApprovedQuantity,
                    stockInfo?.CurrentStock ?? 0,
                    stockInfo?.ReorderLevel ?? 0,
                    stockInfo?.StockStatus ?? "Normal",
                    i.UnitPrice,
                    i.TotalCost,
                    i.Location,
                    i.ItemRemarks
                );
            }).ToList()
        );
    }
}

using Microsoft.EntityFrameworkCore;
using System.Data;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public record SupplierPriceOptionDto(
    int SupplierId,
    string SupplierName,
    decimal Price,
    bool IsL1Lowest,
    bool IsPreferred,
    DateTime? EffectiveDate
);

public record LowStockRequisitionItemDto(
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string Uom,
    string CategoryName,
    string DepartmentName,
    decimal CurrentStock,
    decimal ReorderLevel,
    decimal DeficitQuantity,
    decimal RecommendedQuantity,
    int? L1SupplierId,
    string L1SupplierName,
    decimal L1UnitPrice,
    decimal EstimatedTotalValue,
    List<SupplierPriceOptionDto> SupplierPriceOptions,
    bool HasPendingRequisition,
    string? PendingDocNumber
);

public record AutoRequisitionBatchItemDto(
    int MaterialId,
    decimal Quantity,
    decimal UnitPrice,
    int? SupplierId,
    string? SupplierName,
    string? Remarks
);

public record AutoRequisitionResultDto(
    bool Success,
    string Message,
    int TotalItemsProcessed,
    int TotalPrsCreated,
    int TotalPosCreated,
    decimal TotalEstimatedValue,
    List<string> CreatedPrNumbers,
    List<string> CreatedPoNumbers,
    List<string> Logs
);

public interface IAutoRequisitionService
{
    Task<List<LowStockRequisitionItemDto>> GetLowStockRequisitionSuggestionsAsync();
    Task<AutoRequisitionResultDto> ExecuteAutoRequisitionGenerationAsync(int? triggeredByUserId = null, List<AutoRequisitionBatchItemDto>? customItems = null);
}

public class AutoRequisitionService : IAutoRequisitionService
{
    private readonly StoreDbContext _context;
    private readonly IStockService _stockService;
    private readonly ILogger<AutoRequisitionService> _logger;

    public AutoRequisitionService(StoreDbContext context, IStockService stockService, ILogger<AutoRequisitionService> logger)
    {
        _context = context;
        _stockService = stockService;
        _logger = logger;
    }

    public async Task<List<LowStockRequisitionItemDto>> GetLowStockRequisitionSuggestionsAsync()
    {
        var stockSummary = await _stockService.GetMaterialsStockSummaryAsync();

        // 1. Filter items where current stock is at or below reorder level (and reorder level > 0)
        var lowStockMaterials = stockSummary
            .Where(m => m.CurrentStock <= m.ReorderLevel && m.ReorderLevel > 0)
            .ToList();

        if (lowStockMaterials.Count == 0)
        {
            return new List<LowStockRequisitionItemDto>();
        }

        var lowStockIds = lowStockMaterials.Select(m => m.Id).ToList();

        // 2. Fetch all suppliers for name resolution
        var allSuppliers = await _context.Suppliers.Where(s => s.IsActive).ToListAsync();

        // 3. Fetch all supplier prices for these materials
        var supplierPrices = await _context.SupplierMaterialPrices
            .Include(p => p.Supplier)
            .Where(p => lowStockIds.Contains(p.MaterialId) && (p.Supplier == null || p.Supplier.IsActive))
            .ToListAsync();

        // 4. Fetch active/pending PRs and POs to detect if already in procurement pipeline
        var pendingPrItems = await _context.PurchaseRequestItems
            .Include(i => i.PurchaseRequest)
            .Where(i => lowStockIds.Contains(i.MaterialId) &&
                        i.PurchaseRequest != null &&
                        (i.PurchaseRequest.Status == PrStatus.Submitted ||
                         i.PurchaseRequest.Status == PrStatus.Approved ||
                         i.PurchaseRequest.Status == PrStatus.Draft ||
                         i.PurchaseRequest.Status == PrStatus.ConvertedToPO))
            .OrderByDescending(i => i.Id)
            .Select(i => new { i.MaterialId, i.PurchaseRequest!.PrNumber })
            .ToListAsync();

        var pendingPoItems = await _context.PurchaseOrderItems
            .Include(i => i.PurchaseOrder)
            .Where(i => lowStockIds.Contains(i.MaterialId) &&
                        i.PurchaseOrder != null &&
                        (i.PurchaseOrder.Status == PoStatus.Issued ||
                         i.PurchaseOrder.Status == PoStatus.PartiallyReceived ||
                         i.PurchaseOrder.Status == PoStatus.Draft))
            .OrderByDescending(i => i.Id)
            .Select(i => new { i.MaterialId, i.PurchaseOrder!.PoNumber })
            .ToListAsync();

        // 5. Historical receipt rates as fallback
        var recentReceiptItems = await _context.MaterialReceiptItems
            .Include(r => r.MaterialReceipt)
            .Where(r => lowStockIds.Contains(r.MaterialId))
            .OrderByDescending(r => r.Id)
            .Take(100)
            .Select(r => new { r.MaterialId, r.UnitPrice, SupplierName = r.MaterialReceipt != null ? r.MaterialReceipt.SupplierName : null })
            .ToListAsync();

        var result = new List<LowStockRequisitionItemDto>();

        foreach (var mat in lowStockMaterials)
        {
            var matPrices = supplierPrices.Where(p => p.MaterialId == mat.Id).ToList();
            var supplierOptions = new List<SupplierPriceOptionDto>();

            if (matPrices.Count > 0)
            {
                // Find lowest price (L1)
                var minPrice = matPrices.Min(p => p.Price > 0 ? p.Price : (p.RevisedPrice > 0 ? p.RevisedPrice : decimal.MaxValue));
                foreach (var p in matPrices)
                {
                    var priceVal = p.Price > 0 ? p.Price : (p.RevisedPrice > 0 ? p.RevisedPrice : mat.StandardPrice);
                    supplierOptions.Add(new SupplierPriceOptionDto(
                        p.SupplierId,
                        p.Supplier?.SupplierName ?? "Supplier",
                        priceVal,
                        priceVal == minPrice,
                        p.IsPreferred,
                        p.EffectiveDate
                    ));
                }
            }

            // Fallback: check historical receipts or primary supplier
            if (supplierOptions.Count == 0 && !string.IsNullOrEmpty(mat.PrimarySupplierName))
            {
                var matchingSupp = allSuppliers.FirstOrDefault(s => s.SupplierName.Equals(mat.PrimarySupplierName, StringComparison.OrdinalIgnoreCase));
                var histPrice = recentReceiptItems.FirstOrDefault(r => r.MaterialId == mat.Id)?.UnitPrice ?? mat.StandardPrice;
                supplierOptions.Add(new SupplierPriceOptionDto(
                    matchingSupp?.Id ?? 0,
                    mat.PrimarySupplierName,
                    histPrice > 0 ? histPrice : mat.StandardPrice,
                    true,
                    true,
                    DateTime.UtcNow
                ));
            }

            if (supplierOptions.Count == 0)
            {
                supplierOptions.Add(new SupplierPriceOptionDto(
                    0,
                    "Primary / Open Market",
                    mat.StandardPrice,
                    true,
                    true,
                    DateTime.UtcNow
                ));
            }

            // Sort options by price ascending (L1 lowest rate first)
            supplierOptions = supplierOptions.OrderBy(o => o.Price).ToList();

            // Lowest rate supplier (L1)
            var l1Option = supplierOptions.First();

            // Recommended order quantity: Target Buffer = ReorderLevel * 2 (or ReorderLevel + Deficit)
            var deficit = Math.Max(0, mat.ReorderLevel - mat.CurrentStock);
            var recommendedQty = mat.ReorderLevel * 2 - mat.CurrentStock;
            if (recommendedQty <= 0) recommendedQty = mat.ReorderLevel;

            // Check if PR or PO is already open
            var pendingPr = pendingPrItems.FirstOrDefault(p => p.MaterialId == mat.Id);
            var pendingPo = pendingPoItems.FirstOrDefault(p => p.MaterialId == mat.Id);
            bool hasPending = pendingPr != null || pendingPo != null;
            string? pendingDoc = pendingPo != null ? $"PO: {pendingPo.PoNumber}" : (pendingPr != null ? $"PR: {pendingPr.PrNumber}" : null);

            result.Add(new LowStockRequisitionItemDto(
                mat.Id,
                mat.MaterialCode,
                mat.MaterialName,
                mat.DefaultUom,
                mat.CategoryName ?? "General",
                mat.UserDepartmentName ?? "Stores",
                mat.CurrentStock,
                mat.ReorderLevel,
                deficit,
                recommendedQty,
                l1Option.SupplierId > 0 ? l1Option.SupplierId : null,
                l1Option.SupplierName,
                l1Option.Price,
                Math.Round(recommendedQty * l1Option.Price, 2),
                supplierOptions,
                hasPending,
                pendingDoc
            ));
        }

        return result.OrderByDescending(r => r.DeficitQuantity).ToList();
    }

    public async Task<AutoRequisitionResultDto> ExecuteAutoRequisitionGenerationAsync(int? triggeredByUserId = null, List<AutoRequisitionBatchItemDto>? customItems = null)
    {
        var logs = new List<string>();
        var createdPrNumbers = new List<string>();
        var createdPoNumbers = new List<string>();
        decimal totalEstimatedValue = 0;

        List<LowStockRequisitionItemDto> itemsToProcess;

        if (customItems != null && customItems.Count > 0)
        {
            // Process specifically requested items
            var suggestions = await GetLowStockRequisitionSuggestionsAsync();
            itemsToProcess = new List<LowStockRequisitionItemDto>();

            foreach (var ci in customItems)
            {
                var match = suggestions.FirstOrDefault(s => s.MaterialId == ci.MaterialId);
                if (match != null)
                {
                    // Strict prevention: Skip if already has pending PR/PO
                    if (match.HasPendingRequisition)
                    {
                        logs.Add($"Skipped {match.MaterialCode}: already has active document ({match.PendingDocNumber}).");
                        continue;
                    }

                    itemsToProcess.Add(match with
                    {
                        RecommendedQuantity = ci.Quantity > 0 ? ci.Quantity : match.RecommendedQuantity,
                        L1UnitPrice = ci.UnitPrice > 0 ? ci.UnitPrice : match.L1UnitPrice,
                        L1SupplierId = ci.SupplierId ?? match.L1SupplierId,
                        L1SupplierName = !string.IsNullOrEmpty(ci.SupplierName) ? ci.SupplierName : match.L1SupplierName,
                        EstimatedTotalValue = (ci.Quantity > 0 ? ci.Quantity : match.RecommendedQuantity) * (ci.UnitPrice > 0 ? ci.UnitPrice : match.L1UnitPrice)
                    });
                }
            }
        }
        else
        {
            // Automated 6:00 PM routine: filter only low stock items without pending PR/PO
            var suggestions = await GetLowStockRequisitionSuggestionsAsync();
            itemsToProcess = suggestions.Where(s => !s.HasPendingRequisition).ToList();
        }

        if (itemsToProcess.Count == 0)
        {
            return new AutoRequisitionResultDto(
                true,
                "No eligible low-stock materials require automated requisition generation (all items are either in safe buffer or already have pending PR/POs).",
                0,
                0,
                0,
                0,
                createdPrNumbers,
                createdPoNumbers,
                new List<string> { "Scanned stock inventory: 0 deficit items found needing new PR." }
            );
        }

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                var today = DateTime.UtcNow;
                var dateStr = today.ToString("yyyyMMdd");
                var allSuppliers = await _context.Suppliers.ToListAsync();

                // Get sequence for today's Auto PRs & POs
                var existingTodayPrCount = await _context.PurchaseRequests
                    .CountAsync(p => p.PrNumber.StartsWith($"PR/AUTO/{dateStr}"));
                var existingTodayPoCount = await _context.PurchaseOrders
                    .CountAsync(p => p.PoNumber.StartsWith($"PO/AUTO/{dateStr}"));

                int prSeq = existingTodayPrCount + 1;
                int poSeq = existingTodayPoCount + 1;

                // Group items by L1 Supplier so all items for the SAME supplier go into ONE single PO & PR
                var supplierGroups = itemsToProcess
                    .GroupBy(i => new { SupplierId = i.L1SupplierId, SupplierName = i.L1SupplierName })
                    .ToList();

                foreach (var group in supplierGroups)
                {
                    var prNumber = $"PR/AUTO/{dateStr}/{prSeq:D3}";
                    var poNumber = $"PO/AUTO/{dateStr}/{poSeq:D3}";
                    prSeq++;
                    poSeq++;

                    var groupTotal = group.Sum(i => i.EstimatedTotalValue);
                    totalEstimatedValue += groupTotal;

                    // Resolve SupplierId if null
                    int? resolvedSupplierId = group.Key.SupplierId;
                    if (!resolvedSupplierId.HasValue || resolvedSupplierId.Value == 0)
                    {
                        var matchSupp = allSuppliers.FirstOrDefault(s => s.SupplierName.Equals(group.Key.SupplierName, StringComparison.OrdinalIgnoreCase));
                        if (matchSupp != null) resolvedSupplierId = matchSupp.Id;
                    }

                    // Any out-of-stock item raises priority to Urgent
                    bool hasZeroStock = group.Any(i => i.CurrentStock <= 0);

                    // 1. Create Purchase Request (PR)
                    var pr = new PurchaseRequest
                    {
                        PrNumber = prNumber,
                        RequestDate = today,
                        Priority = hasZeroStock ? PrPriority.Urgent : PrPriority.Normal,
                        RequiredByDate = today.AddDays(3),
                        Status = PrStatus.ConvertedToPO,
                        Purpose = $"Auto-Generated Daily 6:00 PM Reorder Indent for L1 Supplier '{group.Key.SupplierName}'",
                        TotalEstimatedValue = groupTotal,
                        CreatedByUserId = triggeredByUserId,
                        CreatedAt = today,
                        Items = new List<PurchaseRequestItem>()
                    };

                    foreach (var item in group)
                    {
                        pr.Items.Add(new PurchaseRequestItem
                        {
                            MaterialId = item.MaterialId,
                            RequestedQuantity = item.RecommendedQuantity,
                            AvailableStockAtRequest = item.CurrentStock,
                            ReorderLevelAtRequest = item.ReorderLevel,
                            EstimatedUnitPrice = item.L1UnitPrice,
                            TotalAmount = item.EstimatedTotalValue,
                            PreferredSupplierId = resolvedSupplierId,
                            PresentSupplierName = item.L1SupplierName,
                            Purpose = $"Auto low-stock replenishment (Stock: {item.CurrentStock} {item.Uom} <= Reorder: {item.ReorderLevel} {item.Uom})",
                            Remarks = $"L1 Lowest Rate Supplier: {item.L1SupplierName} @ Rs. {item.L1UnitPrice}/{item.Uom}"
                        });
                    }

                    _context.PurchaseRequests.Add(pr);
                    await _context.SaveChangesAsync(); // Save to generate pr.Id

                    // 2. Create Official Purchase Order (PO) assigned to the L1 Supplier
                    var po = new PurchaseOrder
                    {
                        PoNumber = poNumber,
                        PoDate = today,
                        SupplierId = resolvedSupplierId,
                        SupplierName = group.Key.SupplierName,
                        PurchaseRequestId = pr.Id,
                        ExpectedDeliveryDate = today.AddDays(3),
                        PaymentTerms = "30 Days Credit",
                        DeliveryAddress = "AMAC Unit-5 Stores, Sompura Industrial Area, Bangalore",
                        Status = PoStatus.Issued,
                        TotalAmount = groupTotal,
                        CreatedByUserId = triggeredByUserId,
                        CreatedAt = today,
                        Remarks = $"Automated 6:00 PM Purchase Order generated from Requisition {prNumber} for L1 Supplier '{group.Key.SupplierName}'",
                        Items = new List<PurchaseOrderItem>()
                    };

                    foreach (var item in group)
                    {
                        po.Items.Add(new PurchaseOrderItem
                        {
                            MaterialId = item.MaterialId,
                            PoQuantity = item.RecommendedQuantity,
                            ReceivedQuantity = 0,
                            PendingQuantity = item.RecommendedQuantity,
                            UnitPrice = item.L1UnitPrice,
                            TotalPrice = item.EstimatedTotalValue,
                            Remarks = $"L1 Quoted Rate: Rs. {item.L1UnitPrice}/{item.Uom}"
                        });

                        logs.Add($"Item {item.MaterialCode} ({item.MaterialName}): Order Qty {item.RecommendedQuantity} {item.Uom} @ Rs. {item.L1UnitPrice} -> PO: {poNumber} (Supplier: {item.L1SupplierName})");
                    }

                    _context.PurchaseOrders.Add(po);
                    createdPrNumbers.Add(prNumber);
                    createdPoNumbers.Add(poNumber);
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                _logger.LogInformation("Auto-Requisition generated {PrCount} PRs and {PoCount} POs for {ItemCount} items. Total: Rs. {Total}",
                    createdPrNumbers.Count, createdPoNumbers.Count, itemsToProcess.Count, totalEstimatedValue);

                return new AutoRequisitionResultDto(
                    true,
                    $"Successfully generated {createdPoNumbers.Count} Purchase Order(s) & Requisition(s) for {itemsToProcess.Count} low-stock material(s) totaling Rs. {totalEstimatedValue:N2} using L1 Lowest Supplier Rates.",
                    itemsToProcess.Count,
                    createdPrNumbers.Count,
                    createdPoNumbers.Count,
                    totalEstimatedValue,
                    createdPrNumbers,
                    createdPoNumbers,
                    logs
                );
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Failed to execute auto requisition generation");
                return new AutoRequisitionResultDto(
                    false,
                    "Failed to generate auto-requisitions.",
                    0,
                    0,
                    0,
                    0,
                    createdPrNumbers,
                    createdPoNumbers,
                    new List<string> { "An internal error occurred." }
                );
            }
        });
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;
using StoreManager.Api.Services;
using System.Data;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PurchasingController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IAutoRequisitionService _autoRequisitionService;

    public PurchasingController(StoreDbContext context, IAutoRequisitionService autoRequisitionService)
    {
        _context = context;
        _autoRequisitionService = autoRequisitionService;
    }

    // Auto-Requisitions (Below Reorder Level & L1 Supplier Comparison)
    [HttpGet("auto-requisitions/suggestions")]
    public async Task<IActionResult> GetAutoRequisitionSuggestions()
    {
        var suggestions = await _autoRequisitionService.GetLowStockRequisitionSuggestionsAsync();
        return Ok(suggestions);
    }

    [HttpPost("auto-requisitions/trigger-now")]
    [Authorize(Roles = "Admin,StoreManager,PurchaseUser")]
    public async Task<IActionResult> TriggerAutoRequisitionNow()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        var result = await _autoRequisitionService.ExecuteAutoRequisitionGenerationAsync(userId > 0 ? userId : null);
        return Ok(result);
    }

    [HttpPost("auto-requisitions/create-batch")]
    [Authorize(Roles = "Admin,StoreManager,PurchaseUser")]
    public async Task<IActionResult> CreateBatchAutoRequisitions([FromBody] List<AutoRequisitionBatchItemDto> items)
    {
        if (items == null || items.Count == 0)
        {
            return BadRequest(new { message = "No items provided for requisition generation." });
        }

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        var result = await _autoRequisitionService.ExecuteAutoRequisitionGenerationAsync(userId > 0 ? userId : null, items);
        return Ok(result);
    }

    // Purchase Requests
    [HttpGet("requests")]
    public async Task<IActionResult> GetPurchaseRequests([FromQuery] string? search, [FromQuery] PrStatus? status)
    {
        var query = _context.PurchaseRequests
            .Include(p => p.Department)
            .Include(p => p.CreatedByUser)
            .Include(p => p.Items)
                .ThenInclude(i => i.Material)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p => p.PrNumber.ToLower().Contains(s) || (p.Purpose != null && p.Purpose.ToLower().Contains(s)));
        }

        if (status.HasValue) query = query.Where(p => p.Status == status.Value);

        var list = await query.OrderByDescending(p => p.RequestDate).ToListAsync();

        return Ok(list.Select(p => new
        {
            p.Id,
            p.PrNumber,
            p.RequestDate,
            p.DepartmentId,
            DepartmentName = p.Department?.Name,
            Priority = p.Priority.ToString(),
            p.RequiredByDate,
            Status = p.Status.ToString(),
            p.Purpose,
            p.TotalEstimatedValue,
            CreatedBy = p.CreatedByUser?.FullName,
            ItemCount = p.Items.Count
        }));
    }

    [HttpGet("requests/{id}")]
    public async Task<IActionResult> GetPurchaseRequestById(int id)
    {
        var p = await _context.PurchaseRequests
            .Include(x => x.Department)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ApprovedByUser)
            .Include(x => x.Items)
                .ThenInclude(i => i.Material)
            .Include(x => x.Items)
                .ThenInclude(i => i.PreferredSupplier)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (p == null) return NotFound();

        return Ok(new
        {
            p.Id,
            p.PrNumber,
            p.RequestDate,
            p.DepartmentId,
            DepartmentName = p.Department?.Name,
            Priority = p.Priority.ToString(),
            p.RequiredByDate,
            Status = p.Status.ToString(),
            p.Purpose,
            p.TotalEstimatedValue,
            p.ApprovalRemarks,
            CreatedBy = p.CreatedByUser?.FullName,
            ApprovedBy = p.ApprovedByUser?.FullName,
            Items = p.Items.Select(i => new
            {
                i.Id,
                i.MaterialId,
                MaterialCode = i.Material?.MaterialCode,
                MaterialName = i.Material?.MaterialName,
                Uom = i.Material?.DefaultUom,
                i.RequestedQuantity,
                i.AvailableStockAtRequest,
                i.ReorderLevelAtRequest,
                i.EstimatedUnitPrice,
                i.TotalAmount,
                i.PreferredSupplierId,
                PreferredSupplierName = i.PreferredSupplier?.SupplierName ?? i.PresentSupplierName,
                i.Purpose,
                i.DiscountTerms
            })
        });
    }

    [HttpPost("requests")]
    [Authorize(Roles = "Admin,StoreManager,PurchaseUser")]
    public async Task<IActionResult> CreatePurchaseRequest([FromBody] CreatePurchaseRequestDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "At least one purchase request item is required." });

        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        // Safe sequential number: MAX(Id)+1 inside Serializable tx prevents duplicates
        var maxPrId = await _context.PurchaseRequests.MaxAsync(r => (int?)r.Id) ?? 0;
        var prNumber = $"PR-{DateTime.UtcNow:yyyyMM}-{(maxPrId + 1):D4}";

        var pr = new PurchaseRequest
        {
            PrNumber = prNumber,
            RequestDate = dto.RequestDate,
            DepartmentId = dto.DepartmentId,
            Priority = dto.Priority,
            RequiredByDate = dto.RequiredByDate,
            Status = PrStatus.Submitted,
            Purpose = dto.Purpose,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        decimal grandTotal = 0;

        foreach (var itemDto in dto.Items)
        {
            var material = await _context.Materials.FindAsync(itemDto.MaterialId);
            if (material == null)
                return BadRequest(new { message = $"Material with ID {itemDto.MaterialId} not found." });
            if (itemDto.RequestedQuantity <= 0 || itemDto.EstimatedUnitPrice < 0)
                return BadRequest(new { message = "Requested quantities must be greater than zero and prices cannot be negative." });
            var itemTotal = itemDto.RequestedQuantity * itemDto.EstimatedUnitPrice;
            grandTotal += itemTotal;

            // Get current stock
            var currentStock = await _context.StockLedgers
                .Where(s => s.MaterialId == itemDto.MaterialId)
                .OrderByDescending(s => s.TransactionDate)
                .ThenByDescending(s => s.Id)
                .Select(s => s.BalanceQuantityAfter)
                .FirstOrDefaultAsync();

            pr.Items.Add(new PurchaseRequestItem
            {
                MaterialId = itemDto.MaterialId,
                RequestedQuantity = itemDto.RequestedQuantity,
                AvailableStockAtRequest = currentStock,
                ReorderLevelAtRequest = material?.ReorderLevel ?? 0,
                EstimatedUnitPrice = itemDto.EstimatedUnitPrice,
                TotalAmount = itemTotal,
                PreferredSupplierId = itemDto.PreferredSupplierId,
                Purpose = itemDto.Purpose,
                DiscountTerms = itemDto.DiscountTerms
            });
        }

        pr.TotalEstimatedValue = grandTotal;
        _context.PurchaseRequests.Add(pr);

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "CREATE",
            EntityName = "PurchaseRequest",
            RecordId = prNumber,
            NewValues = $"Items: {dto.Items.Count}, Total: {grandTotal}, Priority: {dto.Priority}",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { message = "Purchase request created successfully.", prNumber, id = pr.Id });
    }

    [Authorize(Roles = "Admin,StoreManager,PurchaseUser")]
    [HttpPost("requests/{id}/status")]
    public async Task<IActionResult> UpdatePrStatus(int id, [FromBody] UpdateStatusRequest req)
    {
        var pr = await _context.PurchaseRequests.FindAsync(id);
        if (pr == null) return NotFound();

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        if (Enum.TryParse<PrStatus>(req.Status, true, out var newStatus))
        {
            pr.Status = newStatus;
            pr.ApprovalRemarks = req.Remarks;
            if (newStatus == PrStatus.Approved) pr.ApprovedByUserId = userId;

            _context.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = "UPDATE",
                EntityName = "PurchaseRequestStatus",
                RecordId = pr.PrNumber,
                NewValues = $"New Status: {newStatus}, Remarks: {req.Remarks}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { message = $"PR status updated to {newStatus}." });
        }

        return BadRequest(new { message = "Invalid status." });
    }

    // Purchase Orders
    [HttpGet("orders")]
    public async Task<IActionResult> GetPurchaseOrders([FromQuery] string? search, [FromQuery] PoStatus? status)
    {
        var query = _context.PurchaseOrders
            .Include(p => p.Supplier)
            .Include(p => p.CreatedByUser)
            .Include(p => p.Items)
                .ThenInclude(i => i.Material)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p => p.PoNumber.ToLower().Contains(s) || (p.SupplierName != null && p.SupplierName.ToLower().Contains(s)));
        }

        if (status.HasValue) query = query.Where(p => p.Status == status.Value);

        var list = await query.OrderByDescending(p => p.PoDate).ToListAsync();

        return Ok(list.Select(p => new
        {
            p.Id,
            p.PoNumber,
            p.PoDate,
            p.SupplierId,
            SupplierName = p.Supplier?.SupplierName ?? p.SupplierName,
            p.ExpectedDeliveryDate,
            Status = p.Status.ToString(),
            p.TotalAmount,
            TotalPoQuantity = p.Items.Sum(i => i.PoQuantity),
            TotalReceivedQuantity = p.Items.Sum(i => i.ReceivedQuantity),
            TotalPendingQuantity = p.Items.Sum(i => i.PendingQuantity),
            CreatedBy = p.CreatedByUser?.FullName,
            ItemCount = p.Items.Count
        }));
    }

    [HttpGet("orders/{id}")]
    public async Task<IActionResult> GetPurchaseOrderById(int id)
    {
        var po = await _context.PurchaseOrders
            .Include(x => x.Supplier)
            .Include(x => x.PurchaseRequest)
            .Include(x => x.CreatedByUser)
            .Include(x => x.Items)
                .ThenInclude(i => i.Material)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (po == null) return NotFound();

        return Ok(new
        {
            po.Id,
            po.PoNumber,
            po.PoDate,
            po.SupplierId,
            SupplierName = po.Supplier?.SupplierName ?? po.SupplierName,
            po.PurchaseRequestId,
            PrNumber = po.PurchaseRequest?.PrNumber,
            po.ExpectedDeliveryDate,
            Status = po.Status.ToString(),
            po.TotalAmount,
            po.PaymentTerms,
            po.DeliveryAddress,
            po.Remarks,
            CreatedBy = po.CreatedByUser?.FullName,
            Items = po.Items.Select(i => new
            {
                i.Id,
                i.MaterialId,
                MaterialCode = i.Material?.MaterialCode,
                MaterialName = i.Material?.MaterialName,
                Uom = i.Material?.DefaultUom,
                i.PoQuantity,
                i.ReceivedQuantity,
                i.PendingQuantity,
                i.UnitPrice,
                i.TotalPrice,
                i.Remarks
            })
        });
    }

    [HttpPost("orders")]
    [Authorize(Roles = "Admin,StoreManager,PurchaseUser")]
    public async Task<IActionResult> CreatePurchaseOrder([FromBody] CreatePurchaseOrderDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "At least one purchase order item is required." });

        await using var tx = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        // Safe sequential number: MAX(Id)+1 inside Serializable tx prevents duplicates
        var maxPoId = await _context.PurchaseOrders.MaxAsync(p => (int?)p.Id) ?? 0;
        var poNumber = $"PO-{DateTime.UtcNow:yyyyMM}-{(maxPoId + 1):D4}";

        var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
        if (supplier == null || !supplier.IsActive)
            return BadRequest(new { message = "An active supplier is required." });

        var po = new PurchaseOrder
        {
            PoNumber = poNumber,
            PoDate = dto.PoDate,
            SupplierId = dto.SupplierId,
            SupplierName = supplier?.SupplierName,
            PurchaseRequestId = dto.PurchaseRequestId,
            ExpectedDeliveryDate = dto.ExpectedDeliveryDate,
            Status = PoStatus.Issued,
            PaymentTerms = dto.PaymentTerms,
            DeliveryAddress = dto.DeliveryAddress,
            Remarks = dto.Remarks,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        decimal grandTotal = 0;

        foreach (var itemDto in dto.Items)
        {
            if (itemDto.PoQuantity <= 0 || itemDto.UnitPrice < 0)
                return BadRequest(new { message = "Purchase quantities must be greater than zero and prices cannot be negative." });
            if (!await _context.Materials.AnyAsync(m => m.Id == itemDto.MaterialId && m.IsActive))
                return BadRequest(new { message = $"Material with ID {itemDto.MaterialId} not found or inactive." });

            var lineTotal = itemDto.PoQuantity * itemDto.UnitPrice;
            grandTotal += lineTotal;

            po.Items.Add(new PurchaseOrderItem
            {
                MaterialId = itemDto.MaterialId,
                PoQuantity = itemDto.PoQuantity,
                ReceivedQuantity = 0,
                PendingQuantity = itemDto.PoQuantity,
                UnitPrice = itemDto.UnitPrice,
                TotalPrice = lineTotal,
                Remarks = itemDto.Remarks
            });
        }

        po.TotalAmount = grandTotal;
        _context.PurchaseOrders.Add(po);

        // If created against a PR, update PR status
        if (dto.PurchaseRequestId.HasValue)
        {
            var pr = await _context.PurchaseRequests.FindAsync(dto.PurchaseRequestId.Value);
            if (pr != null) pr.Status = PrStatus.ConvertedToPO;
        }

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "CREATE",
            EntityName = "PurchaseOrder",
            RecordId = poNumber,
            NewValues = $"Supplier: {supplier?.SupplierName}, Items: {dto.Items.Count}, Total: {grandTotal}",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { message = "Purchase order created successfully.", poNumber, id = po.Id });
    }
}

public record UpdateStatusRequest(string Status, string? Remarks);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly StoreDbContext _context;

    public SuppliersController(StoreDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? isActive)
    {
        var query = _context.Suppliers.AsQueryable();
        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(x => x.SupplierName.ToLower().Contains(s) || (x.ContactPerson != null && x.ContactPerson.ToLower().Contains(s)));
        }
        var list = await query.OrderBy(s => s.SupplierName).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,StoreManager,PurchaseUser")]
    public async Task<IActionResult> Create([FromBody] SupplierDto dto)
    {
        var supp = new Supplier
        {
            SupplierName = dto.SupplierName.Trim(),
            ContactPerson = dto.ContactPerson?.Trim(),
            Phone = dto.Phone?.Trim(),
            Email = dto.Email?.Trim(),
            Address = dto.Address?.Trim(),
            GstNumber = dto.GstNumber?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.Suppliers.Add(supp);
        await _context.SaveChangesAsync();
        return Ok(supp);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}/toggle-active")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var supp = await _context.Suppliers.FindAsync(id);
        if (supp == null) return NotFound(new { message = "Supplier not found." });

        supp.IsActive = !supp.IsActive;
        await _context.SaveChangesAsync();

        return Ok(new { success = true, isActive = supp.IsActive, message = $"Supplier {(supp.IsActive ? "activated" : "marked inactive")} successfully." });
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var supp = await _context.Suppliers.FindAsync(id);
        if (supp == null) return NotFound(new { message = "Supplier not found." });

        // Check if supplier has referenced records
        var hasReceipts = await _context.MaterialReceipts.AnyAsync(r => r.SupplierId == id);
        var hasPOs = await _context.PurchaseOrders.AnyAsync(p => p.SupplierId == id);

        if (hasReceipts || hasPOs)
        {
            // Soft delete to protect relational data
            supp.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, isSoftDeleted = true, message = $"Supplier '{supp.SupplierName}' has transaction history and has been deactivated." });
        }

        // Hard delete if orphaned
        var prices = await _context.SupplierMaterialPrices.Where(p => p.SupplierId == id).ToListAsync();
        if (prices.Count > 0) _context.SupplierMaterialPrices.RemoveRange(prices);

        var histories = await _context.SupplierPriceHistories.Where(h => h.SupplierId == id).ToListAsync();
        if (histories.Count > 0) _context.SupplierPriceHistories.RemoveRange(histories);

        _context.Suppliers.Remove(supp);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, isSoftDeleted = false, message = $"Supplier '{supp.SupplierName}' removed successfully." });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("batch-delete")]
    public async Task<IActionResult> BatchDelete([FromBody] BatchDeleteSuppliersRequest request)
    {
        if (request.SupplierIds == null || request.SupplierIds.Count == 0)
        {
            return BadRequest(new { message = "No suppliers selected for deletion." });
        }

        var suppliers = await _context.Suppliers.Where(s => request.SupplierIds.Contains(s.Id)).ToListAsync();
        int deactivatedCount = 0;
        int hardDeletedCount = 0;

        foreach (var supp in suppliers)
        {
            var hasReceipts = await _context.MaterialReceipts.AnyAsync(r => r.SupplierId == supp.Id);
            var hasPOs = await _context.PurchaseOrders.AnyAsync(p => p.SupplierId == supp.Id);

            if (hasReceipts || hasPOs)
            {
                supp.IsActive = false;
                deactivatedCount++;
            }
            else
            {
                var prices = await _context.SupplierMaterialPrices.Where(p => p.SupplierId == supp.Id).ToListAsync();
                if (prices.Count > 0) _context.SupplierMaterialPrices.RemoveRange(prices);

                var histories = await _context.SupplierPriceHistories.Where(h => h.SupplierId == supp.Id).ToListAsync();
                if (histories.Count > 0) _context.SupplierPriceHistories.RemoveRange(histories);

                _context.Suppliers.Remove(supp);
                hardDeletedCount++;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new
        {
            success = true,
            totalProcessed = suppliers.Count,
            deactivated = deactivatedCount,
            hardDeleted = hardDeletedCount,
            message = $"Processed {suppliers.Count} suppliers: {hardDeletedCount} removed, {deactivatedCount} deactivated."
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("delete-all")]
    public async Task<IActionResult> DeleteAll([FromBody] DeleteAllSuppliersRequest request)
    {
        var query = _context.Suppliers.AsQueryable();
        if (request.InactiveOnly)
        {
            query = query.Where(s => !s.IsActive);
        }

        var suppliers = await query.ToListAsync();
        int deactivatedCount = 0;
        int hardDeletedCount = 0;

        foreach (var supp in suppliers)
        {
            var hasReceipts = await _context.MaterialReceipts.AnyAsync(r => r.SupplierId == supp.Id);
            var hasPOs = await _context.PurchaseOrders.AnyAsync(p => p.SupplierId == supp.Id);

            if (hasReceipts || hasPOs)
            {
                supp.IsActive = false;
                deactivatedCount++;
            }
            else
            {
                var prices = await _context.SupplierMaterialPrices.Where(p => p.SupplierId == supp.Id).ToListAsync();
                if (prices.Count > 0) _context.SupplierMaterialPrices.RemoveRange(prices);

                var histories = await _context.SupplierPriceHistories.Where(h => h.SupplierId == supp.Id).ToListAsync();
                if (histories.Count > 0) _context.SupplierPriceHistories.RemoveRange(histories);

                _context.Suppliers.Remove(supp);
                hardDeletedCount++;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new
        {
            success = true,
            totalProcessed = suppliers.Count,
            deactivated = deactivatedCount,
            hardDeleted = hardDeletedCount,
            message = $"Processed {suppliers.Count} suppliers: {hardDeletedCount} removed, {deactivatedCount} deactivated."
        });
    }

    [HttpGet("price-comparison")]
    public async Task<IActionResult> GetPriceComparison([FromQuery] int? materialId)
    {
        var query = _context.SupplierMaterialPrices
            .Include(p => p.Material)
            .Include(p => p.Supplier)
            .AsQueryable();

        if (materialId.HasValue) query = query.Where(p => p.MaterialId == materialId.Value);

        var list = await query.ToListAsync();

        var grouped = list
            .GroupBy(p => new { p.MaterialId, p.Material!.MaterialCode, p.Material.MaterialName })
            .Select(g => new
            {
                g.Key.MaterialId,
                g.Key.MaterialCode,
                g.Key.MaterialName,
                Prices = g.Select(x => new
                {
                    x.SupplierId,
                    SupplierName = x.Supplier?.SupplierName,
                    x.Price,
                    x.RevisedPrice,
                    x.IsPreferred,
                    x.EffectiveDate
                }).ToList()
            })
            .ToList();

        return Ok(grouped);
    }

    [HttpGet("price-history")]
    public async Task<IActionResult> GetPriceHistory([FromQuery] int? materialId)
    {
        var query = _context.SupplierPriceHistories
            .Include(p => p.Material)
            .Include(p => p.Supplier)
            .AsQueryable();

        if (materialId.HasValue) query = query.Where(p => p.MaterialId == materialId.Value);

        var list = await query.OrderByDescending(p => p.ChangedDate).Take(100).ToListAsync();

        return Ok(list.Select(p => new
        {
            p.Id,
            p.MaterialId,
            MaterialCode = p.Material?.MaterialCode,
            MaterialName = p.Material?.MaterialName,
            p.SupplierId,
            SupplierName = p.Supplier?.SupplierName,
            p.OldPrice,
            p.NewPrice,
            p.PriceDifference,
            p.PercentageChange,
            p.ChangedDate,
            p.Reason
        }));
    }

    [HttpGet("inward-invoice-rates")]
    public async Task<IActionResult> GetInwardInvoiceRates([FromQuery] string? search, [FromQuery] int? materialId, [FromQuery] int? supplierId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
    {
        var query = _context.MaterialReceiptItems
            .Include(i => i.MaterialReceipt)
            .Include(i => i.Material)
                .ThenInclude(m => m!.Category)
            .AsQueryable();

        if (materialId.HasValue) query = query.Where(i => i.MaterialId == materialId.Value);
        if (supplierId.HasValue)
        {
            var supp = await _context.Suppliers.FindAsync(supplierId.Value);
            var suppName = supp?.SupplierName?.Trim().ToLower();
            query = query.Where(i => i.MaterialReceipt!.SupplierId == supplierId.Value || (suppName != null && i.MaterialReceipt.SupplierName != null && i.MaterialReceipt.SupplierName.ToLower() == suppName));
        }
        if (fromDate.HasValue) query = query.Where(i => i.MaterialReceipt!.ReceiptDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(i => i.MaterialReceipt!.ReceiptDate <= toDate.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i =>
                i.Material!.MaterialCode.ToLower().Contains(s) ||
                i.Material.MaterialName.ToLower().Contains(s) ||
                (i.MaterialReceipt!.SupplierName != null && i.MaterialReceipt.SupplierName.ToLower().Contains(s)) ||
                (i.MaterialReceipt.InvoiceNumber != null && i.MaterialReceipt.InvoiceNumber.ToLower().Contains(s)) ||
                i.MaterialReceipt.GrnNumber.ToLower().Contains(s));
        }

        var list = await query
            .OrderByDescending(i => i.MaterialReceipt!.ReceiptDate)
            .ThenByDescending(i => i.Id)
            .Take(300)
            .ToListAsync();

        return Ok(list.Select(i =>
        {
            var stdRate = i.Material?.StandardPrice ?? 0;
            var invoiceRate = i.UnitPrice;
            var deflection = invoiceRate - stdRate;
            var deflectionPct = stdRate > 0 ? (deflection / stdRate * 100) : 0;
            var batchVariance = deflection * i.ReceivedQuantity;
            var monthlyReq = i.Material?.MonthlyRequirement ?? 0;
            var monthlyImpact = deflection * monthlyReq;

            return new
            {
                i.Id,
                ReceiptId = i.MaterialReceiptId,
                GrnNumber = i.MaterialReceipt?.GrnNumber,
                ReceiptDate = i.MaterialReceipt?.ReceiptDate,
                InvoiceNumber = i.MaterialReceipt?.InvoiceNumber,
                InvoiceDate = i.MaterialReceipt?.InvoiceDate,
                SupplierId = i.MaterialReceipt?.SupplierId,
                SupplierName = i.MaterialReceipt?.SupplierName,
                MaterialId = i.MaterialId,
                MaterialCode = i.Material?.MaterialCode,
                MaterialName = i.Material?.MaterialName,
                CategoryName = i.Material?.Category?.Name,
                Uom = i.Material?.DefaultUom ?? "KG",
                i.ReceivedQuantity,
                InvoiceUnitRate = invoiceRate,
                TotalInvoiceAmount = i.TotalAmount,
                StandardBaseRate = stdRate,
                RateDeflection = deflection,
                DeflectionPercentage = Math.Round(deflectionPct, 2),
                BatchCostVariance = Math.Round(batchVariance, 2),
                MonthlyRequirement = monthlyReq,
                MonthlyBudgetImpact = Math.Round(monthlyImpact, 2),
                i.Remarks
            };
        }));
    }

    [HttpGet("material-daywise-rates")]
    public async Task<IActionResult> GetMaterialDaywiseRates([FromQuery] string? search, [FromQuery] int? categoryId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
    {
        var query = _context.MaterialReceiptItems
            .Include(i => i.Material)
                .ThenInclude(m => m!.Category)
            .Include(i => i.MaterialReceipt)
                .ThenInclude(r => r!.Supplier)
            .Where(i => i.Material != null && i.MaterialReceipt != null)
            .AsQueryable();

        if (categoryId.HasValue) query = query.Where(i => i.Material!.CategoryId == categoryId.Value);
        if (fromDate.HasValue) query = query.Where(i => i.MaterialReceipt!.ReceiptDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(i => i.MaterialReceipt!.ReceiptDate <= toDate.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i =>
                i.Material!.MaterialCode.ToLower().Contains(s) ||
                i.Material.MaterialName.ToLower().Contains(s) ||
                (i.MaterialReceipt!.SupplierName != null && i.MaterialReceipt.SupplierName.ToLower().Contains(s)) ||
                (i.MaterialReceipt.InvoiceNumber != null && i.MaterialReceipt.InvoiceNumber.ToLower().Contains(s)));
        }

        var items = await query
            .OrderByDescending(i => i.MaterialReceipt!.ReceiptDate)
            .ThenByDescending(i => i.Id)
            .ToListAsync();

        var grouped = items
            .GroupBy(i => i.MaterialId)
            .Select(g =>
            {
                var mat = g.First().Material!;
                var stdRate = mat.StandardPrice;
                var orderedReceipts = g.OrderByDescending(x => x.MaterialReceipt!.ReceiptDate).ToList();
                var latestRate = orderedReceipts.FirstOrDefault()?.UnitPrice ?? stdRate;
                var minRate = g.Min(x => x.UnitPrice);
                var maxRate = g.Max(x => x.UnitPrice);

                return new
                {
                    MaterialId = mat.Id,
                    MaterialCode = mat.MaterialCode,
                    MaterialName = mat.MaterialName,
                    CategoryName = mat.Category?.Name ?? "GENERAL",
                    Uom = mat.DefaultUom ?? "KG",
                    StandardBaseRate = stdRate,
                    LatestRate = latestRate,
                    MinRate = minRate,
                    MaxRate = maxRate,
                    RateDeflection = latestRate - stdRate,
                    DeflectionPercentage = stdRate > 0 ? Math.Round((latestRate - stdRate) / stdRate * 100, 2) : 0,
                    TotalInwardQuantity = g.Sum(x => x.ReceivedQuantity),
                    TotalInwardAmount = g.Sum(x => x.TotalAmount),
                    InwardEntriesCount = g.Count(),
                    DayWiseRates = orderedReceipts.Select(x => new
                    {
                        x.Id,
                        ReceiptDate = x.MaterialReceipt!.ReceiptDate,
                        InvoiceNumber = x.MaterialReceipt.InvoiceNumber,
                        InvoiceDate = x.MaterialReceipt.InvoiceDate,
                        GrnNumber = x.MaterialReceipt.GrnNumber,
                        SupplierName = x.MaterialReceipt.Supplier?.SupplierName ?? x.MaterialReceipt.SupplierName,
                        InvoiceUnitRate = x.UnitPrice,
                        ReceivedQuantity = x.ReceivedQuantity,
                        TotalAmount = x.TotalAmount,
                        RateDeflection = x.UnitPrice - stdRate,
                        DeflectionPercentage = stdRate > 0 ? Math.Round((x.UnitPrice - stdRate) / stdRate * 100, 2) : 0
                    }).ToList()
                };
            })
            .OrderBy(x => x.MaterialCode)
            .ToList();

        return Ok(grouped);
    }

    [HttpGet("price-deflection-analysis")]
    public async Task<IActionResult> GetPriceDeflectionAnalysis([FromQuery] string? search, [FromQuery] int? categoryId)
    {
        var matQuery = _context.Materials
            .Include(m => m.Category)
            .Where(m => m.IsActive)
            .AsQueryable();

        if (categoryId.HasValue) matQuery = matQuery.Where(m => m.CategoryId == categoryId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            matQuery = matQuery.Where(m => m.MaterialCode.ToLower().Contains(s) || m.MaterialName.ToLower().Contains(s));
        }

        var materials = await matQuery.ToListAsync();

        // Get latest inward receipt for each material
        var latestReceiptItems = await _context.MaterialReceiptItems
            .Include(i => i.MaterialReceipt)
            .GroupBy(i => i.MaterialId)
            .Select(g => g.OrderByDescending(x => x.MaterialReceipt!.ReceiptDate).ThenByDescending(x => x.Id).FirstOrDefault())
            .ToDictionaryAsync(x => x!.MaterialId, x => x);

        var items = new List<object>();
        decimal totalMonthlyOverrun = 0;
        decimal totalMonthlySavings = 0;
        int deflectionsCount = 0;

        foreach (var m in materials)
        {
            var stdRate = m.StandardPrice;
            latestReceiptItems.TryGetValue(m.Id, out var latestItem);

            decimal invoiceRate = latestItem?.UnitPrice ?? (m.RevisedPrice > 0 ? m.RevisedPrice : stdRate);
            decimal deflection = invoiceRate - stdRate;
            decimal deflectionPct = stdRate > 0 ? (deflection / stdRate * 100) : 0;
            decimal monthlyReq = m.MonthlyRequirement;
            decimal monthlyBudgetEffect = deflection * monthlyReq;

            string status = "ON_BUDGET";
            if (deflection > 0.001m)
            {
                status = "OVERRUN";
                totalMonthlyOverrun += monthlyBudgetEffect;
                deflectionsCount++;
            }
            else if (deflection < -0.001m)
            {
                status = "SAVINGS";
                totalMonthlySavings += Math.Abs(monthlyBudgetEffect);
                deflectionsCount++;
            }

            items.Add(new
            {
                m.Id,
                m.MaterialCode,
                m.MaterialName,
                CategoryName = m.Category?.Name,
                Uom = m.DefaultUom,
                StandardBaseRate = stdRate,
                LatestInvoiceRate = invoiceRate,
                RateDeflection = Math.Round(deflection, 2),
                DeflectionPercentage = Math.Round(deflectionPct, 2),
                MonthlyRequirement = monthlyReq,
                MonthlyBudgetEffect = Math.Round(monthlyBudgetEffect, 2),
                Status = status,
                LatestInwardDate = latestItem?.MaterialReceipt?.ReceiptDate,
                LatestInvoiceNumber = latestItem?.MaterialReceipt?.InvoiceNumber,
                LatestSupplierName = latestItem?.MaterialReceipt?.SupplierName ?? m.PrimarySupplierName,
                LatestReceivedQty = latestItem?.ReceivedQuantity ?? 0,
                LatestBatchCostImpact = Math.Round(deflection * (latestItem?.ReceivedQuantity ?? 0), 2)
            });
        }

        var netBudgetImpact = totalMonthlyOverrun - totalMonthlySavings;

        return Ok(new
        {
            TotalMaterialsMonitored = materials.Count,
            TotalMaterialsWithDeflection = deflectionsCount,
            TotalMonthlyBudgetOverrun = Math.Round(totalMonthlyOverrun, 2),
            TotalMonthlyBudgetSavings = Math.Round(totalMonthlySavings, 2),
            NetMonthlyBudgetImpact = Math.Round(netBudgetImpact, 2),
            Materials = items
        });
    }
}

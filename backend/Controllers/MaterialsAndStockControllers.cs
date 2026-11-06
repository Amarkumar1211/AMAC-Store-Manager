using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;
using StoreManager.Api.Services;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MaterialsController : ControllerBase
{
    private readonly StoreDbContext _context;

    public MaterialsController(StoreDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] int? categoryId, [FromQuery] int? deptId)
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

        if (categoryId.HasValue) query = query.Where(m => m.CategoryId == categoryId.Value);
        if (deptId.HasValue) query = query.Where(m => m.UserDepartmentId == deptId.Value);

        var list = await query
            .OrderBy(m => m.MaterialCode)
            .Select(m => new
            {
                m.Id,
                m.MaterialCode,
                m.MaterialName,
                m.CategoryId,
                CategoryName = m.Category != null ? m.Category.Name : null,
                m.DefaultUom,
                m.ReorderLevel,
                m.MonthlyRequirement,
                m.UserDepartmentId,
                DepartmentName = m.UserDepartment != null ? m.UserDepartment.Name : null,
                m.StandardPrice,
                m.RevisedPrice,
                m.PrimarySupplierName,
                m.IsActive
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var m = await _context.Materials
            .Include(x => x.Category)
            .Include(x => x.UserDepartment)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (m == null) return NotFound();

        var supplierPrices = await _context.SupplierMaterialPrices
            .Include(p => p.Supplier)
            .Where(p => p.MaterialId == id)
            .Select(p => new
            {
                p.Id,
                p.SupplierId,
                SupplierName = p.Supplier != null ? p.Supplier.SupplierName : "N/A",
                p.Price,
                p.RevisedPrice,
                p.EffectiveDate,
                p.IsPreferred,
                p.Remarks
            })
            .ToListAsync();

        return Ok(new
        {
            m.Id,
            m.MaterialCode,
            m.MaterialName,
            m.CategoryId,
            CategoryName = m.Category?.Name,
            m.DefaultUom,
            m.ReorderLevel,
            m.MonthlyRequirement,
            m.UserDepartmentId,
            DepartmentName = m.UserDepartment?.Name,
            m.StandardPrice,
            m.RevisedPrice,
            m.PrimarySupplierName,
            m.IsActive,
            SupplierPrices = supplierPrices
        });
    }

    [Authorize(Roles = "Admin,StoreManager")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaterialDto dto)
    {
        if (await _context.Materials.AnyAsync(m => m.MaterialCode.ToLower() == dto.MaterialCode.Trim().ToLower()))
        {
            return BadRequest(new { message = $"Material code '{dto.MaterialCode}' already exists." });
        }

        var material = new Material
        {
            MaterialCode = dto.MaterialCode.Trim().ToUpper(),
            MaterialName = dto.MaterialName.Trim(),
            CategoryId = dto.CategoryId,
            DefaultUom = string.IsNullOrWhiteSpace(dto.DefaultUom) ? "KG" : dto.DefaultUom.Trim(),
            MinStockLevel = dto.MinStockLevel,
            ReorderLevel = dto.ReorderLevel,
            MaxStockLevel = dto.MaxStockLevel,
            MonthlyRequirement = dto.MonthlyRequirement,
            UserDepartmentId = dto.UserDepartmentId,
            StandardPrice = dto.StandardPrice,
            RevisedPrice = dto.RevisedPrice,
            PrimarySupplierName = dto.PrimarySupplierName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Materials.Add(material);
        await _context.SaveChangesAsync();

        // Process Initial Opening Stock if provided (> 0)
        var openingQty = dto.OpeningStock ?? 0;
        if (openingQty > 0)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            int.TryParse(userIdStr, out int userId);

            var ledger = new StockLedger
            {
                MaterialId = material.Id,
                TransactionDate = DateTime.UtcNow,
                TransactionType = TransactionType.Opening,
                ReferenceType = ReferenceType.OpeningBalance,
                ReferenceNumber = $"OPN-{material.MaterialCode}",
                QuantityIn = openingQty,
                QuantityOut = 0,
                UnitCost = material.StandardPrice,
                TotalCost = openingQty * material.StandardPrice,
                BalanceQuantityAfter = openingQty,
                Notes = $"Initial Opening Stock of {openingQty} {material.DefaultUom} upon SKU Creation",
                CreatedByUserId = userId > 0 ? userId : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.StockLedgers.Add(ledger);

            var adjustment = new StockAdjustment
            {
                AdjustmentNumber = $"OPN-{DateTime.UtcNow:yyyyMMdd}-{material.MaterialCode}",
                MaterialId = material.Id,
                AdjustmentDate = DateTime.UtcNow,
                AdjustmentType = AdjustmentType.PhysicalCountSurplus,
                SystemStock = 0,
                PhysicalStock = openingQty,
                AdjustmentQuantity = openingQty,
                Reason = "Initial Opening Stock recorded during Material Master creation",
                ApprovedByUserId = userId > 0 ? userId : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.StockAdjustments.Add(adjustment);
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetById), new { id = material.Id }, material);
    }

    [Authorize(Roles = "Admin,StoreManager")]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateMaterialDto dto)
    {
        var material = await _context.Materials.FindAsync(id);
        if (material == null) return NotFound();

        material.MaterialName = dto.MaterialName.Trim();
        material.CategoryId = dto.CategoryId;
        material.DefaultUom = dto.DefaultUom;
        material.MinStockLevel = dto.MinStockLevel;
        material.ReorderLevel = dto.ReorderLevel;
        material.MaxStockLevel = dto.MaxStockLevel;
        material.MonthlyRequirement = dto.MonthlyRequirement;
        material.UserDepartmentId = dto.UserDepartmentId;
        material.StandardPrice = dto.StandardPrice;
        material.RevisedPrice = dto.RevisedPrice;
        material.PrimarySupplierName = dto.PrimarySupplierName;
        material.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(material);
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var list = await _context.MaterialCategories.Where(c => c.IsActive).OrderBy(c => c.Name).ToListAsync();
        return Ok(list);
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var list = await _context.Departments.Where(d => d.IsActive).OrderBy(d => d.Name).ToListAsync();
        return Ok(list);
    }

    [HttpGet("colour-codes")]
    public async Task<IActionResult> GetColourCodes([FromQuery] string? search)
    {
        var query = _context.MaterialColourCodes.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.CustomerName.ToLower().Contains(s) || c.ModelNumber.ToLower().Contains(s) || c.MaterialGrade.ToLower().Contains(s));
        }
        var list = await query.OrderBy(c => c.CustomerName).ThenBy(c => c.ModelNumber).ToListAsync();
        return Ok(list);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StockController : ControllerBase
{
    private readonly IStockService _stockService;

    public StockController(IStockService stockService)
    {
        _stockService = stockService;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetStockSummary(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] int? deptId,
        [FromQuery] string? status)
    {
        var list = await _stockService.GetMaterialsStockSummaryAsync(search, categoryId, deptId, status);
        return Ok(list);
    }

    [HttpGet("ledger")]
    public async Task<IActionResult> GetLedger([FromQuery] int? materialId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
    {
        var list = await _stockService.GetStockLedgerAsync(materialId, fromDate, toDate);
        return Ok(list);
    }

    [Authorize(Roles = "Admin,StoreManager")]
    [HttpPost("adjustments")]
    public async Task<IActionResult> CreateAdjustment([FromBody] CreateStockAdjustmentDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        try
        {
            var adj = await _stockService.ProcessAdjustmentAsync(dto, userId);
            return Ok(new { message = "Stock adjustment applied successfully.", adjustmentNumber = adj.AdjustmentNumber });
        }
        catch (InvalidOperationException ex)
        {
            // Business logic errors are safe to surface (e.g. stock discrepancy)
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while processing the stock adjustment. Please try again or contact support." });
        }
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReceiptsController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IStockService _stockService;

    public ReceiptsController(StoreDbContext context, IStockService stockService)
    {
        _context = context;
        _stockService = stockService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] int? supplierId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? limit)
    {
        var query = _context.MaterialReceipts
            .Include(r => r.Supplier)
            .Include(r => r.Items)
                .ThenInclude(i => i.Material)
            .Include(r => r.ReceivedByUser)
            .AsQueryable();

        if (supplierId.HasValue)
        {
            var supp = await _context.Suppliers.FindAsync(supplierId.Value);
            var suppName = supp?.SupplierName;
            query = query.Where(r => r.SupplierId == supplierId.Value || (suppName != null && r.SupplierName == suppName));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r => r.GrnNumber.ToLower().Contains(s) || (r.SupplierName != null && r.SupplierName.ToLower().Contains(s)) || (r.InvoiceNumber != null && r.InvoiceNumber.ToLower().Contains(s)));
        }

        if (fromDate.HasValue) query = query.Where(r => r.ReceiptDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(r => r.ReceiptDate <= toDate.Value);

        var takeCount = limit.HasValue && limit.Value > 0 ? limit.Value : 100;

        var list = await query
            .OrderByDescending(r => r.ReceiptDate)
            .ThenByDescending(r => r.Id)
            .Take(takeCount)
            .ToListAsync();

        return Ok(list.Select(r => new
        {
            r.Id,
            r.GrnNumber,
            r.ReceiptDate,
            r.SupplierId,
            SupplierName = r.Supplier?.SupplierName ?? r.SupplierName,
            r.PoNumber,
            r.InvoiceNumber,
            r.InvoiceDate,
            r.DcNumber,
            r.VehicleNumber,
            r.TotalAmount,
            r.Remarks,
            r.Status,
            r.ApprovedAt,
            ReceivedBy = r.ReceivedByUser?.FullName,
            ItemCount = r.Items.Count
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var r = await _context.MaterialReceipts
            .Include(x => x.Supplier)
            .Include(x => x.ReceivedByUser)
            .Include(x => x.Items)
                .ThenInclude(i => i.Material)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (r == null) return NotFound();

        return Ok(new
        {
            r.Id,
            r.GrnNumber,
            r.ReceiptDate,
            r.SupplierId,
            SupplierName = r.Supplier?.SupplierName ?? r.SupplierName,
            r.PoNumber,
            r.InvoiceNumber,
            r.InvoiceDate,
            r.DcNumber,
            r.VehicleNumber,
            r.TotalAmount,
            r.Remarks,
            r.Status,
            r.ApprovedAt,
            ApprovedBy = r.ApprovedByUser?.FullName,
            ReceivedBy = r.ReceivedByUser?.FullName,
            Items = r.Items.Select(i => new
            {
                i.Id,
                i.MaterialId,
                MaterialCode = i.Material?.MaterialCode,
                MaterialName = i.Material?.MaterialName,
                Uom = i.Material?.DefaultUom,
                BatchNumber = i.BatchNumber,
                i.ReceivedQuantity,
                i.UnitPrice,
                i.TotalAmount,
                i.Remarks
            })
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,StoreManager,StoreUser")]
    public async Task<IActionResult> Create([FromBody] CreateReceiptDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        try
        {
            var receipt = await _stockService.ProcessReceiptAsync(dto, userId);
            return Ok(new { message = "Material receipt (GRN) created successfully.", grnNumber = receipt.GrnNumber, id = receipt.Id, totalAmount = receipt.TotalAmount });
        }
        catch (InvalidOperationException ex)
        {
            // Business logic errors are safe to surface (e.g. validation failures)
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while processing the GRN receipt. Please try again or contact support." });
        }
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin,StoreManager")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveReceiptDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);
        try
        {
            var receipt = await _stockService.ApproveReceiptAsync(id, userId, dto);
            return Ok(new { message = "GRN approved successfully.", grnNumber = receipt.GrnNumber });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin,StoreManager")]
    public async Task<IActionResult> Reject(int id)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);
        try
        {
            var receipt = await _stockService.RejectReceiptAsync(id, userId);
            return Ok(new { message = "GRN rejected successfully.", grnNumber = receipt.GrnNumber });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IssuesController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IStockService _stockService;

    public IssuesController(StoreDbContext context, IStockService stockService)
    {
        _context = context;
        _stockService = stockService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
    {
        var query = _context.MaterialIssues
            .Include(i => i.Department)
            .Include(i => i.IssuedByUser)
            .Include(i => i.Items)
                .ThenInclude(item => item.Material)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i => i.IssueSlipNumber.ToLower().Contains(s) || (i.SupervisorName != null && i.SupervisorName.ToLower().Contains(s)) || (i.Purpose != null && i.Purpose.ToLower().Contains(s)));
        }

        if (fromDate.HasValue) query = query.Where(i => i.IssueDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(i => i.IssueDate <= toDate.Value);

        var list = await query
            .OrderByDescending(i => i.IssueDate)
            .ThenByDescending(i => i.Id)
            .Take(100)
            .ToListAsync();

        return Ok(list.Select(i => new
        {
            i.Id,
            i.IssueSlipNumber,
            i.IssueDate,
            i.DepartmentId,
            DepartmentName = i.Department?.Name,
            i.SupervisorName,
            i.SupervisorSignature,
            i.Shift,
            i.Purpose,
            i.IssuedTo,
            i.TotalIssueCost,
            i.Remarks,
            IssuedBy = i.IssuedByUser?.FullName,
            ItemCount = i.Items.Count
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var issue = await _context.MaterialIssues
            .Include(x => x.Department)
            .Include(x => x.IssuedByUser)
            .Include(x => x.Items)
                .ThenInclude(item => item.Material)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (issue == null) return NotFound();

        return Ok(new
        {
            issue.Id,
            issue.IssueSlipNumber,
            issue.IssueDate,
            issue.DepartmentId,
            DepartmentName = issue.Department?.Name,
            issue.SupervisorName,
            issue.SupervisorSignature,
            issue.Shift,
            issue.Purpose,
            issue.IssuedTo,
            issue.TotalIssueCost,
            issue.Remarks,
            IssuedBy = issue.IssuedByUser?.FullName,
            Items = issue.Items.Select(item => new
            {
                item.Id,
                item.MaterialId,
                MaterialCode = item.Material?.MaterialCode,
                MaterialName = item.Material?.MaterialName,
                Uom = item.Material?.DefaultUom,
                BatchNumber = item.BatchNumber,
                item.RequestedQuantity,
                item.IssuedQuantity,
                item.UnitCost,
                item.TotalCost,
                item.Location,
                item.Remarks
            })
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,StoreManager,StoreUser")]
    public async Task<IActionResult> Create([FromBody] CreateIssueDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        try
        {
            var issue = await _stockService.ProcessIssueAsync(dto, userId);
            return Ok(new { message = "Material issue slip created successfully.", issueSlipNumber = issue.IssueSlipNumber, id = issue.Id });
        }
        catch (InvalidOperationException ex)
        {
            // Business logic errors are safe to surface (e.g. insufficient stock)
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while processing the material issue. Please try again or contact support." });
        }
    }
}

[ApiController]
[Route("api/projection-plan")]
[Authorize]
public class ProjectionPlanController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly IStockService _stockService;

    public ProjectionPlanController(StoreDbContext context, IStockService stockService)
    {
        _context = context;
        _stockService = stockService;
    }

    [HttpGet]
    public async Task<IActionResult> GetCurrentPlan([FromQuery] string? search, [FromQuery] int? categoryId)
    {
        var stockSummary = await _stockService.GetMaterialsStockSummaryAsync(search, categoryId);

        var totalPlannedMaterials = stockSummary.Count(m => m.MonthlyRequirement > 0);
        var totalProjectedQty = stockSummary.Sum(m => m.MonthlyRequirement);
        var totalProjectedCost = stockSummary.Sum(m => m.MonthlyRequirement * m.StandardPrice);

        var monthConfig = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == "ActiveProjectionMonth");
        var activeMonth = monthConfig?.Value ?? DateTime.Now.ToString("MMMM yyyy");

        var targetDaysConfig = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == "TargetDaysStock");
        int targetDays = (targetDaysConfig != null && int.TryParse(targetDaysConfig.Value, out var td) && td > 0) ? td : 22;

        return Ok(new
        {
            ActiveMonth = activeMonth,
            TargetDaysStock = targetDays,
            TotalMaterials = stockSummary.Count,
            TotalPlannedMaterials = totalPlannedMaterials,
            TotalProjectedQuantity = totalProjectedQty,
            TotalProjectedCost = totalProjectedCost,
            Items = stockSummary.Select(m => new
            {
                m.Id,
                m.MaterialCode,
                m.MaterialName,
                m.CategoryName,
                m.UserDepartmentName,
                m.DefaultUom,
                m.CurrentStock,
                m.MonthlyRequirement,
                m.StandardPrice,
                ProjectedCost = m.MonthlyRequirement * m.StandardPrice,
                DailyRequirementAverage = Math.Round(m.MonthlyRequirement / 30m, 2),
                TargetSafetyStock = Math.Round((m.MonthlyRequirement / 30m) * targetDays, 2),
                m.DaysOfStock,
                m.StockStatus
            }).ToList()
        });
    }

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate()
    {
        var materials = await _context.Materials
            .Include(m => m.Category)
            .Include(m => m.UserDepartment)
            .Where(m => m.IsActive)
            .OrderBy(m => m.MaterialCode)
            .ToListAsync();

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Monthly Projection Plan");

        ws.Cell(1, 1).Value = "ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5";
        ws.Cell(2, 1).Value = $"MONTHLY PRODUCTION & MATERIAL PROJECTION PLAN — {DateTime.Now:MMMM yyyy}";
        ws.Range(1, 1, 1, 7).Merge().Style.Font.SetBold().Font.SetFontSize(13).Fill.SetBackgroundColor(XLColor.FromArgb(15, 23, 42)).Font.SetFontColor(XLColor.White);
        ws.Range(2, 1, 2, 7).Merge().Style.Font.SetItalic().Fill.SetBackgroundColor(XLColor.FromArgb(30, 41, 59)).Font.SetFontColor(XLColor.LightGray);

        string[] headers = { "Material Code", "Material Description", "Category", "UOM", "Standard Price (₹)", "Current Monthly Requirement", "New Projected Requirement Qty" };
        for (int i = 0; i < headers.Length; i++)
        {
            ws.Cell(4, i + 1).Value = headers[i];
            ws.Cell(4, i + 1).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromArgb(79, 70, 229)).Font.SetFontColor(XLColor.White);
        }

        int row = 5;
        foreach (var m in materials)
        {
            ws.Cell(row, 1).Value = m.MaterialCode;
            ws.Cell(row, 2).Value = m.MaterialName;
            ws.Cell(row, 3).Value = m.Category?.Name ?? "GENERAL";
            ws.Cell(row, 4).Value = m.DefaultUom;
            ws.Cell(row, 5).Value = m.StandardPrice;
            ws.Cell(row, 6).Value = m.MonthlyRequirement;
            ws.Cell(row, 7).Value = m.MonthlyRequirement;

            row++;
        }

        ws.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"AMAC_Monthly_Projection_Plan_Template_{DateTime.Now:yyyyMM}.xlsx");
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadProjectionPlan(IFormFile? file, [FromForm] string? monthYear)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, message = "Please select a valid Excel spreadsheet file (.xlsx or .xls)." });
        }

        var planMonth = string.IsNullOrWhiteSpace(monthYear) ? DateTime.Now.ToString("MMMM yyyy") : monthYear.Trim();
        var username = User.Identity?.Name ?? "Admin";

        try
        {
            using var stream = file.OpenReadStream();
            using var workbook = new XLWorkbook(stream);

            IXLWorksheet? ws = null;
            foreach (var s in workbook.Worksheets)
            {
                var name = s.Name.ToLower();
                if (name.Contains("projection") || name.Contains("plan") || name.Contains("store stock") || name.Contains("requirement"))
                {
                    ws = s;
                    break;
                }
            }
            ws ??= workbook.Worksheet(1);

            int headerRowIndex = 1;
            int codeCol = -1;
            int descCol = -1;
            int reqCol = -1;

            for (int r = 1; r <= Math.Min(10, ws.RowCount()); r++)
            {
                for (int c = 1; c <= Math.Min(30, ws.ColumnCount()); c++)
                {
                    var text = ws.Cell(r, c).GetString().Trim().ToLower();
                    if (text.Contains("m-code") || text.Contains("material code") || text == "code" || text == "item code")
                    {
                        codeCol = c;
                        headerRowIndex = r;
                    }
                    if (text.Contains("material list") || text.Contains("material name") || text.Contains("description"))
                    {
                        descCol = c;
                    }
                    if (text.Contains("requirement") || text.Contains("projected") || text.Contains("monthly req") || text.Contains("month requirement") || text.Contains("plan qty"))
                    {
                        reqCol = c;
                    }
                }
                if (codeCol != -1 && reqCol != -1) break;
            }

            if (codeCol == -1) codeCol = 1;
            if (reqCol == -1)
            {
                reqCol = ws.ColumnCount() >= 8 ? 8 : (ws.ColumnCount() >= 7 ? 7 : 6);
            }

            var allMaterials = await _context.Materials.ToListAsync();
            var materialMap = allMaterials.ToDictionary(m => m.MaterialCode.Trim().ToLower(), m => m);

            int updatedCount = 0;
            decimal totalProjectedQty = 0;
            decimal totalProjectedCost = 0;
            var updatedCodes = new List<string>();

            int lastRow = ws.LastRowUsed()?.RowNumber() ?? ws.RowCount();
            for (int r = headerRowIndex + 1; r <= lastRow; r++)
            {
                var codeRaw = ws.Cell(r, codeCol).GetString().Trim();
                if (string.IsNullOrWhiteSpace(codeRaw) || codeRaw.ToLower() == "total") continue;

                var normalizedCode = codeRaw.ToLower();
                if (materialMap.TryGetValue(normalizedCode, out var mat))
                {
                    decimal reqQty = 0;
                    var cell = ws.Cell(r, reqCol);
                    if (cell.DataType == XLDataType.Number)
                    {
                        reqQty = (decimal)cell.GetDouble();
                    }
                    else
                    {
                        var str = cell.GetString().Replace(",", "").Trim();
                        decimal.TryParse(str, out reqQty);
                    }

                    if (reqQty < 0) reqQty = 0;

                    mat.MonthlyRequirement = reqQty;
                    mat.UpdatedAt = DateTime.UtcNow;

                    updatedCount++;
                    totalProjectedQty += reqQty;
                    totalProjectedCost += reqQty * mat.StandardPrice;
                    updatedCodes.Add(mat.MaterialCode);
                }
            }

            var monthCfg = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == "ActiveProjectionMonth");
            if (monthCfg != null)
            {
                monthCfg.Value = planMonth;
                monthCfg.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _context.SystemConfigurations.Add(new SystemConfiguration
                {
                    Key = "ActiveProjectionMonth",
                    Value = planMonth,
                    Description = "Currently Active Monthly Projection Plan Month",
                    UpdatedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                Action = "IMPORT",
                EntityName = "MonthlyProjectionPlan",
                RecordId = planMonth,
                Username = username,
                NewValues = $"Imported monthly projection plan for {planMonth}: {updatedCount} materials updated, total req: {totalProjectedQty:N2}, total budget: Rs.{totalProjectedCost:N2}",
                Timestamp = DateTime.UtcNow,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1"
            });
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                message = $"Successfully imported Monthly Projection Plan for {planMonth}!",
                planMonth = planMonth,
                updatedCount = updatedCount,
                totalProjectedQuantity = totalProjectedQty,
                totalProjectedCost = totalProjectedCost,
                updatedMaterialCodes = updatedCodes
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = "Failed to parse Excel projection plan. Please verify the file format and try again." });
        }
    }
}

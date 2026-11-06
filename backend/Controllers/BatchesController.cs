using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BatchesController : ControllerBase
{
    private readonly StoreDbContext _context;

    public BatchesController(StoreDbContext context)
    {
        _context = context;
    }

    [HttpGet("lookup")]
    public async Task<IActionResult> LookupBatch([FromQuery] int materialId, [FromQuery] string batchNumber)
    {
        if (string.IsNullOrWhiteSpace(batchNumber))
        {
            return BadRequest(new { message = "Batch number is required." });
        }

        var clean = batchNumber.Trim().ToLower();
        var batch = await _context.MaterialBatches
            .Include(b => b.Material)
            .FirstOrDefaultAsync(b => b.MaterialId == materialId && b.BatchNumber.ToLower() == clean);

        if (batch != null)
        {
            return Ok(new
            {
                exists = true,
                materialId = batch.MaterialId,
                materialCode = batch.Material?.MaterialCode ?? "",
                materialName = batch.Material?.MaterialName ?? "",
                batchNumber = batch.BatchNumber,
                unitPrice = batch.UnitPrice,
                currentStock = batch.CurrentStock,
                inwardQuantity = batch.InwardQuantity,
                issuedQuantity = batch.IssuedQuantity,
                totalValuation = batch.TotalValuation,
                lastSupplierName = batch.LastSupplierName,
                latestReceiptDate = batch.LatestReceiptDate
            });
        }

        // If not in MaterialBatches table, check recent receipt item history for fallback
        var pastReceipt = await _context.MaterialReceiptItems
            .Include(i => i.MaterialReceipt)
            .Where(i => i.MaterialId == materialId && i.BatchNumber != null && i.BatchNumber.ToLower() == clean)
            .OrderByDescending(i => i.Id)
            .FirstOrDefaultAsync();

        if (pastReceipt != null)
        {
            return Ok(new
            {
                exists = true,
                materialId = pastReceipt.MaterialId,
                materialCode = pastReceipt.Material?.MaterialCode ?? "",
                materialName = pastReceipt.Material?.MaterialName ?? "",
                batchNumber = pastReceipt.BatchNumber,
                unitPrice = pastReceipt.UnitPrice,
                currentStock = pastReceipt.ReceivedQuantity,
                inwardQuantity = pastReceipt.ReceivedQuantity,
                issuedQuantity = 0m,
                totalValuation = pastReceipt.TotalAmount,
                lastSupplierName = pastReceipt.MaterialReceipt?.SupplierName,
                latestReceiptDate = pastReceipt.MaterialReceipt?.ReceiptDate
            });
        }

        return Ok(new
        {
            exists = false,
            batchNumber = batchNumber.Trim().ToUpper(),
            unitPrice = 0m,
            currentStock = 0m
        });
    }

    [HttpGet("by-material/{materialId}")]
    public async Task<IActionResult> GetBatchesByMaterial(int materialId, [FromQuery] bool activeOnly = false)
    {
        var query = _context.MaterialBatches
            .Where(b => b.MaterialId == materialId && b.IsActive)
            .AsQueryable();

        if (activeOnly)
        {
            query = query.Where(b => b.CurrentStock > 0);
        }

        var batches = await query
            .OrderByDescending(b => b.LatestReceiptDate)
            .Select(b => new
            {
                b.Id,
                b.MaterialId,
                b.BatchNumber,
                b.UnitPrice,
                b.CurrentStock,
                b.InwardQuantity,
                b.IssuedQuantity,
                b.TotalValuation,
                b.LatestReceiptDate,
                b.LastSupplierName
            })
            .ToListAsync();

        return Ok(batches);
    }

    [HttpGet("ingot-register")]
    public async Task<IActionResult> GetIngotBatchRegister([FromQuery] string? search, [FromQuery] int? materialId)
    {
        var ingotQuery = _context.MaterialBatches
            .Include(b => b.Material)
                .ThenInclude(m => m!.Category)
            .AsQueryable();

        if (materialId.HasValue && materialId.Value > 0)
        {
            ingotQuery = ingotQuery.Where(b => b.MaterialId == materialId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            ingotQuery = ingotQuery.Where(b =>
                b.BatchNumber.ToLower().Contains(s) ||
                (b.Material != null && (b.Material.MaterialCode.ToLower().Contains(s) || b.Material.MaterialName.ToLower().Contains(s))) ||
                (b.LastSupplierName != null && b.LastSupplierName.ToLower().Contains(s)));
        }

        var list = await ingotQuery
            .OrderByDescending(b => b.LatestReceiptDate)
            .ToListAsync();

        var totalBatches = list.Count;
        var totalStock = list.Sum(b => b.CurrentStock);
        var totalValuation = list.Sum(b => b.TotalValuation);
        var avgRate = totalStock > 0 ? (totalValuation / totalStock) : (list.Count > 0 ? list.Average(b => b.UnitPrice) : 0);

        var items = list.Select(b => new
        {
            b.Id,
            b.MaterialId,
            MaterialCode = b.Material?.MaterialCode ?? "N/A",
            MaterialName = b.Material?.MaterialName ?? "N/A",
            CategoryName = b.Material?.Category?.Name ?? "INGOT",
            Uom = b.Material?.DefaultUom ?? "KG",
            b.BatchNumber,
            b.UnitPrice,
            b.InwardQuantity,
            b.IssuedQuantity,
            b.CurrentStock,
            b.TotalValuation,
            b.FirstReceiptDate,
            b.LatestReceiptDate,
            b.LastSupplierName,
            b.Remarks,
            Status = b.CurrentStock > 0 ? (b.CurrentStock <= 500 ? "Low Stock" : "In Stock") : "Depleted"
        }).ToList();

        return Ok(new
        {
            summary = new
            {
                totalBatches,
                totalStock,
                totalValuation,
                averageRate = Math.Round(avgRate, 2)
            },
            items
        });
    }

    [HttpGet("ingot-register/excel")]
    public async Task<IActionResult> ExportIngotBatchRegisterExcel([FromQuery] string? search, [FromQuery] int? materialId)
    {
        var ingotQuery = _context.MaterialBatches
            .Include(b => b.Material)
                .ThenInclude(m => m!.Category)
            .AsQueryable();

        if (materialId.HasValue && materialId.Value > 0)
        {
            ingotQuery = ingotQuery.Where(b => b.MaterialId == materialId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            ingotQuery = ingotQuery.Where(b =>
                b.BatchNumber.ToLower().Contains(s) ||
                (b.Material != null && (b.Material.MaterialCode.ToLower().Contains(s) || b.Material.MaterialName.ToLower().Contains(s))));
        }

        var list = await ingotQuery.OrderByDescending(b => b.LatestReceiptDate).ToListAsync();

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Ingot Batch Register");

        // Brand Banner
        ws.Cell("A1").Value = "ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5";
        ws.Range("A1:K1").Merge();
        ws.Range("A1:K1").Style.Font.Bold = true;
        ws.Range("A1:K1").Style.Font.FontSize = 14;
        ws.Range("A1:K1").Style.Fill.BackgroundColor = XLColor.FromHtml("#0f172a");
        ws.Range("A1:K1").Style.Font.FontColor = XLColor.White;
        ws.Range("A1:K1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        ws.Cell("A2").Value = "INGOT BATCH-WISE VALUATION, AUTO-PRICING & STOCK TRACEABILITY REGISTER";
        ws.Range("A2:K2").Merge();
        ws.Range("A2:K2").Style.Font.Bold = true;
        ws.Range("A2:K2").Style.Font.FontSize = 11;
        ws.Range("A2:K2").Style.Fill.BackgroundColor = XLColor.FromHtml("#0284c7");
        ws.Range("A2:K2").Style.Font.FontColor = XLColor.White;
        ws.Range("A2:K2").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        // KPI Summary
        var totalStock = list.Sum(b => b.CurrentStock);
        var totalValuation = list.Sum(b => b.TotalValuation);
        var avgRate = totalStock > 0 ? (totalValuation / totalStock) : 0;

        ws.Cell("A4").Value = "Total Ingot Batches:";
        ws.Cell("B4").Value = list.Count;
        ws.Cell("D4").Value = "Total Ingot Stock (KG):";
        ws.Cell("E4").Value = totalStock;
        ws.Cell("G4").Value = "Total Batch Valuation (₹):";
        ws.Cell("H4").Value = totalValuation;
        ws.Cell("J4").Value = "Weighted Avg Rate (₹/KG):";
        ws.Cell("K4").Value = Math.Round(avgRate, 2);
        ws.Range("A4:K4").Style.Font.Bold = true;

        // Table Headers
        var headers = new[]
        {
            "Material Code", "Ingot Description", "Category", "Batch / Heat Code",
            "Batch Rate (₹/KG)", "Inward Qty (KG)", "Issued Qty (KG)", "Current Stock (KG)",
            "Batch Valuation (₹)", "Last Supply Date", "Primary / Last Supplier"
        };

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(6, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1e293b");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        int row = 7;
        foreach (var b in list)
        {
            ws.Cell(row, 1).Value = b.Material?.MaterialCode ?? "N/A";
            ws.Cell(row, 2).Value = b.Material?.MaterialName ?? "N/A";
            ws.Cell(row, 3).Value = b.Material?.Category?.Name ?? "INGOT";
            ws.Cell(row, 4).Value = b.BatchNumber;
            ws.Cell(row, 5).Value = b.UnitPrice;
            ws.Cell(row, 6).Value = b.InwardQuantity;
            ws.Cell(row, 7).Value = b.IssuedQuantity;
            ws.Cell(row, 8).Value = b.CurrentStock;
            ws.Cell(row, 9).Value = b.TotalValuation;
            ws.Cell(row, 10).Value = b.LatestReceiptDate.ToString("dd-MMM-yyyy");
            ws.Cell(row, 11).Value = b.LastSupplierName ?? "N/A";

            // Formatting
            ws.Cell(row, 5).Style.NumberFormat.Format = "₹#,##0.00";
            ws.Cell(row, 6).Style.NumberFormat.Format = "#,##0.00";
            ws.Cell(row, 7).Style.NumberFormat.Format = "#,##0.00";
            ws.Cell(row, 8).Style.NumberFormat.Format = "#,##0.00";
            ws.Cell(row, 9).Style.NumberFormat.Format = "₹#,##0.00";

            row++;
        }

        ws.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var content = stream.ToArray();
        return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"AMAC_Ingot_Batch_Register_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }
}

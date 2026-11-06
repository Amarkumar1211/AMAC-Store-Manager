using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public interface IMasterDataImportService
{
    Task<byte[]> GenerateMasterTemplateAsync();
    Task<MasterImportPreviewDto> PreviewMasterDataAsync(Stream fileStream);
    Task<MasterImportResultDto> ImportMasterDataAsync(Stream fileStream, int userId, string username, string ipAddress, bool resetExistingFirst);
}

public record MasterImportPreviewDto(
    bool IsValid,
    int SheetCount,
    List<string> SheetNames,
    int DetectedMaterialsCount,
    int DetectedSuppliersCount,
    int DetectedDepartmentsCount,
    int DetectedReceiptsCount,
    int DetectedIssuesCount,
    int DetectedProjectionsCount,
    decimal TotalOpeningStockValue,
    List<string> Warnings,
    List<string> Errors
);

public record MasterImportResultDto(
    bool Success,
    string Message,
    int DepartmentsCreated,
    int SuppliersCreated,
    int MaterialsUpserted,
    int ReceiptsCreated,
    int IssuesCreated,
    int ProjectionsCreated,
    int BatchesCreated,
    decimal TotalOpeningStockValuation,
    List<string> Logs,
    List<string> Warnings
);

public class MasterDataImportService : IMasterDataImportService
{
    private readonly StoreDbContext _context;
    private readonly ISystemResetService _resetService;
    private readonly ILogger<MasterDataImportService> _logger;

    public MasterDataImportService(
        StoreDbContext context,
        ISystemResetService resetService,
        ILogger<MasterDataImportService> logger)
    {
        _context = context;
        _resetService = resetService;
        _logger = logger;
    }

    public Task<byte[]> GenerateMasterTemplateAsync()
    {
        using var workbook = new XLWorkbook();

        // -------------------------------------------------------------
        // SHEET 1: MATERIAL MASTER & OPENING STOCK
        // -------------------------------------------------------------
        var matSheet = workbook.Worksheets.Add("1. Material Master & Stock");
        matSheet.TabColor = XLColor.FromHtml("#059669");

        string[] matHeaders = {
            "Material Code *", "Material Name *", "Category *", "UOM *", "Standard Price (Rs) *",
            "Opening Stock / Current Stock", "Minimum Level", "Maximum Level", "Reorder Level",
            "User Department", "Primary Supplier", "Storage Location / Bin", "Lead Time (Days)", "Description / Specs"
        };

        for (int i = 0; i < matHeaders.Length; i++)
        {
            var cell = matSheet.Cell(1, i + 1);
            cell.Value = matHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#059669");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[,] sampleMaterials = {
            { "M001", "LM24 Aluminium Ingot", "Raw Material", "KG", 425.00, 3500.00, 500, 10000, 2000, "HPDC Casting Shop", "Hindalco Industries Ltd", "Bay A-01", 7, "Standard Die Casting Alloy" },
            { "M002", "AC2A Aluminium Ingot", "Raw Material", "KG", 450.00, 2200.00, 400, 8000, 1500, "HPDC Casting Shop", "Supreme Metals Ltd", "Bay A-02", 7, "High Purity Heat-Treated Ingot" },
            { "M005", "ALSI9CU3 Aluminium Ingot", "Raw Material", "KG", 420.00, 4100.00, 600, 12000, 2500, "Gravity Die Casting", "Vedanta Aluminium Division", "Bay A-03", 5, "Structural Casting Grade" },
            { "M012", "Resin Coated Sand 55 AFS", "Foundry Sand", "KG", 90.00, 7500.00, 1000, 20000, 4000, "Core Shop Division", "Silica Minerals India", "Silo-1", 3, "Fine Core Shell Sand" },
            { "M019", "Phenolic Cold Box Resin Part-A", "Chemicals", "KG", 245.00, 1200.00, 200, 4000, 800, "Core Shop Division", "Garg Resins Pvt Ltd", "Chem Rack-2", 4, "High Binder Strength" },
            { "M046", "Hydraulic Oil Servo 46", "Spares & Oils", "LTR", 210.00, 450.00, 50, 1500, 200, "Plant Maintenance", "Indian Oil Corporation", "Oil Room B", 2, "Machine Hydraulic Fluid" }
        };

        for (int r = 0; r < sampleMaterials.GetLength(0); r++)
        {
            for (int c = 0; c < sampleMaterials.GetLength(1); c++)
            {
                matSheet.Cell(r + 2, c + 1).Value = sampleMaterials[r, c]?.ToString() ?? "";
            }
        }
        matSheet.Columns().AdjustToContents();

        // -------------------------------------------------------------
        // SHEET 2: SUPPLIERS & VENDORS
        // -------------------------------------------------------------
        var suppSheet = workbook.Worksheets.Add("2. Suppliers & Vendors");
        suppSheet.TabColor = XLColor.FromHtml("#1e40af");

        string[] suppHeaders = {
            "Supplier Code", "Supplier Name *", "Contact Person", "Phone Number", "Email Address", "GST Number", "Office / Factory Address", "Payment Terms"
        };

        for (int i = 0; i < suppHeaders.Length; i++)
        {
            var cell = suppSheet.Cell(1, i + 1);
            cell.Value = suppHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1e40af");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[,] sampleSuppliers = {
            { "SUP-001", "Hindalco Industries Ltd", "Rajesh Kumar", "9876543210", "sales@hindalco.com", "29AABCH1234F1Z5", "Plot 12, Industrial Area, Bangalore", "30 Days Credit" },
            { "SUP-002", "Supreme Metals Ltd", "Vikas Patel", "9845123456", "contact@suprememetals.in", "29AACCS4455E1Z8", "Phase 2, Peenya Industrial Area, Bangalore", "Immediate / Advance" },
            { "SUP-003", "Silica Minerals India", "Sunil Gowda", "9900112233", "orders@silicaminerals.com", "29AABCS8899K1Z2", "Sompura Industrial Zone, Dabspet", "15 Days Credit" },
            { "SUP-004", "Garg Resins Pvt Ltd", "Amit Garg", "9741234567", "info@gargresins.com", "29AABCG3322D1Z9", "Bommasandra Industrial Area, Bangalore", "30 Days Credit" },
            { "SUP-005", "Indian Oil Corporation", "Regional Depot", "18002333555", "commercial@indianoil.in", "29AAACI1681G1ZM", "Devanagonthi Terminal, Bangalore", "Advance RTGS" }
        };

        for (int r = 0; r < sampleSuppliers.GetLength(0); r++)
        {
            for (int c = 0; c < sampleSuppliers.GetLength(1); c++)
            {
                suppSheet.Cell(r + 2, c + 1).Value = sampleSuppliers[r, c]?.ToString() ?? "";
            }
        }
        suppSheet.Columns().AdjustToContents();

        // -------------------------------------------------------------
        // SHEET 3: DEPARTMENTS & SUPERVISORS
        // -------------------------------------------------------------
        var deptSheet = workbook.Worksheets.Add("3. Departments & Supervisors");
        deptSheet.TabColor = XLColor.FromHtml("#7c3aed");

        string[] deptHeaders = {
            "Department Code", "Department Name *", "Supervisor Name *", "Supervisor Contact", "Description / Section"
        };

        for (int i = 0; i < deptHeaders.Length; i++)
        {
            var cell = deptSheet.Cell(1, i + 1);
            cell.Value = deptHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[,] sampleDepts = {
            { "DEPT-HPDC", "HPDC Casting Shop", "R. Sharma", "9606082298", "High Pressure Die Casting Cell 1 & 2" },
            { "DEPT-CORE", "Core Shop Division", "V. Patel", "9606082299", "Cold Box & Shell Core Production" },
            { "DEPT-GDC", "Gravity Die Casting", "K. Singh", "9606082300", "Gravity Tilt-Pouring Section" },
            { "DEPT-MAINT", "Plant Maintenance", "M. Suresh", "9606082301", "Mechanical, Electrical & Hydraulics" },
            { "DEPT-STORE", "Stores & Logistics", "B. Ramesh", "9606082302", "Inward Receipt, Binning & Dispatch" }
        };

        for (int r = 0; r < sampleDepts.GetLength(0); r++)
        {
            for (int c = 0; c < sampleDepts.GetLength(1); c++)
            {
                deptSheet.Cell(r + 2, c + 1).Value = sampleDepts[r, c]?.ToString() ?? "";
            }
        }
        deptSheet.Columns().AdjustToContents();

        // -------------------------------------------------------------
        // SHEET 4: RECEIVED INWARDS (GRN)
        // -------------------------------------------------------------
        var grnSheet = workbook.Worksheets.Add("4. Received Inwards (GRN)");
        grnSheet.TabColor = XLColor.FromHtml("#047857");

        string[] grnHeaders = {
            "GRN Number", "Receipt Date (YYYY-MM-DD) *", "Supplier Name *", "Invoice Number",
            "Invoice Date (YYYY-MM-DD)", "PO Number", "Material Code *", "Batch / Heat Code",
            "Received Quantity *", "Unit Price (Rs) *", "Vehicle Number", "Remarks"
        };

        for (int i = 0; i < grnHeaders.Length; i++)
        {
            var cell = grnSheet.Cell(1, i + 1);
            cell.Value = grnHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#047857");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[,] sampleGrns = {
            { "GRN-2026-0001", "2026-08-01", "Hindalco Industries Ltd", "INV-9921", "2026-08-01", "PO-8812", "M001", "23aa", 3000, 425.00, "KA-04-AB-1234", "Invoice INV-9921 Line 1 (LM24 Ingot)" },
            { "GRN-2026-0001", "2026-08-01", "Hindalco Industries Ltd", "INV-9921", "2026-08-01", "PO-8812", "M002", "24aa", 1500, 450.00, "KA-04-AB-1234", "Invoice INV-9921 Line 2 (AC2A Ingot)" },
            { "GRN-2026-0001", "2026-08-01", "Hindalco Industries Ltd", "INV-9921", "2026-08-01", "PO-8812", "M005", "HT-88", 2000, 420.00, "KA-04-AB-1234", "Invoice INV-9921 Line 3 (ALSI9 Ingot)" },
            { "GRN-2026-0002", "2026-08-03", "Silica Minerals India", "INV-3142", "2026-08-03", "PO-8820", "M012", "", 4500, 90.00, "KA-04-MN-5544", "Single item silica sand invoice" },
            { "GRN-2026-0003", "2026-08-05", "Garg Resins Pvt Ltd", "INV-5510", "2026-08-05", "PO-8825", "M019", "", 800, 245.00, "KA-04-PQ-1122", "Drum seals verified intact" }
        };

        for (int r = 0; r < sampleGrns.GetLength(0); r++)
        {
            for (int c = 0; c < sampleGrns.GetLength(1); c++)
            {
                grnSheet.Cell(r + 2, c + 1).Value = sampleGrns[r, c]?.ToString() ?? "";
            }
        }
        grnSheet.Columns().AdjustToContents();

        // -------------------------------------------------------------
        // SHEET 5: MATERIAL ISSUES
        // -------------------------------------------------------------
        var issSheet = workbook.Worksheets.Add("5. Material Issues");
        issSheet.TabColor = XLColor.FromHtml("#d97706");

        string[] issHeaders = {
            "Issue Slip Number", "Issue Date (YYYY-MM-DD) *", "Department Name *", "Supervisor / Indentor *",
            "Material Code *", "Batch / Heat Code", "Issued Quantity *", "Unit Rate (Rs)", "Shift", "Purpose", "Remarks"
        };

        for (int i = 0; i < issHeaders.Length; i++)
        {
            var cell = issSheet.Cell(1, i + 1);
            cell.Value = issHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#d97706");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[,] sampleIssues = {
            { "IS-2026-0801", "2026-08-02", "HPDC Casting Shop", "R. Sharma", "M001", "23aa", 800, 425.00, "Shift A", "Daily engine block casting heat", "Issue Slip 0801 Line 1 (Ingot)" },
            { "IS-2026-0801", "2026-08-02", "HPDC Casting Shop", "R. Sharma", "M019", "", 50, 245.00, "Shift A", "Daily engine block casting heat", "Issue Slip 0801 Line 2 (Resin)" },
            { "IS-2026-0801", "2026-08-02", "HPDC Casting Shop", "R. Sharma", "M046", "", 20, 210.00, "Shift A", "Daily engine block casting heat", "Issue Slip 0801 Line 3 (Hydraulic Oil)" },
            { "IS-2026-0802", "2026-08-04", "Core Shop Division", "V. Patel", "M012", "", 1200, 90.00, "Shift B", "Core manufacturing for water jackets", "Regular core sand issue" }
        };

        for (int r = 0; r < sampleIssues.GetLength(0); r++)
        {
            for (int c = 0; c < sampleIssues.GetLength(1); c++)
            {
                issSheet.Cell(r + 2, c + 1).Value = sampleIssues[r, c]?.ToString() ?? "";
            }
        }
        issSheet.Columns().AdjustToContents();

        // -------------------------------------------------------------
        // SHEET 6: MONTHLY PROJECTIONS
        // -------------------------------------------------------------
        var projSheet = workbook.Worksheets.Add("6. Monthly Projections");
        projSheet.TabColor = XLColor.FromHtml("#0d9488");

        string[] projHeaders = {
            "Month Year (e.g. August 2026) *", "Material Code *", "Monthly Requirement Qty *", "Target Safety Stock", "Production Target Notes"
        };

        for (int i = 0; i < projHeaders.Length; i++)
        {
            var cell = projSheet.Cell(1, i + 1);
            cell.Value = projHeaders[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0d9488");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        object[,] sampleProjections = {
            { "August 2026", "M001", 10000, 7333, "Target 45,000 HPDC engine housing castings" },
            { "August 2026", "M002", 9000, 6600, "Special high-heat casting runs" },
            { "August 2026", "M005", 8000, 5866, "Structural gravity casting components" },
            { "August 2026", "M012", 12000, 8800, "Core shop continuous production plan" },
            { "August 2026", "M019", 2500, 1833, "Binder consumption target for month" },
            { "August 2026", "M046", 500, 366, "Planned hydraulic fluid top-up" }
        };

        for (int r = 0; r < sampleProjections.GetLength(0); r++)
        {
            for (int c = 0; c < sampleProjections.GetLength(1); c++)
            {
                projSheet.Cell(r + 2, c + 1).Value = sampleProjections[r, c]?.ToString() ?? "";
            }
        }
        projSheet.Columns().AdjustToContents();

        // -------------------------------------------------------------
        // SHEET 7: INSTRUCTIONS & GUIDELINES
        // -------------------------------------------------------------
        var guideSheet = workbook.Worksheets.Add("7. Instructions & Guidelines");
        guideSheet.TabColor = XLColor.FromHtml("#475569");

        guideSheet.Cell(1, 1).Value = "AMAC UNIT-5: MASTER EXCEL DATA IMPORT GUIDE";
        guideSheet.Cell(1, 1).Style.Font.Bold = true;
        guideSheet.Cell(1, 1).Style.Font.FontSize = 14;
        guideSheet.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#0f172a");

        string[] guideLines = {
            "1. MANDATORY FIELDS: Columns marked with an asterisk (*) are strictly required.",
            "2. SHEET 1 (Material Master & Stock): Enter your complete list of SKUs. The 'Opening Stock' will be automatically seeded into live stock & recorded in the audit stock ledger.",
            "3. SHEET 2 (Suppliers & Vendors): List all registered vendors. If a supplier is mentioned in Sheet 1 or Sheet 4, it will automatically link or be created if missing.",
            "4. SHEET 3 (Departments & Supervisors): Used for material allocation and issue indents.",
            "5. SHEET 4 (Received Inwards - GRN): Add past or current goods receipts. For ingots, include 'Batch / Heat Code' (e.g. 23aa, 24aa) to activate auto-pricing memory.",
            "6. SHEET 5 (Material Issues): Record store consumption slips to deduct from stock and populate department consumption reports.",
            "7. SHEET 6 (Monthly Projections): Defines monthly requirement quotas and buffer thresholds for predictive shortage alerts.",
            "8. DATES: Use standard YYYY-MM-DD format (e.g., 2026-08-01) or Excel Date cells.",
            "9. NUMBERS: Do not include currency symbols (Rs. or $) in price or quantity cells.",
            "10. MULTIPLE MATERIALS IN ONE INVOICE (GRN): If one supplier invoice contains multiple items, enter each material on a new row with the SAME 'GRN Number', 'Supplier Name', and 'Invoice Number'. The system will automatically combine them into ONE single GRN document with multiple item lines and calculate the grand total invoice valuation automatically.",
            "11. MULTIPLE MATERIALS IN ONE ISSUE SLIP: If one issue indent/slip contains multiple materials, enter each material on a new row with the SAME 'Issue Slip Number', 'Department Name', and 'Supervisor'. The system will automatically combine them into ONE single Issue Slip document with multiple item lines."
        };

        for (int i = 0; i < guideLines.Length; i++)
        {
            guideSheet.Cell(i + 3, 1).Value = guideLines[i];
            guideSheet.Cell(i + 3, 1).Style.Font.FontSize = 10;
        }
        guideSheet.Columns().AdjustToContents();

        using var memoryStream = new MemoryStream();
        workbook.SaveAs(memoryStream);
        return Task.FromResult(memoryStream.ToArray());
    }

    public Task<MasterImportPreviewDto> PreviewMasterDataAsync(Stream fileStream)
    {
        var warnings = new List<string>();
        var errors = new List<string>();

        try
        {
            using var workbook = new XLWorkbook(fileStream);
            var sheetNames = workbook.Worksheets.Select(w => w.Name).ToList();

            int materialsCount = 0;
            decimal totalOpeningValuation = 0;
            var matSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Material", StringComparison.OrdinalIgnoreCase));
            if (matSheet != null)
            {
                int lastRow = matSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var code = matSheet.Cell(r, 1).GetString().Trim();
                    var name = matSheet.Cell(r, 2).GetString().Trim();
                    if (!string.IsNullOrEmpty(code) && !string.IsNullOrEmpty(name))
                    {
                        materialsCount++;
                        decimal stock = GetDecimalValue(matSheet.Cell(r, 6));
                        decimal price = GetDecimalValue(matSheet.Cell(r, 5));
                        totalOpeningValuation += (stock * price);
                    }
                }
            }
            else
            {
                warnings.Add("Worksheet for 'Material Master' not detected.");
            }

            int suppliersCount = 0;
            var suppSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Supplier", StringComparison.OrdinalIgnoreCase) || w.Name.Contains("Vendor", StringComparison.OrdinalIgnoreCase));
            if (suppSheet != null)
            {
                int lastRow = suppSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var name = suppSheet.Cell(r, 2).GetString().Trim();
                    if (!string.IsNullOrEmpty(name)) suppliersCount++;
                }
            }

            int deptCount = 0;
            var deptSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Department", StringComparison.OrdinalIgnoreCase));
            if (deptSheet != null)
            {
                int lastRow = deptSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var name = deptSheet.Cell(r, 2).GetString().Trim();
                    if (!string.IsNullOrEmpty(name)) deptCount++;
                }
            }

            int receiptsCount = 0;
            var grnSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Received", StringComparison.OrdinalIgnoreCase) || w.Name.Contains("GRN", StringComparison.OrdinalIgnoreCase) || w.Name.Contains("Inward", StringComparison.OrdinalIgnoreCase));
            if (grnSheet != null)
            {
                int lastRow = grnSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var matCode = grnSheet.Cell(r, 7).GetString().Trim();
                    if (!string.IsNullOrEmpty(matCode)) receiptsCount++;
                }
            }

            int issuesCount = 0;
            var issSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Issue", StringComparison.OrdinalIgnoreCase));
            if (issSheet != null)
            {
                int lastRow = issSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var matCode = issSheet.Cell(r, 5).GetString().Trim();
                    if (!string.IsNullOrEmpty(matCode)) issuesCount++;
                }
            }

            int projCount = 0;
            var projSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Projection", StringComparison.OrdinalIgnoreCase));
            if (projSheet != null)
            {
                int lastRow = projSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var matCode = projSheet.Cell(r, 2).GetString().Trim();
                    if (!string.IsNullOrEmpty(matCode)) projCount++;
                }
            }

            return Task.FromResult(new MasterImportPreviewDto(
                IsValid: true,
                SheetCount: sheetNames.Count,
                SheetNames: sheetNames,
                DetectedMaterialsCount: materialsCount,
                DetectedSuppliersCount: suppliersCount,
                DetectedDepartmentsCount: deptCount,
                DetectedReceiptsCount: receiptsCount,
                DetectedIssuesCount: issuesCount,
                DetectedProjectionsCount: projCount,
                TotalOpeningStockValue: totalOpeningValuation,
                Warnings: warnings,
                Errors: errors
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error previewing Master Excel workbook");
            return Task.FromResult(new MasterImportPreviewDto(
                IsValid: false,
                SheetCount: 0,
                SheetNames: new(),
                0, 0, 0, 0, 0, 0, 0,
                new List<string>(),
                new List<string> { "Failed to parse Excel file. Please verify the file format." }
            ));
        }
    }

    public async Task<MasterImportResultDto> ImportMasterDataAsync(
        Stream fileStream,
        int userId,
        string username,
        string ipAddress,
        bool resetExistingFirst)
    {
        var logs = new List<string>();
        var warnings = new List<string>();

        if (resetExistingFirst)
        {
            logs.Add("Executing full clean factory reset prior to data seeding...");
            var resetRes = await _resetService.ExecuteMasterResetAsync(
                new MasterResetRequest("FACTORY_RESET", "RESET ALL DATA", null),
                userId,
                ipAddress
            );
            if (!resetRes.Success)
            {
                return new MasterImportResultDto(false, $"Factory reset failed: {resetRes.Message}", 0, 0, 0, 0, 0, 0, 0, 0, logs, warnings);
            }
            logs.Add("Database cleanly reset.");
        }

        using var workbook = new XLWorkbook(fileStream);

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            int deptsCreated = 0;
            int suppsCreated = 0;
            int materialsUpserted = 0;
            int receiptsCreated = 0;
            int issuesCreated = 0;
            int projCreated = 0;
            int batchesCreated = 0;
            decimal totalOpeningValuation = 0;

            var runningStock = new Dictionary<int, decimal>();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
            // -------------------------------------------------------------
            // 1. INGEST DEPARTMENTS & SUPERVISORS
            // -------------------------------------------------------------
            var deptSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Department", StringComparison.OrdinalIgnoreCase));
            var departmentMap = (await _context.Departments.ToListAsync())
                .ToDictionary(d => d.Name.Trim().ToLower(), d => d);

            if (deptSheet != null)
            {
                int lastRow = deptSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var code = deptSheet.Cell(r, 1).GetString().Trim();
                    var name = deptSheet.Cell(r, 2).GetString().Trim();
                    if (string.IsNullOrEmpty(name)) continue;

                    var key = name.ToLower();
                    if (!departmentMap.TryGetValue(key, out var dept))
                    {
                        dept = new Department
                        {
                            Name = name,
                            Code = string.IsNullOrEmpty(code) ? $"DEPT-{name.Substring(0, Math.Min(4, name.Length)).ToUpper()}" : code,
                            IsActive = true
                        };
                        _context.Departments.Add(dept);
                        await _context.SaveChangesAsync();
                        departmentMap[key] = dept;
                        deptsCreated++;
                    }
                }
            }

            // -------------------------------------------------------------
            // 2. INGEST SUPPLIERS & VENDORS
            // -------------------------------------------------------------
            var suppSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Supplier", StringComparison.OrdinalIgnoreCase) || w.Name.Contains("Vendor", StringComparison.OrdinalIgnoreCase));
            var supplierMap = (await _context.Suppliers.ToListAsync())
                .ToDictionary(s => s.SupplierName.Trim().ToLower(), s => s);

            if (suppSheet != null)
            {
                int lastRow = suppSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var suppName = suppSheet.Cell(r, 2).GetString().Trim();
                    if (string.IsNullOrEmpty(suppName)) continue;

                    var key = suppName.ToLower();
                    if (!supplierMap.TryGetValue(key, out var supp))
                    {
                        supp = new Supplier
                        {
                            SupplierName = suppName,
                            ContactPerson = suppSheet.Cell(r, 3).GetString().Trim(),
                            Phone = suppSheet.Cell(r, 4).GetString().Trim(),
                            Email = suppSheet.Cell(r, 5).GetString().Trim(),
                            GstNumber = suppSheet.Cell(r, 6).GetString().Trim(),
                            Address = suppSheet.Cell(r, 7).GetString().Trim(),
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.Suppliers.Add(supp);
                        await _context.SaveChangesAsync();
                        supplierMap[key] = supp;
                        suppsCreated++;
                    }
                }
            }

            // -------------------------------------------------------------
            // 3. INGEST MATERIAL CATEGORIES & MATERIALS
            // -------------------------------------------------------------
            var catMap = (await _context.MaterialCategories.ToListAsync())
                .ToDictionary(c => c.Name.Trim().ToLower(), c => c);

            var matSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Material", StringComparison.OrdinalIgnoreCase));
            var materialMap = (await _context.Materials.ToListAsync())
                .ToDictionary(m => m.MaterialCode.Trim().ToLower(), m => m);

            if (matSheet != null)
            {
                int lastRow = matSheet.LastRowUsed()?.RowNumber() ?? 0;
                for (int r = 2; r <= lastRow; r++)
                {
                    var code = matSheet.Cell(r, 1).GetString().Trim();
                    var name = matSheet.Cell(r, 2).GetString().Trim();
                    var catName = matSheet.Cell(r, 3).GetString().Trim();
                    var uom = matSheet.Cell(r, 4).GetString().Trim();

                    if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(name)) continue;

                    if (string.IsNullOrEmpty(uom)) uom = "KG";
                    if (string.IsNullOrEmpty(catName)) catName = "Raw Material";

                    // Ensure Category
                    var catKey = catName.ToLower();
                    if (!catMap.TryGetValue(catKey, out var cat))
                    {
                        cat = new MaterialCategory
                        {
                            Name = catName,
                            Description = $"{catName} Category",
                            IsActive = true
                        };
                        _context.MaterialCategories.Add(cat);
                        await _context.SaveChangesAsync();
                        catMap[catKey] = cat;
                    }

                    decimal price = GetDecimalValue(matSheet.Cell(r, 5));
                    decimal openingStock = GetDecimalValue(matSheet.Cell(r, 6));
                    decimal minLvl = GetDecimalValue(matSheet.Cell(r, 7));
                    decimal maxLvl = GetDecimalValue(matSheet.Cell(r, 8));
                    decimal reorderLvl = GetDecimalValue(matSheet.Cell(r, 9));
                    if (reorderLvl == 0 && minLvl > 0) reorderLvl = minLvl * 1.5m;

                    var deptName = matSheet.Cell(r, 10).GetString().Trim();
                    int? deptId = null;
                    if (!string.IsNullOrEmpty(deptName) && departmentMap.TryGetValue(deptName.ToLower(), out var d))
                    {
                        deptId = d.Id;
                    }

                    var primarySupplier = matSheet.Cell(r, 11).GetString().Trim();
                    var location = matSheet.Cell(r, 12).GetString().Trim();
                    var specs = matSheet.Cell(r, 14).GetString().Trim();

                    var key = code.ToLower();
                    if (!materialMap.TryGetValue(key, out var mat))
                    {
                        mat = new Material
                        {
                            MaterialCode = code,
                            MaterialName = name,
                            CategoryId = cat.Id,
                            DefaultUom = uom.ToUpper(),
                            StandardPrice = price,
                            RevisedPrice = price,
                            ReorderLevel = reorderLvl,
                            MonthlyRequirement = reorderLvl * 2,
                            UserDepartmentId = deptId,
                            PrimarySupplierName = string.IsNullOrEmpty(primarySupplier) ? null : primarySupplier,
                            Specification = string.IsNullOrEmpty(specs) ? location : specs,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.Materials.Add(mat);
                        await _context.SaveChangesAsync();
                        materialMap[key] = mat;
                        materialsUpserted++;
                    }
                    else
                    {
                        mat.MaterialName = name;
                        mat.CategoryId = cat.Id;
                        mat.DefaultUom = uom.ToUpper();
                        mat.StandardPrice = price > 0 ? price : mat.StandardPrice;
                        mat.ReorderLevel = reorderLvl > 0 ? reorderLvl : mat.ReorderLevel;
                        if (deptId.HasValue) mat.UserDepartmentId = deptId;
                        if (!string.IsNullOrEmpty(primarySupplier)) mat.PrimarySupplierName = primarySupplier;
                        mat.UpdatedAt = DateTime.UtcNow;
                        materialsUpserted++;
                    }

                    // Record Initial / Opening Stock in Ledger if openingStock > 0
                    if (openingStock > 0)
                    {
                        var openingVal = openingStock * mat.StandardPrice;
                        totalOpeningValuation += openingVal;

                        var existingOpening = await _context.StockLedgers
                            .FirstOrDefaultAsync(l => l.MaterialId == mat.Id && l.TransactionType == TransactionType.Opening);

                        if (existingOpening == null)
                        {
                            _context.StockLedgers.Add(new StockLedger
                            {
                                MaterialId = mat.Id,
                                TransactionDate = DateTime.UtcNow.Date.AddDays(-30),
                                TransactionType = TransactionType.Opening,
                                ReferenceType = ReferenceType.OpeningBalance,
                                ReferenceNumber = "OPENING-STOCK-FEED",
                                QuantityIn = openingStock,
                                QuantityOut = 0,
                                UnitCost = mat.StandardPrice,
                                TotalCost = openingVal,
                                BalanceQuantityAfter = openingStock,
                                Notes = "Initial Opening Stock recorded via Master Excel Feed",
                                CreatedByUserId = userId,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                        else
                        {
                            existingOpening.QuantityIn = openingStock;
                            existingOpening.TotalCost = openingVal;
                            existingOpening.BalanceQuantityAfter = openingStock;
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Seeded/Updated {materialsUpserted} materials with Rs.{totalOpeningValuation:N2} opening stock value.");
            }

            // -------------------------------------------------------------
            // 4. INGEST HISTORICAL INWARD RECEIPTS (GRN)
            // -------------------------------------------------------------
            var grnSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Received", StringComparison.OrdinalIgnoreCase) || w.Name.Contains("GRN", StringComparison.OrdinalIgnoreCase) || w.Name.Contains("Inward", StringComparison.OrdinalIgnoreCase));
            if (grnSheet != null)
            {
                int lastRow = grnSheet.LastRowUsed()?.RowNumber() ?? 0;
                var grnGroups = new Dictionary<string, List<MaterialReceiptItem>>();
                var grnMeta = new Dictionary<string, (DateTime date, string suppName, string invNo, string invDate, string poNo, string vehicle, string remarks)>();
                var localBatches = new Dictionary<string, MaterialBatch>();

                for (int r = 2; r <= lastRow; r++)
                {
                    var grnNo = grnSheet.Cell(r, 1).GetString().Trim();
                    var dateStr = grnSheet.Cell(r, 2).GetString().Trim();
                    var suppName = grnSheet.Cell(r, 3).GetString().Trim();
                    var invNo = grnSheet.Cell(r, 4).GetString().Trim();
                    var invDateStr = grnSheet.Cell(r, 5).GetString().Trim();
                    var poNo = grnSheet.Cell(r, 6).GetString().Trim();
                    var matCode = grnSheet.Cell(r, 7).GetString().Trim();
                    var batchNo = grnSheet.Cell(r, 8).GetString().Trim();
                    decimal qty = GetDecimalValue(grnSheet.Cell(r, 9));
                    decimal unitPrice = GetDecimalValue(grnSheet.Cell(r, 10));
                    var vehicle = grnSheet.Cell(r, 11).GetString().Trim();
                    var remarks = grnSheet.Cell(r, 12).GetString().Trim();

                    if (string.IsNullOrEmpty(matCode) || qty <= 0) continue;

                    if (!materialMap.TryGetValue(matCode.ToLower(), out var mat))
                    {
                        warnings.Add($"Row {r}: Material Code '{matCode}' in GRN sheet not found in Material Master. Skipped.");
                        continue;
                    }

                    DateTime receiptDate = ParseDateOrDefault(dateStr, DateTime.UtcNow);

                    if (string.IsNullOrEmpty(grnNo))
                    {
                        grnNo = $"GRN-{receiptDate:yyyyMM}-{r:D4}";
                    }

                    if (!grnGroups.ContainsKey(grnNo))
                    {
                        grnGroups[grnNo] = new List<MaterialReceiptItem>();
                        grnMeta[grnNo] = (receiptDate, suppName, invNo, invDateStr, poNo, vehicle, remarks);
                    }

                    var item = new MaterialReceiptItem
                    {
                        MaterialId = mat.Id,
                        ReceivedQuantity = qty,
                        UnitPrice = unitPrice > 0 ? unitPrice : mat.StandardPrice,
                        TotalAmount = qty * (unitPrice > 0 ? unitPrice : mat.StandardPrice),
                        BatchNumber = string.IsNullOrEmpty(batchNo) ? null : batchNo.ToUpper(),
                        Remarks = remarks
                    };
                    grnGroups[grnNo].Add(item);

                    // Track MaterialBatches for Ingot batch auto-pricing
                    if (!string.IsNullOrEmpty(batchNo))
                    {
                        var batchUpper = batchNo.Trim().ToUpper();
                        var batchKey = $"{mat.Id}_{batchUpper}";
                        
                        // Check local cache first, then database
                        if (!localBatches.TryGetValue(batchKey, out var existingBatch))
                        {
                            existingBatch = await _context.MaterialBatches
                                .FirstOrDefaultAsync(b => b.MaterialId == mat.Id && b.BatchNumber == batchUpper);
                            
                            if (existingBatch != null)
                            {
                                localBatches[batchKey] = existingBatch;
                            }
                        }

                        if (existingBatch == null)
                        {
                            var newBatch = new MaterialBatch
                            {
                                MaterialId = mat.Id,
                                BatchNumber = batchUpper,
                                FirstReceiptDate = receiptDate,
                                LatestReceiptDate = receiptDate,
                                InwardQuantity = qty,
                                IssuedQuantity = 0,
                                CurrentStock = qty,
                                UnitPrice = unitPrice > 0 ? unitPrice : mat.StandardPrice,
                                TotalValuation = qty * (unitPrice > 0 ? unitPrice : mat.StandardPrice),
                                LastSupplierName = suppName,
                                Remarks = $"Imported via Master Feed from {suppName}",
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };
                            _context.MaterialBatches.Add(newBatch);
                            localBatches[batchKey] = newBatch;
                            batchesCreated++;
                        }
                        else
                        {
                            existingBatch.InwardQuantity += qty;
                            existingBatch.CurrentStock += qty;
                            existingBatch.UnitPrice = unitPrice > 0 ? unitPrice : existingBatch.UnitPrice;
                            existingBatch.TotalValuation = existingBatch.CurrentStock * existingBatch.UnitPrice;
                            existingBatch.LatestReceiptDate = receiptDate;
                            existingBatch.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                }

                foreach (var kvp in grnGroups)
                {
                    var grnNo = kvp.Key;
                    var items = kvp.Value;
                    var meta = grnMeta[grnNo];

                    int? suppId = null;
                    if (!string.IsNullOrEmpty(meta.suppName) && supplierMap.TryGetValue(meta.suppName.ToLower(), out var s))
                    {
                        suppId = s.Id;
                    }

                    var existingGrn = await _context.MaterialReceipts.FirstOrDefaultAsync(r => r.GrnNumber == grnNo);
                    if (existingGrn == null)
                    {
                        var grn = new MaterialReceipt
                        {
                            GrnNumber = grnNo,
                            ReceiptDate = meta.date,
                            SupplierId = suppId,
                            InvoiceNumber = string.IsNullOrEmpty(meta.invNo) ? null : meta.invNo,
                            InvoiceDate = string.IsNullOrEmpty(meta.invDate) ? null : ParseDateOrDefault(meta.invDate, meta.date),
                            PoNumber = string.IsNullOrEmpty(meta.poNo) ? null : meta.poNo,
                            VehicleNumber = string.IsNullOrEmpty(meta.vehicle) ? null : meta.vehicle,
                            Remarks = string.IsNullOrEmpty(meta.remarks) ? "Master Excel Ingest" : meta.remarks,
                            TotalAmount = items.Sum(i => i.TotalAmount),
                            ReceivedByUserId = userId,
                            CreatedAt = DateTime.UtcNow,
                            Items = items
                        };
                        _context.MaterialReceipts.Add(grn);
                        await _context.SaveChangesAsync();
                        receiptsCreated++;

                        // Record StockLedger inward entries
                        foreach (var it in items)
                        {
                            if (!runningStock.ContainsKey(it.MaterialId)) runningStock[it.MaterialId] = 0;
                            runningStock[it.MaterialId] += it.ReceivedQuantity;

                            _context.StockLedgers.Add(new StockLedger
                            {
                                MaterialId = it.MaterialId,
                                TransactionDate = meta.date,
                                TransactionType = TransactionType.Receipt,
                                ReferenceType = ReferenceType.GRN,
                                ReferenceId = grn.Id,
                                ReferenceNumber = grnNo,
                                QuantityIn = it.ReceivedQuantity,
                                QuantityOut = 0,
                                UnitCost = it.UnitPrice,
                                TotalCost = it.TotalAmount,
                                BatchNumber = it.BatchNumber,
                                BalanceQuantityAfter = runningStock[it.MaterialId],
                                Notes = $"Inward Receipt from {meta.suppName}",
                                CreatedByUserId = userId,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Processed {receiptsCreated} Inward GRNs and {batchesCreated} Ingot batches.");
            }

            // -------------------------------------------------------------
            // 5. INGEST MATERIAL ISSUES (CONSUMPTION)
            // -------------------------------------------------------------
            var issSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Issue", StringComparison.OrdinalIgnoreCase));
            if (issSheet != null)
            {
                int lastRow = issSheet.LastRowUsed()?.RowNumber() ?? 0;
                var issGroups = new Dictionary<string, List<MaterialIssueItem>>();
                var issMeta = new Dictionary<string, (DateTime date, string deptName, string supervisor, string shift, string purpose, string remarks)>();

                for (int r = 2; r <= lastRow; r++)
                {
                    var slipNo = issSheet.Cell(r, 1).GetString().Trim();
                    var dateStr = issSheet.Cell(r, 2).GetString().Trim();
                    var deptName = issSheet.Cell(r, 3).GetString().Trim();
                    var supervisor = issSheet.Cell(r, 4).GetString().Trim();
                    var matCode = issSheet.Cell(r, 5).GetString().Trim();
                    var batchNo = issSheet.Cell(r, 6).GetString().Trim();
                    decimal qty = GetDecimalValue(issSheet.Cell(r, 7));
                    decimal unitRate = GetDecimalValue(issSheet.Cell(r, 8));
                    var shift = issSheet.Cell(r, 9).GetString().Trim();
                    var purpose = issSheet.Cell(r, 10).GetString().Trim();
                    var remarks = issSheet.Cell(r, 11).GetString().Trim();

                    if (string.IsNullOrEmpty(matCode) || qty <= 0) continue;

                    if (!materialMap.TryGetValue(matCode.ToLower(), out var mat))
                    {
                        warnings.Add($"Row {r}: Material Code '{matCode}' in Issue sheet not found in Material Master. Skipped.");
                        continue;
                    }

                    DateTime issueDate = ParseDateOrDefault(dateStr, DateTime.UtcNow);
                    if (string.IsNullOrEmpty(slipNo))
                    {
                        slipNo = $"IS-{issueDate:yyyyMM}-{r:D4}";
                    }

                    if (!issGroups.ContainsKey(slipNo))
                    {
                        issGroups[slipNo] = new List<MaterialIssueItem>();
                        issMeta[slipNo] = (issueDate, deptName, supervisor, shift, purpose, remarks);
                    }

                    decimal finalRate = unitRate > 0 ? unitRate : mat.StandardPrice;
                    var item = new MaterialIssueItem
                    {
                        MaterialId = mat.Id,
                        IssuedQuantity = qty,
                        RequestedQuantity = qty,
                        UnitCost = finalRate,
                        TotalCost = qty * finalRate,
                        BatchNumber = string.IsNullOrEmpty(batchNo) ? null : batchNo.ToUpper(),
                        Remarks = remarks
                    };
                    issGroups[slipNo].Add(item);

                    // Deduct from MaterialBatches if batch specified
                    if (!string.IsNullOrEmpty(batchNo))
                    {
                        var batchUpper = batchNo.Trim().ToUpper();
                        var existingBatch = await _context.MaterialBatches
                            .FirstOrDefaultAsync(b => b.MaterialId == mat.Id && b.BatchNumber == batchUpper);
                        if (existingBatch != null)
                        {
                            existingBatch.IssuedQuantity += qty;
                            existingBatch.CurrentStock = Math.Max(0, existingBatch.CurrentStock - qty);
                            existingBatch.TotalValuation = existingBatch.CurrentStock * existingBatch.UnitPrice;
                            existingBatch.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                }

                foreach (var kvp in issGroups)
                {
                    var slipNo = kvp.Key;
                    var items = kvp.Value;
                    var meta = issMeta[slipNo];

                    int? deptId = null;
                    if (!string.IsNullOrEmpty(meta.deptName) && departmentMap.TryGetValue(meta.deptName.ToLower(), out var d))
                    {
                        deptId = d.Id;
                    }

                    var existingIssue = await _context.MaterialIssues.FirstOrDefaultAsync(i => i.IssueSlipNumber == slipNo);
                    if (existingIssue == null)
                    {
                        var issue = new MaterialIssue
                        {
                            IssueSlipNumber = slipNo,
                            IssueDate = meta.date,
                            DepartmentId = deptId,
                            SupervisorName = string.IsNullOrEmpty(meta.supervisor) ? "Store Operator" : meta.supervisor,
                            Shift = string.IsNullOrEmpty(meta.shift) ? "General" : meta.shift,
                            Purpose = string.IsNullOrEmpty(meta.purpose) ? "Production Issue" : meta.purpose,
                            Remarks = string.IsNullOrEmpty(meta.remarks) ? "Master Excel Ingest" : meta.remarks,
                            TotalIssueCost = items.Sum(i => i.TotalCost),
                            IssuedByUserId = userId,
                            CreatedAt = DateTime.UtcNow,
                            Items = items
                        };
                        _context.MaterialIssues.Add(issue);
                        await _context.SaveChangesAsync();
                        issuesCreated++;

                        // Record StockLedger issue entries
                        foreach (var it in items)
                        {
                            if (!runningStock.ContainsKey(it.MaterialId)) runningStock[it.MaterialId] = 0;
                            runningStock[it.MaterialId] = Math.Max(0, runningStock[it.MaterialId] - it.IssuedQuantity);

                            _context.StockLedgers.Add(new StockLedger
                            {
                                MaterialId = it.MaterialId,
                                TransactionDate = meta.date,
                                TransactionType = TransactionType.Issue,
                                ReferenceType = ReferenceType.IssueSlip,
                                ReferenceId = issue.Id,
                                ReferenceNumber = slipNo,
                                QuantityIn = 0,
                                QuantityOut = it.IssuedQuantity,
                                UnitCost = it.UnitCost,
                                TotalCost = it.TotalCost,
                                BatchNumber = it.BatchNumber,
                                BalanceQuantityAfter = runningStock[it.MaterialId],
                                Notes = $"Issued to {meta.deptName} ({meta.supervisor})",
                                CreatedByUserId = userId,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Processed {issuesCreated} Material Issue Slips.");
            }

            // -------------------------------------------------------------
            // 6. INGEST MONTHLY PROJECTIONS
            // -------------------------------------------------------------
            var projSheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Contains("Projection", StringComparison.OrdinalIgnoreCase));
            if (projSheet != null)
            {
                int lastRow = projSheet.LastRowUsed()?.RowNumber() ?? 0;
                string activeMonth = "August 2026";
                for (int r = 2; r <= lastRow; r++)
                {
                    var monthStr = projSheet.Cell(r, 1).GetString().Trim();
                    var matCode = projSheet.Cell(r, 2).GetString().Trim();
                    decimal reqQty = GetDecimalValue(projSheet.Cell(r, 3));

                    if (string.IsNullOrEmpty(matCode) || reqQty <= 0) continue;
                    if (!string.IsNullOrEmpty(monthStr)) activeMonth = monthStr;

                    if (materialMap.TryGetValue(matCode.ToLower(), out var mat))
                    {
                        mat.MonthlyRequirement = reqQty;
                        mat.UpdatedAt = DateTime.UtcNow;
                        projCreated++;
                    }
                }

                var monthCfg = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == "ActiveProjectionMonth");
                if (monthCfg != null)
                {
                    monthCfg.Value = activeMonth;
                    monthCfg.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.SystemConfigurations.Add(new SystemConfiguration
                    {
                        Key = "ActiveProjectionMonth",
                        Value = activeMonth,
                        Description = "Currently Active Monthly Projection Plan Month",
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();
                logs.Add($"Updated {projCreated} material projection quotas for {activeMonth}.");
            }

            // -------------------------------------------------------------
            // 7. RECORD MASTER IMPORT AUDIT LOG
            // -------------------------------------------------------------
            _context.AuditLogs.Add(new AuditLog
            {
                Action = "MASTER_EXCEL_IMPORT",
                EntityName = "PlantMasterData",
                RecordId = $"IMPORT-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
                Username = username,
                NewValues = $"Master Excel Feed: {materialsUpserted} materials, {suppsCreated} suppliers, {deptsCreated} depts, {receiptsCreated} GRNs, {issuesCreated} issues, Rs.{totalOpeningValuation:N2} opening stock.",
                Timestamp = DateTime.UtcNow,
                IpAddress = ipAddress
            });
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            return new MasterImportResultDto(
                Success: true,
                Message: "Universal Master Excel Data Feed completed and committed successfully!",
                DepartmentsCreated: deptsCreated,
                SuppliersCreated: suppsCreated,
                MaterialsUpserted: materialsUpserted,
                ReceiptsCreated: receiptsCreated,
                IssuesCreated: issuesCreated,
                ProjectionsCreated: projCreated,
                BatchesCreated: batchesCreated,
                TotalOpeningStockValuation: totalOpeningValuation,
                Logs: logs,
                Warnings: warnings
            );
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error executing Master Excel import transaction");
            return new MasterImportResultDto(
                Success: false,
                Message: "Master Data Feed failed. Please verify the file format.",
                0, 0, 0, 0, 0, 0, 0, 0,
                new List<string>(),
                new List<string> { "An internal error occurred while processing the Excel file." }
            );
        }
        });
    }

    private decimal GetDecimalValue(IXLCell cell)
    {
        if (cell == null || cell.IsEmpty()) return 0;
        if (cell.DataType == XLDataType.Number) return (decimal)cell.GetDouble();
        var str = cell.GetString().Replace(",", "").Replace("₹", "").Replace("Rs.", "").Trim();
        if (decimal.TryParse(str, out var val)) return val;
        return 0;
    }

    private DateTime ParseDateOrDefault(string dateStr, DateTime defaultDate)
    {
        if (string.IsNullOrWhiteSpace(dateStr)) return defaultDate;
        if (DateTime.TryParse(dateStr, out var d)) return d;
        return defaultDate;
    }
}

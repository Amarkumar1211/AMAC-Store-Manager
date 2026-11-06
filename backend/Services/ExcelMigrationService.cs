using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public interface IExcelMigrationService
{
    Task<MigrationResultDto> MigrateFromWorkbookAsync(string filePath, int userId);
    Task<MigrationPreviewDto> PreviewWorkbookAsync(string filePath);
}

public record MigrationResultDto(
    bool Success,
    string Message,
    int MaterialsImported,
    int SuppliersImported,
    int ReceiptsImported,
    int IssuesImported,
    int CoresImported,
    int CylindersImported,
    int EmployeesImported,
    int AttendancesImported,
    int ColourCodesImported,
    List<string> Logs
);

public record MigrationPreviewDto(
    bool IsValid,
    int SheetCount,
    List<string> SheetNames,
    int DetectedMaterialsCount,
    int DetectedSuppliersCount,
    int DetectedReceiptsCount,
    int DetectedIssuesCount,
    List<string> ValidationWarnings
);

public class ExcelMigrationService : IExcelMigrationService
{
    private readonly StoreDbContext _context;
    private readonly ILogger<ExcelMigrationService> _logger;

    public ExcelMigrationService(StoreDbContext context, ILogger<ExcelMigrationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public Task<MigrationPreviewDto> PreviewWorkbookAsync(string filePath)
    {
        var warnings = new List<string>();
        if (!File.Exists(filePath))
        {
            return Task.FromResult(new MigrationPreviewDto(false, 0, new(), 0, 0, 0, 0, new() { $"File not found at: {filePath}" }));
        }

        try
        {
            using var workbook = new XLWorkbook(filePath);
            var sheetNames = workbook.Worksheets.Select(w => w.Name).ToList();

            int materialsCount = 0;
            if (workbook.TryGetWorksheet("STORE STOCK DETAILS", out var stockSheet))
            {
                for (int r = 3; r <= stockSheet.LastRowUsed()?.RowNumber(); r++)
                {
                    var code = stockSheet.Cell(r, 1).GetString().Trim();
                    if (!string.IsNullOrEmpty(code) && code.StartsWith("M", StringComparison.OrdinalIgnoreCase))
                    {
                        materialsCount++;
                    }
                }
            }
            else
            {
                warnings.Add("Worksheet 'STORE STOCK DETAILS' not found.");
            }

            int suppliersCount = 0;
            if (workbook.TryGetWorksheet("SUPPLIER NAME & CONTACT ", out var suppSheet))
            {
                suppliersCount = suppSheet.LastRowUsed()?.RowNumber() - 2 ?? 0;
            }

            int receiptsCount = 0;
            if (workbook.TryGetWorksheet("RECEIVED MATERIAL", out var recSheet))
            {
                receiptsCount = recSheet.LastRowUsed()?.RowNumber() - 2 ?? 0;
            }

            int issuesCount = 0;
            if (workbook.TryGetWorksheet("ISSUE MATERIAL", out var issSheet))
            {
                issuesCount = issSheet.LastRowUsed()?.RowNumber() - 2 ?? 0;
            }

            return Task.FromResult(new MigrationPreviewDto(
                true,
                sheetNames.Count,
                sheetNames,
                materialsCount,
                suppliersCount,
                receiptsCount,
                issuesCount,
                warnings
            ));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new MigrationPreviewDto(false, 0, new(), 0, 0, 0, 0, new() { "Error reading workbook. Please verify the file format." }));
        }
    }

    public async Task<MigrationResultDto> MigrateFromWorkbookAsync(string filePath, int userId)
    {
        var logs = new List<string>();
        if (!File.Exists(filePath))
        {
            return new MigrationResultDto(false, $"File '{filePath}' does not exist.", 0, 0, 0, 0, 0, 0, 0, 0, 0, logs);
        }

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                using var workbook = new XLWorkbook(filePath);
                logs.Add($"Opened workbook '{Path.GetFileName(filePath)}' with {workbook.Worksheets.Count} sheets.");

            // 1. Categories & Departments Cache
            var categoryMap = await _context.MaterialCategories.ToDictionaryAsync(c => c.Name.Trim().ToUpper(), c => c);
            var departmentMap = await _context.Departments.ToDictionaryAsync(d => d.Name.Trim().ToUpper(), d => d);
            var supplierMap = await _context.Suppliers.ToDictionaryAsync(s => s.SupplierName.Trim().ToUpper(), s => s);

            // 2. Parse STORE STOCK DETAILS (Materials & Suppliers)
            int materialsImported = 0;
            int suppliersImported = 0;

            if (workbook.TryGetWorksheet("STORE STOCK DETAILS", out var stockSheet))
            {
                logs.Add("Processing 'STORE STOCK DETAILS' sheet...");
                var lastRow = stockSheet.LastRowUsed()?.RowNumber() ?? 2;

                for (int r = 3; r <= lastRow; r++)
                {
                    var code = stockSheet.Cell(r, 1).GetString().Trim();
                    var name = stockSheet.Cell(r, 2).GetString().Trim();
                    if (string.IsNullOrEmpty(code) || !code.StartsWith("M", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(name))
                    {
                        continue;
                    }

                    var uom = stockSheet.Cell(r, 3).GetString().Trim();
                    if (string.IsNullOrEmpty(uom)) uom = "KG";

                    var reorderVal = GetDecimalSafe(stockSheet.Cell(r, 4));
                    var deptName = stockSheet.Cell(r, 6).GetString().Trim().ToUpper();
                    var catName = stockSheet.Cell(r, 7).GetString().Trim().ToUpper();
                    var monthlyReq = GetDecimalSafe(stockSheet.Cell(r, 8));
                    var openingStock = GetDecimalSafe(stockSheet.Cell(r, 9));
                    var supplierStr = stockSheet.Cell(r, 16).GetString().Trim();
                    var stdPrice = GetDecimalSafe(stockSheet.Cell(r, 17));
                    var revisedPrice = GetDecimalSafe(stockSheet.Cell(r, 22));

                    // Department lookup/create
                    Department? dept = null;
                    if (!string.IsNullOrEmpty(deptName))
                    {
                        if (!departmentMap.TryGetValue(deptName, out dept))
                        {
                            dept = new Department { Name = deptName, Code = deptName.Length > 10 ? deptName[..10] : deptName };
                            _context.Departments.Add(dept);
                            await _context.SaveChangesAsync();
                            departmentMap[deptName] = dept;
                        }
                    }

                    // Category lookup/create
                    MaterialCategory? cat = null;
                    if (!string.IsNullOrEmpty(catName))
                    {
                        if (!categoryMap.TryGetValue(catName, out cat))
                        {
                            cat = new MaterialCategory { Name = catName, Description = catName };
                            _context.MaterialCategories.Add(cat);
                            await _context.SaveChangesAsync();
                            categoryMap[catName] = cat;
                        }
                    }

                    // Supplier lookup/create with intelligent NLP parsing
                    Supplier? supp = null;
                    if (!string.IsNullOrEmpty(supplierStr))
                    {
                        var (companyName, contactPerson, phone) = ParseSupplierInfo(supplierStr);
                        if (!string.IsNullOrEmpty(companyName))
                        {
                            var suppKey = companyName.ToUpper();
                            if (!supplierMap.TryGetValue(suppKey, out supp))
                            {
                                supp = await _context.Suppliers.FirstOrDefaultAsync(s => s.SupplierName.ToUpper() == suppKey);
                                if (supp == null)
                                {
                                    supp = new Supplier
                                    {
                                        SupplierName = companyName,
                                        ContactPerson = contactPerson,
                                        Phone = phone,
                                        IsActive = true,
                                        CreatedAt = DateTime.UtcNow
                                    };
                                    _context.Suppliers.Add(supp);
                                    await _context.SaveChangesAsync();
                                    suppliersImported++;
                                }
                                else
                                {
                                    if (string.IsNullOrEmpty(supp.ContactPerson) && !string.IsNullOrEmpty(contactPerson)) supp.ContactPerson = contactPerson;
                                    if (string.IsNullOrEmpty(supp.Phone) && !string.IsNullOrEmpty(phone)) supp.Phone = phone;
                                    await _context.SaveChangesAsync();
                                }
                                supplierMap[suppKey] = supp;
                            }
                        }
                    }

                    // Material lookup/create
                    var existingMaterial = await _context.Materials.FirstOrDefaultAsync(m => m.MaterialCode == code);
                    if (existingMaterial == null)
                    {
                        existingMaterial = new Material
                        {
                            MaterialCode = code,
                            MaterialName = name,
                            CategoryId = cat?.Id,
                            DefaultUom = uom,
                            ReorderLevel = reorderVal,
                            MonthlyRequirement = monthlyReq,
                            UserDepartmentId = dept?.Id,
                            StandardPrice = stdPrice,
                            RevisedPrice = revisedPrice,
                            PrimarySupplierName = supp?.SupplierName ?? supplierStr,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.Materials.Add(existingMaterial);
                        await _context.SaveChangesAsync();
                        materialsImported++;
                    }

                    // Supplier Price mapping
                    if (supp != null && stdPrice > 0)
                    {
                        if (!await _context.SupplierMaterialPrices.AnyAsync(p => p.SupplierId == supp.Id && p.MaterialId == existingMaterial.Id))
                        {
                            _context.SupplierMaterialPrices.Add(new SupplierMaterialPrice
                            {
                                SupplierId = supp.Id,
                                MaterialId = existingMaterial.Id,
                                Price = stdPrice,
                                RevisedPrice = revisedPrice,
                                IsPreferred = true,
                                EffectiveDate = DateTime.UtcNow
                            });
                        }
                    }

                    // Opening Stock Ledger Entry
                    if (openingStock > 0)
                    {
                        if (!await _context.StockLedgers.AnyAsync(s => s.MaterialId == existingMaterial.Id && s.TransactionType == TransactionType.Opening))
                        {
                            _context.StockLedgers.Add(new StockLedger
                            {
                                MaterialId = existingMaterial.Id,
                                TransactionDate = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
                                TransactionType = TransactionType.Opening,
                                ReferenceType = ReferenceType.OpeningBalance,
                                ReferenceNumber = "OPENING-JUL2026",
                                QuantityIn = openingStock,
                                QuantityOut = 0,
                                UnitCost = stdPrice,
                                TotalCost = openingStock * stdPrice,
                                BalanceQuantityAfter = openingStock,
                                Notes = "Opening stock balance from Excel July 2026",
                                CreatedByUserId = userId,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {materialsImported} materials and initial opening balances.");
            }

            var materialMap = await _context.Materials.ToDictionaryAsync(m => m.MaterialCode.Trim().ToUpper(), m => m);

            // 3. Parse RECEIVED MATERIAL (Daily Receipts)
            int receiptsImported = 0;
            if (workbook.TryGetWorksheet("RECEIVED MATERIAL", out var recSheet))
            {
                logs.Add("Processing 'RECEIVED MATERIAL' sheet...");
                var lastRow = recSheet.LastRowUsed()?.RowNumber() ?? 2;

                for (int r = 3; r <= lastRow; r++)
                {
                    var code = recSheet.Cell(r, 1).GetString().Trim().ToUpper();
                    if (string.IsNullOrEmpty(code) || !materialMap.TryGetValue(code, out var material)) continue;

                    // Days 1 through 31 are in columns 9 through 39 (Col I to Col AM)
                    for (int c = 9; c <= 39; c++)
                    {
                        var dayVal = GetDecimalSafe(recSheet.Cell(r, c));
                        if (dayVal > 0)
                        {
                            var dayNumber = c - 8;
                            if (dayNumber > 31) continue;

                            var receiptDate = new DateTime(2026, 7, dayNumber, 10, 0, 0, DateTimeKind.Utc);
                            var grnNo = $"GRN-202607-{dayNumber:D2}-{material.MaterialCode}";

                            if (!await _context.MaterialReceipts.AnyAsync(m => m.GrnNumber == grnNo))
                            {
                                var receipt = new MaterialReceipt
                                {
                                    GrnNumber = grnNo,
                                    ReceiptDate = receiptDate,
                                    SupplierName = material.PrimarySupplierName,
                                    InvoiceNumber = $"EXCEL-INV-{dayNumber:D2}",
                                    InvoiceDate = receiptDate,
                                    TotalAmount = dayVal * material.StandardPrice,
                                    Remarks = "Imported from Excel Daily Receipts",
                                    ReceivedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };

                                receipt.Items.Add(new MaterialReceiptItem
                                {
                                    MaterialId = material.Id,
                                    ReceivedQuantity = dayVal,
                                    UnitPrice = material.StandardPrice,
                                    TotalAmount = dayVal * material.StandardPrice
                                });

                                _context.MaterialReceipts.Add(receipt);

                                // Find current running balance
                                var currentBal = await _context.StockLedgers
                                    .Where(s => s.MaterialId == material.Id && s.TransactionDate <= receiptDate)
                                    .OrderByDescending(s => s.TransactionDate)
                                    .ThenByDescending(s => s.Id)
                                    .Select(s => s.BalanceQuantityAfter)
                                    .FirstOrDefaultAsync();

                                _context.StockLedgers.Add(new StockLedger
                                {
                                    MaterialId = material.Id,
                                    TransactionDate = receiptDate,
                                    TransactionType = TransactionType.Receipt,
                                    ReferenceType = ReferenceType.GRN,
                                    ReferenceNumber = grnNo,
                                    QuantityIn = dayVal,
                                    QuantityOut = 0,
                                    UnitCost = material.StandardPrice,
                                    TotalCost = dayVal * material.StandardPrice,
                                    BalanceQuantityAfter = currentBal + dayVal,
                                    Notes = $"Daily Receipt Day {dayNumber} from Excel",
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                });

                                receiptsImported++;
                            }
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {receiptsImported} daily receipt transactions.");
            }

            // 4. Parse ISSUE MATERIAL (Daily Issues)
            int issuesImported = 0;
            if (workbook.TryGetWorksheet("ISSUE MATERIAL", out var issSheet))
            {
                logs.Add("Processing 'ISSUE MATERIAL' sheet...");
                var lastRow = issSheet.LastRowUsed()?.RowNumber() ?? 2;

                for (int r = 3; r <= lastRow; r++)
                {
                    var code = issSheet.Cell(r, 1).GetString().Trim().ToUpper();
                    if (string.IsNullOrEmpty(code) || !materialMap.TryGetValue(code, out var material)) continue;

                    // Days 1 through 31 are in columns 7 through 37 (Col G to Col AK)
                    for (int c = 7; c <= 37; c++)
                    {
                        var dayVal = GetDecimalSafe(issSheet.Cell(r, c));
                        if (dayVal > 0)
                        {
                            var dayNumber = c - 6;
                            if (dayNumber > 31) continue;

                            var issueDate = new DateTime(2026, 7, dayNumber, 16, 0, 0, DateTimeKind.Utc);
                            var issueSlipNo = $"ISS-202607-{dayNumber:D2}-{material.MaterialCode}";

                            if (!await _context.MaterialIssues.AnyAsync(m => m.IssueSlipNumber == issueSlipNo))
                            {
                                var issue = new MaterialIssue
                                {
                                    IssueSlipNumber = issueSlipNo,
                                    IssueDate = issueDate,
                                    DepartmentId = material.UserDepartmentId,
                                    Shift = "General",
                                    Purpose = "Production Consumption",
                                    TotalIssueCost = dayVal * material.StandardPrice,
                                    Remarks = "Imported from Excel Daily Issues",
                                    IssuedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                };

                                issue.Items.Add(new MaterialIssueItem
                                {
                                    MaterialId = material.Id,
                                    RequestedQuantity = dayVal,
                                    IssuedQuantity = dayVal,
                                    UnitCost = material.StandardPrice,
                                    TotalCost = dayVal * material.StandardPrice
                                });

                                _context.MaterialIssues.Add(issue);

                                var currentBal = await _context.StockLedgers
                                    .Where(s => s.MaterialId == material.Id && s.TransactionDate <= issueDate)
                                    .OrderByDescending(s => s.TransactionDate)
                                    .ThenByDescending(s => s.Id)
                                    .Select(s => s.BalanceQuantityAfter)
                                    .FirstOrDefaultAsync();

                                _context.StockLedgers.Add(new StockLedger
                                {
                                    MaterialId = material.Id,
                                    TransactionDate = issueDate,
                                    TransactionType = TransactionType.Issue,
                                    ReferenceType = ReferenceType.IssueSlip,
                                    ReferenceNumber = issueSlipNo,
                                    QuantityIn = 0,
                                    QuantityOut = dayVal,
                                    UnitCost = material.StandardPrice,
                                    TotalCost = dayVal * material.StandardPrice,
                                    BalanceQuantityAfter = Math.Max(0, currentBal - dayVal),
                                    Notes = $"Daily Issue Day {dayNumber} from Excel",
                                    CreatedByUserId = userId,
                                    CreatedAt = DateTime.UtcNow
                                });

                                issuesImported++;
                            }
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {issuesImported} daily issue transactions.");
            }

            // 5. Parse MATERIAL COLOUR CODE
            int colourCodesImported = 0;
            if (workbook.TryGetWorksheet("MATERIAL COLOUR CODE", out var colourSheet))
            {
                logs.Add("Processing 'MATERIAL COLOUR CODE' sheet...");
                var lastRow = colourSheet.LastRowUsed()?.RowNumber() ?? 1;
                for (int r = 2; r <= lastRow; r++)
                {
                    var cust = colourSheet.Cell(r, 1).GetString().Trim();
                    var model = colourSheet.Cell(r, 2).GetString().Trim();
                    var grade = colourSheet.Cell(r, 3).GetString().Trim();
                    var c1 = colourSheet.Cell(r, 4).GetString().Trim();
                    var c2 = colourSheet.Cell(r, 5).GetString().Trim();

                    if (!string.IsNullOrEmpty(cust) && !string.IsNullOrEmpty(model))
                    {
                        if (!await _context.MaterialColourCodes.AnyAsync(x => x.CustomerName == cust && x.ModelNumber == model))
                        {
                            _context.MaterialColourCodes.Add(new MaterialColourCode
                            {
                                CustomerName = cust,
                                ModelNumber = model,
                                MaterialGrade = grade,
                                Colour1 = c1,
                                Colour2 = string.IsNullOrEmpty(c2) ? null : c2
                            });
                            colourCodesImported++;
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {colourCodesImported} customer colour codes.");
            }

            // 6. Parse CORE WEIGHT & PRICE
            int coresImported = 0;
            if (workbook.TryGetWorksheet("CORE WEIGHT & PRICE", out var coreSheet))
            {
                logs.Add("Processing 'CORE WEIGHT & PRICE' sheet...");
                var lastRow = coreSheet.LastRowUsed()?.RowNumber() ?? 1;
                for (int r = 2; r <= lastRow; r++)
                {
                    var name = coreSheet.Cell(r, 2).GetString().Trim();
                    var price = GetDecimalSafe(coreSheet.Cell(r, 3));
                    var weight = GetDecimalSafe(coreSheet.Cell(r, 4));

                    if (!string.IsNullOrEmpty(name))
                    {
                        var code = $"CORE-{r - 1:D3}";
                        if (!await _context.CoreMasters.AnyAsync(c => c.CoreName == name))
                        {
                            _context.CoreMasters.Add(new CoreMaster
                            {
                                CoreCode = code,
                                CoreName = name,
                                StandardPrice = price,
                                WeightPerUnitKg = weight,
                                IsActive = true
                            });
                            coresImported++;
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {coresImported} core master records.");
            }

            // 7. Parse CYLINDER STOCK 01-07-26
            int cylindersImported = 0;
            if (workbook.TryGetWorksheet("CYLINDER STOCK 01-07-26", out var cylSheet))
            {
                logs.Add("Processing 'CYLINDER STOCK 01-07-26' sheet...");
                var lastRow = cylSheet.LastRowUsed()?.RowNumber() ?? 2;
                var existingCyls = await _context.CylinderMasters.ToDictionaryAsync(c => c.CylinderCode.ToUpper(), c => c);
                var seenCodes = new HashSet<string>(existingCyls.Keys);

                for (int r = 3; r <= lastRow; r += 3)
                {
                    var cylName = cylSheet.Cell(r, 2).GetString().Trim();
                    var supplier = cylSheet.Cell(r, 3).GetString().Trim();
                    var avail = GetDecimalSafe(cylSheet.Cell(r, 5));

                    if (!string.IsNullOrEmpty(cylName))
                    {
                        var baseCode = $"CYL-{cylName.Replace(" ", "").ToUpper()}";
                        if (!seenCodes.Contains(baseCode))
                        {
                            seenCodes.Add(baseCode);
                            _context.CylinderMasters.Add(new CylinderMaster
                            {
                                CylinderCode = baseCode,
                                CylinderName = cylName,
                                GasType = cylName.Contains("LPG") ? "LPG" : cylName,
                                Capacity = cylName.Contains("17") ? "17KG" : (cylName.Contains("33") ? "33KG" : "Commercial"),
                                CurrentFullStock = avail,
                                IsActive = true
                            });
                            cylindersImported++;
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {cylindersImported} cylinder master records.");
            }

            // 8. Parse STORES ATTENDENCE 
            int employeesImported = 0;
            int attendancesImported = 0;
            if (workbook.TryGetWorksheet("STORES ATTENDENCE ", out var attSheet))
            {
                logs.Add("Processing 'STORES ATTENDENCE ' sheet...");
                var lastRow = attSheet.LastRowUsed()?.RowNumber() ?? 5;
                for (int r = 6; r <= Math.Min(lastRow, 46); r++)
                {
                    var name = attSheet.Cell(r, 2).GetString().Trim();
                    var empCode = attSheet.Cell(r, 3).GetString().Trim();
                    var designation = attSheet.Cell(r, 4).GetString().Trim();

                    if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(empCode))
                    {
                        var emp = await _context.Employees.FirstOrDefaultAsync(e => e.EmployeeCode == empCode);
                        if (emp == null)
                        {
                            emp = new Employee
                            {
                                EmployeeCode = empCode,
                                FullName = name,
                                Designation = string.IsNullOrEmpty(designation) ? "Store Operator" : designation,
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.Employees.Add(emp);
                            await _context.SaveChangesAsync();
                            employeesImported++;
                        }

                        // Days 1..31 in Col E..AI (cols 5..35)
                        for (int c = 5; c <= 35; c++)
                        {
                            var dayNumber = c - 4;
                            var val = attSheet.Cell(r, c).GetString().Trim();
                            var hours = GetDecimalSafe(attSheet.Cell(r, c));

                            if (hours > 0 || !string.IsNullOrEmpty(val))
                            {
                                var attDate = new DateTime(2026, 7, dayNumber, 0, 0, 0, DateTimeKind.Utc);
                                var status = AttendanceStatus.P;
                                if (val.Equals("A", StringComparison.OrdinalIgnoreCase)) status = AttendanceStatus.A;
                                else if (val.Equals("H", StringComparison.OrdinalIgnoreCase)) status = AttendanceStatus.H;
                                else if (val.Equals("L", StringComparison.OrdinalIgnoreCase)) status = AttendanceStatus.L;

                                if (!await _context.StoreAttendances.AnyAsync(a => a.EmployeeId == emp.Id && a.AttendanceDate == attDate))
                                {
                                    _context.StoreAttendances.Add(new StoreAttendance
                                    {
                                        EmployeeId = emp.Id,
                                        AttendanceDate = attDate,
                                        Status = status,
                                        WorkingHours = hours > 0 ? hours : (status == AttendanceStatus.P ? 8 : 0),
                                        OvertimeHours = hours > 8 ? hours - 8 : 0
                                    });
                                    attendancesImported++;
                                }
                            }
                        }
                    }
                }
                await _context.SaveChangesAsync();
                logs.Add($"Imported {employeesImported} employees and {attendancesImported} attendance records.");
            }

            // 9. Parse cost saving
            if (workbook.TryGetWorksheet("cost saving", out var saveSheet))
            {
                logs.Add("Processing 'cost saving' sheet...");
                var lastRow = saveSheet.LastRowUsed()?.RowNumber() ?? 2;
                for (int r = 3; r <= lastRow; r++)
                {
                    var code = saveSheet.Cell(r, 1).GetString().Trim().ToUpper();
                    if (materialMap.TryGetValue(code, out var material))
                    {
                        var currSupp = saveSheet.Cell(r, 3).GetString().Trim();
                        var newSupp = saveSheet.Cell(r, 4).GetString().Trim();
                        var currPrice = GetDecimalSafe(saveSheet.Cell(r, 5));
                        var newPrice = GetDecimalSafe(saveSheet.Cell(r, 6));
                        var avgQty = GetDecimalSafe(saveSheet.Cell(r, 8));

                        if (currPrice > 0 && newPrice > 0)
                        {
                            var diff = currPrice - newPrice;
                            _context.CostSavingInitiatives.Add(new CostSavingInitiative
                            {
                                MaterialId = material.Id,
                                CurrentSupplier = currSupp,
                                NewSupplier = newSupp,
                                CurrentSupplierPrice = currPrice,
                                NewSupplierPrice = newPrice,
                                PriceDifference = diff,
                                PerMonthAveragePurchaseQty = avgQty,
                                MonthlyCostSavings = diff * avgQty,
                                Remarks = saveSheet.Cell(r, 10).GetString().Trim(),
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }
                await _context.SaveChangesAsync();
            }

            // Record audit log for migration
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = "IMPORT",
                EntityName = "ExcelMigration",
                RecordId = Path.GetFileName(filePath),
                NewValues = $"Materials: {materialsImported}, Receipts: {receiptsImported}, Issues: {issuesImported}, Cores: {coresImported}, Cylinders: {cylindersImported}, Employees: {employeesImported}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            logs.Add("MIGRATION COMPLETED SUCCESSFULLY. All database transactions committed.");

            return new MigrationResultDto(
                true,
                "Historical Excel data successfully migrated into SQL Server database.",
                materialsImported,
                suppliersImported,
                receiptsImported,
                issuesImported,
                coresImported,
                cylindersImported,
                employeesImported,
                attendancesImported,
                colourCodesImported,
                logs
            );
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Migration failed");
            logs.Add("CRITICAL ERROR: Migration failed due to an internal error.");
            return new MigrationResultDto(false, "Migration failed. Please verify the file format.", 0, 0, 0, 0, 0, 0, 0, 0, 0, logs);
        }
        });
    }

    public static (string CompanyName, string? ContactPerson, string? Phone) ParseSupplierInfo(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return (string.Empty, null, null);

        var str = raw.Trim();
        str = System.Text.RegularExpressions.Regex.Replace(str, @"\s+", " ");
        str = System.Text.RegularExpressions.Regex.Replace(str, @"open\s*po", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();

        string company;
        string? contact = null;
        string? phone = null;

        var lower = str.ToLowerInvariant();

        if (lower.Contains("imac") && (lower.Contains("saravanan") || lower.Contains("99411")))
        {
            company = "IMAC";
            contact = "Mr. Saravanan";
            phone = "99411 70522";
        }
        else if (lower.Contains("kolala") || lower.Contains("guru"))
        {
            company = "Guru Kolala";
            contact = "Mr. Guru";
            phone = "93419 61682";
        }
        else if (lower.Contains("dhivya") || lower.Contains("divya"))
        {
            company = "Dhivya Enterprises";
            contact = null;
            phone = "93431 77888";
        }
        else if (lower.Contains("morganate") || lower.Contains("morganite"))
        {
            company = "Morganite";
            contact = "Saravanan";
            phone = "9789865979";
        }
        else if (lower.Contains("amac unit-1") || (lower.Contains("thondaiman") && lower.Contains("98451")))
        {
            company = "AMAC Unit-1";
            contact = "Thondaiman";
            phone = "98451 90175";
        }
        else if (lower.Contains("saru aikoh"))
        {
            company = "Saru Aikoh";
            contact = "Avinash / Altk Rau";
            phone = "7204592920 / 98482 55994";
        }
        else if (lower.Contains("ceraflax") || lower.Contains("ceraflux") || lower.Contains("yallaling"))
        {
            company = "Ceraflux";
            contact = "Yallaling";
            phone = "9022926156";
        }
        else if (lower.Contains("aldan") || lower.Contains("bindo"))
        {
            company = "Aldan Bindo";
            contact = "Bindo";
            phone = "9880505852";
        }
        else if (lower.Contains("standard corbon") || lower.Contains("standard carbon") || lower.Contains("naveen"))
        {
            company = "Standard Carbon";
            contact = "Naveen";
            phone = "97400 31234";
        }
        else if (lower.Contains("proxior") && lower.Contains("rajkumar"))
        {
            company = "Proxior";
            contact = "Rajkumar";
            phone = "90087 02961";
        }
        else if (lower.Contains("proxior") && lower.Contains("vinoth"))
        {
            company = "Proxior";
            contact = "Vinoth";
            phone = "90145 73185";
        }
        else if (lower.Contains("peenya") || lower.Contains("venkatesh"))
        {
            company = "Peenya Industrial";
            contact = "Venkatesh / Sunil";
            phone = "98451 93449 / 93422 09530";
        }
        else if (lower.Contains("total gas"))
        {
            company = "Total Gas";
            contact = null;
            phone = "98445 70245";
        }
        else if (lower.Contains("tpl") || lower.Contains("gowsic"))
        {
            company = "TPL";
            contact = "Gowsic";
            phone = "96980 85987";
        }
        else if (lower.Contains("futurz cam") || lower.Contains("priya"))
        {
            company = "Futurz Cam";
            contact = "Priya";
            phone = "95785 44380";
        }
        else if (lower.Contains("rk packing") || lower.Contains("ramesh"))
        {
            company = "RK Packing";
            contact = "Ramesh";
            phone = "99019 54866";
        }
        else if (lower.Contains("golden shoes"))
        {
            company = "Golden Shoes";
            contact = null;
            phone = "88255 18793";
        }
        else if (lower.Contains("lakshmi enterprises"))
        {
            company = "Lakshmi Enterprises";
            contact = null;
            phone = "7259008128";
        }
        else if (lower.Contains("rama engineering") || (lower.Contains("sathish") && lower.Contains("81470")))
        {
            company = "Rama Engineering";
            contact = "Sathish";
            phone = "81470 39244";
        }
        else if (lower.Contains("allied engineering") || lower.Contains("suthagar"))
        {
            company = "Allied Engineering";
            contact = "Suthagar";
            phone = "9845617937";
        }
        else if (lower.Contains("vinayaga"))
        {
            company = "Sri Vinayaga Enterprises";
            contact = null;
            phone = "8747989505";
        }
        else if (lower.Contains("hi tech") || (lower.Contains("raju") && lower.Contains("94483")))
        {
            company = "Hi Tech";
            contact = "Raju";
            phone = "94483 51965";
        }
        else if (lower.Contains("sobi"))
        {
            company = "Sobi Engineering Works";
            contact = null;
            phone = null;
        }
        else
        {
            var phoneMatch = System.Text.RegularExpressions.Regex.Match(str, @"[-]?\s*(\d{5}\s*\d{5}|\d{10})");
            if (phoneMatch.Success)
            {
                phone = phoneMatch.Groups[1].Value.Trim();
                str = str.Replace(phoneMatch.Value, "").Trim();
            }
            str = str.Trim('-', '–', '—', ' ', ')', '(');
            company = str.ToUpperInvariant();
        }

        return (company, contact, phone);
    }

    private static decimal GetDecimalSafe(IXLCell cell)
    {
        if (cell == null || cell.IsEmpty()) return 0;
        if (cell.TryGetValue<decimal>(out var val)) return val;
        if (cell.TryGetValue<double>(out var dVal)) return Convert.ToDecimal(dVal);
        var str = cell.GetString().Trim();
        if (decimal.TryParse(str, out var parsed)) return parsed;
        return 0;
    }
}

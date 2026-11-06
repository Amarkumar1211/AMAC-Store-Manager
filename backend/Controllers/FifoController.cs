using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.Models;
using System.Security.Claims;
using System.Text.Json;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FifoController : ControllerBase
{
    private readonly StoreDbContext _context;
    private readonly ILogger<FifoController> _logger;

    public FifoController(StoreDbContext context, ILogger<FifoController> logger)
    {
        _context = context;
        _logger = logger;
    }

    public class FifoLaneDefinition
    {
        public int LaneId { get; set; }
        public string DivisionName { get; set; } = string.Empty;
        public string Section { get; set; } = "ALUMINIUM ALLOY INGOTS"; // "ALUMINIUM ALLOY INGOTS" or "CONSUMABLES"
        public string MaterialGrade { get; set; } = string.Empty;
        public string SubGrade { get; set; } = string.Empty;
        public string ColorCode { get; set; } = "#10B981"; // Hex or CSS color
        public string TagStyle { get; set; } = "green"; // green, dark-green, blue, orange, red, pink, consumable-blue
        public List<string> MatchKeywords { get; set; } = new();
        public decimal MaxStockKg { get; set; } = 25000;
        public decimal ReorderStockKg { get; set; } = 10000;
        public decimal MinStockKg { get; set; } = 3000;
        public decimal BallScaleKg { get; set; } = 200;
        public decimal MockFallbackStock { get; set; } = 0;
    }

    public class FifoBatchItemDto
    {
        public int QueuePosition { get; set; }
        public string BatchNumber { get; set; } = string.Empty;
        public decimal StockQuantity { get; set; }
        public DateTime ReceiptDate { get; set; }
        public int DaysInPlant { get; set; }
        public string? Location { get; set; }
        public string? HeatNumber { get; set; }
        public string FifoStatus { get; set; } = "Next To Consume"; // Next To Consume, In Queue, Fresh Inward
    }

    public class FifoLaneDto
    {
        public int LaneId { get; set; }
        public string DivisionName { get; set; } = string.Empty;
        public string Section { get; set; } = string.Empty;
        public string MaterialGrade { get; set; } = string.Empty;
        public string SubGrade { get; set; } = string.Empty;
        public string ColorCode { get; set; } = string.Empty;
        public string TagStyle { get; set; } = string.Empty;
        public int? MatchedMaterialId { get; set; }
        public string? MatchedMaterialCode { get; set; }
        public string? MatchedMaterialName { get; set; }
        public decimal CurrentStockKg { get; set; }
        public int BallCount { get; set; }
        public decimal MaxStockKg { get; set; } = 25000;
        public decimal ReorderStockKg { get; set; } = 10000;
        public decimal MinStockKg { get; set; } = 3000;
        public decimal BallScaleKg { get; set; } = 200;
        public string HealthStatus { get; set; } = "OPTIMAL"; // OPTIMAL, REORDER_ALERT, CRITICAL_MIN, OVERSTOCK_MAX, EMPTY
        public string StatusColor { get; set; } = "#10B981";
        public List<FifoBatchItemDto> Batches { get; set; } = new();
    }

    public class FifoAuditDto
    {
        public string AuditDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd");
        public string AuditTime { get; set; } = DateTime.UtcNow.ToString("HH:mm");
        public string Shift { get; set; } = "Shift A";
        public string CheckedBy { get; set; } = "Store In-Charge";
        public string? CheckedBySignatureUrl { get; set; }
        public string VerifiedBy { get; set; } = "Plant Quality Manager";
        public string? VerifiedBySignatureUrl { get; set; }
        public string Remarks { get; set; } = "All material racks verified in strict FIFO gravity alignment.";
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class FifoBoardResponse
    {
        public string CompanyName { get; set; } = "ASIAAN METALS & ALUMINIUM CASTING PVT LTD";
        public string UnitName { get; set; } = "AMAC UNIT-5";
        public string Motto { get; set; } = "Quality • Discipline • Safety • Efficiency";
        public string Date { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd");
        public string CurrentShift { get; set; } = "Shift A";
        public decimal TotalPlantIngotStockKg { get; set; }
        public decimal TotalPlantConsumablesStockKg { get; set; }
        public int TotalActiveBalls { get; set; }
        public List<FifoLaneDto> Lanes { get; set; } = new();
        public FifoAuditDto AuditSignOff { get; set; } = new();
    }

    private static readonly List<FifoLaneDefinition> StandardLanes = new()
    {
        // DIVISION - 01
        new() { LaneId = 1, DivisionName = "DIVISION - 01", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AlSi12CuNiMg", ColorCode = "#10B981", TagStyle = "green", MatchKeywords = new() { "ALSI12CUNIMG", "ALSI12-CU", "M144", "M165" }, MaxStockKg = 18000, ReorderStockKg = 13000, MinStockKg = 8000, BallScaleKg = 1000, MockFallbackStock = 5187 },
        new() { LaneId = 2, DivisionName = "DIVISION - 01", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AlSi9Cu1Mg", ColorCode = "#065F46", TagStyle = "dark-green", MatchKeywords = new() { "ALSI9CU1MG", "ALSI9CU1", "M004" }, MaxStockKg = 18000, ReorderStockKg = 13000, MinStockKg = 8000, BallScaleKg = 1000, MockFallbackStock = 0 },
        
        // DIVISION - 02
        new() { LaneId = 3, DivisionName = "DIVISION - 02", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AlSi7Mg", ColorCode = "#2563EB", TagStyle = "blue", MatchKeywords = new() { "ALSI7MG", "M001", "M123", "M163" }, MaxStockKg = 12000, ReorderStockKg = 9000, MinStockKg = 5000, BallScaleKg = 1000, MockFallbackStock = 9544 },
        new() { LaneId = 4, DivisionName = "DIVISION - 02", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AlSi8Cu3", ColorCode = "#1D4ED8", TagStyle = "blue", MatchKeywords = new() { "ALSI8CU3", "M003" }, MaxStockKg = 12000, ReorderStockKg = 9000, MinStockKg = 5000, BallScaleKg = 1000, MockFallbackStock = 8785 },
        
        // DIVISION - 03
        new() { LaneId = 5, DivisionName = "DIVISION - 03", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AC2A", ColorCode = "#F59E0B", TagStyle = "orange", MatchKeywords = new() { "AC2A", "M002" }, MaxStockKg = 3500, ReorderStockKg = 2500, MinStockKg = 1500, BallScaleKg = 1000, MockFallbackStock = 6080 },
        new() { LaneId = 6, DivisionName = "DIVISION - 03", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AlSi7Cu3Mg", ColorCode = "#10B981", TagStyle = "green", MatchKeywords = new() { "ALSI7CU3MG", "ALSI7CU3", "M005" }, MaxStockKg = 3500, ReorderStockKg = 2500, MinStockKg = 1500, BallScaleKg = 1000, MockFallbackStock = 12421 },
        
        // DIV - 04
        new() { LaneId = 7, DivisionName = "DIV - 04", Section = "ALUMINIUM ALLOY INGOTS", MaterialGrade = "AlSi12_LM6", ColorCode = "#D97706", TagStyle = "orange", MatchKeywords = new() { "ALSI12_LM6", "ALSI12MG", "LM6", "M007" }, MaxStockKg = 1000, ReorderStockKg = 700, MinStockKg = 500, BallScaleKg = 1000, MockFallbackStock = 9207 },

        // CONSUMABLES (DIVISION - 05)
        new() { LaneId = 8, DivisionName = "DIVISION - 05", Section = "CONSUMABLES", MaterialGrade = "STRONTIUM (Sr)", ColorCode = "#1E40AF", TagStyle = "consumable-blue", MatchKeywords = new() { "STRONTIUM", "ALSR10", "M019", "(SR)" }, MaxStockKg = 13500, ReorderStockKg = 4000, MinStockKg = 3200, BallScaleKg = 200, MockFallbackStock = 25764 },
        new() { LaneId = 9, DivisionName = "DIVISION - 05", Section = "CONSUMABLES", MaterialGrade = "TITANIUM (Ti)", ColorCode = "#1E3A8A", TagStyle = "consumable-dark", MatchKeywords = new() { "TITANIUM", "ALTIB", "M020", "(TI)" }, MaxStockKg = 12000, ReorderStockKg = 3500, MinStockKg = 2000, BallScaleKg = 200, MockFallbackStock = 12519 },
        new() { LaneId = 10, DivisionName = "DIVISION - 05", Section = "CONSUMABLES", MaterialGrade = "MAGNESIUM (Mg)", ColorCode = "#0F172A", TagStyle = "consumable-black", MatchKeywords = new() { "MAGNESIUM", "MAGNISIUM", "M018", "PURE MG", "(MG)" }, MaxStockKg = 8500, ReorderStockKg = 2500, MinStockKg = 1500, BallScaleKg = 200, MockFallbackStock = 2058 }
    };

    [AllowAnonymous]
    [HttpGet("board")]
    public async Task<ActionResult<FifoBoardResponse>> GetFifoBoard()
    {
        var allMaterials = await _context.Materials
            .Include(m => m.Category)
            .ToListAsync();

        // Load ALL batches (not just CurrentStock > 0) so we can show them in the FIFO queue
        // even if their individual CurrentStock drifted. Filter to only those with stock.
        var allBatches = await _context.MaterialBatches
            .Where(b => b.CurrentStock > 0)
            .OrderBy(b => b.FirstReceiptDate)
            .ToListAsync();

        var response = new FifoBoardResponse();
        decimal totalIngotStock = 0;
        decimal totalConsumablesStock = 0;
        int totalBalls = 0;

        // PRE-FETCH STOCK TO PREVENT N+1 QUERIES
        var relevantMaterialIds = new HashSet<int>();
        foreach (var def in StandardLanes)
        {
            foreach (var kw in def.MatchKeywords)
            {
                var matches = allMaterials.Where(m =>
                    m.MaterialCode.ToUpper().Contains(kw) ||
                    m.MaterialName.ToUpper().Contains(kw) ||
                    (m.Specification != null && m.Specification.ToUpper().Contains(kw)));
                foreach (var m in matches) relevantMaterialIds.Add(m.Id);
            }
        }

        var materialStocks = await _context.StockLedgers
            .Where(sl => relevantMaterialIds.Contains(sl.MaterialId))
            .GroupBy(sl => sl.MaterialId)
            .Select(g => new {
                MaterialId = g.Key,
                LatestStock = g.OrderByDescending(sl => sl.Id).Select(sl => sl.BalanceQuantityAfter).FirstOrDefault()
            })
            .ToDictionaryAsync(x => x.MaterialId, x => x.LatestStock);

        foreach (var def in StandardLanes)
        {
            var matchedMaterials = new List<Material>();
            foreach (var kw in def.MatchKeywords)
            {
                var matches = allMaterials.Where(m =>
                    m.MaterialCode.ToUpper().Contains(kw) ||
                    m.MaterialName.ToUpper().Contains(kw) ||
                    (m.Specification != null && m.Specification.ToUpper().Contains(kw))).ToList();
                matchedMaterials.AddRange(matches);
            }
            // Distinct in case a material matched multiple keywords
            matchedMaterials = matchedMaterials.DistinctBy(m => m.Id).ToList();
            
            var primaryMatch = matchedMaterials.FirstOrDefault();

            decimal stockKg = 0;
            var batchList = new List<FifoBatchItemDto>();

            if (matchedMaterials.Any())
            {
                // Sum stock from all matching material ledgers
                foreach (var mat in matchedMaterials)
                {
                    if (materialStocks.TryGetValue(mat.Id, out var stock))
                    {
                        stockKg += stock;
                    }
                }

                var matchedMatIds = matchedMaterials.Select(m => m.Id).ToList();
                var matchedBatches = allBatches
                    .Where(b => matchedMatIds.Contains(b.MaterialId))
                    .OrderBy(b => b.FirstReceiptDate)
                    .ToList();

                // If ledger balance is 0 or not found but active batches exist, fallback to active batches sum
                if (stockKg <= 0 && matchedBatches.Any())
                {
                    stockKg = matchedBatches.Sum(b => b.CurrentStock);
                }

                int qPos = 1;
                foreach (var b in matchedBatches)
                {
                    var days = (int)Math.Max(0, (DateTime.UtcNow - b.FirstReceiptDate).TotalDays);
                    
                    // Format batch label: BatchNumber → Date → Date+Time
                    string displayBatch = !string.IsNullOrWhiteSpace(b.BatchNumber) ? b.BatchNumber : 
                                          matchedBatches.Count(x => x.FirstReceiptDate.Date == b.FirstReceiptDate.Date) > 1 
                                          ? b.FirstReceiptDate.ToString("dd-MMM HH:mm") 
                                          : b.FirstReceiptDate.ToString("dd-MMM");

                    batchList.Add(new FifoBatchItemDto
                    {
                        QueuePosition = qPos,
                        BatchNumber = displayBatch,
                        StockQuantity = b.CurrentStock,
                        ReceiptDate = b.FirstReceiptDate,
                        DaysInPlant = days,
                        Location = "FIFO-BAY-0" + def.LaneId,
                        HeatNumber = "HT-" + (string.IsNullOrWhiteSpace(b.BatchNumber) ? "NA" : b.BatchNumber),
                        FifoStatus = qPos == 1 ? "Next To Consume" : days > 30 ? "Aging Stock" : "In Queue"
                    });
                    qPos++;
                }
            }

            var ballCount = (int)Math.Ceiling(stockKg / def.BallScaleKg);

            // Determine effective thresholds (DB vs Hardcoded Fallback)
            decimal effectiveMin = def.MinStockKg;
            decimal effectiveReorder = def.ReorderStockKg;
            decimal effectiveMax = def.MaxStockKg;

            if (primaryMatch != null)
            {
                if (primaryMatch.MinStockLevel > 0) effectiveMin = primaryMatch.MinStockLevel;
                if (primaryMatch.ReorderLevel > 0) effectiveReorder = primaryMatch.ReorderLevel;
                if (primaryMatch.MaxStockLevel > 0) effectiveMax = primaryMatch.MaxStockLevel;
            }

            // Auto-correct any user data-entry errors (e.g. Min > Reorder)
            var sortedThresholds = new List<decimal> { effectiveMin, effectiveReorder, effectiveMax };
            sortedThresholds.Sort();
            effectiveMin = sortedThresholds[0];
            effectiveReorder = sortedThresholds[1];
            effectiveMax = sortedThresholds[2];

            // Determine status
            string status = "OPTIMAL";
            string statusColor = "#10B981";

            if (stockKg <= 0)
            {
                status = "EMPTY";
                statusColor = "#9CA3AF";
            }
            else if (stockKg < effectiveMin)
            {
                status = "CRITICAL_MIN";
                statusColor = "#EF4444";
            }
            else if (stockKg <= effectiveReorder)
            {
                status = "REORDER_ALERT";
                statusColor = "#F59E0B";
            }
            else if (stockKg > effectiveMax)
            {
                status = "OVERSTOCK_MAX";
                statusColor = "#10B981"; // Green (requested by user)
            }

            if (def.Section == "ALUMINIUM ALLOY INGOTS")
                totalIngotStock += stockKg;
            else
                totalConsumablesStock += stockKg;

            totalBalls += ballCount;

            response.Lanes.Add(new FifoLaneDto
            {
                LaneId = def.LaneId,
                DivisionName = def.DivisionName,
                Section = def.Section,
                MaterialGrade = def.MaterialGrade,
                SubGrade = def.SubGrade,
                ColorCode = def.ColorCode,
                TagStyle = def.TagStyle,
                MatchedMaterialId = primaryMatch?.Id,
                MatchedMaterialCode = primaryMatch?.MaterialCode,
                MatchedMaterialName = primaryMatch?.MaterialName,
                CurrentStockKg = stockKg,
                BallCount = ballCount,
                MaxStockKg = effectiveMax,
                ReorderStockKg = effectiveReorder,
                MinStockKg = effectiveMin,
                BallScaleKg = def.BallScaleKg,
                HealthStatus = status,
                StatusColor = statusColor,
                Batches = batchList
            });
        }

        response.TotalPlantIngotStockKg = totalIngotStock;
        response.TotalPlantConsumablesStockKg = totalConsumablesStock;
        response.TotalActiveBalls = totalBalls;

        // Fetch today's audit sign-off
        var auditConfig = await _context.SystemConfigurations
            .FirstOrDefaultAsync(c => c.Key == "FifoLatestAudit");

        if (auditConfig != null && !string.IsNullOrWhiteSpace(auditConfig.Value))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<FifoAuditDto>(auditConfig.Value);
                if (parsed != null) response.AuditSignOff = parsed;
            }
            catch { }
        }

        return Ok(response);
    }

    [HttpPost("audit")]
    public async Task<ActionResult> SaveAuditSignOff([FromBody] FifoAuditDto dto)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentUserName = User.FindFirstValue(ClaimTypes.Name) ?? "System Auditor";

        dto.UpdatedAt = DateTime.UtcNow;
        var json = JsonSerializer.Serialize(dto);

        var config = await _context.SystemConfigurations
            .FirstOrDefaultAsync(c => c.Key == "FifoLatestAudit");

        if (config == null)
        {
            _context.SystemConfigurations.Add(new SystemConfiguration
            {
                Key = "FifoLatestAudit",
                Value = json,
                Description = "Daily FIFO Board Store & Quality Audit Record",
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            config.Value = json;
            config.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = "FIFO Audit Sign-off saved successfully.", audit = dto });
    }
}

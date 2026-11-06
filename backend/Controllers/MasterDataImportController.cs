using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StoreManager.Api.Services;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/master-data")]
[Authorize]
public class MasterDataImportController : ControllerBase
{
    private readonly IMasterDataImportService _importService;
    private readonly ILogger<MasterDataImportController> _logger;

    public MasterDataImportController(
        IMasterDataImportService importService,
        ILogger<MasterDataImportController> logger)
    {
        _importService = importService;
        _logger = logger;
    }

    /// <summary>
    /// Downloads the official multi-sheet Master Excel template with formatted sample data & guidance.
    /// </summary>
    [HttpGet("template")]
    public async Task<IActionResult> DownloadMasterTemplate()
    {
        try
        {
            var bytes = await _importService.GenerateMasterTemplateAsync();
            var filename = $"AMAC_Unit5_Master_Data_Template_{DateTime.UtcNow:yyyyMMdd}.xlsx";
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating Master Data Excel Template");
            return StatusCode(500, new { success = false, message = "Failed to generate master template. Please try again or contact support." });
        }
    }

    /// <summary>
    /// In-memory inspection & preview of uploaded Master Excel workbook before committing to database.
    /// </summary>
    [HttpPost("preview")]
    public async Task<IActionResult> PreviewMasterData([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, message = "Please select a valid Excel file (.xlsx)" });
        }

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) &&
            !file.FileName.EndsWith(".xlsm", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { success = false, message = "Only Excel files (.xlsx or .xlsm) are supported." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var preview = await _importService.PreviewMasterDataAsync(stream);
            return Ok(preview);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error previewing Master Data Excel file");
            return StatusCode(500, new { success = false, message = "Failed to inspect master file. Please verify the file format and try again." });
        }
    }

    /// <summary>
    /// Atomically ingests multi-sheet master data (Materials, Stock, Suppliers, Depts, GRNs, Issues, Projections).
    /// </summary>
    [HttpPost("upload")]
    [Authorize(Roles = "Admin,PlantManager,StoreIncharge")]
    public async Task<IActionResult> UploadMasterData(
        [FromForm] IFormFile file,
        [FromForm] bool resetExistingFirst = false)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, message = "Please upload a valid Master Excel (.xlsx) file." });
        }

        int userId = 1;
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var parsedId))
        {
            userId = parsedId;
        }

        string username = User.Identity?.Name ?? "Admin";
        string ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _importService.ImportMasterDataAsync(stream, userId, username, ipAddress, resetExistingFirst);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading and committing Master Data Excel");
            return StatusCode(500, new { success = false, message = "Import failed due to an internal error. Please verify the file format and try again." });
        }
    }
}

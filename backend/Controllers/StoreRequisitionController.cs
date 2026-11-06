using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StoreManager.Api.DTOs;
using StoreManager.Api.Services;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/store-requisitions")]
[Authorize]
public class StoreRequisitionController : ControllerBase
{
    private readonly IStoreRequisitionService _requisitionService;
    private readonly IRequisitionNotificationService _notificationService;
    private readonly ILogger<StoreRequisitionController> _logger;

    public StoreRequisitionController(
        IStoreRequisitionService requisitionService,
        IRequisitionNotificationService notificationService,
        ILogger<StoreRequisitionController> logger)
    {
        _requisitionService = requisitionService;
        _notificationService = notificationService;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var val = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(val, out var id) ? id : null;
    }

    [HttpGet("live-feed")]
    public async Task<IActionResult> GetLiveFeed([FromQuery] long since = 0, [FromQuery] int? departmentId = null)
    {
        var newEvents = _notificationService.GetEventsSince(since, departmentId);
        var latestEventId = _notificationService.GetLatestEventId();
        // Use enum toString for type-safe status string
        var pendingRequisitions = await _requisitionService.GetRequisitionsAsync(
            StoreManager.Api.Models.RequisitionStatus.Pending.ToString(), departmentId);

        return Ok(new
        {
            serverTime = DateTime.UtcNow,
            latestEventId,
            pendingCount = pendingRequisitions.Count,
            events = newEvents
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetRequisitions(
        [FromQuery] string? status = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] string? search = null)
    {
        try
        {
            var list = await _requisitionService.GetRequisitionsAsync(status, departmentId, search);
            return Ok(list);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get store requisitions");
            return StatusCode(500, new { message = "An error occurred while fetching requisitions. Please try again or contact support." });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRequisitionById(int id)
    {
        var req = await _requisitionService.GetRequisitionByIdAsync(id);
        if (req == null) return NotFound(new { message = $"Store requisition {id} not found." });
        return Ok(req);
    }

    [HttpPost]
    public async Task<IActionResult> CreateRequisition([FromBody] CreateStoreRequisitionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var result = await _requisitionService.CreateRequisitionAsync(dto, userId);
            return CreatedAtAction(nameof(GetRequisitionById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create store requisition");
            return StatusCode(500, new { message = "An error occurred while creating the store requisition. Please try again or contact support." });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRequisition(int id, [FromBody] UpdateStoreRequisitionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var result = await _requisitionService.UpdateRequisitionAsync(id, dto, userId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update store requisition {Id}", id);
            return StatusCode(500, new { message = "An error occurred while updating the requisition. Please try again or contact support." });
        }
    }

    [HttpPost("{id}/allow")]
    [Authorize(Roles = "Admin,StoreManager")]
    public async Task<IActionResult> AllowRequisition(int id, [FromBody] AllowStoreRequisitionDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            var (success, message, requisition, issueSlipNumber) = await _requisitionService.AllowRequisitionAsync(id, dto, userId);
            if (!success)
            {
                return BadRequest(new { message });
            }

            return Ok(new
            {
                message,
                requisition,
                issueSlipNumber
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to allow store requisition {Id}", id);
            return StatusCode(500, new { message = "An error occurred while approving the requisition. Please try again or contact support." });
        }
    }

    [HttpPost("{id}/deny")]
    [Authorize(Roles = "Admin,StoreManager")]
    public async Task<IActionResult> DenyRequisition(int id, [FromBody] DenyStoreRequisitionDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto?.DenialRemarks))
            {
                return BadRequest(new { message = "A denial remark / rejection reason is mandatory." });
            }

            var userId = GetCurrentUserId();
            var (success, message, requisition) = await _requisitionService.DenyRequisitionAsync(id, dto, userId);
            if (!success)
            {
                return BadRequest(new { message });
            }

            return Ok(new
            {
                message,
                requisition
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deny store requisition {Id}", id);
            return StatusCode(500, new { message = "An error occurred while denying the requisition. Please try again or contact support." });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRequisition(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var deleted = await _requisitionService.DeleteRequisitionAsync(id, userId);
            if (!deleted) return NotFound(new { message = "Store requisition not found." });
            return Ok(new { message = "Store requisition deleted successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete store requisition {Id}", id);
            return StatusCode(500, new { message = "An error occurred while deleting the requisition. Please try again or contact support." });
        }
    }
}

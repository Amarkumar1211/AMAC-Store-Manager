using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;
using StoreManager.Api.Services;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly StoreDbContext _context;

    public AuthController(IAuthService authService, StoreDbContext context)
    {
        _authService = authService;
        _context = context;
    }

    [HttpPost("login")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("LoginPolicy")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var response = await _authService.LoginAsync(request);
        if (response == null)
            return Unauthorized(new { message = "Invalid username or password." });
        return Ok(response);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var jti = User.FindFirstValue("jti");
        if (string.IsNullOrEmpty(jti))
            return Ok(new { message = "Logged out." }); // no jti = old token, nothing to revoke

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var userId);

        // Parse token expiry from the exp claim
        var expStr = User.FindFirstValue("exp");
        var tokenExpiry = DateTime.UtcNow.AddDays(30); // safe fallback
        if (long.TryParse(expStr, out var exp))
            tokenExpiry = DateTimeOffset.FromUnixTimeSeconds(exp).UtcDateTime;

        await _authService.LogoutAsync(jti, userId, tokenExpiry);
        return Ok(new { message = "Logged out successfully. Token revoked." });
    }

    [Authorize]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserCreateDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var adminUserId);
        var currentUser = await _context.Users.FindAsync(adminUserId);
        var currentUserPerms = currentUser != null ? await _authService.GetUserEffectivePermissionsAsync(currentUser.Id, currentUser.Role) : new List<string>();

        bool canManageUsers = currentUser?.Role == UserRole.Admin || currentUserPerms.Contains("user_management") || currentUserPerms.Contains("all");
        if (!canManageUsers)
        {
            return Forbid();
        }

        var user = await _authService.RegisterUserAsync(dto, adminUserId);

        return Ok(new { message = "User registered successfully.", username = user?.Username });
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

        var success = await _authService.ChangePasswordAsync(userId, request);
        if (!success) return BadRequest(new { message = "Incorrect current password." });

        return Ok(new { message = "Password changed successfully." });
    }

    [Authorize]
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(currentUserIdStr, out var currentUserId);
        var currentUser = await _context.Users.FindAsync(currentUserId);
        var currentUserPerms = currentUser != null ? await _authService.GetUserEffectivePermissionsAsync(currentUser.Id, currentUser.Role) : new List<string>();

        bool canManageUsers = currentUser?.Role == UserRole.Admin || currentUserPerms.Contains("user_management") || currentUserPerms.Contains("settings") || currentUserPerms.Contains("all");
        if (!canManageUsers)
        {
            return Forbid();
        }

        var users = await _authService.GetAllUsersAsync();

        // Load permissions from normalized UserPermissions table
        var allUserPermRows = await _context.UserPermissions.ToListAsync();
        var permsByUser = allUserPermRows
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.Permission).ToList());

        // FALLBACK: also check legacy JSON blob for users not yet migrated
        var permsConfig = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == "UserPermissionsMap");
        var legacyPermsMap = new Dictionary<string, List<string>>();
        if (permsConfig != null && !string.IsNullOrWhiteSpace(permsConfig.Value))
        {
            try { legacyPermsMap = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, List<string>>>(permsConfig.Value) ?? new(); }
            catch { }
        }

        return Ok(users.Select(u =>
        {
            bool isTargetRootAdmin = (u.Username.ToLower() == "admin" || u.Id == 1);

            List<string> userPerms;
            if (u.Role == UserRole.Admin)
                userPerms = AuthService.GetDefaultPermissionsForRole(UserRole.Admin);
            else if (permsByUser.TryGetValue(u.Id, out var tablePerms) && tablePerms.Count > 0)
                userPerms = tablePerms;
            else if (legacyPermsMap.TryGetValue(u.Id.ToString(), out var legacyPerms) && legacyPerms?.Count > 0)
                userPerms = legacyPerms!;
            else
                userPerms = AuthService.GetDefaultPermissionsForRole(u.Role);

            return new
            {
                u.Id,
                u.Username,
                u.FullName,
                u.Email,
                u.VisiblePassword,
                Role = u.Role.ToString(),
                Permissions = userPerms,
                IsPrimaryAdmin = isTargetRootAdmin,
                // PRIVACY: SignatureDataUrl intentionally EXCLUDED from list endpoint.
                // Use GET /api/auth/users/{id}/signature to retrieve a specific user's signature.
                u.IsActive,
                u.CreatedAt,
                u.LastLoginAt
            };
        }));
    }

    [Authorize]
    [HttpGet("users/{id}/signature")]
    public async Task<IActionResult> GetUserSignature(int id)
    {
        var targetUser = await _context.Users.FindAsync(id);
        if (targetUser == null) return NotFound(new { message = "User not found." });

        var signatureRecord = await _context.UserSignatures.FirstOrDefaultAsync(s => s.UserId == id);

        return Ok(new
        {
            userId = targetUser.Id,
            username = targetUser.Username,
            signatureDataUrl = signatureRecord?.SignatureDataUrl ?? ""
        });
    }
    [Authorize]
    [HttpGet("users/{id}/permissions")]
    public async Task<IActionResult> GetUserPermissions(int id)
    {
        var targetUser = await _context.Users.FindAsync(id);
        if (targetUser == null) return NotFound(new { message = "User not found." });

        var perms = await _authService.GetUserEffectivePermissionsAsync(targetUser.Id, targetUser.Role);
        return Ok(new
        {
            userId = targetUser.Id,
            username = targetUser.Username,
            role = targetUser.Role.ToString(),
            permissions = perms,
            isPrimaryAdmin = (targetUser.Username.ToLower() == "admin" || targetUser.Id == 1)
        });
    }

    [Authorize]
    [HttpPost("users/{id}/permissions")]
    public async Task<IActionResult> UpdateUserPermissions(int id, [FromBody] UserPermissionsUpdateRequest request)
    {
        var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(currentUserIdStr, out var currentUserId);
        var currentUser = await _context.Users.FindAsync(currentUserId);
        var currentUserPerms = currentUser != null ? await _authService.GetUserEffectivePermissionsAsync(currentUser.Id, currentUser.Role) : new List<string>();

        bool canManageUsers = currentUser?.Role == UserRole.Admin || currentUserPerms.Contains("user_management") || currentUserPerms.Contains("all");
        if (!canManageUsers)
        {
            return Forbid();
        }

        var targetUser = await _context.Users.FindAsync(id);
        if (targetUser == null) return NotFound(new { message = "User not found." });

        // Immutable Primary Admin Protection Guard: root admin cannot have permissions stripped
        if (targetUser.Username.ToLower() == "admin" || targetUser.Id == 1)
        {
            return Ok(new { message = "Primary System Administrator always maintains full unrestricted permissions.", permissions = AuthService.GetDefaultPermissionsForRole(UserRole.Admin) });
        }

        var perms = request?.Permissions ?? new List<string>();

        // Store in normalized UserPermissions table (replaces JSON blob approach)
        var existing = await _context.UserPermissions.Where(p => p.UserId == id).ToListAsync();
        _context.UserPermissions.RemoveRange(existing);
        _context.UserPermissions.AddRange(perms.Distinct().Select(p => new UserPermission
        {
            UserId = id,
            Permission = p
        }));

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = currentUserId,
            Action = "UPDATE_PERMISSIONS",
            EntityName = "User",
            RecordId = targetUser.Username,
            NewValues = $"Updated permissions count: {perms.Count} modules assigned by User ID {currentUserId}",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(new { message = "User permissions updated successfully.", permissions = perms });
    }

    [Authorize]
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var adminUserId);
        var currentUser = await _context.Users.FindAsync(adminUserId);
        var currentUserPerms = currentUser != null ? await _authService.GetUserEffectivePermissionsAsync(currentUser.Id, currentUser.Role) : new List<string>();

        bool canManageUsers = currentUser?.Role == UserRole.Admin || currentUserPerms.Contains("user_management") || currentUserPerms.Contains("all");
        if (!canManageUsers)
        {
            return Forbid();
        }

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "User not found." });

        // Strict Root Admin Protection Guard
        if (user.Username.ToLower() == "admin" || user.Id == 1)
        {
            return BadRequest(new { message = "The Primary System Administrator account is permanently protected and cannot be deleted by any user." });
        }

        try
        {
            var success = await _authService.DeleteUserAsync(id, adminUserId);
            if (!success) return NotFound(new { message = "User not found." });

            return Ok(new { message = "User account permanently removed successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("users/{id}/reset-password")]
    public async Task<IActionResult> ResetUserPassword(int id, [FromBody] ResetPasswordAdminRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.NewPassword))
            return BadRequest(new { message = "New password is required." });

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var adminUserId);
        var currentUser = await _context.Users.FindAsync(adminUserId);
        var currentUserPerms = currentUser != null ? await _authService.GetUserEffectivePermissionsAsync(currentUser.Id, currentUser.Role) : new List<string>();

        bool canManageUsers = currentUser?.Role == UserRole.Admin || currentUserPerms.Contains("user_management") || currentUserPerms.Contains("all");
        if (!canManageUsers)
        {
            return Forbid();
        }

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "User not found." });

        // Immutable Root Admin Password Protection Guard
        bool isTargetRootAdmin = (user.Username.ToLower() == "admin" || user.Id == 1);
        bool isCallerRootAdmin = (currentUser != null && (currentUser.Id == 1 || currentUser.Username.ToLower() == "admin"));
        if (isTargetRootAdmin && !isCallerRootAdmin)
        {
            return BadRequest(new { message = "Security Guard: The Primary System Administrator password can only be modified by the Root Admin himself." });
        }

        var success = await _authService.ResetUserPasswordAsync(id, request.NewPassword.Trim(), adminUserId);
        if (!success) return NotFound(new { message = "User not found." });

        return Ok(new { message = "Password reset successfully." });
    }

    [Authorize]
    [HttpPost("users/{id}/signature")]
    public async Task<IActionResult> SaveUserSignature(int id, [FromBody] UserSignatureDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int.TryParse(userIdStr, out var currentUserId);
        var currentUser = await _context.Users.FindAsync(currentUserId);

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "User not found." });

        // Security Guard: You can only upload your own signature unless you are Administrator
        bool isSelf = (currentUserId == id);
        bool isAdmin = (currentUser?.Role == UserRole.Admin);

        if (!isSelf && !isAdmin)
        {
            return StatusCode(403, new { message = "Security Guard: You can only upload and manage your own verified digital signature. Modifying signatures of other users is strictly prohibited." });
        }

        // SECURITY: Validate signature is a safe image data URI — reject javascript: or other URIs
        if (!string.IsNullOrWhiteSpace(dto?.SignatureDataUrl))
        {
            var sig = dto.SignatureDataUrl.Trim();
            if (!sig.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Invalid signature format. Only image data URIs (data:image/...) are accepted." });
            }
        }

        // Migrate storage to normalized UserSignatures table (keyed by UserId, not username)
        var existingSig = await _context.UserSignatures.FirstOrDefaultAsync(s => s.UserId == id);

        if (string.IsNullOrWhiteSpace(dto?.SignatureDataUrl))
        {
            // Clear signature
            if (existingSig != null)
                _context.UserSignatures.Remove(existingSig);
        }
        else
        {
            if (existingSig == null)
            {
                _context.UserSignatures.Add(new UserSignature
                {
                    UserId = id,
                    SignatureDataUrl = dto.SignatureDataUrl.Trim(),
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existingSig.SignatureDataUrl = dto.SignatureDataUrl.Trim();
                existingSig.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "User digital signature saved successfully." });
    }
}

public class UserSignatureDto
{
    public string? SignatureDataUrl { get; set; }
}

public class ResetPasswordAdminRequest
{
    public string NewPassword { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var data = await _dashboardService.GetDashboardDataAsync();
        return Ok(data);
    }
}

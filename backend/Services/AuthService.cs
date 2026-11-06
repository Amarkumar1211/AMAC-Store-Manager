using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<User?> RegisterUserAsync(UserCreateDto dto, int adminUserId);
    Task<bool> ChangePasswordAsync(int userId, ChangePasswordRequest request);
    Task<bool> ResetUserPasswordAsync(int userId, string newPassword, int adminUserId);
    Task<bool> DeleteUserAsync(int userId, int adminUserId);
    Task<List<User>> GetAllUsersAsync();
    Task<List<string>> GetUserEffectivePermissionsAsync(int userId, UserRole role);
    /// <summary>Revokes the given JWT jti so it is rejected on subsequent requests.</summary>
    Task LogoutAsync(string jti, int userId, DateTime tokenExpiry);
}

public class AuthService : IAuthService
{
    private readonly StoreDbContext _context;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuthService(
        StoreDbContext context,
        IConfiguration config,
        ILogger<AuthService> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _config = config;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // ── IP Helper ──────────────────────────────────────────────────────────
    private string? GetClientIp()
        => _httpContextAccessor.HttpContext?.Connection?.RemoteIpAddress?.ToString();

    // ── Password Complexity Validation ─────────────────────────────────────
    /// <summary>Min 8 chars, at least one letter, at least one digit. Returns error message or null.</summary>
    private static string? ValidatePasswordComplexity(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            return "Password must be at least 8 characters long.";
        if (!Regex.IsMatch(password, @"[a-zA-Z]"))
            return "Password must contain at least one letter.";
        if (!Regex.IsMatch(password, @"\d"))
            return "Password must contain at least one number.";
        return null;
    }

    public static List<string> GetDefaultPermissionsForRole(UserRole role)
    {
        return role switch
        {
            UserRole.Admin => new List<string> {
                "all", "materials", "stock", "receipts", "issues", "adjustment",
                "purchase-requests", "purchase-orders", "suppliers", "projection-plan",
                "manufacturing", "dashboard", "reports", "settings", "user_management",
                "can_export", "can_delete", "can_approve"
            },
            UserRole.StoreManager => new List<string> {
                "materials", "stock", "receipts", "issues", "adjustment",
                "purchase-requests", "purchase-orders", "suppliers", "projection-plan",
                "manufacturing", "dashboard", "reports", "can_export", "can_approve"
            },
            UserRole.PurchaseUser => new List<string> {
                "purchase-requests", "purchase-orders", "suppliers", "materials",
                "stock", "dashboard", "reports", "can_export"
            },
            UserRole.DepartmentUser => new List<string> {
                "department-portal", "issues", "materials"
            },
            UserRole.StoreUser => new List<string> {
                "materials", "stock", "receipts", "issues", "dashboard", "can_export"
            },
            UserRole.Viewer => new List<string> {
                "dashboard", "reports", "stock", "projection-plan", "can_export"
            },
            _ => new List<string> { "department-portal", "materials", "stock" }
        };
    }

    public async Task<List<string>> GetUserEffectivePermissionsAsync(int userId, UserRole role)
    {
        if (role == UserRole.Admin)
            return GetDefaultPermissionsForRole(UserRole.Admin);

        try
        {
            // PRIMARY: Normalized UserPermissions table
            var tablePerms = await _context.UserPermissions
                .Where(p => p.UserId == userId)
                .Select(p => p.Permission)
                .ToListAsync();
            if (tablePerms.Count > 0)
                return tablePerms;

            // FALLBACK: Legacy JSON blob in SystemConfigurations
            var config = await _context.SystemConfigurations
                .FirstOrDefaultAsync(c => c.Key == "UserPermissionsMap");
            if (config != null && !string.IsNullOrWhiteSpace(config.Value))
            {
                var map = System.Text.Json.JsonSerializer
                    .Deserialize<Dictionary<string, List<string>>>(config.Value);
                if (map != null && map.TryGetValue(userId.ToString(), out var perms)
                    && perms != null && perms.Count > 0)
                    return perms;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read permissions for user {UserId}.", userId);
        }

        return GetDefaultPermissionsForRole(role);
    }

    // ── Logout / Token Revocation ──────────────────────────────────────────
    public async Task LogoutAsync(string jti, int userId, DateTime tokenExpiry)
    {
        var now = DateTime.UtcNow;
        // Prune expired tokens to keep table lean
        var expired = await _context.RevokedTokens.Where(t => t.ExpiresAt < now).ToListAsync();
        _context.RevokedTokens.RemoveRange(expired);

        _context.RevokedTokens.Add(new RevokedToken
        {
            Jti = jti,
            UserId = userId,
            RevokedAt = now,
            ExpiresAt = tokenExpiry
        });
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "LOGOUT",
            EntityName = "User",
            RecordId = jti,
            Timestamp = now,
            IpAddress = GetClientIp()
        });
        await _context.SaveChangesAsync();
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var inputUser = (request.Username ?? "").Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => (
            u.Username.ToLower() == inputUser ||
            (inputUser == "manager" && (u.Username == "store.manager" || u.Username == "storemanager")) ||
            (inputUser == "storemanager" && (u.Username == "store.manager" || u.Username == "manager")) ||
            (inputUser == "store" && (u.Username == "store.user" || u.Username == "storeuser")) ||
            (inputUser == "storeuser" && (u.Username == "store.user" || u.Username == "store")) ||
            (inputUser == "purchase" && (u.Username == "purchase.user" || u.Username == "purchaseuser")) ||
            (inputUser == "purchaseuser" && (u.Username == "purchase.user" || u.Username == "purchase"))
        ) && u.IsActive);

        if (user == null) return null;
        if (string.IsNullOrWhiteSpace(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        user.LastLoginAt = DateTime.UtcNow;
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            Username = user.Username,
            Action = "LOGIN",
            EntityName = "User",
            RecordId = user.Username,
            Timestamp = DateTime.UtcNow,
            IpAddress = GetClientIp()
        });
        await _context.SaveChangesAsync();

        var permissions = await GetUserEffectivePermissionsAsync(user.Id, user.Role);
        var token = GenerateJwtToken(user, out _);
        var userDto = new UserDto(user.Id, user.Username, user.FullName, user.Role.ToString(), user.Email, permissions, user.DepartmentId, user.DepartmentName);
        return new LoginResponse(token, user.Username, user.FullName, user.Role.ToString(), user.Id, userDto, permissions, user.DepartmentId, user.DepartmentName);
    }

    public async Task<User?> RegisterUserAsync(UserCreateDto dto, int adminUserId)
    {
        if (await _context.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower()))
            throw new InvalidOperationException($"Username '{dto.Username}' already exists.");

        var passError = ValidatePasswordComplexity(dto.Password);
        if (passError != null)
            throw new InvalidOperationException(passError);

        var user = new User
        {
            Username = dto.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            FullName = dto.FullName.Trim(),
            Email = dto.Email?.Trim(),
            Role = dto.Role,
            DepartmentId = dto.DepartmentId,
            DepartmentName = dto.DepartmentName,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            VisiblePassword = dto.Password
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Save permissions to normalized table
        if (dto.Permissions != null && dto.Permissions.Count > 0)
        {
            var rows = dto.Permissions.Distinct().Select(p => new UserPermission
            {
                UserId = user.Id,
                Permission = p
            });
            _context.UserPermissions.AddRange(rows);
        }

        _context.AuditLogs.Add(new AuditLog
        {
            UserId = adminUserId,
            Action = "CREATE",
            EntityName = "User",
            RecordId = user.Username,
            NewValues = $"FullName: {user.FullName}, Role: {user.Role}",
            Timestamp = DateTime.UtcNow,
            IpAddress = GetClientIp()
        });

        await _context.SaveChangesAsync();
        return user;
    }

    public async Task<bool> ChangePasswordAsync(int userId, ChangePasswordRequest request)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;
        if (!BCrypt.Net.BCrypt.Verify(request.OldPassword, user.PasswordHash))
            return false;

        var passError = ValidatePasswordComplexity(request.NewPassword);
        if (passError != null)
            throw new InvalidOperationException(passError);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.VisiblePassword = request.NewPassword;
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = "UPDATE",
            EntityName = "UserPassword",
            RecordId = user.Username,
            Timestamp = DateTime.UtcNow,
            IpAddress = GetClientIp()
        });

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ResetUserPasswordAsync(int userId, string newPassword, int adminUserId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        var passError = ValidatePasswordComplexity(newPassword);
        if (passError != null)
            throw new InvalidOperationException(passError);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.VisiblePassword = newPassword;
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = adminUserId,
            Action = "UPDATE",
            EntityName = "UserPasswordResetByAdmin",
            RecordId = user.Username,
            NewValues = $"Password reset by Admin ID {adminUserId}",
            Timestamp = DateTime.UtcNow,
            IpAddress = GetClientIp()
        });

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteUserAsync(int userId, int adminUserId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        if (user.Username.ToLower() == "admin" || user.Id == 1)
            throw new InvalidOperationException("The Primary System Administrator account is permanently protected and cannot be deleted or modified by any user.");

        _context.Users.Remove(user);
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = adminUserId,
            Action = "DELETE",
            EntityName = "User",
            RecordId = user.Username,
            NewValues = $"User {user.FullName} ({user.Username}) permanently deleted by Admin ID {adminUserId}",
            Timestamp = DateTime.UtcNow,
            IpAddress = GetClientIp()
        });

        // Clean up legacy JSON blob permissions entry
        try
        {
            var config = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == "UserPermissionsMap");
            if (config != null && !string.IsNullOrWhiteSpace(config.Value))
            {
                var map = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, List<string>>>(config.Value) ?? new();
                if (map.Remove(userId.ToString()))
                    config.Value = System.Text.Json.JsonSerializer.Serialize(map);
            }
        }
        catch { }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<User>> GetAllUsersAsync()
    {
        return await _context.Users
            .OrderBy(u => u.FullName)
            .ToListAsync();
    }

    private string GenerateJwtToken(User user, out string jti)
    {
        var configuredKey = _config["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(configuredKey) || configuredKey.Length < 32)
            throw new InvalidOperationException("Jwt:Key must be configured with at least 32 characters.");

        jti = Guid.NewGuid().ToString("N"); // unique token ID for revocation

        var key = Encoding.UTF8.GetBytes(configuredKey);
        var tokenHandler = new JwtSecurityTokenHandler();
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Jti, jti), // revocation tracking
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.GivenName, user.FullName),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            }),
            Expires = DateTime.UtcNow.AddDays(Convert.ToDouble(_config["Jwt:ExpiryDays"] ?? "30")),
            Issuer = _config["Jwt:Issuer"] ?? "StoreManagerApi",
            Audience = _config["Jwt:Audience"] ?? "StoreManagerClient",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}

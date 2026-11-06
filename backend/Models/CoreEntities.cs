using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StoreManager.Api.Models;

[Table("Users")]
public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public string? VisiblePassword { get; set; }

    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? Email { get; set; }

    [Required]
    public UserRole Role { get; set; } = UserRole.StoreUser;

    public int? DepartmentId { get; set; }

    [MaxLength(100)]
    public string? DepartmentName { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LastLoginAt { get; set; }
}

[Table("AuditLogs")]
public class AuditLog
{
    [Key]
    public long Id { get; set; }

    public int? UserId { get; set; }
    public string? Username { get; set; }

    [Required]
    [MaxLength(50)]
    public string Action { get; set; } = string.Empty; // CREATE, UPDATE, DELETE, APPROVE, REJECT, RECEIVE, ISSUE, ADJUST, IMPORT

    [Required]
    [MaxLength(100)]
    public string EntityName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? RecordId { get; set; }

    public string? OldValues { get; set; }
    public string? NewValues { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [MaxLength(50)]
    public string? IpAddress { get; set; }
}

[Table("SystemConfigurations")]
public class SystemConfiguration
{
    [Key]
    [MaxLength(100)]
    public string Key { get; set; } = string.Empty;

    [Required]
    public string Value { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Description { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("Departments")]
public class Department
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Code { get; set; }

    public bool IsActive { get; set; } = true;
}

[Table("MaterialCategories")]
public class MaterialCategory
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty; // INGOT, PAINT, CONSUMABLE, CHEMICAL, COATING, CYLINDER, OIL, CORE, etc.

    [MaxLength(255)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}

// ============================================================
// SECURITY: Token revocation for proper logout invalidation
// ============================================================
[Table("RevokedTokens")]
public class RevokedToken
{
    [Key]
    [MaxLength(150)]
    public string Jti { get; set; } = string.Empty; // JWT ID (jti claim)

    public int? UserId { get; set; }

    public DateTime RevokedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Token's original expiry — used for cleanup pruning.</summary>
    public DateTime ExpiresAt { get; set; }
}

// ============================================================
// SECURITY: Per-user permissions stored as rows, not JSON blob
// ============================================================
[Table("UserPermissions")]
public class UserPermission
{
    [Key]
    public int Id { get; set; }

    public int UserId { get; set; }
    [ForeignKey("UserId")]
    public User? User { get; set; }

    [Required]
    [MaxLength(80)]
    public string Permission { get; set; } = string.Empty;
}

// ============================================================
// PRIVACY: User digital signatures stored by UserId (not username)
// ============================================================
[Table("UserSignatures")]
public class UserSignature
{
    [Key]
    public int Id { get; set; }

    public int UserId { get; set; }
    [ForeignKey("UserId")]
    public User? User { get; set; }

    /// <summary>
    /// Base64 data URL of the digital signature image (data:image/png;base64,...).
    /// Validated on input to ensure only image data URIs are stored.
    /// </summary>
    public string SignatureDataUrl { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

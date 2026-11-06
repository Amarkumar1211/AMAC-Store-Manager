using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StoreManager.Api.Models;

[Table("CoreMaster")]
public class CoreMaster
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string CoreCode { get; set; } = string.Empty; // e.g. M049, M050

    [Required]
    [MaxLength(150)]
    public string CoreName { get; set; } = string.Empty; // e.g. CPN6-055, CPN6148, TML

    [MaxLength(20)]
    public string Uom { get; set; } = "NOS";

    [Column(TypeName = "decimal(18, 4)")]
    public decimal WeightPerUnitKg { get; set; } = 0; // Sand weight in kg

    [Column(TypeName = "decimal(18, 4)")]
    public decimal StandardPrice { get; set; } = 0;

    public int? SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    public bool IsActive { get; set; } = true;
}

[Table("CoreDailyTrackings")]
public class CoreDailyTracking
{
    [Key]
    public int Id { get; set; }

    public int CoreId { get; set; }
    [ForeignKey("CoreId")]
    public CoreMaster? Core { get; set; }

    public DateTime TrackingDate { get; set; } = DateTime.UtcNow;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PlannedQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ActualQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal DispatchedQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitPrice { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalCost { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal VarianceQuantity { get; set; } = 0; // Actual - Planned

    [Column(TypeName = "decimal(18, 2)")]
    public decimal AchievementPercentage { get; set; } = 0;
}

[Table("CoreRejections")]
public class CoreRejection
{
    [Key]
    public int Id { get; set; }

    public int? CoreId { get; set; }
    [ForeignKey("CoreId")]
    public CoreMaster? Core { get; set; }

    [Required]
    [MaxLength(150)]
    public string CoreOrMaterialName { get; set; } = string.Empty;

    public DateTime RejectionDate { get; set; } = DateTime.UtcNow;
    public DateTime? InwardDate { get; set; }

    [MaxLength(100)]
    public string? InvoiceNumber { get; set; }

    public int? SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    [MaxLength(150)]
    public string? SupplierName { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RejectedQuantity { get; set; }

    [MaxLength(200)]
    public string? Reason { get; set; }

    [MaxLength(300)]
    public string? Remarks { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "PendingReturn"; // PendingReturn, Returned, Scrapped, Replaced
}

[Table("CylinderMaster")]
public class CylinderMaster
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string CylinderCode { get; set; } = string.Empty; // e.g. CYL-17LPG, CYL-33LPG, CYL-O2, CYL-AR

    [Required]
    [MaxLength(150)]
    public string CylinderName { get; set; } = string.Empty; // e.g. 17KG LPG, 33KG LPG, DA Gas, Oxygen, Argon

    [MaxLength(50)]
    public string GasType { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Capacity { get; set; } = string.Empty;

    public int? DefaultSupplierId { get; set; }
    [ForeignKey("DefaultSupplierId")]
    public Supplier? DefaultSupplier { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal CurrentFullStock { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal CurrentEmptyStock { get; set; } = 0;

    public bool IsActive { get; set; } = true;
}

[Table("CylinderTransactions")]
public class CylinderTransaction
{
    [Key]
    public int Id { get; set; }

    public int CylinderId { get; set; }
    [ForeignKey("CylinderId")]
    public CylinderMaster? Cylinder { get; set; }

    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    public int? SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal FullReceivedQty { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal EmptyReturnedQty { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal DailyConsumedQty { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal AvailableFullBalance { get; set; } = 0;

    [MaxLength(300)]
    public string? Remarks { get; set; }

    public int? CreatedByUserId { get; set; }
    [ForeignKey("CreatedByUserId")]
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("Employees")]
public class Employee
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty; // e.g. 1117, 164

    [Required]
    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Designation { get; set; }

    public int? DepartmentId { get; set; }
    [ForeignKey("DepartmentId")]
    public Department? Department { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("StoreAttendances")]
public class StoreAttendance
{
    [Key]
    public int Id { get; set; }

    public int EmployeeId { get; set; }
    [ForeignKey("EmployeeId")]
    public Employee? Employee { get; set; }

    public DateTime AttendanceDate { get; set; } = DateTime.UtcNow;

    public AttendanceStatus Status { get; set; } = AttendanceStatus.P;

    [Column(TypeName = "decimal(18, 2)")]
    public decimal WorkingHours { get; set; } = 8;

    [Column(TypeName = "decimal(18, 2)")]
    public decimal OvertimeHours { get; set; } = 0;

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

[Table("CottonGloveConsumptions")]
public class CottonGloveConsumption
{
    [Key]
    public int Id { get; set; }

    public int? DepartmentId { get; set; }
    [ForeignKey("DepartmentId")]
    public Department? Department { get; set; }

    [MaxLength(150)]
    public string? DepartmentName { get; set; }

    [Required]
    [MaxLength(100)]
    public string SupervisorName { get; set; } = string.Empty;

    public int ManpowerCount { get; set; } = 0;

    public DateTime LogDate { get; set; } = DateTime.UtcNow;

    public int WeekNumber { get; set; } = 1; // 1 to 5

    [Column(TypeName = "decimal(18, 4)")]
    public decimal QuantityIssued { get; set; } = 0;

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

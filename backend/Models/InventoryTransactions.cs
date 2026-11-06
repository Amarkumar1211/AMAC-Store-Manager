using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StoreManager.Api.Models;

[Table("StockLedger")]
public class StockLedger
{
    [Key]
    public long Id { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    public TransactionType TransactionType { get; set; } // Opening, Receipt, Issue, Adjustment, Return, Rejection

    public ReferenceType ReferenceType { get; set; } // OpeningBalance, GRN, IssueSlip, StockAdjustment, etc.

    public long? ReferenceId { get; set; }

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; } // GRN number, Issue slip number, etc.

    [Column(TypeName = "decimal(18, 4)")]
    public decimal QuantityIn { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal QuantityOut { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitCost { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalCost { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal BalanceQuantityAfter { get; set; } = 0;

    [MaxLength(60)]
    public string? BatchNumber { get; set; } // Batch / Heat / Melt code for Ingots & Traceable items

    [MaxLength(300)]
    public string? Notes { get; set; }

    public int? CreatedByUserId { get; set; }
    [ForeignKey("CreatedByUserId")]
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("MaterialBatches")]
public class MaterialBatch
{
    [Key]
    public int Id { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [Required]
    [MaxLength(60)]
    public string BatchNumber { get; set; } = string.Empty; // e.g. 23aa, 24aa, HT-1092

    public DateTime FirstReceiptDate { get; set; } = DateTime.UtcNow;
    public DateTime LatestReceiptDate { get; set; } = DateTime.UtcNow;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal InwardQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal IssuedQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal CurrentStock { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitPrice { get; set; } = 0; // Recorded batch rate (₹/kg)

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalValuation { get; set; } = 0; // CurrentStock * UnitPrice

    public int? LastSupplierId { get; set; }
    [ForeignKey("LastSupplierId")]
    public Supplier? LastSupplier { get; set; }

    [MaxLength(150)]
    public string? LastSupplierName { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[Table("StockAdjustments")]
public class StockAdjustment
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string AdjustmentNumber { get; set; } = string.Empty;

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    public DateTime AdjustmentDate { get; set; } = DateTime.UtcNow;

    public AdjustmentType AdjustmentType { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal SystemStock { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PhysicalStock { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal AdjustmentQuantity { get; set; } // Physical - System (+ or -)

    [Required]
    [MaxLength(300)]
    public string Reason { get; set; } = string.Empty;

    public int? ApprovedByUserId { get; set; }
    [ForeignKey("ApprovedByUserId")]
    public User? ApprovedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("MaterialReceipts")]
public class MaterialReceipt
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string GrnNumber { get; set; } = string.Empty; // GRN/2026/0001

    public DateTime ReceiptDate { get; set; } = DateTime.UtcNow;

    public int? SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    [MaxLength(150)]
    public string? SupplierName { get; set; }

    public int? PurchaseOrderId { get; set; }

    [MaxLength(100)]
    public string? PoNumber { get; set; }

    [MaxLength(100)]
    public string? InvoiceNumber { get; set; }

    public DateTime? InvoiceDate { get; set; }

    [MaxLength(100)]
    public string? DcNumber { get; set; }

    [MaxLength(100)]
    public string? VehicleNumber { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalAmount { get; set; } = 0;

    [MaxLength(300)]
    public string? Remarks { get; set; }

    public int? ReceivedByUserId { get; set; }
    [ForeignKey("ReceivedByUserId")]
    public User? ReceivedByUser { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected

    public int? ApprovedByUserId { get; set; }
    [ForeignKey("ApprovedByUserId")]
    public User? ApprovedByUser { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<MaterialReceiptItem> Items { get; set; } = new();
}

[Table("MaterialReceiptItems")]
public class MaterialReceiptItem
{
    [Key]
    public int Id { get; set; }

    public int MaterialReceiptId { get; set; }
    [ForeignKey("MaterialReceiptId")]
    public MaterialReceipt? MaterialReceipt { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [MaxLength(60)]
    public string? BatchNumber { get; set; } // e.g. 23aa, 24aa

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ReceivedQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalAmount { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

[Table("MaterialIssues")]
public class MaterialIssue
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string IssueSlipNumber { get; set; } = string.Empty; // Format: KDC-STR-FF-09 Rev 01

    public DateTime IssueDate { get; set; } = DateTime.UtcNow;

    public int? DepartmentId { get; set; }
    [ForeignKey("DepartmentId")]
    public Department? Department { get; set; }

    [MaxLength(100)]
    public string? SupervisorName { get; set; }

    [MaxLength(50)]
    public string? Shift { get; set; } // Shift 1, Shift 2, Shift 3, General

    [MaxLength(200)]
    public string? Purpose { get; set; } // Machine / Job / Process purpose

    [MaxLength(100)]
    public string? IssuedTo { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalIssueCost { get; set; } = 0;

    [MaxLength(300)]
    public string? Remarks { get; set; }

    public int? IssuedByUserId { get; set; }
    [ForeignKey("IssuedByUserId")]
    public User? IssuedByUser { get; set; }

    public string? SupervisorSignature { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<MaterialIssueItem> Items { get; set; } = new();
}

[Table("MaterialIssueItems")]
public class MaterialIssueItem
{
    [Key]
    public int Id { get; set; }

    public int MaterialIssueId { get; set; }
    [ForeignKey("MaterialIssueId")]
    public MaterialIssue? MaterialIssue { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [MaxLength(60)]
    public string? BatchNumber { get; set; } // e.g. 23aa, 24aa

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RequestedQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal IssuedQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitCost { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalCost { get; set; }

    [MaxLength(100)]
    public string? Location { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StoreManager.Api.Models;

[Table("PurchaseRequests")]
public class PurchaseRequest
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string PrNumber { get; set; } = string.Empty; // PR/2026/0001 (Format: GDC-PUR-FF-07)

    public DateTime RequestDate { get; set; } = DateTime.UtcNow;

    public int? DepartmentId { get; set; }
    [ForeignKey("DepartmentId")]
    public Department? Department { get; set; }

    public PrPriority Priority { get; set; } = PrPriority.Normal; // Normal, Urgent, Emergency

    public DateTime? RequiredByDate { get; set; }

    public PrStatus Status { get; set; } = PrStatus.Draft; // Draft, Submitted, Approved, Rejected, ConvertedToPO, PartiallyReceived, Completed, Cancelled

    [MaxLength(200)]
    public string? Purpose { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalEstimatedValue { get; set; } = 0;

    [MaxLength(300)]
    public string? ApprovalRemarks { get; set; }

    public int? CreatedByUserId { get; set; }
    [ForeignKey("CreatedByUserId")]
    public User? CreatedByUser { get; set; }

    public int? ApprovedByUserId { get; set; }
    [ForeignKey("ApprovedByUserId")]
    public User? ApprovedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PurchaseRequestItem> Items { get; set; } = new();
}

[Table("PurchaseRequestItems")]
public class PurchaseRequestItem
{
    [Key]
    public int Id { get; set; }

    public int PurchaseRequestId { get; set; }
    [ForeignKey("PurchaseRequestId")]
    public PurchaseRequest? PurchaseRequest { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RequestedQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal AvailableStockAtRequest { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ReorderLevelAtRequest { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal EstimatedUnitPrice { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalAmount { get; set; } = 0;

    public int? PreferredSupplierId { get; set; }
    [ForeignKey("PreferredSupplierId")]
    public Supplier? PreferredSupplier { get; set; }

    [MaxLength(150)]
    public string? PresentSupplierName { get; set; }

    [MaxLength(100)]
    public string? DiscountTerms { get; set; }

    [MaxLength(200)]
    public string? Purpose { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

[Table("PurchaseOrders")]
public class PurchaseOrder
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string PoNumber { get; set; } = string.Empty; // PO/2026/0001

    public DateTime PoDate { get; set; } = DateTime.UtcNow;

    public int? SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    [MaxLength(150)]
    public string? SupplierName { get; set; }

    public int? PurchaseRequestId { get; set; }
    [ForeignKey("PurchaseRequestId")]
    public PurchaseRequest? PurchaseRequest { get; set; }

    public DateTime? ExpectedDeliveryDate { get; set; }

    public PoStatus Status { get; set; } = PoStatus.Draft; // Draft, Issued, PartiallyReceived, Completed, Cancelled

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalAmount { get; set; } = 0;

    [MaxLength(100)]
    public string? PaymentTerms { get; set; }

    [MaxLength(300)]
    public string? DeliveryAddress { get; set; }

    [MaxLength(300)]
    public string? Remarks { get; set; }

    public int? CreatedByUserId { get; set; }
    [ForeignKey("CreatedByUserId")]
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PurchaseOrderItem> Items { get; set; } = new();
}

[Table("PurchaseOrderItems")]
public class PurchaseOrderItem
{
    [Key]
    public int Id { get; set; }

    public int PurchaseOrderId { get; set; }
    [ForeignKey("PurchaseOrderId")]
    public PurchaseOrder? PurchaseOrder { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PoQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ReceivedQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PendingQuantity { get; set; } = 0; // PoQuantity - ReceivedQuantity

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalPrice { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

[Table("BudgetMasters")]
public class BudgetMaster
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = "2026-2027";

    [Required]
    [MaxLength(20)]
    public string PeriodMonth { get; set; } = "July 2026";

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalBudgetAmount { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<MaterialBudget> Items { get; set; } = new();
}

[Table("MaterialBudgets")]
public class MaterialBudget
{
    [Key]
    public int Id { get; set; }

    public int BudgetMasterId { get; set; }
    [ForeignKey("BudgetMasterId")]
    public BudgetMaster? BudgetMaster { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    public int? SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ReorderLevelBudget { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RequirementQuantity { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitPrice { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal BudgetAmount { get; set; } = 0; // RequirementQuantity * UnitPrice
}

[Table("CostSavingInitiatives")]
public class CostSavingInitiative
{
    [Key]
    public int Id { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [MaxLength(150)]
    public string? CurrentSupplier { get; set; }

    [MaxLength(150)]
    public string? NewSupplier { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal CurrentSupplierPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal NewSupplierPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PriceDifference { get; set; } // Current - New

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PerMonthAveragePurchaseQty { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal MonthlyCostSavings { get; set; } // PriceDifference * PerMonthAveragePurchaseQty

    [MaxLength(300)]
    public string? Remarks { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

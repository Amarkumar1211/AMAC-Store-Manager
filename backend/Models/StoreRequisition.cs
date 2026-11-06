using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StoreManager.Api.Models;

[Table("StoreRequisitions")]
public class StoreRequisition
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string RequisitionNumber { get; set; } = string.Empty; // Format: SREQ-202609-0001

    public DateTime RequisitionDate { get; set; } = DateTime.UtcNow;

    public DateTime? RequiredDate { get; set; }

    public int? DepartmentId { get; set; }
    [ForeignKey("DepartmentId")]
    public Department? Department { get; set; }

    [MaxLength(100)]
    public string? RequestedBy { get; set; }

    public int? RequestedByUserId { get; set; }
    [ForeignKey("RequestedByUserId")]
    public User? RequestedByUser { get; set; }

    [MaxLength(50)]
    public string? Shift { get; set; } = "Shift A"; // Shift A, Shift B

    [MaxLength(200)]
    public string? Purpose { get; set; } = "Production Consumption";

    [MaxLength(100)]
    public string? JobOrderOrMachine { get; set; }

    /// <summary>
    /// Current status of this requisition. Stored as a string in DB for readability.
    /// </summary>
    public RequisitionStatus Status { get; set; } = RequisitionStatus.Pending;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalEstimatedCost { get; set; } = 0;

    [MaxLength(500)]
    public string? Remarks { get; set; }

    // Processing / Store Manager Review Fields
    public int? ProcessedByUserId { get; set; }
    [ForeignKey("ProcessedByUserId")]
    public User? ProcessedByUser { get; set; }

    public DateTime? ProcessedAt { get; set; }

    [MaxLength(500)]
    public string? DenialRemarks { get; set; }

    [MaxLength(50)]
    public string? ResultingIssueSlipNumber { get; set; }

    public int? ResultingMaterialIssueId { get; set; }
    [ForeignKey("ResultingMaterialIssueId")]
    public MaterialIssue? ResultingMaterialIssue { get; set; }

    public string? SupervisorSignature { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public List<StoreRequisitionItem> Items { get; set; } = new();
}

[Table("StoreRequisitionItems")]
public class StoreRequisitionItem
{
    [Key]
    public int Id { get; set; }

    public int StoreRequisitionId { get; set; }
    [ForeignKey("StoreRequisitionId")]
    public StoreRequisition? StoreRequisition { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [MaxLength(60)]
    public string? BatchNumber { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RequestedQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ApprovedQuantity { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal UnitPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal TotalCost { get; set; }

    [MaxLength(100)]
    public string? Location { get; set; }

    [MaxLength(200)]
    public string? ItemRemarks { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace StoreManager.Api.DTOs;

public record StoreRequisitionItemDto(
    int Id,
    int MaterialId,
    string MaterialCode,
    string MaterialName,
    string? CategoryName,
    string DefaultUom,
    string? BatchNumber,
    decimal RequestedQuantity,
    decimal ApprovedQuantity,
    decimal CurrentStock,
    decimal ReorderLevel,
    string StockStatus,
    decimal UnitPrice,
    decimal TotalCost,
    string? Location,
    string? ItemRemarks
);

public record StoreRequisitionDto(
    int Id,
    string RequisitionNumber,
    DateTime RequisitionDate,
    DateTime? RequiredDate,
    int? DepartmentId,
    string? DepartmentName,
    string? RequestedBy,
    int? RequestedByUserId,
    string? RequestedByUsername,
    string Shift,
    string Purpose,
    string? JobOrderOrMachine,
    string Status, // Pending, Allowed, Denied, Draft
    decimal TotalEstimatedCost,
    string? Remarks,
    int? ProcessedByUserId,
    string? ProcessedByUsername,
    DateTime? ProcessedAt,
    string? DenialRemarks,
    string? ResultingIssueSlipNumber,
    int? ResultingMaterialIssueId,
    string? SupervisorSignature,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<StoreRequisitionItemDto> Items
);

public class CreateStoreRequisitionItemDto
{
    [Required]
    public int MaterialId { get; set; }

    public string? BatchNumber { get; set; }

    [Range(0.0001, 999999999, ErrorMessage = "Requested quantity must be greater than zero.")]
    public decimal RequestedQuantity { get; set; }

    public string? Location { get; set; }
    public string? ItemRemarks { get; set; }
}

public class CreateStoreRequisitionDto
{
    public int? DepartmentId { get; set; }
    public DateTime? RequiredDate { get; set; }
    public string? RequestedBy { get; set; }
    public string? Shift { get; set; } = "Shift A";
    public string? Purpose { get; set; } = "Production Consumption";
    public string? JobOrderOrMachine { get; set; }
    public string? Remarks { get; set; }
    public string? SupervisorSignature { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one material line item is required.")]
    public List<CreateStoreRequisitionItemDto> Items { get; set; } = new();
}

public class UpdateStoreRequisitionItemDto
{
    public int? Id { get; set; }

    [Required]
    public int MaterialId { get; set; }

    public string? BatchNumber { get; set; }

    [Range(0, 999999999)]
    public decimal RequestedQuantity { get; set; }

    [Range(0, 999999999)]
    public decimal ApprovedQuantity { get; set; }

    public string? Location { get; set; }
    public string? ItemRemarks { get; set; }
}

public class UpdateStoreRequisitionDto
{
    public int? DepartmentId { get; set; }
    public DateTime? RequiredDate { get; set; }
    public string? RequestedBy { get; set; }
    public string? Shift { get; set; }
    public string? Purpose { get; set; }
    public string? JobOrderOrMachine { get; set; }
    public string? Remarks { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one material line item is required.")]
    public List<UpdateStoreRequisitionItemDto> Items { get; set; } = new();
}

public class ApprovedRequisitionItemOverrideDto
{
    public int MaterialId { get; set; }
    public string? BatchNumber { get; set; }
    public decimal ApprovedQuantity { get; set; }
    public string? Location { get; set; }
    public string? Remarks { get; set; }
}

public class AllowStoreRequisitionDto
{
    public string? SupervisorName { get; set; }
    public string? IssuedTo { get; set; }
    public string? Shift { get; set; }
    public string? Remarks { get; set; }
    public List<ApprovedRequisitionItemOverrideDto>? CustomApprovedItems { get; set; }
}

public class DenyStoreRequisitionDto
{
    [Required(ErrorMessage = "Denial remark / reason for rejection is mandatory.")]
    [MinLength(2, ErrorMessage = "Please enter a valid denial reason explaining why the requisition cannot be allowed.")]
    public string DenialRemarks { get; set; } = string.Empty;
}

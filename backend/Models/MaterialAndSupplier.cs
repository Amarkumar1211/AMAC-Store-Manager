using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StoreManager.Api.Models;

[Table("Materials")]
public class Material
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string MaterialCode { get; set; } = string.Empty; // e.g. M001, M002

    [Required]
    [MaxLength(200)]
    public string MaterialName { get; set; } = string.Empty; // e.g. ALSI7MG

    public int? CategoryId { get; set; }
    [ForeignKey("CategoryId")]
    public MaterialCategory? Category { get; set; }

    [MaxLength(20)]
    public string DefaultUom { get; set; } = "KG"; // KG, NOS, SET, LTR, PKT

    [Column(TypeName = "decimal(18, 4)")]
    public decimal MinStockLevel { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal ReorderLevel { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal MaxStockLevel { get; set; } = 0;

    [Column(TypeName = "decimal(18, 4)")]
    public decimal MonthlyRequirement { get; set; } = 0;

    public int? UserDepartmentId { get; set; }
    [ForeignKey("UserDepartmentId")]
    public Department? UserDepartment { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal StandardPrice { get; set; } = 0; // Current base price

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RevisedPrice { get; set; } = 0;

    [MaxLength(255)]
    public string? Specification { get; set; }

    [MaxLength(100)]
    public string? PrimarySupplierName { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

[Table("Suppliers")]
public class Supplier
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(150)]
    public string SupplierName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ContactPerson { get; set; }

    [MaxLength(50)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(50)]
    public string? GstNumber { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("SupplierMaterialPrices")]
public class SupplierMaterialPrice
{
    [Key]
    public int Id { get; set; }

    public int SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal Price { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal RevisedPrice { get; set; }

    public DateTime EffectiveDate { get; set; } = DateTime.UtcNow;

    public bool IsPreferred { get; set; } = false;

    [MaxLength(255)]
    public string? Remarks { get; set; }
}

[Table("SupplierPriceHistories")]
public class SupplierPriceHistory
{
    [Key]
    public int Id { get; set; }

    public int SupplierId { get; set; }
    [ForeignKey("SupplierId")]
    public Supplier? Supplier { get; set; }

    public int MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal OldPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal NewPrice { get; set; }

    [Column(TypeName = "decimal(18, 4)")]
    public decimal PriceDifference { get; set; }

    [Column(TypeName = "decimal(18, 2)")]
    public decimal PercentageChange { get; set; }

    public DateTime ChangedDate { get; set; } = DateTime.UtcNow;

    [MaxLength(255)]
    public string? Reason { get; set; }
}

[Table("MaterialColourCodes")]
public class MaterialColourCode
{
    [Key]
    public int Id { get; set; }

    public int? MaterialId { get; set; }
    [ForeignKey("MaterialId")]
    public Material? Material { get; set; }

    [Required]
    [MaxLength(100)]
    public string CustomerName { get; set; } = string.Empty; // e.g. Bosch

    [Required]
    [MaxLength(100)]
    public string ModelNumber { get; set; } = string.Empty; // e.g. CB18-16 13& 14

    [Required]
    [MaxLength(100)]
    public string MaterialGrade { get; set; } = string.Empty; // e.g. LM 25-AlSi7Mg

    [Required]
    [MaxLength(50)]
    public string Colour1 { get; set; } = string.Empty; // e.g. Yellow

    [MaxLength(50)]
    public string? Colour2 { get; set; } // e.g. Blue

    [MaxLength(255)]
    public string? Remarks { get; set; }
}

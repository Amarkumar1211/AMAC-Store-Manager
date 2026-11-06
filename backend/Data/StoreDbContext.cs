using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Models;

namespace StoreManager.Api.Data;

public class StoreDbContext : DbContext
{
    public StoreDbContext(DbContextOptions<StoreDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SystemConfiguration> SystemConfigurations => Set<SystemConfiguration>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<MaterialCategory> MaterialCategories => Set<MaterialCategory>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierMaterialPrice> SupplierMaterialPrices => Set<SupplierMaterialPrice>();
    public DbSet<SupplierPriceHistory> SupplierPriceHistories => Set<SupplierPriceHistory>();
    public DbSet<MaterialColourCode> MaterialColourCodes => Set<MaterialColourCode>();
    public DbSet<StockLedger> StockLedgers => Set<StockLedger>();
    public DbSet<MaterialBatch> MaterialBatches => Set<MaterialBatch>();
    public DbSet<StockAdjustment> StockAdjustments => Set<StockAdjustment>();
    public DbSet<MaterialReceipt> MaterialReceipts => Set<MaterialReceipt>();
    public DbSet<MaterialReceiptItem> MaterialReceiptItems => Set<MaterialReceiptItem>();
    public DbSet<MaterialIssue> MaterialIssues => Set<MaterialIssue>();
    public DbSet<MaterialIssueItem> MaterialIssueItems => Set<MaterialIssueItem>();
    public DbSet<PurchaseRequest> PurchaseRequests => Set<PurchaseRequest>();
    public DbSet<PurchaseRequestItem> PurchaseRequestItems => Set<PurchaseRequestItem>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<BudgetMaster> BudgetMasters => Set<BudgetMaster>();
    public DbSet<MaterialBudget> MaterialBudgets => Set<MaterialBudget>();
    public DbSet<CostSavingInitiative> CostSavingInitiatives => Set<CostSavingInitiative>();
    public DbSet<CoreMaster> CoreMasters => Set<CoreMaster>();
    public DbSet<CoreDailyTracking> CoreDailyTrackings => Set<CoreDailyTracking>();
    public DbSet<CoreRejection> CoreRejections => Set<CoreRejection>();
    public DbSet<CylinderMaster> CylinderMasters => Set<CylinderMaster>();
    public DbSet<CylinderTransaction> CylinderTransactions => Set<CylinderTransaction>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<StoreAttendance> StoreAttendances => Set<StoreAttendance>();
    public DbSet<CottonGloveConsumption> CottonGloveConsumptions => Set<CottonGloveConsumption>();
    public DbSet<StoreRequisition> StoreRequisitions => Set<StoreRequisition>();
    public DbSet<StoreRequisitionItem> StoreRequisitionItems => Set<StoreRequisitionItem>();

    // Security / Privacy tables
    public DbSet<RevokedToken> RevokedTokens => Set<RevokedToken>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<UserSignature> UserSignatures => Set<UserSignature>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User indexes & uniqueness
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // Material indexes & uniqueness
        modelBuilder.Entity<Material>()
            .HasIndex(m => m.MaterialCode)
            .IsUnique();
        modelBuilder.Entity<Material>()
            .HasIndex(m => m.MaterialName);
        modelBuilder.Entity<Material>()
            .HasIndex(m => m.CategoryId);

        // Supplier indexes
        modelBuilder.Entity<Supplier>()
            .HasIndex(s => s.SupplierName);

        // StockLedger indexes for rapid calculation & reporting
        modelBuilder.Entity<StockLedger>()
            .HasIndex(s => s.MaterialId);
        modelBuilder.Entity<StockLedger>()
            .HasIndex(s => s.TransactionDate);
        modelBuilder.Entity<StockLedger>()
            .HasIndex(s => s.TransactionType);
        modelBuilder.Entity<StockLedger>()
            .HasIndex(s => s.ReferenceNumber);

        // MaterialReceipt indexes
        modelBuilder.Entity<MaterialReceipt>()
            .HasIndex(r => r.GrnNumber)
            .IsUnique();
        modelBuilder.Entity<MaterialReceipt>()
            .HasIndex(r => r.ReceiptDate);
        modelBuilder.Entity<MaterialReceipt>()
            .HasIndex(r => r.SupplierId);
        modelBuilder.Entity<MaterialReceipt>()
            .HasIndex(r => r.InvoiceNumber);

        // MaterialIssue indexes
        modelBuilder.Entity<MaterialIssue>()
            .HasIndex(i => i.IssueSlipNumber)
            .IsUnique();
        modelBuilder.Entity<MaterialIssue>()
            .HasIndex(i => i.IssueDate);
        modelBuilder.Entity<MaterialIssue>()
            .HasIndex(i => i.DepartmentId);

        // StoreRequisition indexes — Status stored as string for human readability
        modelBuilder.Entity<StoreRequisition>()
            .HasIndex(r => r.RequisitionNumber)
            .IsUnique();
        modelBuilder.Entity<StoreRequisition>()
            .Property(r => r.Status)
            .HasConversion<string>() // RequisitionStatus enum ↔ "Pending"/"Allowed"/"Denied"/"Draft"
            .HasMaxLength(30);
        modelBuilder.Entity<StoreRequisition>()
            .HasIndex(r => r.Status);
        modelBuilder.Entity<StoreRequisition>()
            .HasIndex(r => r.RequisitionDate);
        modelBuilder.Entity<StoreRequisition>()
            .HasIndex(r => r.DepartmentId);

        // UserPermissions: per-user permission rows (replaces JSON blob in SystemConfigurations)
        modelBuilder.Entity<UserPermission>()
            .HasIndex(p => p.UserId);
        modelBuilder.Entity<UserPermission>()
            .HasIndex(p => new { p.UserId, p.Permission })
            .IsUnique();
        modelBuilder.Entity<UserPermission>()
            .HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // UserSignatures: one-to-one relationship keyed by UserId
        modelBuilder.Entity<UserSignature>()
            .HasIndex(s => s.UserId)
            .IsUnique();
        modelBuilder.Entity<UserSignature>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // RevokedTokens: index on ExpiresAt for periodic cleanup
        modelBuilder.Entity<RevokedToken>()
            .HasIndex(t => t.ExpiresAt);
        modelBuilder.Entity<RevokedToken>()
            .HasIndex(t => t.RevokedAt);

        // PurchaseRequest & PurchaseOrder indexes
        modelBuilder.Entity<PurchaseRequest>()
            .HasIndex(p => p.PrNumber)
            .IsUnique();
        modelBuilder.Entity<PurchaseRequest>()
            .HasIndex(p => p.RequestDate);

        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(p => p.PoNumber)
            .IsUnique();
        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(p => p.PoDate);
        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(p => p.SupplierId);

        // Core & Cylinder indexes
        modelBuilder.Entity<CoreMaster>()
            .HasIndex(c => c.CoreCode)
            .IsUnique();
        modelBuilder.Entity<CylinderMaster>()
            .HasIndex(c => c.CylinderCode)
            .IsUnique();

        // Employee indexes
        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.EmployeeCode)
            .IsUnique();
        modelBuilder.Entity<StoreAttendance>()
            .HasIndex(a => new { a.EmployeeId, a.AttendanceDate })
            .IsUnique();

        // AuditLog indexes
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.Timestamp);
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.EntityName);
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.RecordId);

        // Configure cascade delete rules safely to prevent cycle or multiple cascade paths in SQL Server
        modelBuilder.Entity<MaterialReceipt>()
            .HasMany(r => r.Items)
            .WithOne(i => i.MaterialReceipt)
            .HasForeignKey(i => i.MaterialReceiptId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MaterialIssue>()
            .HasMany(i => i.Items)
            .WithOne(item => item.MaterialIssue)
            .HasForeignKey(item => item.MaterialIssueId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PurchaseRequest>()
            .HasMany(p => p.Items)
            .WithOne(i => i.PurchaseRequest)
            .HasForeignKey(i => i.PurchaseRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PurchaseOrder>()
            .HasMany(p => p.Items)
            .WithOne(i => i.PurchaseOrder)
            .HasForeignKey(i => i.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BudgetMaster>()
            .HasMany(b => b.Items)
            .WithOne(i => i.BudgetMaster)
            .HasForeignKey(i => i.BudgetMasterId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict deletes on master items referenced by transactions
        modelBuilder.Entity<StockLedger>()
            .HasOne(s => s.Material)
            .WithMany()
            .HasForeignKey(s => s.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MaterialReceiptItem>()
            .HasOne(i => i.Material)
            .WithMany()
            .HasForeignKey(i => i.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MaterialIssueItem>()
            .HasOne(i => i.Material)
            .WithMany()
            .HasForeignKey(i => i.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

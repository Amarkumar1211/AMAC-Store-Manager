using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.DTOs;
using StoreManager.Api.Models;

namespace StoreManager.Api.Services;

public interface ISystemResetService
{
    Task<MasterResetResult> ExecuteMasterResetAsync(MasterResetRequest request, int userId, string ipAddress);
}

public record MasterResetRequest(
    string ResetType,          // "TRANSACTIONS_ONLY" or "FACTORY_RESET"
    string ConfirmationPhrase, // "RESET-AMAC-DATA" or "CONFIRM-RESET"
    string? AdminPassword
);

public record MasterResetResult(
    bool Success,
    string Message,
    string? BackupCreatedPath,
    int RecordsAffected,
    DateTime Timestamp
);

public class SystemResetService : ISystemResetService
{
    private readonly StoreDbContext _context;
    private readonly IBackupService _backupService;
    private readonly ILogger<SystemResetService> _logger;

    public SystemResetService(StoreDbContext context, IBackupService backupService, ILogger<SystemResetService> logger)
    {
        _context = context;
        _backupService = backupService;
        _logger = logger;
    }

    public async Task<MasterResetResult> ExecuteMasterResetAsync(MasterResetRequest request, int userId, string ipAddress)
    {
        var adminUser = await _context.Users.FindAsync(userId);
        if (adminUser == null || adminUser.Role != UserRole.Admin)
        {
            throw new UnauthorizedAccessException("Master Data Reset requires Administrator security privileges.");
        }

        // Validate Confirmation Phrase
        var phrase = (request.ConfirmationPhrase ?? "").Trim().ToUpper();
        var validPhrases = new[] { "RESET ALL DATA" };
        if (!validPhrases.Contains(phrase))
        {
            return new MasterResetResult(
                false,
                "Invalid confirmation phrase. Please type 'RESET ALL DATA' in the confirmation box.",
                null,
                0,
                DateTime.UtcNow
            );
        }

        // A destructive reset always requires the current administrator password.
        if (string.IsNullOrWhiteSpace(request.AdminPassword))
        {
            return new MasterResetResult(false, "Administrator password is required.", null, 0, DateTime.UtcNow);
        }

        bool isPassValid;
        try
        {
            isPassValid = !string.IsNullOrWhiteSpace(adminUser.PasswordHash) &&
                BCrypt.Net.BCrypt.Verify(request.AdminPassword.Trim(), adminUser.PasswordHash);
        }
        catch
        {
            isPassValid = false;
        }

        if (!isPassValid)
        {
            return new MasterResetResult(false, "Incorrect Administrator password.", null, 0, DateTime.UtcNow);
        }

        _logger.LogWarning("Admin {Admin} ({UserId}) initiated Master Data Reset ({Type}) from IP {IP}",
            adminUser.Username, userId, request.ResetType, ipAddress);

        // 1. Take safety snapshot backup before any destructive operation
        string? backupPath = null;
        try
        {
            var backupRes = await _backupService.CreateBackupAsync(userId);
            if (backupRes.Success)
            {
                backupPath = backupRes.BackupPath;
                _logger.LogInformation("Safety backup created before reset: {BackupPath}", backupPath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Safety pre-reset backup could not be completed, proceeding with reset.");
        }

        var strategy = _context.Database.CreateExecutionStrategy();
        int affectedCount = 0;

        if (request.ResetType.Equals("FACTORY_RESET", StringComparison.OrdinalIgnoreCase))
        {
            // COMPLETE FACTORY RESET
            await strategy.ExecuteAsync(async () =>
            {
                using var tx = await _context.Database.BeginTransactionAsync();
                try
                {
                    await _context.Database.ExecuteSqlRawAsync(@"
                        EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';

                        DELETE FROM CottonGloveConsumptions;
                        DELETE FROM StoreAttendances;
                        DELETE FROM Employees;
                        DELETE FROM CylinderTransactions;
                        DELETE FROM CylinderMaster;
                        DELETE FROM CoreRejections;
                        DELETE FROM CoreDailyTrackings;
                        DELETE FROM CoreMaster;
                        DELETE FROM CostSavingInitiatives;
                        DELETE FROM MaterialBudgets;
                        DELETE FROM BudgetMasters;
                        DELETE FROM PurchaseOrderItems;
                        DELETE FROM PurchaseOrders;
                        DELETE FROM PurchaseRequestItems;
                        DELETE FROM PurchaseRequests;
                        DELETE FROM StoreRequisitionItems;
                        DELETE FROM StoreRequisitions;
                        DELETE FROM MaterialIssueItems;
                        DELETE FROM MaterialIssues;
                        DELETE FROM MaterialReceiptItems;
                        DELETE FROM MaterialReceipts;
                        DELETE FROM StockAdjustments;
                        DELETE FROM StockLedger;
                        DELETE FROM MaterialBatches;
                        DELETE FROM MaterialColourCodes;
                        DELETE FROM SupplierPriceHistories;
                        DELETE FROM SupplierMaterialPrices;
                        DELETE FROM Materials;
                        DELETE FROM Suppliers;
                        DELETE FROM MaterialCategories;
                        DELETE FROM Departments;
                        DELETE FROM AuditLogs;

                        EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';
                    ");

                    await tx.CommitAsync();
                }
                catch (Exception ex)
                {
                    await tx.RollbackAsync();
                    _logger.LogError(ex, "Failed executing factory reset SQL.");
                    throw;
                }
            });

            // Reseed default system configurations, categories, departments, users
            await DbInitializer.InitializeAsync(_context, _logger);

            // Add Audit log
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Username = adminUser.Username,
                Action = "FACTORY_RESET",
                EntityName = "SYSTEM_DATABASE",
                RecordId = "0",
                NewValues = $"Complete factory reset executed. Safety backup: {backupPath ?? "N/A"}",
                IpAddress = ipAddress,
                Timestamp = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return new MasterResetResult(
                true,
                "Complete Factory Reset Successful. All transactional and master data deleted. Default system configuration and administrator accounts re-initialized.",
                backupPath,
                affectedCount,
                DateTime.UtcNow
            );
        }
        else
        {
            // TRANSACTIONS ONLY RESET (Keep Materials, Suppliers, Categories, Users)
            await strategy.ExecuteAsync(async () =>
            {
                using var tx = await _context.Database.BeginTransactionAsync();
                try
                {
                    affectedCount += await _context.StockLedgers.ExecuteDeleteAsync();
                    affectedCount += await _context.StockAdjustments.ExecuteDeleteAsync();
                    affectedCount += await _context.MaterialIssueItems.ExecuteDeleteAsync();
                    affectedCount += await _context.MaterialIssues.ExecuteDeleteAsync();
                    affectedCount += await _context.MaterialReceiptItems.ExecuteDeleteAsync();
                    affectedCount += await _context.MaterialReceipts.ExecuteDeleteAsync();
                    affectedCount += await _context.MaterialBatches.ExecuteDeleteAsync();
                    affectedCount += await _context.PurchaseOrderItems.ExecuteDeleteAsync();
                    affectedCount += await _context.PurchaseOrders.ExecuteDeleteAsync();
                    affectedCount += await _context.PurchaseRequestItems.ExecuteDeleteAsync();
                    affectedCount += await _context.PurchaseRequests.ExecuteDeleteAsync();
                    affectedCount += await _context.StoreRequisitionItems.ExecuteDeleteAsync();
                    affectedCount += await _context.StoreRequisitions.ExecuteDeleteAsync();
                    affectedCount += await _context.CoreDailyTrackings.ExecuteDeleteAsync();
                    affectedCount += await _context.CoreRejections.ExecuteDeleteAsync();
                    affectedCount += await _context.CylinderTransactions.ExecuteDeleteAsync();
                    affectedCount += await _context.StoreAttendances.ExecuteDeleteAsync();
                    affectedCount += await _context.CottonGloveConsumptions.ExecuteDeleteAsync();

                    await tx.CommitAsync();
                }
                catch (Exception ex)
                {
                    await tx.RollbackAsync();
                    _logger.LogError(ex, "Failed executing transactions reset.");
                    throw;
                }
            });

            // Add Audit log
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Username = adminUser.Username,
                Action = "TRANSACTIONS_RESET",
                EntityName = "TRANSACTION_LEDGERS",
                RecordId = "0",
                NewValues = $"All transactions cleared ({affectedCount} rows deleted, all material stock balances reset to 0). Safety backup: {backupPath ?? "N/A"}",
                IpAddress = ipAddress,
                Timestamp = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return new MasterResetResult(
                true,
                $"Transactions Reset Successful. All receipts, issues, adjustments, purchase orders, attendance, and ledger entries deleted ({affectedCount} records). All material stock balances reset to 0. Material Master and Suppliers retained.",
                backupPath,
                affectedCount,
                DateTime.UtcNow
            );
        }
    }
}

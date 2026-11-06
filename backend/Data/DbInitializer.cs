using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Models;

namespace StoreManager.Api.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(StoreDbContext context, ILogger logger)
    {
        try
        {
            if (context.Database.IsSqlite())
            {
                logger.LogInformation("Using SQLite provider. Ensuring database tables are created locally...");
                await context.Database.EnsureCreatedAsync();
                logger.LogInformation("SQLite local database ready.");
            }
            else
            {
                logger.LogInformation("Using SQL Server provider. Checking database existence and applying migrations...");
                await context.Database.MigrateAsync();
                logger.LogInformation("Database migrations applied successfully.");
            }

            // Seed System Configurations
            if (!await context.SystemConfigurations.AnyAsync())
            {
                logger.LogInformation("Seeding default system configurations...");
                context.SystemConfigurations.AddRange(
                    new SystemConfiguration { Key = "CompanyName", Value = "ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD", Description = "Company Legal Name" },
                    new SystemConfiguration { Key = "UnitName", Value = "UNIT-5", Description = "Manufacturing Unit" },
                    new SystemConfiguration { Key = "CompanyAddress", Value = "No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132", Description = "Plant Address" },
                    new SystemConfiguration { Key = "CompanyContact", Value = "Tel. 9606082298, e-mail: kdcpurchase@amacpvt.com", Description = "Contact Information" },
                    new SystemConfiguration { Key = "PrFormatNo", Value = "GDC-PUR-FF-07 Rev 02", Description = "Purchase Requisition Document Format" },
                    new SystemConfiguration { Key = "IssueSlipFormatNo", Value = "KDC-STR-FF-09 Rev 01", Description = "Material Issue Slip Document Format" },
                    new SystemConfiguration { Key = "TargetDaysStock", Value = "22", Description = "Standard target buffer inventory days" }
                );
                await context.SaveChangesAsync();
            }

            // Seed or ensure default user accounts exist with reliable initial credentials
            string SeedPassword(string username) =>
                Environment.GetEnvironmentVariable($"STORE_SEED_PASSWORD_{username.Replace('.', '_').ToUpperInvariant()}")
                ?? (username.ToLowerInvariant() switch
                {
                    "admin" => "Admin@123",
                    "store.manager" or "storemanager" => "Store@123",
                    "store.user" or "storeuser" => "Store@123",
                    "purchase.user" or "purchaseuser" => "Purchase@123",
                    "viewer" => "Viewer@123",
                    _ => $"{char.ToUpper(username[0])}{username.Substring(1).Replace(".", "")}@123"
                });

            var defaultAccounts = new[]
            {
                new { Username = "admin", Password = SeedPassword("admin"), FullName = "System Administrator", Email = "admin@amacpvt.com", Role = UserRole.Admin, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "store.manager", Password = SeedPassword("store.manager"), FullName = "Store Manager", Email = "storemanager@amacpvt.com", Role = UserRole.StoreManager, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "storemanager", Password = SeedPassword("storemanager"), FullName = "Store Manager", Email = "storemanager@amacpvt.com", Role = UserRole.StoreManager, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "store.user", Password = SeedPassword("store.user"), FullName = "Store Operator", Email = "store@amacpvt.com", Role = UserRole.StoreUser, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "storeuser", Password = SeedPassword("storeuser"), FullName = "Store Operator", Email = "store@amacpvt.com", Role = UserRole.StoreUser, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "purchase.user", Password = SeedPassword("purchase.user"), FullName = "Purchase Officer", Email = "kdcpurchase@amacpvt.com", Role = UserRole.PurchaseUser, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "purchaseuser", Password = SeedPassword("purchaseuser"), FullName = "Purchase Officer", Email = "kdcpurchase@amacpvt.com", Role = UserRole.PurchaseUser, DeptId = (int?)null, DeptName = (string?)null },
                new { Username = "viewer", Password = SeedPassword("viewer"), FullName = "Management Viewer", Email = "management@amacpvt.com", Role = UserRole.Viewer, DeptId = (int?)null, DeptName = (string?)null },

                // Department Specific Accounts
                new { Username = "production", Password = SeedPassword("production"), FullName = "Rajesh Kumar (Production Supervisor)", Email = "production@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)52, DeptName = (string?)"PRODUCTION" },
                new { Username = "diemaintenance", Password = SeedPassword("diemaintenance"), FullName = "Murugan K. (Die Maintenance)", Email = "diemaintenance@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)56, DeptName = (string?)"DIE MAINTENANCE" },
                new { Username = "fettling", Password = SeedPassword("fettling"), FullName = "Venkatesh S. (Fettling)", Email = "fettling@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)55, DeptName = (string?)"FETTLING" },
                new { Username = "quality", Password = SeedPassword("quality"), FullName = "Prakash Nair (Quality)", Email = "quality@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)54, DeptName = (string?)"QUALITY" },
                new { Username = "welding", Password = SeedPassword("welding"), FullName = "Manjunath R. (Welding)", Email = "welding@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)57, DeptName = (string?)"WELDING" },
                new { Username = "postoperation", Password = SeedPassword("postoperation"), FullName = "Anil Verma (Post Operation)", Email = "postop@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)53, DeptName = (string?)"POST OPERATION" },
                new { Username = "ppe", Password = SeedPassword("ppe"), FullName = "Kiran Kumar (Safety Incharge)", Email = "safety@amacpvt.com", Role = UserRole.DepartmentUser, DeptId = (int?)58, DeptName = (string?)"PPE" }
            };

            foreach (var acc in defaultAccounts)
            {
                if (string.IsNullOrWhiteSpace(acc.Password)) continue;
                var existing = await context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == acc.Username.ToLower());
                if (existing == null)
                {
                    context.Users.Add(new User
                    {
                        Username = acc.Username,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(acc.Password),
                        VisiblePassword = acc.Password,
                        FullName = acc.FullName,
                        Email = acc.Email,
                        Role = acc.Role,
                        DepartmentId = acc.DeptId,
                        DepartmentName = acc.DeptName,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    existing.Role = acc.Role;
                    existing.DepartmentId = acc.DeptId;
                    existing.DepartmentName = acc.DeptName;
                    existing.IsActive = true;
                }
            }
            await context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred during database initialization/seeding.");
            throw;
        }
    }
}

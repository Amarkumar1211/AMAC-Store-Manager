using System.Text;
using System.Text.Json.Serialization;
using System.Diagnostics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StoreManager.Api.Data;
using StoreManager.Api.Services;
using System.Threading.RateLimiting;

// ==============================================================================
// 1. Windows Single-Instance Application Enforcement (Named Mutex)
// Prevents multiple concurrent instances, port collisions, and Chromium cache corruption
// ==============================================================================
const string AppMutexName = @"Global\AMAC_StoreManager_SingleInstance_Mutex_Unit5";
using var singleInstanceMutex = new Mutex(true, AppMutexName, out bool isInitialInstance);

if (!isInitialInstance)
{
    // A copy is already running. Signal / launch Edge to bring existing instance into view, then exit immediately.
    try
    {
        var edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
        if (!File.Exists(edgePath)) edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
        var profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AMAC_StoreManager", "DesktopAppProfile");
        if (File.Exists(edgePath))
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = edgePath,
                Arguments = $"--app=http://127.0.0.1:1000 --user-data-dir=\"{profileDir}\" --no-proxy-server --explicitly-allowed-ports=1000",
                UseShellExecute = false
            });
        }
        else
        {
            Process.Start(new ProcessStartInfo("http://127.0.0.1:1000") { UseShellExecute = true });
        }
    }
    catch { }
    return;
}

// ==============================================================================
// 2. Kill any stale / orphaned background processes from previous days or crashes
// ==============================================================================
try
{
    var currentPid = Process.GetCurrentProcess().Id;
    var processNames = new[] { "AMAC_StoreManager", "StoreManager.Api" };
    foreach (var name in processNames)
    {
        foreach (var p in Process.GetProcessesByName(name))
        {
            if (p.Id != currentPid)
            {
                try { p.Kill(); } catch { }
            }
        }
    }
}
catch { }

var webAppOptions = new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory,
    WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot")
};
var builder = WebApplication.CreateBuilder(webAppOptions);

// Configure standard HTTP binding (Port 1000 on all network interfaces)
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false; // Do not emit 'Server: Kestrel' header
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
});
builder.WebHost.UseUrls("http://0.0.0.0:1000");

// 1. Add Database Context (Smart Dual-Provider: SQLite local file or SQL Server)
var dbProvider = builder.Configuration["Database:Provider"] ?? "SqlServer";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Database=StoreManagerDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";

builder.Services.AddDbContext<StoreDbContext>(options =>
{
    if (dbProvider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        var rawDir = builder.Configuration["Database:SqliteDirectory"] ?? @"%LocalAppData%\AMAC_StoreManager\Database";
        var dbDir = Environment.ExpandEnvironmentVariables(rawDir);
        Directory.CreateDirectory(dbDir);
        var dbFileName = builder.Configuration["Database:SqliteFileName"] ?? "StoreManager.db";
        var dbPath = Path.Combine(dbDir, dbFileName);
        options.UseSqlite($"Data Source={dbPath}");
    }
    else
    {
        options.UseSqlServer(connectionString, sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null);
        });
    }
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// 2. Add JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    // Standalone desktop fallback key
    jwtKey = "AMAC_StoreManager_SuperSecretKey_2026_Secure_Token_Key_987654321";
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "StoreManagerApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "StoreManagerClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };

    // Check token revocation on every authenticated request
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var jti = context.Principal?.FindFirst("jti")?.Value;
            if (!string.IsNullOrEmpty(jti))
            {
                var dbContext = context.HttpContext.RequestServices.GetRequiredService<StoreDbContext>();
                var isRevoked = await dbContext.RevokedTokens.AnyAsync(t => t.Jti == jti);
                if (isRevoked)
                {
                    context.Fail("Token has been revoked.");
                }
            }
        }
    };
});

builder.Services.AddAuthorization();

// 3. Add CORS for LAN and local dev
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
          policy.WithOrigins("http://localhost:5174", "http://127.0.0.1:5174")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 4. Login Rate Limiting — max 10 attempts per 5 minutes per IP
builder.Services.AddRateLimiter(rateLimiterOptions =>
{
    rateLimiterOptions.AddFixedWindowLimiter("LoginPolicy", options =>
    {
        options.PermitLimit = 10;
        options.Window = TimeSpan.FromMinutes(5);
        options.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        options.QueueLimit = 0; // No queuing — reject immediately when limit hit
    });
    rateLimiterOptions.RejectionStatusCode = 429; // Too Many Requests
});

// 5. IHttpContextAccessor — required for IP capture in services and audit logs
builder.Services.AddHttpContextAccessor();

// 6. Add Services
builder.Services.AddScoped<IStockService, StockService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IExcelMigrationService, ExcelMigrationService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddScoped<ISystemResetService, SystemResetService>();
builder.Services.AddScoped<IMasterDataImportService, MasterDataImportService>();
builder.Services.AddScoped<IAutoRequisitionService, AutoRequisitionService>();
builder.Services.AddScoped<IStoreRequisitionService, StoreRequisitionService>();
builder.Services.AddSingleton<IRequisitionNotificationService, RequisitionNotificationService>();
builder.Services.AddHostedService<DailyAutoRequisitionBackgroundService>();

// 7. Add Controllers with JSON configuration
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// 8. Automatic First-Run Setup & Database Migration
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<StoreDbContext>();
        await DbInitializer.InitializeAsync(context, logger);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while initializing or migrating the database.");
    }
}

app.UseRateLimiter();
app.UseCors("AllowAll");

// Serve Static Frontend React SPA from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("index.html");

// Auto-Launch Native Desktop Window for Desktop .EXE mode
var disableAutoWindow = app.Configuration.GetValue<bool>("DisableAutoWindow", false) 
    || Environment.GetEnvironmentVariable("DISABLE_AUTO_WINDOW") == "1";

if (!app.Environment.IsDevelopment() && !disableAutoWindow)
{
    _ = Task.Run(async () =>
    {
        try
        {
            // Robust check: Wait until the local web server and database are 100% ready before opening window
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            var isReady = false;
            for (int i = 0; i < 60; i++)
            {
                try
                {
                    var response = await client.GetAsync("http://127.0.0.1:1000/index.html");
                    if (response.IsSuccessStatusCode)
                    {
                        isReady = true;
                        break;
                    }
                }
                catch { }
                await Task.Delay(250);
            }

            if (!isReady) return;

            var edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edgePath))
            {
                edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
            }

            var url = "http://127.0.0.1:1000";
            var profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AMAC_StoreManager", "DesktopAppProfile");
            Directory.CreateDirectory(profileDir);

            // Clean up stale Chromium session restore files before launching so Edge never restores interrupted API streams or corrupt caches
            try
            {
                var sessionsDir = Path.Combine(profileDir, "Default", "Sessions");
                if (Directory.Exists(sessionsDir))
                {
                    Directory.Delete(sessionsDir, true);
                }
            }
            catch { }

            if (File.Exists(edgePath))
            {
                var edgeArgs = string.Join(" ", new[]
                {
                    $"--app={url}",
                    $"--user-data-dir=\"{profileDir}\"",
                    "--window-size=1440,900",
                    "--no-proxy-server",                                    // Direct localhost loopback, prevents antivirus proxy socket interception
                    "--explicitly-allowed-ports=1000",                      // Ensure Edge never blocks port 1000
                    "--disable-features=msStartupBoost,msEdgeSidebarV2",   // Prevents Edge background helper processes from lingering
                    "--disable-background-mode",                            // Disables background apps when Edge closes
                    "--disable-background-networking",                      // Disables background networking/sync
                    "--disable-session-crashed-bubble",                      // Never show crash recovery dialog
                    "--disable-restore-session-state",                       // Never restore previous tabs or background streams
                    "--no-first-run",                                       // Skip welcome wizards
                    "--no-default-browser-check",                           // Skip default browser prompts
                    "--disk-cache-size=33554432"                            // Capped at 32MB to prevent bloated corrupted cache
                });

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = edgePath,
                    Arguments = edgeArgs,
                    UseShellExecute = false
                };
                var edgeProc = System.Diagnostics.Process.Start(psi);
                if (edgeProc != null)
                {
                    await edgeProc.WaitForExitAsync();
                    // Force complete application shutdown when window is closed
                    Environment.Exit(0);
                }
            }
            else
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
        }
        catch { }
    });
}

app.Run();


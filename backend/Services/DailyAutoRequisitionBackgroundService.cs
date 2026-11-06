using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace StoreManager.Api.Services;

public class DailyAutoRequisitionBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DailyAutoRequisitionBackgroundService> _logger;

    // Target hour for daily automated execution: 18:00:00 (6:00 PM)
    private const int TargetHour = 18;
    private const int TargetMinute = 0;

    public DailyAutoRequisitionBackgroundService(IServiceProvider serviceProvider, ILogger<DailyAutoRequisitionBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Daily Auto-Requisition 6:00 PM Background Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // FIX: Use India Standard Time explicitly so the 6 PM trigger fires at 6 PM IST
                // regardless of the OS timezone configured on the server.
                var istZone = TimeZoneInfo.FindSystemTimeZoneById(
                    OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");
                var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istZone);
                var nextRun = new DateTime(now.Year, now.Month, now.Day, TargetHour, TargetMinute, 0);

                if (now >= nextRun)
                {
                    // If 18:00 IST has already passed today, schedule for 18:00 IST tomorrow
                    nextRun = nextRun.AddDays(1);
                }

                var delay = nextRun - now;
                _logger.LogInformation("Next 6:00 PM IST Auto-Requisition scan scheduled at {NextRun} (in {Hours}h {Minutes}m).",
                    nextRun.ToString("yyyy-MM-dd HH:mm:ss"), (int)delay.TotalHours, delay.Minutes);


                // Wait until 6:00 PM
                await Task.Delay(delay, stoppingToken);

                // Execute the 6:00 PM Auto-Requisition routine
                _logger.LogInformation("Executing Daily 6:00 PM Low-Stock Auto-Requisition scan...");
                using (var scope = _serviceProvider.CreateScope())
                {
                    var autoReqService = scope.ServiceProvider.GetRequiredService<IAutoRequisitionService>();
                    var result = await autoReqService.ExecuteAutoRequisitionGenerationAsync();
                    _logger.LogInformation("Daily 6:00 PM scan completed: {Message}", result.Message);
                }

                // Add a small buffer delay so it doesn't trigger multiple times in the same minute
                await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in DailyAutoRequisitionBackgroundService. Retrying in 5 minutes...");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }

        _logger.LogInformation("Daily Auto-Requisition Background Service stopped.");
    }
}

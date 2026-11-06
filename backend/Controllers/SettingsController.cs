using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoreManager.Api.Data;
using StoreManager.Api.Models;

namespace StoreManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly StoreDbContext _context;

    public SettingsController(StoreDbContext context)
    {
        _context = context;
    }

    [HttpGet("{key}")]
    public async Task<IActionResult> GetSetting(string key)
    {
        var config = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == key);
        if (config == null) return NotFound();
        return Ok(new { key = config.Key, value = config.Value });
    }

    [HttpGet]
    public async Task<IActionResult> GetAllSettings()
    {
        var configs = await _context.SystemConfigurations.ToListAsync();
        return Ok(configs.Select(c => new { key = c.Key, value = c.Value }));
    }

    [Authorize(Roles = "Admin,StoreManager")]
    [HttpPost]
    public async Task<IActionResult> SaveSettings([FromBody] Dictionary<string, string> settings)
    {
        foreach (var kvp in settings)
        {
            var config = await _context.SystemConfigurations.FirstOrDefaultAsync(c => c.Key == kvp.Key);
            if (config == null)
            {
                config = new SystemConfiguration
                {
                    Key = kvp.Key,
                    Value = kvp.Value,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.SystemConfigurations.Add(config);
            }
            else
            {
                config.Value = kvp.Value;
                config.UpdatedAt = DateTime.UtcNow;
            }
        }
        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = "Settings saved successfully." });
    }
}

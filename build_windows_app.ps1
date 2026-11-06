# ==============================================================================
# AMAC Store & Material Management System - Windows .EXE & Installer Builder
# ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5
# ==============================================================================

$Host.UI.RawUI.WindowTitle = "AMAC Store Manager - Windows .EXE Builder"
Clear-Host

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "              ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5         " -ForegroundColor Yellow
Write-Host "                WINDOWS DESKTOP APPLICATION & INSTALLER BUILDER          " -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
if (-not $WorkspaceRoot) { $WorkspaceRoot = Get-Location }

$FrontendDir = Join-Path $WorkspaceRoot "frontend"
$BackendDir = Join-Path $WorkspaceRoot "backend"
$OutputDir = Join-Path $WorkspaceRoot "dist-desktop"
$InstallerDir = Join-Path $WorkspaceRoot "dist-installer"
$WwwRootDir = Join-Path $BackendDir "wwwroot"
$IssFile = Join-Path $WorkspaceRoot "installer.iss"
$AppIcon = Join-Path $WorkspaceRoot "app_icon.ico"

# 1. Stop existing instances to unlock files
Write-Host "`n[1/6] Stopping any active instances to release file locks..." -ForegroundColor Gray
Get-Process "StoreManager.Api","AMAC_StoreManager" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 2. Prepare directories
Write-Host "[2/6] Preparing build output folders..." -ForegroundColor Gray
if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force -ErrorAction SilentlyContinue }
if (-not (Test-Path $InstallerDir)) { New-Item -ItemType Directory -Path $InstallerDir -Force | Out-Null }
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# 3. Build React Frontend SPA
Write-Host "[3/6] Building React Frontend Single Page Application (npm run build)..." -ForegroundColor Green
Push-Location $FrontendDir
try {
    $npmBuild = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build" -Wait -PassThru -NoNewWindow
    if ($npmBuild.ExitCode -ne 0) {
        Write-Host "ERROR: Frontend compilation failed! Aborting." -ForegroundColor Red
        Pop-Location
        exit 1
    }
} finally {
    Pop-Location
}

# Copy Frontend dist to Backend wwwroot
Write-Host "   -> Deploying compiled UI assets to backend wwwroot..." -ForegroundColor Gray
$FrontendDist = Join-Path $FrontendDir "dist"
if (Test-Path $FrontendDist) {
    Copy-Item -Path "$FrontendDist\*" -Destination $WwwRootDir -Recurse -Force
} else {
    Write-Host "ERROR: Frontend dist directory not found!" -ForegroundColor Red
    exit 1
}

# 4. Publish Self-Contained .NET 9 Backend
Write-Host "[4/6] Publishing Self-Contained Windows Executable (.NET 9 win-x64)..." -ForegroundColor Green
& dotnet publish "$BackendDir\StoreManager.Api.csproj" -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o "$OutputDir"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend dotnet publish failed! Aborting." -ForegroundColor Red
    exit 1
}

# Copy app icon to dist-desktop
if (Test-Path $AppIcon) {
    Copy-Item $AppIcon -Destination (Join-Path $OutputDir "app_icon.ico") -Force
}

# 5. Create Standalone AppSettings for local SQLite database auto-creation
Write-Host "[5/6] Configuring standalone Local Database (SQLite in %LocalAppData%)..." -ForegroundColor Cyan
$standaloneSettings = @{
    "Logging" = @{
        "LogLevel" = @{
            "Default" = "Information"
            "Microsoft.AspNetCore" = "Warning"
            "Microsoft.EntityFrameworkCore.Database.Command" = "Warning"
        }
    }
    "AllowedHosts" = "*"
    "Database" = @{
        "Provider" = "Sqlite"
        "SqliteDirectory" = "%LocalAppData%\AMAC_StoreManager\Database"
        "SqliteFileName" = "StoreManager.db"
    }
    "ConnectionStrings" = @{
        "DefaultConnection" = "Server=localhost;Database=StoreManagerDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;"
    }
    "Jwt" = @{
        "Key" = "AMAC_StoreManager_SuperSecretKey_2026_Secure_Token_Key_987654321"
        "Issuer" = "StoreManagerApi"
        "Audience" = "StoreManagerClient"
        "ExpiryDays" = 30
    }
    "Backup" = @{
        "Directory" = "%LocalAppData%\AMAC_StoreManager\Backups"
    }
    "EPPlus" = @{
        "ExcelPackage" = @{
            "License" = "NonCommercial"
        }
    }
} | ConvertTo-Json -Depth 5

Set-Content -Path (Join-Path $OutputDir "appsettings.json") -Value $standaloneSettings -Encoding UTF8

# 6. Compile Windows Setup Installer using Inno Setup
Write-Host "[6/6] Compiling Windows Installer (StoreManager_Setup_v1.0.exe)..." -ForegroundColor Green
$IsccPaths = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)

$IsccExe = $null
foreach ($path in $IsccPaths) {
    if (Test-Path $path) {
        $IsccExe = $path
        break
    }
}

if ($IsccExe) {
    Write-Host "   -> Using Inno Setup Compiler: $IsccExe" -ForegroundColor Gray
    & $IsccExe "$IssFile"
    if ($LASTEXITCODE -eq 0) {
        $installerPath = Join-Path $InstallerDir "StoreManager_Setup_v1.0.exe"
        if (Test-Path $installerPath) {
            $rootInstaller = Join-Path $WorkspaceRoot "StoreManager_Setup_v1.0.exe"
            Copy-Item $installerPath -Destination $rootInstaller -Force
            
            # Update Desktop shortcut
            try {
                $WshShell = New-Object -ComObject WScript.Shell
                $Shortcut = $WshShell.CreateShortcut("C:\Users\AMAC-U1\Desktop\Install AMAC Store Manager.lnk")
                $Shortcut.TargetPath = $rootInstaller
                $Shortcut.IconLocation = $AppIcon
                $Shortcut.Description = "Install AMAC Store & Material Management System"
                $Shortcut.Save()
            } catch {}

            $sizeMb = [math]::Round((Get-Item $installerPath).Length / 1MB, 2)
            Write-Host "`n================================================================================" -ForegroundColor Green
            Write-Host " SUCCESS: Windows Installer Successfully Created!" -ForegroundColor Green
            Write-Host " Location : $rootInstaller" -ForegroundColor White
            Write-Host " Size     : $sizeMb MB" -ForegroundColor White
            Write-Host "================================================================================" -ForegroundColor Green
        }
    } else {
        Write-Host "WARNING: Inno Setup compilation exited with code $LASTEXITCODE." -ForegroundColor Yellow
    }
} else {
    Write-Host "NOTE: Inno Setup compiler (ISCC.exe) not found. Desktop folder ready in dist-desktop/." -ForegroundColor Yellow
}

$standaloneExe = Join-Path $OutputDir "AMAC_StoreManager.exe"
if (Test-Path $standaloneExe) {
    $exeSizeMb = [math]::Round((Get-Item $standaloneExe).Length / 1MB, 2)
    Write-Host "`n Standalone Desktop App (.exe): $standaloneExe ($exeSizeMb MB)" -ForegroundColor Cyan
    Write-Host " You can run this .exe directly or share the installer setup file!" -ForegroundColor Cyan
}

Write-Host "`nBuild complete!`n" -ForegroundColor Green

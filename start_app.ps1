# ==============================================================================
# AMAC Store & Material Management System - 1-Click Application Launcher (HTTP)
# ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5
# ==============================================================================

$Host.UI.RawUI.WindowTitle = "AMAC Store & Material Manager - Application Launcher"
Clear-Host

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "              ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5         " -ForegroundColor Yellow
Write-Host "                    AMAC STORE & MATERIAL MANAGEMENT SYSTEM                     " -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan

$WorkspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"

# Set the JWT Key directly for the session to ensure backend starts without errors
$env:Jwt__Key = "AMAC_StoreManager_SuperSecretKey_2026_Secure_Token_Key_987654321"

# 1. Stop existing instances if any to prevent port collision
Write-Host "`n[1/4] Checking and clearing ports 1000, 5174..." -ForegroundColor Gray
Get-Process StoreManager.Api, AMAC_StoreManager -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 1000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Get-NetTCPConnection -LocalPort 5174 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Write-Host "   -> Clearing orphaned tunnel processes..." -ForegroundColor Gray
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "localtunnel|cloudflared" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# 2. Start ASP.NET Core Web API Server (HTTP Port 1000)
Write-Host "[2/4] Starting ASP.NET Core Backend Server (HTTP Port 1000)..." -ForegroundColor Green
$BackendStdOut = Join-Path $env:TEMP "store-manager-backend-$PID.out.log"
$BackendStdErr = Join-Path $env:TEMP "store-manager-backend-$PID.err.log"
Remove-Item $BackendStdOut, $BackendStdErr -Force -ErrorAction SilentlyContinue
$BackendProcess = Start-Process -FilePath "dotnet" -ArgumentList "run --no-launch-profile" -WorkingDirectory $BackendDir -WindowStyle Minimized -PassThru -RedirectStandardOutput $BackendStdOut -RedirectStandardError $BackendStdErr

# 3. Start React + Vite Frontend Client (HTTP Port 5174)
Write-Host "[3/4] Starting React Frontend Client (HTTP Port 5174)..." -ForegroundColor Green
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "   -> First run detected. Installing Frontend dependencies (this may take a minute)..." -ForegroundColor Yellow
    $installProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install" -WorkingDirectory $FrontendDir -Wait -NoNewWindow
}
$FrontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev -- --host 0.0.0.0 --port 5174" -WorkingDirectory $FrontendDir -WindowStyle Minimized -PassThru

# 4. Wait for services to initialize
Write-Host "[4/4] Waiting for services to initialize..." -ForegroundColor Yellow
$MaxRetries = 90
$ServerReady = $false

for ($i = 1; $i -le $MaxRetries; $i++) {
    Start-Sleep -Seconds 1
    if (($i % 10) -eq 0) {
        Write-Host "   Still waiting for backend... ($i/$MaxRetries seconds)" -ForegroundColor DarkGray
    }
    if ($BackendProcess.HasExited) {
        Write-Host "ERROR: Backend process exited during startup." -ForegroundColor Red
        if (Test-Path $BackendStdErr) { Get-Content $BackendStdErr | Select-Object -Last 20 }
        if (Test-Path $BackendStdOut) { Get-Content $BackendStdOut | Select-Object -Last 20 }
        exit 1
    }
    try {
        $testApi = Invoke-WebRequest -Uri "http://127.0.0.1:1000/api/system/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($testApi.StatusCode -eq 200) { $ServerReady = $true; break }
    }
    catch {}
}

if (-not $ServerReady) {
    Write-Host "ERROR: Backend did not become ready on http://localhost:1000." -ForegroundColor Red
    Write-Host "Check the backend process window and database connection, then try again." -ForegroundColor Yellow
    Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Get Local LAN IP Address
$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.*" -and $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress
if (-not $LocalIp) { $LocalIp = "127.0.0.1" }

# 5. Start Zero-Config Global Internet Tunnel (Cloudflare)
Write-Host "[5/5] Creating Fast, Bug-Free Internet Link (Cloudflare)..." -ForegroundColor Green
$CloudflaredPath = Join-Path $WorkspaceRoot "cloudflared.exe"
if (-not (Test-Path $CloudflaredPath)) {
    Write-Host "   -> First run detected. Downloading Cloudflare Tunnel engine (30MB)..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $CloudflaredPath
}

$TunnelLog = Join-Path $env:TEMP "cloudflare-tunnel.log"
Remove-Item $TunnelLog -Force -ErrorAction SilentlyContinue
$TunnelProcess = Start-Process -FilePath $CloudflaredPath -ArgumentList "tunnel --url http://127.0.0.1:5174" -WindowStyle Hidden -PassThru -RedirectStandardError $TunnelLog

# Extract the temporary Cloudflare URL from the log
Write-Host "   -> Generating secure global link..." -ForegroundColor DarkGray
$GlobalUrl = $null
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $TunnelLog) {
        $logContent = Get-Content $TunnelLog -Raw
        if ($logContent -match "(https://[a-zA-Z0-9-]{10,}\.trycloudflare\.com)") {
            $GlobalUrl = $matches[1]
            break
        }
    }
}

# Launch Default Browser locally
Start-Process "http://localhost:5174"

Clear-Host
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "       AMAC STORE & MATERIAL MANAGEMENT SYSTEM IS ONLINE!                       " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

if ($GlobalUrl) {
    Write-Host "`n>> GLOBAL INTERNET ACCESS (ACCESS FROM ANYWHERE IN THE WORLD):" -ForegroundColor Magenta
    Write-Host "   [*] Secure Cloudflare Link                         : " -NoNewline; Write-Host $GlobalUrl -ForegroundColor Yellow
    Write-Host "   (Note: This link changes every time you restart the script for security)" -ForegroundColor DarkGray
} else {
    Write-Host "`n>> GLOBAL INTERNET ACCESS:" -ForegroundColor Magenta
    Write-Host "   [!] Cloudflare Tunnel failed to generate a link. Check $TunnelLog" -ForegroundColor Red
}

Write-Host "`n>> LOCAL LAN ACCESS (FASTEST SPEED / NO INTERNET REQUIRED):" -ForegroundColor White
Write-Host "   [*] Other Devices (Phones / Tablets on Wi-Fi)      : " -NoNewline; Write-Host "http://${LocalIp}:5174" -ForegroundColor Green
Write-Host "   [*] This PC (Localhost)                            : " -NoNewline; Write-Host "http://localhost:5174" -ForegroundColor Cyan

Write-Host "`n>> PROCESS STATUS:" -ForegroundColor White
Write-Host "   Backend API PID  : $($BackendProcess.Id)" -ForegroundColor Gray
Write-Host "   Frontend Web PID : $($FrontendProcess.Id)" -ForegroundColor Gray
Write-Host "   Cloudflare PID   : $($TunnelProcess.Id)" -ForegroundColor Gray

Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "  Keep this window open while using the application.                            " -ForegroundColor White
Write-Host "  To stop the application, close this window.                                   " -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan

# Keep process alive and monitor
while ($true) {
    Start-Sleep -Seconds 2
}

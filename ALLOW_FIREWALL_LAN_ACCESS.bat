@echo off
:: ==============================================================================
:: AMAC Store & Material Management System - Allow Windows Firewall LAN Access (HTTP)
:: ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD - UNIT-5
:: ==============================================================================
title AMAC Store Manager - Configure Windows Firewall for LAN Access
color 0A

echo ================================================================================
echo    AMAC STORE MANAGER - CONFIGURE WINDOWS FIREWALL FOR MULTI-DEVICE LAN
echo ================================================================================
echo.
echo Checking Administrator privileges...

net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0C
    echo [ERROR] This script requires Administrator privileges!
    echo Please right-click this file and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo [OK] Running as Administrator.
echo.
echo [1/2] Opening Inbound Port 5174 (React Frontend UI)...
netsh advfirewall firewall delete rule name="AMAC Store Manager Frontend (Port 5174)" >nul 2>&1
netsh advfirewall firewall add rule name="AMAC Store Manager Frontend (Port 5174)" dir=in action=allow protocol=TCP localport=5174 profile=any >nul
echo [OK] Port 5174 allowed in Windows Firewall.

echo [2/2] Opening Inbound Port 5000 (ASP.NET Core Backend API)...
netsh advfirewall firewall delete rule name="AMAC Store Manager Backend API (Port 5000)" >nul 2>&1
netsh advfirewall firewall add rule name="AMAC Store Manager Backend API (Port 5000)" dir=in action=allow protocol=TCP localport=5000 profile=any >nul
echo [OK] Port 5000 allowed in Windows Firewall.

echo.
echo ================================================================================
echo   SUCCESS: Windows Firewall has been configured for LAN multi-device access!
echo ================================================================================
echo.
echo Other devices (Phones, Tablets, Laptops) on your local Wi-Fi / Ethernet
echo can now access the AMAC Store Manager directly at:
echo.
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0.*0.0.0.0"') do (
    echo    http://%%a:5174
)
echo.
pause

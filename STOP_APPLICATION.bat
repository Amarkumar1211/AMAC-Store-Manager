@echo off
title Stop AMAC Store ^& Material Management Application
cd /d "%~dp0"
echo ================================================================
echo    Stopping AMAC Store ^& Material Management Application...
echo ================================================================

taskkill /F /IM StoreManager.Api.exe >nul 2>&1
taskkill /F /IM dotnet.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo.
echo [OK] All backend and frontend servers have been stopped.
echo ================================================================
pause

@echo off
title AMAC Store ^& Material Management Launcher
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\start_app.ps1"
pause

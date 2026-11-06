$WScriptShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ShortcutPath = Join-Path $DesktopPath "AMAC Store Manager.lnk"
$TargetPath = "C:\Users\AMAC-U1\Desktop\Store Manager\START_APPLICATION.bat"
$WorkingDirectory = "C:\Users\AMAC-U1\Desktop\Store Manager"

$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $WorkingDirectory
$Shortcut.Description = "Launch AMAC Store & Material Management System"
$Shortcut.IconLocation = "shell32.dll,43"
$Shortcut.Save()

Write-Host "Created Desktop Shortcut: $ShortcutPath" -ForegroundColor Green
